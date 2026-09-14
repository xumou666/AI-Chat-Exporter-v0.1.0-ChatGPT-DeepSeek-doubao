/*
 * AI Chat Exporter — on-page panel (floating button + export form).
 * Exposes: globalThis.AIChatExporter.ui.createPanel
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = NS.core;
  var ui = (NS.ui = NS.ui || {});

  var FORMATS = [
    { id: 'md', labelKey: 'exportMd', short: 'Markdown' },
    { id: 'json', labelKey: 'exportJson', short: 'JSON' },
    { id: 'pdf', labelKey: 'exportPdf', short: 'PDF' },
    { id: 'txt', labelKey: 'exportTxt', short: 'TXT' },
    { id: 'html', labelKey: 'exportHtml', short: 'HTML' }
  ];

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(doc, className, text) {
    var node = el(doc, 'button', className, text);
    node.type = 'button';
    return node;
  }

  function checkbox(doc, id, labelText, checked) {
    var wrap = el(doc, 'label');
    var input = el(doc, 'input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!checked;
    wrap.appendChild(input);
    wrap.appendChild(el(doc, 'span', null, labelText));
    return { wrap: wrap, input: input };
  }

  function createPanel(options) {
    options = options || {};
    var doc = options.document || global.document;
    var i18n = core.i18n;
    var t = function (key, vars) { return i18n.t(key, vars); };
    var settings = core.app.mergeSettings(options.settings || {});
    var platform = options.platform || { id: 'generic', label: 'Web' };
    var onExport = options.onExport || function () {};
    var onCopy = options.onCopy || function () {};
    var onCalibrate = options.onCalibrate || function () {};
    var onResetRules = options.onResetRules || function () {};
    var onSettingsChange = options.onSettingsChange || function () {};
    var messagesIndex = [];
    var messageTotal = 0;

    var root = el(doc, 'div');
    root.id = 'aice-root';
    root.setAttribute('data-aice-ui', 'root');

    var fab = button(doc, 'aice-fab', '⇩ ' + t('buttonTitle'));
    fab.title = t('appName') + ' · ' + (platform.label || platform.id);

    var panel = el(doc, 'div', 'aice-panel');
    panel.hidden = true;

    var head = el(doc, 'div', 'aice-head');
    var title = el(doc, 'div', 'aice-title', t('panelTitle') + ' · ' + (platform.label || platform.id));
    var close = button(doc, 'aice-close', '×');
    close.title = t('close');
    head.appendChild(title);
    head.appendChild(close);

    var status = el(doc, 'div', 'aice-status', t('ready'));

    // — format picker —
    var formatSection = el(doc, 'div', 'aice-section');
    formatSection.appendChild(el(doc, 'span', 'aice-label', t('format')));
    var formatGrid = el(doc, 'div', 'aice-formats');
    var formatButtons = {};
    FORMATS.forEach(function (format) {
      var btn = button(doc, null, format.short);
      formatButtons[format.id] = btn;
      btn.addEventListener('click', function () {
        settings.format = format.id;
        syncFormat();
        persist();
      });
      formatGrid.appendChild(btn);
    });
    formatSection.appendChild(formatGrid);

    // — scope —
    var scopeSection = el(doc, 'div', 'aice-section');
    scopeSection.appendChild(el(doc, 'span', 'aice-label', t('scope')));
    var scopeRow = el(doc, 'div', 'aice-row');
    var scopeSelect = el(doc, 'select');
    var optionFull = el(doc, 'option', null, t('scopeFull'));
    optionFull.value = 'full';
    var optionRange = el(doc, 'option', null, t('scopeRange'));
    optionRange.value = 'range';
    scopeSelect.appendChild(optionFull);
    scopeSelect.appendChild(optionRange);
    scopeRow.appendChild(scopeSelect);
    scopeSection.appendChild(scopeRow);
    var rangeRow = el(doc, 'div', 'aice-row');
    rangeRow.style.marginTop = '6px';
    var fromInput = el(doc, 'input');
    fromInput.type = 'number';
    fromInput.min = '1';
    fromInput.placeholder = t('from');
    fromInput.title = t('from');
    var toInput = el(doc, 'input');
    toInput.type = 'number';
    toInput.min = '1';
    toInput.placeholder = t('to');
    toInput.title = t('to');
    rangeRow.appendChild(fromInput);
    rangeRow.appendChild(toInput);
    rangeRow.hidden = true;
    scopeSection.appendChild(rangeRow);

    // — live preview of what the entered ordinals point at —
    // 「起始 #3 👤 用户 · 如果元素是字典呢？」 so the range is picked by content,
    // not by guessing what message number 3 is.
    var rangePreview = el(doc, 'div', 'aice-range-preview');
    var fromLine = el(doc, 'div', 'aice-range-line');
    var fromTag = el(doc, 'span', 'aice-range-tag');
    var fromText = el(doc, 'span', 'aice-range-text');
    fromLine.appendChild(fromTag);
    fromLine.appendChild(fromText);
    var toLine = el(doc, 'div', 'aice-range-line');
    var toTag = el(doc, 'span', 'aice-range-tag');
    var toText = el(doc, 'span', 'aice-range-text');
    toLine.appendChild(toTag);
    toLine.appendChild(toText);
    var rangeSummaryEl = el(doc, 'div', 'aice-range-summary');
    rangePreview.appendChild(fromLine);
    rangePreview.appendChild(toLine);
    rangePreview.appendChild(rangeSummaryEl);
    scopeSection.appendChild(rangePreview);

    // — options —
    var optionsSection = el(doc, 'div', 'aice-section');
    optionsSection.appendChild(el(doc, 'span', 'aice-label', t('options')));
    var checks = el(doc, 'div', 'aice-checks');
    var tocCheck = checkbox(doc, 'aice-opt-toc', t('optToc'), settings.toc);
    var frontMatterCheck = checkbox(doc, 'aice-opt-front', t('optFrontMatter'), settings.frontMatter);
    var imagesCheck = checkbox(doc, 'aice-opt-images', t('optImages'), settings.images);
    var reasoningCheck = checkbox(doc, 'aice-opt-reasoning', t('optReasoning'), settings.reasoning);
    var toolCheck = checkbox(doc, 'aice-opt-tools', t('optToolCalls'), settings.toolCalls);
    var citationsCheck = checkbox(doc, 'aice-opt-citations', t('optCitations'), settings.citations);
    var timestampsCheck = checkbox(doc, 'aice-opt-times', t('optTimestamps'), settings.timestamps);
    [tocCheck, frontMatterCheck, imagesCheck, reasoningCheck, toolCheck, citationsCheck, timestampsCheck].forEach(function (entry) {
      entry.input.addEventListener('change', function () {
        settings.toc = tocCheck.input.checked;
        settings.frontMatter = frontMatterCheck.input.checked;
        settings.images = imagesCheck.input.checked;
        settings.reasoning = reasoningCheck.input.checked;
        settings.toolCalls = toolCheck.input.checked;
        settings.citations = citationsCheck.input.checked;
        settings.timestamps = timestampsCheck.input.checked;
        persist();
      });
      checks.appendChild(entry.wrap);
    });
    optionsSection.appendChild(checks);
    optionsSection.appendChild(el(doc, 'div', 'aice-hint', t('optImagesHint')));

    // — filename —
    var nameSection = el(doc, 'div', 'aice-section');
    nameSection.appendChild(el(doc, 'span', 'aice-label', t('filenameTemplate')));
    var nameInput = el(doc, 'input');
    nameInput.type = 'text';
    nameInput.value = settings.filenameTemplate || core.serialize.DEFAULT_FILENAME_TEMPLATE;
    nameInput.addEventListener('change', function () {
      settings.filenameTemplate = nameInput.value.trim() || core.serialize.DEFAULT_FILENAME_TEMPLATE;
      persist();
    });
    nameSection.appendChild(nameInput);
    nameSection.appendChild(el(doc, 'div', 'aice-hint', '{platform} {title} {date} {id} {model} {count}'));

    // — actions —
    var actions = el(doc, 'div', 'aice-actions');
    var exportBtn = button(doc, 'aice-primary', t('exportMd'));
    var copyBtn = button(doc, null, t('copyMd'));
    var calibrateBtn = button(doc, null, t('calibrate'));
    actions.appendChild(exportBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(calibrateBtn);

    // — diagnostics —
    var diag = el(doc, 'details', 'aice-diag');
    diag.appendChild(el(doc, 'summary', null, t('diagnostics')));
    var diagPre = el(doc, 'pre', null, '…');
    diag.appendChild(diagPre);
    var resetBtn = button(doc, null, t('calibrateReset'));
    resetBtn.style.marginTop = '6px';
    resetBtn.addEventListener('click', function () { onResetRules(); });
    diag.appendChild(resetBtn);

    panel.appendChild(head);
    panel.appendChild(status);
    panel.appendChild(formatSection);
    panel.appendChild(scopeSection);
    panel.appendChild(optionsSection);
    panel.appendChild(nameSection);
    panel.appendChild(actions);
    panel.appendChild(diag);
    root.appendChild(fab);
    root.appendChild(panel);

    // — behaviour —
    function syncFormat() {
      FORMATS.forEach(function (format) {
        formatButtons[format.id].className = settings.format === format.id ? 'is-active' : '';
      });
      var current = FORMATS.filter(function (format) { return format.id === settings.format; })[0] || FORMATS[0];
      exportBtn.textContent = t(current.labelKey);
      copyBtn.disabled = settings.format === 'pdf';
    }

    function persist() {
      onSettingsChange(settings);
    }

    // — range preview helpers —
    function optionAt(ordinal) {
      for (var i = 0; i < messagesIndex.length; i++) {
        if (messagesIndex[i].ordinal === ordinal) return messagesIndex[i];
      }
      return null;
    }

    function describeOption(entry) {
      var locale = settings.locale || core.i18n.locale();
      var role = core.schema.roleEmoji(entry.role) + ' ' + core.schema.roleLabel(entry.role, locale);
      // Show when the role was inferred rather than read from the page, so a
      // wrong user/assistant split is visible before exporting.
      if (entry.confidence === 'low' || entry.confidence === 'none') {
        role += '（' + t('roleInferred') + '）';
      }
      return role + ' · ' + (entry.preview || t('rangeNoPreview'));
    }

    function renderPreviewLine(line, tag, text, ordinal, kind) {
      tag.textContent = t(kind === 'from' ? 'rangePickFrom' : 'rangePickTo', { n: ordinal });
      var entry = optionAt(ordinal);
      if (!entry) {
        line.className = 'aice-range-line is-invalid';
        text.textContent = t('rangeOutOfRange');
        text.removeAttribute('title');
        return;
      }
      line.className = 'aice-range-line';
      text.textContent = describeOption(entry);
      text.title = entry.preview || '';
    }

    function updateRangePreview() {
      var isRange = scopeSelect.value === 'range';
      rangePreview.className = 'aice-range-preview' + (isRange ? ' is-active' : '');
      if (!messageTotal) {
        fromTag.textContent = '';
        fromText.textContent = '';
        toTag.textContent = '';
        toText.textContent = '';
        fromLine.className = 'aice-range-line';
        toLine.className = 'aice-range-line';
        rangeSummaryEl.textContent = t('rangeSummaryEmpty');
        return;
      }
      var rawFrom = Number(fromInput.value) || 1;
      var rawTo = Number(toInput.value) || messageTotal;
      renderPreviewLine(fromLine, fromTag, fromText, rawFrom >= 1 ? rawFrom : 1, 'from');
      renderPreviewLine(toLine, toTag, toText, rawTo >= 1 ? rawTo : 1, 'to');

      // Mirror core.range.slice() clamping so the summary matches the export.
      var start = Math.max(1, Math.min(rawFrom, messageTotal));
      var end = Math.max(start, Math.min(rawTo, messageTotal));
      rangeSummaryEl.textContent = start === end
        ? t('rangeSummarySingle', { n: start })
        : t('rangeSummary', { from: start, to: end, count: end - start + 1 });
    }

    function toggle(force) {
      panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden;
    }

    fab.addEventListener('click', function () { toggle(); });
    close.addEventListener('click', function () { toggle(false); });

    scopeSelect.addEventListener('change', function () {
      settings.scope = settings.scope || { mode: 'full' };
      settings.scope.mode = scopeSelect.value;
      rangeRow.hidden = scopeSelect.value !== 'range';
      updateRangePreview();
      persist();
    });
    fromInput.addEventListener('input', function () {
      settings.scope = settings.scope || { mode: 'range' };
      settings.scope.mode = 'range';
      settings.scope.from = Number(fromInput.value) || 1;
      updateRangePreview();
    });
    fromInput.addEventListener('change', function () {
      settings.scope = settings.scope || { mode: 'range' };
      settings.scope.from = Number(fromInput.value) || 1;
      updateRangePreview();
      persist();
    });
    toInput.addEventListener('input', function () {
      settings.scope = settings.scope || { mode: 'range' };
      settings.scope.mode = 'range';
      settings.scope.to = Number(toInput.value) || undefined;
      updateRangePreview();
    });
    toInput.addEventListener('change', function () {
      settings.scope = settings.scope || { mode: 'range' };
      settings.scope.to = Number(toInput.value) || undefined;
      updateRangePreview();
      persist();
    });

    exportBtn.addEventListener('click', function () {
      setBusy(true);
      Promise.resolve()
        .then(function () { return onExport(settings); })
        .catch(function (error) {
          setStatus(t('failed', { error: error && error.message ? error.message : String(error) }), 'error');
        })
        .then(function () { setBusy(false); });
    });

    copyBtn.addEventListener('click', function () {
      setBusy(true);
      Promise.resolve()
        .then(function () { return onCopy(settings); })
        .catch(function (error) {
          setStatus(t('failed', { error: error && error.message ? error.message : String(error) }), 'error');
        })
        .then(function () { setBusy(false); });
    });

    calibrateBtn.addEventListener('click', function () { onCalibrate(); });

    function setBusy(busy) {
      exportBtn.disabled = busy;
      copyBtn.disabled = busy || settings.format === 'pdf';
      calibrateBtn.disabled = busy;
    }

    function setStatus(text, kind) {
      status.textContent = text;
      status.className = 'aice-status' + (kind ? ' is-' + kind : '');
    }

    function describeWarning(code) {
      var value = String(code == null ? '' : code);
      var match = value.match(/^low-confidence-rows:(\d+)$/);
      if (match) return t('warning_lowConfidence', { count: match[1] });
      match = value.match(/^roles-alternation-repaired:(\d+)$/);
      if (match) return t('warningRolesRepaired', { count: match[1] });
      var table = {
        'no-message-rows-detected': 'warning_noMessageRows',
        'all-rows-empty': 'warning_allRowsEmpty',
        'roles-inferred-by-alternation': 'warning_rolesAlternation',
        'some-roles-inferred': 'warning_someRoles',
        'roles-uniform-reset': 'warningRolesUniformReset',
        'custom-rules-found-nothing': 'warning_noMessageRows'
      };
      return table[value] ? t(table[value]) : value;
    }

    function setDiagnostics(info) {
      if (!info) { diagPre.textContent = '—'; return; }
      var lines = [];
      lines.push(t('diagnosticsHint', { strategy: info.strategy, rows: info.rowCount }));
      if (info.rows && info.rows.length) {
        info.rows.forEach(function (row) {
          lines.push('  ' + (row.index + 1) + '. [' + (row.role || '?') + '/' + (row.confidence || '?') + '] ' + (row.signature || '') + ' :: ' + row.text);
        });
      }
      if (info.warnings && info.warnings.length) {
        lines.push(t('warnings') + ':');
        info.warnings.forEach(function (warning) { lines.push('  - ' + describeWarning(warning)); });
      }
      diagPre.textContent = lines.join('\n');
    }

    function setMessageCount(info) {
      info = info || {};
      messageTotal = info.count || 0;
      messagesIndex = Array.isArray(info.options) ? info.options : [];
      fromInput.max = String(messageTotal || 0);
      toInput.max = String(messageTotal || 0);
      fromInput.placeholder = '1';
      toInput.placeholder = String(messageTotal || 0);
      if (!settings.scope || settings.scope.mode !== 'range') {
        settings.scope = { mode: scopeSelect.value === 'range' ? 'range' : 'full' };
      }
      if (settings.scope.mode !== 'range') toInput.value = String(messageTotal || '');
      updateRangePreview();
    }

    function applySettings(next) {
      settings = core.app.mergeSettings(next);
      scopeSelect.value = settings.scope && settings.scope.mode === 'range' ? 'range' : 'full';
      rangeRow.hidden = scopeSelect.value !== 'range';
      if (settings.scope && settings.scope.from) fromInput.value = String(settings.scope.from);
      if (settings.scope && settings.scope.to) toInput.value = String(settings.scope.to);
      tocCheck.input.checked = !!settings.toc;
      frontMatterCheck.input.checked = settings.frontMatter !== false;
      imagesCheck.input.checked = !!settings.images;
      reasoningCheck.input.checked = !!settings.reasoning;
      toolCheck.input.checked = !!settings.toolCalls;
      citationsCheck.input.checked = !!settings.citations;
      timestampsCheck.input.checked = !!settings.timestamps;
      if (settings.filenameTemplate) nameInput.value = settings.filenameTemplate;
      syncFormat();
      updateRangePreview();
    }

    applySettings(settings);
    syncFormat();

    return {
      element: root,
      mount: function (parent) { (parent || doc.body).appendChild(root); return root; },
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); },
      toggle: toggle,
      setStatus: setStatus,
      setDiagnostics: setDiagnostics,
      setMessageCount: setMessageCount,
      setBusy: setBusy,
      applySettings: applySettings,
      updateRangePreview: updateRangePreview,
      getSettings: function () { return core.app.mergeSettings(settings); },
      onResetRules: onResetRules
    };
  }

  ui.createPanel = createPanel;
  ui.FORMATS = FORMATS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
