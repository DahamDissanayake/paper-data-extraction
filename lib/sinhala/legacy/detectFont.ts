import type { LegacyMap } from './convert';
import { convertLegacy } from './convert';
import { FONT_MAPS, FM_FALLBACK } from './maps';

/** PDF subset prefixes look like "XSUOWA+". */
export function stripSubsetPrefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '');
}

export function mapForFont(fontName: string): LegacyMap | null {
  const bare = stripSubsetPrefix(fontName);
  if (FONT_MAPS[bare]) return FONT_MAPS[bare];
  // Unknown FM-family font: fall back rather than emit garbage.
  if (/^FM/i.test(bare)) return FM_FALLBACK;
  return null;
}

export function transliterateItem(str: string, fontName: string): { text: string; unmapped: number } {
  const map = mapForFont(fontName);
  if (!map) return { text: str, unmapped: 0 };
  return convertLegacy(str, map);
}
