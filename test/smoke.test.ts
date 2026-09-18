import { describe, it, expect } from 'vitest';
import type { Question } from '@/lib/types';

describe('scaffold', () => {
  it('exposes the shared Question type', () => {
    const q: Question = {
      id: 'q1', number: 1, pageIndex: 0,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      stem: '', options: [], kind: 'straight', flags: [],
      correctAnswer: null, rawLegacy: '', edited: false,
    };
    expect(q.number).toBe(1);
  });
});
