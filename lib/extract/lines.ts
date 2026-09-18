import type { Line, PositionedItem } from '@/lib/types';
import { transliterateItem } from '@/lib/sinhala/legacy/detectFont';

export function groupIntoLines(items: PositionedItem[], yTolerance = 3): Line[] {
  const buckets: PositionedItem[][] = [];
  // Descending y: PDF origin is bottom-left, so larger y is higher on the page.
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const bucket = buckets.find((b) => Math.abs(b[0].y - item.y) <= yTolerance);
    if (bucket) bucket.push(item);
    else buckets.push([item]);
  }

  return buckets.map((bucket) => {
    const sorted = bucket.sort((a, b) => a.x - b.x);
    const text = sorted.map((i) => transliterateItem(i.str, i.font).text).join('');
    const x = Math.min(...sorted.map((i) => i.x));
    const right = Math.max(...sorted.map((i) => i.x + i.w));
    const y = Math.max(...sorted.map((i) => i.y));
    const h = Math.max(...sorted.map((i) => i.h));
    return { text, items: sorted, y, bbox: { x, y, w: right - x, h }, source: 'text' as const };
  });
}
