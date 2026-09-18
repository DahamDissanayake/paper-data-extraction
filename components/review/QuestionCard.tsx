'use client';
import type { MouseEvent } from 'react';
import type { OptionIndex, Question } from '@/lib/types';

const OPTION_NUMBERS: OptionIndex[] = [1, 2, 3, 4];

/**
 * One editable extracted question. The correct-answer control is a
 * `<select>` (not a radio group) so it exposes a single queryable value via
 * Playwright's `toHaveValue()` — see `data-testid` on both it and the stem
 * textarea, which a later task's end-to-end test queries directly.
 */
export function QuestionCard({ question, active, onSelect, onChange }: {
  question: Question;
  active: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<Question>) => void;
}) {
  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  function setOption(index: number, value: string) {
    const options = [...question.options];
    options[index] = value;
    onChange({ options });
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
        className="sinhala w-full border border-[#E5E5E5] p-2 text-sm mb-3 resize-y"
        rows={2}
        value={question.stem}
        onChange={(e) => onChange({ stem: e.target.value })}
        onClick={stop}
      />

      <div className="flex flex-col gap-2 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-[#767676] w-4">{i + 1}</span>
            <input
              className="sinhala flex-1 border border-[#E5E5E5] p-1.5 text-sm"
              value={question.options[i] ?? ''}
              onChange={(e) => setOption(i, e.target.value)}
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
