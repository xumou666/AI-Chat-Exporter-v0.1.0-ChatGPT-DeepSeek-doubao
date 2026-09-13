/*
 * Panel tests — the range picker must show *which* message an ordinal points
 * at (role + opening words) and keep full-conversation numbering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, flush } from './helpers/env.mjs';

async function bootPanel(fixture = 'chatgpt.html', options = {}) {
  const env = createEnv(fixture, options);
  if (env.document.readyState === 'loading') {
    env.document.dispatchEvent(new env.window.Event('DOMContentLoaded'));
  }
  await flush(env.window);
  await flush(env.window);
  const root = env.document.getElementById('aice-root');
  assert.ok(root, 'panel is mounted');
  return {
    env,
    root,
    select: root.querySelector('select'),
    inputs: Array.from(root.querySelectorAll('input[type="number"]')),
    preview: root.querySelector('.aice-range-preview'),
    summary: root.querySelector('.aice-range-summary'),
    lines: Array.from(root.querySelectorAll('.aice-range-line')),
    exportButton: root.querySelector('.aice-actions button.aice-primary')
  };
}

function chooseRange(parts, from, to) {
  const { env } = parts;
  parts.select.value = 'range';
  parts.select.dispatchEvent(new env.window.Event('change'));
  if (from !== undefined) {
    parts.inputs[0].value = String(from);
    parts.inputs[0].dispatchEvent(new env.window.Event('input'));
  }
  if (to !== undefined) {
    parts.inputs[1].value = String(to);
    parts.inputs[1].dispatchEvent(new env.window.Event('input'));
  }
}

function stubDownloads(env) {
  const downloads = [];
  env.window.URL.createObjectURL = () => 'blob:aice';
  env.window.URL.revokeObjectURL = () => {};
  env.window.HTMLAnchorElement.prototype.click = function click() { downloads.push(this.download); };
  env.window.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };
  return downloads;
}

test('range picker is hidden for full export and previews both bounds in range mode', async () => {
  const parts = await bootPanel();
  assert.ok(!parts.preview.className.includes('is-active'), 'hidden while scope = full');

  chooseRange(parts);

  assert.ok(parts.preview.className.includes('is-active'), 'visible in range mode');
  assert.match(parts.lines[0].textContent, /起始 #1/);
  assert.match(parts.lines[0].textContent, /用户/);
  assert.match(parts.lines[0].textContent, /如何用 Python 给列表去重/);
  assert.match(parts.lines[1].textContent, /结束 #4/);
  assert.match(parts.lines[1].textContent, /助手/);
  assert.match(parts.lines[1].textContent, /字典不可哈希/);
  assert.equal(parts.summary.textContent, '将导出第 1–4 条，共 4 条');
});

test('typing ordinals updates the preview live and flags out-of-range values', async () => {
  const parts = await bootPanel();

  chooseRange(parts, 3, 4);
  assert.match(parts.lines[0].textContent, /起始 #3/);
  assert.match(parts.lines[0].textContent, /如果元素是字典呢？/);
  assert.match(parts.lines[1].textContent, /结束 #4/);
  assert.match(parts.lines[1].textContent, /🤖 助手 · 字典不可哈希/);
  assert.equal(parts.summary.textContent, '将导出第 3–4 条，共 2 条');

  chooseRange(parts, 2, 2);
  assert.match(parts.lines[0].textContent, /起始 #2/);
  assert.match(parts.lines[0].textContent, /dict\.fromkeys/);
  assert.equal(parts.summary.textContent, '将只导出第 2 条');

  chooseRange(parts, 99);
  assert.equal(parts.lines[0].className, 'aice-range-line is-invalid');
  assert.match(parts.lines[0].textContent, /起始 #99\s*超出范围/);
  assert.equal(parts.summary.textContent, '将只导出第 4 条', 'clamped like the export does');

  chooseRange(parts, 1, '');
  assert.match(parts.lines[1].textContent, /结束 #4/, 'an empty end box means “up to the last message”');
  assert.equal(parts.summary.textContent, '将导出第 1–4 条，共 4 条');
});

test('preview text is trimmed to a short snippet and keeps the full text as a tooltip', async () => {
  const parts = await bootPanel();
  chooseRange(parts, 1, 1);
  const text = parts.lines[0].querySelector('.aice-range-text');
  assert.ok(text.textContent.length <= 45, 'snippet stays short: ' + text.textContent);
  assert.match(text.title, /保持原有顺序/, 'tooltip keeps the untruncated preview');
});

test('preview follows the UI language', async () => {
  const parts = await bootPanel('chatgpt.html', { locale: 'en' });
  chooseRange(parts, 1, 4);
  assert.match(parts.lines[0].textContent, /From #1/);
  assert.match(parts.lines[0].textContent, /User/);
  assert.match(parts.lines[1].textContent, /To #4/);
  assert.equal(parts.summary.textContent, 'Will export messages 1–4 (4 in total)');
});

test('a partial export does not renumber the picker', async () => {
  const parts = await bootPanel();
  const downloads = stubDownloads(parts.env);

  chooseRange(parts, 3, 4);
  parts.exportButton.click();
  await flush(parts.env.window);
  await flush(parts.env.window);
  await flush(parts.env.window);

  assert.equal(downloads.length, 1);
  assert.match(downloads[0], /^chatgpt_Python 列表去重_\d{8}-\d{4}\.md$/);
  assert.match(parts.root.querySelector('.aice-status').textContent, /已开始下载/);
  // ordinals still describe the whole conversation
  assert.match(parts.lines[0].textContent, /起始 #3/);
  assert.match(parts.lines[1].textContent, /结束 #4/);
  assert.match(parts.lines[1].textContent, /🤖 助手 · 字典不可哈希/);
  assert.equal(parts.summary.textContent, '将导出第 3–4 条，共 2 条');
});

test('picker reports clearly when no messages were detected', async () => {
  const env = createEnv('empty.html', {
    html: '<!DOCTYPE html><html><body><p>nothing here</p></body></html>',
    url: 'https://example.com/blank'
  });
  if (env.document.readyState === 'loading') {
    env.document.dispatchEvent(new env.window.Event('DOMContentLoaded'));
  }
  await flush(env.window);
  await flush(env.window);
  const root = env.document.getElementById('aice-root');
  const summary = root.querySelector('.aice-range-summary');
  const previewText = root.querySelector('.aice-range-text');
  assert.equal(summary.textContent, '未识别到消息，无法选择范围');
  assert.equal(previewText.textContent, '');
});

test('the exporter never mistakes its own panel for conversation content', async () => {
  const parts = await bootPanel();
  const extraction = parts.env.window.__AICE__.extract(parts.env.window.__AICE__.getPanel().getSettings());
  const exported = extraction.conversation.messages.map((message) => message.markdown).join('\n');
  for (const panelText of ['导出格式', '文件名模板', '手动校准', '结构诊断', '导出范围']) {
    assert.ok(!exported.includes(panelText), `panel text leaked into the export: ${panelText}`);
  }
  assert.equal(extraction.conversation.messageCount, 4, 'only the real conversation is exported');
});
