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
    // Latin letters, digits, punctuation and whitespace pass through untouched.
    if (/[\x20-\x7E]/.test(ch)) pieces.push(ch);
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
