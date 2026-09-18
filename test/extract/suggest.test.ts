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
