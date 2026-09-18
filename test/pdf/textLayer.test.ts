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
