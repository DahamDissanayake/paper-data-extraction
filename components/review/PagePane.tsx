'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useSessionStore } from '@/lib/session/store';
import { loadDocument, renderPageToCanvas } from '@/lib/pdf/loader';
import type { Question } from '@/lib/types';

const SCALE = 1.4;

interface Overlay { top: number; left: number; width: number; height: number; }

/**
 * Renders the source page for the currently active question at a readable
 * scale (1.4x — the wizard's thumbnail hook uses 0.3x, far too small to
 * verify text against), with an outline over the question's bbox.
 *
 * The PDF coordinate origin is bottom-left (y grows upward), while CSS
 * `top` grows downward from the canvas's top-left. So the outline's `top`
 * is `(unscaledPageHeight - bbox.y) * SCALE`, where `unscaledPageHeight` is
 * the page's height in PDF units (i.e. its viewport height at scale 1).
 */
export function PagePane({ activeQuestion }: { activeQuestion: Question | null }) {
  const sourceBlob = useSessionStore((s) => s.sourceBlob);
  const session = useSessionStore((s) => s.session);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const [unscaledHeight, setUnscaledHeight] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sourceBlob) return;
    let cancelled = false;
    (async () => {
      try {
        const buf = await sourceBlob.arrayBuffer();
        const d = await loadDocument(buf);
        if (!cancelled) setDoc(d);
      } catch {
        if (!cancelled) setError('Could not load the source PDF.');
      }
    })();
    return () => { cancelled = true; };
  }, [sourceBlob]);

  const targetPage = activeQuestion?.pageIndex ?? session?.questionPages[0] ?? null;

  useEffect(() => {
    if (!doc || targetPage == null) return;
    let cancelled = false;
    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // renderPageToCanvas already has the page; it hands back the scale-1
        // viewport so this doesn't call doc.getPage() a second time for it.
        const unscaled = await renderPageToCanvas(doc, targetPage, SCALE, canvas);
        if (cancelled) return;
        setUnscaledHeight(unscaled.height);
        setRenderedPage(targetPage);
        // Clear any error from an earlier page: without this a stale message
        // lingered above a page that had just rendered perfectly well.
        setError('');
      } catch {
        if (!cancelled) setError('Could not render the page.');
      }
    })();
    return () => { cancelled = true; };
  }, [doc, targetPage]);

  // Pure derived value — no setState needed, this recomputes on every
  // render where its inputs change.
  const overlay = useMemo<Overlay | null>(() => {
    if (!activeQuestion || unscaledHeight == null || activeQuestion.pageIndex !== renderedPage) {
      return null;
    }
    const { bbox } = activeQuestion;
    return {
      top: (unscaledHeight - bbox.y) * SCALE,
      left: bbox.x * SCALE,
      width: bbox.w * SCALE,
      height: bbox.h * SCALE,
    };
  }, [activeQuestion, unscaledHeight, renderedPage]);

  // The one genuine side effect here: scroll the pane so the highlighted
  // question is in view.
  useEffect(() => {
    if (!overlay) return;
    containerRef.current?.scrollTo({ top: Math.max(overlay.top - 96, 0), behavior: 'smooth' });
  }, [overlay]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-[#FAFAFA]">
      {error && <p className="text-sm text-[#767676] p-4">{error}</p>}
      <div className="relative inline-block m-4">
        <canvas ref={canvasRef} className="block shadow-sm" />
        {overlay && (
          <div
            className="absolute border-2 border-[#0A0A0A] pointer-events-none"
            style={{ top: overlay.top, left: overlay.left, width: overlay.width, height: overlay.height }}
          />
        )}
      </div>
      {renderedPage != null && (
        <div className="sticky bottom-0 left-0 bg-white/90 border-t border-[#E5E5E5] text-xs text-[#767676] px-3 py-1.5">
          Page {renderedPage + 1}
        </div>
      )}
    </div>
  );
}
