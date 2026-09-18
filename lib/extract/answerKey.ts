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
