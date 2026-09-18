# Sinhala Past-Paper MCQ Extraction — Design

Date: 2026-09-18
Status: Approved for planning

## Problem

Sinhala-language past papers are distributed as PDFs. Building a question bank
from them is currently manual retyping. This tool extracts multiple-choice
questions — stem, four options, and the correct answer — from an uploaded paper
and exports them as a spreadsheet.

All processing happens in the browser. No server, no database, no account.

## Source Analysis

Findings from the reference paper (`GRADE 11 - HISTORY.pdf`, 14 pages), which
drive every decision below.

### The paper is not a scan

Every page carries a real text layer. Pages 9 and 10 are near-empty
(image-only answer-space pages); the rest extract cleanly. Running OCR over
this would replace exact text with guesses.

### The text layer is legacy-encoded

Embedded fonts are `FMAbhaya`, `FMEmanee`, `FMGanganee`, `FMSamantha`,
`FMDeranax`, and `FMAbabld` — legacy Sinhala fonts that map Sinhala glyphs onto
Latin code points. Raw extraction yields `01' Y%S ,xldj`, which is
`01. ශ්‍රී ලංකාව`. Recovering Unicode is a deterministic transliteration, not
recognition.

Two properties make it harder than a lookup table:

- **Prefix vowels are stored before their consonant.** `f` is `ෙ`, typed first
  in legacy order, and must be moved after the consonant in Unicode.
- **One Unicode vowel has several legacy codes**, selected by the base
  consonant's shape. `;=` is `තු` but `re` is `රු` — both are `ු`.

Worked example: `f;dr;=re` → `තොරතුරු`.

### Roughly half of each page is watermark

48% of page 1's text items are a diagonal watermark —
`jhU m<d;a wOHdmk fomd¾;fïka;=j` and `Provincial Department of Education - NWP`,
eleven copies each, set in `FMDeranax`. These interleave with real content by
y-position and would corrupt line grouping, so they are removed before lines
are formed.

Repetition alone cannot be the test: the option markers `^1&`–`^4&` each appear
seven times on page 1 and are legitimate content. The filter therefore applies
only to runs above a minimum length.

### Question structure is regular

Questions follow `NN` + stem + `^1& ^2& ^3& ^4&`. In FM encoding `^` and `&`
are the Sinhala parenthesis glyphs, so after conversion the option markers are
`(1)`–`(4)` and the digits remain Latin.

### Three question shapes exist

- **Straight** — stem plus four self-contained Sinhala options. Q1–7, Q9–15.
- **Special** — options are bare A–D tokens. Q8 is a column I↔II match with
  options `A C B`, `B A D`; Q16 is a "which two statements" with options
  `A යා C`. Their A–D content lives in a separate table that extracts out of
  reading order.
- **Figure** — the stem references a map, diagram, or table image. Text
  extracts correctly but the question is incomplete without the picture.

### The answer key has an ordering trap

On page 11 the answer digits extract in the order
`3 2 1 3 2 4 3 3 1 4 / 2 4 4 1 2 3 2 1 4 2 / …` while the question numbers
extract as `1 11 21 31 / 2 12 22 32 / …`. The two grids use different
traversal orders. Pairing them by text order produces a wrong answer key with
no error raised. Pairing must be geometric.

The rows are also not a uniform grid. Four distinct patterns occur on the one
page: answers sitting 1pt below their labels, labels and answers interleaved
within a single y band, and answers sitting 1pt *above* their labels. Any
algorithm that assumes a fixed row shape will break.

What is regular is the horizontal relationship: every answer sits roughly 24pt
to the right of its label, within 1pt of the same y. That is the signal to pair
on.

Page 11 also carries Part II answers as prose. These are out of scope.

## Decisions

| Decision | Choice |
|---|---|
| Extraction engine | Text layer first; Tesseract.js only for image-only pages and uploaded images |
| Question buckets | Straight / Special / Figure |
| Excel column 4 | Number and text, e.g. `3. මණිමේඛලයි` |
| Exported rows | Straight questions only |
| Session lifetime | Survives refresh; ends on tab close or explicit New Session |
| App shape | Linear wizard for setup, two-pane workspace for review |

## Architecture

Next.js 15 App Router in static-export mode (`output: 'export'`). Static export
means there is no server route to send data to — the privacy requirement is
structural rather than conventional.

TypeScript, Tailwind v4, `pdfjs-dist`, `tesseract.js`, `zustand` + `idb`,
ExcelJS. ExcelJS is chosen over SheetJS because SheetJS no longer publishes to
the npm registry; ExcelJS handles UTF-8 Sinhala and Blob output.

