'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildWorkbook, type ExportMode } from '@/lib/export/xlsx';
import type { Question } from '@/lib/types';

const MODES: { value: ExportMode; label: string }[] = [
  { value: 'unicode', label: 'Unicode' },
  { value: 'legacy', label: 'Legacy font' },
];

export function ExportBar({ questions, unresolvedCount }: {
  questions: Question[];
  unresolvedCount: number;
}) {
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<ExportMode>('unicode');
  const straightCount = questions.filter((q) => q.kind === 'straight').length;
  const blocked = unresolvedCount > 0;

  async function handleExport() {
    setExporting(true);
    try {
      const buf = await buildWorkbook(questions, mode);
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'legacy' ? 'questions-legacy.xlsx' : 'questions.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-[#E5E5E5] bg-white px-6 py-3 flex items-center gap-4">
      <span className="text-sm text-[#767676]">
        {straightCount} straight question{straightCount === 1 ? '' : 's'}
      </span>

      <div role="radiogroup" aria-label="Export font" className="flex border border-[#E5E5E5]">
        {MODES.map(({ value, label }, i) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            data-testid={`export-mode-${value}`}
            onClick={() => setMode(value)}
            className={`px-3 py-1.5 text-xs transition-colors ${i === 0 ? '' : 'border-l border-[#E5E5E5]'} ${
              mode === value ? 'bg-[#0A0A0A] text-white' : 'text-[#767676] hover:text-[#0A0A0A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />
      {blocked && (
        <span className="text-sm text-[#767676]">
          Resolve {unresolvedCount} unresolved answer{unresolvedCount === 1 ? '' : 's'} before exporting
        </span>
      )}
      <Button onClick={handleExport} disabled={blocked || exporting} data-testid="export-button">
        {exporting ? 'Exporting…' : 'Export'}
      </Button>
    </div>
  );
}
