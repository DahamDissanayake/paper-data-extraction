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
