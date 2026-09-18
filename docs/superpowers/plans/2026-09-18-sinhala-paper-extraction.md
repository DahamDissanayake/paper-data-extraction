# Sinhala Past-Paper MCQ Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully client-side Next.js web app that extracts MCQ questions, options, and correct answers from Sinhala past-paper PDFs and exports them to Excel.

**Architecture:** A linear wizard (upload → select question pages → select answer page) feeding a two-pane review workspace. The extraction pipeline is a chain of pure functions — legacy-font transliteration, line grouping, question parsing, classification, geometric answer-key pairing — with I/O confined to a pdf.js adapter at the front and an ExcelJS writer at the back. Nothing leaves the browser.

**Tech Stack:** Next.js 15 (App Router, `output: 'export'`), TypeScript, Tailwind v4, `pdfjs-dist` 4.x, `tesseract.js`, `zustand`, `idb`, `exceljs`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-sinhala-paper-extraction-design.md`

## Global Constraints

- **No server, ever.** `next.config.ts` sets `output: 'export'`. No API routes, no server actions, no `fetch` to any external host at runtime. A task that needs a network call is wrong.
- **No fonts from CDNs.** Noto Sans Sinhala and Inter are self-hosted under `public/fonts/`.
- **Theme:** background `#FFFFFF`, text `#0A0A0A`, hairline borders `#E5E5E5`, selection = black fill + white text. No second accent colour.
- **Sinhala line-height is `1.8`.** Tall stacked glyphs are unreadable at tighter leading.
- **All Sinhala-bearing UI uses `font-sinhala`** (Noto Sans Sinhala), never a system fallback.
- **TDD is mandatory.** Every task writes the failing test first, runs it to confirm it fails, then implements.
- **Pure logic in `lib/` must not import React, `next/*`, or touch `window`.** This is what keeps it testable in Vitest under Node.
- **Never convert non-FM fonts.** Latin runs (TimesNewRoman, Swiss721BT) pass through unchanged.

## Verified Source Facts

These were measured from the reference paper during design. Do not re-derive them; do not "correct" them from intuition.

- The PDF has a real text layer in legacy FM encoding. It is **not** a scan.
- Page 1 fonts resolve to `FMAbhayax`, `FMSamanthax`, `FMAbabldBold`, `FMDeranax`, `FMGanganeex`, plus Latin `TimesNewRomanPSMT`, `Swiss721BT-Roman`, `Swiss721BT-Bold`.
- **48% of page 1 text items are a diagonal watermark** — `jhU m<d;a wOHdmk fomd¾;fïka;=j` and `Provincial Department of Education - NWP`, 11 copies each, set in **FMDeranax**.
- Option markers `^1& ^2& ^3& ^4&` appear exactly 7 times each on page 1, matching its 7 questions. After conversion these read `(1)`–`(4)`.
- Answer key page (page 11, index 10) contains exactly **80 pure-integer text items**: 40 labels + 40 answers.
- Label x-columns: `60.9, 106.6, 154.8, 202.9, 251.1, 299.3, 347.5, 395.6, 443.8, 492.0`
- Answer x-columns: `84.6, 132.6, 181.4, 229.8, 276.7, 325.6, 373.9, 420.9, 471.1, 517.2`
- Each answer sits **~+24pt right of its label, within ±1pt of y**.
- Row layout is **not** a uniform grid. Four distinct patterns occur: answers 1pt below labels (y 714/713), labels and answers interleaved in one y band (y 699 and y 684), and answers 1pt **above** labels (y 670/669).
- **Naive text-order pairing differs from the correct key on 23 of 40 questions.** This is the single most dangerous silent failure in the project.

### The verified answer key for the reference paper

```
 1:3   2:2   3:1   4:3   5:2   6:4   7:3   8:3   9:1  10:4
11:2  12:4  13:4  14:1  15:2  16:3  17:2  18:1  19:4  20:2
21:1  22:3  23:4  24:4  25:2  26:3  27:4  28:1  29:2  30:1
31:1  32:2  33:3  34:1  35:4  36:1  37:3  38:2  39:4  40:4
```

### Golden word pairs for the transliterator

These are verified at word level from surrounding context and the paper's own English subtitles. **Per-character mappings must be derived to satisfy these tests — not asserted from memory.** An attempt to build the character table by hand produced a contradiction (`ksjerÈ` requires `e` = `ැ` while `ms<s;=re` requires `e` = `ු`), which means intuition about individual codes is unreliable here. Let the tests drive the table.

| Legacy | Unicode | Evidence |
|---|---|---|
| `b;sydih` | `ඉතිහාසය` | subject name, printed beside English "History" |
| `Y%S ,xldj` | `ශ්‍රී ලංකාව` | "Sri Lanka", Q1 stem |
| `wxl` | `අංක` | "number", instructions block |
| `m%Yak` | `ප්‍රශ්න` | "questions", instructions block |
| `ms<s;=re` | `පිළිතුරු` | "answers", instructions block |
| `f;darkak` | `තෝරන්න` | "choose", instructions block |
| `f;dr;=re` | `තොරතුරු` | "information", Q1 stem |
| `ld,h meh 01 hs` | `කාලය පැය 01 යි` | printed beside English "Time: 01 hour" |
| `jhU m<d;a wOHdmk fomd¾;fïka;=j` | `වයඹ පළාත් අධ්‍යාපන දෙපාර්තමේන්තුව` | printed beside English "Provincial Department of Education - NWP" |

## File Structure

```
app/
  layout.tsx                    root layout, fonts, theme tokens
  page.tsx                      wizard host, routes by session.step
  globals.css                   Tailwind v4 theme + font faces
components/
  ui/                           Button, Tabs, Checkbox, Field — dumb primitives
  wizard/UploadStep.tsx         step 1
  wizard/PageSelectStep.tsx     step 2
  wizard/AnswerPageStep.tsx     step 3
  wizard/StepShell.tsx          shared chrome: title, back/next, progress
  review/ReviewWorkspace.tsx    step 4 two-pane host + tabs
  review/PagePane.tsx           canvas render + bbox highlight
  review/QuestionCard.tsx       editable stem + 4 options + answer radio
  review/AnswerKeyGrid.tsx      40-cell editable grid
  review/ExportBar.tsx          export button + blocking reason
lib/
  types.ts                      Question, Session, PositionedItem, Line
  pdf/loader.ts                 pdf.js document handle, page render
  pdf/textLayer.ts              positioned items + resolved font names
  sinhala/legacy/maps/fmAbhaya.ts   token → Unicode table
  sinhala/legacy/maps/index.ts      font name → table registry
  sinhala/legacy/detectFont.ts      subset-prefix strip, FM detection
  sinhala/legacy/convert.ts         tokenize → map → reorder → normalize
  ocr/tesseract.ts              lazy worker wrapper
  extract/watermark.ts          repeated-run filter
  extract/lines.ts              y-cluster into lines, column split
  extract/parser.ts             line stream → RawQuestion[]
  extract/classify.ts           Straight | Special | Figure
  extract/answerKey.ts          geometric label↔answer pairing
  session/idb.ts                IndexedDB open/get/put/deleteAllExcept
  session/store.ts              zustand store + persistence
  export/xlsx.ts                ExcelJS workbook builder
test/
  fixtures/GRADE-11-HISTORY.pdf
  fixtures/pg1.items.json
  fixtures/pg11.items.json
  fixtures/golden.json
  tools/dump-fixtures.mjs
```

---

### Task 1: Project scaffold, theme, and test harness

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `lib/types.ts`
- Create: `public/fonts/` (NotoSansSinhala-Regular.woff2, NotoSansSinhala-Bold.woff2, Inter-Variable.woff2)
- Test: `test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `lib/types.ts` exporting `OptionIndex`, `BBox`, `PositionedItem`, `Line`, `QuestionKind`, `QuestionFlag`, `Question`, `Session`. Every later task imports from here.

- [ ] **Step 1: Scaffold the app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --use-npm --yes
npm install pdfjs-dist@^4.10 tesseract.js@^5 zustand@^5 idb@^8 exceljs@^4
npm install -D vitest@^2 @vitest/coverage-v8 jsdom @playwright/test
```

- [ ] **Step 2: Force static export**

Replace `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // pdfjs ships a worker that must not be bundled through webpack's node polyfills
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Write the shared types**

Create `lib/types.ts`:

```ts
export type OptionIndex = 1 | 2 | 3 | 4;

export interface BBox { x: number; y: number; w: number; h: number; }

export interface PositionedItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Resolved PDF font name with subset prefix stripped, e.g. "FMAbhayax". */
  font: string;
}

export interface Line {
  text: string;            // Unicode, already transliterated
  items: PositionedItem[];
  y: number;
  bbox: BBox;
  source: 'text' | 'ocr';
}

