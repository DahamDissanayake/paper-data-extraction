'use client';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { StepShell } from './StepShell';
import { Thumb } from './Thumb';
import { useWizardPages } from './useWizardPages';
import { useSessionStore } from '@/lib/session/store';
import { suggestQuestionPages } from '@/lib/extract/suggest';
import { needsOcr } from '@/lib/ocr/tesseract';

export function PageSelectStep() {
  const patch = useSessionStore((s) => s.patch);
  const { pages, error } = useWizardPages();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const initialized = useRef(false);
  const lastClicked = useRef<number | null>(null);

  useEffect(() => {
    if (pages && !initialized.current) {
      initialized.current = true;
      setSelected(new Set(suggestQuestionPages(pages)));
    }
  }, [pages]);

  function toggle(index: number, shiftKey: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked.current !== null) {
        const lo = Math.min(lastClicked.current, index);
        const hi = Math.max(lastClicked.current, index);
        const shouldSelect = !prev.has(index);
        for (let i = lo; i <= hi; i++) {
          if (shouldSelect) next.add(i);
          else next.delete(i);
        }
      } else if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    lastClicked.current = index;
  }

  return (
    <StepShell
      step={2}
      title="Select the question pages"
      subtitle="Click a page to toggle it. Shift-click to select a range."
      onBack={() => patch({ step: 1 })}
      onNext={() => patch({ questionPages: [...selected].sort((a, b) => a - b), step: 3 })}
      nextDisabled={selected.size === 0}
      nextBlockedReason="Select at least one page"
    >
      {error && <p className="text-sm">{error}</p>}
      {!pages && !error && <p className="text-sm text-[#767676]">Loading pages…</p>}
      {pages && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {pages.map((p) => (
            <Thumb
              key={p.index}
              page={p}
              selected={selected.has(p.index)}
              ocr={needsOcr(p.items)}
              onClick={(e: MouseEvent<HTMLButtonElement>) => toggle(p.index, e.shiftKey)}
            />
          ))}
        </div>
      )}
    </StepShell>
  );
}
