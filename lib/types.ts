export type OptionIndex = 1 | 2 | 3 | 4;

/**
 * A rectangle in **PDF user-space points at scale 1, origin bottom-left**
 * (so `y` is the TOP edge and `y - h` the bottom edge). Every producer of a
 * BBox or a PositionedItem must normalise to this space before returning:
 * `getPositionedItems` and `getImageRegions` are already in it, and
 * `recognisePage` divides Tesseract's scaled canvas-pixel boxes by the
 * render scale to get there. Mixing spaces silently corrupts line-grouping
 * tolerances, figure-overlap tests and the review pane's highlight overlay.
 */
export interface BBox { x: number; y: number; w: number; h: number; }

/** Coordinates are PDF user-space points at scale 1, origin bottom-left. */
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
  /**
   * Total legacy codes on this line that the active font table could not
   * resolve (each rendered as `⟨?⟩` in `text`). Summed across the lines of
   * a question it raises the `unmapped-glyph` flag, which is what makes a
   * missing font table visible instead of silently wrong.
   */
  unmapped: number;
}

export type QuestionKind = 'straight' | 'special' | 'figure';
/**
 * `'low-confidence'` was specced alongside these but never assignable:
 * nothing carries Tesseract's per-word confidence past `recognisePage`, so
 * no code path could ever set it. Wiring it honestly would mean threading a
 * confidence score through PositionedItem -> Line -> RawQuestion, which is
 * a data-model change beyond this fix wave. It is removed rather than left
 * advertising a badge that can never appear; OCR'd questions still carry
 * the visible `'ocr'` flag, so OCR output is never silently auto-trusted.
 */
export type QuestionFlag = 'ocr' | 'unmapped-glyph';

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
  /**
   * Question pages where OCR was required but failed. Extraction continues
   * without them; the review workspace shows which pages are missing so a
   * short question list is never silent. Optional so sessions persisted
   * before this field existed still rehydrate.
   */
  ocrFailedPages?: number[];
  /**
   * The page selection `questions`/`answerKey` were extracted from, as
   * `extractionKey()` renders it. Lets step 4 tell results that belong to
   * the current selection from stale ones left by a selection the user has
   * since changed. Optional so older persisted sessions still rehydrate.
   */
  extractedFor?: string;
  step: 1 | 2 | 3 | 4;
}
