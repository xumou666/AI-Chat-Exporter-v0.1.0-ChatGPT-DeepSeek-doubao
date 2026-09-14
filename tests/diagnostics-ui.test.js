/*
 * UI tests for the two diagnosis helpers: "复制诊断"（一键复制结构诊断，便于反馈）
 * and "点选范围"（点第一条 + 最后一条即可框定当前对话，绕开启发式误判）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, flush } from './helpers/env.mjs';

async function boot(fixture = 'deepseek-virtual-stale.html') {
  const env = createEnv(fixture);
  if (env.document.readyState === 'loading') {
    env.document.dispatchEvent(new env.window.Event('DOMContentLoaded'));
  }
  await flush(env.window);
  await flush(env.window);
  const root = env.document.getElementById('aice-root');
  assert.ok(root, 'panel is mounted');
  const clipboard = { text: null };
  Object.defineProperty(env.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text) => { clipboard.text = text; return Promise.resolve(); } }
  });
  const buttonByText = (label) => Array.from(root.querySelectorAll('button')).find((button) => button.textContent === label);
  return { env, root, clipboard, buttonByText };
}

test('the panel shows the running extension version', async () => {
  const { root } = await boot();
  const title = root.querySelector('.aice-title').textContent;
  assert.match(title, /v\d+\.\d+\.\d+/, `panel title must show the version, got: ${title}`);
});

test('复制诊断 copies a report with strategy, keys and dropped rows', async () => {
  const { env, clipboard, buttonByText } = await boot();
  const button = buttonByText('复制诊断');
  assert.ok(button, 'the copy-diagnostics button exists');
  button.click();
  await flush(env.window);
  await flush(env.window);
  const report = clipboard.text || '';
  assert.match(report, /AI Chat Exporter v\d+\.\d+\.\d+/);
  assert.match(report, /platform: deepseek/);
  assert.match(report, /strategy: platform-selectors\s+scopedBy: item-key/);
  assert.match(report, /dropped: 2/);
  assert.match(report, /\[dropped\] key=1101/, `stale rows must be listed as dropped:\n${report}`);
  assert.match(report, /\[kept\]\s+key=1/, `current rows must be listed as kept:\n${report}`);
  assert.match(env.document.querySelector('#aice-root .aice-status').textContent, /诊断信息已复制/);
});

test('点选范围 fills the range from two clicks instead of trusting the heuristics', async () => {
  const { env, root, buttonByText } = await boot('deepseek-virtual-stale.html');
  const button = buttonByText('点选范围');
  assert.ok(button, 'the pick-range button exists');
  button.click();

  const overlay = env.document.getElementById('aice-calibrate-overlay');
  assert.ok(overlay, 'the picking overlay appears');
  assert.match(overlay.textContent, /第一条/);

  const rows = Array.from(env.document.querySelectorAll('[class*="ds-message"]'));
  assert.equal(rows.length, 6);
  const click = (element) => element.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  click(rows[2]); // 当前对话的第一条（key=1）
  assert.match(env.document.getElementById('aice-calibrate-overlay').textContent, /最后一条/);

  click(rows[5]); // 当前对话的最后一条（key=4）
  assert.equal(env.document.getElementById('aice-calibrate-overlay'), null, 'the overlay is removed when done');

  const scope = root.querySelector('select').value;
  assert.equal(scope, 'range');
  const inputs = Array.from(root.querySelectorAll('input[type="number"]'));
  // Ordinals refer to the messages that would actually be exported: the stale
  // conversation's rows are dropped first, so the current conversation is 1..4.
  assert.equal(inputs[0].value, '1');
  assert.equal(inputs[1].value, '4');
  assert.match(root.querySelector('.aice-status').textContent, /已按点击结果填入范围/);
});
