import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PositionedItem, Session } from '@/lib/types';

const pg1: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg1.items.json', 'utf8'));
const pg11: PositionedItem[] = JSON.parse(fs.readFileSync('test/fixtures/pg11.items.json', 'utf8'));

// runExtraction is pure orchestration over three pdf.js-backed boundaries
// (loadDocument/getPositionedItems/getImageRegions). The rest of this repo's
// pdf.js-adjacent tests avoid ever invoking pdf.js itself under vitest (see
// test/pdf/textLayer.test.ts and test/pdf/images.test.ts, which read
// pre-dumped fixtures instead of calling the real functions) because pdf.js
// needs a worker/DOM-ish environment this project's plain node test
// environment doesn't provide. So here the three boundary modules are
// mocked outright, and only runExtraction's own branching/wiring logic is
// exercised — assemble()'s question-building logic is already covered by
// test/extract/pipeline.test.ts.
const loadDocumentMock = vi.fn();
const getPositionedItemsMock = vi.fn();
const getImageRegionsMock = vi.fn();

vi.mock('@/lib/pdf/loader', () => ({
  loadDocument: (...args: unknown[]) => loadDocumentMock(...args),
}));
vi.mock('@/lib/pdf/textLayer', () => ({
  getPositionedItems: (...args: unknown[]) => getPositionedItemsMock(...args),
}));
vi.mock('@/lib/pdf/images', () => ({
  getImageRegions: (...args: unknown[]) => getImageRegionsMock(...args),
}));

// needsOcr is pure logic (no I/O) so the real implementation runs here —
// only recogniseDocPage (which touches document/canvas/pdf.js rendering)
// is mocked, the same way the pdf.js-boundary modules above are mocked.
const recogniseDocPageMock = vi.fn();
vi.mock('@/lib/ocr/tesseract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ocr/tesseract')>();
  return {
    ...actual,
    recogniseDocPage: (...args: unknown[]) => recogniseDocPageMock(...args),
  };
});

import { runExtraction } from '@/lib/extract/runPipeline';

const fakeDoc = { __brand: 'fake-doc' } as unknown as PDFDocumentProxy;

function fakeBlob(): Blob {
  return { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob;
}

function baseSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    createdAt: Date.now(),
    sourceName: 'x.pdf',
    sourceKind: 'pdf',
    questionPages: [0],
    answerPage: 10,
    hasNoAnswerSheet: false,
    questions: [],
    answerKey: {},
    answerKeyUnresolved: [],
    step: 4,
    ...overrides,
  };
}

beforeEach(() => {
  loadDocumentMock.mockReset().mockResolvedValue(fakeDoc);
  getPositionedItemsMock.mockReset();
  getImageRegionsMock.mockReset().mockResolvedValue([]);
  recogniseDocPageMock.mockReset().mockResolvedValue([]);
});

describe('runExtraction', () => {
  it('happy path: loads the doc once, fetches every question page + the answer page, and assembles the result', async () => {
    getPositionedItemsMock.mockImplementation(async (_doc: unknown, index: number) => {
      if (index === 0) return pg1;
      if (index === 10) return pg11;
      return [];
    });

    const session = baseSession({ questionPages: [0, 1], answerPage: 10, hasNoAnswerSheet: false });
    const result = await runExtraction(session, fakeBlob());

    expect(loadDocumentMock).toHaveBeenCalledTimes(1);

    // Per-question-page fetches (items + images), plus the answer page's items.
    expect(getPositionedItemsMock).toHaveBeenCalledWith(fakeDoc, 0);
    expect(getPositionedItemsMock).toHaveBeenCalledWith(fakeDoc, 1);
    expect(getPositionedItemsMock).toHaveBeenCalledWith(fakeDoc, 10);
    expect(getImageRegionsMock).toHaveBeenCalledWith(fakeDoc, 0);
    expect(getImageRegionsMock).toHaveBeenCalledWith(fakeDoc, 1);
    // Images are never fetched for the answer page.
    expect(getImageRegionsMock).not.toHaveBeenCalledWith(fakeDoc, 10);

    // Per-page results got assembled correctly (page 0 -> 7 real questions,
    // page 1 contributed nothing, answers resolved from the answer page).
    expect(result.questions).toHaveLength(7);
    expect(result.questions.map((q) => q.correctAnswer)).toEqual([3, 2, 1, 3, 2, 4, 3]);
  });

  it('hasNoAnswerSheet: true skips fetching the answer page entirely, and leaves every answer null', async () => {
    getPositionedItemsMock.mockImplementation(async (_doc: unknown, index: number) => (
      index === 0 ? pg1 : []
    ));

    const session = baseSession({ questionPages: [0], answerPage: 10, hasNoAnswerSheet: true });
    const result = await runExtraction(session, fakeBlob());

    expect(getPositionedItemsMock).toHaveBeenCalledTimes(1);
    expect(getPositionedItemsMock).not.toHaveBeenCalledWith(fakeDoc, 10);
    expect(result.questions).toHaveLength(7);
    expect(result.questions.every((q) => q.correctAnswer === null)).toBe(true);
  });

  it('answerPage: null also skips the answer-page fetch, even when hasNoAnswerSheet is false', async () => {
    getPositionedItemsMock.mockImplementation(async (_doc: unknown, index: number) => (
      index === 0 ? pg1 : []
    ));

    const session = baseSession({ questionPages: [0], answerPage: null, hasNoAnswerSheet: false });
    await runExtraction(session, fakeBlob());

    expect(getPositionedItemsMock).toHaveBeenCalledTimes(1);
  });

  it('OCR branch: a question page whose text-layer items fail needsOcr gets its items replaced by recogniseDocPage output, tagged ocr', async () => {
    getPositionedItemsMock.mockImplementation(async (_doc: unknown, index: number) => {
      // Page 1's text layer is near-empty (image-only page) -> needsOcr(items) is true.
      if (index === 1) return pg1.slice(0, 3);
      return [];
    });
    recogniseDocPageMock.mockResolvedValue(pg1);

    const session = baseSession({ questionPages: [1], answerPage: null, hasNoAnswerSheet: true });
    const result = await runExtraction(session, fakeBlob());

    expect(recogniseDocPageMock).toHaveBeenCalledWith(fakeDoc, 1);
    // OCR output (the full pg1 fixture) replaced the near-empty text-layer items.
    expect(result.questions).toHaveLength(7);
    expect(result.questions.every((q) => q.pageIndex === 1)).toBe(true);
    expect(result.questions.every((q) => q.flags.includes('ocr'))).toBe(true);
  });

  it('does not call recogniseDocPage for a page with a real text layer', async () => {
    getPositionedItemsMock.mockImplementation(async (_doc: unknown, index: number) => (
      index === 0 ? pg1 : []
    ));

    const session = baseSession({ questionPages: [0], answerPage: null, hasNoAnswerSheet: true });
    const result = await runExtraction(session, fakeBlob());

    expect(recogniseDocPageMock).not.toHaveBeenCalled();
    expect(result.questions.every((q) => !q.flags.includes('ocr'))).toBe(true);
  });
});
