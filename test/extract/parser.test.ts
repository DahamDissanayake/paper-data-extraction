import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { stripWatermark } from '@/lib/extract/watermark';
import { groupIntoLines } from '@/lib/extract/lines';
import { parseQuestions } from '@/lib/extract/parser';
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
});