export type QuestionKind = 'straight' | 'special' | 'figure';
export type QuestionFlag = 'ocr' | 'low-confidence' | 'unmapped-glyph';

export interface Question {
  id: string;
  number: number;
  pageIndex: number;
  bbox: BBox;
  stem: string;
  options: string[];
  kind: QuestionKind;
  flags: QuestionFlag[];
  correctAnswer: OptionIndex | null;
  rawLegacy: string;
  edited: boolean;
}

export interface Session {
  id: string;
  createdAt: number;
  sourceName: string;
  sourceKind: 'pdf' | 'images';
  questionPages: number[];
  answerPage: number | null;
  hasNoAnswerSheet: boolean;
  questions: Question[];
  answerKey: Record<number, OptionIndex>;
  answerKeyUnresolved: number[];
  step: 1 | 2 | 3 | 4;
}
```

- [ ] **Step 5: Theme and fonts**

Download Noto Sans Sinhala and Inter woff2 files into `public/fonts/`. Replace `app/globals.css`:

```css
@import "tailwindcss";

@font-face {
  font-family: 'Noto Sans Sinhala';
  src: url('/fonts/NotoSansSinhala-Regular.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}
@font-face {
  font-family: 'Noto Sans Sinhala';
  src: url('/fonts/NotoSansSinhala-Bold.woff2') format('woff2');
  font-weight: 700; font-display: swap;
}
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
  font-weight: 100 900; font-display: swap;
}

@theme {
  --color-page: #FFFFFF;
  --color-ink: #0A0A0A;
  --color-hairline: #E5E5E5;
  --font-sinhala: 'Noto Sans Sinhala', sans-serif;
  --font-sans: 'Inter', system-ui, sans-serif;
}

html, body { background: var(--color-page); color: var(--color-ink); }
.sinhala { font-family: var(--font-sinhala); line-height: 1.8; }
```

- [ ] **Step 6: Write the smoke test**

Create `test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Question } from '@/lib/types';

describe('scaffold', () => {
  it('exposes the shared Question type', () => {
    const q: Question = {
      id: 'q1', number: 1, pageIndex: 0,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      stem: '', options: [], kind: 'straight', flags: [],
      correctAnswer: null, rawLegacy: '', edited: false,
    };
    expect(q.number).toBe(1);
  });
});
```

- [ ] **Step 7: Verify build and tests**

Run: `npm run build && npm test`
Expected: build succeeds and emits `out/`; 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold static-export Next.js app with theme and test harness"
```

---

### Task 2: FM → Unicode transliteration core

This is the highest-risk task in the project. The character table is **derived from the tests**, not written from memory.

**Files:**
- Create: `lib/sinhala/legacy/maps/fmAbhaya.ts`
- Create: `lib/sinhala/legacy/convert.ts`
- Test: `test/sinhala/convert.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export interface LegacyMap { tokens: Record<string, string>; maxTokenLength: number; }`
  - `export const FM_ABHAYA: LegacyMap`
  - `export function convertLegacy(input: string, map: LegacyMap): { text: string; unmapped: number }`

- [ ] **Step 1: Write the failing golden test**

Create `test/sinhala/convert.test.ts`:

```ts
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
];

describe('convertLegacy / FM Abhaya', () => {
  for (const [legacy, unicode] of golden) {
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
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/sinhala/convert.test.ts`
Expected: FAIL — cannot resolve `@/lib/sinhala/legacy/convert`.

- [ ] **Step 3: Implement the four-stage converter**

Create `lib/sinhala/legacy/convert.ts`:

```ts
export interface LegacyMap {
  /** Legacy byte sequence → Unicode fragment. Longest match wins. */
  tokens: Record<string, string>;
  maxTokenLength: number;
}

/** Vowel signs that are stored BEFORE their consonant in legacy order. */
const PREFIX_VOWELS = new Set(['ෙ', 'ේ', 'ෛ']);

/** ෙ + ා → ො, ෙ + ෟ → ෞ, and the ේ/ෝ pairs. */
const COMBINE: Record<string, string> = {
  'ො': 'ො', // ෙ + ා = ො
  'ෞ': 'ෞ', // ෙ + ෟ = ෞ
  'ේා': 'ෝ', // ේ + ා = ෝ
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
  return { text, unmapped };
}
```

- [ ] **Step 4: Derive the character table against the golden tests**

Create `lib/sinhala/legacy/maps/fmAbhaya.ts` with the shape below, then **iterate**: run the test, read the diff between actual and expected, add or correct the token that explains the difference, re-run. Add multi-character tokens (`da`, `%`, `H`) before single-character ones — `maxTokenLength` must be at least the longest key.

```ts
import type { LegacyMap } from '../convert';

const tokens: Record<string, string> = {
  // Derive these from the golden tests. Start from the pairs below, which are
  // implied directly by `b;sydih` → ඉතිහාසය and `wxl` → අංක, then extend.
  'b': 'ඉ',        // ඉ
  'w': 'අ',        // අ
  'x': 'ං',        // ං
  'l': 'ක',        // ක
  ';': 'ත',        // ත
  'y': 'හ',        // හ
  'i': 'ස',        // ස
  'h': 'ය',        // ය
  's': 'ි',        // ි
  'd': 'ා',        // ා
  // ... continue until every golden test passes
};

export const FM_ABHAYA: LegacyMap = {
  tokens,
  maxTokenLength: Math.max(...Object.keys(tokens).map((k) => k.length)),
};
```

- [ ] **Step 5: Run tests until all golden pairs pass**

Run: `npx vitest run test/sinhala/convert.test.ts`
Expected: PASS, all cases.

If a golden pair cannot be satisfied without breaking another, the two words use different FM fonts — check the `font` field in `test/fixtures/pg1.items.json` (created in Task 4) and move the conflicting pair to its own map in Task 3. Do not force one table to serve both.

- [ ] **Step 6: Commit**

```bash
git add lib/sinhala test/sinhala
git commit -m "feat: FM Abhaya legacy-to-Unicode transliterator with golden tests"
```

---

### Task 3: Font detection and multi-font dispatch

**Files:**
- Create: `lib/sinhala/legacy/detectFont.ts`
- Create: `lib/sinhala/legacy/maps/index.ts`
- Test: `test/sinhala/detectFont.test.ts`

**Interfaces:**
- Consumes: `LegacyMap`, `FM_ABHAYA` from Task 2
- Produces:
  - `export function stripSubsetPrefix(name: string): string`
  - `export function mapForFont(fontName: string): LegacyMap | null` — `null` means "not a legacy font, pass through unchanged"
  - `export function transliterateItem(str: string, fontName: string): { text: string; unmapped: number }`

- [ ] **Step 1: Write the failing test**

Create `test/sinhala/detectFont.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stripSubsetPrefix, mapForFont, transliterateItem } from '@/lib/sinhala/legacy/detectFont';

describe('stripSubsetPrefix', () => {
  it('removes a six-character subset prefix', () => {
    expect(stripSubsetPrefix('XSUOWA+FMAbhayax')).toBe('FMAbhayax');
  });
  it('leaves an unprefixed name alone', () => {
    expect(stripSubsetPrefix('FMAbhayax')).toBe('FMAbhayax');
  });
});

describe('mapForFont', () => {
  it.each(['XSUOWA+FMAbhayax', 'NJALQY+FMSamanthax', 'PADNAV+FMGanganeex',
           'IRSKNS+FMDeranax', 'WSZVOB+FMAbabldBold'])('recognises %s as legacy', (f) => {
    expect(mapForFont(f)).not.toBeNull();
  });

  it.each(['BQCOZL+TimesNewRomanPSMT', 'EDJBMJ+Swiss721BT-Roman', 'RWTBLA+Swiss721BT-Bold'])(
    'returns null for Latin font %s', (f) => {
      expect(mapForFont(f)).toBeNull();
    });
});

describe('transliterateItem', () => {
  it('converts legacy text', () => {
    expect(transliterateItem('b;sydih', 'XSUOWA+FMAbhayax').text).toBe('ඉතිහාසය');
  });

  it('passes Latin text through untouched', () => {
    const s = 'Provincial Department of Education - NWP';
    expect(transliterateItem(s, 'EDJBMJ+Swiss721BT-Roman').text).toBe(s);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/sinhala/detectFont.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement detection**

Create `lib/sinhala/legacy/maps/index.ts`:

```ts
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
```

Create `lib/sinhala/legacy/detectFont.ts`:

```ts
import type { LegacyMap } from './convert';
import { convertLegacy } from './convert';
import { FONT_MAPS, FM_FALLBACK } from './maps';

