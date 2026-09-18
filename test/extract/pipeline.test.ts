import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { assemble } from '@/lib/extract/pipeline';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

describe('assemble', () => {
  const r = assemble([{ index: 0, items: pg1, images: [] }], pg11, false);

  it('produces 7 questions from page 1', () => {
    expect(r.questions).toHaveLength(7);
  });

  it('attaches the correct answer to each question', () => {
    // Verified key: q1=3, q2=2, q3=1, q4=3, q5=2, q6=4, q7=3
    expect(r.questions.map((q) => q.correctAnswer)).toEqual([3, 2, 1, 3, 2, 4, 3]);
  });

  it('classifies all seven as straight', () => {
    expect(r.questions.every((q) => q.kind === 'straight')).toBe(true);
  });

  it('leaves answers null when there is no answer sheet', () => {
    const none = assemble([{ index: 0, items: pg1, images: [] }], null, true);
    expect(none.questions.every((q) => q.correctAnswer === null)).toBe(true);
  });

  it('tags every question from a page marked ocr: true with the "ocr" flag', () => {
    const ocred = assemble([{ index: 0, items: pg1, images: [], ocr: true }], null, true);
    expect(ocred.questions).toHaveLength(7);
    expect(ocred.questions.every((q) => q.flags.includes('ocr'))).toBe(true);
  });

  it('does not tag questions from a page without ocr set', () => {
    expect(r.questions.every((q) => !q.flags.includes('ocr'))).toBe(true);
  });
});

/**
 * The spec's safety net: "Unmapped codes emit ⟨?⟩ and set an
 * unmapped-glyph flag on the question, so an incorrect or missing font
 * table is visible rather than silent." RawQuestion.unmapped used to be
 * hardcoded to 0, so this flag could never fire.
 */
describe('assemble surfaces unmapped glyphs', () => {
  const fm = (str: string, y: number): PositionedItem =>
    ({ str, x: 40, y, w: 300, h: 12, font: 'XSUOWA+FMAbhayax' });

  const options = '^1&l^2&l^3&l^4&l';

  it("flags a question built from text the font table cannot convert", () => {
    const r2 = assemble(
      [{ index: 0, items: [fm("01'wxlZZ", 700), fm(options, 684)], images: [] }],
      null,
      true,
    );
    expect(r2.questions).toHaveLength(1);
    expect(r2.questions[0].flags).toContain('unmapped-glyph');
  });

  it('does not flag a question whose text converts cleanly', () => {
    const r2 = assemble(
      [{ index: 0, items: [fm("01'wxl", 700), fm(options, 684)], images: [] }],
      null,
      true,
    );
    expect(r2.questions).toHaveLength(1);
    expect(r2.questions[0].flags).not.toContain('unmapped-glyph');
  });
});
