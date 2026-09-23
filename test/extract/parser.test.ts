import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { stripWatermark } from '@/lib/extract/watermark';
import { groupIntoLines } from '@/lib/extract/lines';
import { parseQuestions, splitLegacyQuestion } from '@/lib/extract/parser';
import type { Line, PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const parsed = parseQuestions(groupIntoLines(stripWatermark(pg1)), 0);

describe('parseQuestions on page 1', () => {
  it('finds exactly 7 questions', () => {
    expect(parsed).toHaveLength(7);
  });

  it('numbers them 1 through 7', () => {
    expect(parsed.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gives every question exactly 4 options', () => {
    for (const q of parsed) expect(q.options).toHaveLength(4);
  });

  it('produces non-empty Sinhala stems', () => {
    for (const q of parsed) {
      expect(q.stem.length).toBeGreaterThan(5);
      expect(/[඀-෿]/.test(q.stem)).toBe(true);
    }
  });

  it('strips the option marker from the option text', () => {
    for (const q of parsed) {
      for (const o of q.options) expect(o.startsWith('(')).toBe(false);
    }
  });

  it('retains the legacy source for diffing', () => {
    expect(parsed[0].rawLegacy.length).toBeGreaterThan(0);
  });

  it('splits the real question 1 rawLegacy into the exact original legacy stem/options', () => {
    // Ground truth: the real, unconverted pg1 fixture bytes for question 1.
    const { stem, options } = splitLegacyQuestion(parsed[0].rawLegacy);
    expect(stem).toBe('Y%S ,xldj ms<sn| f;dr;=re i|yka jk ol=Kq bkaÈhdfõ § rÑ; .%ka:hla jkafka"');
    expect(options).toEqual([
      'hd,amdk ffjmudff,',
      'fYa.rdifYalrudff,',
      'uKsfïl,hs',
      'ffl,dhudff,',
    ]);
  });

  /**
   * Confirmed firing on the real paper: page 1's footer "1" sits ~60pt
   * below Q7's last option, versus ~15pt for a genuine wrapped
   * continuation line, and was silently appended to the option text.
   */
  it('does not absorb the page-number footer into the last option', () => {
    const q7 = parsed.find((q) => q.number === 7)!;
    expect(q7.options[3]).toBe('අනුරාධපුරයට වඩා පොළොන්නරුව ආරක්ෂිත ස්ථානයක් වීම යි.');
    for (const q of parsed) {
      for (const o of q.options) expect(o).not.toMatch(/\s\d+$/);
    }
  });
});

describe('splitLegacyQuestion', () => {
  it('strips the question-number opener and splits on ^N& markers', () => {
    const raw = "01'wxl^1&fyrd^2&fojk^3&f;dard^4&isjk";
    expect(splitLegacyQuestion(raw)).toEqual({
      stem: 'wxl',
      options: ['fyrd', 'fojk', 'f;dard', 'isjk'],
    });
  });

  it('returns the whole input as stem when there are no option markers', () => {
    expect(splitLegacyQuestion('wxl 01 isg 40')).toEqual({ stem: 'wxl 01 isg 40', options: [] });
  });
});

/**
 * OCR'd pages never go through the legacy transliterator (`mapForFont`
 * returns null for font 'OCR'), so their option markers arrive as genuine
 * Unicode parentheses rather than the FM font's literal `^N&` glyph pair.
 * The parser has to accept both shapes or every OCR'd question is silently
 * dropped.
 */
describe('parseQuestions with real parenthesis option markers (OCR shape)', () => {
  const line = (text: string, y: number): Line => ({
    text,
    items: [{ str: text, x: 10, y, w: 300, h: 12, font: 'OCR' }],
    y,
    bbox: { x: 10, y, w: 300, h: 12 },
    source: 'ocr',
    unmapped: 0,
  });

  it('parses a question whose markers are "(1)".."(4)"', () => {
    const parsedOcr = parseQuestions(
      [line('01. කුමන නමකින් ද?', 700), line('(1) එක (2) දෙක (3) තුන (4) හතර', 684)],
      3,
    );
    expect(parsedOcr).toHaveLength(1);
    expect(parsedOcr[0].number).toBe(1);
    expect(parsedOcr[0].options).toEqual(['එක', 'දෙක', 'තුන', 'හතර']);
  });

  it('totals the unmapped count of every line that built the question', () => {
    const opener = { ...line('01. කුමන ⟨?⟩ ද?', 700), unmapped: 2 };
    const options = { ...line('(1) එක (2) දෙක (3) තුන (4) හතර', 684), unmapped: 3 };
    const [q] = parseQuestions([opener, options], 3);
    expect(q.unmapped).toBe(5);
  });

  it('reports zero unmapped when every line converted cleanly', () => {
    const [q] = parseQuestions(
      [line('01. කුමන නමකින් ද?', 700), line('(1) එක (2) දෙක (3) තුන (4) හතර', 684)],
      3,
    );
    expect(q.unmapped).toBe(0);
  });

  it('stops a question at an anomalous vertical gap', () => {
    const [q] = parseQuestions(
      [
        line('01. පළමු ප්‍රශ්නය', 700),
        line('(1) එක (2) දෙක (3) තුන (4) හතර', 684),
        line('හතරවන විකල්පයේ ඉතිරිය', 668), // normal 16pt gap: a real continuation
        line('99', 560), // 108pt below: a page footer, not continuation text
      ],
      3,
    );
    expect(q.options[3]).toBe('හතර හතරවන විකල්පයේ ඉතිරිය');
  });

  it('never appends a bare-integer line to an option', () => {
    const [q] = parseQuestions(
      [
        line('01. පළමු ප්‍රශ්නය', 700),
        line('(1) එක (2) දෙක (3) තුන (4) හතර', 684),
        line('7', 668), // same spacing as real text, but a bare page number
      ],
      3,
    );
    expect(q.options[3]).toBe('හතර');
  });

  it('still parses the FM literal-glyph marker shape', () => {
    const parsedFm = parseQuestions(
      [line('01. කුමන නමකින් ද?', 700), line('^1&එක^2&දෙක^3&තුන^4&හතර', 684)],
      3,
    );
    expect(parsedFm[0].options).toEqual(['එක', 'දෙක', 'තුන', 'හතර']);
  });

  /**
   * Some source papers glue the question number directly onto the stem with
   * no '.'/''' marker at all — e.g. real extracted text
   * "01ශිෂ්‍ය නායකයින් පවරන..." (no separator character between "01" and
   * "ශිෂ්‍ය"). Every question on the page opens this way, so requiring a
   * literal marker character drops the entire page (0 questions found).
   */
  it('parses an opener with no separator, glued straight onto a Sinhala stem', () => {
    const parsedGlued = parseQuestions(
      [line('01ශිෂ්‍ය නායකයින් පවරන කාරණය', 700), line('(1) එක (2) දෙක (3) තුන (4) හතර', 684)],
      3,
    );
    expect(parsedGlued).toHaveLength(1);
    expect(parsedGlued[0].number).toBe(1);
    expect(parsedGlued[0].stem).toBe('ශිෂ්‍ය නායකයින් පවරන කාරණය');
  });

  /**
   * A number glued to more digits, or followed by a space, must NOT be
   * mistaken for this shape — the existing "bare header number" false
   * positive (e.g. a garbled "11 <text>" duration line) relies on the space
   * to stay excluded, and a 3-digit run must not be truncated to 2.
   */
  it('does not treat a spaced-out number line as a glued opener', () => {
    const parsedSpaced = parseQuestions(
      [line('11 කාලය පැය 01 යි', 700), line('(1) එක (2) දෙක (3) තුන (4) හතර', 684)],
      3,
    );
    expect(parsedSpaced).toHaveLength(0);
  });

  /**
   * Most questions have 4 options, but a 5-option question is not rare
   * enough to truncate: matching only markers 1-4 silently dropped the 5th
   * option's text onto the 4th's, as if it were wrapped continuation text.
   */
  it('parses all 5 options on a 5-option question', () => {
    const parsedFive = parseQuestions(
      [line('01. කුමන නමකින් ද?', 700), line('(1) එක (2) දෙක (3) තුන (4) හතර (5) පහ', 684)],
      3,
    );
    expect(parsedFive).toHaveLength(1);
    expect(parsedFive[0].options).toEqual(['එක', 'දෙක', 'තුන', 'හතර', 'පහ']);
  });

  it('still parses the FM literal-glyph marker shape with 5 options', () => {
    const parsedFive = parseQuestions(
      [line('01. කුමන නමකින් ද?', 700), line('^1&එක^2&දෙක^3&තුන^4&හතර^5&පහ', 684)],
      3,
    );
    expect(parsedFive[0].options).toEqual(['එක', 'දෙක', 'තුන', 'හතර', 'පහ']);
  });
});

/**
 * Real user report: "Legacy font" review mode showed two words run
 * together with no space, e.g. "අනුරාධපුරයුගයේසිට..." — even though Unicode
 * mode already showed the same stem correctly spaced. Traced to
 * `rawLegacy` being built with a bare `line.items.map(i => i.str).join('')`,
 * bypassing the exact space-insertion fix (joinItemTexts, in lines.ts)
 * already applied to `Line.text` for this same "pdf.js splits one line into
 * several items at a font/style change" case.
 */
describe('rawLegacy spacing across items split by a font/style change', () => {
  it('inserts a space in rawLegacy the same way Line.text already does', () => {
    const items: PositionedItem[] = [
      { str: "01'wxl", x: 50, y: 700, w: 40, h: 12, font: 'XSUOWA+FMAbhayax' },
      { str: 'b;sydih', x: 100, y: 700, w: 60, h: 12, font: 'WSZVOB+FMAbabldBold' },
      { str: '^1&l^2&l^3&l^4&l', x: 50, y: 684, w: 100, h: 12, font: 'XSUOWA+FMAbhayax' },
    ];
    const [q] = parseQuestions(groupIntoLines(items), 0);
    const { stem } = splitLegacyQuestion(q.rawLegacy);
    // Without the fix this reads "wxlb;sydih" — fused, no space.
    expect(stem).toBe('wxl b;sydih');
  });
});
