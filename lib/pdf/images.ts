import { OPS } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BBox } from '@/lib/types';

/** [a, b, c, d, e, f] affine matrix, PDF/canvas convention. */
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Composes m1 then m2-local-space, matching canvas `ctx.transform` semantics
 * (i.e. the same composition pdf.js's `Util.transform(m1, m2)` performs). */
function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Extracts the page-space bounding box of every embedded image drawn on a
 * page (one entry per paint operation, not per distinct image resource).
 *
 * pdf.js always draws an image XObject (or image mask) into the unit square
 * [0,1]x[0,1] of whatever CTM is active at the moment of the paint operator
 * (see pdf.js's CanvasGraphics#paintInlineImageXObject, which does
 * `ctx.scale(1/width, -1/height)` then draws the bitmap at its pixel size —
 * net effect: the image always fills the local unit square). So this walks
 * the operator list, replays the save/restore/transform matrix stack that
 * precedes each paint op, and maps the unit square through the resulting
 * CTM to get that image's bounding box in page space.
 *
 * Only `paintImageXObject` and `paintImageMaskXObject` are handled (per the
 * task-4 ruling). Repeated/grouped/inline image variants
 * (`paintImageXObjectRepeat`, `paintImageMaskXObjectRepeat`,
 * `paintInlineImageXObject(Group)`) are not covered — the reference fixture
 * doesn't exercise them, and a future caller that hits one should extend
 * this function rather than assume silent coverage.
 *
 * Note: this returns one region per *draw operation*, not per declared
 * `/XObject` image resource. An image's `/SMask` (soft mask) is a separate
 * XObject in the page's resource dictionary, but pdf.js resolves it while
 * decoding the base image and never issues its own paint operator for it —
 * it has no visible footprint distinct from the image it belongs to. So a
 * page with a masked image will report one region for that image, not two.
 * See test/pdf/images.test.ts for the reference-PDF counts this produces.
 */
export async function getImageRegions(
  doc: PDFDocumentProxy, pageIndex: number,
): Promise<BBox[]> {
  const page = await doc.getPage(pageIndex + 1);
  const opList = await page.getOperatorList();

  const regions: BBox[] = [];
  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? IDENTITY;
    } else if (fn === OPS.transform) {
      const args = opList.argsArray[i] as Matrix;
      ctm = multiply(ctm, args);
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
      regions.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
    }
  }

  return regions;
}
