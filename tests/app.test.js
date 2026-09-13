/*
 * Application-layer tests: export payloads, image packaging and the
 * bootstrap path used by the content script.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, flush, mockFetch, fakePng } from './helpers/env.mjs';

test('exportConversation covers every format', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const conversation = NS.core.app.extract(document, { locale: 'zh-CN' }).conversation;

  const md = NS.core.app.exportConversation(conversation, { format: 'md', toc: true });
  assert.equal(md.kind, 'text');
  assert.ok(md.filename.endsWith('.md'));
  assert.match(md.text, /## 目录/);

  const json = NS.core.app.exportConversation(conversation, { format: 'json' });
  assert.equal(JSON.parse(json.text).messageCount, 4);

  const txt = NS.core.app.exportConversation(conversation, { format: 'txt' });
  assert.match(txt.text, /\[1\] 用户/);

  const html = NS.core.app.exportConversation(conversation, { format: 'html' });
  assert.match(html.text, /<!DOCTYPE html>/);
  assert.ok(!html.text.includes('window.print()'), 'HTML export must not auto-print');

  const pdf = NS.core.app.exportConversation(conversation, { format: 'pdf' });
  assert.equal(pdf.kind, 'print');
  assert.ok(pdf.filename.endsWith('.pdf'));
  assert.match(pdf.html, /@page/);
  assert.match(pdf.html, /window\.print\(\)/);

  for (const payload of [md, json, txt, html, pdf]) {
    assert.ok(payload.filename.length > 4);
    assert.ok(payload.text.length > 100);
  }
});

test('exportPackage downloads images, rewrites links and returns a ZIP', async () => {
  const { NS, document } = createEnv('chatgpt.html');
  const conversation = NS.core.app.extract(document, { locale: 'zh-CN' }).conversation;
  const chart = fakePng(64);
  const result = await NS.core.app.exportPackage(conversation, {
    format: 'md',
    toc: true,
    fetchImpl: mockFetch({ 'https://cdn.example.com/chart.png': chart }),
    imageTimeout: 100
  });

  assert.equal(result.kind, 'zip');
  assert.ok(result.filename.endsWith('.zip'));
  assert.equal(result.images.failures.length, 0);

  const names = Array.from(NS.core.zip.listEntries(result.bytes), (entry) => entry.name);
  assert.equal(names.length, 2);
  assert.equal(names[0], result.filename.replace(/\.zip$/, '.md'));
  assert.deepEqual(names.slice(1), ['images/image-001-chart.png']);

  const markdown = NS.core.zip.decodeUtf8(NS.core.zip.readEntry(result.bytes, names[0]));
  assert.match(markdown, /!\[性能对比图\]\(images\/image-001-chart\.png\)/);
  assert.equal(markdown.split('![性能对比图]').length - 1, 1, 'the image must be referenced exactly once');
  assert.ok(!markdown.includes('https://cdn.example.com/chart.png'), 'remote image URLs are rewritten to packaged files');
  assert.deepEqual(Array.from(NS.core.zip.readEntry(result.bytes, names[1])), Array.from(chart));
});

test('exportPackage reports images it could not download', async () => {
  const { NS, document } = createEnv('chatgpt.html');
  const conversation = NS.core.app.extract(document, {}).conversation;
  const result = await NS.core.app.exportPackage(conversation, {
    format: 'json',
    fetchImpl: mockFetch({}, { failOn: ['chart.png'] })
  });
  const names = Array.from(NS.core.zip.listEntries(result.bytes), (entry) => entry.name);
  assert.equal(names.length, 1);
  assert.equal(result.images.failures.length, 1);
  assert.match(result.images.failures[0].error, /HTTP 404/);
});

test('images helper derives sane file names and extensions', () => {
  const { NS } = createEnv('generic-random.html');
  assert.equal(NS.core.images.extFromUrl('https://x/y/chart.webp?x=1'), 'webp');
  assert.equal(NS.core.images.extFromUrl('data:image/png;base64,AAAA'), 'png');
  assert.equal(NS.core.images.extFromUrl('https://files.oaiusercontent.com/file-ABC123'), 'png');
  assert.equal(NS.core.images.extFromContentType('image/jpeg; charset=binary'), 'jpg');
  assert.equal(NS.core.images.baseNameFor('https://cdn.example.com/chart.png', 0), 'image-001-chart');
  assert.equal(NS.core.images.baseNameFor('https://files.oaiusercontent.com/file-ABC123', 2), 'image-003');
});

test('mergeSettings applies defaults and keeps user overrides', () => {
  const { NS } = createEnv('generic-random.html');
  const merged = NS.core.app.mergeSettings({ format: 'pdf', todo: 'ignored' });
  assert.equal(merged.format, 'pdf');
  assert.equal(merged.toc, true);
  assert.equal(merged.images, false);
  assert.equal(merged.filenameTemplate, '{platform}_{title}_{date}');
  assert.equal(merged.todo, 'ignored');
});

test('content script boots the panel and exports end to end', async () => {
  const env = createEnv('chatgpt.html');
  if (env.document.readyState === 'loading') {
    env.document.dispatchEvent(new env.window.Event('DOMContentLoaded'));
  }
  await flush(env.window);
  await flush(env.window);

  const root = env.document.getElementById('aice-root');
  assert.ok(root, 'the floating panel is mounted');
  assert.ok(root.querySelector('.aice-fab'), 'the floating action button exists');
  assert.equal(env.window.__AICE__.platform, 'chatgpt');
  assert.match(env.document.querySelector('#aice-root .aice-status').textContent, /已识别 4 条消息/);
  assert.match(env.document.querySelector('#aice-root .aice-diag pre').textContent, /当前识别策略/);

  const downloads = [];
  env.window.URL.createObjectURL = () => 'blob:aice';
  env.window.URL.revokeObjectURL = () => {};
  env.window.HTMLAnchorElement.prototype.click = function click() { downloads.push(this.download); };
  env.window.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };

  await env.window.__AICE__.exportConversation(env.window.__AICE__.getPanel().getSettings());
  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /^chatgpt_Python 列表去重_\d{8}-\d{4}\.md$/);
  assert.match(env.document.querySelector('#aice-root .aice-status').textContent, /已开始下载/);

  const copied = await env.window.__AICE__.getPanel().getSettings();
  assert.equal(copied.format, 'md');
});
