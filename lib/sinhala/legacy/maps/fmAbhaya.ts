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
  // The `da` ligature is the discriminator between two otherwise-similar
  // words: when `d` is immediately followed by `r` (e.g. f;dr;=re ->
  // තොරතුරු), the `d`/`r` tokens are used separately and the short-o
  // combine rule (ෙ+ා->ො) applies as usual. When `d` is immediately
  // followed by `a` (virama), the longest-match tokenizer prefers this
  // 2-character `da` token, which maps to a private-use sentinel that the
  // convert.ts COMBINE table resolves to long-o (ෝ) when it follows a
  // flushed short-e prefix vowel, or degrades to plain aa-kaara (ා)
  // otherwise. See convert.ts for the LONG_AA_MARKER mechanism.
  'da': '\uE000', // da ligature — resolves to long-o (ෝ) after a flushed short-e prefix, else degrades to plain ා

  // --- Punctuation and symbol slots ---------------------------------------
  // The FM fonts remap ASCII punctuation slots too, so these are NOT
  // passthrough. Each was read off the rendered reference page (page 1 of
  // test/fixtures/GRADE-11-HISTORY.pdf drawn with its own embedded font)
  // and matched against the legacy string at the same position.
  '^': '(', // `^1&` renders as "(1)" — the option markers
  '&': ')',
  "'": '.', // `01'` renders as "01." ; `idlaIshls'` renders as "සාක්ෂියකි."
  '"': ',', // `jkafka"` renders as "වන්නේ," — the 5 stems that end in a comma
  '(': ':', // `wxlh(` renders as "අංකය:" ; `hq;=hs (` renders as "යුතුයි :"
  '$': '/', // `ku$ úNd.` renders as "නම/ විභාග"
  '@': '?', // `kulska o@` renders as "නමකින් ද?"
  '²': '•', // the round bullet that opens each instruction line
};

export const FM_ABHAYA: LegacyMap = {
  tokens,
  maxTokenLength: Math.max(...Object.keys(tokens).map((k) => k.length)),
};
