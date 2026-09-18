import type { OptionIndex, PositionedItem, Question } from '@/lib/types';
import { stripWatermark } from './watermark';
import { groupIntoLines } from './lines';
import { parseQuestions } from './parser';
import { classify, type ImageRegion } from './classify';
import { extractAnswerKey } from './answerKey';

interface PageInput { index: number; items: PositionedItem[]; images: ImageRegion[]; ocr?: boolean; }

export function assemble(
  pages: PageInput[],
  answerItems: PositionedItem[] | null,
  hasNoAnswerSheet: boolean,
): { questions: Question[]; answerKey: Record<number, OptionIndex>; unresolved: number[] } {
  const keyResult = !hasNoAnswerSheet && answerItems
    ? extractAnswerKey(answerItems)
    : { key: {}, unresolved: [], labelColumns: [] };

  const questions: Question[] = [];
  for (const page of pages) {
    const lines = groupIntoLines(stripWatermark(page.items));
    for (const raw of parseQuestions(lines, page.index)) {
      const flags: Question['flags'] = [];
      if (raw.unmapped > 0) flags.push('unmapped-glyph');
      if (page.ocr) flags.push('ocr');
      questions.push({
        id: `p${page.index}-q${raw.number}`,
        number: raw.number,
        pageIndex: page.index,
        bbox: raw.bbox,
        stem: raw.stem,
        options: raw.options,
        kind: classify(raw, page.images),
        flags,
        correctAnswer: keyResult.key[raw.number] ?? null,
        rawLegacy: raw.rawLegacy,
        edited: false,
      });
    }
  }

  questions.sort((a, b) => a.number - b.number);
  return { questions, answerKey: keyResult.key, unresolved: keyResult.unresolved };
}
