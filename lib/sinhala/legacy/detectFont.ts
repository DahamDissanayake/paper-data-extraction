import type { LegacyMap } from './convert';
import { convertLegacy } from './convert';
import { FONT_MAPS, FM_FALLBACK } from './maps';

/** PDF subset prefixes look like "XSUOWA+". */
export function stripSubsetPrefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '');
}

/**
 * A legacy FM-family byte string only ever uses ASCII/Latin-1 bytes — that
 * IS the encoding trick, remapping Sinhala onto the Latin keyboard range.
 * So a genuine Sinhala Unicode codepoint anywhere in an item's string is
 * proof the PDF already embeds real Unicode Sinhala for that text, whatever
 * its font happens to be named.
 */
const HAS_SINHALA_UNICODE = /[඀-෿]/;

export function mapForFont(fontName: string, str?: string): LegacyMap | null {
  if (str !== undefined && HAS_SINHALA_UNICODE.test(str)) return null;
  const bare = stripSubsetPrefix(fontName);
  if (FONT_MAPS[bare]) return FONT_MAPS[bare];
  // Unknown FM-family font: fall back rather than emit garbage.
  if (/^FM/i.test(bare)) return FM_FALLBACK;
  return null;
}

export function transliterateItem(str: string, fontName: string): { text: string; unmapped: number } {
  const map = mapForFont(fontName, str);
  if (!map) return { text: str, unmapped: 0 };
  return convertLegacy(str, map);
}
