'use client';
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { PageThumb } from './useWizardPages';

export function Thumb({ page, selected, ocr, onClick }: {
  page: PageThumb;
  selected: boolean;
  ocr?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // pdf.js throws if two render() calls target the same canvas
    // concurrently. React's dev-mode Strict Mode double-invokes this
    // effect (mount, cleanup, mount) before either async draw settles, so
    // the actual draw is deferred a microtask past setup: the first
    // invocation's cleanup flips `cancelled` before its queued draw runs,
    // leaving only the second invocation's draw to actually call render().
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return page.draw(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`border p-2 flex flex-col items-center gap-1 text-xs transition-colors ${
        selected ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#E5E5E5] hover:bg-[#FAFAFA]'
      }`}
    >
      <div className="relative w-full">
        <canvas ref={ref} className="max-w-full" />
        {ocr && (
          <span className="absolute top-1 right-1 border border-[#E5E5E5] bg-[#FFFFFF] text-[#0A0A0A] text-[10px] leading-none px-1 py-0.5">
            OCR
          </span>
        )}
      </div>
      <span className={selected ? 'text-white' : undefined}>{page.index + 1}</span>
    </button>
  );
}
