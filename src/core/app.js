/*
 * AI Chat Exporter — application layer: DOM → conversation → export payload.
 * Contains no chrome.* usage so it can run inside jsdom in the test-suite.
 * Exposes: globalThis.AIChatExporter.core.app
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var DEFAULTS = {
    format: 'md',
    toc: true,
    frontMatter: true,
    meta: true,
    images: false,
    reasoning: false,
    toolCalls: false,
    citations: false,
    timestamps: false,
    filenameTemplate: core.serialize ? core.serialize.DEFAULT_FILENAME_TEMPLATE : '{platform}_{title}_{date}',
    scope: { mode: 'full' },
    locale: null
  };

  function mergeSettings(settings) {
    var merged = {};
    var key;
    for (key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) merged[key] = DEFAULTS[key];
    }
    settings = settings || {};
    for (key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) merged[key] = settings[key];
    }
    if (settings.text) {
      merged.filenameTemplate = settings.text;
    }
    return merged;
  }

  function titleFromMessages(messages) {
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === 'user') {
        var line = String(messages[i].text || messages[i].markdown || '').replace(/\s+/g, ' ').trim();
        if (line) return line.length > 60 ? line.slice(0, 60) + '…' : line;
      }
    }
    for (var j = 0; j < messages.length; j++) {
      var fallback = String(messages[j].text || messages[j].markdown || '').replace(/\s+/g, ' ').trim();
      if (fallback) return fallback.length > 60 ? fallback.slice(0, 60) + '…' : fallback;
    }
    return '';
  }

  /** Extracts the current page into a normalised conversation object. */
  function extract(doc, options) {
    options = options || {};
    var location = options.location || doc.location || global.location || {};
    var platform = options.platform || (NS.platforms ? NS.platforms.detect(location) : null);
    if (!platform) throw new Error('no platform adapter available');

    var locale = options.locale || (core.i18n ? core.i18n.locale() : 'zh-CN');
    var result = core.engine.extractConversation(doc, platform, {
      captureHtml: !!options.captureHtml,
      captureReasoning: !!options.reasoning,
      captureToolCalls: !!options.toolCalls,
      baseUrl: location.href || '',
      customRules: options.customRules || null,
      platform: platform
    });

    var meta = {};
    if (typeof platform.getMeta === 'function') {
      try {
        meta = platform.getMeta(doc, location) || {};
      } catch (err) {
        meta = {};
      }
    }

    var conversation = core.schema.createConversation({
      platform: platform.id,
      platformLabel: platform.label,
      title: meta.title || titleFromMessages(result.messages),
      url: location.href || '',
      conversationId: meta.conversationId || null,
      model: meta.model || null,
      locale: locale,
      extraction: {
        strategy: result.strategy,
        hints: platform.id,
        rows: result.debug ? result.debug.rows : result.messages.length,
        calibrated: !!(options.customRules)
      },
      warnings: result.warnings || []
    });
    conversation.messages = result.messages;
    core.schema.finalize(conversation);

    if (options.scope && options.scope.mode === 'range') {
      conversation.messages = core.range.slice(conversation.messages, options.scope);
      conversation.messages.forEach(function (message, index) { message.index = index; });
      conversation.messageCount = conversation.messages.length;
      conversation.meta.scope = { mode: 'range', from: options.scope.from, to: options.scope.to };
    } else {
      conversation.meta.scope = { mode: 'full' };
    }

    return {
      conversation: conversation,
      warnings: conversation.meta.warnings,
      strategy: result.strategy,
      debug: result.debug,
      stats: core.schema.stats(conversation)
    };
  }

  function serializeOptions(conversation, settings) {
    var merged = mergeSettings(settings);
    return {
      locale: merged.locale || conversation.locale || 'zh-CN',
      includeToc: !!merged.toc,
      includeFrontMatter: merged.frontMatter !== false,
      includeMeta: merged.meta !== false,
      includeReasoning: !!merged.reasoning,
      includeToolCalls: !!merged.toolCalls,
      includeCitations: !!merged.citations,
      includeTimestamps: !!merged.timestamps,
      filenameTemplate: merged.filenameTemplate,
      imageMap: merged.imageMap || null
    };
  }

  /**
   * Returns { kind: 'text' | 'print', filename, mime, text|html }
   */
  function exportConversation(conversation, settings) {
    var merged = mergeSettings(settings);
    var options = serializeOptions(conversation, merged);
    var format = String(merged.format || 'md').toLowerCase();

    if (format === 'pdf') {
      var printHtml = core.pdf.buildPrintDocument(conversation, options);
      return {
        kind: 'print',
        format: 'pdf',
        filename: core.serialize.renderFilename(merged.filenameTemplate, conversation, 'pdf', options),
        mime: 'application/pdf',
        html: printHtml,
        text: printHtml
      };
    }

    var built = core.serialize.buildExport(conversation, Object.assign({}, options, { format: format }));
    built.kind = 'text';
    return built;
  }

  /**
   * Downloads all images, rewrites Markdown links to the packaged relative
   * paths and returns a ZIP payload (document + images/…).
   */
  function exportPackage(conversation, settings) {
    var merged = mergeSettings(settings);
    var options = serializeOptions(conversation, merged);
    return core.images.packageImages(conversation, {
      fetchImpl: merged.fetchImpl,
      timeout: merged.imageTimeout || 20000,
      limit: merged.imageLimit,
      onProgress: merged.onProgress
    }).then(function (packaged) {
      var optionsWithImages = Object.assign({}, options, { imageMap: packaged.map });
      var format = String(merged.format || 'md').toLowerCase();
      var documentEntry;
      if (format === 'pdf') {
        var html = core.pdf.buildPrintDocument(conversation, Object.assign({}, optionsWithImages, { autoPrint: false }));
        documentEntry = {
          name: core.serialize.renderFilename(merged.filenameTemplate, conversation, 'html', options),
          data: html
        };
      } else if (format === 'html') {
        documentEntry = {
          name: core.serialize.renderFilename(merged.filenameTemplate, conversation, 'html', options),
          data: core.html.buildHtmlDocument(conversation, optionsWithImages)
        };
      } else {
        var built = core.serialize.buildExport(conversation, Object.assign({}, optionsWithImages, { format: format }));
        documentEntry = { name: built.filename, data: built.text };
      }
      var entries = [documentEntry].concat(packaged.entries);
      var bytes = core.zip.zipSync(entries, { date: conversation.exportedAt });
      return {
        kind: 'zip',
        format: format,
        filename: core.serialize.renderFilename(merged.filenameTemplate, conversation, 'zip', options),
        mime: 'application/zip',
        bytes: bytes,
        entries: entries,
        images: packaged
      };
    });
  }

  core.app = {
    DEFAULTS: DEFAULTS,
    mergeSettings: mergeSettings,
    extract: extract,
    exportConversation: exportConversation,
    exportPackage: exportPackage,
    serializeOptions: serializeOptions,
    titleFromMessages: titleFromMessages
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
