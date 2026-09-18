import type { LegacyMap } from '../convert';

// FM Abhaya (and, per lib/sinhala/legacy/maps/index.ts, the rest of the FM
// family, which shares its keyboard layout) legacy byte → Unicode.
//
// HOW THIS TABLE WAS DERIVED — and how to extend it
// -------------------------------------------------
// Nothing here is recalled from general familiarity with FM keyboard
// layouts; the plan is explicit that such intuition is unreliable for
// font-specific legacy encodings. Two evidence sources were used:
//
//   1. The golden word pairs in the plan's "Verified Source Facts" table,
//      verified word-level against the paper's own English subtitles.
//   2. The reference paper rendered to an image with its OWN embedded FM
//      font program (test/fixtures/GRADE-11-HISTORY.pdf, page 1, scale 3-10)
//      and read visually, then aligned character-by-character against the
//      legacy string sitting at the same position in
//      test/fixtures/pg1.items.json. The encoding is legacy but the drawn
//      glyphs are the intended Sinhala, because the PDF embeds the real
//      font — pdf.js only exposes the raw character codes.
//
// Every entry below carries the word it was read from. To add one, render
// the page, read the glyph, align it, and add the evidence word to the
// comment plus a pair to test/sinhala/convert.test.ts. Do NOT guess: a
// wrong-but-confident mapping is strictly worse than an honest gap, because
// convert.ts now emits ⟨?⟩ and raises the `unmapped-glyph` flag for a gap.
//
// Unicode values for combining marks and consonant+mark ligatures are
// written as \uXXXX escapes so the table is auditable independent of how a
// bare Sinhala combining mark renders in an editor.
const A = '්'; // ්   hal kirima / virama
const ZWJ = '‍';

