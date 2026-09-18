import { describe, it, expect } from 'vitest';
import { convertLegacy } from '@/lib/sinhala/legacy/convert';
import { FM_ABHAYA } from '@/lib/sinhala/legacy/maps/fmAbhaya';

const golden: [string, string][] = [
  ['b;sydih', 'ඉතිහාසය'],
  ['Y%S ,xldj', 'ශ්‍රී ලංකාව'],
  ['wxl', 'අංක'],
  ['m%Yak', 'ප්‍රශ්න'],
  ['ms<s;=re', 'පිළිතුරු'],
  ['f;darkak', 'තෝරන්න'],
  ['f;dr;=re', 'තොරතුරු'],
];

describe('convertLegacy / FM Abhaya', () => {
  for (const [legacy, unicode] of golden) {
    it(`converts ${legacy}`, () => {
      expect(convertLegacy(legacy, FM_ABHAYA).text).toBe(unicode);
    });
  }

  it('moves the prefix vowel after its consonant', () => {
    // `f` is ෙ, stored BEFORE its consonant in legacy order
    expect(convertLegacy('f;dr;=re', FM_ABHAYA).text.startsWith('තො')).toBe(true);
  });

  it('prefers the longer token when two tokens share a prefix', () => {
    // `da` must beat `d`: f;da => තෝ, not තො + ්
    expect(convertLegacy('f;da', FM_ABHAYA).text).toBe('තෝ');
  });

  it('counts unmapped codes instead of dropping them', () => {
    const r = convertLegacy('', FM_ABHAYA);
    expect(r.unmapped).toBe(2);
    expect(r.text).toBe('⟨?⟩⟨?⟩');
  });

  it('passes ASCII digits through unchanged', () => {
    expect(convertLegacy('01', FM_ABHAYA).text).toBe('01');
  });
});
