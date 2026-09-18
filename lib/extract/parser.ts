import type { BBox, Line } from '@/lib/types';

export interface RawQuestion {
  number: number;
  stem: string;
  options: string[];
  bbox: BBox;
  pageIndex: number;
  rawLegacy: string;
  unmapped: number;
}

/**
 * A question opens with a 1- or 2-digit number followed by a '.' or '''
 * marker. The marker is required (not optional): the source page also
 * contains bare header numbers (e.g. a garbled "duration" line reading
 * "11 <text>") that are NOT question openers, and only the punctuation
 * distinguishes a real numbered question from one of those. In the actual
 * fixture the marker is glued directly to the stem with no space
 * (e.g. "01'ශ්‍රී..."), so trailing whitespace after it is optional, not
 * required.
 */
const QUESTION_START = /^\s*(\d{1,2})\s*['.’]\s*(?=\S)/;
/**
 * An option marker reaches the parser in one of two shapes and both must be
 * accepted:
 *
 *  - `(1)`..`(4)` — real Unicode parentheses. This is what the FM Abhaya
 *    transliterator emits (that font remaps the '^' and '&' glyph slots to
 *    an open/close parenthesis, so the map converts them), and it is also
 *    what OCR produces: `recognisePage` tags its items `font: 'OCR'`, for
 *    which `mapForFont` returns null, so OCR text is never transliterated
 *    and arrives with genuine parentheses already.
 *  - `^1&`..`^4&` — the raw FM byte pair, still seen whenever text reaches
 *    the parser without going through a legacy map (an untransliterated
 *    fixture, or a future FM font whose table lacks the '^'/'&' entries).
 *
 * Matching only the `^N&` form silently dropped every OCR'd question.
 */
const OPTION_MARKER = /(?:\^\s*[1-4]\s*&|\(\s*[1-4]\s*\))/g;

function mergeBBox(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y - a.h, b.y - b.h);
  return { x, y, w: right - x, h: y - bottom };
}

function splitOptions(text: string): { before: string; options: string[] } {
  const markers = [...text.matchAll(OPTION_MARKER)];
  if (markers.length === 0) return { before: text, options: [] };
  const before = text.slice(0, markers[0].index);
  const options: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : text.length;
    options.push(text.slice(start, end).trim());
  }
  return { before, options };
}

export function parseQuestions(lines: Line[], pageIndex: number): RawQuestion[] {
  const questions: RawQuestion[] = [];
  let current: RawQuestion | null = null;
  let stemParts: string[] = [];

  const flush = () => {
    if (!current) return;
    current.stem = stemParts.join(' ').replace(/\s+/g, ' ').trim();
    if (current.options.length > 0) questions.push(current);
    current = null;
    stemParts = [];
  };

  for (const line of lines) {
    const opener = QUESTION_START.exec(line.text);
    const legacy = line.items.map((i) => i.str).join('');

    if (opener) {
      flush();
      const rest = line.text.slice(opener[0].length);
      const { before, options } = splitOptions(rest);
      current = {
        number: parseInt(opener[1], 10),
        stem: '',
        options,
        bbox: line.bbox,
        pageIndex,
        rawLegacy: legacy,
        unmapped: 0,
      };
      stemParts = before.trim() ? [before.trim()] : [];
      continue;
    }

    if (!current) continue;

    const { before, options } = splitOptions(line.text);
    // A continuation line either extends the stem or adds more options.
    if (options.length > 0) {
      if (before.trim() && current.options.length === 0) stemParts.push(before.trim());
      else if (before.trim()) current.options[current.options.length - 1] += ' ' + before.trim();
      current.options.push(...options);
    } else if (current.options.length === 0) {
      stemParts.push(line.text.trim());
    } else {
      // Wrapped text belonging to the last option.
      current.options[current.options.length - 1] += ' ' + line.text.trim();
    }
    current.bbox = mergeBBox(current.bbox, line.bbox);
    current.rawLegacy += legacy;
  }

  flush();
  return questions.sort((a, b) => a.number - b.number);
}