Heavy work runs in Web Workers — pdf.js and Tesseract supply their own, and the
parse pass gets a third — so a 40-question paper never blocks the UI.

### Module chain

The pipeline is pure functions with I/O confined to the ends. The converter and
parser are therefore testable without a browser, a PDF, or mocks.

```
PDF/image bytes
  │
  ├─ pdf/loader.ts ─────── pdf.js wrapper: page count, render to canvas
  ├─ pdf/textLayer.ts ──── positioned items {str, x, y, w, h, fontFamily}
  │
  ├─ sinhala/legacy/
  │     maps/*.ts           one token→Unicode table per FM font
  │     detectFont.ts       fontFamily → map, FM-standard fallback
  │     convert.ts          tokenize → map → reorder → normalize
  │
  ├─ ocr/tesseract.ts ──── lazy worker, `sin` traineddata
  │
  ├─ extract/watermark.ts  drop repeated long runs before grouping
  ├─ extract/lines.ts ──── y-cluster into lines, detect columns
  ├─ extract/parser.ts ─── line stream → RawQuestion[]
  ├─ extract/classify.ts ─ Straight | Special | Figure
  ├─ extract/answerKey.ts  geometric grid pairing
  │
  ├─ session/store.ts ──── zustand + IndexedDB
  └─ export/xlsx.ts ────── ExcelJS → Blob → download
```

### Convert before parsing

Conversion runs before parsing, so the parser consumes Unicode with `(1)`–`(4)`
markers. The same parser then works on text-layer output and OCR output
without branching.

### The converter is a four-stage pipeline

1. Longest-match tokenize against the active font's table
2. Map tokens to Unicode pieces
3. Reorder prefix vowels after their consonant
4. Normalize combining forms — `ෙ`+`ා` → `ො`, rakaransaya, yansaya, repaya

`detectFont.ts` selects the table from the PDF's real font name. That name is
**not** available from `textContent.styles[fontName].fontFamily`, which returns
only the CSS generic `sans-serif` or `serif`. It must be read from
`page.commonObjs.get(item.fontName).name`, which yields `XSUOWA+FMAbhayax` —
and `await page.getOperatorList()` must run first, or `commonObjs` is empty and
every font resolves to an internal id such as `g_d0_f1`. The six-character
subset prefix is stripped before lookup.

Because the reference paper alone uses six FM fonts, this selection is
load-bearing; unknown `FM*` fonts fall back to the FM-standard layout, and
non-FM fonts return `null` so Latin text passes through unconverted.

Unmapped codes emit `⟨?⟩` and set an `unmapped-glyph` flag on the question, so
an incorrect or missing font table is visible rather than silent.

### Answer key extraction

`answerKey.ts` collects bare-integer items with their coordinates, clusters
them into a grid by position, and pairs each `1`–`40` label with the answer
digit nearest it within the same cell. It returns the mapping, a per-entry
confidence, and an `unresolved[]` list.

The algorithm must **not** assume a grid orientation. The reference paper's
label and digit runs extract in different traversal orders, so whether the
table is 4 rows × 10 columns or 10 × 4 is inferred from the clustered
coordinates, not hardcoded. Any unresolved entry, or a grid that does not
resolve to exactly 40 label cells, blocks export until reviewed.

### Classification rules

- **Special** — an option's text is only A–D tokens (`A යා C`, `B A D`), or the
  option count is not 4, or the stem contains an A/B/C/D enumeration block.
- **Figure** — the question's bounding box overlaps an embedded image, or the
  stem contains a figure reference (`රූපය`, `සිතියම`, `වගුව`).
- **Straight** — everything else.

## Data Model

```ts
type OptionIndex = 1 | 2 | 3 | 4;

interface Question {
  id: string;
  number: number;
  pageIndex: number;
  bbox: BBox;                 // drives the side-by-side highlight
  stem: string;               // Unicode Sinhala, editable
  options: string[];          // 4 entries for Straight
  kind: 'straight' | 'special' | 'figure';
  flags: ('ocr' | 'low-confidence' | 'unmapped-glyph')[];
  correctAnswer: OptionIndex | null;
  rawLegacy: string;          // retained for diffing against the source
  edited: boolean;
}

interface Session {
  id: string;
  createdAt: number;
  source: { kind: 'pdf' | 'images'; name: string; bytes: Blob };
  questionPages: number[];
  answerPage: number | null;
  questions: Question[];
  answerKey: Record<number, OptionIndex>;
  answerKeyUnresolved: number[];
  step: 1 | 2 | 3 | 4;
}
```

