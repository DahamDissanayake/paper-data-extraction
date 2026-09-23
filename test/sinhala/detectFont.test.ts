import { describe, it, expect } from 'vitest';
import { stripSubsetPrefix, mapForFont, transliterateItem } from '@/lib/sinhala/legacy/detectFont';

describe('stripSubsetPrefix', () => {
  it('removes a six-character subset prefix', () => {
    expect(stripSubsetPrefix('XSUOWA+FMAbhayax')).toBe('FMAbhayax');
  });
  it('leaves an unprefixed name alone', () => {
    expect(stripSubsetPrefix('FMAbhayax')).toBe('FMAbhayax');
  });
});

describe('mapForFont', () => {
  it.each(['XSUOWA+FMAbhayax', 'NJALQY+FMSamanthax', 'PADNAV+FMGanganeex',
           'IRSKNS+FMDeranax', 'WSZVOB+FMAbabldBold'])('recognises %s as legacy', (f) => {
    expect(mapForFont(f)).not.toBeNull();
  });

  it.each(['BQCOZL+TimesNewRomanPSMT', 'EDJBMJ+Swiss721BT-Roman', 'RWTBLA+Swiss721BT-Bold'])(
    'returns null for Latin font %s', (f) => {
      expect(mapForFont(f)).toBeNull();
    });

  /**
   * A legacy FM byte string only ever uses ASCII/Latin-1 bytes; a genuine
   * Sinhala Unicode codepoint proves this specific item's text is already
   * correct, whatever its font is named. Without this check, a PDF that
   * embeds real Unicode Sinhala under a font that happens to be named or
   * subset-tagged like the FM family would get run through legacy
   * transliteration anyway, silently corrupting already-correct text.
   */
  it('treats an FM-named font as already-Unicode when its string contains real Sinhala codepoints', () => {
    expect(mapForFont('XSUOWA+FMAbhayax', 'ඉතිහාසය')).toBeNull();
  });

  it('still treats an FM-named font as legacy when its string has no Sinhala codepoints', () => {
    expect(mapForFont('XSUOWA+FMAbhayax', 'b;sydih')).not.toBeNull();
  });

  it('is backward compatible when no string is given', () => {
    expect(mapForFont('XSUOWA+FMAbhayax')).not.toBeNull();
  });
});

describe('transliterateItem', () => {
  it('converts legacy text', () => {
    expect(transliterateItem('b;sydih', 'XSUOWA+FMAbhayax').text).toBe('ඉතිහාසය');
  });

  it('passes Latin text through untouched', () => {
    const s = 'Provincial Department of Education - NWP';
    expect(transliterateItem(s, 'EDJBMJ+Swiss721BT-Roman').text).toBe(s);
  });

  it('passes already-Unicode Sinhala text through untouched even under an FM-family font name', () => {
    const s = 'ඉතිහාසය';
    expect(transliterateItem(s, 'XSUOWA+FMAbhayax')).toEqual({ text: s, unmapped: 0 });
  });
});
