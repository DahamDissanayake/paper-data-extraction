import { describe, it, expect } from 'vitest';
import { classify } from '@/lib/extract/classify';
import type { RawQuestion } from '@/lib/extract/parser';

const base: RawQuestion = {
  number: 1, stem: 'ප්‍රශ්නය', options: [], bbox: { x: 0, y: 100, w: 100, h: 20 },
  pageIndex: 0, rawLegacy: '', unmapped: 0,
};

describe('classify', () => {
  it('marks a normal four-option question as straight', () => {
    const q = { ...base, options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය'] };
    expect(classify(q, [])).toBe('straight');
  });

  it('marks a column-match question as special (Q8 shape)', () => {
    const q = { ...base, number: 8, options: ['A C B', 'B A D', 'C A D', 'C B A'] };
    expect(classify(q, [])).toBe('special');
  });

  it('marks a select-two question as special (Q16 shape)', () => {
    const q = { ...base, number: 16, options: ['A යා C', 'B යා C', 'B යා D', 'C යා D'] };
    expect(classify(q, [])).toBe('special');
  });

  it('classifies the real Q16 shape as special (real transliterated conjunction word)', () => {
    const q = { ...base, number: 16, options: ['AහාC', 'BහාC', 'BහාD', 'CහාD 2'] };
    expect(classify(q, [])).toBe('special');
  });

  it('marks a question with the wrong option count as special', () => {
    expect(classify({ ...base, options: ['ක', 'ඛ', 'ග'] }, [])).toBe('special');
  });

  it('marks a 5-option question as straight, not special', () => {
    const q = { ...base, options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය', 'පස්වන'] };
    expect(classify(q, [])).toBe('straight');
  });

  it('marks a question whose stem references a map as figure', () => {
    const q = { ...base, stem: 'පහත සිතියම බලන්න', options: ['අ', 'ආ', 'ඇ', 'ඈ'] };
    expect(classify(q, [])).toBe('figure');
  });

  it('marks a question overlapping an image region as figure', () => {
    const q = { ...base, options: ['අ', 'ආ', 'ඇ', 'ඈ'] };
    const images = [{ pageIndex: 0, bbox: { x: 10, y: 95, w: 50, h: 30 } }];
    expect(classify(q, images)).toBe('figure');
  });

  it('prefers special over figure when both apply', () => {
    const q = { ...base, stem: 'පහත වගුව', options: ['A C B', 'B A D', 'C A D', 'C B A'] };
    expect(classify(q, [])).toBe('special');
  });
});
