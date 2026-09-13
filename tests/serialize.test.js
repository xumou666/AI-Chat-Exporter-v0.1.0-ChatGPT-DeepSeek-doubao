/*
 * Serialiser tests — Markdown / JSON / plain text / filenames.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

function conversationOf(fixture = 'chatgpt.html', options = {}) {
  const { NS, document } = createEnv(fixture);
  return { NS, conversation: NS.core.app.extract(document, options).conversation };
}

test('Markdown export: front matter, metadata block, TOC and stable anchors', () => {
  const { NS, conversation } = conversationOf();
  const markdown = NS.core.serialize.toMarkdown(conversation, { locale: 'zh-CN', includeToc: true });

  assert.ok(markdown.startsWith('---\ntitle: "Python 列表去重"\n'), 'YAML front matter comes first');
  assert.match(markdown, /^platform: ChatGPT$/m);
  assert.match(markdown, /^platform_id: chatgpt$/m);
  assert.match(markdown, /^url: "https:\/\/chatgpt\.com\/c\/abc123"$/m);
  assert.match(markdown, /^conversation_id: abc123$/m);
  assert.match(markdown, /^message_count: 4$/m);
  assert.match(markdown, /^schema: "ai-chat-exporter\/conversation@1"$/m);
  assert.match(markdown, /\n# Python 列表去重\n/);
  assert.match(markdown, /\*\*平台\*\*: ChatGPT/);
  assert.match(markdown, /## 目录\n\n- \[1\. 👤 用户\]\(#1--用户\)/);
  assert.match(markdown, /- \[2\. 🤖 助手\]\(#2--助手\)/);
  assert.match(markdown, /\n## 1\. 👤 用户\n/);
  assert.match(markdown, /\n## 2\. 🤖 助手\n/);
  assert.match(markdown, /\n---\n\n## 3\. 👤 用户\n/);
});

test('Markdown export: options toggle front matter, TOC, citations and timestamps', () => {
  const { NS, conversation } = conversationOf('chatgpt.html', { reasoning: true });
  const lean = NS.core.serialize.toMarkdown(conversation, { locale: 'zh-CN', includeFrontMatter: false, includeToc: false, includeMeta: false });
  assert.ok(!lean.startsWith('---'));
  assert.ok(!lean.includes('## 目录'));
  assert.ok(lean.startsWith('# Python 列表去重'));

  const rich = NS.core.serialize.toMarkdown(conversation, { locale: 'zh-CN', includeToc: true, includeCitations: true, includeReasoning: true });
  assert.match(rich, /\*\*参考链接\*\*/);
  assert.match(rich, /<details>\n<summary>思考过程<\/summary>/);
});

test('Markdown export: English locale labels', () => {
  const { NS, conversation } = conversationOf('doubao.html', { locale: 'en' });
  const markdown = NS.core.serialize.toMarkdown(conversation, { locale: 'en', includeToc: true });
  assert.match(markdown, /\*\*Platform\*\*: 豆包/);
  assert.match(markdown, /## 2\. 🤖 Assistant/);
});

test('JSON export: schema-valid, pretty-printed and lossless round trip', () => {
  const { NS, conversation } = conversationOf();
  const json = NS.core.serialize.toJSON(conversation, {});
  const parsed = JSON.parse(json);

  assert.equal(parsed.schema, 'ai-chat-exporter/conversation@1');
  assert.equal(parsed.messageCount, 4);
  assert.equal(parsed.messages.length, 4);
  assert.equal(parsed.messages[1].role, 'assistant');
  assert.equal(parsed.messages[1].images[0].url, 'https://cdn.example.com/chart.png');
  assert.deepEqual(parsed.meta.scope, { mode: 'full' });
  assert.equal(NS.core.schema.validate(parsed).ok, true);
  assert.equal(JSON.stringify(parsed, null, 2), json.trim());
});

test('Plain-text export stays readable', () => {
  const { NS, conversation } = conversationOf('chatgpt.html', { locale: 'en' });
  const text = NS.core.serialize.toPlainText(conversation, { locale: 'en' });
  assert.match(text, /^Python 列表去重\n=+/);
  assert.match(text, /\[1\] USER/);
  assert.match(text, /\[2\] ASSISTANT/);
});

test('Filenames: template rendering, sanitising and extensions', () => {
  const { NS, conversation } = conversationOf();
  const options = { now: '2026-09-13T10:20:00' };
  assert.equal(
    NS.core.serialize.renderFilename('{platform}_{title}_{date}', conversation, 'md', options),
    'chatgpt_Python 列表去重_20260913-1020.md'
  );
  assert.equal(NS.core.serialize.sanitizeFilename('a/b:c*d?e"f<g>h|i'), 'a-b-c-d-e-f-g-h-i');
  assert.equal(NS.core.serialize.sanitizeFilename('   ...   ', 'fallback'), 'fallback');

  conversation.title = 'Q: what is 1/2 < 3?';
  const name = NS.core.serialize.renderFilename('{platform}_{title}_{date}', conversation, 'json', options);
  assert.equal(name, 'chatgpt_Q- what is 1-2 - 3_20260913-1020.json');
  assert.ok(!/[\\/:*?"<>|]/.test(name));
});

test('buildExport returns the right mime type per format', () => {
  const { NS, conversation } = conversationOf();
  const cases = [
    ['md', 'md', 'text/markdown;charset=utf-8'],
    ['json', 'json', 'application/json;charset=utf-8'],
    ['txt', 'txt', 'text/plain;charset=utf-8'],
    ['html', 'html', 'text/html;charset=utf-8']
  ];
  for (const [format, extension, mime] of cases) {
    const built = NS.core.serialize.buildExport(conversation, { format, locale: 'zh-CN' });
    assert.equal(built.extension, extension, format);
    assert.equal(built.mime, mime, format);
    assert.ok(built.filename.endsWith('.' + extension), format + ' filename');
    assert.ok(built.text.length > 100, format + ' payload');
  }
});

test('range helper parses user input and slices conversations', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const conversation = NS.core.app.extract(document, {}).conversation;
  assert.deepEqual({ ...NS.core.range.parse('2-3') }, { mode: 'range', from: 2, to: 3 });
  assert.deepEqual({ ...NS.core.range.parse('3:') }, { mode: 'range', from: 3, to: Infinity });
  assert.deepEqual({ ...NS.core.range.parse('full') }, { mode: 'full' });
  assert.deepEqual({ ...NS.core.range.parse('5') }, { mode: 'range', from: 5, to: 5 });
  assert.equal(NS.core.range.slice(conversation.messages, { mode: 'range', from: 2, to: 3 }).length, 2);
  assert.equal(NS.core.range.slice(conversation.messages, { mode: 'full' }).length, 4);
  assert.equal(NS.core.range.listOptions(conversation.messages, 'zh-CN')[0].label, '1. 用户');
});
