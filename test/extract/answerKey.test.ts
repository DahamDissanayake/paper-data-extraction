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