/** PDF subset prefixes look like "XSUOWA+". */
export function stripSubsetPrefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '');
}

export function mapForFont(fontName: string): LegacyMap | null {
  const bare = stripSubsetPrefix(fontName);
  if (FONT_MAPS[bare]) return FONT_MAPS[bare];
  // Unknown FM-family font: fall back rather than emit garbage.
  if (/^FM/i.test(bare)) return FM_FALLBACK;
  return null;
}

export function transliterateItem(str: string, fontName: string): { text: string; unmapped: number } {
  const map = mapForFont(fontName);
  if (!map) return { text: str, unmapped: 0 };
  return convertLegacy(str, map);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/sinhala/detectFont.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/sinhala test/sinhala
git commit -m "feat: FM font detection with Latin passthrough and family fallback"
```

---

### Task 4: pdf.js text-layer adapter and fixture generation

**Files:**
- Create: `lib/pdf/loader.ts`
- Create: `lib/pdf/textLayer.ts`
- Create: `test/tools/dump-fixtures.mjs`
- Create: `test/fixtures/GRADE-11-HISTORY.pdf` (copy the reference paper here)
- Test: `test/pdf/textLayer.test.ts`

**Interfaces:**
- Consumes: `PositionedItem` from Task 1
- Produces:
  - `export async function loadDocument(data: ArrayBuffer): Promise<PDFDocumentProxy>`
  - `export async function renderPageToCanvas(doc, pageIndex, scale, canvas): Promise<void>`
  - `export async function getPositionedItems(doc, pageIndex): Promise<PositionedItem[]>`

- [ ] **Step 1: Write the fixture dumper**

Create `test/tools/dump-fixtures.mjs`. This runs under Node and writes the JSON the pure tests consume, so those tests never need pdf.js.

```js
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PDF = 'test/fixtures/GRADE-11-HISTORY.pdf';
const data = new Uint8Array(fs.readFileSync(PDF));
const doc = await pdfjs.getDocument({ data }).promise;

for (const pageNo of [1, 11]) {
  const page = await doc.getPage(pageNo);
  await page.getOperatorList();               // REQUIRED before commonObjs is populated
  const tc = await page.getTextContent();
  const items = tc.items
    .filter((i) => i.str.trim())
    .map((i) => {
      let font = i.fontName;
      try { font = page.commonObjs.get(i.fontName)?.name ?? i.fontName; } catch {}
      return {
        str: i.str,
        x: +i.transform[4].toFixed(1),
        y: +i.transform[5].toFixed(1),
        w: +i.width.toFixed(1),
        h: +i.height.toFixed(1),
        font,
      };
    });
  const out = path.join('test/fixtures', `pg${pageNo}.items.json`);
  fs.writeFileSync(out, JSON.stringify(items, null, 0), 'utf8');
  console.log(out, items.length, 'items');
}
```

Add script: `"fixtures": "node test/tools/dump-fixtures.mjs"`.

- [ ] **Step 2: Write the failing test**

Create `test/pdf/textLayer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

describe('fixtures carry resolved font names', () => {
  it('resolves real PDF font names, not sans-serif', () => {
    const fonts = new Set(pg1.map((i) => i.font));
    expect([...fonts].some((f) => f.includes('FMAbhaya'))).toBe(true);
    expect(fonts.has('sans-serif')).toBe(false);
  });

  it('page 1 contains 7 of each option marker', () => {
    for (const marker of ['^1&', '^2&', '^3&', '^4&']) {
      expect(pg1.filter((i) => i.str.trim() === marker)).toHaveLength(7);
    }
  });

  it('page 11 contains exactly 80 pure-integer items', () => {
    expect(pg11.filter((i) => /^\d+$/.test(i.str.trim()))).toHaveLength(80);
  });
});
```

- [ ] **Step 3: Generate fixtures and run the test**

Run: `npm run fixtures && npx vitest run test/pdf/textLayer.test.ts`
Expected: fixtures write 128 and 326 items; all three tests PASS.

- [ ] **Step 4: Implement the browser adapter**

Create `lib/pdf/loader.ts`:

```ts
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function loadDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy, pageIndex: number, scale: number, canvas: HTMLCanvasElement,
): Promise<void> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;
}
```

Create `lib/pdf/textLayer.ts`:

```ts
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PositionedItem } from '@/lib/types';

export async function getPositionedItems(
  doc: PDFDocumentProxy, pageIndex: number,
): Promise<PositionedItem[]> {
  const page = await doc.getPage(pageIndex + 1);
  // commonObjs is empty until the operator list has been built. Without this
  // line every font resolves to an internal id like "g_d0_f1".
  await page.getOperatorList();
  const tc = await page.getTextContent();

  return tc.items
    .filter((i): i is typeof i & { str: string } => 'str' in i && i.str.trim().length > 0)
    .map((i) => {
      let font = i.fontName;
      try { font = page.commonObjs.get(i.fontName)?.name ?? i.fontName; } catch { /* unloaded */ }
      return {
        str: i.str,
        x: +i.transform[4].toFixed(1),
        y: +i.transform[5].toFixed(1),
        w: +i.width.toFixed(1),
        h: +i.height.toFixed(1),
        font,
      };
    });
}
```

- [ ] **Step 5: Verify the build still passes**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/pdf test/pdf test/tools test/fixtures package.json
git commit -m "feat: pdf.js text-layer adapter with resolved font names and fixtures"
```

---

### Task 5: Watermark filter and line grouping

**Files:**
- Create: `lib/extract/watermark.ts`
- Create: `lib/extract/lines.ts`
- Test: `test/extract/lines.test.ts`

**Interfaces:**
- Consumes: `PositionedItem`, `Line` from Task 1; `transliterateItem` from Task 3
- Produces:
  - `export function stripWatermark(items: PositionedItem[], minRepeats?: number): PositionedItem[]`
  - `export function groupIntoLines(items: PositionedItem[], yTolerance?: number): Line[]`

- [ ] **Step 1: Write the failing test**

Create `test/extract/lines.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { stripWatermark } from '@/lib/extract/watermark';
import { groupIntoLines } from '@/lib/extract/lines';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));

describe('stripWatermark', () => {
  it('removes the 11x repeated department watermark', () => {
    const kept = stripWatermark(pg1);
    const still = kept.filter((i) => i.str.includes('fomd¾;fïka;=j'));
    expect(still).toHaveLength(0);
  });

  it('removes the repeated English watermark too', () => {
    const kept = stripWatermark(pg1);
    expect(kept.filter((i) => i.str.includes('Provincial Department'))).toHaveLength(0);
  });

  it('keeps option markers even though they repeat 7 times', () => {
    // Repetition alone must not be the rule — markers are legitimate content.
    const kept = stripWatermark(pg1);
    expect(kept.filter((i) => i.str.trim() === '^1&')).toHaveLength(7);
  });

  it('drops roughly half of page 1', () => {
    expect(stripWatermark(pg1).length).toBeLessThan(pg1.length * 0.7);
  });
});

describe('groupIntoLines', () => {
  it('groups items sharing a y into one line', () => {
    const items: PositionedItem[] = [
      { str: 'b', x: 10, y: 100, w: 5, h: 10, font: 'FMAbhayax' },
      { str: ';', x: 16, y: 100, w: 5, h: 10, font: 'FMAbhayax' },
      { str: 'w', x: 10, y: 80, w: 5, h: 10, font: 'FMAbhayax' },
    ];
    const lines = groupIntoLines(items);
    expect(lines).toHaveLength(2);
    expect(lines[0].items).toHaveLength(2);
  });

  it('orders lines top to bottom and items left to right', () => {
    const items: PositionedItem[] = [
      { str: 'B', x: 50, y: 50, w: 5, h: 10, font: 'FMAbhayax' },
      { str: 'A', x: 10, y: 50, w: 5, h: 10, font: 'FMAbhayax' },
      { str: 'T', x: 10, y: 90, w: 5, h: 10, font: 'FMAbhayax' },
    ];
    const lines = groupIntoLines(items);
    expect(lines[0].items[0].str).toBe('T');
    expect(lines[1].items.map((i) => i.str)).toEqual(['A', 'B']);
  });

  it('transliterates line text to Unicode', () => {
    const items: PositionedItem[] = [
      { str: 'b;sydih', x: 10, y: 100, w: 40, h: 10, font: 'XSUOWA+FMAbhayax' },
    ];
    expect(groupIntoLines(items)[0].text).toBe('ඉතිහාසය');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/lines.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the watermark filter**

Create `lib/extract/watermark.ts`:

```ts
import type { PositionedItem } from '@/lib/types';

/**
 * A watermark is a long string repeated many times across a page. Short
 * strings are excluded because legitimate content repeats too — option
 * markers like "^1&" appear once per question.
 */
