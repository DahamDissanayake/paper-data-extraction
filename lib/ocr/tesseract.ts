import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PositionedItem } from '@/lib/types';

/** Pages 9 and 10 of the reference paper are image-only and land here. */
const MIN_ITEMS_FOR_TEXT_LAYER = 10;

/**
 * Render scale used for OCR. Higher than PagePane's on-screen SCALE (1.4,
 * see components/review/PagePane.tsx) because OCR accuracy benefits from
 * extra resolution and this render is never shown to the user, only fed to
 * Tesseract.
 */
const OCR_RENDER_SCALE = 2;

export function needsOcr(items: PositionedItem[]): boolean {
  return items.length < MIN_ITEMS_FOR_TEXT_LAYER;
}

/**
 * Every asset Tesseract pulls in at runtime, all served from this app's own
 * origin out of `public/tesseract/` (populated by
 * `scripts/vendor-tesseract.mjs`, which `prebuild`/`predev` run).
 *
 * `createWorker('sin')` with no options defaults to fetching all three of
 * these from cdn.jsdelivr.net. Those defaults live in a dependency's
 * compiled output rather than in this project's source, so they survived a
 * source-only grep and shipped in a real `out/` build — a direct breach of
 * the "no fetch to any external host at runtime" constraint and of
 * UploadStep's own promise that nothing leaves the browser.
 */
export const TESSERACT_ASSETS = {
  /** The tesseract.js ESM bundle itself. */
  module: '/tesseract/tesseract.esm.min.js',
  /** Passed to createWorker as `workerPath`. */
  workerPath: '/tesseract/worker.min.js',
  /** Passed as `corePath`; a directory — the worker picks the SIMD variant. */
  corePath: '/tesseract/core',
  /** Passed as `langPath`; holds sin.traineddata.gz. */
  langPath: '/tesseract/lang',
} as const;

interface TesseractWorker {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: unknown }>;
  terminate: () => Promise<unknown>;
}

/**
 * Loads the VENDORED tesseract.js bundle by URL rather than importing the
 * npm package. `webpackIgnore` leaves the import for the browser to resolve
 * against this origin; bundling `tesseract.js` instead would pull its
 * jsdelivr `workerPath` default straight into the app chunk, where
 * scripts/check-no-network.mjs would (rightly) fail the build.
 */
async function loadTesseract(): Promise<{
  createWorker: (
    langs: string,
    oem?: number,
    options?: Record<string, unknown>,
  ) => Promise<TesseractWorker>;
}> {
  return import(/* webpackIgnore: true */ TESSERACT_ASSETS.module);
}

export interface OcrWord {
  text: string;
  /** Canvas-pixel box at the render scale, origin TOP-left (Tesseract's space). */
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Converts one Tesseract word into a `PositionedItem` in the contract every
 * other producer uses: **PDF user-space points at scale 1, origin
 * bottom-left** (see the note on `BBox` in lib/types.ts).
 *
 * Two conversions are needed and only one used to happen. Tesseract reports
 * boxes in canvas pixels at whatever scale the page was rendered at, with a
 * top-left origin; `recogniseDocPage` renders at scale 2. Returning those
 * numbers unchanged silently doubled every coordinate on an OCR'd page,
 * which throws off line-grouping tolerance, figure-overlap classification
 * and the review pane's highlight overlay.
 */
export function ocrWordToItem(
  word: OcrWord,
  canvasHeight: number,
  scale: number,
): PositionedItem {
  const { x0, y0, x1, y1 } = word.bbox;
  return {
    str: word.text,
    x: x0 / scale,
    // Flip Tesseract's top-left origin to the PDF's bottom-left one, in points.
    y: (canvasHeight - y1) / scale,
    w: (x1 - x0) / scale,
    h: (y1 - y0) / scale,
    font: 'OCR', // mapForFont returns null, so text passes through
  };
}

/**
 * Tesseract and its ~1MB Sinhala traineddata load only when this is called,
 * which keeps them out of the initial bundle.
 *
 * `scale` must be the scale the canvas was rendered at, because the returned
 * items are in PDF points at scale 1 regardless.
 */
export async function recognisePage(
  canvas: HTMLCanvasElement,
  scale: number = OCR_RENDER_SCALE,
): Promise<PositionedItem[]> {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker('sin', undefined, {
    workerPath: TESSERACT_ASSETS.workerPath,
    corePath: TESSERACT_ASSETS.corePath,
    langPath: TESSERACT_ASSETS.langPath,
  });
  try {
    const { data } = await worker.recognize(canvas);
    const words = (data as { words?: OcrWord[] }).words ?? [];
    return words
      .filter((w) => w.text.trim())
      .map((w) => ocrWordToItem(w, canvas.height, scale));
  } finally {
    // Never let a teardown failure mask the real error — runPipeline needs
    // to see why recognition failed so it can isolate the page.
    try {
      await worker.terminate();
    } catch {
      /* the worker is going away regardless */
    }
  }
}

/**
 * Single mockable boundary for the "render a doc page to a canvas, then OCR
 * it" sequence. Kept here (rather than inline in runPipeline.ts) so that
 * `document.createElement('canvas')` never executes inside a Vitest run:
 * the vitest config's `environment: 'node'` has no DOM, and
 * test/extract/runPipeline.test.ts mocks this whole module the same way it
 * already mocks the pdf.js-boundary modules.
 *
 * `renderPageToCanvas` is imported dynamically (not at module top level) so
 * that merely importing this file — as test/ocr/needsOcr.test.ts does, to
 * reach `needsOcr` — never pulls in pdfjs-dist under vitest's plain `node`
 * environment.
 */
export async function recogniseDocPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
  scale: number = OCR_RENDER_SCALE,
): Promise<PositionedItem[]> {
  const { renderPageToCanvas } = await import('@/lib/pdf/loader');
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(doc, pageIndex, scale, canvas);
  // The same `scale` goes through so the items come back in PDF points,
  // matching getPositionedItems' and getImageRegions' contract.
  return recognisePage(canvas, scale);
}
