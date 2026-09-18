import { describe, it, expect } from 'vitest';
import { resumeQuestionPages, resumeAnswerChoice, extractionKey } from '@/lib/extract/resume';
import type { Session } from '@/lib/types';

const session = (over: Partial<Session> = {}): Session => ({
  id: 's', createdAt: 0, sourceName: 'x.pdf', sourceKind: 'pdf',
  questionPages: [], answerPage: null, hasNoAnswerSheet: false,
  questions: [], answerKey: {}, answerKeyUnresolved: [], step: 2, ...over,
});

/**
 * Navigating Step 3 -> Back -> Step 2 used to re-seed the page grid from
 * suggestQuestionPages, throwing away whatever the user actually picked —
 * and clicking Continue again overwrote their curated selection with the
 * suggestion.
 */
describe('resumeQuestionPages', () => {
  it('keeps the user\'s own selection when there is one', () => {
    expect(resumeQuestionPages(session({ questionPages: [2, 5] }), [0, 1])).toEqual([2, 5]);
  });

  it('falls back to the suggestion on a first visit', () => {
    expect(resumeQuestionPages(session(), [0, 1])).toEqual([0, 1]);
  });

  it('falls back to the suggestion when there is no session yet', () => {
    expect(resumeQuestionPages(null, [3])).toEqual([3]);
  });

  it('treats an empty prior selection as "no prior selection"', () => {
    expect(resumeQuestionPages(session({ questionPages: [] }), [7])).toEqual([7]);
  });
});

describe('resumeAnswerChoice', () => {
  it('keeps a previously chosen answer page', () => {
    expect(resumeAnswerChoice(session({ answerPage: 4 }), 10))
      .toEqual({ answerPage: 4, hasNoAnswerSheet: false });
  });

  it('keeps a previous "no answer sheet" decision instead of re-suggesting', () => {
    expect(resumeAnswerChoice(session({ answerPage: null, hasNoAnswerSheet: true }), 10))
      .toEqual({ answerPage: null, hasNoAnswerSheet: true });
  });

  it('falls back to the suggestion on a first visit', () => {
    expect(resumeAnswerChoice(session(), 10))
      .toEqual({ answerPage: 10, hasNoAnswerSheet: false });
  });

  it('falls back to the suggestion when there is no session yet', () => {
    expect(resumeAnswerChoice(null, null))
      .toEqual({ answerPage: null, hasNoAnswerSheet: false });
  });
});

/**
 * Step 4 guarded its extraction run on a boolean ref plus "does the session
 * already have questions", so going back, changing the page selection and
 * returning showed stale results from the OLD selection. Keying the guard
 * off the selection values themselves makes a genuinely new selection
 * always re-run.
 */
describe('extractionKey', () => {
  it('is stable for an unchanged selection', () => {
    const a = session({ questionPages: [0, 1], answerPage: 10 });
    const b = session({ questionPages: [0, 1], answerPage: 10, questions: [] });
    expect(extractionKey(a)).toBe(extractionKey(b));
  });

  it('changes when the question pages change', () => {
    expect(extractionKey(session({ questionPages: [0] })))
      .not.toBe(extractionKey(session({ questionPages: [0, 1] })));
  });

  it('changes when the answer page changes', () => {
    expect(extractionKey(session({ answerPage: 10 })))
      .not.toBe(extractionKey(session({ answerPage: 11 })));
  });

  it('changes when the no-answer-sheet decision changes', () => {
    expect(extractionKey(session({ hasNoAnswerSheet: false })))
      .not.toBe(extractionKey(session({ hasNoAnswerSheet: true })));
  });

  it('ignores anything that is not part of the selection', () => {
    expect(extractionKey(session({ step: 2 }))).toBe(extractionKey(session({ step: 4 })));
  });

  it('is null when there is no session', () => {
    expect(extractionKey(null)).toBeNull();
  });
});