const tokens: Record<string, string> = {
  // --- Independent vowels -------------------------------------------------
  'b': 'ඉ', // ඉ   b;sydih -> ඉතිහාසය
  'w': 'අ', // අ   wxl -> අංක
  'wd': 'ආ', // ආ  wdrlaIs; -> ආරක්ෂිත (අ + ා always reads as the single ආ)
  'we': 'ඇ', // ඇ  we;s -> ඇති, wegiels,s -> ඇටසැකිලි, weúßKs -> ඇවිරිණි
  't': 'එ', // එ   tla tla -> එක එක
  'ft': 'ඓ', // ඓ  ft;sydisl -> ඓතිහාසික (kombuva + එ reads as the single ඓ)
  'T': 'ඔ', // ඔ   Tng -> ඔබට, Tjqka -> ඔවුන්, ueáTre -> මැටිඔරු

  // --- Consonants ---------------------------------------------------------
  'l': 'ක', // ක   wxl -> අංක
  '.': 'ග', // ග   .%ka:hla -> ග්‍රන්ථයක්, úNd. -> විභාග, .du -> ගාම
  'p': 'ච', // ච   fpda, -> චෝල
  'c': 'ජ', // ජ   wka;¾cd;sl -> අන්තර්ජාතික, rc -> රජ
  'g': 'ට', // ට   j,g -> වලට, Tng -> ඔබට
  'v': 'ඩ', // ඩ   jvd;a -> වඩාත්, NdKav -> භාණ්ඩ
  'K': 'ණ', // ණ   merKs -> පැරණි, ol=Kq -> දකුණු
  ';': 'ත', // ත   b;sydih -> ඉතිහාසය
  ':': 'ථ', // ථ   .%ka:hla -> ග්‍රන්ථයක්, uOHia:dkh -> මධ්‍යස්ථානය
  'o': 'ද', // ද   ,o -> ලද, mofhka -> පදයෙන්
  'O': 'ධ', // ධ   wOHdmk -> අධ්‍යාපන, idOlh -> සාධකය
  'k': 'න', // න   m%Yak -> ප්‍රශ්න
  '|': 'ඳ', // ඳ   ms<sn| -> පිළිබඳ, i|yka -> සඳහන්, fj<|dï -> වෙළඳාම්
  'm': 'ප', // ප   m%Yak -> ප්‍රශ්න
  'n': 'බ', // බ   ms<sn| -> පිළිබඳ, kgnqka -> නටබුන්
  'N': 'භ', // භ   úNd. -> විභාග, NdKav -> භාණ්ඩ
  'u': 'ම', // ම   udff, -> මාලෛ, uyfika -> මහසෙන්
  'U': 'ඹ', // ඹ   jhU -> වයඹ
  'h': 'ය', // ය   b;sydih -> ඉතිහාසය
  'r': 'ර', // ර   f;dr;=re -> තොරතුරු
  ',': 'ල', // ල   ,xldj -> ලංකාව
  'j': 'ව', // ව   ,xldj -> ලංකාව
  'Y': 'ශ', // ශ   Y%S -> ශ්‍රී
  'I': 'ෂ', // ෂ   idlaIs -> සාක්ෂි, NIaudjfYaI -> භෂ්මාවශේෂ
  'i': 'ස', // ස   b;sydih -> ඉතිහාසය
  'y': 'හ', // හ   b;sydih -> ඉතිහාසය
  '<': 'ළ', // ළ   ms<s;=re -> පිළිතුරු

  // --- Dependent vowel signs and other marks ------------------------------
  'x': 'ං', // ං   wxl -> අංක
  'd': 'ා', // ා   ,xldj -> ලංකාව
  'e': 'ැ', // ැ   meh -> පැය (plan golden), merKs -> පැරණි, ;ekam;a -> තැන්පත්
  'E': 'ෑ', // ෑ   n,mE -> බලපෑ
  's': 'ි', // ි   b;sydih -> ඉතිහාසය
  'S': 'ී', // ී   Y%S -> ශ්‍රී
  '=': 'ු', // ු   ms<s;=re -> පිළිතුරු
  'q': 'ු', // ු   ol=Kq -> දකුණු, mqrdjia;= -> පුරාවස්තු (second u-glyph slot)
  'Q': 'ූ', // ූ   uQ¾;s -> මූර්ති, jQfha -> වූයේ
  '+': 'ූ', // ූ   l+glKaKdNh -> කූටකණ්ණාභය (second uu-glyph slot)
  'D': 'ෘ', // ෘ   ixialD;sl -> සංස්කෘතික, .Dym;s -> ගෘහපති
  'f': 'ෙ', // ෙ   f;dr;=re -> තොරතුරු (a prefix vowel: stored before its consonant)
  'ff': 'ෛ', // ෛ  ffl,dhudff, -> කෛලායමාලෛ (kombu deka, also a prefix vowel)
  'a': A, //        ්   m%Yak -> ප්‍රශ්න; after a kombuva this is the diga stroke (see convert.ts COMBINE)
  'A': A, //        ්   idOlh jQfhA -> සාධකය වූයේ (a second hal/diga slot)
  '%': `${A}${ZWJ}ර`, // ්‍ර rakaransaya — Y%S -> ශ්‍රී, m%Yak -> ප්‍රශ්න
  'H': `${A}${ZWJ}ය`, // ්‍ය yansaya — wOHdmk -> අධ්‍යාපන, ldYHm -> කාශ්‍යප
  '¾': `ර${A}`, // ර්  fomd¾;fïka;=j -> දෙපාර්තමේන්තුව (plan golden), wka;¾cd;sl -> අන්තර්ජාතික

  // --- Consonant + mark ligature slots ------------------------------------
  // FM packs several common consonant+vowel-sign pairs into a single byte in
  // the Latin-1 supplement range. Each maps to two Unicode codepoints.
  'á': `ටි`, // ටි  ueáTre -> මැටිඔරු
  'Ü': `ට${A}`, // ට්  mÜgk.du -> පට්ටනගාම, flajÜg -> කේවට්ට
  'Ó': 'ථී', // ථී  iaÓr -> ස්ථීර
  'È': 'දි', // දි  ksjerÈ -> නිවැරදි, bkaÈhdfõ -> ඉන්දියාවේ
  '§': 'දී', // දී  § we;s -> දී ඇති
  'ê': 'ධි', // ධි  wêm;s -> අධිපති
  'ë': 'ධී', // ධී  ëjrhka -> ධීවරයන්
  '÷': 'ඳු', // ඳු  y÷kajd -> හඳුන්වා
  'î': 'බී', // බී  ;sîu -> තිබීම
  'ñ': 'මි', // මි  ñksia -> මිනිස්, ysñlï -> හිමිකම්
  'ï': `ම${A}`, // ම්  fmkakqï -> පෙන්නුම්, leghï -> කැටයම්
  'Ñ': 'චි', // චි  Ñ;% -> චිත්‍ර, rÑ; -> රචිත
  'Ô': 'ජී', // ජී  Ôjudk -> ජීවමාන
  'ß': 'රි', // රි  w;=ßka -> අතුරින්, weúßKs -> ඇවිරිණි
  'Í': 'රී', // රී  lsÍu -> කිරීම, mÍlaIKh -> පරීක්ෂණය
  're': 'රු', // රු  ms<s;=re -> පිළිතුරු. A two-byte ligature slot,
  //                     which is what resolves the plan's noted contradiction:
  //                     `e` alone is ැ (meh -> පැය) and only the `re` PAIR is රු.
  '¨': 'ලු', // ලු  ish¨u -> සියලුම
  'ú': 'වි', // වි  úiska -> විසින්, úNd. -> විභාග
  'ù': 'වී', // වී  ùuhs -> වීමයි
  'õ': `ව${A}`, // ව්  bkaÈhdfõ -> ඉන්දියාවේ

  // --- `da` two-character token -------------------------------------------
  // The `da` ligature is the discriminator between two otherwise-similar
  // words: when `d` is immediately followed by `r` (e.g. f;dr;=re ->
  // තොරතුරු), the `d`/`r` tokens are used separately and the short-o
  // combine rule (ෙ+ා->ො) applies as usual. When `d` is immediately
  // followed by `a` (virama), the longest-match tokenizer prefers this
  // 2-character `da` token, which maps to a private-use sentinel that the
  // convert.ts COMBINE table resolves to long-o (ෝ) when it follows a
  // flushed short-e prefix vowel, or degrades to plain aa-kaara (ා)
  // otherwise. See convert.ts for the LONG_AA_MARKER mechanism.
  'da': '', // da ligature — resolves to long-o (ෝ) after a flushed short-e prefix, else degrades to plain ා

  // --- Punctuation and symbol slots ---------------------------------------
  // The FM fonts remap ASCII punctuation slots too, so these are NOT
  // passthrough. Each was read off the rendered reference page and matched
  // against the legacy string at the same position.
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
