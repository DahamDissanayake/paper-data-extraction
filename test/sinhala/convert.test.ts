import { describe, it, expect } from 'vitest';
import { convertLegacy } from '@/lib/sinhala/legacy/convert';
import { FM_ABHAYA } from '@/lib/sinhala/legacy/maps/fmAbhaya';

const golden: [string, string][] = [
  ['b;sydih', 'ඉතිහාසය'],
  ['Y%S ,xldj', 'ශ්‍රී ලංකාව'],
  ['wxl', 'අංක'],
  ['m%Yak', 'ප්‍රශ්න'],
  ['ms<s;=re', 'පිළිතුරු'],
  ['f;darkak', 'තෝරන්න'],
  ['f;dr;=re', 'තොරතුරු'],

  // Added while investigating a real user report of garbled output on page
  // 1's header line ("Y%S ,xldj ms<sn| f;dr;=re i|yka jk ol=Kq bkaÈhdfõ §
  // rÑ; .%ka:hla jkafka" — real raw text from test/fixtures/pg1.items.json).
  // The original FM_ABHAYA map only had 24 tokens, all derived from the
  // handful of words above; real running prose (headers/instructions, as
  // opposed to the cherry-picked option/stem words the golden set happened
  // to cover) hits many more legacy byte codes. Each pair below was derived
  // the same way as the existing ones — NOT from memory of the FM Abhaya
  // keyboard layout, but by aligning an unmapped legacy word against
  // already-mapped tokens plus the real Sinhala word the result must be
  // (verified independently across 3-6 separate, unrelated occurrences of
  // each new token in the real page-1 fixture before trusting it; see
  // lib/sinhala/legacy/maps/fmAbhaya.ts's comments for the full trace).
  ['ms<sn|', 'පිළිබඳ'],   // "regarding" — introduces n, |
  ['i|yka', 'සඳහන්'],     // "mentioned" — confirms |
  ['ol=Kq', 'දකුණු'],     // "south" — introduces o, K, q
  ['ia:dkh', 'ස්ථානය'],   // "location" — introduces :
  ['.%ka:hla', 'ග්‍රන්ථයක්'], // "a treatise" — introduces ., confirms :
  ['mqrdjia;=', 'පුරාවස්තු'], // "antiquities" — confirms q
  [',l=K', 'ලකුණ'],       // "a mark" — confirms K
];

/**
 * The two golden pairs from the plan's "Verified Source Facts" table that
 * no task ever turned into a test. They exercise the ඹ/ර්/්‍ය codes and the
 * `e` = ැ reading ("පැය"), all of which the table was missing.
 */
const planGolden: [string, string][] = [
  ['ld,h meh 01 hs', 'කාලය පැය 01 යි'],
  ['jhU m<d;a wOHdmk fomd¾;fïka;=j', 'වයඹ පළාත් අධ්‍යාපන දෙපාර්තමේන්තුව'],
];

/**
 * Pairs derived for this fix wave by rendering page 1 of
 * test/fixtures/GRADE-11-HISTORY.pdf with its own embedded FM fonts and
 * reading the drawn glyphs, then aligning them against the legacy string at
 * the same position in test/fixtures/pg1.items.json. Nothing here was
 * recalled from general familiarity with FM keyboard layouts.
 */
