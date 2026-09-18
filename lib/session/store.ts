'use client';
import { create } from 'zustand';
import type { Session } from '@/lib/types';
import { SESSION_KEY, putSession } from './idb';

interface State {
  session: Session | null;
  sourceBlob: Blob | null;
  setSession: (s: Session, blob?: Blob) => void;
  patch: (p: Partial<Session>) => void;
  /**
   * Same in-memory update as `patch` (applied synchronously, so the UI
   * reflects every keystroke instantly), but the IndexedDB write is
   * debounced: rapid-fire calls (e.g. typing in a QuestionCard field)
   * coalesce into a single `putSession` after the caller pauses for
   * `PATCH_DEBOUNCE_MS`. Added for Task 12's review-workspace edit path,
   * which otherwise re-serialized the whole session + source PDF blob to
   * IndexedDB on every character typed.
   */
  patchDebounced: (p: Partial<Session>) => void;
  /** Writes the current session immediately and cancels any pending debounced write. Call on blur/unmount so a debounced edit is never lost. */
  flushPatch: () => void;
  setStep: (step: Session['step']) => void;
  newSession: () => void;
}

const PATCH_DEBOUNCE_MS = 400;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A fully-populated, empty Session for a freshly minted id. The store itself
 * can't safely touch browser storage at module-eval time, so this is exported
 * as a standalone function: app-mount code resolves the session id first,
 * then either rehydrates via getSession(id) or falls back to
 * setSession(createInitialSession(id)) for a brand-new session.
 */
export function createInitialSession(id: string): Session {
  return {
    id,
    createdAt: Date.now(),
    sourceName: '',
    sourceKind: 'pdf',
    questionPages: [],
    answerPage: null,
    hasNoAnswerSheet: false,
    questions: [],
    answerKey: {},
    answerKeyUnresolved: [],
    step: 1,
  };
}

export const useSessionStore = create<State>((set, get) => ({
  session: null,
  sourceBlob: null,
  setSession: (session, blob) => {
    set({ session, ...(blob ? { sourceBlob: blob } : {}) });
    const b = blob ?? get().sourceBlob;
    if (b) void putSession(session, b);
  },
  patch: (p) => {
    const cur = get().session;
    if (!cur) return;
    // An immediate write supersedes any debounced one still in flight —
    // otherwise the pending timer fires afterwards and writes a second,
    // redundant copy of the same session.
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    get().setSession({ ...cur, ...p });
  },
  patchDebounced: (p) => {
    const cur = get().session;
    if (!cur) return;
    set({ session: { ...cur, ...p } });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const latest = get().session;
      const blob = get().sourceBlob;
      if (latest && blob) void putSession(latest, blob);
    }, PATCH_DEBOUNCE_MS);
  },
  flushPatch: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      const latest = get().session;
      const blob = get().sourceBlob;
      if (latest && blob) void putSession(latest, blob);
    }
  },
  setStep: (step) => get().patch({ step }),
  newSession: () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    location.reload();
  },
}));
