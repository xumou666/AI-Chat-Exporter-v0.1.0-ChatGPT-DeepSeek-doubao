/*
 * AI Chat Exporter — PDF export via a self-contained print document.
 *
 * Chrome/Edge cannot generate PDFs straight from a content script without the
 * (ChromeOS-only) chrome.printing API, so — like the reference exporter — we
 * build a print-optimised HTML document, open it and trigger window.print(),
 * where the user picks "另存为 PDF / Save as PDF".
 *
 * Exposes: globalThis.AIChatExporter.core.pdf
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  function buildPrintDocument(conversation, rawOptions) {
    var normalize = core.serialize && core.serialize.normalizeOptions;
    var options = normalize ? normalize(rawOptions || {}) : (rawOptions || {});
    if (!core.html) throw new Error('html module must be loaded before pdf');
    return core.html.buildHtmlDocument(conversation, {
      locale: options.locale || conversation.locale,
      includeToc: options.includeToc !== false,
      includeReasoning: !!options.includeReasoning,
      includeToolCalls: !!options.includeToolCalls,
      includeCitations: !!options.includeCitations,
      includeTimestamps: !!options.includeTimestamps,
      imageMap: options.imageMap || null,
      print: true,
      autoPrint: options.autoPrint !== false
    });
  }

  function openHtmlDocument(html, deps) {
    deps = deps || {};
    var open = deps.open || global.open;
    if (typeof open !== 'function') throw new Error('window.open is not available in this context');
    var target = deps.title || 'AI Chat Exporter';
    var win = open.call(global, '', '_blank');
    if (!win) throw new Error('popup-blocked');
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      throw new Error('cannot-write-print-document: ' + err.message);
    }
    if (target && win.document) {
      try { win.document.title = target; } catch (err) { /* ignore */ }
    }
    return win;
  }

  function openPrintWindow(html, deps) {
    var win = openHtmlDocument(html, deps);
    if (deps && deps.immediatePrint === false) return win;
    var trigger = function () {
      try {
        win.focus();
        win.print();
      } catch (err) { /* user may have closed the window */ }
    };
    var timer = (deps && deps.setTimeout) || global.setTimeout;
    if (typeof timer === 'function') timer(trigger, (deps && deps.delay) || 400);
    else trigger();
    return win;
  }

  core.pdf = {
    buildPrintDocument: buildPrintDocument,
    openHtmlDocument: openHtmlDocument,
    openPrintWindow: openPrintWindow
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
