'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buildWorkbook } from '@/lib/export/xlsx';
import type { Question } from '@/lib/types';

export function ExportBar({ questions, unresolvedCount }: {
  questions: Question[];
  unresolvedCount: number;
}) {
  const [exporting, setExporting] = useState(false);
  const straightCount = questions.filter((q) => q.kind === 'straight').length;
  const blocked = unresolvedCount > 0;

  async function handleExport() {
    setExporting(true);
    try {
      const buf = await buildWorkbook(questions);
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'questions.xlsx';
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
