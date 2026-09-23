'use client';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import type { OptionIndex, Question } from '@/lib/types';
import type { ExportMode } from '@/lib/export/xlsx';
import { splitLegacyQuestion } from '@/lib/extract/parser';

const OPTION_NUMBERS: OptionIndex[] = [1, 2, 3, 4];

/**
 * One editable extracted question. The correct-answer control is a
 * `<select>` (not a radio group) so it exposes a single queryable value via
 * Playwright's `toHaveValue()` — see `data-testid` on both it and the stem
 * textarea, which a later task's end-to-end test queries directly.
 *
 * `mode` switches which text is shown: 'unicode' (default) is the
 * Unicode-converted, editable stem/options; 'legacy' shows the original,
 * unconverted legacy-encoded bytes instead, rendered with the
 * `.legacy-sinhala` font stack (see globals.css) rather than `.sinhala` —
 * those bytes are plain ASCII remapped onto the source PDF's own legacy
 * font's glyphs, so they only read as Sinhala through a legacy font (e.g.
 * Malithi or FM Abhaya) being present, not the Unicode font `.sinhala`
 * loads. Useful whenever the Unicode conversion has a gap or a wrong
 * letter, so the reviewer can still read the actual source text. Legacy
 * text is read-only: it isn't stored anywhere edits to it could flow back
 * into (Question only has one stem/options pair, the Unicode one), and
 * letting someone type into a legacy-byte string they likely can't even
 * read without that font invites silent corruption for no benefit — the
 * same reasoning the xlsx legacy export already follows.
 */
export function QuestionCard({ question, active, mode, onSelect, onChange }: {
  question: Question;
  active: boolean;
  mode: ExportMode;
  onSelect: () => void;
  onChange: (partial: Partial<Question>) => void;
}) {
  const legacy = useMemo(() => splitLegacyQuestion(question.rawLegacy), [question.rawLegacy]);
  const stem = mode === 'legacy' ? legacy.stem : question.stem;
  const options = mode === 'legacy' ? legacy.options : question.options;
  const readOnly = mode === 'legacy';
  // The raw legacy string is plain ASCII remapped onto the source PDF's own
  // legacy font's glyphs — it only reads as Sinhala rendered through that
  // font, not the Unicode font `.sinhala` uses elsewhere.
  const textFontClass = mode === 'legacy' ? 'legacy-sinhala' : 'sinhala';

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  function setOption(index: number, value: string) {
    const next = [...question.options];
    next[index] = value;
    onChange({ options: next });
  }

  function setAnswer(raw: string) {
    onChange({ correctAnswer: raw === '' ? null : (Number(raw) as OptionIndex) });
  }

  return (
    <div
      onClick={onSelect}
      className={`border p-4 mb-4 cursor-pointer transition-colors ${
        active ? 'border-[#0A0A0A]' : 'border-[#E5E5E5] hover:border-[#0A0A0A]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Question {question.number}</span>
        <div className="flex gap-1">
          {question.flags.map((f) => (
            <span
              key={f}
              className="text-[10px] uppercase tracking-wide border border-[#E5E5E5] px-1.5 py-0.5 text-[#767676]"
            >
              {f}
            </span>
          ))}
          {question.edited && (
            <span className="text-[10px] uppercase tracking-wide bg-[#0A0A0A] text-white px-1.5 py-0.5">
              edited
            </span>
          )}
        </div>
      </div>

      <textarea
        data-testid={`question-${question.number}-stem`}
        className={`${textFontClass} w-full border border-[#E5E5E5] p-2 text-sm mb-3 resize-y read-only:bg-[#FAFAFA] read-only:text-[#767676]`}
        rows={2}
        value={stem}
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => onChange({ stem: e.target.value })}
        onClick={stop}
      />

      <div className="flex flex-col gap-2 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-[#767676] w-4">{i + 1}</span>
            <input
              className={`${textFontClass} flex-1 border border-[#E5E5E5] p-1.5 text-sm read-only:bg-[#FAFAFA] read-only:text-[#767676]`}
              value={options[i] ?? ''}
              readOnly={readOnly}
              onChange={readOnly ? undefined : (e) => setOption(i, e.target.value)}
              onClick={stop}
            />
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-[#767676]" onClick={stop}>
        Correct answer
        <select
          data-testid={`question-${question.number}-answer`}
          className="border border-[#E5E5E5] px-2 py-1 text-sm text-[#0A0A0A] bg-white"
          value={question.correctAnswer ?? ''}
          onChange={(e) => setAnswer(e.target.value)}
        >
          <option value="">—</option>
          {OPTION_NUMBERS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