const derivedGolden: [string, string][] = [
  // Q1
  ['ms<sn|', 'පිළිබඳ'],
  ['i|yka', 'සඳහන්'],
  ['ol=Kq', 'දකුණු'],
  ['bkaÈhdfõ', 'ඉන්දියාවේ'],
  ['.%ka:hla', 'ග්‍රන්ථයක්'],
  ['jkafka"', 'වන්නේ,'],
  ['uKsfïl,hs', 'මණිමේකලයි'],
  ['fYa.rdifYalrudff,', 'ශේගරාසශේකරමාලෛ'],
  ['ffl,dhudff,', 'කෛලායමාලෛ'],
  // Q2
  ['wfma', 'අපේ'],
  ['ixialD;sl', 'සංස්කෘතික'],
  ['fmkakqï', 'පෙන්නුම්'],
  ['flfrk', 'කෙරෙන'],
  ['Ôjudk', 'ජීවමාන'],
  ['idlaIs', 'සාක්ෂි'],
  ['yelafla', 'හැක්කේ'],
  ['kgnqka', 'නටබුන්'],
  ['Ñ;% uQ¾;s leghï', 'චිත්‍ර මූර්ති කැටයම්'],
  ['mqrdjia;=', 'පුරාවස්තු'],
  // Q3
  ['ueáTre', 'මැටිඔරු'],
  ['iqidkj,', 'සුසානවල'],
  ['merKs', 'පැරණි'],
  ['iaÓr', 'ස්ථීර'],
  ['idlaIshls', 'සාක්ෂියකි'],
  ['.,afuj,ï', 'ගල්මෙවලම්'],
  ['nyq,j', 'බහුලව'],
  [';ekam;a', 'තැන්පත්'],
  [';sîu', 'තිබීම'],
  ['ñksia', 'මිනිස්'],
  ['NIaudjfYaI', 'භෂ්මාවශේෂ'],
  ['lsÍu', 'කිරීම'],
  ['Tjqka úiska', 'ඔවුන් විසින්'],
  ['mßyrKh', 'පරිහරණය'],
  ['NdKav fldgia', 'භාණ්ඩ කොටස්'],
  ['wegiels,s', 'ඇටසැකිලි'],
  // Q4
  ['ft;sydisl', 'ඓතිහාසික'],
  ['uQ,dY%j,', 'මූලාශ්‍රවල'],
  ['ëjrhka úiQ .ï', 'ධීවරයන් විසූ ගම්'],
  ['y÷kajd we;af;a', 'හඳුන්වා ඇත්තේ'],
  ['l=uk kulska o@', 'කුමන නමකින් ද?'],
  ['mÜgk.du', 'පට්ටනගාම'],
  ['flajÜg .du', 'කේවට්ට ගාම'],
  ['kshï.ï', 'නියම්ගම්'],
  // Q5
  ['ld,fha', 'කාලයේ'],
  ['mofhka woyia', 'පදයෙන් අදහස්'],
  ['jQfha', 'වූයේ'],
  ['mjq,hs', 'පවුලයි'],
  ['.Dym;s', 'ගෘහපති'],
  // Q6
  ['iuia; f,dalhgu', 'සමස්ත ලෝකයටම'],
  ['wêm;s', 'අධිපති'],
  ['ixl,amh Ndú; l<', 'සංකල්පය භාවිත කළ'],
  ['l+glKaKdNh', 'කූටකණ්ණාභය'],
  ['uyfika', 'මහසෙන්'],
  ['ldYHm', 'කාශ්‍යප'],
  ['ksYaYxlu,a,', 'නිශ්ශංකමල්ල'],
  // Q7
  ['úchndyq rcq', 'විජයබාහු රජු'],
  ['fmdf<dkakrej', 'පොළොන්නරුව'],
  ['uOHia:dkh', 'මධ්‍යස්ථානය'],
  ['f;dard .ekSug n,mE jeo.;au', 'තෝරා ගැනීමට බලපෑ වැදගත්ම'],
  ['idOlh jQfhA', 'සාධකය වූයේ'],
  ['fpda, md,kh ksid', 'චෝල පාලනය නිසා'],
  ['wkqrdOmqrh úkdYhg m;aj', 'අනුරාධපුරය විනාශයට පත්ව'],
  ['jvd', 'වඩා'],
  ['iYS%l m%foaYhla ùuhs', 'සශ්‍රීක ප්‍රදේශයක් වීමයි'],
  ['bkaÈhdkq id.rfha ngysr', 'ඉන්දියානු සාගරයේ බටහිර'],
  ['mej;s wka;¾cd;sl fj<|dï kef.kysr', 'පැවති අන්තර්ජාතික වෙළඳාම් නැගෙනහිර'],
  ['l,dmhg udre ùu', 'කලාපයට මාරු වීම'],
  ['wdrlaIs; ia:dkhla', 'ආරක්ෂිත ස්ථානයක්'],
  // Instructions block and masthead
  ['ish¨ u ysñlï weúßKs', 'සියලු ම හිමිකම් ඇවිරිණි'],
  ['fojk jdr mÍlaIKh', 'දෙවන වාර පරීක්ෂණය'],
  ['fY%aKsh', 'ශ්‍රේණිය'],
  ['ku$ úNd. wxlh(', 'නම/ විභාග අංකය:'],
  ['ie,lsh hq;=hs (', 'සැලකිය යුතුයි :'],
  ['imhkak', 'සපයන්න'],
  ['isg 40 olajd', 'සිට 40 දක්වා'],
  ['ksjerÈ fyda jvd;a .e<fmk', 'නිවැරදි හෝ වඩාත් ගැළපෙන'],
  ['iemfhk ms<s;=re m;%fha', 'සැපයෙන පිළිතුරු පත්‍රයේ'],
  ['tla tla m%Yakh i|yd', 'එක් එක් ප්‍රශ්නය සඳහා'],
  ['lj w;=ßka', 'කව අතුරින්'],
  ['f;dard.;a ms<s;=frys wxlhg', 'තෝරාගත් පිළිතුරෙහි අංකයට'],
  ['ieif|k ljh ;=<', 'සැසඳෙන කවය තුළ'],
  [',l=K fhdokak', 'ලකුණ යොදන්න'],
];

