/*
 * Platform adapter — ChatGPT (chatgpt.com, chat.openai.com).
 *
 * Structural anchors used (2024-2026 DOM):
 *   article[data-testid="conversation-turn-<n>"]  -> one message row
 *   [data-message-author-role="user|assistant"]   -> role + content wrapper
 *   .markdown / .prose                            -> rendered assistant markdown
 *   div.whitespace-pre-wrap                       -> user text
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var platforms = (NS.platforms = NS.platforms || { list: [] });

  function cleanTitle(raw) {
    return String(raw || '')
      .replace(/\s*[|\-–—]\s*ChatGPT\s*$/i, '')
      .replace(/^ChatGPT\s*[|\-–—]\s*/i, '')
      .trim();
  }

  function getMeta(doc, location) {
    var title = cleanTitle(doc.title);
    if (!title) {
      var active = doc.querySelector('nav a[href^="/c/"][aria-current="page"], nav [aria-current="page"] a[href^="/c/"]');
      if (active) title = String(active.textContent || '').trim();
    }
    var idMatch = location && location.pathname ? location.pathname.match(/\/c\/([0-9a-zA-Z_-]+)/) : null;
    var model = '';
    var modelNode = doc.querySelector('[data-testid="model-switcher-dropdown"], [data-testid*="model-switcher"]');
    if (modelNode) model = String(modelNode.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      title: title,
      conversationId: idMatch ? idMatch[1] : null,
      model: model || null
    };
  }

  platforms.list.push({
    id: 'chatgpt',
    label: 'ChatGPT',
    hosts: [/^chatgpt\.com$/i, /^chat\.openai\.com$/i, /\.chatgpt\.com$/i, /\.openai\.com$/i],
    rowSelectors: [
      'article[data-testid^="conversation-turn"]',
      '[data-testid^="conversation-turn"]',
      'section[data-turn]',
      '[data-turn]',
      '[data-message-author-role]'
    ],
    contentSelectors: [
      '[data-message-author-role] .markdown',
      '.markdown.prose',
      '.markdown',
      '[data-message-author-role] .prose',
      'div.whitespace-pre-wrap',
      '[class*="whitespace-pre-wrap" i]'
    ],
    reasoningSelectors: [
      '[data-testid*="reasoning"]',
      '[class*="reasoning" i]',
      '.thought'
    ],
    toolSelectors: [
      '[data-testid*="tool" i]',
      '[class*="tool-call" i]'
    ],
    userPatterns: [/user-message/i, /data-turn=["']?user/i, /\buser\b/i],
    assistantPatterns: [/assistant/i, /\bmarkdown\b/i, /prose/i],
    userTestIdPatterns: [/user[-_ ]?message/i],
    assistantTestIdPatterns: [/assistant/i, /conversation-turn/i],
    userAvatarAlt: ['you', 'user'],
    assistantAvatarAlt: ['chatgpt', 'gpt', 'assistant', 'openai'],
    ignoreSelectors: [
      '[data-testid*="conversation-turn-system" i]',
      '[data-testid*="scroll" i]',
      '[data-testid*="composer" i]',
      '#composer-background',
      'form'
    ],
    getMeta: getMeta
  });

  NS.platforms.chatgpt = platforms.list[platforms.list.length - 1];
})(typeof globalThis !== 'undefined' ? globalThis : this);
