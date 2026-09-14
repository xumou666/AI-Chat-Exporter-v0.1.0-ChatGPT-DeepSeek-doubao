/*
 * DeepSeek virtual-list tests — built from the real DOM of a chat.deepseek.com
 * share page (same message components as the signed-in app).
 *
 * The app renders messages inside a virtual list where each item carries
 * `data-virtual-list-item-key` = its ordinal inside the conversation. Switching
 * conversations can leave the previous conversation's items mounted, which is
 * exactly the "other conversation leaked into my export" bug.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

function extract(fixture) {
  const { NS, document } = createEnv(fixture);
  const result = NS.core.app.extract(document, { locale: 'zh-CN' });
  return {
    NS,
    document,
    conversation: result.conversation,
    warnings: Array.from(result.warnings),
    roles: Array.from(result.conversation.messages, (m) => m.role),
    text: Array.from(result.conversation.messages, (m) => m.text).join('\n'),
    strategy: result.strategy,
    debug: result.debug
  };
}

test('real DeepSeek markup: virtual list rows are read with correct roles', () => {
  const result = extract('deepseek-virtual-real.html');
  assert.equal(result.conversation.messageCount, 4);
  assert.deepEqual(result.roles, ['user', 'assistant', 'user', 'assistant']);
  assert.match(result.text, /线上有一条 SQL 很慢/);
  assert.match(result.text, /CREATE INDEX idx_users_email/);
  assert.ok(!result.text.includes('该对话来自分享'), 'the guest banner item (-999) must not be exported');
  assert.equal(result.strategy, 'platform-selectors');
});

test('switching conversations: items from another conversation are dropped by key discontinuity', () => {
  const result = extract('deepseek-virtual-stale.html');
  assert.equal(result.conversation.messageCount, 4, `got ${result.conversation.messageCount}: ${result.text.slice(0, 80)}`);
  assert.deepEqual(result.roles, ['user', 'assistant', 'user', 'assistant']);
  assert.match(result.text, /当前对话：线上有一条 SQL 很慢/);
  assert.match(result.text, /CREATE INDEX idx_users_email/);
  assert.ok(!result.text.includes('上一段对话'), 'the stale conversation must not leak in');
  assert.ok(
    result.warnings.some((w) => /other-conversation-rows-dropped:2/.test(w)),
    `dropping 2 stale rows must be reported: ${result.warnings.join(',')}`
  );
});

test('diagnostics expose the virtual-list keys and what was dropped', () => {
  const result = extract('deepseek-virtual-stale.html');
  const platform = result.NS.platforms.detect(result.document.location);
  const info = result.NS.core.engine.debugCandidates(result.document, platform);
  const keys = info.rows.map((row) => row.key);
  assert.ok(keys.includes(1101) && keys.includes(1102), `stale keys must be listed: ${keys.join(',')}`);
  assert.ok(keys.includes(1) && keys.includes(4), `current keys must be listed: ${keys.join(',')}`);
  const dropped = Array.from(info.rows.filter((row) => row.kept === false), (row) => row.key);
  assert.deepEqual(dropped, [1101, 1102], 'the two stale rows must be marked as dropped');
  assert.equal(info.droppedRows, 2);
  assert.equal(info.scopedBy, 'item-key');
});

test('a contiguous key window is one conversation and is never split', () => {
  const result = extract('deepseek-virtual-real.html');
  const platform = result.NS.platforms.detect(result.document.location);
  const info = result.NS.core.engine.debugCandidates(result.document, platform);
  assert.equal(info.droppedRows, 0, 'nothing may be dropped when the window is contiguous');
  assert.ok(info.rows.every((row) => row.kept !== false));
});
