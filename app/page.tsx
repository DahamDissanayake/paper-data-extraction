'use client';
import { useEffect, useState } from 'react';
import { deleteAllExcept, getSession, resolveSessionId } from '@/lib/session/idb';
import { createInitialSession, useSessionStore } from '@/lib/session/store';
import { UploadStep } from '@/components/wizard/UploadStep';
import { PageSelectStep } from '@/components/wizard/PageSelectStep';
import { AnswerPageStep } from '@/components/wizard/AnswerPageStep';

export default function Home() {
  const session = useSessionStore((s) => s.session);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let sessionResult: { id: string; isNew: boolean };
      try {
        sessionResult = resolveSessionId(sessionStorage);
      } catch {
        // Referencing the bare `sessionStorage` global can itself throw
        // synchronously in some privacy configurations (Safari's "Block
        // All Cookies", a sandboxed iframe without allow-same-origin,
        // etc.) — this is outside resolveSessionId's own try/catch, which
        // only guards its internal getItem/setItem calls. Fall back to an
        // in-memory session so the UI never gets stuck on "Loading…".
        sessionResult = { id: crypto.randomUUID(), isNew: true };
      }
      const { id, isNew } = sessionResult;
      // Fire-and-forget: an abandoned session's IndexedDB row should never
      // outlive its tab, but this cleanup shouldn't block first paint.
      void deleteAllExcept(id);

      const restored = isNew ? undefined : await getSession(id);
      if (cancelled) return;

      if (restored) {
        useSessionStore.getState().setSession(restored.session, restored.blob);
      } else {
        // Either a genuinely new tab, or the id survived in sessionStorage
        // but IndexedDB had nothing for it (e.g. a private-window edge
        // case) — either way, start from a fresh empty session.
        useSessionStore.getState().setSession(createInitialSession(id));
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#767676]">Loading…</p>
      </main>
    );
  }

  switch (session.step) {
    case 1:
      return <UploadStep />;
    case 2:
      return <PageSelectStep />;
    case 3:
      return <AnswerPageStep />;
    default:
      return (
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-[#767676]">Review workspace coming soon.</p>
        </main>
      );
  }
}
