import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { stripWatermark } from '@/lib/extract/watermark';
import { groupIntoLines } from '@/lib/extract/lines';
import { parseQuestions, splitLegacyQuestion } from '@/lib/extract/parser';
import type { PositionedItem } from '@/lib/types';

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
