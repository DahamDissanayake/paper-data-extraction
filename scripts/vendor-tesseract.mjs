#!/usr/bin/env node
/**
 * Copies Tesseract's runtime assets out of node_modules into public/tesseract/
 * so the shipped app never fetches them from a CDN.
 *
 * Why this exists
 * ---------------
 * `createWorker('sin')` with no options defaults to jsdelivr for THREE
 * separate things — the worker script, the wasm core, and the ~1MB Sinhala
 * traineddata. Those defaults live in a dependency's compiled output, not in
 * this project's source, so a source-only grep can never catch them; they
 * were confirmed present in a real `out/` build. That violates the project's
 * binding "no server, ever / no fetch to any external host at runtime"
 * constraint and contradicts UploadStep's own on-screen promise.
 *
 * What it does
 * ------------
 * 1. Copies the tesseract.js ESM bundle, its worker script, and the two
 *    LSTM wasm cores from node_modules. No network: they are already
 *    dependencies. (The `.wasm.js` cores embed their wasm as a base64 data
 *    URI, so the sibling `.wasm` files are not needed.)
 * 2. Rewrites every `https://cdn.jsdelivr.net/npm/` literal inside the two
 *    copied JS files to a local, deliberately-dead path. Those literals are
 *    only the FALLBACK defaults — lib/ocr/tesseract.ts passes workerPath,
 *    corePath and langPath explicitly — but rewriting them means a built
 *    `out/` contains no external host at all, which is what lets
 *    scripts/check-no-network.mjs be a zero-tolerance check instead of an
 *    allowlist that would have let this very bug through.
 * 3. Leaves public/tesseract/lang/{sin,eng}.traineddata.gz alone. Neither
 *    asset can be obtained from node_modules, so both are committed to the
 *    repo (1.1MB, 2.8MB) — sourced once, exactly like the self-hosted Noto
 *    Sans Sinhala woff2 files. Sourcing is not runtime loading. OCR recognizes
 *    'sin+eng' together (see lib/ocr/tesseract.ts) since this paper's own
 *    pages mix scripts in ordinary running text; Sinhala-only recognition
 *    forced its best (wrong) Sinhala-glyph guess onto every English
 *    character instead of leaving it as English.
 *
 * Runs automatically from `prebuild` and `predev`. Copied files are
 * gitignored; only the traineddata is committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'tesseract');
const CDN = 'https://cdn.jsdelivr.net/npm/';
const DEAD = '/tesseract/vendored-no-cdn/';

/** [source, destination, rewriteCdnLiterals] */
const ASSETS = [
  ['node_modules/tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js', true],
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js', true],
  // getCore picks the -simd- variant when the browser supports wasm SIMD and
  // falls back to the plain one otherwise. Both are LSTM-only because
  // createWorker uses the default OEM (LSTM_ONLY); the legacy-model cores
  // would add ~8MB for a code path this app never takes.
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js', false],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js', false],
];

const TRAINEDDATA = [
  path.join(OUT, 'lang', 'sin.traineddata.gz'),
  path.join(OUT, 'lang', 'eng.traineddata.gz'),
];

let failed = false;

for (const [from, to, rewrite] of ASSETS) {
  const src = path.join(ROOT, from);
  if (!fs.existsSync(src)) {
    console.error(`vendor-tesseract: MISSING ${from} — run npm install`);
    failed = true;
    continue;
  }
  const dest = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (!rewrite) {
    fs.copyFileSync(src, dest);
    console.log(`vendor-tesseract: copied ${to}`);
    continue;
  }

  const source = fs.readFileSync(src, 'utf8');
  const occurrences = source.split(CDN).length - 1;
  if (occurrences === 0) {
    // The upstream bundle changed shape. Fail loudly rather than silently
    // shipping whatever new external host replaced it.
    console.error(
      `vendor-tesseract: expected at least one "${CDN}" literal in ${from} but found none. ` +
      'tesseract.js probably changed its default paths — re-check them before trusting this build.',
    );
    failed = true;
  }
  fs.writeFileSync(dest, source.split(CDN).join(DEAD), 'utf8');
  console.log(`vendor-tesseract: copied ${to} (${occurrences} CDN default(s) rewritten)`);
}

const TRAINEDDATA_SOURCE_URL = {
  'sin.traineddata.gz': 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/sin/4.0.0_best_int/sin.traineddata.gz',
  'eng.traineddata.gz': 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};

for (const file of TRAINEDDATA) {
  if (fs.existsSync(file)) continue;
  const name = path.basename(file);
  console.error(
    `vendor-tesseract: public/tesseract/lang/${name} is missing.\n` +
    '  It is a committed repo asset. If it really has to be re-sourced, fetch it ONCE\n' +
    `  from ${TRAINEDDATA_SOURCE_URL[name]}\n` +
    '  (the exact file tesseract.js would otherwise fetch at runtime) and commit it.',
  );
  failed = true;
}

if (failed) process.exit(1);
console.log('vendor-tesseract: public/tesseract is up to date');
