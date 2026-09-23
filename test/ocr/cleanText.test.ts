import { describe, it, expect } from 'vitest';
import { cleanOcrText } from '@/lib/ocr/tesseract';

/**
 * Real user report: OCR output looked visually correct but had subtle
 * mismatches downstream. Traced to Tesseract's Sinhala model reliably
 * inserting a spurious ZERO WIDTH NON-JOINER (U+200C) right after certain
 * word-final consonant+virama endings — confirmed by OCRing known text and
 * diffing byte-for-byte: "සඳහන්" came back as "සඳහන්‌" and
 * "ග්‍රන්ථයක්" as "ග්‍රන්ථයක්‌", both visually identical to the
 * correct word but carrying an invisible extra character.
 */
describe('cleanOcrText', () => {
  it('strips a spurious ZWNJ after a word-final virama', () => {
    expect(cleanOcrText('සඳහන්‌')).toBe('සඳහන්');
    expect(cleanOcrText('ග්‍රන්ථයක්‌')).toBe('ග්‍රන්ථයක්');
  });

  it('leaves a genuine ZWJ conjunct untouched (e.g. ශ්‍රී, ග්‍ර)', () => {
    expect(cleanOcrText('ශ්‍රී')).toBe('ශ්‍රී');
    expect(cleanOcrText('ග්‍රන්ථයක්')).toBe('ග්‍රන්ථයක්');
  });

  it('leaves text with no ZWNJ unchanged', () => {
    expect(cleanOcrText('කුමාරයෙකු')).toBe('කුමාරයෙකු');
  });

  it('strips multiple ZWNJ occurrences anywhere in the word', () => {
    expect(cleanOcrText('අ‌බ‌ස')).toBe('අබස');
  });
});
