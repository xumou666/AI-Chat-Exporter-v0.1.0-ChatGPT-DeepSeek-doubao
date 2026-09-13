/*
 * Platform adapter — generic fallback used on any other chat page
 * (or when a known site changed its DOM beyond the shipped selectors).
 * Relies entirely on the engine's structural heuristics.
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var platforms = (NS.platforms = NS.platforms || { list: [] });

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s*[|\-–—]\s*(ChatGPT|DeepSeek|豆包|Doubao|Claude|Gemini|Kimi|通义千问)\s*$/i, '')
      // Drop a trailing " - SiteName" suffix (short, single token).
      .replace(/\s+[|\-–—]\s+[A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5._]{0,19}$/, '')
      .trim();
  }

  function getMeta(doc, location) {
    return {
      title: cleanTitle(doc.title),
      conversationId: null,
      model: null,
      url: location ? location.href : ''
    };
  }

  platforms.list.push({
    id: 'generic',
    label: '网页对话',
    hosts: [],
    rowSelectors: [],
    contentSelectors: [
      '[class*="markdown" i]',
      '[class*="prose" i]',
      '[class*="message-content" i]',
      '[class*="message_content" i]',
      '[class*="message-body" i]',
      '[data-testid*="message_text_content"]'
    ],
    getMeta: getMeta
  });

  NS.platforms.generic = platforms.list[platforms.list.length - 1];
})(typeof globalThis !== 'undefined' ? globalThis : this);
