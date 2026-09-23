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
  'T!': 'ඖ', // ඖ  T!IO -> ඖෂධ (medicine, "for the people's ඖෂධ" — the same
  //               sentence '`o'/'`.' were derived from). A two-byte
  //               ligature: 'T' alone stays ඔ; only 'T!' together is ඖ.
  'W': 'උ', // උ   Wu;= -> උමතු, Wla; -> උක්ත (paired against wkqla; -> අනුක්ත
  //              in the same sentence), W.=r -> උගුර, WmÈk -> උපදින
  '´': 'ඕ', // ඕ   ´IaGP -> ඕෂ්ඨජ (see the places-of-articulation list under 'G')
  'B': 'ඊ', // ඊ   ^w&" ^wd&" ^b&" ^B& -> (අ) (ආ) (ඉ) (ඊ), the standard
  //              Sinhala independent-vowel listing order continued one slot

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
  '±': 'ද', // ද   my; ±lafjk -> පහත දක්වෙන ("shown below" — appears
  //              identically 4 times across the paper). A second redundant
  //              ද slot, alongside 'o'.
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
  'G': 'ඨ', // ඨ   lKaGP -> කණ්ඨජ, uQ¾OP -> මූර්ධජ, ´IaGP -> ඕෂ්ඨජ (three of
  //              the five places-of-articulation terms in the same option
  //              list), mdGh -> පාඨය
  'P': 'ජ', // ජ   confirmed against the same four-term places-of-articulation
  //              list: lKaGP -> කණ්ඨජ, uQ¾OP -> මූර්ධජ, ´IaGP -> ඕෂ්ඨජ,
  //              ;d¨P -> තාලුජ

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
  '!': 'ෟ', // ෟ   gayanukitta — fi!kao¾hfhka -> සෞන්දර්යයෙන් ("by [natural]
  //              beauty" — the COMBINE table already turns a flushed ෙ
  //              prefix immediately followed by ෟ into ෞ; see 'T!' above for
  //              the same vowel sign fused into the independent-vowel slot).
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
  '¿': 'ළු', // ළු  l¿ wl=frka -> කළු අකුරෙන් (bold BLACK letters), l¿;r -> කලුතර
  //           misspells as "කලුතර" without the retroflex ළ, but the same
  //           GRADE 10 SINHALA paper's own hd¿fjla -> යාළුවෙක් (a friend)
  //           and district name l¿;r -> කළුතර (Kalutara) both need ළ, so ¿
  //           is ළු, not ලු.
  'ø': `ද${A}${ZWJ}ර`, // ද්‍ර  uqøs; -> මුද්‍රිත (printed), iuqøh -> සමුද්‍රය (ocean),
  //                       tÈßùr ir[É]pka[ø] -> එදිරිවීර සරත්[ත්]චන්ද්‍ර (the
  //                       author Ediriweera Sarathchandra, named on the essay
  //                       page of the same paper)
  'É': `ත${A}`, // ත්  ir[É]pkaø, read against the same Sarathchandra name above:
  //               the only gap between confirmed "සර" and confirmed "චන්ද්‍ර"
  //               is "ත්".
  'ÿ': 'දු', // දු  iqÿiq -> සුදුසු (suitable), isÿjkakla -> සිදුවන්නක් (something
  //            that occurs), iqÿ ,m -> සුදු ලප (white spots) — three
  //            unrelated real words, all needing ද+ු, not the single ු this
  //            module first (wrongly) guessed from Èks`ÿf.a alone.
  'ó': 'මී', // මී  ióm -> සමීප (close/near), i[ó]mùu -> සමීපවීම (approaching),
  //             i[ó]m ld¾hhka -> සමීප කාර්යයන් (closely-related functions)
  'ì': 'බි', // බි  fiakl ìì f,a -> සේනක බිබිලේ (Dr. Senaka Bibile, the
  //             pharmacologist named for Sri Lanka's essential-medicines
  //             policy — the same sentence's ¥m;aj, ck;dj i`oyd T!IO ...
  //             ("... medicine ... for the people ...") is literally about
  //             that policy)
  'í': `බ${A}`, // බ්  Y[í]o -> ශබ්ද (sound, a recurring word on this
  //                phonetics-themed page), ,e[f][í]' -> ලැබේ (is received/
  //                awarded — "ලකුණු 40ක් ලැබේ")
  'C': `ක${A}`, // ක්  w[C]Ir -> අක්ෂර (letters), wdr[C]Il -> ආරක්ෂක
  //                (protective), wOH[C]I;=ud -> අධ්‍යක්ෂතුමා (the Director)
  '/': 'රැ', // රැ  [/]iaùug -> රැස්වීමට (to assemble), [/]iaùfï -> රැස්වීමේ
  //             (of the meeting), [/]ils -> රැසකි (is a multitude)
  '¥': 'දූ', // දූ  ¥m;aj, -> දූපත්වල ("of the islands" — same "for the
  //             people's ඖෂධ" sentence '`o'/'T!' were derived from),
  //             [¥]Ilfhl= -> දූෂකයෙකු (a corrupter), fh[¥] -> යෙදූ (used, as
  //             in "ඔබ යෙදූ වචන" — "the words you used")
  'M': 'ඵ', // ඵ   m%;s[M], -> ප්‍රතිඵල (results), ksIa[M], -> නිෂ්ඵල
  //              (futile), u,a [M], -> මල්ඵල (flowers and fruit)
  'L': 'ඛ', // ඛ   f,a[L]lhd -> ලේඛකයා (the writer), m%uq[L];ajh ->
  //              ප්‍රමුඛත්වය (prominence), f,a[L]k -> ලේඛන (writings), .S
  //              [L]Kavfha -> ගී ඛණ්ඩයේ ("of the song section")
  'Ë': `ක${A}ෂ`, // ක්ෂ  o[Ë];d -> දක්ෂතා (skill), mÍ[Ë]Kh -> පරීක්ෂණය
  //                  (examination — this exact paper's own cover-page title,
  //                  "තෙවන වාර පරීක්ෂණය 2025")
  'Ê': `ජ${A}`, // ජ්  úf[Ê]r;ak -> විජේරත්න, a common Sri Lankan surname,
  //                 appearing twice independently. The COMBINE table turns
  //                 the flushed ෙ prefix immediately followed by this
  //                 token's own virama into ේ, the same mechanism 'õ' and
  //                 'ï' already rely on.
  'à': 'ටී', // ටී  lem ù isà[u] -> කැප වී සිටීම (being devoted; the 's' just
  //              before 'à' already supplies the ි), W;a;r fkd§ isàu ->
  //              උත්තර නොදී සිටීම ("remaining without answering" — two
  //              unrelated sentences, same word "සිටීම")

  // --- Nasalized-consonant two-character tokens ---------------------------
  // A leading backtick prenasalizes the consonant byte that follows it — the
  // legacy keyboard's way of reaching the ⁿ-prefixed Sinhala letters that
  // don't have their own dedicated byte the way ඹ ('U') and ඳු ('÷') do.
  // Confirmed against three independent, unrelated dictionary words: i`oyd
  // -> සඳහා ("for"), i`oyka -> සඳහන් (matches the existing i|yka golden pair
  // testing the SAME word through the OTHER ඳ byte, '|' — this font has two
  // redundant ඳ slots), and u`. -> මඟ (the idiom මඟ හැරීම, "to miss the
  // mark" — NOT මග, the tatsama spelling with plain ග).
  '`o': 'ඳ', // ඳ  i`oyd -> සඳහා, i`oyka -> සඳහන්
  '`.': 'ඟ', // ඟ  u`. yeÍu -> මඟ හැරීම
  '`§': 'ඳී', // ඳී  ne`§ -> බැඳී (bound/tied) — the same nasalization prefix,
  //               but here combining with the ALREADY-two-codepoint '§'
  //               ligature (දී) rather than a bare consonant byte, so it
  //               gets its own explicit 2-byte entry rather than a computed
  //               combine rule.
  '`ÿ': 'ඳු', // ඳු  Èks`ÿf.a -> දිනිඳුගේ (a person's name, "Dinindu's" — the
  //               proper name this whole nasalization-prefix family was
  //               first noticed in). Confirmed by rendering the PDF's own
  //               embedded font at high resolution and reading the glyph's
  //               distinctive ඳ loop directly, rather than guessed: the
  //               same nasalization prefix as `o and `., here combining
  //               with 'ÿ' (දු) instead of a bare consonant byte, exactly
  //               like `§ combines with the already-two-codepoint '§'.

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
  'z': '“', // “  zzl=re,a,dZZ -> "කුරුල්ලා" (doubled for a bolder quote
  //                 mark), zkg;sZ -> "නටති"
  'Z': '”', // ”  closing partner of 'z', same evidence
};

export const FM_ABHAYA: LegacyMap = {
  tokens,
  maxTokenLength: Math.max(...Object.keys(tokens).map((k) => k.length)),
};
