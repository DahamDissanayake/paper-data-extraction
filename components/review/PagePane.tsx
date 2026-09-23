'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useSessionStore } from '@/lib/session/store';
import { loadDocument, renderPageToCanvas } from '@/lib/pdf/loader';
import type { Question } from '@/lib/types';

const SCALE = 1.4;

interface Overlay { top: number; left: number; width: number; height: number; }

/**
 * Renders every page of the source PDF, stacked and scrollable, with an
 * outline over the active question's bbox on whichever page it's on.
 *
 * Used to render only the active question's page in a single canvas, which
 * made it impossible to browse the rest of the source PDF while reviewing —
 * scrolling did nothing past that one page. Rendering the whole document up
 * front (typical exam papers run well under 20 pages) and scrolling to the
 * active question's position within it fixes that while keeping the same
 * "jump to the selected question" behavior.
 *
 * The PDF coordinate origin is bottom-left (y grows upward), while CSS
 * `top` grows downward from a page's own canvas. So within a page, the
 * outline's `top` is `(unscaledPageHeight - bbox.y) * SCALE`, where
 * `unscaledPageHeight` is that page's height in PDF units (i.e. its
 * viewport height at scale 1) — computed per page since a source PDF can
 * mix page sizes.
 */
export function PagePane({ activeQuestion }: { activeQuestion: Question | null }) {
  const sourceBlob = useSessionStore((s) => s.sourceBlob);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const pageWrapperRefs = useRef(new Map<number, HTMLDivElement>());
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sourceBlob) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await sourceBlob.arrayBuffer();
        const d = await loadDocument(buf);
        if (cancelled) return;
        setDoc(d);
        setNumPages(d.numPages);
      } catch {
        if (!cancelled) setError('Could not load the source PDF.');
      }
    })();
    return () => { cancelled = true; };
  }, [sourceBlob]);

  // Renders every page in order into its own canvas (the refs already exist
  // once `numPages` drives the JSX below). Sequential, not parallel, so a
  // page's wrapper div has its final on-screen height — and therefore a
  // stable offsetTop — by the time any LATER page (or the scroll effect
  // below) needs to measure it.
  useEffect(() => {
    if (!doc || numPages === 0) return;
    let cancelled = false;
    (async () => {
      try {
        for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
          const canvas = canvasRefs.current.get(pageIndex);
          if (!canvas) continue;
          const unscaled = await renderPageToCanvas(doc, pageIndex, SCALE, canvas);
          if (cancelled) return;
          setPageHeights((prev) => ({ ...prev, [pageIndex]: unscaled.height }));
        }
        if (!cancelled) setError('');
      } catch {
        if (!cancelled) setError('Could not render the PDF.');
      }
    })();
    return () => { cancelled = true; };
  }, [doc, numPages]);

  // Pure derived value — no setState needed, this recomputes on every
  // render where its inputs change.
  const overlay = useMemo<Overlay | null>(() => {
    if (!activeQuestion) return null;
    const height = pageHeights[activeQuestion.pageIndex];
    if (height == null) return null;
    const { bbox } = activeQuestion;
    return {
      top: (height - bbox.y) * SCALE,
      left: bbox.x * SCALE,
      width: bbox.w * SCALE,
      height: bbox.h * SCALE,
    };
  }, [activeQuestion, pageHeights]);

  // The one genuine side effect here: scroll the pane so the highlighted
  // question is in view, wherever its page sits in the stacked document.
  useEffect(() => {
    if (!activeQuestion || !overlay) return;
    const wrapper = pageWrapperRefs.current.get(activeQuestion.pageIndex);
    if (!wrapper || !containerRef.current) return;
    const top = wrapper.offsetTop + overlay.top - 96;
    containerRef.current.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }, [activeQuestion, overlay]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-[#FAFAFA]">
      {error && <p className="text-sm text-[#767676] p-4">{error}</p>}
      <div className="flex flex-col items-start">
        {Array.from({ length: numPages }, (_, pageIndex) => (
          <div key={pageIndex} className="m-4">
            <div className="text-xs text-[#767676] mb-1">Page {pageIndex + 1}</div>
            <div
              ref={(el) => {
                if (el) pageWrapperRefs.current.set(pageIndex, el);
                else pageWrapperRefs.current.delete(pageIndex);
              }}
              className="relative inline-block"
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(pageIndex, el);
                  else canvasRefs.current.delete(pageIndex);
                }}
                className="block shadow-sm"
              />
              {activeQuestion?.pageIndex === pageIndex && overlay && (
                <div
                  className="absolute border-2 border-[#0A0A0A] pointer-events-none"
                  style={{ top: overlay.top, left: overlay.left, width: overlay.width, height: overlay.height }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
