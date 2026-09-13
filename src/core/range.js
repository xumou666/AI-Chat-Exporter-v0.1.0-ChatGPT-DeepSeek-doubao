/*
 * AI Chat Exporter — message range selection (full export / partial export).
 * Exposes: globalThis.AIChatExporter.core.range
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});
  var schema = core.schema;

  function preview(message, length) {
    var text = String(message.text || message.markdown || '').replace(/\s+/g, ' ').trim();
    var limit = length || 80;
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }

  /** Options for the UI: one entry per message, 1-based ordinals. */
  function listOptions(messages, locale, previewLength) {
    return (messages || []).map(function (message, index) {
      return {
        index: index,
        ordinal: index + 1,
        role: message.role,
        label: (index + 1) + '. ' + schema.roleLabel(message.role, locale || 'zh-CN'),
        preview: preview(message, previewLength)
      };
    });
  }

  /**
   * spec: { from, to } 1-based inclusive ordinals, or { fromId, toId }.
   * `mode`: 'full' (default) or 'range'.
   */
  function slice(messages, spec) {
    var list = messages || [];
    spec = spec || {};
    if (spec.mode === 'full') return list.slice();
    var from = typeof spec.from === 'number' ? spec.from : 1;
    var to = typeof spec.to === 'number' ? spec.to : list.length;
    if (spec.fromId) {
      var fromIndex = indexOfId(list, spec.fromId);
      if (fromIndex !== -1) from = fromIndex + 1;
    }
    if (spec.toId) {
      var toIndex = indexOfId(list, spec.toId);
      if (toIndex !== -1) to = toIndex + 1;
    }
    from = Math.max(1, Math.min(from, list.length || 1));
    to = Math.max(from, Math.min(to, list.length));
    return list.slice(from - 1, to);
  }

  function indexOfId(messages, id) {
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].id && messages[i].id === id) return i;
    }
    return -1;
  }

  /** Parses "3-7", "3:", ":7", "5", "full". */
  function parse(spec, total) {
    var value = String(spec == null ? '' : spec).trim().toLowerCase();
    if (!value || value === 'full' || value === 'all' || value === '*') return { mode: 'full' };
    var match = value.match(/^(\d+)?\s*(?:-|~|:|：|\.\.|至|到)\s*(\d+)?$/);
    if (!match) {
      var single = value.match(/^(\d+)$/);
      if (single) return { mode: 'range', from: Number(single[1]), to: Number(single[1]) };
      return { mode: 'full' };
    }
    var from = match[1] ? Number(match[1]) : 1;
    var to = match[2] ? Number(match[2]) : (total || Infinity);
    if (to < from) { var swap = from; from = to; to = swap; }
    return { mode: 'range', from: from, to: to };
  }

  core.range = {
    listOptions: listOptions,
    slice: slice,
    parse: parse,
    preview: preview
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
