import ExcelJS from 'exceljs';
import type { Question } from '@/lib/types';

export const HEADERS = ['Full Question', 'Question', 'Answers', 'Correct Answer'];

const numberedOptions = (q: Question) =>
  q.options.map((o, i) => `(${i + 1}) ${o}`).join('\n');

export function buildRows(questions: Question[]): string[][] {
  const rows: string[][] = [HEADERS];
  const straight = questions
    .filter((q) => q.kind === 'straight')
    .sort((a, b) => a.number - b.number);

  for (const q of straight) {
    const options = numberedOptions(q);
    const correct = q.correctAnswer
      ? `${q.correctAnswer}. ${q.options[q.correctAnswer - 1] ?? ''}`
      : '';
    rows.push([`${q.stem}\n${options}`, q.stem, options, correct]);
  }
  return rows;
}

export async function buildWorkbook(questions: Question[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Questions');
  for (const row of buildRows(questions)) ws.addRow(row);

  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 70 }, { width: 45 }, { width: 45 }, { width: 28 }];
  for (const col of [1, 3]) ws.getColumn(col).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
