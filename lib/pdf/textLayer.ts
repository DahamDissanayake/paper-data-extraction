import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PositionedItem } from '@/lib/types';

/**
 * The subset of pdf.js's `TextItem` this module reads. `getTextContent()`'s
 * `items` array is typed `(TextItem | TextMarkedContent)[]`, but `TextItem`
 * isn't re-exported from the `pdfjs-dist` package root (only from its
 * internal `display/api` module), so this narrows structurally on the
 * fields actually used instead of importing pdf.js's internal type.
 *
 * (An earlier `i is typeof i & { str: string }` predicate looked like it
 * would exclude `TextMarkedContent`, but doesn't: TS distributes it into a
 * union that still includes a `TextMarkedContent & { str: string }` member,
 * which is empty at runtime but not `never` to the type checker, so
 * `fontName`/`transform`/`width`/`height` access below still fails strict
 * build-time type checking.)
 */
interface TextRunItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  // Present on pdf.js's real TextItem but unused here; declared so this
  // type stays structurally assignable to TextItem, which TS requires for
  // the `is TextRunItem` predicate below to narrow `TextItem | TextMarkedContent`.
  dir: string;
  hasEOL: boolean;
}

function isTextRunItem(item: unknown): item is TextRunItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str: unknown }).str === 'string'
  );
}

export async function getPositionedItems(
  doc: PDFDocumentProxy, pageIndex: number,
): Promise<PositionedItem[]> {
  const page = await doc.getPage(pageIndex + 1);
  // commonObjs is empty until the operator list has been built. Without this
  // line every font resolves to an internal id like "g_d0_f1".
  await page.getOperatorList();
  const tc = await page.getTextContent();

  return tc.items
    .filter((i): i is TextRunItem => isTextRunItem(i) && i.str.trim().length > 0)
    .map((i) => {
      let font = i.fontName;
      try { font = page.commonObjs.get(i.fontName)?.name ?? i.fontName; } catch { /* unloaded */ }
      return {
        str: i.str,
        x: +i.transform[4].toFixed(1),
        y: +i.transform[5].toFixed(1),
        w: +i.width.toFixed(1),
        h: +i.height.toFixed(1),
        font,
      };
    });
}
