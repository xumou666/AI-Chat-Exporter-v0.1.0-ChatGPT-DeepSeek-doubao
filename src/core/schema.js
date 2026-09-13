/*
 * AI Chat Exporter — conversation data model.
 * Exposes: globalThis.AIChatExporter.core.schema
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var SCHEMA_ID = 'ai-chat-exporter/conversation@1';
  var EXPORTER_NAME = 'AI Chat Exporter';
  var EXPORTER_VERSION = '0.1.0';

  var ROLES = ['user', 'assistant', 'system', 'tool'];
  var ROLE_LABELS = {
    user: { 'zh-CN': '用户', en: 'User', emoji: '👤' },
    assistant: { 'zh-CN': '助手', en: 'Assistant', emoji: '🤖' },
    system: { 'zh-CN': '系统', en: 'System', emoji: '⚙️' },
    tool: { 'zh-CN': '工具', en: 'Tool', emoji: '🛠️' }
  };

  function roleLabel(role, locale) {
    var entry = ROLE_LABELS[role] || { 'zh-CN': role, en: role, emoji: '💬' };
    return entry[locale] || entry.en || role;
  }

  function roleEmoji(role) {
    var entry = ROLE_LABELS[role];
    return entry ? entry.emoji : '💬';
  }

  function normalizeRole(role) {
    var value = String(role || '').toLowerCase();
    if (ROLES.indexOf(value) !== -1) return value;
    if (/^(human|me|user)$/.test(value)) return 'user';
    if (/^(ai|bot|model|gpt|assistant)$/.test(value)) return 'assistant';
    return value || 'unknown';
  }

  function normalizeMessage(message, index) {
    message = message || {};
    var normalized = {
      index: typeof message.index === 'number' ? message.index : index,
      role: normalizeRole(message.role),
      author: message.author || null,
      model: message.model || null,
      createdAt: message.createdAt || null,
      markdown: typeof message.markdown === 'string' ? message.markdown : '',
      text: typeof message.text === 'string' ? message.text : '',
      images: Array.isArray(message.images) ? message.images.slice() : [],
      citations: Array.isArray(message.citations) ? message.citations.slice() : [],
      attachments: Array.isArray(message.attachments) ? message.attachments.slice() : []
    };
    if (message.html) normalized.html = message.html;
    if (message.reasoning) normalized.reasoning = message.reasoning;
    if (message.toolCalls) normalized.toolCalls = message.toolCalls;
    if (message.roleConfidence) normalized.roleConfidence = message.roleConfidence;
    if (!normalized.text && normalized.markdown) normalized.text = normalized.markdown;
    return normalized;
  }

  function createConversation(partial) {
    partial = partial || {};
    return {
      schema: SCHEMA_ID,
      platform: partial.platform || 'unknown',
      platformLabel: partial.platformLabel || partial.platform || 'Unknown',
      title: partial.title || '',
      url: partial.url || '',
      conversationId: partial.conversationId || null,
      model: partial.model || null,
      createdAt: partial.createdAt || null,
      exportedAt: partial.exportedAt || new Date().toISOString(),
      locale: partial.locale || 'zh-CN',
      messageCount: 0,
      messages: [],
      meta: {
        exporter: { name: EXPORTER_NAME, version: EXPORTER_VERSION, engine: core.engine ? core.engine.version : null },
        extraction: partial.extraction || null,
        warnings: partial.warnings || []
      }
    };
  }

  function finalize(conversation) {
    var messages = (conversation.messages || []).map(normalizeMessage).filter(function (message) {
      return (message.markdown && message.markdown.trim()) || (message.text && message.text.trim()) ||
        (message.images && message.images.length) || message.reasoning || message.toolCalls;
    });
    messages.forEach(function (message, index) { message.index = index; });
    conversation.messages = messages;
    conversation.messageCount = messages.length;
    conversation.exportedAt = conversation.exportedAt || new Date().toISOString();
    conversation.meta = conversation.meta || {};
    conversation.meta.warnings = conversation.meta.warnings || [];
    return conversation;
  }

  function validate(conversation) {
    var errors = [];
    if (!conversation) errors.push('conversation is missing');
    else {
      if (conversation.schema && conversation.schema !== SCHEMA_ID) errors.push('unexpected schema id: ' + conversation.schema);
      if (!Array.isArray(conversation.messages)) errors.push('messages must be an array');
      else {
        if (conversation.messages.length !== conversation.messageCount) errors.push('messageCount mismatch');
        conversation.messages.forEach(function (message, index) {
          if (!message.role) errors.push('message ' + index + ' has no role');
          if (typeof message.markdown !== 'string') errors.push('message ' + index + ' markdown must be a string');
        });
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function stats(conversation) {
    var stats = { user: 0, assistant: 0, system: 0, tool: 0, unknown: 0, images: 0, citations: 0, characters: 0 };
    (conversation.messages || []).forEach(function (message) {
      stats[message.role] = (stats[message.role] || 0) + 1;
      stats.images += (message.images || []).length;
      stats.citations += (message.citations || []).length;
      stats.characters += (message.markdown || '').length;
    });
    return stats;
  }

  core.schema = {
    SCHEMA_ID: SCHEMA_ID,
    EXPORTER_NAME: EXPORTER_NAME,
    EXPORTER_VERSION: EXPORTER_VERSION,
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    roleLabel: roleLabel,
    roleEmoji: roleEmoji,
    normalizeRole: normalizeRole,
    normalizeMessage: normalizeMessage,
    createConversation: createConversation,
    finalize: finalize,
    validate: validate,
    stats: stats
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
