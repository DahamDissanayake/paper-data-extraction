'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/session/store';
import { runExtraction } from '@/lib/extract/runPipeline';
import { PagePane } from './PagePane';
import { QuestionCard } from './QuestionCard';
import { AnswerKeyGrid } from './AnswerKeyGrid';
import { ExportBar } from './ExportBar';
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
  const [activeTab, setActiveTab] = useState<Tab>('straight');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  // Lazily seeded from the session at mount: if this session already has
  // questions (revisiting step 4), the workspace should render "done"
  // immediately rather than flashing "loading" and waiting on an effect.
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>(
    () => (session && session.questions.length > 0 ? 'done' : 'loading'),
  );
  const ranRef = useRef(false);

  useEffect(() => {
    if (!session || !sourceBlob || ranRef.current) return;

    if (session.questions.length > 0) {
      ranRef.current = true;
      return;
    }

    ranRef.current = true;
    (async () => {
      try {
        const result = await runExtraction(session, sourceBlob);
        patch({
          questions: result.questions,
          answerKey: result.answerKey,
          answerKeyUnresolved: result.unresolved,
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

  function updateQuestion(id: string, partial: Partial<Question>) {
    if (!session) return;
    patch({
      questions: session.questions.map((q) => (q.id === id ? { ...q, ...partial, edited: true } : q)),
    });
  }

  function setAnswerForNumber(number: number, value: OptionIndex | null) {
    if (!session) return;
    const nextKey = { ...session.answerKey };
    if (value == null) delete nextKey[number];
    else nextKey[number] = value;
    patch({
      answerKey: nextKey,
      answerKeyUnresolved: session.answerKeyUnresolved.filter((n) => n !== number),
      questions: session.questions.map((q) =>
        q.number === number ? { ...q, correctAnswer: value, edited: true } : q,
      ),
    });
  }

  if (!session || !sourceBlob) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#767676]">Missing source file — go back and re-upload.</p>
      </main>
    );
  }

  const answerKeyCount = Object.keys(session.answerKey).length;
  const countFor = (t: Tab) => (t === 'answerKey' ? answerKeyCount : grouped[t].length);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#E5E5E5] px-6 py-4">
        <p className="text-xs tracking-widest uppercase text-[#767676]">Review</p>
        <h1 className="text-xl mt-1">Verify extracted questions</h1>
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
