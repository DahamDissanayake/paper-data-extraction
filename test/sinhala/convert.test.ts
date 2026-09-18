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

  // Added while investigating a real user report of garbled output on page
  // 1's header line ("Y%S ,xldj ms<sn| f;dr;=re i|yka jk ol=Kq bkaÈhdfõ §
  // rÑ; .%ka:hla jkafka" — real raw text from test/fixtures/pg1.items.json).
  // The original FM_ABHAYA map only had 24 tokens, all derived from the
  // handful of words above; real running prose (headers/instructions, as
  // opposed to the cherry-picked option/stem words the golden set happened
  // to cover) hits many more legacy byte codes. Each pair below was derived
  // the same way as the existing ones — NOT from memory of the FM Abhaya
  // keyboard layout, but by aligning an unmapped legacy word against
  // already-mapped tokens plus the real Sinhala word the result must be
  // (verified independently across 3-6 separate, unrelated occurrences of
  // each new token in the real page-1 fixture before trusting it; see
  // lib/sinhala/legacy/maps/fmAbhaya.ts's comments for the full trace).
  ['ms<sn|', 'පිළිබඳ'],   // "regarding" — introduces n, |
  ['i|yka', 'සඳහන්'],     // "mentioned" — confirms |
  ['ol=Kq', 'දකුණු'],     // "south" — introduces o, K, q
  ['ia:dkh', 'ස්ථානය'],   // "location" — introduces :
  ['.%ka:hla', 'ග්‍රන්ථයක්'], // "a treatise" — introduces ., confirms :
  ['mqrdjia;=', 'පුරාවස්තු'], // "antiquities" — confirms q
  [',l=K', 'ලකුණ'],       // "a mark" — confirms K
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
