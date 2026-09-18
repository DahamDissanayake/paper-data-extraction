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
