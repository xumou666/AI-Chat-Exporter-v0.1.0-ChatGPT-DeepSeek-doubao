/*
 * Extraction tests — one fixture per supported site, plus the generic fallback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

test('ChatGPT: detects the platform and walks every conversation turn', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const { conversation: c, warnings } = NS.core.app.extract(document, { locale: 'zh-CN' });

  assert.equal(c.platform, 'chatgpt');
  assert.equal(c.platformLabel, 'ChatGPT');
  assert.equal(c.title, 'Python 列表去重');
  assert.equal(c.conversationId, 'abc123');
  assert.equal(c.messageCount, 4);
  assert.deepEqual(Array.from(c.messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.deepEqual(Array.from(warnings), []);
  assert.equal(NS.core.schema.validate(c).ok, true);
});

test('ChatGPT: user turns keep their line breaks and the draft composer is ignored', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const { conversation: c } = NS.core.app.extract(document, {});
  const user = c.messages[0];

  assert.match(user.markdown, /如何用 Python 给列表去重？/);
  assert.match(user.markdown, /保持原有顺序/);
  assert.match(user.markdown, /给出时间复杂度/);
  assert.ok(user.markdown.split('\n').length >= 4, 'multi-line prompt should keep its line structure');
  assert.ok(!c.messages.some((m) => /Message ChatGPT/.test(m.markdown)), 'composer textarea must not be exported');
});

test('ChatGPT: markdown, tables, math, links and images survive the conversion', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const { conversation: c } = NS.core.app.extract(document, {});
  const assistant = c.messages[1];

  assert.match(assistant.markdown, /```python/);
  assert.match(assistant.markdown, /list\(dict\.fromkeys\(items\)\)/);
  assert.match(assistant.markdown, /\| 方案 \| 时间复杂度 \| 是否保序 \|/);
  assert.match(assistant.markdown, /\| --- \| --- \| --- \|/);
  assert.match(assistant.markdown, /\| dict\.fromkeys \| O\(n\) \| 是 \|/);
  assert.match(assistant.markdown, /- 需要保序：\*\*dict\.fromkeys\*\*/);
  assert.match(assistant.markdown, /\$\$\nT\(n\) = O\(n\)\n\$\$/);
  assert.match(assistant.markdown, /\[Python 官方文档\]\(https:\/\/docs\.python\.org\/3\/library\/stdtypes\.html#dict\.fromkeys\)/);
  assert.match(assistant.markdown, /!\[性能对比图\]\(https:\/\/cdn\.example\.com\/chart\.png\)/);
  assert.equal(assistant.markdown.split('![性能对比图]').length - 1, 1, 'images must not be duplicated');
  assert.ok(!assistant.markdown.includes('Copy code'), 'copy-code chrome must be stripped');
  assert.equal(assistant.images.length, 1);
  assert.equal(assistant.images[0].url, 'https://cdn.example.com/chart.png');
  assert.equal(assistant.citations.length, 1);
  assert.equal(assistant.citations[0].url, 'https://docs.python.org/3/library/stdtypes.html#dict.fromkeys');
  assert.ok(!assistant.markdown.includes('avatar-gpt'), 'avatars must not be exported as images');
});

test('ChatGPT: reasoning blocks are captured only when requested', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const without = NS.core.app.extract(document, {});
  assert.ok(!without.conversation.messages[3].reasoning);
  assert.ok(!without.conversation.messages[3].markdown.includes('需要用 key 函数'));

  const withReasoning = NS.core.app.extract(document, { reasoning: true });
  assert.match(withReasoning.conversation.messages[3].reasoning, /需要用 key 函数/);
});

test('DeepSeek: hashed CSS-module classes are handled by structural detection', () => {
  const { NS, document } = createEnv('deepseek.html');
  const { conversation: c } = NS.core.app.extract(document, { locale: 'zh-CN' });

  assert.equal(c.platform, 'deepseek');
  assert.equal(c.title, '如何优化慢 SQL');
  assert.equal(c.conversationId, '9f8e7d6c');
  assert.equal(c.messageCount, 4);
  assert.deepEqual(Array.from(c.messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.match(c.messages[0].markdown, /线上有一条 SQL 很慢/);
  assert.match(c.messages[1].markdown, /```sql/);
  assert.match(c.messages[1].markdown, /EXPLAIN ANALYZE/);
  assert.match(c.messages[1].markdown, /1\. 用 `EXPLAIN` 看执行计划/);
  assert.match(c.messages[3].markdown, /CREATE INDEX idx_users_email/);
  assert.ok(!c.messages.some((m) => /给 DeepSeek 发送消息/.test(m.markdown)), 'input box must not be exported');
});

test('豆包 / Doubao: data-testid rows give exact roles and content', () => {
  const { NS, document } = createEnv('doubao.html');
  const { conversation: c } = NS.core.app.extract(document, { locale: 'zh-CN' });

  assert.equal(c.platform, 'doubao');
  assert.equal(c.title, '帮我写一份周报');
  assert.equal(c.conversationId, '1234567890');
  assert.equal(c.messageCount, 4);
  assert.deepEqual(Array.from(c.messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.match(c.messages[1].markdown, /### 本周工作周报/);
  assert.match(c.messages[1].markdown, /- 订单查询接口 P99 从 820ms 降到 210ms/);
  assert.match(c.messages[1].markdown, /1\. 补齐压测基线/);
  assert.match(c.messages[3].markdown, /\| 索引变更需 DBA 审批 \| 上线延后 1 天 \| 提前提交工单 \|/);
  assert.ok(!c.messages.some((m) => /发消息给豆包/.test(m.markdown)), 'composer must not be exported');
});

test('Generic fallback: unknown chat UI is still extracted with alternation', () => {
  const { NS, document } = createEnv('generic-random.html');
  const { conversation: c, strategy } = NS.core.app.extract(document, { locale: 'en' });

  assert.equal(c.platform, 'generic');
  assert.equal(c.title, 'Renamed widget');
  assert.equal(c.messageCount, 4);
  assert.deepEqual(Array.from(c.messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.match(c.messages[1].markdown, /```jsx/);
  assert.match(c.messages[1].markdown, /useEffect/);
  assert.match(c.messages[3].markdown, /useMemo/);
  assert.ok(['repeated-siblings', 'repeated-siblings-single'].includes(strategy));
  assert.ok(!c.messages.some((m) => /Send a message/.test(m.markdown)));
});

test('range export keeps only the requested messages and re-indexes them', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const all = NS.core.app.extract(document, {});
  const partial = NS.core.app.extract(document, { scope: { mode: 'range', from: 3, to: 4 } });
  assert.equal(partial.conversation.messageCount, 2);
  assert.deepEqual(Array.from(partial.conversation.messages.map((m) => m.role)), ['user', 'assistant']);
  assert.deepEqual(Array.from(partial.conversation.messages.map((m) => m.index)), [0, 1]);
  assert.ok(all.conversation.messageCount > partial.conversation.messageCount);
  assert.match(partial.conversation.messages[0].markdown, /如果元素是字典呢？/);
});

test('debugCandidates explains the detection strategy for the panel', () => {
  const { NS, document } = createEnv('doubao.html');
  const platform = NS.platforms.detect(document.location);
  const info = NS.core.engine.debugCandidates(document, platform);
  assert.equal(info.hints, 'doubao');
  assert.equal(info.rowCount, 4);
  assert.equal(info.rows.length, 4);
  assert.deepEqual(Array.from(info.rows.map((row) => row.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.match(info.rows[0].text, /帮我写一份本周工作周报/);
});
