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
});

describe('transliterateItem', () => {
  it('converts legacy text', () => {
    expect(transliterateItem('b;sydih', 'XSUOWA+FMAbhayax').text).toBe('ඉතිහාසය');
  });

  it('passes Latin text through untouched', () => {
    const s = 'Provincial Department of Education - NWP';
    expect(transliterateItem(s, 'EDJBMJ+Swiss721BT-Roman').text).toBe(s);
  });
});
