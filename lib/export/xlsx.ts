import ExcelJS from 'exceljs';
import type { Question } from '@/lib/types';
import { splitLegacyQuestion } from '@/lib/extract/parser';

export const HEADERS = ['Full Question', 'Question', 'Answers', 'Correct Answer'];

/**
 * Sinhala text runs on this legacy font in the source PDFs this project
 * targets (see lib/sinhala/legacy/maps/fmAbhaya.ts). Used only in 'legacy'
 * export mode, to set the exported cells' font family so the workbook
 * renders correctly on a machine that still has this font installed —
 * without it, a raw legacy byte string (unconverted, by design in this
 * mode) would render as mojibake under a default Unicode font.
 */
const LEGACY_FONT_NAME = 'FMAbhaya';

export type ExportMode = 'unicode' | 'legacy';

/** Unicode stem/options (current behavior) vs. the original, unconverted legacy-encoded text. */
function textFor(q: Question, mode: ExportMode): { stem: string; options: string[] } {
  if (mode === 'unicode') return { stem: q.stem, options: q.options };
  return splitLegacyQuestion(q.rawLegacy);
}

const numberedOptions = (options: string[]) =>
  options.map((o, i) => `(${i + 1}) ${o}`).join('\n');

export function buildRows(questions: Question[], mode: ExportMode = 'unicode'): string[][] {
  const rows: string[][] = [HEADERS];
  const straight = questions
    .filter((q) => q.kind === 'straight')
    .sort((a, b) => a.number - b.number);

  for (const q of straight) {
    const { stem, options: optionTexts } = textFor(q, mode);
    const options = numberedOptions(optionTexts);
    const correct = q.correctAnswer
      ? `${q.correctAnswer}. ${optionTexts[q.correctAnswer - 1] ?? ''}`
      : '';
    rows.push([`${stem}\n${options}`, stem, options, correct]);
  }
  return rows;
}

/**
 * `mode: 'unicode'` (default) exports the already-converted Sinhala text,
 * same as before. `mode: 'legacy'` exports the original, unconverted
 * legacy-encoded bytes instead — an escape hatch for opening the workbook
 * on a machine that still uses the source PDF's original legacy font
 * rather than relying on this app's Unicode conversion (which, as
 * lib/sinhala/legacy/maps/fmAbhaya.ts documents, doesn't cover every legacy
 * byte yet).
 */
export async function buildWorkbook(questions: Question[], mode: ExportMode = 'unicode'): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  for (const row of buildRows(questions, mode)) ws.addRow(row);

  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 70 }, { width: 45 }, { width: 45 }, { width: 28 }];
  for (const col of [1, 3]) ws.getColumn(col).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  if (mode === 'legacy') {
    for (const col of [1, 2, 3, 4]) ws.getColumn(col).font = { name: LEGACY_FONT_NAME };
    ws.getRow(1).font = { bold: true }; // header stays in the default font, not the legacy one
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
