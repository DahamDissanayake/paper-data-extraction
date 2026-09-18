import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { assemble } from '@/lib/extract/pipeline';
import { convertLegacy } from '@/lib/sinhala/legacy/convert';
import { mapForFont } from '@/lib/sinhala/legacy/detectFont';
import type { OptionIndex, PositionedItem } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

interface Golden {
  questions: { number: number; pageIndex: number; kind: string; stem: string; options: string[] }[];
  answerKey: Record<string, OptionIndex>;
}
const golden: Golden = JSON.parse(fs.readFileSync('test/fixtures/golden.json', 'utf8'));

/**
 * Inter-item spacing comes from the PDF text layer's item boundaries, not
 * from the transliterator, and page 1 has two spots where the printed page
 * shows a space the text layer does not contain. Comparing with whitespace
 * removed still asserts every single character the font table produces —
 * which is the property this fixture exists to pin — and still catches
 * stray content such as an absorbed page-number footer.
 */
const squash = (s: string) => s.replace(/\s+/g, '');

describe('golden.json — hand-verified pipeline output', () => {
  const result = assemble([{ index: 0, items: pg1, images: [] }], pg11, false);

  it('extracts exactly the golden questions from page 1', () => {
    expect(result.questions.map((q) => q.number)).toEqual(golden.questions.map((q) => q.number));
  });

  for (const expected of golden.questions) {
    describe(`Q${expected.number}`, () => {
      const actual = () => result.questions.find((q) => q.number === expected.number)!;

      it('matches the verified stem', () => {
        expect(squash(actual().stem)).toBe(squash(expected.stem));
      });

      it('matches all four verified options', () => {
        expect(actual().options.map(squash)).toEqual(expected.options.map(squash));
      });

      it('classifies as the verified kind', () => {
        expect(actual().kind).toBe(expected.kind);
      });

      it('converts with no unmapped glyphs', () => {
        expect(actual().flags).not.toContain('unmapped-glyph');
      });
    });
  }

  it('pairs every question with the verified answer key', () => {
    for (const q of result.questions) {
      expect(q.correctAnswer).toBe(golden.answerKey[String(q.number)]);
    }
  });

  it('carries the full verified 40-entry answer key', () => {
    expect(Object.keys(golden.answerKey)).toHaveLength(40);
    expect(result.answerKey).toEqual(
      Object.fromEntries(Object.entries(golden.answerKey).map(([k, v]) => [Number(k), v])),
    );
  });
});

/**
 * A completeness property CI enforces, rather than a hope. Word-level spot
 * checks cannot tell "the table is complete" from "the table happens to
 * cover the words I tested"; this counts every FM-font character on the
 * page and fails if the font table stops resolving them.
 *
 * Thresholds reflect what is actually achieved and are deliberately close
 * to it:
 *   - page 1 resolves 1803/1803 = 100.0%. Asserted exactly, because page 1
 *     is entirely in scope (masthead, instructions, Q1-7) and any regression
 *     there is a real bug, not noise.
 *   - page 11 resolves 1593/1626 = 98.0%. The 33 stragglers are in the
 *     Part II prose answers, which the spec puts out of scope, so this is
 *     asserted as a floor with a little headroom rather than exactly.
 */
function fmCoverage(items: PositionedItem[]): { total: number; unmapped: number } {
  let total = 0;
  let unmapped = 0;
  for (const item of items) {
    const map = mapForFont(item.font);
    if (!map) continue;
    total += item.str.length;
    unmapped += convertLegacy(item.str, map).unmapped;
  }
  return { total, unmapped };
}

describe('FM font table coverage', () => {
  it('resolves every FM character on page 1', () => {
    const { total, unmapped } = fmCoverage(pg1);
    expect(total).toBeGreaterThan(1500);
    expect(unmapped).toBe(0);
  });

  it('resolves at least 97% of FM characters on the answer-key page', () => {
    const { total, unmapped } = fmCoverage(pg11);
    expect(total).toBeGreaterThan(1500);
    expect((total - unmapped) / total).toBeGreaterThanOrEqual(0.97);
  });
});
