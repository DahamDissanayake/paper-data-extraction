import type { OptionIndex, Question, Session } from '@/lib/types';
import { loadDocument } from '@/lib/pdf/loader';
import { getPositionedItems } from '@/lib/pdf/textLayer';
import { getImageRegions } from '@/lib/pdf/images';
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
export async function runExtraction(
  session: Session,
  sourceBlob: Blob,
): Promise<{ questions: Question[]; answerKey: Record<number, OptionIndex>; unresolved: number[] }> {
  const buf = await sourceBlob.arrayBuffer();
  const doc = await loadDocument(buf);

  const pages = await Promise.all(
    session.questionPages.map(async (index) => {
      const [items, imageBBoxes] = await Promise.all([
        getPositionedItems(doc, index),
        getImageRegions(doc, index),
      ]);
      const images: ImageRegion[] = imageBBoxes.map((bbox) => ({ pageIndex: index, bbox }));
      return { index, items, images };
    }),
  );

  const answerItems = !session.hasNoAnswerSheet && session.answerPage != null
    ? await getPositionedItems(doc, session.answerPage)
    : null;

  return assemble(pages, answerItems, session.hasNoAnswerSheet);
}
