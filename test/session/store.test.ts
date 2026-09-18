import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const putSessionMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/session/idb', () => ({
  SESSION_KEY: 'paper-session-id',
  putSession: (...args: unknown[]) => putSessionMock(...args),
}));

import { useSessionStore, createInitialSession } from '@/lib/session/store';

const SESSION_ID = '11111111-2222-3333-4444-555555555555';

function seedStore() {
  const session = createInitialSession(SESSION_ID);
  const blob = new Blob(['x']);
  useSessionStore.getState().setSession(session, blob);
  putSessionMock.mockClear(); // drop the write from seeding itself
}

describe('useSessionStore: debounced persistence (Task 12 fix)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    putSessionMock.mockClear();
    useSessionStore.setState({ session: null, sourceBlob: null });
    seedStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates in-memory session state immediately, without writing to IndexedDB', () => {
    useSessionStore.getState().patchDebounced({ sourceName: 'a' });
    expect(useSessionStore.getState().session?.sourceName).toBe('a');
    expect(putSessionMock).not.toHaveBeenCalled();
  });

  it('coalesces rapid successive edits into a single IndexedDB write', () => {
    const { patchDebounced } = useSessionStore.getState();
    patchDebounced({ sourceName: 'a' });
    vi.advanceTimersByTime(100);
    patchDebounced({ sourceName: 'ab' });
    vi.advanceTimersByTime(100);
    patchDebounced({ sourceName: 'abc' });

    // Still within the debounce window from the last keystroke: no write yet.
    expect(putSessionMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(putSessionMock).toHaveBeenCalledTimes(1);
    expect(putSessionMock.mock.calls[0][0].sourceName).toBe('abc');
  });

  it('flushPatch writes immediately and cancels the pending debounced write', () => {
    useSessionStore.getState().patchDebounced({ sourceName: 'x' });
    useSessionStore.getState().flushPatch();
    expect(putSessionMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    // The debounce timer that was pending before the flush must not also fire.
    expect(putSessionMock).toHaveBeenCalledTimes(1);
  });

  it('flushPatch is a no-op when nothing is pending', () => {
    useSessionStore.getState().flushPatch();
    expect(putSessionMock).not.toHaveBeenCalled();
  });

  it('regular patch() is unchanged: it still persists immediately on every call', () => {
    useSessionStore.getState().patch({ sourceName: 'immediate' });
    expect(putSessionMock).toHaveBeenCalledTimes(1);
    useSessionStore.getState().patch({ sourceName: 'immediate-2' });
    expect(putSessionMock).toHaveBeenCalledTimes(2);
  });

  it('patch() also cancels a pending debounced write', () => {
    useSessionStore.getState().patchDebounced({ sourceName: 'typed' });
    useSessionStore.getState().patch({ sourceName: 'committed' });
    expect(putSessionMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    // The stale debounce timer must not fire a second, redundant write.
    expect(putSessionMock).toHaveBeenCalledTimes(1);
    expect(putSessionMock.mock.calls[0][0].sourceName).toBe('committed');
  });
});
