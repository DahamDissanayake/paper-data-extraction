'use client';
import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/session/store';
import { loadDocument, renderPageToCanvas } from '@/lib/pdf/loader';
import { getPositionedItems } from '@/lib/pdf/textLayer';
import type { PositionedItem } from '@/lib/types';

export interface PageThumb {
  index: number;
  items: PositionedItem[];
  draw: (canvas: HTMLCanvasElement) => Promise<void>;
}

/**
 * Loads the uploaded source into per-page thumbnails + text items.
 *
 * PDF sources render every page via pdf.js at a fixed thumbnail scale and
 * also expose that page's positioned text items (for the suggest.ts
 * heuristics). Image sources have no text layer to suggest from, and
 * UploadStep (Task 11 Step 7, given verbatim) only threads the *first*
 * selected file through to `sourceBlob` today, so a multi-image upload
 * currently surfaces as a single page here. That is a limitation inherited
 * from the given upload code, not something this hook can fix.
 */
export function useWizardPages() {
  const session = useSessionStore((s) => s.session);
  const sourceBlob = useSessionStore((s) => s.sourceBlob);
  const [pages, setPages] = useState<PageThumb[] | null>(null);
  const [error, setError] = useState('');
  const loadedFor = useRef<{ blob: Blob; kind: string } | null>(null);

  const sourceKind = session?.sourceKind;

  useEffect(() => {
    let cancelled = false;
    const isNewSource = loadedFor.current?.blob !== sourceBlob || loadedFor.current?.kind !== sourceKind;
    if (isNewSource) {
      loadedFor.current = sourceBlob && sourceKind ? { blob: sourceBlob, kind: sourceKind } : null;
      setPages(null);
      setError('');
    }
    if (!sourceBlob || !sourceKind) return;

    (async () => {
      try {
        if (sourceKind === 'pdf') {
          const buf = await sourceBlob.arrayBuffer();
          const doc = await loadDocument(buf);
          const items = await Promise.all(
            Array.from({ length: doc.numPages }, (_, i) => getPositionedItems(doc, i)),
          );
          if (cancelled) return;
          setPages(
            items.map((its, index) => ({
              index,
              items: its,
              draw: async (canvas: HTMLCanvasElement) => {
                // Thumbnails don't need the page size renderPageToCanvas
                // returns; discard it to keep PageThumb.draw void-returning.
                await renderPageToCanvas(doc, index, 0.3, canvas);
              },
            })),
          );
        } else {
          const bitmap = await createImageBitmap(sourceBlob);
          if (cancelled) return;
          setPages([
            {
              index: 0,
              items: [],
              draw: async (canvas: HTMLCanvasElement) => {
                canvas.width = Math.round(bitmap.width * 0.3);
                canvas.height = Math.round(bitmap.height * 0.3);
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              },
            },
          ]);
        }
      } catch {
        if (!cancelled) setError('Could not read the uploaded file.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceBlob, sourceKind]);

  return { pages, error };
}
