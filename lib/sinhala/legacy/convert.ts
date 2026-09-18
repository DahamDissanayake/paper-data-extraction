export interface LegacyMap {
  /** Legacy byte sequence → Unicode fragment. Longest match wins. */
  tokens: Record<string, string>;
  maxTokenLength: number;
}

const VIRAMA = '්'; // ්  hal kirima
const ZWJ = '‍';
const KOMBUVA = 'ෙ'; // ෙ
const DIGA_KOMBUVA = 'ේ'; // ේ
const KOMBU_DEKA = 'ෛ'; // ෛ
const GAYANUKITTA = 'ෟ'; // ෟ
const AELA_PILLA = 'ා'; // ා
const KOMBUVA_AELA = 'ො'; // ො
const KOMBUVA_DIGA_AELA = 'ෝ'; // ෝ
const KOMBUVA_GAYANUKITTA = 'ෞ'; // ෞ

/** Vowel signs that are stored BEFORE their consonant in legacy order. */
const PREFIX_VOWELS = new Set([KOMBUVA, DIGA_KOMBUVA, KOMBU_DEKA]);

/** Internal marker for the `da` ligature — never appears in final output. */
const LONG_AA_MARKER = '';

/** ෙ + ා → ො, ෙ + ෟ → ෞ, and the ේ/ෝ pairs. */
const COMBINE: Record<string, string> = {
  // ෙ + ් → ේ. The legacy `a` slot is the hal kirima everywhere EXCEPT
  // directly after a kombuva, where it is the second stroke that makes the
  // kombuva long: `fYal` draws as ශේක, `jkafka` as වන්නේ, `fY%a` as ශ්‍රේ.
  [`${KOMBUVA}${VIRAMA}`]: DIGA_KOMBUVA,
  [`${KOMBUVA}${AELA_PILLA}`]: KOMBUVA_AELA,
  [`${KOMBUVA}${GAYANUKITTA}`]: KOMBUVA_GAYANUKITTA,
  [`${DIGA_KOMBUVA}${AELA_PILLA}`]: KOMBUVA_DIGA_AELA,
  // ෙ + da-ligature → ෝ (long o via the da ligature)
  [`${KOMBUVA}${LONG_AA_MARKER}`]: KOMBUVA_DIGA_AELA,
  // ෙ + ෙ → ෛ, for any FM font that spells kombu deka as two kombuvas
  // rather than the single `ff` token.
  [`${KOMBUVA}${KOMBUVA}`]: KOMBU_DEKA,
};

const SINHALA_CONSONANT = /[ක-ෆ]/;

/**
 * A dependent vowel sign that ended up in FRONT of a rakaransaya/yansaya
 * belongs after it — the vowel attaches to the whole cluster. The reference
 * paper types `iYS%l` (ස ශ ී ්‍ර ක) for සශ්‍රීක, so the raw order has to be
 * normalised. This only matches an ordering Unicode never produces (a vowel
 * sign is never legitimately followed by virama+ZWJ), so it cannot corrupt
 * text that was already correct.
 */
const VOWEL_BEFORE_CONJUNCT = new RegExp(
  `([\\u0DCF-\\u0DDF])(${VIRAMA}${ZWJ}[\\u0D9A-\\u0DC6])`,
  'g',
);

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
  //
  // "Cluster", not "consonant": a rakaransaya or yansaya (virama + ZWJ +
  // consonant) binds to the consonant in front of it, and the prefix vowel
  // belongs after the whole thing. `fY%aKsh` is ශ්‍රේණිය — the ෙ lands after
  // ශ්‍ර, not between ශ and ්‍ර.
  const chars = pieces.join('').split('');
  const out: string[] = [];
  let pending = '';
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (PREFIX_VOWELS.has(ch)) { pending += ch; continue; }
    out.push(ch);
    if (!pending || !SINHALA_CONSONANT.test(ch)) continue;
    const continuesCluster =
      chars[k + 1] === VIRAMA && chars[k + 2] === ZWJ && SINHALA_CONSONANT.test(chars[k + 3] ?? '');
    if (continuesCluster) continue;
    out.push(pending);
    pending = '';
  }
  if (pending) out.push(pending);

  // Stage 4 — normalize combining pairs.
  let text = out.join('');
  for (const [from, to] of Object.entries(COMBINE)) text = text.split(from).join(to);
  text = text.split(LONG_AA_MARKER).join(AELA_PILLA); // any uncombined da-ligature degrades to plain ා
  text = text.replace(VOWEL_BEFORE_CONJUNCT, '$2$1');
  return { text, unmapped };
}
