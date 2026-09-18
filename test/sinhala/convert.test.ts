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
    expect(convertLegacy('01', FM_ABHAYA).unmapped).toBe(0);
  });

  /**
   * The real-world bug: FM fonts encode Sinhala onto ASCII bytes, so an
   * unmapped ASCII byte is the COMMON failure mode, not an edge case. It
   * used to pass through verbatim with unmapped=0, which made a missing
   * font table silently produce Sinhala-Latin gibberish instead of raising
   * the 'unmapped-glyph' flag the spec designed for exactly this.
   */
  describe('unmapped ASCII in the legacy range', () => {
    it('counts an ASCII byte that has no token instead of passing it through', () => {
      const r = convertLegacy('Z', FM_ABHAYA);
      expect(r.unmapped).toBe(1);
      expect(r.text).toBe('⟨?⟩');
    });

    it('counts unmapped bytes mixed into otherwise-convertible text', () => {
      const r = convertLegacy('b;sZydih', FM_ABHAYA);
      expect(r.unmapped).toBe(1);
      expect(r.text).toContain('⟨?⟩');
    });

    it('keeps digits, spaces and the dash silent — they are real passthrough', () => {
      const r = convertLegacy('01 - 2025', FM_ABHAYA);
      expect(r.unmapped).toBe(0);
      expect(r.text).toBe('01 - 2025');
    });
  });
});
