import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PDF = 'test/fixtures/GRADE-11-HISTORY.pdf';
const data = new Uint8Array(fs.readFileSync(PDF));
const doc = await pdfjs.getDocument({ data }).promise;

for (const pageNo of [1, 11]) {
  const page = await doc.getPage(pageNo);
  await page.getOperatorList();               // REQUIRED before commonObjs is populated
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((i) => i.str.trim())
    .map((i) => {
      let font = i.fontName;
      try { font = page.commonObjs.get(i.fontName)?.name ?? i.fontName; } catch {}
      return {
        str: i.str,
        x: +i.transform[4].toFixed(1),
        y: +i.transform[5].toFixed(1),
        w: +i.width.toFixed(1),
        h: +i.height.toFixed(1),
        font,
      };
    });
  const out = path.join('test/fixtures', `pg${pageNo}.items.json`);
  fs.writeFileSync(out, JSON.stringify(items, null, 0), 'utf8');
  console.log(out, items.length, 'items');
}

// --- Image-region fixture ---------------------------------------------
//
// Mirrors lib/pdf/images.ts#getImageRegions (kept as a plain-JS duplicate
// here, same reason the text-item extraction above duplicates
// lib/pdf/textLayer.ts: this dumper runs under plain Node against the
// legacy pdf.js build, and the pure vitest tests that consume its output
// must never need to import pdf.js themselves).
//
// Walks the operator list, replays the save/restore/transform matrix
// stack, and for each paintImageXObject / paintImageMaskXObject operator
// maps the unit square [0,1]x[0,1] through the active CTM to get that
// image's page-space bounding box (pdf.js always draws an image XObject
// into that unit square under the CTM in effect at the paint operator).
const OPS = pdfjs.OPS;

function multiply(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyPoint(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

async function getImageRegions(pdfDoc, pageIndex) {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const opList = await page.getOperatorList();

  const regions = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, opList.argsArray[i]);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageMaskXObject) {
      const corners = [
        applyPoint(ctm, 0, 0),
        applyPoint(ctm, 1, 0),
        applyPoint(ctm, 1, 1),
        applyPoint(ctm, 0, 1),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      regions.push({
        x: +minX.toFixed(1),
        y: +minY.toFixed(1),
        w: +(maxX - minX).toFixed(1),
        h: +(maxY - minY).toFixed(1),
      });
    }
  }

  return regions;
}

const imageRegionsByPage = {};
for (const pageIndex of [0, 4, 5]) {
  imageRegionsByPage[pageIndex] = await getImageRegions(doc, pageIndex);
}
const imagesOut = path.join('test/fixtures', 'image-regions.json');
fs.writeFileSync(imagesOut, JSON.stringify(imageRegionsByPage, null, 0), 'utf8');
for (const [pageIndex, regions] of Object.entries(imageRegionsByPage)) {
  console.log(imagesOut, `pageIndex ${pageIndex}:`, regions.length, 'images');
}