const MIN_WATERMARK_LENGTH = 12;

export function stripWatermark(items: PositionedItem[], minRepeats = 4): PositionedItem[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const key = i.str.trim();
    if (key.length < MIN_WATERMARK_LENGTH) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const watermarks = new Set(
    [...counts.entries()].filter(([, c]) => c >= minRepeats).map(([s]) => s),
  );
  return items.filter((i) => !watermarks.has(i.str.trim()));
}
```

- [ ] **Step 4: Implement line grouping**

Create `lib/extract/lines.ts`:

```ts
import type { Line, PositionedItem } from '@/lib/types';
import { transliterateItem } from '@/lib/sinhala/legacy/detectFont';

export function groupIntoLines(items: PositionedItem[], yTolerance = 3): Line[] {
  const buckets: PositionedItem[][] = [];
  // Descending y: PDF origin is bottom-left, so larger y is higher on the page.
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const bucket = buckets.find((b) => Math.abs(b[0].y - item.y) <= yTolerance);
    if (bucket) bucket.push(item);
    else buckets.push([item]);
  }

  return buckets.map((bucket) => {
    const sorted = bucket.sort((a, b) => a.x - b.x);
    const text = sorted.map((i) => transliterateItem(i.str, i.font).text).join('');
    const x = Math.min(...sorted.map((i) => i.x));
    const right = Math.max(...sorted.map((i) => i.x + i.w));
    const y = Math.max(...sorted.map((i) => i.y));
    const h = Math.max(...sorted.map((i) => i.h));
    return { text, items: sorted, y, bbox: { x, y, w: right - x, h }, source: 'text' as const };
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/extract/lines.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add lib/extract test/extract
git commit -m "feat: watermark filter and line grouping over positioned items"
```

---

### Task 6: Question parser

**Files:**
- Create: `lib/extract/parser.ts`
- Test: `test/extract/parser.test.ts`

**Interfaces:**
- Consumes: `Line` from Task 1
- Produces:
  - `export interface RawQuestion { number: number; stem: string; options: string[]; bbox: BBox; pageIndex: number; rawLegacy: string; unmapped: number; }`
  - `export function parseQuestions(lines: Line[], pageIndex: number): RawQuestion[]`

- [ ] **Step 1: Write the failing test**

Create `test/extract/parser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { stripWatermark } from '@/lib/extract/watermark';
import { groupIntoLines } from '@/lib/extract/lines';
import { parseQuestions } from '@/lib/extract/parser';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const parsed = parseQuestions(groupIntoLines(stripWatermark(pg1)), 0);

describe('parseQuestions on page 1', () => {
  it('finds exactly 7 questions', () => {
    expect(parsed).toHaveLength(7);
  });

  it('numbers them 1 through 7', () => {
    expect(parsed.map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gives every question exactly 4 options', () => {
    for (const q of parsed) expect(q.options).toHaveLength(4);
  });

  it('produces non-empty Sinhala stems', () => {
    for (const q of parsed) {
      expect(q.stem.length).toBeGreaterThan(5);
      expect(/[඀-෿]/.test(q.stem)).toBe(true);
    }
  });

  it('strips the option marker from the option text', () => {
    for (const q of parsed) {
      for (const o of q.options) expect(o.startsWith('(')).toBe(false);
    }
  });

  it('retains the legacy source for diffing', () => {
    expect(parsed[0].rawLegacy.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/parser.test.ts`
Expected: FAIL — `parseQuestions` not found.

- [ ] **Step 3: Implement the parser**

Create `lib/extract/parser.ts`:

```ts
import type { BBox, Line } from '@/lib/types';

export interface RawQuestion {
  number: number;
  stem: string;
  options: string[];
  bbox: BBox;
  pageIndex: number;
  rawLegacy: string;
  unmapped: number;
}

/** A question opens with a 1- or 2-digit number, optionally followed by . or ' */
const QUESTION_START = /^\s*(\d{1,2})\s*['.’]?\s+(?=\S)/;
/** After transliteration the FM parenthesis glyphs read as ( and ). */
const OPTION_MARKER = /\((\s*[1-4]\s*)\)/g;

function mergeBBox(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y - a.h, b.y - b.h);
  return { x, y, w: right - x, h: y - bottom };
}

function splitOptions(text: string): { before: string; options: string[] } {
  const markers = [...text.matchAll(OPTION_MARKER)];
  if (markers.length === 0) return { before: text, options: [] };
  const before = text.slice(0, markers[0].index);
  const options: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : text.length;
    options.push(text.slice(start, end).trim());
  }
  return { before, options };
}

export function parseQuestions(lines: Line[], pageIndex: number): RawQuestion[] {
  const questions: RawQuestion[] = [];
  let current: RawQuestion | null = null;
  let stemParts: string[] = [];

  const flush = () => {
    if (!current) return;
    current.stem = stemParts.join(' ').replace(/\s+/g, ' ').trim();
    if (current.options.length > 0) questions.push(current);
    current = null;
    stemParts = [];
  };

  for (const line of lines) {
    const opener = QUESTION_START.exec(line.text);
    const legacy = line.items.map((i) => i.str).join('');

    if (opener) {
      flush();
      const rest = line.text.slice(opener[0].length);
      const { before, options } = splitOptions(rest);
      current = {
        number: parseInt(opener[1], 10),
        stem: '',
        options,
        bbox: line.bbox,
        pageIndex,
        rawLegacy: legacy,
        unmapped: 0,
      };
      stemParts = before.trim() ? [before.trim()] : [];
      continue;
    }

    if (!current) continue;

    const { before, options } = splitOptions(line.text);
    // A continuation line either extends the stem or adds more options.
    if (options.length > 0) {
      if (before.trim() && current.options.length === 0) stemParts.push(before.trim());
      else if (before.trim()) current.options[current.options.length - 1] += ' ' + before.trim();
      current.options.push(...options);
    } else if (current.options.length === 0) {
      stemParts.push(line.text.trim());
    } else {
      // Wrapped text belonging to the last option.
      current.options[current.options.length - 1] += ' ' + line.text.trim();
    }
    current.bbox = mergeBBox(current.bbox, line.bbox);
    current.rawLegacy += legacy;
  }

  flush();
  return questions.sort((a, b) => a.number - b.number);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/extract/parser.test.ts`
Expected: PASS, all cases.

If option counts come out wrong, print the grouped lines for page 1 and check whether the four markers land on one line or several — page 1 puts all four on a single line for most questions and splits Q7 across two. Both paths are handled above; adjust `yTolerance` in Task 5 before changing the parser.

- [ ] **Step 5: Commit**

```bash
git add lib/extract test/extract
git commit -m "feat: MCQ question parser over transliterated lines"
```

---

### Task 7: Question classifier

**Files:**
- Create: `lib/extract/classify.ts`
- Test: `test/extract/classify.test.ts`

**Interfaces:**
- Consumes: `RawQuestion` from Task 6; `QuestionKind` from Task 1
- Produces:
  - `export interface ImageRegion { pageIndex: number; bbox: BBox }`
  - `export function classify(q: RawQuestion, images: ImageRegion[]): QuestionKind`

- [ ] **Step 1: Write the failing test**

Create `test/extract/classify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classify } from '@/lib/extract/classify';
import type { RawQuestion } from '@/lib/extract/parser';

const base: RawQuestion = {
  number: 1, stem: 'ප්‍රශ්නය', options: [], bbox: { x: 0, y: 100, w: 100, h: 20 },
  pageIndex: 0, rawLegacy: '', unmapped: 0,
};

describe('classify', () => {
  it('marks a normal four-option question as straight', () => {
    const q = { ...base, options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය'] };
    expect(classify(q, [])).toBe('straight');
  });

  it('marks a column-match question as special (Q8 shape)', () => {
    const q = { ...base, number: 8, options: ['A C B', 'B A D', 'C A D', 'C B A'] };
    expect(classify(q, [])).toBe('special');
  });

  it('marks a select-two question as special (Q16 shape)', () => {
    const q = { ...base, number: 16, options: ['A යා C', 'B යා C', 'B යා D', 'C යා D'] };
    expect(classify(q, [])).toBe('special');
  });

  it('marks a question with the wrong option count as special', () => {
    expect(classify({ ...base, options: ['ක', 'ඛ', 'ග'] }, [])).toBe('special');
  });

  it('marks a question whose stem references a map as figure', () => {
    const q = { ...base, stem: 'පහත සිතියම බලන්න', options: ['අ', 'ආ', 'ඇ', 'ඈ'] };
    expect(classify(q, [])).toBe('figure');
  });

  it('marks a question overlapping an image region as figure', () => {
    const q = { ...base, options: ['අ', 'ආ', 'ඇ', 'ඈ'] };
    const images = [{ pageIndex: 0, bbox: { x: 10, y: 95, w: 50, h: 30 } }];
    expect(classify(q, images)).toBe('figure');
  });

  it('prefers special over figure when both apply', () => {
    const q = { ...base, stem: 'පහත වගුව', options: ['A C B', 'B A D', 'C A D', 'C B A'] };
    expect(classify(q, [])).toBe('special');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/classify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the classifier**

Create `lib/extract/classify.ts`:

```ts
import type { BBox, QuestionKind } from '@/lib/types';
import type { RawQuestion } from './parser';

export interface ImageRegion { pageIndex: number; bbox: BBox; }

/** An option that is only A–D tokens joined by a conjunction or whitespace. */
const AD_ONLY = /^[A-D](\s*(?:යා|සහ|,|and)?\s*[A-D])*$/i;

/** Stem words that mean the question depends on a picture or table. */
const FIGURE_WORDS = ['රූපය', 'රූපයේ', 'සිතියම', 'සිතියමේ', 'වගුව', 'වගුවේ', 'ප්‍රස්තාරය'];

function overlaps(a: BBox, b: BBox): boolean {
  const aBottom = a.y - a.h, bBottom = b.y - b.h;
  return a.x < b.x + b.w && b.x < a.x + a.w && aBottom < b.y && bBottom < a.y;
}

export function classify(q: RawQuestion, images: ImageRegion[]): QuestionKind {
  if (q.options.length !== 4) return 'special';
  if (q.options.some((o) => AD_ONLY.test(o.trim()))) return 'special';
  // An A/B/C/D enumeration block inside the stem is the Q16 shape.
  if (/(^|\s)A\s+\S+.*(^|\s)B\s+\S+/s.test(q.stem)) return 'special';

  if (FIGURE_WORDS.some((w) => q.stem.includes(w))) return 'figure';
  if (images.some((im) => im.pageIndex === q.pageIndex && overlaps(q.bbox, im.bbox))) return 'figure';

  return 'straight';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/extract/classify.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/extract test/extract
git commit -m "feat: classify questions as straight, special, or figure"
```

---

### Task 8: Geometric answer-key extraction

The algorithm below was validated against the reference paper and resolves 40/40 correctly. Naive text-order pairing gets 23 of 40 wrong, so the regression test is mandatory.

**Files:**
- Create: `lib/extract/answerKey.ts`
- Test: `test/extract/answerKey.test.ts`

**Interfaces:**
- Consumes: `PositionedItem`, `OptionIndex` from Task 1
- Produces:
  - `export interface AnswerKeyResult { key: Record<number, OptionIndex>; unresolved: number[]; labelColumns: number[]; }`
  - `export function extractAnswerKey(items: PositionedItem[]): AnswerKeyResult`

- [ ] **Step 1: Write the failing test**

Create `test/extract/answerKey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { extractAnswerKey } from '@/lib/extract/answerKey';
import type { PositionedItem } from '@/lib/types';

const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

const EXPECTED: Record<number, number> = {
  1:3, 2:2, 3:1, 4:3, 5:2, 6:4, 7:3, 8:3, 9:1, 10:4,
  11:2, 12:4, 13:4, 14:1, 15:2, 16:3, 17:2, 18:1, 19:4, 20:2,
  21:1, 22:3, 23:4, 24:4, 25:2, 26:3, 27:4, 28:1, 29:2, 30:1,
  31:1, 32:2, 33:3, 34:1, 35:4, 36:1, 37:3, 38:2, 39:4, 40:4,
};

describe('extractAnswerKey', () => {
  const result = extractAnswerKey(pg11);

  it('resolves all 40 questions with nothing left over', () => {
    expect(result.unresolved).toEqual([]);
    expect(Object.keys(result.key)).toHaveLength(40);
  });

  it('matches the verified answer key exactly', () => {
    expect(result.key).toEqual(EXPECTED);
  });

  it('discovers the ten label columns', () => {
    expect(result.labelColumns).toHaveLength(10);
    expect(result.labelColumns[0]).toBeCloseTo(60.9, 0);
    expect(result.labelColumns[9]).toBeCloseTo(492.0, 0);
  });

  it('REGRESSION: naive text-order pairing is wrong on this page', () => {
    // Guards the single most dangerous silent failure in the project.
    const ints = pg11.filter((i) => /^\d+$/.test(i.str.trim()))
      .map((i) => ({ n: parseInt(i.str, 10), x: i.x }));
    const cols = result.labelColumns;
    const isLabel = (x: number) => cols.some((c) => Math.abs(c - x) <= 3);
    const labels = ints.filter((i) => isLabel(i.x));
    const answers = ints.filter((i) => !isLabel(i.x));
    const naive: Record<number, number> = {};
    labels.forEach((l, i) => { naive[l.n] = answers[i]?.n; });

    const wrong = Object.keys(EXPECTED).map(Number).filter((q) => naive[q] !== EXPECTED[q]);
    expect(wrong.length).toBe(23);
  });

  it('reports unresolved labels instead of guessing', () => {
    const truncated = pg11.filter((i) => !(i.str.trim() === '4' && Math.abs(i.x - 517.2) < 1));
    const r = extractAnswerKey(truncated);
    expect(r.unresolved.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/answerKey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extractor**

Create `lib/extract/answerKey.ts`:

```ts
import type { OptionIndex, PositionedItem } from '@/lib/types';

export interface AnswerKeyResult {
  key: Record<number, OptionIndex>;
  unresolved: number[];
  labelColumns: number[];
}

const COLUMN_TOLERANCE = 3;   // pt
const ROW_TOLERANCE = 4;      // pt — answers sit within ~1pt of their label
const MAX_PAIR_DISTANCE = 40; // pt — answers sit ~24pt to the right

/**
 * Pairs question labels with answer digits by position.
 *
 * Text order cannot be trusted: on the reference paper the label run and the
 * digit run use different traversal orders, and the rows are not a uniform
 * grid (answers appear below, interleaved with, and above their labels on
 * different bands). Geometry is the only reliable signal.
 */
export function extractAnswerKey(items: PositionedItem[]): AnswerKeyResult {
  const ints = items
    .filter((i) => /^\d+$/.test(i.str.trim()))
    .map((i) => ({ n: parseInt(i.str.trim(), 10), x: i.x, y: i.y }));

  // Values >= 5 can only be labels, so they reveal the label columns without
  // any ambiguity against answer digits, which are always 1-4.
  const labelColumns: number[] = [];
  for (const x of ints.filter((i) => i.n >= 5).map((i) => i.x).sort((a, b) => a - b)) {
    if (!labelColumns.some((c) => Math.abs(c - x) <= COLUMN_TOLERANCE)) labelColumns.push(x);
  }

  const inLabelColumn = (x: number) => labelColumns.some((c) => Math.abs(c - x) <= COLUMN_TOLERANCE);
  const labels = ints.filter((i) => inLabelColumn(i.x));
  const answers = ints.filter((i) => !inLabelColumn(i.x) && i.n >= 1 && i.n <= 4);

  const key: Record<number, OptionIndex> = {};
  const unresolved: number[] = [];

  for (const label of labels) {
    const candidate = answers
      .filter((a) => Math.abs(a.y - label.y) <= ROW_TOLERANCE
                  && a.x > label.x
                  && a.x - label.x <= MAX_PAIR_DISTANCE)
      .sort((p, q) => (p.x - label.x) - (q.x - label.x))[0];

    if (candidate) key[label.n] = candidate.n as OptionIndex;
    else unresolved.push(label.n);
  }

  return { key, unresolved: unresolved.sort((a, b) => a - b), labelColumns };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/extract/answerKey.test.ts`
Expected: PASS, all five cases.

- [ ] **Step 5: Commit**

```bash
git add lib/extract test/extract
git commit -m "feat: geometric answer-key extraction with text-order regression guard"
```

---

### Task 9: Session store and IndexedDB persistence

**Files:**
- Create: `lib/session/idb.ts`
- Create: `lib/session/store.ts`
- Test: `test/session/idb.test.ts`

**Interfaces:**
- Consumes: `Session` from Task 1
- Produces:
  - `export async function putSession(s: Session, blob: Blob): Promise<void>`
  - `export async function getSession(id: string): Promise<{ session: Session; blob: Blob } | undefined>`
  - `export async function deleteAllExcept(id: string): Promise<void>`
  - `export function resolveSessionId(storage: Pick<Storage,'getItem'|'setItem'>): { id: string; isNew: boolean }`
  - `useSessionStore` — zustand store exposing `session`, `setStep`, `patch`, `newSession`

- [ ] **Step 1: Write the failing test**

Create `test/session/idb.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSessionId } from '@/lib/session/idb';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    _data: data,
  };
}

describe('resolveSessionId', () => {
  it('mints a new id when storage is empty', () => {
    const s = fakeStorage();
    const { id, isNew } = resolveSessionId(s);
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s._data['paper-session-id']).toBe(id);
  });

  it('reuses an existing id across a refresh', () => {
    const s = fakeStorage({ 'paper-session-id': '11111111-2222-3333-4444-555555555555' });
    const { id, isNew } = resolveSessionId(s);
    expect(isNew).toBe(false);
    expect(id).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(() => resolveSessionId(throwing)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/session/idb.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement persistence**

Create `lib/session/idb.ts`:

```ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Session } from '@/lib/types';

const DB_NAME = 'paper-extraction';
const STORE = 'sessions';
export const SESSION_KEY = 'paper-session-id';

interface Row { id: string; session: Session; blob: Blob; }

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); },
  });
  return dbPromise;
}

/**
 * sessionStorage is per-tab and cleared on tab close, which gives us the
 * required lifetime for free: a refresh keeps the id, a new tab does not.
 */
export function resolveSessionId(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): { id: string; isNew: boolean } {
  try {
    const existing = storage.getItem(SESSION_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = crypto.randomUUID();
    storage.setItem(SESSION_KEY, id);
    return { id, isNew: true };
  } catch {
    // Private windows and blocked site data land here. Run in-memory.
    return { id: crypto.randomUUID(), isNew: true };
  }
}

export async function putSession(session: Session, blob: Blob): Promise<void> {
  try { await (await db()).put(STORE, { id: session.id, session, blob } satisfies Row); } catch {}
}

export async function getSession(id: string): Promise<{ session: Session; blob: Blob } | undefined> {
  try {
    const row = (await (await db()).get(STORE, id)) as Row | undefined;
    return row ? { session: row.session, blob: row.blob } : undefined;
  } catch { return undefined; }
}

/** Called on every cold start so an abandoned session never outlives its tab. */
export async function deleteAllExcept(id: string): Promise<void> {
  try {
    const d = await db();
    const keys = await d.getAllKeys(STORE);
    await Promise.all(keys.filter((k) => k !== id).map((k) => d.delete(STORE, k)));
  } catch {}
}
```

- [ ] **Step 4: Implement the store**

Create `lib/session/store.ts`:

```ts
'use client';
import { create } from 'zustand';
import type { Session } from '@/lib/types';
import { SESSION_KEY, putSession } from './idb';

interface State {
  session: Session | null;
  sourceBlob: Blob | null;
  setSession: (s: Session, blob?: Blob) => void;
  patch: (p: Partial<Session>) => void;
  setStep: (step: Session['step']) => void;
  newSession: () => void;
}

export const useSessionStore = create<State>((set, get) => ({
  session: null,
  sourceBlob: null,
  setSession: (session, blob) => {
    set({ session, ...(blob ? { sourceBlob: blob } : {}) });
    const b = blob ?? get().sourceBlob;
    if (b) void putSession(session, b);
  },
  patch: (p) => {
    const cur = get().session;
    if (!cur) return;
    get().setSession({ ...cur, ...p });
  },
  setStep: (step) => get().patch({ step }),
  newSession: () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    location.reload();
  },
}));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/session/idb.test.ts`
Expected: PASS, all three cases.

- [ ] **Step 6: Commit**

```bash
git add lib/session test/session
git commit -m "feat: per-tab session id with IndexedDB persistence and orphan cleanup"
```

---

### Task 10: Excel export

**Files:**
- Create: `lib/export/xlsx.ts`
- Test: `test/export/xlsx.test.ts`

**Interfaces:**
- Consumes: `Question`, `OptionIndex` from Task 1
- Produces:
  - `export function buildRows(questions: Question[]): string[][]`
  - `export async function buildWorkbook(questions: Question[]): Promise<ArrayBuffer>`

- [ ] **Step 1: Write the failing test**

Create `test/export/xlsx.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildRows } from '@/lib/export/xlsx';
import type { Question } from '@/lib/types';

const q = (over: Partial<Question>): Question => ({
  id: 'x', number: 1, pageIndex: 0, bbox: { x: 0, y: 0, w: 0, h: 0 },
  stem: 'ශ්‍රී ලංකාව', options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය'],
  kind: 'straight', flags: [], correctAnswer: 3, rawLegacy: '', edited: false, ...over,
});

describe('buildRows', () => {
  it('emits a header row then one row per question', () => {
    const rows = buildRows([q({})]);
    expect(rows[0]).toEqual(['Full Question', 'Question', 'Answers', 'Correct Answer']);
    expect(rows).toHaveLength(2);
  });

  it('writes column 4 as number and text', () => {
    expect(buildRows([q({})])[1][3]).toBe('3. මණිමේඛලයි');
  });

  it('writes the stem alone in column 2', () => {
    expect(buildRows([q({})])[1][1]).toBe('ශ්‍රී ලංකාව');
  });

  it('writes numbered options on their own lines in column 3', () => {
    expect(buildRows([q({})])[1][2]).toBe('(1) යාල්පාන\n(2) සේගරාස\n(3) මණිමේඛලයි\n(4) කෛලාය');
  });

  it('writes stem then options in column 1', () => {
    expect(buildRows([q({})])[1][0]).toBe('ශ්‍රී ලංකාව\n(1) යාල්පාන\n(2) සේගරාස\n(3) මණිමේඛලයි\n(4) කෛලාය');
  });

  it('leaves column 4 empty when no answer is known', () => {
    expect(buildRows([q({ correctAnswer: null })])[1][3]).toBe('');
  });

  it('excludes special and figure questions', () => {
    const rows = buildRows([q({}), q({ number: 8, kind: 'special' }), q({ number: 9, kind: 'figure' })]);
    expect(rows).toHaveLength(2);
  });

  it('orders rows by question number', () => {
    const rows = buildRows([q({ number: 5 }), q({ number: 2 })]);
    expect(rows[1][1]).toBe('ශ්‍රී ලංකාව');
    expect(rows).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/export/xlsx.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

Create `lib/export/xlsx.ts`:

```ts
import ExcelJS from 'exceljs';
import type { Question } from '@/lib/types';

export const HEADERS = ['Full Question', 'Question', 'Answers', 'Correct Answer'];

const numberedOptions = (q: Question) =>
  q.options.map((o, i) => `(${i + 1}) ${o}`).join('\n');

export function buildRows(questions: Question[]): string[][] {
  const rows: string[][] = [HEADERS];
  const straight = questions
    .filter((q) => q.kind === 'straight')
    .sort((a, b) => a.number - b.number);

  for (const q of straight) {
    const options = numberedOptions(q);
    const correct = q.correctAnswer
      ? `${q.correctAnswer}. ${q.options[q.correctAnswer - 1] ?? ''}`
      : '';
    rows.push([`${q.stem}\n${options}`, q.stem, options, correct]);
  }
  return rows;
}

export async function buildWorkbook(questions: Question[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  for (const row of buildRows(questions)) ws.addRow(row);

  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 70 }, { width: 45 }, { width: 45 }, { width: 28 }];
  for (const col of [1, 3]) ws.getColumn(col).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/export/xlsx.test.ts`
Expected: PASS, all eight cases.

- [ ] **Step 5: Commit**

```bash
git add lib/export test/export
git commit -m "feat: four-column Excel export for straight questions"
```

---

### Task 11: Wizard steps 1–3

**Files:**
- Create: `components/ui/Button.tsx`, `components/ui/Checkbox.tsx`
- Create: `components/wizard/StepShell.tsx`
- Create: `components/wizard/UploadStep.tsx`
- Create: `components/wizard/PageSelectStep.tsx`
- Create: `components/wizard/AnswerPageStep.tsx`
- Modify: `app/page.tsx`
- Test: `test/extract/suggest.test.ts`
- Create: `lib/extract/suggest.ts`

**Interfaces:**
- Consumes: `useSessionStore` (Task 9), `loadDocument`/`renderPageToCanvas`/`getPositionedItems` (Task 4)
- Produces:
  - `export function suggestQuestionPages(pages: { index: number; items: PositionedItem[] }[]): number[]`
  - `export function suggestAnswerPage(pages: { index: number; items: PositionedItem[] }[]): number | null`

- [ ] **Step 1: Write the failing test for page suggestion**

Create `test/extract/suggest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { suggestQuestionPages, suggestAnswerPage } from '@/lib/extract/suggest';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));
const pages = [{ index: 0, items: pg1 }, { index: 10, items: pg11 }];

describe('suggestQuestionPages', () => {
  it('suggests the page carrying option markers', () => {
    expect(suggestQuestionPages(pages)).toContain(0);
  });
  it('does not suggest the answer sheet', () => {
    expect(suggestQuestionPages(pages)).not.toContain(10);
  });
});

describe('suggestAnswerPage', () => {
  it('suggests the page dominated by bare digits', () => {
    expect(suggestAnswerPage(pages)).toBe(10);
  });
  it('returns null when no page qualifies', () => {
    expect(suggestAnswerPage([{ index: 0, items: pg1 }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/suggest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement suggestion**

Create `lib/extract/suggest.ts`:

```ts
import type { PositionedItem } from '@/lib/types';

interface Page { index: number; items: PositionedItem[]; }

const MARKERS = ['^1&', '^2&', '^3&', '^4&'];

function markerCount(items: PositionedItem[]): number {
  return items.filter((i) => MARKERS.includes(i.str.trim())).length;
}

function bareIntRatio(items: PositionedItem[]): number {
  if (items.length === 0) return 0;
  return items.filter((i) => /^\d+$/.test(i.str.trim())).length / items.length;
}

/** A question page carries at least one full set of four option markers. */
export function suggestQuestionPages(pages: Page[]): number[] {
  return pages.filter((p) => markerCount(p.items) >= 4 && bareIntRatio(p.items) < 0.2)
              .map((p) => p.index);
}

/** An answer sheet is mostly bare digits and carries at least 40 of them. */
export function suggestAnswerPage(pages: Page[]): number | null {
  const scored = pages
    .map((p) => ({
      index: p.index,
      ints: p.items.filter((i) => /^\d+$/.test(i.str.trim())).length,
      ratio: bareIntRatio(p.items),
    }))
    .filter((p) => p.ints >= 40 && p.ratio >= 0.15)
    .sort((a, b) => b.ratio - a.ratio);
  return scored[0]?.index ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/extract/suggest.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 5: Build the UI primitives**

Create `components/ui/Button.tsx`:

```tsx
'use client';
import type { ButtonHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base = 'px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const style = variant === 'primary'
    ? 'bg-[#0A0A0A] text-white hover:bg-[#333]'
    : 'border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5]';
  return <button className={`${base} ${style} ${className}`} {...props} />;
}
```

Create `components/ui/Checkbox.tsx`:

```tsx
'use client';
export function Checkbox({ checked, onChange, label }:
  { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="accent-[#0A0A0A]" />
      {label}
    </label>
  );
}
```

- [ ] **Step 6: Build StepShell**

Create `components/wizard/StepShell.tsx`:

```tsx
'use client';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function StepShell({ step, title, subtitle, children, onBack, onNext, nextLabel = 'Continue', nextDisabled, nextBlockedReason }: {
  step: number; title: string; subtitle?: string; children: ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string;
  nextDisabled?: boolean; nextBlockedReason?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#E5E5E5] px-8 py-5">
        <p className="text-xs tracking-widest uppercase text-[#767676]">Step {step} of 4</p>
        <h1 className="text-xl mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-[#767676] mt-1">{subtitle}</p>}
      </header>
      <main className="flex-1 px-8 py-6 overflow-auto">{children}</main>
      <footer className="border-t border-[#E5E5E5] px-8 py-4 flex items-center gap-3">
        {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
        <div className="flex-1" />
        {nextDisabled && nextBlockedReason && (
          <span className="text-sm text-[#767676]">{nextBlockedReason}</span>
        )}
        {onNext && <Button onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button>}
      </footer>
    </div>
  );
}
```

- [ ] **Step 7: Build UploadStep**

Create `components/wizard/UploadStep.tsx`. It accepts one PDF or a set of images, stores the blob, and advances to step 2.

```tsx
'use client';
import { useRef, useState } from 'react';
import { StepShell } from './StepShell';
import { useSessionStore } from '@/lib/session/store';

export function UploadStep() {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const { session, setSession } = useSessionStore();

  async function accept(files: FileList | null) {
    if (!files?.length) return;
    const isPdf = files[0].type === 'application/pdf';
    const allImages = [...files].every((f) => f.type.startsWith('image/'));
    if (!isPdf && !allImages) { setError('Upload one PDF, or a set of JPG/PNG images.'); return; }
    if (isPdf && files.length > 1) { setError('Upload a single PDF at a time.'); return; }
    setError('');
    if (!session) return;
    setSession({
      ...session,
      sourceName: files[0].name,
      sourceKind: isPdf ? 'pdf' : 'images',
      step: 2,
    }, files[0]);
  }

  return (
    <StepShell step={1} title="Upload a paper"
      subtitle="Everything stays in your browser. Nothing is uploaded to a server.">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void accept(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className="border border-dashed border-[#E5E5E5] h-72 flex flex-col items-center justify-center cursor-pointer hover:bg-[#FAFAFA]"
      >
        <p className="text-sm">Drop a PDF here, or click to choose</p>
        <p className="text-xs text-[#767676] mt-2">PDF, or a set of JPG / PNG pages</p>
        <input ref={input} type="file" hidden accept="application/pdf,image/*" multiple
               onChange={(e) => void accept(e.target.files)} />
      </div>
      {error && <p className="text-sm mt-3">{error}</p>}
    </StepShell>
  );
}
```

- [ ] **Step 8: Build PageSelectStep and AnswerPageStep**

Create `components/wizard/PageSelectStep.tsx`: render every page to a thumbnail canvas via `renderPageToCanvas` at `scale: 0.3`, pre-tick the indices from `suggestQuestionPages`, allow click-to-toggle and shift-click range select, and write `questionPages` on continue. Disable Continue with the reason "Select at least one page" when nothing is ticked.

Create `components/wizard/AnswerPageStep.tsx`: the same thumbnail grid in single-select mode, pre-selecting `suggestAnswerPage`. Include a checkbox labelled "This paper has no answer sheet" which sets `hasNoAnswerSheet: true`, clears `answerPage`, and enables Continue.

- [ ] **Step 9: Wire the wizard host**

Replace `app/page.tsx` to resolve the session id on mount, call `deleteAllExcept`, rehydrate from IndexedDB when the id already existed, and render the component for `session.step`.

- [ ] **Step 10: Verify manually**

Run: `npm run dev`, upload the reference PDF, confirm 14 thumbnails render, that pages with questions are pre-ticked, and that page 11 is pre-selected as the answer sheet.

- [ ] **Step 11: Commit**

```bash
git add app components lib/extract/suggest.ts test/extract/suggest.test.ts
git commit -m "feat: wizard steps for upload, page selection, and answer sheet"
```

---

### Task 12: Review workspace

**Files:**
- Create: `components/review/ReviewWorkspace.tsx`
- Create: `components/review/PagePane.tsx`
- Create: `components/review/QuestionCard.tsx`
- Create: `components/review/AnswerKeyGrid.tsx`
- Create: `components/review/ExportBar.tsx`
- Create: `lib/extract/pipeline.ts`
- Test: `test/extract/pipeline.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–10
- Produces: `export function assemble(pages, answerItems, hasNoAnswerSheet): { questions: Question[]; answerKey; unresolved }`

- [ ] **Step 1: Write the failing pipeline test**

Create `test/extract/pipeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { assemble } from '@/lib/extract/pipeline';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

describe('assemble', () => {
  const r = assemble([{ index: 0, items: pg1, images: [] }], pg11, false);

  it('produces 7 questions from page 1', () => {
    expect(r.questions).toHaveLength(7);
  });

  it('attaches the correct answer to each question', () => {
    // Verified key: q1=3, q2=2, q3=1, q4=3, q5=2, q6=4, q7=3
    expect(r.questions.map((q) => q.correctAnswer)).toEqual([3, 2, 1, 3, 2, 4, 3]);
  });

  it('classifies all seven as straight', () => {
    expect(r.questions.every((q) => q.kind === 'straight')).toBe(true);
  });

  it('leaves answers null when there is no answer sheet', () => {
    const none = assemble([{ index: 0, items: pg1, images: [] }], null, true);
    expect(none.questions.every((q) => q.correctAnswer === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/extract/pipeline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pipeline**

Create `lib/extract/pipeline.ts`:

```ts
import type { OptionIndex, PositionedItem, Question } from '@/lib/types';
import { stripWatermark } from './watermark';
import { groupIntoLines } from './lines';
import { parseQuestions } from './parser';
import { classify, type ImageRegion } from './classify';
import { extractAnswerKey } from './answerKey';

interface PageInput { index: number; items: PositionedItem[]; images: ImageRegion[]; }

export function assemble(
  pages: PageInput[],
  answerItems: PositionedItem[] | null,
  hasNoAnswerSheet: boolean,
): { questions: Question[]; answerKey: Record<number, OptionIndex>; unresolved: number[] } {
  const keyResult = !hasNoAnswerSheet && answerItems
    ? extractAnswerKey(answerItems)
    : { key: {}, unresolved: [], labelColumns: [] };

  const questions: Question[] = [];
  for (const page of pages) {
    const lines = groupIntoLines(stripWatermark(page.items));
    for (const raw of parseQuestions(lines, page.index)) {
      const flags: Question['flags'] = [];
      if (raw.unmapped > 0) flags.push('unmapped-glyph');
      questions.push({
        id: `p${page.index}-q${raw.number}`,
        number: raw.number,
        pageIndex: page.index,
        bbox: raw.bbox,
        stem: raw.stem,
        options: raw.options,
        kind: classify(raw, page.images),
        flags,
        correctAnswer: keyResult.key[raw.number] ?? null,
        rawLegacy: raw.rawLegacy,
        edited: false,
      });
    }
  }

  questions.sort((a, b) => a.number - b.number);
  return { questions, answerKey: keyResult.key, unresolved: keyResult.unresolved };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/extract/pipeline.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 5: Build the workspace UI**

Create `components/review/ReviewWorkspace.tsx`: a two-column grid, `PagePane` on the left at ~45% width and a tabbed panel on the right with `Straight (n) · Special (n) · Figure (n) · Answer key (n)`. Selecting a card sets `activeQuestionId`, which scrolls `PagePane` to that question's page and draws its bbox.

Create `components/review/PagePane.tsx`: renders the active question's page with `renderPageToCanvas` at `scale: 1.4` and overlays an absolutely-positioned outline computed from the bbox. Remember the PDF origin is bottom-left, so the CSS `top` is `(viewportHeight - bbox.y) * scale`.

Create `components/review/QuestionCard.tsx`: question number, a `flags` badge row, an editable stem `<textarea className="sinhala">`, four editable option inputs, and a radio group for the correct answer. Every edit calls `patch` and sets `edited: true`.

Create `components/review/AnswerKeyGrid.tsx`: a 40-cell grid of number inputs constrained to 1–4. Cells listed in `answerKeyUnresolved` get `border-2 border-[#0A0A0A]` and an "unresolved" label. Editing a cell clears it from `unresolved` and updates the matching question's `correctAnswer`.

Create `components/review/ExportBar.tsx`: a sticky bar with the straight-question count and an Export button that calls `buildWorkbook` and triggers a download. When `answerKeyUnresolved.length > 0`, the button is disabled and the bar reads `Resolve N unresolved answers before exporting`.

- [ ] **Step 6: Verify end to end manually**

Run: `npm run dev`. Upload the reference PDF, select all question pages, accept page 11 as the answer sheet, extract, and confirm Q1–7 show Sinhala text with answers 3, 2, 1, 3, 2, 4, 3 and that Q8 and Q16 appear under Special.

- [ ] **Step 7: Commit**

```bash
git add components lib/extract/pipeline.ts test/extract/pipeline.test.ts
git commit -m "feat: two-pane review workspace with editing and export"
```

---

### Task 13: OCR fallback for image pages

**Files:**
- Create: `lib/ocr/tesseract.ts`
- Modify: `lib/extract/pipeline.ts`
- Modify: `components/wizard/PageSelectStep.tsx`
- Test: `test/ocr/needsOcr.test.ts`

**Interfaces:**
- Consumes: `PositionedItem` from Task 1
- Produces:
  - `export function needsOcr(items: PositionedItem[]): boolean`
  - `export async function recognisePage(canvas: HTMLCanvasElement): Promise<PositionedItem[]>`

- [ ] **Step 1: Write the failing test**

Create `test/ocr/needsOcr.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { needsOcr } from '@/lib/ocr/tesseract';
import type { PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));

describe('needsOcr', () => {
  it('is false for a page with a real text layer', () => {
    expect(needsOcr(pg1)).toBe(false);
  });
  it('is true for an empty page', () => {
    expect(needsOcr([])).toBe(true);
  });
  it('is true for a near-empty page', () => {
    expect(needsOcr(pg1.slice(0, 3))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/ocr/needsOcr.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the OCR wrapper**

Create `lib/ocr/tesseract.ts`:

```ts
import type { PositionedItem } from '@/lib/types';

/** Pages 9 and 10 of the reference paper are image-only and land here. */
const MIN_ITEMS_FOR_TEXT_LAYER = 10;

export function needsOcr(items: PositionedItem[]): boolean {
  return items.length < MIN_ITEMS_FOR_TEXT_LAYER;
}

/**
 * Tesseract and its ~10MB Sinhala traineddata load only when this is called,
 * which keeps them out of the initial bundle.
 */
export async function recognisePage(canvas: HTMLCanvasElement): Promise<PositionedItem[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('sin');
  try {
    const { data } = await worker.recognize(canvas);
    const words = (data as unknown as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> }).words ?? [];
    return words.filter((w) => w.text.trim()).map((w) => ({
      str: w.text,
      x: w.bbox.x0,
      // Convert Tesseract's top-left origin to the PDF's bottom-left origin.
      y: canvas.height - w.bbox.y1,
      w: w.bbox.x1 - w.bbox.x0,
      h: w.bbox.y1 - w.bbox.y0,
      font: 'OCR',       // mapForFont returns null, so text passes through
    }));
  } finally {
    await worker.terminate();
  }
}
```

- [ ] **Step 4: Flag OCR pages in the pipeline**

In `lib/extract/pipeline.ts`, add `ocr?: boolean` to `PageInput` and push `'ocr'` into `flags` for every question from a page where it is true. In `PageSelectStep`, label any page where `needsOcr` returns true with a small "OCR" badge so the user knows before extracting.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/ocr/needsOcr.test.ts`
Expected: PASS, all three cases.

- [ ] **Step 6: Commit**

```bash
git add lib/ocr lib/extract components test/ocr
git commit -m "feat: lazy Tesseract OCR fallback for image-only pages"
```

---

### Task 14: End-to-end test and final verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/extract.spec.ts`

**Interfaces:**
- Consumes: the whole app
- Produces: nothing — this is the final gate

- [ ] **Step 1: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
});
```

Add script: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Write the end-to-end test**

Create `e2e/extract.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';

const PDF = path.resolve('test/fixtures/GRADE-11-HISTORY.pdf');

test('extracts questions and survives a refresh', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', PDF);

  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('tab', { name: /Straight/ })).toBeVisible({ timeout: 60_000 });
  const straight = page.getByRole('tab', { name: /Straight/ });
  await expect(straight).toContainText(/Straight \(\d+\)/);

  // Q1's verified answer is option 3.
  await expect(page.getByTestId('question-1-answer')).toHaveValue('3');

  // A refresh must restore the session, not reset it.
  await page.reload();
  await expect(page.getByRole('tab', { name: /Straight/ })).toBeVisible();
  await expect(page.getByTestId('question-1-answer')).toHaveValue('3');
});

test('an edit survives a refresh', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', PDF);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('question-1-stem')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('question-1-stem').fill('සංස්කරණය කළ ප්‍රශ්නය');
  await page.reload();
  await expect(page.getByTestId('question-1-stem')).toHaveValue('සංස්කරණය කළ ප්‍රශ්නය');
});
```

Add `data-testid="question-N-stem"` and `data-testid="question-N-answer"` to `QuestionCard`, and `role="tab"` to the workspace tabs.

- [ ] **Step 3: Run the end-to-end suite**

Run: `npx playwright install chromium && npm run test:e2e`
Expected: both tests PASS.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run build && npm run test:e2e`
Expected: all unit tests pass, the static export builds to `out/`, and both e2e tests pass.

- [ ] **Step 5: Confirm the no-server guarantee**

Run: `grep -rn "fetch(\|axios\|http://\|https://" app components lib --include=*.ts --include=*.tsx`
Expected: no runtime network calls. Matches inside comments or the pdf.js worker URL are fine; anything else is a bug.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e package.json
git commit -m "test: end-to-end extraction and session-persistence coverage"
```

---

## Notes for the Implementer

**If Task 2 stalls.** The character table is the only genuinely hard part. Work one golden word at a time, smallest first (`wxl` → `අංක` needs three tokens). When a word fails, print the actual output beside the expected and compare code point by code point — the mismatch tells you which token is wrong. Do not add a token you cannot justify from a failing test.

**If the parser finds the wrong number of questions.** The cause is almost always line grouping, not parsing. Dump the grouped lines for page 1 and look at whether option markers landed on the line you expected. Adjust `yTolerance` before touching `parser.ts`.

**Never loosen the answer-key tests.** If `extractAnswerKey` disagrees with the verified key, the code is wrong, not the fixture. The key in this plan was derived geometrically and cross-checked against the printed digit rows.
