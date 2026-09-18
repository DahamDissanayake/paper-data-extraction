'use client';
import { create } from 'zustand';
import type { Session } from '@/lib/types';
import { SESSION_KEY, putSession } from './idb';

interface State {
  session: Session | null;
  sourceBlob: Blob | null;
  setSession: (s: Session, blob?: Blob) => void;
  patch: (p: Partial<Session>) => void;
  setStep: (step: Session['step']) => void;
  newSession: () => void;
}

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
    get().setSession({ ...cur, ...p });
  },
  setStep: (step) => get().patch({ step }),
  newSession: () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    location.reload();
  },
}));
