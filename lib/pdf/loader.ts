import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function loadDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

/**
 * Renders a page and returns its size in PDF user-space points (its
 * viewport at scale 1) — which callers need anyway to map PDF coordinates
 * onto the canvas, and which saves them a second `doc.getPage()` for the
 * page this call already has in hand.
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy, pageIndex: number, scale: number, canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const unscaled = page.getViewport({ scale: 1 });
  return { width: unscaled.width, height: unscaled.height };
}
