/*
 * Packaging tests — keeps manifest.json, the service worker injection list and
 * the shipped assets consistent (a broken path is the classic MV3 failure).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/env.mjs';

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const content = manifest.content_scripts[0];

test('manifest declares MV3 with the expected metadata', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.name, /ChatGPT/);
  assert.match(manifest.name, /DeepSeek/);
  assert.match(manifest.name, /豆包/);
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('scripting'));
  assert.equal(manifest.background.service_worker, 'src/background.js');
});

test('every file referenced by the manifest exists', () => {
  const files = [
    manifest.background.service_worker,
    ...content.js,
    ...content.css,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];
  for (const file of files) {
    assert.ok(existsSync(path.join(ROOT, file)), `missing file: ${file}`);
  }
});

test('content script order satisfies module dependencies', () => {
  const files = content.js;
  const at = (file) => files.indexOf(file);
  const pairs = [
    ['src/core/dom.js', 'src/core/markdown.js'],
    ['src/core/markdown.js', 'src/core/engine.js'],
    ['src/core/engine.js', 'src/core/schema.js'],
    ['src/core/schema.js', 'src/core/serialize.js'],
    ['src/core/serialize.js', 'src/core/html.js'],
    ['src/core/html.js', 'src/core/pdf.js'],
    ['src/core/serialize.js', 'src/core/app.js'],
    ['src/platforms/chatgpt.js', 'src/platforms/index.js'],
    ['src/platforms/index.js', 'src/ui/panel.js'],
    ['src/ui/panel.js', 'src/content.js']
  ];
  for (const [before, after] of pairs) {
    assert.ok(at(before) !== -1, `${before} is not loaded`);
    assert.ok(at(after) !== -1, `${after} is not loaded`);
    assert.ok(at(before) < at(after), `${before} must load before ${after}`);
  }
  assert.equal(files[0], 'src/core/dom.js');
  assert.equal(files[files.length - 1], 'src/content.js');
  assert.ok(content.css.includes('src/ui/panel.css'));
});

test('the service worker injects exactly the declared content scripts', () => {
  const background = readFileSync(path.join(ROOT, 'src/background.js'), 'utf8');
  const match = background.match(/const CONTENT_FILES = \[([\s\S]*?)\];/);
  assert.ok(match, 'CONTENT_FILES list is present in background.js');
  const injected = match[1]
    .split(',')
    .map((entry) => entry.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  assert.deepEqual(injected, content.js);
  assert.match(background, /src\/ui\/panel\.css/);
});

test('icons are real PNG files', () => {
  for (const size of [16, 32, 48, 128]) {
    const bytes = readFileSync(path.join(ROOT, 'assets', `icon${size}.png`));
    assert.deepEqual(Array.from(bytes.subarray(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), size, `icon${size}.png width`);
    assert.equal(bytes.readUInt32BE(20), size, `icon${size}.png height`);
  }
});

test('host permissions cover every supported site', () => {
  const hosts = manifest.host_permissions.join(' ');
  const matches = content.matches.join(' ');
  for (const host of ['chatgpt.com', 'chat.openai.com', 'chat.deepseek.com', 'www.doubao.com']) {
    assert.ok(hosts.includes(host), `host_permissions must include ${host}`);
  }
  for (const pattern of ['https://chatgpt.com/*', 'https://chat.openai.com/*', 'https://chat.deepseek.com/*', 'https://www.doubao.com/*']) {
    assert.ok(matches.includes(pattern), `content script must run on ${pattern}`);
  }
  assert.ok(!matches.includes('<all_urls>'), 'the exporter must not request every site');
});

test('no module uses ES module syntax (they are classic content scripts)', () => {
  for (const file of content.js) {
    const code = readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!/^\s*(import|export)\s/m.test(code), `${file} must stay a classic script`);
  }
});
