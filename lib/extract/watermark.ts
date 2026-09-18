import type { PositionedItem } from '@/lib/types';

/**
 * A watermark is a long string repeated many times across a page. Short
 * strings are excluded because legitimate content repeats too — option
 * markers like "^1&" appear once per question.
 */
const MIN_WATERMARK_LENGTH = 12;

export function stripWatermark(items: PositionedItem[], minRepeats = 4): PositionedItem[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const key = i.str.trim();
    if (key.length < MIN_WATERMARK_LENGTH) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const watermarks = new Set(
    [...counts.entries()].filter(([, c]) => c >= minRepeats).map(([s]) => s),
  );
  return items.filter((i) => !watermarks.has(i.str.trim()));
}
