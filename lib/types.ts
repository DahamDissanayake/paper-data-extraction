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
  /**
   * Question pages where OCR was required but failed. Extraction continues
   * without them; the review workspace shows which pages are missing so a
   * short question list is never silent. Optional so sessions persisted
   * before this field existed still rehydrate.
   */
  ocrFailedPages?: number[];
  step: 1 | 2 | 3 | 4;
}
