'use client';
import { useEffect, useRef, useState } from 'react';
import { StepShell } from './StepShell';
import { Checkbox } from '@/components/ui/Checkbox';
import { Thumb } from './Thumb';
import { useWizardPages } from './useWizardPages';
import { useSessionStore } from '@/lib/session/store';
import { suggestAnswerPage } from '@/lib/extract/suggest';

export function AnswerPageStep() {
  const patch = useSessionStore((s) => s.patch);
  const { pages, error } = useWizardPages();
  const [selected, setSelected] = useState<number | null>(null);
  const [noAnswerSheet, setNoAnswerSheet] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (pages && !initialized.current) {
      initialized.current = true;
      setSelected(suggestAnswerPage(pages));
    }
  }, [pages]);

  function handleNoAnswerSheet(v: boolean) {
    setNoAnswerSheet(v);
    if (v) setSelected(null);
  }

  const nextDisabled = !noAnswerSheet && selected === null;

  return (
    <StepShell
      step={3}
      title="Select the answer sheet"
      subtitle="Click the page carrying the answer key, or mark that this paper has none."
      onBack={() => patch({ step: 2 })}
      onNext={() => patch({ answerPage: noAnswerSheet ? null : selected, hasNoAnswerSheet: noAnswerSheet, step: 4 })}
      nextDisabled={nextDisabled}
      nextBlockedReason="Select a page, or mark that there is no answer sheet"
    >
      <div className="mb-4">
        <Checkbox checked={noAnswerSheet} onChange={handleNoAnswerSheet} label="This paper has no answer sheet" />
      </div>
      {error && <p className="text-sm">{error}</p>}
      {!pages && !error && <p className="text-sm text-[#767676]">Loading pages…</p>}
      {pages && (
        <div
          className={`grid gap-4 ${noAnswerSheet ? 'opacity-40 pointer-events-none' : ''}`}
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
        >
          {pages.map((p) => (
            <Thumb key={p.index} page={p} selected={selected === p.index} onClick={() => setSelected(p.index)} />
          ))}
        </div>
      )}
    </StepShell>
  );
}
