/*
 * AI Chat Exporter — UI strings (zh-CN / en).
 * Exposes: globalThis.AIChatExporter.core.i18n
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var MESSAGES = {
    'zh-CN': {
      appName: 'AI 对话导出',
      buttonTitle: '导出当前对话',
      panelTitle: '导出当前对话',
      close: '关闭',
      format: '导出格式',
      scope: '导出范围',
      scopeFull: '全部消息',
      scopeRange: '指定范围',
      from: '起始',
      to: '结束',
      rangePickFrom: '起始 #{n}',
      rangePickTo: '结束 #{n}',
      rangeOutOfRange: '超出范围',
      rangeSummary: '将导出第 {from}–{to} 条，共 {count} 条',
      rangeSummarySingle: '将只导出第 {n} 条',
      rangeSummaryEmpty: '未识别到消息，无法选择范围',
      rangeNoPreview: '（该条没有文本内容）',
      roleInferred: '角色为推断',
      copyDiagnostics: '复制诊断',
      diagnosticsCopied: '诊断信息已复制到剪贴板，粘贴到 issue 里即可',
      pickRange: '点选范围',
      pickRangeStart: '请点击当前对话的【第一条】消息',
      pickRangeEnd: '再点击当前对话的【最后一条】消息',
      pickRangeDone: '已按点击结果填入范围：第 {from}–{to} 条，请核对后导出',
      rolesMayBeWrong: '角色可能判断有误，请核对后再导出（展开「结构诊断」可看每条的依据）',
      warningRolesUniformReset: '所有消息被判定成同一角色，已改按「用户/助手」交替推断，请核对。',
      warningRolesRepaired: '有 {count} 条消息的角色与相邻消息冲突，已按交替顺序修正，请核对。',
      warningOtherConversationRows: '页面上同时存在多段对话，已只保留当前这一段（忽略了 {count} 条其它对话的内容）。若取错了，请用「手动校准」。',
      options: '选项',
      optToc: '生成目录 (TOC)',
      optFrontMatter: '包含 YAML 元信息',
      optImages: '包含图片',
      optImagesHint: '图片将连同 Markdown 打包为 ZIP',
      optReasoning: '包含思考过程',
      optToolCalls: '包含工具调用',
      optCitations: '包含参考链接',
      optTimestamps: '包含消息时间',
      filenameTemplate: '文件名模板',
      exportMd: '导出 Markdown',
      exportJson: '导出 JSON',
      exportPdf: '导出 PDF',
      exportTxt: '导出纯文本',
      exportHtml: '导出 HTML',
      copyMd: '复制 Markdown',
      status: '状态',
      ready: '准备就绪',
      scanning: '正在解析对话…',
      found: '已识别 {count} 条消息（{platform}）',
      notFound: '未识别到消息，请尝试“手动校准”或反馈 DOM 结构',
      exporting: '正在导出…',
      packaged: '已导出，含 {count} 张图片',
      copied: '已复制到剪贴板',
      failed: '导出失败：{error}',
      calibrate: '手动校准',
      calibrateHint: '依次点击一条【用户】消息和一条【助手】消息，用于自动学习页面结构。',
      calibrateStep1: '请点击一条【用户】消息',
      calibrateStep2: '请点击一条【助手】消息',
      calibrateSaved: '已学习当前页面结构，之后导出将优先使用。',
      calibrateReset: '清除已学习结构',
      diagnostics: '结构诊断',
      diagnosticsHint: '当前识别策略：{strategy}，候选行数：{rows}',
      warnings: '提示',
      noWarnings: '无',
      warning_noMessageRows: '没有找到消息行，可能页面尚未加载完成或站点改版。',
      warning_allRowsEmpty: '找到了消息行，但内容为空。',
      warning_rolesAlternation: '无法从 DOM 判断角色，已按“用户/助手”交替推断，请检查结果。',
      warning_someRoles: '部分消息角色通过交替推断得出。',
      warning_lowConfidence: '有 {count} 条消息角色置信度较低。',
      customRules: '已启用页面校准规则',
      partialExport: '仅导出选中范围',
      preview: '预览',
      imagesFailed: '有 {count} 张图片下载失败',
      downloadStarted: '已开始下载：{filename}'
    },
    en: {
      appName: 'AI Chat Exporter',
      buttonTitle: 'Export this conversation',
      panelTitle: 'Export conversation',
      close: 'Close',
      format: 'Format',
      scope: 'Scope',
      scopeFull: 'All messages',
      scopeRange: 'Message range',
      from: 'From',
      to: 'To',
      rangePickFrom: 'From #{n}',
      rangePickTo: 'To #{n}',
      rangeOutOfRange: 'out of range',
      rangeSummary: 'Will export messages {from}–{to} ({count} in total)',
      rangeSummarySingle: 'Will export only message {n}',
      rangeSummaryEmpty: 'No messages detected — nothing to pick',
      rangeNoPreview: '(no text in this message)',
      roleInferred: 'role inferred',
      copyDiagnostics: 'Copy diagnostics',
      diagnosticsCopied: 'Diagnostics copied to the clipboard — paste them into the issue',
      pickRange: 'Pick range',
      pickRangeStart: 'Click the FIRST message of this conversation',
      pickRangeEnd: 'Now click the LAST message of this conversation',
      pickRangeDone: 'Range filled from your clicks: messages {from}–{to} — verify, then export',
      rolesMayBeWrong: 'Roles may be wrong — please verify before exporting (expand Diagnostics for the evidence per row)',
      warningRolesUniformReset: 'Every message was classified as the same role; fell back to user/assistant alternation — please verify.',
      warningRolesRepaired: '{count} message role(s) conflicted with their neighbour and were corrected by alternation — please verify.',
      warningOtherConversationRows: 'This page holds more than one conversation; only the current one was kept ({count} row(s) from another conversation were ignored). Use Calibrate if the wrong one was picked.',
      options: 'Options',
      optToc: 'Include table of contents',
      optFrontMatter: 'Include YAML front matter',
      optImages: 'Include images',
      optImagesHint: 'Images are packaged with the Markdown into a ZIP',
      optReasoning: 'Include reasoning',
      optToolCalls: 'Include tool calls',
      optCitations: 'Include citations',
      optTimestamps: 'Include timestamps',
      filenameTemplate: 'Filename template',
      exportMd: 'Export Markdown',
      exportJson: 'Export JSON',
      exportPdf: 'Export PDF',
      exportTxt: 'Export plain text',
      exportHtml: 'Export HTML',
      copyMd: 'Copy Markdown',
      status: 'Status',
      ready: 'Ready',
      scanning: 'Reading conversation…',
      found: '{count} messages detected ({platform})',
      notFound: 'No messages detected — try “Calibrate” or report the DOM structure',
      exporting: 'Exporting…',
      packaged: 'Exported with {count} image(s)',
      copied: 'Copied to clipboard',
      failed: 'Export failed: {error}',
      calibrate: 'Calibrate',
      calibrateHint: 'Click one USER message and one ASSISTANT message so the exporter can learn this page.',
      calibrateStep1: 'Click a USER message',
      calibrateStep2: 'Click an ASSISTANT message',
      calibrateSaved: 'Page structure learned — future exports will use it.',
      calibrateReset: 'Clear learned structure',
      diagnostics: 'Diagnostics',
      diagnosticsHint: 'Strategy: {strategy}, candidate rows: {rows}',
      warnings: 'Warnings',
      noWarnings: 'none',
      warning_noMessageRows: 'No message rows found — the page may still be loading, or the site changed.',
      warning_allRowsEmpty: 'Message rows were found but their content is empty.',
      warning_rolesAlternation: 'Roles could not be read from the DOM; user/assistant was inferred by alternation — please verify.',
      warning_someRoles: 'Some roles were inferred by alternation.',
      warning_lowConfidence: '{count} message(s) have low role confidence.',
      customRules: 'Calibrated page rules active',
      partialExport: 'Exporting the selected range only',
      preview: 'Preview',
      imagesFailed: '{count} image(s) failed to download',
      downloadStarted: 'Download started: {filename}'
    }
  };

  var current = null;

  function detectLocale() {
    var lang = 'zh-CN';
    try {
      if (global.navigator) lang = global.navigator.language || (global.navigator.languages && global.navigator.languages[0]) || lang;
    } catch (err) { /* ignore */ }
    return /^zh/i.test(lang) ? 'zh-CN' : 'en';
  }

  function setLocale(locale) {
    current = MESSAGES[locale] ? locale : null;
    return locale;
  }

  function locale() {
    return current || detectLocale();
  }

  function t(key, vars) {
    var table = MESSAGES[locale()] || MESSAGES['zh-CN'];
    var template = table[key] != null ? table[key] : (MESSAGES['zh-CN'][key] != null ? MESSAGES['zh-CN'][key] : key);
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return vars[name] != null ? String(vars[name]) : match;
    });
  }

  core.i18n = {
    MESSAGES: MESSAGES,
    t: t,
    setLocale: setLocale,
    locale: locale,
    detectLocale: detectLocale
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
