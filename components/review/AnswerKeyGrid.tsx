'use client';
import type { OptionIndex } from '@/lib/types';

const CELL_COUNT = 40;

export function AnswerKeyGrid({ answerKey, unresolved, onSetAnswer }: {
  answerKey: Record<number, OptionIndex>;
  unresolved: number[];
  onSetAnswer: (number: number, value: OptionIndex | null) => void;
}) {
  const unresolvedSet = new Set(unresolved);

  function handleChange(n: number, raw: string) {
    if (raw === '') {
      onSetAnswer(n, null);
      return;
    }
    const v = Number(raw);
    if (Number.isInteger(v) && v >= 1 && v <= 4) onSetAnswer(n, v as OptionIndex);
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
      {Array.from({ length: CELL_COUNT }, (_, i) => i + 1).map((n) => {
        const isUnresolved = unresolvedSet.has(n);
        return (
          <div
            key={n}
            className={`p-2 flex flex-col items-center gap-1 border ${
              isUnresolved ? 'border-2 border-[#0A0A0A]' : 'border-[#E5E5E5]'
            }`}
          >
            <span className="text-xs text-[#767676]">{n}</span>
            <input
              type="number"
              min={1}
              max={4}
              data-testid={`answerkey-${n}`}
              value={answerKey[n] ?? ''}
              onChange={(e) => handleChange(n, e.target.value)}
              className="w-full text-center border border-[#E5E5E5] text-sm p-1"
            />
            {isUnresolved && (
              <span className="text-[9px] uppercase tracking-wide text-[#0A0A0A]">unresolved</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
