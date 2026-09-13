/*
 * AI Chat Exporter — Markdown / JSON / plain-text serialisers.
 * Exposes: globalThis.AIChatExporter.core.serialize
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});
  var schema = core.schema;

  var DEFAULT_FILENAME_TEMPLATE = '{platform}_{title}_{date}';

  var STRINGS = {
    'zh-CN': {
      platform: '平台',
      messages: '消息数',
      exportedAt: '导出时间',
      source: '来源',
      model: '模型',
      toc: '目录',
      reasoning: '思考过程',
      toolCalls: '工具调用',
      citations: '参考链接',
      attachments: '附件',
      images: '图片',
      untitled: '未命名对话'
    },
    en: {
      platform: 'Platform',
      messages: 'Messages',
      exportedAt: 'Exported at',
      source: 'Source',
      model: 'Model',
      toc: 'Table of contents',
      reasoning: 'Reasoning',
      toolCalls: 'Tool calls',
      citations: 'References',
      attachments: 'Attachments',
      images: 'Images',
      untitled: 'Untitled conversation'
    }
  };

  function strings(locale) {
    return STRINGS[locale] || STRINGS['zh-CN'];
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatDateTime(value, locale) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);
    var base = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    return base;
  }

  function dateStamp(value) {
    var date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes());
  }

  /** GitHub-flavoured heading slug (keeps CJK, drops punctuation/emoji). */
  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N} \-_]/gu, '')
      .replace(/ /g, '-');
  }

  function uniqueSlug(base, used) {
    var slug = base || 'section';
    var candidate = slug;
    var counter = 1;
    while (used[slug]) {
      candidate = slug + '-' + counter;
      counter++;
      if (!used[candidate]) break;
    }
    used[candidate] = true;
    return candidate;
  }

  function yamlValue(value) {
    if (value == null) return '""';
    var text = String(value);
    if (/^[A-Za-z0-9_\-.\/ ]+$/.test(text) && !/^\s|\s$/.test(text)) return text;
    return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  function messageHeading(message, ordinal, options) {
    var locale = options.locale || 'zh-CN';
    var label = (options.roleLabels && options.roleLabels[message.role]) || schema.roleLabel(message.role, locale);
    var emoji = schema.roleEmoji(message.role);
    var parts = [String(ordinal) + '.', emoji, label];
    if (options.includeTimestamps && message.createdAt) parts.push('· ' + formatDateTime(message.createdAt));
    return parts.join(' ');
  }

  /** Repoints Markdown image links at packaged files (used by the ZIP export). */
  function rewriteImageLinks(text, imageMap) {
    if (!imageMap) return text;
    var out = String(text == null ? '' : text);
    Object.keys(imageMap).forEach(function (url) {
      var local = imageMap[url];
      if (!url || !local || url === local) return;
      out = out.split('](' + url + ')').join('](' + local + ')');
    });
    return out;
  }

  function renderMessageBody(message, options, stringsTable) {
    var locale = options.locale || 'zh-CN';
    var chunks = [];
    if (options.includeReasoning && message.reasoning) {
      chunks.push('<details>\n<summary>' + stringsTable.reasoning + '</summary>\n\n' + message.reasoning.trim() + '\n\n</details>');
    }
    if (message.markdown && message.markdown.trim()) chunks.push(message.markdown.trim());
    else if (message.text && message.text.trim()) chunks.push(message.text.trim());
    if (options.includeToolCalls && message.toolCalls) {
      chunks.push('**' + stringsTable.toolCalls + '**\n\n' + message.toolCalls.trim());
    }

    var body = rewriteImageLinks(chunks.join('\n\n'), options.imageMap);

    // Only append images the body does not already reference (the Markdown
    // conversion keeps inline images, so avoid emitting them twice).
    var extraImages = (message.images || []).filter(function (image) {
      var mapped = options.imageMap && options.imageMap[image.url];
      if (body.indexOf('](' + image.url + ')') !== -1) return false;
      if (mapped && body.indexOf('](' + mapped + ')') !== -1) return false;
      return true;
    });
    if (extraImages.length) {
      body += (body ? '\n\n' : '') + extraImages.map(function (image) {
        var src = (options.imageMap && options.imageMap[image.url]) || image.url;
        return '![' + (image.alt || '') + '](' + src + ')';
      }).join('\n\n');
    }

    if (options.includeCitations && message.citations && message.citations.length) {
      var lines = message.citations.map(function (citation, index) {
        return (index + 1) + '. [' + (citation.title || citation.url) + '](' + citation.url + ')';
      });
      body += (body ? '\n\n' : '') + '**' + stringsTable.citations + '**\n\n' + lines.join('\n');
    }
    return body;
  }

  /**
   * The UI settings object uses short keys (toc, images, reasoning…), the core
   * API uses include* names. Accept both so either shape works everywhere.
   */
  function normalizeOptions(options) {
    var merged = {};
    Object.keys(options || {}).forEach(function (key) { merged[key] = options[key]; });
    var aliases = {
      toc: 'includeToc',
      frontMatter: 'includeFrontMatter',
      meta: 'includeMeta',
      reasoning: 'includeReasoning',
      toolCalls: 'includeToolCalls',
      citations: 'includeCitations',
      timestamps: 'includeTimestamps',
      images: 'includeImages'
    };
    Object.keys(aliases).forEach(function (short) {
      if (merged[aliases[short]] === undefined && merged[short] !== undefined) merged[aliases[short]] = merged[short];
    });
    return merged;
  }

  function toMarkdown(conversation, rawOptions) {
    var options = normalizeOptions(rawOptions);
    var locale = options.locale || conversation.locale || 'zh-CN';
    var table = strings(locale);
    var title = conversation.title || table.untitled;
    var lines = [];
    var used = {};

    if (options.includeFrontMatter !== false) {
      lines.push('---');
      lines.push('title: ' + yamlValue(title));
      lines.push('platform: ' + yamlValue(conversation.platformLabel || conversation.platform));
      lines.push('platform_id: ' + yamlValue(conversation.platform));
      if (conversation.url) lines.push('url: ' + yamlValue(conversation.url));
      if (conversation.conversationId) lines.push('conversation_id: ' + yamlValue(conversation.conversationId));
      if (conversation.model) lines.push('model: ' + yamlValue(conversation.model));
      if (conversation.createdAt) lines.push('created_at: ' + yamlValue(conversation.createdAt));
      lines.push('exported_at: ' + yamlValue(conversation.exportedAt));
      lines.push('message_count: ' + conversation.messages.length);
      lines.push('exporter: ' + yamlValue(schema.EXPORTER_NAME + ' ' + schema.EXPORTER_VERSION));
      lines.push('schema: ' + yamlValue(schema.SCHEMA_ID));
      lines.push('---');
      lines.push('');
    }

    lines.push('# ' + title);
    lines.push('');

    if (options.includeMeta !== false) {
      var metaParts = [];
      metaParts.push('**' + table.platform + '**: ' + (conversation.platformLabel || conversation.platform));
      metaParts.push('**' + table.messages + '**: ' + conversation.messages.length);
      metaParts.push('**' + table.exportedAt + '**: ' + formatDateTime(conversation.exportedAt, locale));
      if (conversation.model) metaParts.push('**' + table.model + '**: ' + conversation.model);
      lines.push('> ' + metaParts.join(' ｜ '));
      if (conversation.url) lines.push('>');
      if (conversation.url) lines.push('> ' + table.source + ': <' + conversation.url + '>');
      lines.push('');
    }

    var headings = conversation.messages.map(function (message, index) {
      return messageHeading(message, index + 1, options);
    });
    var anchors = headings.map(function (heading) {
      return uniqueSlug(slugify(heading), used);
    });

    if (options.includeToc) {
      lines.push('## ' + table.toc);
      lines.push('');
      conversation.messages.forEach(function (message, index) {
        var label = headings[index].replace(/[#*`]/g, '');
        lines.push('- [' + label + '](#' + anchors[index] + ')');
      });
      lines.push('');
    }

    var headingLevel = options.messageHeadingLevel || '##';
    conversation.messages.forEach(function (message, index) {
      lines.push('---');
      lines.push('');
      lines.push(headingLevel + ' ' + headings[index]);
      lines.push('');
      var body = renderMessageBody(message, options, table);
      if (body) lines.push(body);
      lines.push('');
    });

    var markdown = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\s+$/, '');
    return markdown + '\n';
  }

  function toJSON(conversation, rawOptions) {
    var options = normalizeOptions(rawOptions);
    var clone = JSON.parse(JSON.stringify(conversation));
    if (options.includeImages === false) {
      clone.messages.forEach(function (message) { delete message.images; });
    }
    return JSON.stringify(clone, null, options.pretty === false ? 0 : 2) + '\n';
  }

  function toPlainText(conversation, rawOptions) {
    var options = normalizeOptions(rawOptions);
    var locale = options.locale || conversation.locale || 'zh-CN';
    var title = conversation.title || strings(locale).untitled;
    var out = [title, '='.repeat(Math.max(3, title.length)), ''];
    conversation.messages.forEach(function (message, index) {
      out.push('[' + (index + 1) + '] ' + schema.roleLabel(message.role, locale).toUpperCase());
      out.push(message.text || message.markdown || '');
      out.push('');
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function sanitizeFilename(name, fallback) {
    var value = String(name == null ? '' : name)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .replace(/-+_/g, '_')
      .replace(/_-+/g, '_')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .trim();
    if (value.length > 80) value = value.slice(0, 80).trim();
    return value || (fallback || 'conversation');
  }

  function renderFilename(template, conversation, extension, options) {
    options = options || {};
    var title = conversation.title || strings(conversation.locale || 'zh-CN').untitled;
    var replacements = {
      platform: conversation.platform || 'chat',
      platformLabel: conversation.platformLabel || conversation.platform || 'chat',
      title: title,
      date: dateStamp(options.now || conversation.exportedAt),
      id: conversation.conversationId || 'noid',
      model: conversation.model || 'unknown',
      count: String(conversation.messages.length)
    };
    var out = String(template || DEFAULT_FILENAME_TEMPLATE).replace(/\{(\w+)\}/g, function (match, key) {
      return replacements[key] != null ? String(replacements[key]) : match;
    });
    out = sanitizeFilename(out);
    if (extension && out.toLowerCase().indexOf('.' + extension) === -1) out += '.' + extension;
    return out;
  }

  var FORMATS = {
    md: { extension: 'md', mime: 'text/markdown;charset=utf-8' },
    markdown: { extension: 'md', mime: 'text/markdown;charset=utf-8' },
    json: { extension: 'json', mime: 'application/json;charset=utf-8' },
    txt: { extension: 'txt', mime: 'text/plain;charset=utf-8' },
    html: { extension: 'html', mime: 'text/html;charset=utf-8' }
  };

  function buildExport(conversation, rawOptions) {
    var options = normalizeOptions(rawOptions);
    var format = String(options.format || 'md').toLowerCase();
    var spec = FORMATS[format] || FORMATS.md;
    var text;
    if (spec.extension === 'json') text = toJSON(conversation, options);
    else if (spec.extension === 'txt') text = toPlainText(conversation, options);
    else if (spec.extension === 'html') {
      if (!core.html) throw new Error('html module not loaded');
      text = core.html.buildHtmlDocument(conversation, options);
    } else text = toMarkdown(conversation, options);

    var filename = options.filename || renderFilename(options.filenameTemplate, conversation, spec.extension, options);
    return {
      format: format,
      extension: spec.extension,
      mime: spec.mime,
      filename: filename,
      text: text,
      bytes: text.length
    };
  }

  core.serialize = {
    toMarkdown: toMarkdown,
    toJSON: toJSON,
    toPlainText: toPlainText,
    buildExport: buildExport,
    renderFilename: renderFilename,
    sanitizeFilename: sanitizeFilename,
    slugify: slugify,
    rewriteImageLinks: rewriteImageLinks,
    normalizeOptions: normalizeOptions,
    formatDateTime: formatDateTime,
    dateStamp: dateStamp,
    DEFAULT_FILENAME_TEMPLATE: DEFAULT_FILENAME_TEMPLATE,
    STRINGS: STRINGS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