/**
 * Pairs derived investigating a real user report of a PDF with a text layer
 * that produced nothing (a separate parser.ts bug, since fixed) and, on
 * other pages, "⟨?⟩" replacing real letters. Read against the rendered PDF
 * (its own embedded FM font, via PyMuPDF) and cross-checked against 2-4
 * independent, unrelated real words per byte before trusting any of them —
 * see lib/sinhala/legacy/maps/fmAbhaya.ts for the full per-byte trace.
 */
const grade10SinhalaGolden: [string, string][] = [
  ['l¿ wl=frka', 'කළු අකුරෙන්'], // "in bold BLACK letters" — confirms ¿
  ['l¿;r', 'කළුතර'], // Kalutara, the district — confirms ¿ again
  ['hd¿fjla', 'යාළුවෙක්'], // "a friend" — confirms ¿ a third time
  ['uqøs;', 'මුද්‍රිත'], // "printed" — confirms ø
  ['iuqøh', 'සමුද්‍රය'], // "the ocean" — confirms ø again
  ['tÈßùr irÉpkaø', 'එදිරිවීර සරත්චන්ද්‍ර'], // Ediriweera Sarathchandra — confirms É and ø together
  ['iqÿiq', 'සුදුසු'], // "suitable" — confirms ÿ
  ['isÿjkakla', 'සිදුවන්නක්'], // "something that occurs" — confirms ÿ again
  ['iqÿ ,m', 'සුදු ලප'], // "white spots" — confirms ÿ a third time
  ['Wu;=', 'උමතු'], // "insane" — confirms W
  ['Wla; mo folla yd wkqla; mo folla', 'උක්ත පද දෙකක් හා අනුක්ත පද දෙකක්'], // "two උක්ත words and two අනුක්ත words" — confirms W against its own grammatical antonym in the same sentence
  ['W.=r foig <x', 'උගුර දෙසට ළං'], // "towards the throat" — confirms W again
  ['i`oyd', 'සඳහා'], // "for" — confirms the `o -> ඳ ligature
  ['i`oyka', 'සඳහන්'], // "mentioned" — the SAME word as the existing i|yka
  //                        golden pair above, through the font's other ඳ byte
  ['u`. yeÍu', 'මඟ හැරීම'], // "to miss the mark" (idiom) — confirms `. -> ඟ
  ['zzl=re,a,dZZ hkak', '““කුරුල්ලා”” යන්න'], // the word "කුරුල්ලා" (bird) in doubled quotes — confirms z/Z
  ['lKaGP', 'කණ්ඨජ'], // "guttural" — one of a 4-term places-of-articulation list; confirms G, P
  ['uQ¾OP', 'මූර්ධජ'], // "retroflex" — confirms G, P again
  ['´IaGP', 'ඕෂ්ඨජ'], // "labial" — confirms G, P a third time, and confirms ´
  [';d¨P', 'තාලුජ'], // "palatal" — confirms P a fourth time
  ['mdGh', 'පාඨය'], // "the lesson/text" — confirms G independently of the list above
  ['ióm', 'සමීප'], // "near/close" — confirms ó
  ['fiakl ììf,a', 'සේනක බිබිලේ'], // Dr. Senaka Bibile — confirms ì
  ['Yío', 'ශබ්ද'], // "sound" — confirms í
  [',efí', 'ලැබේ'], // "is awarded" ("ලකුණු 40ක් ලැබේ") — confirms í again
  ['wCIr', 'අක්ෂර'], // "letters" — confirms C
  ['wdrCIl', 'ආරක්ෂක'], // "protective" — confirms C again
  ['/iaùug', 'රැස්වීමට'], // "to assemble" — confirms /
  ['T!IO', 'ඖෂධ'], // "medicine" — confirms the T! ligature (and, via the
  //                    same word, backs up `o and `. above)
  ['fi!kao¾hfhka', 'සෞන්දර්යයෙන්'], // "by [natural] beauty" — confirms the
  //                                    standalone ! -> ෟ reading
  ['^w&" ^wd&" ^b&" ^B&', '(අ), (ආ), (ඉ), (ඊ)'], // the independent-vowel
  //                                                 listing order — confirms B
  ['my; ±lafjk', 'පහත දක්වෙන'], // "shown below" — confirms ±
  ['¥m;aj,', 'දූපත්වල'], // "of the islands" — confirms ¥
  ['¥Ilfhl=', 'දූෂකයෙකු'], // "a corrupter" — confirms ¥ again
  ['m%;sM,', 'ප්‍රතිඵල'], // "results" — confirms M
  ['ksIaM,', 'නිෂ්ඵල'], // "futile" — confirms M again
  ['f,aLlhd', 'ලේඛකයා'], // "the writer" — confirms L
  ['m%uqL;ajh', 'ප්‍රමුඛත්වය'], // "prominence" — confirms L again
  ['oË;d', 'දක්ෂතා'], // "skill" — confirms Ë
  ['mÍËKh', 'පරීක්ෂණය'], // "examination" (this paper's own title) — confirms Ë again
  ['úfÊr;ak', 'විජේරත්න'], // a common Sri Lankan surname (Wijeratne), appearing twice — confirms Ê
  ['Èks`ÿf.a', 'දිනිඳුගේ'], // "Dinindu's" — confirms the `ÿ -> ඳු nasalization ligature, read directly off the rendered glyph
  ['lem ù isàu', 'කැප වී සිටීම'], // "being devoted" — confirms à
  ['W;a;r fkd§ isàu', 'උත්තර නොදී සිටීම'], // "remaining without answering" — confirms à again
];

