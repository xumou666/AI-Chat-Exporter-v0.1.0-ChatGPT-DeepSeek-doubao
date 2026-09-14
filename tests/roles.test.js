/*
 * Role-classification regression tests.
 *
 * A wrong user/assistant split is the most damaging kind of bug this exporter
 * can have: it silently flips the transcript in Markdown/PDF output and in the
 * range-picker preview. These fixtures reproduce the three ways the DOM can
 * mislead the classifier.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

function rolesOf(fixture) {
  const { NS, document } = createEnv(fixture);
  const extraction = NS.core.app.extract(document, { locale: 'zh-CN' });
  return {
    roles: Array.from(extraction.conversation.messages, (m) => m.role),
    confidences: Array.from(extraction.conversation.messages, (m) => m.roleConfidence),
    warnings: Array.from(extraction.warnings),
    conversation: extraction.conversation
  };
}

test('a turn id is not a role: pages without data-message-author-role', () => {
  const result = rolesOf('chatgpt-turn-only.html');
  assert.equal(result.conversation.messageCount, 4);
  assert.deepEqual(result.roles, ['user', 'assistant', 'user', 'assistant']);
  assert.ok(
    !result.conversation.messages.some((m) => /conversation-turn/.test(m.roleReason || '') && m.role === 'assistant'),
    'a "conversation-turn" testid must never be used as assistant evidence'
  );
});

test('a shared markdown wrapper must not turn every row into an assistant message', () => {
  const result = rolesOf('shared-markdown-wrapper.html');
  assert.equal(result.conversation.messageCount, 4);
  assert.deepEqual(result.roles, ['user', 'assistant', 'user', 'assistant']);
  assert.ok(result.roles.includes('user'), 'at least one row must stay a user message');
});

test('with no signals at all the opening assistant message is not flipped', () => {
  const result = rolesOf('no-role-signals.html');
  assert.equal(result.conversation.messageCount, 4);
  assert.deepEqual(result.roles, ['assistant', 'user', 'assistant', 'user']);
});

test('a uniformly classified conversation is repaired instead of exported as-is', () => {
  const html = `<!DOCTYPE html><html><body>
    <div class="list">
      <div class="row markdown-body"><p>第一条：先确认扩展已经加载并且页面刷新过，否则内容脚本不会注入。</p></div>
      <div class="row markdown-body"><p>第二条：如果仍然没有面板，请到扩展管理页确认扩展处于启用状态。</p></div>
      <div class="row markdown-body"><p>第三条：导出前建议先展开结构诊断，确认每条消息的角色判断是否正确。</p></div>
      <div class="row markdown-body"><p>第四条：如果站点改版导致识别失败，可以用手动校准重新学习页面结构。</p></div>
    </div>
  </body></html>`;
  const { NS, document } = createEnv('empty.html', { html, url: 'https://example.com/chat' });
  const extraction = NS.core.app.extract(document, { locale: 'zh-CN' });
  const roles = Array.from(extraction.conversation.messages, (m) => m.role);
  assert.ok(roles.includes('user') && roles.includes('assistant'), `roles must alternate, got ${roles.join(',')}`);
  assert.deepEqual(roles, ['user', 'assistant', 'user', 'assistant']);
  assert.ok(
    extraction.warnings.some((w) => /role/i.test(w)),
    `a repaired conversation must warn: ${extraction.warnings.join(',')}`
  );
});

test('low-confidence roles are marked in the picker data', () => {
  const { NS, document } = createEnv('no-role-signals.html');
  const extraction = NS.core.app.extract(document, { locale: 'zh-CN' });
  const options = NS.core.range.listOptions(extraction.conversation.messages, 'zh-CN', 32);
  assert.equal(options.length, 4);
  assert.ok(options.every((option) => typeof option.confidence === 'string'), 'each option carries its role confidence');
  assert.equal(options[0].role, 'assistant');
});

test('the chatgpt adapter no longer treats conversation-turn as assistant evidence', () => {
  const { platforms } = createEnv('chatgpt-turn-only.html');
  const chatgpt = platforms.getById('chatgpt');
  for (const pattern of chatgpt.assistantTestIdPatterns) {
    assert.ok(!pattern.test('conversation-turn-7'), `pattern ${pattern} must not match a turn id`);
  }
});
