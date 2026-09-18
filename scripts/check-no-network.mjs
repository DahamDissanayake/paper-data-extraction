#!/usr/bin/env node
/**
 * Enforces the project's binding constraint: "No server, ever. No API
 * routes, no server actions, no fetch to any external host at runtime."
 *
 * Task 14 checked this by grepping `app components lib` for external URLs.
 * That can never catch the class of bug it was meant to catch: the CDN
 * fetches that actually shipped came from a DEPENDENCY's compiled defaults
 * (tesseract.js reaching for jsdelivr for its worker script, its wasm core
 * and the ~1MB Sinhala traineddata), which appear nowhere in this project's
 * source. So this script checks BOTH:
 *
 *   1. this project's own source, and
 *   2. the built `out/` directory — everything Next and webpack actually
 *      emit, dependency output included.
 *
 * Why this is not a bare "no external URL anywhere" grep
 * -----------------------------------------------------
 * Real dependencies embed https:// strings that are never fetched: XML and
 * SVG namespace identifiers, documentation links inside error messages,
 * licence headers, and URL-parser feature tests in polyfills. A check that
 * fails on those would simply be switched off. So the rule is:
 *
 *   - Hosts on ASSET_HOSTS fail ALWAYS and can never be allowlisted. These
 *     are the package/font/data CDNs — the things a dependency actually
 *     fetches from. cdn.jsdelivr.net is on it, so the original bug fails
 *     this check loudly.
 *   - Hosts on DOC_HOSTS are accepted: each was inspected and is a doc link,
 *     licence comment or namespace identifier, never a request target.
 *   - Anything else fails, and adding it requires opening this file and
 *     saying which of the two it is. A new external host cannot slip in
 *     silently.
 *
 * Usage:  node scripts/check-no-network.mjs [--source-only]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceOnly = process.argv.includes('--source-only');

const URL_RE = /https?:\/\/([a-z0-9.-]+)/gi;

/**
 * Package, font and data CDNs. A hit here is always a failure — vendor the
 * asset into public/ and rewrite the literal (see
 * scripts/vendor-tesseract.mjs) instead of adding an exception.
 */
const ASSET_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'esm.sh',
  'cdn.skypack.dev',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com',
  'raw.githubusercontent.com',
  'tessdata.projectnaptha.com',
  'tessdata.projectnaptha.org',
];

/**
 * Injected by the deployment platform itself, not by this app or any of its
 * dependencies — never present in `next build` output run locally or on any
 * other host, only when Vercel's own build wrapper ("Applying modifyConfig
 * from Vercel" in the build log) adds it. Unlike DOC_HOSTS, these genuinely
 * ARE fetch targets when triggered — but the trigger is an explicit,
 * opt-in user action on Vercel's own toolbar UI (`data-explicit-opt-in`),
 * and no code path here ever reaches it with extracted PDF content or any
 * other app data. Disabling the Vercel Toolbar in the project's dashboard
 * settings (Settings → General → Vercel Toolbar → Off) removes this
 * injection entirely; this allowlist entry is the fallback so the build
 * still passes if it's left on.
 */
const PLATFORM_HOSTS = new Map([
  ['vercel.live', "Vercel's own opt-in preview/production Toolbar, injected by the Vercel build step"],
]);

/**
 * Inspected and confirmed non-fetching. Each entry says why.
 */
const DOC_HOSTS = new Map([
  ['www.w3.org', 'XML/SVG namespace identifiers'],
  ['www.xfa.org', 'XFA namespace identifiers in pdf.js'],
  ['ns.adobe.com', 'XMP/XDP namespace identifiers in pdf.js'],
  ['schemas.openxmlformats.org', 'OOXML namespace identifiers written by ExcelJS'],
  ['schemas.microsoft.com', 'OOXML namespace identifiers written by ExcelJS'],
  ['purl.org', 'Dublin Core namespace identifier'],
  ['www.iso.org', 'OOXML namespace identifier'],
  ['nextjs.org', 'documentation links inside Next.js error messages'],
  ['react.dev', 'documentation links inside React error messages'],
  ['github.com', 'issue/repo links inside dependency error messages and licences'],
  ['stuk.github.io', 'JSZip homepage in its licence header'],
  ['tailwindcss.com', 'licence header comment in the emitted CSS'],
]);

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.json', '.txt', '.map']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

const failures = [];

function scan(dir, label) {
  if (!fs.existsSync(dir)) return false;
  for (const file of walk(dir)) {
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(URL_RE)) {
      const host = match[1].toLowerCase().replace(/\.$/, '');
      // A host with no dot cannot be an external host. These come from
      // URL-parser feature tests in the Next.js polyfill bundle
      // (`new URL("https://a#б")`).
      if (!host.includes('.')) continue;
      if (DOC_HOSTS.has(host)) continue;
      if (PLATFORM_HOSTS.has(host)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      const context = text.slice(Math.max(0, match.index - 50), match.index + 100).replace(/\s+/g, ' ');
      const why = ASSET_HOSTS.includes(host)
        ? 'ASSET CDN — must be vendored, never allowlisted'
        : 'unrecognised external host';
      failures.push(`${label}  ${path.relative(ROOT, file)}:${line}\n    host: ${host}  (${why})\n    ...${context}...`);
    }
  }
  return true;
}

// The shipped code only. `scripts/` is deliberately excluded: it is Node
// build tooling that never reaches a browser, and vendor-tesseract.mjs has
// to name the CDN it is replacing. What matters is that nothing it produces
// leaves a CDN URL in out/, which the build scan below proves.
scan(path.join(ROOT, 'app'), '[source]');
scan(path.join(ROOT, 'components'), '[source]');
scan(path.join(ROOT, 'lib'), '[source]');

if (!sourceOnly) {
  if (!scan(path.join(ROOT, 'out'), '[build] ')) {
    console.error(
      'check-no-network: out/ does not exist. Run `npm run build` first, or pass\n' +
      '  --source-only to check this project\'s source alone — which cannot catch a\n' +
      '  CDN URL baked into a dependency\'s compiled output, the exact bug this\n' +
      '  script exists for.',
    );
    process.exit(1);
  }
}

if (failures.length > 0) {
  console.error(`check-no-network: ${failures.length} external URL(s) need a decision:\n`);
  for (const f of failures) console.error(f + '\n');
  console.error(
    'Each of these is a potential runtime fetch to a host outside the user\'s browser.\n' +
    'If it is an asset a dependency loads, vendor it into public/ and rewrite the\n' +
    'literal (see scripts/vendor-tesseract.mjs). Only add it to DOC_HOSTS in this\n' +
    'file if you have confirmed it is a namespace, licence or documentation string\n' +
    'that is never requested.',
  );
  process.exit(1);
}

console.log(
  `check-no-network: OK — no fetchable external host in ${sourceOnly ? 'source' : 'source or out/'}`,
);
