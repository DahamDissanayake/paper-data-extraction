import { describe, it, expect } from 'vitest';
import { ocrWordToItem } from '@/lib/ocr/tesseract';

/**
 * Every other producer of a PositionedItem — pdf.js's text layer and
 * getImageRegions — returns PDF user-space points at scale 1, origin
 * bottom-left. recogniseDocPage renders at scale 2 and used to hand back
 * Tesseract's boxes in that scaled canvas-pixel space, which silently
 * doubled every coordinate: line-grouping tolerance, figure-overlap tests
 * and the review pane's highlight overlay all read it as points.
 */
describe('ocrWordToItem', () => {
  const word = { text: 'ඉතිහාසය', bbox: { x0: 100, y0: 50, x1: 200, y1: 80 } };

  it('divides canvas pixels by the render scale', () => {
    const item = ocrWordToItem(word, 1000, 2);
    expect(item.x).toBe(50);
    expect(item.w).toBe(50);
    expect(item.h).toBe(15);
  });

  it('flips to the PDF bottom-left origin in point space', () => {
    // Canvas is 1000px tall at scale 2, so the page is 500pt tall. The word's
    // top edge is 80px = 40pt from the top, i.e. y = 500 - 40 = 460.
    expect(ocrWordToItem(word, 1000, 2).y).toBe(460);
  });

  it('is the identity on coordinates when the render scale is 1', () => {
    const item = ocrWordToItem(word, 500, 1);
    expect(item).toMatchObject({ x: 100, y: 420, w: 100, h: 30 });
  });

  it('tags the item as OCR so no legacy map is applied to it', () => {
    expect(ocrWordToItem(word, 1000, 2).font).toBe('OCR');
    expect(ocrWordToItem(word, 1000, 2).str).toBe('ඉතිහාසය');
  });
});
