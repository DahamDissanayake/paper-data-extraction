export interface LegacyMap {
  /** Legacy byte sequence → Unicode fragment. Longest match wins. */
  tokens: Record<string, string>;
  maxTokenLength: number;
}

/** Vowel signs that are stored BEFORE their consonant in legacy order. */
const PREFIX_VOWELS = new Set(['ෙ', 'ේ', 'ෛ']);

/** Internal marker for the `da` ligature — never appears in final output. */
const LONG_AA_MARKER = '';

/** ෙ + ා → ො, ෙ + ෟ → ෞ, and the ේ/ෝ pairs. */
const COMBINE: Record<string, string> = {
  'ො': 'ො', // ෙ + ා = ො
  'ෞ': 'ෞ', // ෙ + ෟ = ෞ
  'ේා': 'ෝ', // ේ + ා = ෝ
  [`ෙ${LONG_AA_MARKER}`]: 'ෝ', // ෙ + da-ligature = ෝ (long o via the da ligature)
};

const SINHALA_CONSONANT = /[ක-ෆ]/;

/**
 * The ONLY codepoints a legacy map may leave alone without counting as a
 * missing mapping.
 *
 * "It looked like ASCII" is not evidence that a byte is Latin content: FM
 * fonts encode Sinhala onto the ASCII range, so `;` is ත, `<` is ළ, `.` is
 * ග and `^`/`&` are the parenthesis glyphs. Treating the whole
 * \x20-\x7E range as passthrough therefore hid the common case — a legacy
 * code with no token — behind silent verbatim output, which is exactly the
 * failure the spec's `⟨?⟩`/`unmapped-glyph` net exists to prevent.
 *
 * The map's `tokens` dict is the source of truth for what is known.
 * Anything not in it is a candidate miss unless it is one of these three
 * classes, each confirmed against the rendered reference page:
 *   - digits `0-9`   — question numbers, "2025", and Task 2's own golden
 *                      `ld,h meh 01 hs` → `කාලය පැය 01 යි` where "01" stays "01"
 *   - whitespace     — word and column separators
 *   - `-`            — the dash in `b;sydih -` → "ඉතිහාසය – I" and
 *                      `fojk jdr mÍlaIKh - 2025` (both FMSamanthax)
 */
const PASSTHROUGH = /[0-9\s-]/;

export function convertLegacy(input: string, map: LegacyMap): { text: string; unmapped: number } {
  // Stage 1+2 — longest-match tokenize and map.
  const pieces: string[] = [];
  let unmapped = 0;
  let i = 0;
  while (i < input.length) {
    let matched = false;
    for (let len = Math.min(map.maxTokenLength, input.length - i); len > 0; len--) {
      const slice = input.slice(i, i + len);
      const mapped = map.tokens[slice];
      if (mapped !== undefined) { pieces.push(mapped); i += len; matched = true; break; }
    }
    if (matched) continue;
    const ch = input[i];
    if (PASSTHROUGH.test(ch)) pieces.push(ch);
    else { pieces.push('⟨?⟩'); unmapped++; }
    i++;
  }

  // Stage 3 — reorder prefix vowels after the consonant cluster they precede.
  const out: string[] = [];
  let pending: string | null = null;
  for (const piece of pieces.join('').split('')) {
    if (PREFIX_VOWELS.has(piece)) { pending = (pending ?? '') + piece; continue; }
    out.push(piece);
    if (pending && SINHALA_CONSONANT.test(piece)) { out.push(pending); pending = null; }
  }
  if (pending) out.push(pending);

  // Stage 4 — normalize combining pairs.
  let text = out.join('');
  for (const [from, to] of Object.entries(COMBINE)) text = text.split(from).join(to);
  text = text.split(LONG_AA_MARKER).join('ා'); // any uncombined da-ligature degrades to plain ා
  return { text, unmapped };
}
