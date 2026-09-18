import { describe, it, expect } from 'vitest';
import { buildRows } from '@/lib/export/xlsx';
import type { Question } from '@/lib/types';

const q = (over: Partial<Question>): Question => ({
  id: 'x', number: 1, pageIndex: 0, bbox: { x: 0, y: 0, w: 0, h: 0 },
  stem: 'ශ්‍රී ලංකාව', options: ['යාල්පාන', 'සේගරාස', 'මණිමේඛලයි', 'කෛලාය'],
  kind: 'straight', flags: [], correctAnswer: 3, rawLegacy: '', edited: false, ...over,
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
