/*
 * Builds the release archive: dist/ai-chat-exporter-<version>.zip
 *
 * The ZIP is written by the extension's own zero-dependency writer
 * (src/core/zip.js, evaluated in jsdom) — the same code path users rely on for
 * image bundles, so packaging also acts as a smoke test of it.
 *
 *   node tools/package.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist');

// Only what a user needs to load the extension — tests/tools/demo stay in git.
const INCLUDE = ['manifest.json', 'README.md', 'PRIVACY.md', 'LICENSE', 'src', 'assets'];
const SKIP = new Set(['.DS_Store', 'Thumbs.db']);

function collect(relative, files = []) {
  const absolute = path.join(ROOT, relative);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolute).sort()) {
      if (SKIP.has(entry)) continue;
      collect(path.join(relative, entry), files);
    }
    return files;
  }
  files.push(relative.split(path.sep).join('/'));
  return files;
}

function loadZip() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://example.com/',
    runScripts: 'outside-only'
  });
  dom.window.eval(readFileSync(path.join(ROOT, 'src', 'core', 'zip.js'), 'utf8'));
  return dom.window.AIChatExporter.core.zip;
}

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const zip = loadZip();
const prefix = `ai-chat-exporter-${manifest.version}`;

const files = [];
for (const entry of INCLUDE) collect(entry, files);
files.sort();

const entries = files.map((file) => ({
  name: `${prefix}/${file}`,
  data: readFileSync(path.join(ROOT, file))
}));

const bytes = zip.zipSync(entries);
mkdirSync(OUT_DIR, { recursive: true });
const target = path.join(OUT_DIR, `${prefix}.zip`);
writeFileSync(target, Buffer.from(bytes));

const check = zip.listEntries(bytes);
console.log(`${path.relative(ROOT, target)}  ${bytes.length} bytes`);
console.log(`  ${check.length} entries, extension loads from: ${prefix}/manifest.json`);
for (const entry of check) console.log(`   · ${entry.name} (${entry.size} B)`);
