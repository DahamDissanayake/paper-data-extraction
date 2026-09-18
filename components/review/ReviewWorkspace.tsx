'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/session/store';
import { runExtraction } from '@/lib/extract/runPipeline';
import { extractionKey } from '@/lib/extract/resume';
import { PagePane } from './PagePane';
import { QuestionCard } from './QuestionCard';
import { AnswerKeyGrid } from './AnswerKeyGrid';
import { ExportBar } from './ExportBar';
import { Button } from '@/components/ui/Button';
import type { OptionIndex, Question, QuestionKind } from '@/lib/types';

type Tab = QuestionKind | 'answerKey';

const TAB_ORDER: Tab[] = ['straight', 'special', 'figure', 'answerKey'];
const TAB_LABELS: Record<Tab, string> = {
  straight: 'Straight',
  special: 'Special',
  figure: 'Figure',
  answerKey: 'Answer key',
};

/**
 * The two-pane review workspace: source page on the left (PagePane), an
 * editable, tabbed list of extracted questions on the right.
 *
 * Runs the real extraction pipeline once on mount (guarded so a remount or
 * a re-render never re-runs it against an already-populated session), then
 * lets every edit flow back into the session store via `patch`.
 */
export function ReviewWorkspace() {
  const session = useSessionStore((s) => s.session);
  const sourceBlob = useSessionStore((s) => s.sourceBlob);
  const patch = useSessionStore((s) => s.patch);
  const patchDebounced = useSessionStore((s) => s.patchDebounced);
  const flushPatch = useSessionStore((s) => s.flushPatch);
  const newSession = useSessionStore((s) => s.newSession);
  const [activeTab, setActiveTab] = useState<Tab>('straight');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  // Lazily seeded from the session at mount: if this session already has
  // questions (revisiting step 4), the workspace should render "done"
  // immediately rather than flashing "loading" and waiting on an effect.
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>(
    () => (session && session.questions.length > 0 && session.extractedFor === extractionKey(session)
      ? 'done'
      : 'loading'),
  );
  /**
   * The page selection the results on screen belong to — not a plain
   * "already ran" boolean. A boolean meant that going back, changing the
   * question or answer pages, and returning to step 4 showed stale results
   * from the OLD selection; keying off the selection itself re-extracts
   * whenever it genuinely changes, while a remount or a refresh with the
   * same selection still does not.
   */
  const ranForKey = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !sourceBlob) return;

    const key = extractionKey(session);
    if (ranForKey.current === key) return;

    // A refresh rehydrates questions from IndexedDB; only trust them when
    // they belong to the selection that is current now.
    if (ranForKey.current === null && session.questions.length > 0
        && session.extractedFor === key) {
      ranForKey.current = key;
      setStatus('done');
      return;
    }

    ranForKey.current = key;
    setStatus('loading');
    (async () => {
      try {
        const result = await runExtraction(session, sourceBlob);
        patch({
          questions: result.questions,
          answerKey: result.answerKey,
          answerKeyUnresolved: result.unresolved,
          ocrFailedPages: result.ocrFailedPages,
          extractedFor: key ?? undefined,
        });
        setStatus('done');
      } catch (err) {
        console.error('Extraction failed', err);
        setStatus('error');
      }
    })();
  }, [session, sourceBlob, patch]);

  const questions = useMemo(() => session?.questions ?? [], [session]);

  const grouped = useMemo(() => {
    const byKind: Record<QuestionKind, Question[]> = { straight: [], special: [], figure: [] };
    for (const q of [...questions].sort((a, b) => a.number - b.number)) byKind[q.kind].push(q);
    return byKind;
  }, [questions]);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId) ?? null;

  // Edits here happen per keystroke, so the IndexedDB write is debounced
  // (see lib/session/store.ts#patchDebounced) — the in-memory session, and
  // therefore the UI, still updates synchronously on every change.
  function updateQuestion(id: string, partial: Partial<Question>) {
    if (!session) return;
    patchDebounced({
      questions: session.questions.map((q) => (q.id === id ? { ...q, ...partial, edited: true } : q)),
    });
  }

  function setAnswerForNumber(number: number, value: OptionIndex | null) {
    if (!session) return;
    const nextKey = { ...session.answerKey };
    if (value == null) delete nextKey[number];
    else nextKey[number] = value;
    patchDebounced({
      answerKey: nextKey,
      answerKeyUnresolved: session.answerKeyUnresolved.filter((n) => n !== number),
      questions: session.questions.map((q) =>
        q.number === number ? { ...q, correctAnswer: value, edited: true } : q,
      ),
    });
  }

  // Safety net for the debounced writes above: flush immediately if the tab
  // is about to close/hide, and on unmount, so a pending edit is never lost.
  useEffect(() => {
    window.addEventListener('beforeunload', flushPatch);
    return () => {
      window.removeEventListener('beforeunload', flushPatch);
      flushPatch();
    };
  }, [flushPatch]);

  // Once step 4 is reached there was previously no way back to page/answer
  // selection, and no way to start over — reported directly by a user.
  // Going back clears the already-extracted results (rather than just
  // changing `step`) so that, if the user changes the page/answer-page
  // selection and returns to step 4, ReviewWorkspace's mount effect above
  // (guarded on `session.questions.length > 0`) re-runs extraction instead
  // of silently showing stale results from the old selection.
  function goBackToAnswerPage() {
    if (!confirm('Go back to page selection? The current extraction results will be discarded.')) return;
    patch({ step: 3, questions: [], answerKey: {}, answerKeyUnresolved: [] });
  }

  function startNewSession() {
    if (!confirm('Start a new session? This clears the current paper and all your edits.')) return;
    newSession();
  }

  if (!session || !sourceBlob) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#767676]">Missing source file — go back and re-upload.</p>
      </main>
    );
  }

  const ocrFailedPages = session.ocrFailedPages ?? [];
  const answerKeyCount = Object.keys(session.answerKey).length;
  const countFor = (t: Tab) => (t === 'answerKey' ? answerKeyCount : grouped[t].length);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest uppercase text-[#767676]">Review</p>
          <h1 className="text-xl mt-1">Verify extracted questions</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={goBackToAnswerPage} data-testid="back-to-answer-page">
            Back to page selection
          </Button>
          <Button variant="ghost" onClick={startNewSession} data-testid="new-session">
            Start new session
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div style={{ width: '45%' }} className="border-r border-[#E5E5E5] overflow-hidden shrink-0">
          <PagePane activeQuestion={activeQuestion} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div role="tablist" className="flex border-b border-[#E5E5E5] shrink-0">
            {TAB_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={activeTab === t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-3 text-sm transition-colors ${
                  activeTab === t
                    ? 'border-b-2 border-[#0A0A0A] text-[#0A0A0A]'
                    : 'text-[#767676] hover:text-[#0A0A0A]'
                }`}
              >
                {TAB_LABELS[t]} ({countFor(t)})
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {ocrFailedPages.length > 0 && (
              <p className="border border-[#E5E5E5] px-3 py-2 mb-4 text-sm text-[#0A0A0A]">
                Text recognition failed on page{ocrFailedPages.length > 1 ? 's' : ''}{' '}
                {ocrFailedPages.map((p) => p + 1).join(', ')}. Questions on{' '}
                {ocrFailedPages.length > 1 ? 'those pages' : 'that page'} are missing from this list.
              </p>
            )}
            {status === 'loading' && <p className="text-sm text-[#767676]">Extracting questions…</p>}
            {status === 'error' && (
              <p className="text-sm text-[#767676]">Extraction failed. Try re-uploading the PDF.</p>
            )}

            {status === 'done' && activeTab !== 'answerKey' && (
              grouped[activeTab].length === 0 ? (
                <p className="text-sm text-[#767676]">No {TAB_LABELS[activeTab].toLowerCase()} questions.</p>
              ) : (
                grouped[activeTab].map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    active={q.id === activeQuestionId}
                    onSelect={() => setActiveQuestionId(q.id)}
                    onChange={(partial) => updateQuestion(q.id, partial)}
                  />
                ))
              )
            )}

            {status === 'done' && activeTab === 'answerKey' && (
              <AnswerKeyGrid
                answerKey={session.answerKey}
                unresolved={session.answerKeyUnresolved}
                onSetAnswer={setAnswerForNumber}
              />
            )}
          </div>
        </div>
      </div>

      <ExportBar questions={questions} unresolvedCount={session.answerKeyUnresolved.length} />
    </div>
  );
}
