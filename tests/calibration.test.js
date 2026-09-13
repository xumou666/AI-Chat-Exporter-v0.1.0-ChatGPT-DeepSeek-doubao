/*
 * Calibration tests — learning a page structure from two sample messages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv } from './helpers/env.mjs';

test('deriveRules learns row signatures plus content signatures', () => {
  const { NS, document } = createEnv('generic-random.html');
  const userSample = document.querySelectorAll('.txt_9f')[0];
  const assistantSample = document.querySelectorAll('.md-content')[0];
  const rules = NS.core.engine.deriveRules(userSample, assistantSample, document);

  assert.equal(rules.schema, 'ai-chat-exporter/rules@1');
  // user and assistant rows share one signature here, so the role must come
  // from the content signature — that is exactly what the calibration stores.
  assert.equal(rules.userSignature, 'DIV.row_ab12.sc-q81mz');
  assert.equal(rules.assistantSignature, 'DIV.row_ab12.sc-q81mz');
  assert.equal(rules.userContentSignature, 'DIV.sc-77aa.txt_9f');
  assert.equal(rules.assistantContentSignature, 'DIV.md-content.sc-31bb');
  assert.equal(rules.pageHost, 'somechat.example.com');
  assert.match(rules.samples.user, /Why is my widget re-rendering twice\?/);
  assert.match(rules.samples.assistant, /the effect depends on an object literal/);
});

test('rules extracted from one page still work after a JSON round trip', () => {
  const { NS, document } = createEnv('generic-random.html');
  const rules = JSON.parse(JSON.stringify(NS.core.engine.deriveRules(
    document.querySelectorAll('.txt_9f')[0],
    document.querySelectorAll('.md-content')[0],
    document
  )));
  const result = NS.core.engine.extractWithRules(document, rules, {});
  assert.equal(result.messages.length, 4);
  assert.deepEqual(Array.from(result.messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
  assert.match(result.messages[1].markdown, /```jsx/);
  assert.match(result.messages[3].markdown, /useMemo/);
  assert.ok(!result.messages.some((m) => /Send a message/.test(m.markdown)));
});

test('calibrated rules take over the platform selectors in app.extract', () => {
  const { NS, document } = createEnv('generic-random.html');
  const rules = NS.core.engine.deriveRules(
    document.querySelectorAll('.txt_9f')[0],
    document.querySelectorAll('.md-content')[0],
    document
  );
  const extraction = NS.core.app.extract(document, { customRules: rules });
  assert.equal(extraction.conversation.messageCount, 4);
  assert.equal(extraction.conversation.meta.extraction.calibrated, true);
  assert.equal(extraction.conversation.meta.extraction.strategy, 'custom-rules');
});

test('calibration works on a known site too (selector drift recovery)', () => {
  const { NS, document } = createEnv('chatgpt.html');
  const userSample = document.querySelector('[data-message-author-role="user"]');
  const assistantSample = document.querySelector('[data-message-author-role="assistant"]');
  const rules = NS.core.engine.deriveRules(userSample, assistantSample, document);
  assert.equal(rules.userSignature, 'ARTICLE');
  const messages = NS.core.engine.extractWithRules(document, rules, {}).messages;
  assert.equal(messages.length, 4);
  assert.deepEqual(Array.from(messages.map((m) => m.role)), ['user', 'assistant', 'user', 'assistant']);
});

test('a rule that matches nothing is reported instead of silently exporting', () => {
  const { NS, document } = createEnv('generic-random.html');
  const extraction = NS.core.app.extract(document, {
    customRules: { userSignature: 'DIV.nothing-here', assistantSignature: 'DIV.also-nothing', threshold: 0.98 }
  });
  assert.equal(extraction.conversation.messageCount, 0);
  assert.ok(extraction.warnings.includes('no-message-rows-detected') || extraction.warnings.includes('custom-rules-found-nothing'));
});

test('pages without any message list produce a clear warning', () => {
  const { NS, document } = createEnv('empty.html', {
    html: '<!DOCTYPE html><html><body><div id="root"><p>nothing to see</p></div></body></html>',
    url: 'https://example.com/blank'
  });
  const extraction = NS.core.app.extract(document, {});
  assert.equal(extraction.conversation.messageCount, 0);
  assert.ok(extraction.warnings.includes('no-message-rows-detected'));
  assert.equal(NS.core.schema.validate(extraction.conversation).ok, true);
});
