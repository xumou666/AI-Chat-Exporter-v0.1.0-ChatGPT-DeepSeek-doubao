/*
 * HTML / print-document tests for the PDF export path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

test('markdownToHtml renders the subset the exporter emits', () => {
  const { NS } = createEnv('generic-random.html');
  const html = NS.core.html.markdownToHtml([
    '# 标题',
    '',
    '段落 with `code`, **bold**, *italic* and [link](https://example.com).',
    '',
    '```python',
    'print("hi")',
    '```',
    '',
    '- 一',
    '  - 嵌套',
    '- 二',
    '',
    '1. first',
    '2. second',
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '> 引用'
  ].join('\n'));

  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<a href="https:\/\/example\.com">link<\/a>/);
  assert.match(html, /<pre><code class="language-python">print\(&quot;hi&quot;\)<\/code><\/pre>/);
  assert.match(html, /<ul><li>一<ul><li>嵌套<\/li><\/ul><\/li><li>二<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<blockquote>\s*<p>引用<\/p>\s*<\/blockquote>/);
});

test('markdownToHtml renders display and inline math instead of raw $$', () => {
  const { NS } = createEnv('generic-random.html');
  const html = NS.core.html.markdownToHtml('能量守恒 $E = mc^2$，以及：\n\n$$\nT(n) = O(n)\n$$');
  assert.match(html, /<span class="math-inline">E = mc\^2<\/span>/);
  assert.match(html, /<div class="math">T\(n\) = O\(n\)<\/div>/);
  assert.ok(!html.includes('$$'));
});

test('markdownToHtml escapes HTML from the page', () => {
  const { NS } = createEnv('generic-random.html');
  const html = NS.core.html.markdownToHtml('Use <script>alert(1)</script> carefully');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('buildPrintDocument produces a printable, self-contained A4 document', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const conversation = NS.core.app.extract(document, { reasoning: true }).conversation;
  const doc = NS.core.pdf.buildPrintDocument(conversation, { includeToc: true, includeReasoning: true, locale: 'zh-CN' });

  assert.match(doc, /^<!DOCTYPE html>/);
  assert.match(doc, /<meta charset="utf-8">/);
  assert.match(doc, /<title>Python 列表去重<\/title>/);
  assert.match(doc, /@page \{ size: A4; margin: 16mm 14mm; \}/);
  assert.match(doc, /page-break-inside: avoid/);
  assert.match(doc, /<section class="msg msg-user" id="msg-0">/);
  assert.match(doc, /<section class="msg msg-assistant" id="msg-1">/);
  assert.match(doc, /<code class="language-python">/);
  assert.match(doc, /<img alt="性能对比图" src="https:\/\/cdn\.example\.com\/chart\.png">/);
  assert.match(doc, /window\.print\(\)/);
  assert.match(doc, /<div class="toc">/);
  assert.match(doc, /<details><summary>思考过程<\/summary>/);
  assert.ok(!doc.includes('Copy code'));
});

test('buildPrintDocument can skip auto-print (used when packaging into a ZIP)', () => {
  const { NS, document } = createEnv('doubao.html');
  const conversation = NS.core.app.extract(document, {}).conversation;
  const doc = NS.core.pdf.buildPrintDocument(conversation, { autoPrint: false });
  assert.ok(!doc.includes('window.print()'));
  assert.match(doc, /<table>/);
});

test('openPrintWindow writes the document into a new window', () => {
  const { NS } = createEnv('generic-random.html');
  const written = [];
  const fakeWindow = {
    document: {
      open() { written.push('open'); },
      write(html) { written.push(html); },
      close() { written.push('close'); },
      title: ''
    },
    focus() {},
    print() { written.push('print'); }
  };
  const win = NS.core.pdf.openPrintWindow('<html>ok</html>', {
    open: () => fakeWindow,
    setTimeout: (fn) => { fn(); return 1; }
  });
  assert.equal(win, fakeWindow);
  assert.deepEqual(written[0], 'open');
  assert.equal(written[1], '<html>ok</html>');
  assert.equal(written[written.length - 1], 'print');
});

test('openPrintWindow surfaces popup blockers', () => {
  const { NS } = createEnv('generic-random.html');
  assert.throws(() => NS.core.pdf.openPrintWindow('<html></html>', { open: () => null }), /popup-blocked/);
});
