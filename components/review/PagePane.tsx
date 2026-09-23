'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useSessionStore } from '@/lib/session/store';
import { loadDocument, renderPageToCanvas } from '@/lib/pdf/loader';
import type { Question } from '@/lib/types';

const SCALE = 1.4;
/** A line's ascender height above its own baseline, in PDF points (see the overlay's `top` comment below). */
const ASCENT_PAD = 9;
/** Cosmetic breathing room around the highlight box, in screen pixels (post-scale). */
const BOX_PAD = 6;
/** Bottom gets less than the other three sides — ASCENT_PAD already gives the top extra room, so a matching bottom pad reads as too much empty space below the last option. */
const BOX_PAD_BOTTOM = 2;

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
      // `bbox.y` is the TOP line's text baseline, not the visual top of its
      // glyphs (pdf.js's item.transform[5], carried straight through by
      // getPositionedItems/groupIntoLines/mergeBBox). Anchoring the box's
      // top there cut straight through the first line's ascenders — visibly
      // confirmed: the outline started mid-way down "05." instead of above
      // it. ASCENT_PAD approximates a line's ascender height above its own
      // baseline (items on this kind of paper run ~12pt tall; ~75% of that
      // is a reasonable ascent) and extends the box by the same amount so
      // the bottom edge — already correct, since mergeBBox's `h` reaches
      // down to the bottom line's descent — doesn't move.
      // BOX_PAD is separate from ASCENT_PAD above: it's pure cosmetic
      // breathing room (a visibly roomier selection box), applied evenly
      // on all four sides in already-scaled screen pixels, rather than a
      // correction for what the text bounds actually mean.
      top: (height - bbox.y - ASCENT_PAD) * SCALE - BOX_PAD,
      left: bbox.x * SCALE - BOX_PAD,
      width: bbox.w * SCALE + BOX_PAD * 2,
      height: (bbox.h + ASCENT_PAD) * SCALE + BOX_PAD + BOX_PAD_BOTTOM,
    };
  }, [activeQuestion, pageHeights]);

  // The one genuine side effect here: scroll the pane so the ENTIRE
  // highlighted question is in view, wherever its page sits in the stacked
  // document.
  //
  // Deliberately uses getBoundingClientRect diffing, not wrapper.offsetTop:
  // offsetTop is relative to the nearest POSITIONED ancestor, and nothing
  // between the page wrapper and this scroll container sets position, so it
  // resolved against <body> instead — a page halfway down a long document
  // produced a huge, wrong number (once even landing above the viewport, so
  // no highlight was visible at all). getBoundingClientRect is relative to
  // the viewport regardless of positioning context, so diffing it against
  // the container's own rect gives the right offset unconditionally.
  useEffect(() => {
    if (!activeQuestion || !overlay) return;
    const wrapper = pageWrapperRefs.current.get(activeQuestion.pageIndex);
    const container = containerRef.current;
    if (!wrapper || !container) return;
    const containerRect = container.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const boxTop = wrapperRect.top - containerRect.top + container.scrollTop + overlay.top;
    const boxBottom = boxTop + overlay.height;
    const margin = 32;
    // Only adjust scroll if the box isn't already fully visible — avoids
    // fighting a question the user is already looking at, and centers a
    // short question with a little breathing room rather than jamming it
    // against the very top of the pane.
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (boxTop < viewTop + margin || boxBottom > viewBottom - margin) {
      const target = boxTop - Math.max((container.clientHeight - overlay.height) / 2, margin);
      container.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' });
    }
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
