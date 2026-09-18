import type { LegacyMap } from '../convert';

// Every entry below was derived from the golden word pairs in
// test/sinhala/convert.test.ts by running the failing tests, reading the
// actual-vs-expected diff, and adjusting one token at a time. Nothing here
// was invented from memory of the FM Abhaya keyboard layout.
//
// Codepoints are written as \uXXXX escapes (not literal glyphs) so the table
// is auditable independent of how Sinhala combining marks render in an
// editor — several of these vowel signs are visually near-identical or
// combine on screen with the character before them.
const tokens: Record<string, string> = {
  // --- Seed tokens, given directly by task-2-brief.md and confirmed by
  // `b;sydih` -> ඉතිහාසය and `wxl` -> අංක ---
  'b': 'ඉ', // ඉ
  'w': 'අ', // අ
  'x': 'ං', // ං
  'l': 'ක', // ක
  ';': 'ත', // ත
  'y': 'හ', // හ
  'i': 'ස', // ස
  'h': 'ය', // ය
  's': 'ි', // ි  (vowel sign KITTA, short i)
  'd': 'ා', // ා  (vowel sign AELA-PILLA, aa)

  // --- Derived from `Y%S ,xldj` -> ශ්‍රී ලංකාව ---
  // Aligning legacy chars 1:1 against the Unicode codepoints of the
  // expected output (no reordering needed here — none of these are prefix
  // vowels) gives:
  //   Y -> ශ, % -> ්‍ර (virama + ZWJ + ර, the "rakaransaya"/ra-conjunct
  //        glyph used for clusters like ශ්‍ර, ප්‍ර), S -> ී, ',' -> ල,
  //        x -> ං (already known), l -> ක (already known),
  //        d -> ා (already known), j -> ව
  'Y': 'ශ', // ශ
  '%': '්‍ර', // ්‍ර  (virama + ZWJ + ර — confirmed again by m%Yak)
  'S': 'ී', // ී  (vowel sign DIGA GAETTA-SANYAKA, long i)
  ',': 'ල', // ල
  'j': 'ව', // ව

  // --- Derived from `m%Yak` -> ප්‍රශ්න (confirms % and Y above, adds) ---
  'm': 'ප', // ප
  'a': '්', // ්  (virama / hal kirima)
  'k': 'න', // න

  // --- Derived from `ms<s;=re` -> පිළිතුරු (confirms m, s, ; above, adds) ---
  '<': 'ළ', // ළ
  '=': 'ු', // ු  (vowel sign PAPILLA, u)
  'r': 'ර', // ර
  'e': 'ු', // ු  (a second legacy code for the same vowel sign — FM
                 //     Abhaya uses a different glyph for vowel-sign-u
                 //     depending on the preceding consonant, e.g. the "ru"
                 //     ligature vs. the "tu" ligature, but both normalize
                 //     to the same Unicode codepoint. Confirmed again by
                 //     f;dr;=re, where both `=` and `e` appear and both
                 //     must resolve to ු for the word to match.)

  // --- Derived from `f;dr;=re` -> තොරතුරු ---
  // `f` precedes its consonant in legacy order (prefix vowel), confirmed
  // by the dedicated "moves the prefix vowel" test, which asserts the
  // result starts with තො (ත + short ො). Combined with the four-stage
  // pipeline's PREFIX_VOWELS/COMBINE tables, f + ; + d must yield
  // ෙ + ත + ා -> (reorder) -> ත + ෙ + ා -> (combine 'ො') -> තො.
  'f': 'ෙ', // ෙ  (vowel sign KOMBUVA, short e — a prefix vowel)

  // --- `da` two-character token ---
  // See "KNOWN LIMITATION" note below. `da` is defined so the longer token
  // wins over `d` + `a` separately (avoiding a spurious virama after the
  // vowel sign), but see the note for why it cannot reproduce the exact
  // long-o (ෝ) golden value for `f;darkak`.
  'da': 'ා', // ා (same value as bare `d` — see note below)
};

export const FM_ABHAYA: LegacyMap = {
  tokens,
  maxTokenLength: Math.max(...Object.keys(tokens).map((k) => k.length)),
};

// KNOWN LIMITATION — see task-2-report.md for full derivation.
//
// The golden pair `f;darkak` -> තෝරන්න (and the standalone "prefers the
// longer token" test asserting `f;da` -> තෝ) requires a LONG o (ෝ, U+0DDD)
// immediately after the ත produced by `;`. But `f` is fixed at U+0DD9
// (short e, confirmed by the "moves the prefix vowel" test against
// `f;dr;=re`), and the four-stage pipeline in convert.ts flushes that
// prefix vowel onto the very next consonant (ත) *before* any characters
// contributed by a `d`/`da` token are processed. The COMBINE table in
// convert.ts only defines ෙ+ා -> ො (short o) and ේ+ා -> ෝ (long o) — there
// is no rule that turns an already-flushed ෙ into ෝ. An exhaustive search
// over every 1- and 2-character value in the Sinhala Unicode block
// (U+0D80–U+0DFF) confirms no value for the `da` token can produce the
// exact expected result; the "long o" output only appears reachable by
// hard-coding a 4-character super-token (`f;da` -> තෝ) that bakes in the
// specific consonant ';', which is not a genuine character-level mapping
// and would not generalize to other consonants.
//
// This looks like a genuine contradiction between the golden fixture and
// the fixed convert.ts algorithm (possibly a transcription slip in the
// fixture — a short o, තොරන්න, would be mechanically reachable) rather
// than something a token-table adjustment can resolve. `da` is therefore
// mapped to the same value as `d` (ා), which is the closest achievable,
// generalizable result: it avoids inserting a spurious virama (the actual
// bug the "prefers the longer token" test's title is aimed at) but still
// yields short ො instead of long ෝ. Two tests are expected to fail as a
// result:
//   - "converts f;darkak" (golden pair)
//   - "prefers the longer token when two tokens share a prefix"
