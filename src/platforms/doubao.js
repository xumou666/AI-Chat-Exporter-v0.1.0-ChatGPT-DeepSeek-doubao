/*
 * Platform adapter — 豆包 / Doubao (www.doubao.com).
 *
 * Doubao marks message blocks and the rendered answer body with data-testid
 * attributes ("message_block", "send_message", "receive_message",
 * "message_text_content"), which is the most stable anchor available.
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var platforms = (NS.platforms = NS.platforms || { list: [] });

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s*[|\-–—]\s*豆包\s*$/i, '')
      .replace(/^豆包\s*[|\-–—]\s*/i, '')
      .replace(/\s*[|\-–—]\s*Doubao\s*$/i, '')
      .trim();
  }

  function getMeta(doc, location) {
    var title = cleanTitle(doc.title);
    if (!title) {
      var active = doc.querySelector('[class*="conversation" i] [class*="active" i], [aria-current="page"]');
      if (active) title = String(active.textContent || '').trim();
    }
    var path = (location && location.pathname) || '';
    var idMatch = path.match(/\/(?:chat|conversation)\/([0-9a-zA-Z_-]+)/);
    var model = '';
    var modelNode = doc.querySelector('[data-testid*="model" i], [class*="model-select" i]');
    if (modelNode) model = String(modelNode.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return {
      title: title,
      conversationId: idMatch ? idMatch[1] : null,
      model: model || null
    };
  }

  platforms.list.push({
    id: 'doubao',
    label: '豆包',
    hosts: [/^www\.doubao\.com$/i, /(^|\.)doubao\.com$/i],
    rowSelectors: [
      '[data-testid="message_block"]',
      '[data-testid*="message_block" i]',
      '[data-testid="send_message"]',
      '[data-testid="receive_message"]'
    ],
    contentSelectors: [
      '[data-testid="message_text_content"]',
      '[class*="markdown" i]',
      '[class*="message-content" i]',
      '[class*="message_content" i]'
    ],
    reasoningSelectors: [
      '[data-testid*="think" i]',
      '[class*="thinking" i]',
      '[class*="reasoning" i]'
    ],
    toolSelectors: [
      '[data-testid*="tool" i]',
      '[class*="tool" i]'
    ],
    userPatterns: [/send[_-]?message/i, /user/i, /right/i],
    assistantPatterns: [/receive[_-]?message/i, /message_text_content/i, /assistant/i, /markdown/i],
    userTestIdPatterns: [/send[_-]?message/i, /user/i],
    assistantTestIdPatterns: [/receive[_-]?message/i, /assistant/i],
    userAvatarAlt: ['you', 'user', '我'],
    assistantAvatarAlt: ['豆包', 'doubao', 'assistant', 'ai'],
    ignoreSelectors: [
      '[data-testid*="input" i]',
      '[class*="input-area" i]',
      '[class*="sidebar" i]'
    ],
    getMeta: getMeta
  });

  NS.platforms.doubao = platforms.list[platforms.list.length - 1];
})(typeof globalThis !== 'undefined' ? globalThis : this);
