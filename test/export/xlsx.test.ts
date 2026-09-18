import { describe, it, expect } from 'vitest';
import { buildRows } from '@/lib/export/xlsx';
import type { Question } from '@/lib/types';

const q = (over: Partial<Question>): Question => ({
  id: 'x', number: 1, pageIndex: 0, bbox: { x: 0, y: 0, w: 0, h: 0 },
  stem: 'ශ්‍රී ලංකාව', options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය'],
  kind: 'straight', flags: [], correctAnswer: 3, rawLegacy: '', edited: false, ...over,
});

const legacyQ = (over: Partial<Question>): Question => q({
  rawLegacy: "01'Y%S ,xldj^1&hd,amdk^2&fYa.rd^3&uKsfïl^4&ffl,dhu",
  ...over,
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

describe("buildRows(questions, 'legacy')", () => {
  // "Legacy" mode exports the ORIGINAL, unconverted legacy-encoded text
  // (Question.rawLegacy) instead of the Unicode-converted stem/options, so
  // the spreadsheet can be opened on a machine that still has the original
  // legacy font (e.g. FM Abhaya) installed rather than a Unicode Sinhala
  // font. Requested directly by a user report after the Unicode conversion
  // itself was found to have real gaps (see lib/sinhala/legacy/maps/fmAbhaya.ts) —
  // legacy mode is an escape hatch that sidesteps conversion entirely.
  it('writes the legacy stem in column 2, not the Unicode stem', () => {
    const rows = buildRows([legacyQ({})], 'legacy');
    expect(rows[1][1]).toBe('Y%S ,xldj');
  });

  it('writes numbered legacy options in column 3', () => {
    const rows = buildRows([legacyQ({})], 'legacy');
    expect(rows[1][2]).toBe('(1) hd,amdk\n(2) fYa.rd\n(3) uKsfïl\n(4) ffl,dhu');
  });

  it('writes the legacy correct-answer option text in column 4', () => {
    const rows = buildRows([legacyQ({ correctAnswer: 3 })], 'legacy');
    expect(rows[1][3]).toBe('3. uKsfïl');
  });

  it('defaults to unicode mode when no mode is given', () => {
    expect(buildRows([q({})])).toEqual(buildRows([q({})], 'unicode'));
  });
});
