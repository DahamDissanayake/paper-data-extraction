import type { Session } from '@/lib/types';

/**
 * How the wizard resumes when the user navigates BACK into a step they have
 * already answered.
 *
 * Steps 2 and 3 used to seed their local state from the automatic
 * suggestion unconditionally, so Step 3 -> Back -> Step 2 silently replaced
 * whatever the user had curated with a fresh suggestion, and Continue then
 * overwrote the real selection with it. The spec is explicit that "the
 * suggestion never decides alone" — which has to hold on the way back too.
 *
 * Pure functions, kept out of the components so they are testable under
 * Vitest's node environment like the rest of lib/.
 */

/** The pages step 2 should show as selected. */
export function resumeQuestionPages(session: Session | null, suggested: number[]): number[] {
  const prior = session?.questionPages ?? [];
  return prior.length > 0 ? prior : suggested;
}

/** The answer-sheet decision step 3 should show. */
export function resumeAnswerChoice(
  session: Session | null,
  suggested: number | null,
): { answerPage: number | null; hasNoAnswerSheet: boolean } {
  if (session?.hasNoAnswerSheet) return { answerPage: null, hasNoAnswerSheet: true };
  if (session && session.answerPage !== null) {
    return { answerPage: session.answerPage, hasNoAnswerSheet: false };
  }
  return { answerPage: suggested, hasNoAnswerSheet: false };
}

/**
 * Identifies the page selection an extraction result belongs to.
 *
 * Step 4 guarded its run with a boolean ref and a "session already has
 * questions" check, so changing the selection and coming back showed stale
 * results from the previous selection. Keying the guard off these values
 * instead means a genuinely different selection always re-extracts, while a
 * remount or a refresh with the same selection still does not.
 */
export function extractionKey(session: Session | null): string | null {
  if (!session) return null;
  return JSON.stringify({
    questionPages: session.questionPages,
    answerPage: session.answerPage,
    hasNoAnswerSheet: session.hasNoAnswerSheet,
  });
}
