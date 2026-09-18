import type { OptionIndex, Question, Session } from '@/lib/types';
import { loadDocument } from '@/lib/pdf/loader';
import { getPositionedItems } from '@/lib/pdf/textLayer';
import { getImageRegions } from '@/lib/pdf/images';
import { needsOcr, recogniseDocPage } from '@/lib/ocr/tesseract';
import { assemble } from './pipeline';
import type { ImageRegion } from './classify';

/**
 * Orchestrates the full client-side extraction pipeline for a session: loads
 * the source PDF, pulls positioned text + image regions for every selected
 * question page (and the answer page, when there is one), and hands them to
 * `assemble()`.
 *
 * No task file assigned this wiring — Tasks 4-8 only produced the individual
 * building blocks (`loadDocument`/`getPositionedItems`/`getImageRegions`/
 * `assemble`). This is the "who actually runs the pipeline" glue, called
 * once by `ReviewWorkspace` on mount.
 */
export interface ExtractionResult {
  questions: Question[];
  answerKey: Record<number, OptionIndex>;
  unresolved: number[];
  /**
   * Pages where OCR was needed but threw. The rest of the document still
   * extracts; these page numbers are surfaced in the review workspace so
   * the gap is visible rather than a silently short question list.
   */
  ocrFailedPages: number[];
}

export async function runExtraction(
  session: Session,
  sourceBlob: Blob,
): Promise<ExtractionResult> {
  const buf = await sourceBlob.arrayBuffer();
  const doc = await loadDocument(buf);

  const pages = await Promise.all(
    session.questionPages.map(async (index) => {
      const [textItems, imageBBoxes] = await Promise.all([
        getPositionedItems(doc, index),
        getImageRegions(doc, index),
      ]);
      const images: ImageRegion[] = imageBBoxes.map((bbox) => ({ pageIndex: index, bbox }));
      // Image-only pages (e.g. pages 9-10 of the reference paper) have no
      // usable text layer; fall back to OCR so they still yield questions.
      if (!needsOcr(textItems)) {
        return { index, items: textItems, images, ocr: false, ocrFailed: false };
      }

      // Isolated on purpose. The OCR worker and its wasm core can fail to
      // load for reasons that have nothing to do with the other pages, and
      // this Promise.all would otherwise reject the whole extraction —
      // losing pages that never needed OCR at all.
      try {
        return { index, items: await recogniseDocPage(doc, index), images, ocr: true, ocrFailed: false };
      } catch (err) {
        console.error(`OCR failed for page ${index}; continuing without it`, err);
        // No items rather than the near-empty text layer that triggered OCR
        // in the first place: a handful of stray runs off an image-only page
        // would only manufacture garbage half-questions.
        return { index, items: [], images, ocr: false, ocrFailed: true };
      }
    }),
  );

  const answerItems = !session.hasNoAnswerSheet && session.answerPage != null
    ? await getPositionedItems(doc, session.answerPage)
    : null;

  return {
    ...assemble(pages, answerItems, session.hasNoAnswerSheet),
    ocrFailedPages: pages.filter((p) => p.ocrFailed).map((p) => p.index),
  };
}
