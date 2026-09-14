/*
 * Conversation-scoping regression tests.
 *
 * Switching conversations in a SPA must never drag other conversations into the
 * export: the history sidebar, a cached previous conversation, or a second
 * conversation that is still in the DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

function extract(fixture, options = {}) {
  const { NS, document } = createEnv(fixture);
  const result = NS.core.app.extract(document, { locale: 'zh-CN', ...options });
  const text = Array.from(result.conversation.messages, (m) => m.text || m.markdown).join('\n');
  return {
    NS,
    document,
    conversation: result.conversation,
    warnings: Array.from(result.warnings),
    roles: Array.from(result.conversation.messages, (m) => m.role),
    text
  };
}

test('DeepSeek after switching: only the active conversation is exported', () => {
  const result = extract('deepseek-switched.html');
  assert.equal(result.conversation.messageCount, 4, `expected the 4 messages of the active conversation, got ${result.conversation.messageCount}`);
  assert.deepEqual(result.roles, ['user', 'assistant', 'user', 'assistant']);
  assert.match(result.text, /线上有一条 SQL 很慢/);
  assert.match(result.text, /CREATE INDEX idx_users_email/);
  assert.ok(!result.text.includes('上一段对话'), 'a cached previous conversation must not leak in');
  assert.ok(!result.text.includes('正则匹配邮箱'), 'a cached previous conversation must not leak in');
  assert.ok(!result.text.includes('优化慢 SQL 的索引设计'), 'the history sidebar must not be treated as messages');
  assert.ok(!result.text.includes('周报模板'), 'the history sidebar must not be treated as messages');
});

test('DeepSeek after switching: the range picker sees exactly the active conversation', () => {
  const result = extract('deepseek-switched.html');
  const options = result.NS.core.range.listOptions(result.conversation.messages, 'zh-CN', 40);
  assert.equal(options.length, 4);
  assert.equal(options[0].ordinal, 1);
  assert.match(options[0].preview, /线上有一条 SQL 很慢/);
  assert.equal(options[3].ordinal, 4);
  assert.match(options[3].preview, /CREATE INDEX|等值查询/);
});

test('two conversations visible at once: exactly one of them is exported', () => {
  const result = extract('two-visible-conversations.html');
  assert.equal(result.conversation.messageCount, 4, `expected only the active conversation, got ${result.conversation.messageCount}`);
  assert.ok(!result.text.includes('上一段对话'), 'the other conversation must not leak in');
  assert.match(result.text, /当前对话的第一个问题/);
  assert.match(result.text, /当前对话的第二个回答/);
  // If rows from another conversation were dropped, that must be reported.
  const dropped = result.warnings.filter((w) => /other-conversation/.test(w));
  if (dropped.length) assert.match(dropped[0], /other-conversation-rows-dropped:\d+/);
});

test('hidden ancestors (display:none / aria-hidden / hidden) disqualify rows', () => {
  const cases = [
    '<div style="display: none">%ROWS%</div>',
    '<div aria-hidden="true">%ROWS%</div>',
    '<div hidden>%ROWS%</div>',
    '<div style="visibility: hidden">%ROWS%</div>'
  ];
  const rows = `
    <div class="turn"><div class="bubble">隐藏对话里的第一个问题，长度足够被当作消息</div></div>
    <div class="turn"><div class="bubble"><p>隐藏对话里的第一个回答，长度也足够长一些。</p></div></div>
    <div class="turn"><div class="bubble">隐藏对话里的第二个问题，同样要足够长</div></div>`;
  for (const template of cases) {
    const html = `<!DOCTYPE html><html><body><div id="app">
      ${template.replace('%ROWS%', `<div class="thread">${rows}</div>`)}
      <div class="thread">
        <div class="turn"><div class="bubble">可见对话的第一个问题，长度足够被当作消息</div></div>
        <div class="turn"><div class="bubble"><p>可见对话的第一个回答，长度也足够长一些。</p></div></div>
      </div>
    </div></body></html>`;
    const { NS, document } = createEnv('empty.html', { html, url: 'https://somechat.example.com/t/9' });
    const extraction = NS.core.app.extract(document, { locale: 'zh-CN' });
    const text = Array.from(extraction.conversation.messages, (m) => m.text).join('\n');
    assert.equal(extraction.conversation.messageCount, 2, `hidden rows leaked for: ${template}`);
    assert.ok(!text.includes('隐藏对话'), `hidden content leaked for: ${template}`);
    assert.ok(text.includes('可见对话的第一个问题'), `visible content missing for: ${template}`);
  }
});
