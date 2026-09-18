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
