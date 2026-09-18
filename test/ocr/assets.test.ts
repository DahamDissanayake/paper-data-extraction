import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TESSERACT_ASSETS } from '@/lib/ocr/tesseract';

/**
 * `createWorker('sin')` with no options fetches its worker script, wasm core
 * and the Sinhala traineddata from cdn.jsdelivr.net at runtime. Every one of
 * those has to come from this app's own origin instead.
 */
describe('Tesseract runtime assets are self-hosted', () => {
  it('names a local path for the module, worker, core and language data', () => {
    expect(Object.keys(TESSERACT_ASSETS).sort()).toEqual(
      ['corePath', 'langPath', 'module', 'workerPath'],
    );
  });

  it.each(Object.entries(TESSERACT_ASSETS))('%s is same-origin, not a URL', (_key, value) => {
    expect(value.startsWith('/')).toBe(true);
    expect(value).not.toMatch(/^https?:/);
    expect(value).not.toContain('//');
  });

  it('ships the Sinhala traineddata in the repo', () => {
    const file = path.join('public', TESSERACT_ASSETS.langPath.replace(/^\//, ''), 'sin.traineddata.gz');
    expect(fs.existsSync(file)).toBe(true);
    const bytes = fs.readFileSync(file);
    // gzip magic number — proves it is the real asset, not a placeholder.
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    expect(bytes.length).toBeGreaterThan(500_000);
  });

  it('keeps the vendoring script and the no-network check runnable', () => {
    expect(fs.existsSync('scripts/vendor-tesseract.mjs')).toBe(true);
    expect(fs.existsSync('scripts/check-no-network.mjs')).toBe(true);
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.prebuild).toContain('vendor-tesseract');
    expect(pkg.scripts.postbuild).toContain('check-no-network');
  });
});
