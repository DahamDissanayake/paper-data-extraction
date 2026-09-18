import { describe, it, expect } from 'vitest';
import { resolveSessionId } from '@/lib/session/idb';
import { createInitialSession } from '@/lib/session/store';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
    _data: data,
  };
}

describe('resolveSessionId', () => {
  it('mints a new id when storage is empty', () => {
    const s = fakeStorage();
    const { id, isNew } = resolveSessionId(s);
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s._data['paper-session-id']).toBe(id);
  });

  it('reuses an existing id across a refresh', () => {
    const s = fakeStorage({ 'paper-session-id': '11111111-2222-3333-4444-555555555555' });
    const { id, isNew } = resolveSessionId(s);
    expect(isNew).toBe(false);
    expect(id).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(() => resolveSessionId(throwing)).not.toThrow();
  });
});

describe('createInitialSession', () => {
  it('populates every Session field with sensible empty defaults', () => {
    const before = Date.now();
    const session = createInitialSession('11111111-2222-3333-4444-555555555555');
    const after = Date.now();

    expect(session.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
    expect(session.sourceName).toBe('');
    expect(session.sourceKind).toBe('pdf');
    expect(session.questionPages).toEqual([]);
    expect(session.answerPage).toBeNull();
    expect(session.hasNoAnswerSheet).toBe(false);
    expect(session.questions).toEqual([]);
    expect(session.answerKey).toEqual({});
    expect(session.answerKeyUnresolved).toEqual([]);
    expect(session.step).toBe(1);
  });
});
