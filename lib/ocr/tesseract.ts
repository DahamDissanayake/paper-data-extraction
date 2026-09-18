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
 * Tesseract and its ~10MB Sinhala traineddata load only when this is called,
 * which keeps them out of the initial bundle.
 */
export async function recognisePage(canvas: HTMLCanvasElement): Promise<PositionedItem[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('sin');
  try {
    const { data } = await worker.recognize(canvas);
    const words = (data as unknown as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }).words ?? [];
    return words.filter((w) => w.text.trim()).map((w) => ({
      str: w.text,
      x: w.bbox.x0,
      // Convert Tesseract's top-left origin to the PDF's bottom-left origin.
      y: canvas.height - w.bbox.y1,
      w: w.bbox.x1 - w.bbox.x0,
      h: w.bbox.y1 - w.bbox.y0,
      font: 'OCR',       // mapForFont returns null, so text passes through
    }));
  } finally {
    await worker.terminate();
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
  return recognisePage(canvas);
}
