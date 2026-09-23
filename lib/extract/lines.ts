import type { Line, PositionedItem } from '@/lib/types';
import { transliterateItem } from '@/lib/sinhala/legacy/detectFont';

/** A bare 1- or 2-digit question-number item, e.g. the "01" opener item. */
const BARE_QUESTION_NUMBER = /^\d{1,2}$/;

/**
 * pdf.js splits one visual line into several text items wherever the PDF's
 * content stream restarts a text-showing operator — a font/style change
 * (a bold word mid-sentence), a re-positioning command, or just how the
 * authoring tool happened to chunk it. Any real space between two such
 * items lives only in the PAGE LAYOUT (the x-gap), never as a character in
 * either item's string, so joining items with nothing in between silently
 * fuses the last word of one item onto the first word of the next (e.g.
 * "...ඇරීම" + "දිනිඳුගේ..." -> "...ඇරීමදිනිඳුගේ...").
 *
 * The one place this fusion is INTENTIONAL is the question-number opener:
 * "01" and the stem's first word are separate items with no space between
 * them in the source PDF (only visual padding), and parser.ts's
 * QUESTION_START relies on them staying glued to tell a real opener apart
 * from a bare header number that starts a line with a genuine space (e.g.
 * "11 ශ්‍රේණිය" — a single item, embedded space, never split like this).
 */
function joinItemTexts(texts: string[]): string {
  let out = '';
  for (let i = 0; i < texts.length; i++) {
    const glueToOpener = i === 1 && BARE_QUESTION_NUMBER.test(texts[0]);
    if (i > 0 && !glueToOpener && !/\s$/.test(out) && !/^\s/.test(texts[i])) out += ' ';
    out += texts[i];
  }
  return out;
}

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
    const converted = sorted.map((i) => transliterateItem(i.str, i.font));
    const text = joinItemTexts(converted.map((c) => c.text));
    // Carried forward, not discarded: the parser totals it per question and
    // the pipeline turns a non-zero total into the 'unmapped-glyph' flag.
    const unmapped = converted.reduce((n, c) => n + c.unmapped, 0);
    const x = Math.min(...sorted.map((i) => i.x));
    const right = Math.max(...sorted.map((i) => i.x + i.w));
    const y = Math.max(...sorted.map((i) => i.y));
    const h = Math.max(...sorted.map((i) => i.h));
    return {
      text,
      items: sorted,
      y,
      bbox: { x, y, w: right - x, h },
      source: 'text' as const,
      unmapped,
    };
  });
}