`rawLegacy` is retained deliberately: it makes a conversion bug diagnosable
after the fact instead of a mystery.

## Session Persistence

`sessionStorage` holds only a `sessionId`. IndexedDB holds the source Blob,
page render cache, and extracted rows, keyed by that ID.

`sessionStorage` is per-tab and cleared on tab close, which gives the required
lifetime directly. On load the app reads the ID; if it is missing — new tab,
closed tab, or first visit — it mints a new one and deletes every orphaned
IndexedDB record. A refresh keeps the ID and restores the step, edits, and
scroll position. "New Session" clears both and reloads.

Every read and write is wrapped in try/catch and the app renders correctly when
storage is unavailable, such as in a private window with site data blocked.

## Screens

1. **Upload** — a single dropzone accepting one PDF or a set of JPG/PNG files.
2. **Question pages** — thumbnail grid with multi-select and range-select. Pages
   containing `(1)`–`(4)` patterns are pre-ticked as a suggestion; the user
   confirms. The suggestion never decides alone.
3. **Answer sheet page** — the same grid, single-select, suggesting the page
   dominated by bare digits. An explicit "this paper has no answer sheet"
   option leaves column 4 empty rather than blocking progress.
4. **Review workspace** — the left pane renders the original page with the
   active question's bbox highlighted. The right pane has four tabs:
   Straight (n), Special (n), Figure (n), Answer key (n). Selecting a row
   scrolls and highlights its source. All fields are editable. The answer key
   tab is a 40-cell grid with unresolved cells marked.

A persistent export bar carries the Export button, disabled with a stated
reason whenever the answer key has unresolved entries.

## Export

A single sheet, one row per Straight question, ordered by question number, with
a header row. Four columns:

| Column | Header | Contents |
|---|---|---|
| 1 | Full Question | Stem, then a newline, then the four options each on its own line as `(n) text` |
| 2 | Question | Stem only, with no number prefix |
| 3 | Answers | The four options, each on its own line as `(n) text` |
| 4 | Correct Answer | Number and text, e.g. `3. මණිමේඛලයි` |

Newlines are literal `\n` within a cell, with wrap-text enabled on columns 1
and 3.

When the user selected "this paper has no answer sheet", column 4 is written as
an empty string for every row and export is not blocked.

Special and Figure questions are on-screen reference only and are not
exported.

## Theme

White `#FFFFFF`, near-black `#0A0A0A`, a single hairline `#E5E5E5` for
structure. Selection is a black fill with white text; there is no second accent
colour.

Noto Sans Sinhala is self-hosted rather than loaded from the Google CDN, which
would otherwise introduce a network call. Sinhala line-height is `1.8`;
tall stacked glyphs are hard to proofread at tighter leading. Latin text uses
Inter.

## Testing

The reference paper is committed to `test/fixtures/` alongside a hand-verified
`golden.json` covering Q1–16 — which spans all three buckets — and the full
40-entry answer key.

- **Converter** — table-driven per font, explicitly covering the reorder case
  (`f;dr;=re` → `තොරතුරු`) and the multi-code vowel case (`;=` → `තු` versus
  `re` → `රු`).
- **Parser and classifier** — golden questions, asserting that Q8 and Q16 land
  in Special.
- **Answer key** — the real page 11 item list, asserting the exact 40 values,
  plus a regression test asserting that naive text-order pairing fails on it.
- **End-to-end** — Playwright covering upload → page selection → extraction →
  edit → export, and a refresh mid-session that restores state.

Development follows TDD: tests are written before the implementation they
cover.

## Risks

| Risk | Mitigation |
|---|---|
| Only FMAbhaya's map is well documented; the reference paper uses six FM fonts | FM-standard fallback, plus `⟨?⟩` rendering and an `unmapped-glyph` flag so a bad table is loud |
| Tesseract Sinhala accuracy is weak | OCR output is never auto-trusted — always badged and routed through review |
| Stems wrap across lines; options sit in 2 or 4 columns per line | `lines.ts` handles wrap-joining and column splitting, covered by golden tests |
| `sin.traineddata` is roughly 10MB | Tesseract and its data load lazily, only when an image page is encountered |

## Non-Goals

- Part II and Part III structured (non-MCQ) questions
- Batch processing of multiple papers in one session
- Any server, database, authentication, or account
- Importing an answer key from a separate file
