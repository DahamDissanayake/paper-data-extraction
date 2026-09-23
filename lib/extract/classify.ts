import type { BBox, QuestionKind } from '@/lib/types';
import type { RawQuestion } from './parser';

export interface ImageRegion { pageIndex: number; bbox: BBox; }

/** An option that is only A–E tokens joined by a conjunction or whitespace. */
const AD_ONLY = /^[A-E](\s*(?:හා|යා|සහ|,|and)?\s*[A-E])*$/i;

/** Stem words that mean the question depends on a picture or table. */
const FIGURE_WORDS = ['රූපය', 'රූපයේ', 'සිතියම', 'සිතියමේ', 'වගුව', 'වගුවේ', 'ප්‍රස්තාරය'];

function overlaps(a: BBox, b: BBox): boolean {
  const aBottom = a.y - a.h, bBottom = b.y - b.h;
  return a.x < b.x + b.w && b.x < a.x + a.w && aBottom < b.y && bBottom < a.y;
}

const STRAIGHT_OPTION_COUNTS = new Set([4, 5]);

export function classify(q: RawQuestion, images: ImageRegion[]): QuestionKind {
  if (!STRAIGHT_OPTION_COUNTS.has(q.options.length)) return 'special';
  if (q.options.some((o) => AD_ONLY.test(o.trim()))) return 'special';
  // An A/B/C/D enumeration block inside the stem is the Q16 shape.
  // ([\s\S] in place of a dotAll '.' — the repo's ES2017 target rejects the 's' flag.)
  if (/(^|\s)A\s+\S+[\s\S]*(^|\s)B\s+\S+/.test(q.stem)) return 'special';

  if (FIGURE_WORDS.some((w) => q.stem.includes(w))) return 'figure';
  if (images.some((im) => im.pageIndex === q.pageIndex && overlaps(q.bbox, im.bbox))) return 'figure';

  return 'straight';
}
