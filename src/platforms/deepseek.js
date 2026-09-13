/*
 * Platform adapter — DeepSeek (chat.deepseek.com).
 *
 * DeepSeek uses hashed CSS-module class names that change between releases,
 * but the rendered answer body keeps the stable `ds-markdown` class and user
 * bubbles keep a per-release hash. We therefore combine a couple of anchors
 * with the engine's structural discovery, which survives re-hashing.
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var platforms = (NS.platforms = NS.platforms || { list: [] });

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s*[|\-–—]\s*DeepSeek\s*$/i, '')
      .replace(/^DeepSeek\s*[|\-–—]\s*/i, '')
      .trim();
  }

  function getMeta(doc, location) {
    var title = cleanTitle(doc.title);
    if (!title) {
      var active = doc.querySelector('a[aria-current="page"], [class*="active"] a[href*="/chat"]');
      if (active) title = String(active.textContent || '').trim();
    }
    var path = (location && location.pathname) || '';
    var idMatch = path.match(/\/(?:a\/chat\/s|chat\/s|s)\/([0-9a-zA-Z_-]+)/);
    return {
      title: title,
      conversationId: idMatch ? idMatch[1] : null,
      model: null
    };
  }

  platforms.list.push({
    id: 'deepseek',
    label: 'DeepSeek',
    hosts: [/^chat\.deepseek\.com$/i, /(^|\.)deepseek\.com$/i],
    rowSelectors: [
      '[data-message-id]',
      '[data-message-role]',
      '[class*="ds-message" i]'
    ],
    contentSelectors: [
      '.ds-markdown',
      '[class*="ds-markdown" i]',
      '[class*="markdown" i]',
      '[class*="message-content" i]',
      '[class*="message_content" i]',
      '[class*="fbb737a4"]'
    ],
    reasoningSelectors: [
      '[class*="thinking" i]',
      '[class*="reasoning" i]',
      '[class*="cot" i]',
      '[data-testid*="think" i]'
    ],
    toolSelectors: [
      '[class*="tool" i]',
      '[data-testid*="tool" i]'
    ],
    userPatterns: [/fbb737a4/, /user/i, /(^|\s)_9663006(\s|$)/],
    assistantPatterns: [/ds-markdown/, /assistant/i, /(^|\s)_4f9bf79(\s|$)/],
    userTestIdPatterns: [/user/i, /send/i],
    assistantTestIdPatterns: [/assistant/i, /receive/i, /answer/i],
    userAvatarAlt: ['you', 'user', '我'],
    assistantAvatarAlt: ['deepseek', 'assistant', 'ai'],
    ignoreSelectors: [
      '[class*="input" i]',
      '[class*="composer" i]',
      '[class*="sidebar" i]'
    ],
    getMeta: getMeta
  });

  NS.platforms.deepseek = platforms.list[platforms.list.length - 1];
})(typeof globalThis !== 'undefined' ? globalThis : this);
