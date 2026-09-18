import type { PositionedItem } from '@/lib/types';

interface Page { index: number; items: PositionedItem[]; }

const MARKERS = ['^1&', '^2&', '^3&', '^4&'];

function markerCount(items: PositionedItem[]): number {
  return items.filter((i) => MARKERS.includes(i.str.trim())).length;
}

function bareIntRatio(items: PositionedItem[]): number {
  if (items.length === 0) return 0;
  return items.filter((i) => /^\d+$/.test(i.str.trim())).length / items.length;
}

/** A question page carries at least one full set of four option markers. */
export function suggestQuestionPages(pages: Page[]): number[] {
  return pages.filter((p) => markerCount(p.items) >= 4 && bareIntRatio(p.items) < 0.2)
              .map((p) => p.index);
}

/** An answer sheet is mostly bare digits and carries at least 40 of them. */
export function suggestAnswerPage(pages: Page[]): number | null {
  const scored = pages
    .map((p) => ({
      index: p.index,
      ints: p.items.filter((i) => /^\d+$/.test(i.str.trim())).length,
      ratio: bareIntRatio(p.items),
    }))
    .filter((p) => p.ints >= 40 && p.ratio >= 0.15)
    .sort((a, b) => b.ratio - a.ratio);
  return scored[0]?.index ?? null;
}