describe('convertLegacy / FM Abhaya', () => {
  for (const [legacy, unicode] of [...golden, ...planGolden, ...derivedGolden, ...grade10SinhalaGolden]) {
    it(`converts ${legacy}`, () => {
      expect(convertLegacy(legacy, FM_ABHAYA).text).toBe(unicode);
    });
  }

  it('moves the prefix vowel after its consonant', () => {
    // `f` is ෙ, stored BEFORE its consonant in legacy order
    expect(convertLegacy('f;dr;=re', FM_ABHAYA).text.startsWith('තො')).toBe(true);
  });

  it('prefers the longer token when two tokens share a prefix', () => {
    // `da` must beat `d`: f;da => තෝ, not තො + ්
    expect(convertLegacy('f;da', FM_ABHAYA).text).toBe('තෝ');
  });

  it('counts unmapped codes instead of dropping them', () => {
    const r = convertLegacy('', FM_ABHAYA);
    expect(r.unmapped).toBe(2);
    expect(r.text).toBe('⟨?⟩⟨?⟩');
  });

  it('passes ASCII digits through unchanged', () => {
    expect(convertLegacy('01', FM_ABHAYA).text).toBe('01');
    expect(convertLegacy('01', FM_ABHAYA).unmapped).toBe(0);
  });

  /**
   * The real-world bug: FM fonts encode Sinhala onto ASCII bytes, so an
   * unmapped ASCII byte is the COMMON failure mode, not an edge case. It
   * used to pass through verbatim with unmapped=0, which made a missing
   * font table silently produce Sinhala-Latin gibberish instead of raising
   * the 'unmapped-glyph' flag the spec designed for exactly this.
   */
  describe('unmapped ASCII in the legacy range', () => {
    // '\x01' (a control byte no legacy map ever assigns) stands in for "any
    // byte with no token" here. 'Z' filled this role until it was confirmed
    // to be the closing curly quote (see the golden pairs above) — a real
    // token, so it can no longer demonstrate an unmapped gap.
    it('counts an ASCII byte that has no token instead of passing it through', () => {
      const r = convertLegacy('\x01', FM_ABHAYA);
      expect(r.unmapped).toBe(1);
      expect(r.text).toBe('⟨?⟩');
    });

    it('counts unmapped bytes mixed into otherwise-convertible text', () => {
      const r = convertLegacy('b;s\x01ydih', FM_ABHAYA);
      expect(r.unmapped).toBe(1);
      expect(r.text).toContain('⟨?⟩');
    });

    it('keeps digits, spaces and the dash silent — they are real passthrough', () => {
      const r = convertLegacy('01 - 2025', FM_ABHAYA);
      expect(r.unmapped).toBe(0);
      expect(r.text).toBe('01 - 2025');
    });
  });
});
