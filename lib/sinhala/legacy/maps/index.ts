import type { LegacyMap } from '../convert';
import { FM_ABHAYA } from './fmAbhaya';

/**
 * The FM family broadly shares one keyboard layout, so FM_ABHAYA is the
 * default for every FM font. If a golden test proves a font differs, add a
 * dedicated map here and key it by its stripped name.
 */
export const FONT_MAPS: Record<string, LegacyMap> = {
  FMAbhayax: FM_ABHAYA,
  FMSamanthax: FM_ABHAYA,
  FMGanganeex: FM_ABHAYA,
  FMDeranax: FM_ABHAYA,
  FMAbabldBold: FM_ABHAYA,
  FMEmaneex: FM_ABHAYA,
};

export const FM_FALLBACK = FM_ABHAYA;
