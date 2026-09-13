/*
 * AI Chat Exporter — file saving helpers (content-script context).
 * Exposes: globalThis.AIChatExporter.core.download
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  function isAvailable() {
    return !!(global.document && global.URL && typeof global.URL.createObjectURL === 'function');
  }

  function saveBlob(filename, blob) {
    if (!isAvailable()) throw new Error('downloads are not available in this context');
    var url = global.URL.createObjectURL(blob);
    var anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    global.document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function () {
      try {
        anchor.remove();
        global.URL.revokeObjectURL(url);
      } catch (err) { /* ignore */ }
    }, 4000);
    return { filename: filename, url: url, size: blob.size };
  }

  function saveText(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    return saveBlob(filename, blob);
  }

  function saveBinary(filename, bytes, mime) {
    var blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    return saveBlob(filename, blob);
  }

  function copyToClipboard(text, doc) {
    var target = doc || global.document;
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text);
    }
    if (!target) return Promise.reject(new Error('clipboard unavailable'));
    var area = target.createElement('textarea');
    area.value = text;
    area.setAttribute('data-aice-ui', 'clipboard');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    target.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = target.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('clipboard unavailable'));
  }

  core.download = {
    isAvailable: isAvailable,
    saveBlob: saveBlob,
    saveText: saveText,
    saveBinary: saveBinary,
    copyToClipboard: copyToClipboard
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
