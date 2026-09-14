/*
 * AI Chat Exporter — content script bootstrap.
 * Wires the platform adapter, the extraction engine and the on-page panel
 * together and performs the actual downloads.
 */
(function (global) {
  'use strict';

  var NS = global.AIChatExporter;
  if (!NS || !NS.core) return;
  if (global.__AICE_BOOTED__) return;
  global.__AICE_BOOTED__ = true;

  var core = NS.core;
  var t = function (key, vars) { return core.i18n.t(key, vars); };

  var SETTINGS_KEY = 'aice:settings';
  var LOCALE_KEY = 'aice:locale';
  var RULES_PREFIX = 'aice:rules:';
  var platform = NS.platforms.detect(global.location);
  var rules = null;
  var panel = null;
  var calibrating = null;
  var picking = null;
  var overlay = null;

  // — storage (chrome.storage.local with a localStorage fallback) —
  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        if (global.chrome && global.chrome.storage && global.chrome.storage.local) {
          global.chrome.storage.local.get(keys, function (items) { resolve(items || {}); });
          return;
        }
      } catch (err) { /* fall through */ }
      var out = {};
      keys.forEach(function (key) {
        try {
          var raw = global.localStorage.getItem(key);
          if (raw) out[key] = JSON.parse(raw);
        } catch (err) { /* ignore */ }
      });
      resolve(out);
    });
  }

  function storageSet(values) {
    return new Promise(function (resolve) {
      try {
        if (global.chrome && global.chrome.storage && global.chrome.storage.local) {
          global.chrome.storage.local.set(values, function () { resolve(true); });
          return;
        }
      } catch (err) { /* fall through */ }
      Object.keys(values).forEach(function (key) {
        try { global.localStorage.setItem(key, JSON.stringify(values[key])); } catch (err) { /* ignore */ }
      });
      resolve(true);
    });
  }

  // — extraction / export —
  function extract(settings) {
    return core.app.extract(global.document, {
      platform: platform,
      locale: settings.locale,
      reasoning: !!settings.reasoning,
      toolCalls: !!settings.toolCalls,
      scope: settings.scope,
      customRules: rules
    });
  }

  /**
   * The range picker must always describe the *full* conversation, never the
   * already-sliced subset, otherwise the ordinals would drift after an export.
   */
  function updatePicker(extraction) {
    if (!panel || !extraction) return;
    var settings = panel.getSettings();
    panel.setMessageCount({
      count: extraction.conversation.messageCount,
      options: core.range.listOptions(extraction.conversation.messages, settings.locale, 32)
    });
  }

  function refreshDiagnostics() {
    if (!panel) return null;
    var info = core.engine.debugCandidates(global.document, platform);
    var extraction = core.app.extract(global.document, { platform: platform, customRules: rules, scope: { mode: 'full' } });
    info.warnings = extraction.warnings;
    info.rowCount = extraction.debug ? extraction.debug.rows : info.rowCount;
    panel.setDiagnostics(info);
    updatePicker(extraction);
    return extraction;
  }

  /** Role evidence was inferred rather than read from the page. */
  function rolesUncertain(warnings) {
    return (warnings || []).some(function (code) {
      return /^roles-|^some-roles-inferred$|^low-confidence-rows:/.test(String(code));
    });
  }

  function statusFor(extraction) {
    var count = extraction.conversation.messageCount;
    var text = t('found', { count: count, platform: platform.label || platform.id });
    if (rolesUncertain(extraction.warnings)) text += ' · ⚠ ' + t('rolesMayBeWrong');
    return text;
  }

  function reportExtraction(extraction) {
    var count = extraction.conversation.messageCount;
    if (!count) {
      panel.setStatus(t('notFound'), 'error');
      return false;
    }
    panel.setStatus(statusFor(extraction), rolesUncertain(extraction.warnings) ? 'error' : 'ok');
    return true;
  }

  function doExport(settings) {
    panel.setStatus(t('exporting'));
    var extraction = extract(settings);
    refreshDiagnostics();
    if (!reportExtraction(extraction)) return Promise.resolve({ exported: false });

    var conversation = extraction.conversation;
    if (settings.images) {
      return core.app.exportPackage(conversation, settings).then(function (packaged) {
        core.download.saveBinary(packaged.filename, packaged.bytes, packaged.mime);
        var failed = packaged.images.failures.length;
        var message = t('packaged', { count: packaged.images.entries.length });
        if (failed) message += ' · ' + t('imagesFailed', { count: failed });
        panel.setStatus(message, failed ? 'error' : 'ok');
        return { exported: true, filename: packaged.filename };
      });
    }

    var payload = core.app.exportConversation(conversation, settings);
    if (payload.kind === 'print') {
      core.pdf.openPrintWindow(payload.html, { title: payload.filename });
      panel.setStatus(t('downloadStarted', { filename: payload.filename }), 'ok');
      return Promise.resolve({ exported: true, filename: payload.filename, print: true });
    }
    core.download.saveText(payload.filename, payload.text, payload.mime);
    panel.setStatus(t('downloadStarted', { filename: payload.filename }), 'ok');
    return Promise.resolve({ exported: true, filename: payload.filename });
  }

  function doCopy(settings) {
    var extraction = extract(settings);
    refreshDiagnostics();
    if (!reportExtraction(extraction)) return Promise.resolve({ copied: false });
    var markdown = core.serialize.toMarkdown(extraction.conversation, core.app.serializeOptions(extraction.conversation, settings));
    return core.download.copyToClipboard(markdown, global.document).then(function () {
      panel.setStatus(t('copied'), 'ok');
      return { copied: true };
    });
  }

  // — diagnostics report (one click, for pasting into an issue) —
  function extensionVersion() {
    try {
      if (global.chrome && global.chrome.runtime && global.chrome.runtime.getManifest) {
        return global.chrome.runtime.getManifest().version;
      }
    } catch (err) { /* fall through */ }
    return core.schema.EXPORTER_VERSION;
  }

  function diagnosticsReport() {
    var info = core.engine.debugCandidates(global.document, platform);
    var extraction = core.app.extract(global.document, { platform: platform, customRules: rules, scope: { mode: 'full' } });
    var lines = [];
    lines.push(core.schema.EXPORTER_NAME + ' v' + extensionVersion() + '  (engine ' + core.engine.version + ')');
    lines.push('page: ' + (global.location.href || ''));
    lines.push('platform: ' + platform.id + '  rules: ' + (rules ? 'calibrated' : 'none'));
    lines.push('strategy: ' + info.strategy + '  scopedBy: ' + (info.scopedBy || 'none')
      + '  rows: ' + info.rowCount + '  candidates: ' + info.totalCandidates
      + '  clusters: ' + (info.clusters || 1) + '  dropped: ' + (info.droppedRows || 0));
    if (extraction.warnings && extraction.warnings.length) {
      lines.push('warnings:');
      Array.prototype.forEach.call(extraction.warnings, function (warning) { lines.push('  - ' + warning); });
    }
    lines.push('rows:');
    (info.rows || []).forEach(function (row) {
      lines.push('  ' + (row.kept === false ? '[dropped]' : '[kept]   ')
        + ' key=' + (row.key == null ? '-' : row.key)
        + ' ' + (row.role || '?') + '/' + (row.confidence || '?')
        + ' ' + (row.signature || '')
        + ' :: ' + String(row.text || '').replace(/\s+/g, ' ').slice(0, 70));
    });
    return lines.join('\n');
  }

  function copyDiagnostics() {
    var report = diagnosticsReport();
    return core.download.copyToClipboard(report, global.document).then(function () {
      panel.setStatus(t('diagnosticsCopied'), 'ok');
      return { copied: true };
    }, function (error) {
      panel.setStatus(t('failed', { error: error && error.message ? error.message : String(error) }), 'error');
      return { copied: false };
    });
  }

  // — pick the current conversation's range by clicking its first/last message —
  function onPickRangeClick(event) {
    if (!picking) return;
    var target = event.target;
    if (target && target.closest && target.closest('#aice-root')) return;
    event.preventDefault();
    event.stopPropagation();
    var found = core.engine.rowOrdinalForElement(global.document, platform, target);
    if (!found) {
      if (overlay) overlay.textContent = picking.first ? t('pickRangeEnd') : t('pickRangeStart');
      return;
    }
    if (!picking.first) {
      picking.first = found;
      if (overlay) overlay.textContent = t('pickRangeEnd');
      return;
    }
    var from = Math.min(picking.first.ordinal, found.ordinal);
    var to = Math.max(picking.first.ordinal, found.ordinal);
    stopPicking();
    var current = panel.getSettings();
    current.scope = { mode: 'range', from: from, to: to };
    panel.applySettings(current);
    panel.toggle(true);
    panel.setStatus(t('pickRangeDone', { from: from, to: to }), 'ok');
  }

  function stopPicking() {
    if (!picking) return;
    global.document.removeEventListener('click', onPickRangeClick, true);
    global.document.removeEventListener('keydown', onCalibrateKey, true);
    picking = null;
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
  }

  function startPickRange() {
    stopCalibration();
    stopPicking();
    picking = { first: null };
    panel.toggle(false);
    ensureOverlay().textContent = t('pickRangeStart');
    global.document.addEventListener('click', onPickRangeClick, true);
    global.document.addEventListener('keydown', onCalibrateKey, true);
  }

  // — calibration: user clicks one user + one assistant message —
  function ensureOverlay() {
    if (overlay && overlay.parentNode) return overlay;
    overlay = global.document.createElement('div');
    overlay.id = 'aice-calibrate-overlay';
    overlay.setAttribute('data-aice-ui', 'calibrate');
    overlay.textContent = t('calibrateStep1');
    global.document.body.appendChild(overlay);
    return overlay;
  }

  function stopCalibration() {
    if (!calibrating) return;
    global.document.removeEventListener('click', onCalibrateClick, true);
    global.document.removeEventListener('keydown', onCalibrateKey, true);
    calibrating = null;
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
  }

  function onCalibrateKey(event) {
    if (event.key === 'Escape') {
      stopCalibration();
      stopPicking();
      panel.setStatus(t('ready'));
    }
  }

  function onCalibrateClick(event) {
    if (!calibrating) return;
    var target = event.target;
    if (target && target.closest && target.closest('#aice-root')) return;
    event.preventDefault();
    event.stopPropagation();
    if (!calibrating.user) {
      calibrating.user = target;
      ensureOverlay().textContent = t('calibrateStep2');
      return;
    }
    calibrating.assistant = target;
    try {
      rules = core.engine.deriveRules(calibrating.user, calibrating.assistant, global.document);
      var key = RULES_PREFIX + global.location.host;
      storageSet((function () { var value = {}; value[key] = rules; return value; })());
      panel.setStatus(t('calibrateSaved'), 'ok');
      refreshDiagnostics();
      panel.toggle(true);
    } catch (error) {
      panel.setStatus(t('failed', { error: error && error.message ? error.message : String(error) }), 'error');
    }
    stopCalibration();
  }

  function startCalibration() {
    stopCalibration();
    calibrating = { user: null, assistant: null };
    panel.toggle(false);
    ensureOverlay();
    global.document.addEventListener('click', onCalibrateClick, true);
    global.document.addEventListener('keydown', onCalibrateKey, true);
  }

  function resetRules() {
    rules = null;
    var key = RULES_PREFIX + global.location.host;
    return storageSet((function () { var value = {}; value[key] = null; return value; })()).then(function () {
      panel.setStatus(t('ready'));
      refreshDiagnostics();
    });
  }

  // — boot —
  function boot() {
    var keys = [SETTINGS_KEY, LOCALE_KEY, RULES_PREFIX + global.location.host];
    storageGet(keys).then(function (items) {
      var settings = core.app.mergeSettings(items[SETTINGS_KEY] || {});
      settings.locale = items[LOCALE_KEY] || settings.locale || core.i18n.locale();
      core.i18n.setLocale(settings.locale);
      if (items[RULES_PREFIX + global.location.host]) rules = items[RULES_PREFIX + global.location.host];

      panel = NS.ui.createPanel({
        document: global.document,
        platform: platform,
        settings: settings,
        version: extensionVersion(),
        onExport: doExport,
        onCopy: doCopy,
        onCalibrate: startCalibration,
        onPickRange: startPickRange,
        onCopyDiagnostics: copyDiagnostics,
        onResetRules: resetRules,
        onSettingsChange: function (next) {
          var value = {};
          value[SETTINGS_KEY] = next;
          storageSet(value);
        }
      });
      panel.mount(global.document.body);

      var extraction = refreshDiagnostics();
      if (extraction && extraction.conversation.messageCount) {
        panel.setStatus(t('ready') + ' · ' + statusFor(extraction), rolesUncertain(extraction.warnings) ? 'error' : 'ok');
      } else {
        panel.setStatus(t('notFound'));
      }

      if (global.chrome && global.chrome.runtime && global.chrome.runtime.onMessage) {
        global.chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
          if (!message || !message.type) return undefined;
          if (message.type === 'AICE_TOGGLE') {
            panel.toggle();
            var extraction = refreshDiagnostics();
            sendResponse({
              ok: true,
              platform: platform.id,
              messages: extraction ? extraction.conversation.messageCount : 0
            });
            return true;
          }
          if (message.type === 'AICE_EXPORT') {
            panel.applySettings(core.app.mergeSettings(message.settings || {}));
            doExport(panel.getSettings()).then(function (result) { sendResponse(result); }, function (error) {
              sendResponse({ error: error && error.message ? error.message : String(error) });
            });
            return true;
          }
          if (message.type === 'AICE_STATUS') {
            sendResponse({ ok: true, platform: platform.id, booted: true });
            return true;
          }
          return undefined;
        });
      }
    });
  }

  global.__AICE__ = {
    platform: platform.id,
    extract: extract,
    exportConversation: doExport,
    copy: doCopy,
    calibrate: startCalibration,
    resetRules: resetRules,
    getRules: function () { return rules; },
    getPanel: function () { return panel; }
  };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
