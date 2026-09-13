/*
 * AI Chat Exporter — HTML → Markdown serializer.
 * Dependency-free, browser + jsdom compatible.
 * Exposes: globalThis.AIChatExporter.core.markdown
 *   - htmlToMarkdown(element, options) -> string
 *   - collectImages(element, options) -> [{url, alt}]
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});
  var dom = core.dom;

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, CANVAS: 1, IFRAME: 1,
    VIDEO: 1, AUDIO: 1, SOURCE: 1, TRACK: 1, OBJECT: 1, EMBED: 1, MAP: 1, AREA: 1,
    TEXTAREA: 1, SELECT: 1, OPTION: 1, INPUT: 1, LABEL: 1, HEAD: 1, META: 1, LINK: 1
  };

  var BLOCK_TAGS = {
    ADDRESS: 1, ARTICLE: 1, ASIDE: 1, BLOCKQUOTE: 1, DETAILS: 1, SUMMARY: 1, DIV: 1,
    DL: 1, DD: 1, DT: 1, FIELDSET: 1, FIGCAPTION: 1, FIGURE: 1, FOOTER: 1, FORM: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HEADER: 1, HR: 1, LI: 1, MAIN: 1,
    NAV: 1, OL: 1, P: 1, PRE: 1, SECTION: 1, TABLE: 1, TBODY: 1, THEAD: 1, TFOOT: 1,
    TR: 1, UL: 1
  };

  var DEFAULT_IGNORE = [
    '[data-aice-ui]',
    '[hidden]',
    'button',
    '[role="button"]',
    '[data-testid*="copy" i]',
    '[data-testid*="feedback" i]',
    '[data-testid*="avatar" i]',
    '[class*="avatar" i]',
    '[class*="copy-code" i]',
    '[class*="code-block-header" i]',
    '[class*="code-header" i]',
    '[class*="toolbar" i]',
    '[aria-label*="复制"]',
    '[aria-label*="Copy" i]',
    '[aria-label*="Good response" i]',
    '[aria-label*="Bad response" i]',
    '[aria-label*="Edit message" i]'
  ];

  var MATH_SELECTORS = [
    '.katex-display',
    '.katex',
    'mjx-container',
    '[class*="MathJax" i]',
    '[data-math]'
  ];

  function joinIgnore(options) {
    var extra = (options && options.ignoreSelectors) || [];
    return DEFAULT_IGNORE.concat(extra);
  }

  function matchesAny(el, selectors) {
    if (!el || !el.matches) return false;
    for (var i = 0; i < selectors.length; i++) {
      try {
        if (selectors[i] && el.matches(selectors[i])) return true;
      } catch (err) { /* invalid selector */ }
    }
    return false;
  }

  function isPreWrap(el) {
    if (!el) return false;
    var cls = dom.classString(el);
    if (/whitespace-pre-wrap|whitespace_pre_wrap|pre-wrap|preserve-whitespace|md-pre-wrap/i.test(cls)) return true;
    var inline = el.getAttribute && (el.getAttribute('style') || '');
    if (/white-space\s*:\s*pre/i.test(inline)) return true;
    var doc = el.ownerDocument;
    var win = doc && doc.defaultView;
    if (win && typeof win.getComputedStyle === 'function' && dom.hasLayout(doc)) {
      try {
        var cs = win.getComputedStyle(el);
        if (cs && /pre/.test(cs.whiteSpace || '')) return true;
      } catch (err) { /* ignore */ }
    }
    return false;
  }

  function escapeText(text) {
    var out = String(text == null ? '' : text);
    out = out.replace(/\\/g, '\\\\');
    out = out.replace(/([*_`[\]])/g, '\\$1');
    // Only escape characters that would start a block when they lead a line.
    out = out.replace(/^(\s*)([#>+-])(\s)/gm, '$1\\$2$3');
    out = out.replace(/^(\s*)(\d+)\.(\s)/gm, '$1$2\\.$3');
    return out;
  }

  function longestBacktickRun(text) {
    var runs = String(text).match(/`+/g);
    var max = 0;
    if (runs) for (var i = 0; i < runs.length; i++) max = Math.max(max, runs[i].length);
    return max;
  }

  function resolveUrl(href, ctx) {
    if (!href) return '';
    var url = String(href).trim();
    if (!url) return '';
    if (/^(javascript|data:text\/html)/i.test(url)) return '';
    if (ctx.baseUrl && /^\//.test(url)) {
      try {
        return new URL(url, ctx.baseUrl).href;
      } catch (err) {
        return url;
      }
    }
    return url;
  }

  function newContext(options) {
    options = options || {};
    return {
      options: options,
      ignoreSelectors: joinIgnore(options),
      baseUrl: options.baseUrl || null,
      images: [],
      preserveWhitespace: false
    };
  }

  function shouldSkip(el, ctx) {
    var tag = el.tagName;
    if (SKIP_TAGS[tag]) return true;
    if (el.getAttribute && el.getAttribute('data-aice-ui') != null) return true;
    return matchesAny(el, ctx.ignoreSelectors);
  }

  function renderMath(el, ctx) {
    var annotation = null;
    try {
      annotation = el.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/tex"]');
    } catch (err) {
      annotation = null;
    }
    var tex = annotation ? dom.normalizeText(annotation.textContent).replace(/\s+/g, ' ') : '';
    if (!tex) {
      var dataMath = el.getAttribute && (el.getAttribute('data-math') || el.getAttribute('data-tex'));
      if (dataMath) tex = dataMath;
    }
    if (!tex) tex = dom.normalizeText(dom.rawText(el));
    if (!tex) return '';
    var display = matchesAny(el, ['.katex-display', 'mjx-container[display="true"]']) ||
      (el.getAttribute && el.getAttribute('display') === 'block') ||
      /katex-display/.test(dom.classString(el));
    return display ? '$$\n' + tex + '\n$$\n\n' : '$' + tex + '$';
  }

  function renderPre(el, ctx) {
    var codeEl = el.querySelector('code') || el;
    var cls = dom.classString(codeEl) + ' ' + dom.classString(el);
    var lang = '';
    var m = cls.match(/(?:language|lang)-([a-z0-9+#._-]+)/i) || cls.match(/\bhljs-([a-z0-9+#._-]+)/i);
    if (m) lang = m[1].toLowerCase();
    if (!lang) {
      var dataLang = (codeEl.getAttribute && (codeEl.getAttribute('data-language') || codeEl.getAttribute('data-lang'))) ||
        (el.getAttribute && (el.getAttribute('data-language') || el.getAttribute('data-lang')));
      if (dataLang) lang = String(dataLang).toLowerCase().replace(/^language-/, '');
    }
    var code = String(codeEl.textContent == null ? '' : codeEl.textContent).replace(/^\n+/, '').replace(/\s+$/, '');
    var fenceLen = Math.max(3, longestBacktickRun(code) + 1);
    var fence = new Array(fenceLen + 1).join('`');
    return fence + lang + '\n' + code + '\n' + fence + '\n\n';
  }

  function renderInlineCode(el) {
    var text = String(el.textContent == null ? '' : el.textContent).replace(/\s+/g, ' ');
    if (!text) return '';
    var ticks = new Array(Math.max(1, longestBacktickRun(text) + 1) + 1).join('`');
    var pad = /^`|`$/.test(text) ? ' ' : '';
    return ticks + pad + text + pad + ticks;
  }

  function renderList(el, ctx) {
    var ordered = el.tagName === 'OL';
    var start = parseInt(el.getAttribute('start') || '1', 10);
    if (isNaN(start)) start = 1;
    var items = [];
    for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].tagName === 'LI') items.push(el.children[i]);
    }
    if (!items.length) return renderChildren(el, ctx) + '\n';
    var out = '';
    for (var n = 0; n < items.length; n++) {
      var li = items[n];
      var marker = ordered ? (start + n) + '. ' : '- ';
      var body = '';
      var nested = '';
      for (var c = 0; c < li.childNodes.length; c++) {
        var child = li.childNodes[c];
        if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
          nested += renderList(child, ctx);
        } else if (child.nodeType === 1 && child.tagName === 'P') {
          body += renderChildren(child, ctx).trim() + '\n\n';
        } else {
          body += renderNode(child, ctx);
        }
      }
      body = body.replace(/\s+$/, '');
      var indent = new Array(marker.length + 1).join(' ');
      var lines = body.split('\n');
      var rendered = marker + (lines.shift() || '');
      if (lines.length) {
        // drop a single blank separator line produced by block children
        while (lines.length && lines[0].trim() === '') lines.shift();
        rendered += lines.length ? '\n' + lines.map(function (line) { return line ? indent + line : ''; }).join('\n') : '';
      }
      out += rendered + '\n';
      if (nested.trim()) {
        out += nested.trim().split('\n').map(function (line) { return line ? indent + line : ''; }).join('\n') + '\n';
      }
      if (options_loose_paragraphs(ctx) && n < items.length - 1) out += '\n';
    }
    return out + '\n';
  }

  function options_loose_paragraphs() {
    return false;
  }

  function renderTable(el, ctx) {
    var rows = [];
    var trs = el.querySelectorAll('tr');
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      var cells = [];
      for (var c = 0; c < tr.children.length; c++) {
        var cell = tr.children[c];
        if (cell.tagName !== 'TD' && cell.tagName !== 'TH') continue;
        var text = renderChildren(cell, ctx)
          .replace(/\n{2,}/g, '<br>')
          .replace(/\n/g, '<br>')
          .replace(/\|/g, '\\|')
          .trim();
        cells.push(text);
      }
      if (cells.length) rows.push({ cells: cells, header: tr.querySelector('th') != null });
    }
    if (!rows.length) return '';
    var headerIndex = 0;
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].header) { headerIndex = r; break; }
    }
    var header = rows[headerIndex].cells;
    var width = header.length;
    var out = '| ' + header.join(' | ') + ' |\n';
    out += '| ' + header.map(function () { return '---'; }).join(' | ') + ' |\n';
    for (var k = 0; k < rows.length; k++) {
      if (k === headerIndex) continue;
      var cells2 = rows[k].cells.slice(0, width);
      while (cells2.length < width) cells2.push('');
      out += '| ' + cells2.join(' | ') + ' |\n';
    }
    return out + '\n';
  }

  function renderImage(el, ctx) {
    var src = el.getAttribute('currentsrc') || el.getAttribute('src') || '';
    if (!src) {
      var srcset = el.getAttribute('srcset') || '';
      var first = srcset.split(',')[0];
      if (first) src = first.trim().split(/\s+/)[0];
    }
    if (!src) return '';
    var alt = (el.getAttribute('alt') || '').replace(/[\r\n]+/g, ' ').trim();
    var url = resolveUrl(src, ctx);
    if (ctx.images) ctx.images.push({ url: url, alt: alt, raw: src });
    return '![' + alt + '](' + url + ')';
  }

  function renderChildren(el, ctx) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) out += renderNode(el.childNodes[i], ctx);
    return out;
  }

  function renderNode(node, ctx) {
    if (!node) return '';
    if (node.nodeType === 3) {
      var raw = String(node.nodeValue == null ? '' : node.nodeValue);
      if (!raw.trim()) {
        if (ctx.preserveWhitespace) return ' ';
        // Whitespace between two block elements carries no meaning.
        var sibling = node.previousElementSibling || node.nextElementSibling;
        return sibling && BLOCK_TAGS[sibling.tagName] ? '' : ' ';
      }
      if (ctx.preserveWhitespace) {
        var kept = raw.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/[ \t]+$/gm, '');
        return kept.replace(/\n/g, '  \n');
      }
      var text = raw.replace(/\s+/g, ' ');
      if (!text.trim() && !/^\s$/.test(text)) return ' ';
      return escapeText(text);
    }
    if (node.nodeType !== 1) return '';

    var el = node;
    if (shouldSkip(el, ctx)) return '';

    for (var i = 0; i < MATH_SELECTORS.length; i++) {
      var sel = MATH_SELECTORS[i];
      var isMath = false;
      try {
        isMath = el.matches(sel);
      } catch (err) { isMath = false; }
      if (isMath) {
        // KaTeX wraps its MathML in spans; skip the inner duplicates.
        if ((sel === '.katex' || sel === 'mjx-container') && el.closest && el.closest('.katex-display, [class*="MathJax" i]') !== el) {
          if (el.closest('.katex-display')) return '';
        }
        return renderMath(el, ctx);
      }
    }

    var tag = el.tagName;
    switch (tag) {
      case 'BR':
        return ctx.preserveWhitespace ? '  \n' : '\n';
      case 'HR':
        return '\n\n---\n\n';
      case 'PRE':
        return renderPre(el, ctx);
      case 'CODE':
        return renderInlineCode(el);
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
        var level = parseInt(tag.slice(1), 10);
        var heading = renderChildren(el, ctx).replace(/\s+/g, ' ').trim();
        return heading ? '\n\n' + new Array(level + 1).join('#') + ' ' + heading + '\n\n' : '';
      }
      case 'P':
        return '\n\n' + renderChildren(el, ctx).trim() + '\n\n';
      case 'STRONG': case 'B':
        return wrapInline('**', renderChildren(el, ctx));
      case 'EM': case 'I':
        return wrapInline('*', renderChildren(el, ctx));
      case 'DEL': case 'S': case 'STRIKE':
        return wrapInline('~~', renderChildren(el, ctx));
      case 'MARK':
        return wrapInline('==', renderChildren(el, ctx));
      case 'A': {
        var href = resolveUrl(el.getAttribute('href'), ctx);
        var label = renderChildren(el, ctx).replace(/\s+/g, ' ').trim();
        if (!href) return label;
        if (!label) return '<' + href + '>';
        return '[' + label + '](' + href + ')';
      }
      case 'IMG':
        return renderImage(el, ctx);
      case 'UL': case 'OL':
        return '\n' + renderList(el, ctx);
      case 'TABLE':
        return '\n\n' + renderTable(el, ctx);
      case 'BLOCKQUOTE': {
        var inner = renderChildren(el, ctx).trim();
        if (!inner) return '';
        return '\n\n' + inner.split('\n').map(function (line) { return line ? '> ' + line : '>'; }).join('\n') + '\n\n';
      }
      case 'DETAILS': {
        var summaryEl = el.querySelector('summary');
        var summary = summaryEl ? renderChildren(summaryEl, ctx).replace(/\s+/g, ' ').trim() : '详情';
        var rest = '';
        for (var c = 0; c < el.childNodes.length; c++) {
          if (el.childNodes[c] !== summaryEl) rest += renderNode(el.childNodes[c], ctx);
        }
        rest = rest.trim();
        if (!rest) return '';
        return '\n\n<details>\n<summary>' + summary + '</summary>\n\n' + rest + '\n\n</details>\n\n';
      }
      case 'SUMMARY':
        return '';
      case 'FIGCAPTION': {
        var cap = renderChildren(el, ctx).trim();
        return cap ? '\n\n*' + cap + '*\n\n' : '';
      }
      case 'SUP': case 'SUB': {
        var sup = renderChildren(el, ctx).trim();
        return sup;
      }
      case 'TD': case 'TH': case 'TR': case 'THEAD': case 'TBODY': case 'TFOOT':
        return renderChildren(el, ctx);
      case 'LI':
        return renderChildren(el, ctx);
      case 'DL': {
        var items = '';
        for (var d = 0; d < el.children.length; d++) {
          var child = el.children[d];
          if (child.tagName === 'DT') items += '\n\n**' + renderChildren(child, ctx).trim() + '**';
          else if (child.tagName === 'DD') items += '\n: ' + renderChildren(child, ctx).trim();
        }
        return items + '\n\n';
      }
      default:
        break;
    }

    var wasPreserve = ctx.preserveWhitespace;
    if (!wasPreserve && isPreWrap(el)) ctx.preserveWhitespace = true;
    var body = renderChildren(el, ctx);
    ctx.preserveWhitespace = wasPreserve;
    if (BLOCK_TAGS[tag]) return '\n\n' + body.trim() + '\n\n';
    return body;
  }

  function wrapInline(marker, inner) {
    var text = String(inner == null ? '' : inner);
    if (!text.trim()) return text;
    var lead = /^\s/.test(text) ? ' ' : '';
    var trail = /\s$/.test(text) ? ' ' : '';
    return lead + marker + text.trim() + marker + trail;
  }

  /** Fenced code and inline code must survive whitespace normalisation untouched. */
  function normalize(markdown) {
    var store = [];
    var token = function (value) {
      store.push(value);
      return '\u0000' + (store.length - 1) + '\u0000';
    };
    var text = String(markdown == null ? '' : markdown);
    text = text.replace(/^[ \t]+(?=```)/gm, '');
    text = text.replace(/```[\s\S]*?(?:```|$)/g, token);
    text = text.replace(/(?<!`)`[^`\n]+`/g, token);
    // Protect Markdown hard line breaks (two trailing spaces) from the strip below.
    text = text.replace(/[ \t]{2,}\n/g, '\u0001\n');
    text = text
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
      .replace(/[ \t]+$/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    text = text.replace(/\u0001/g, '  ');
    text = text.replace(/\u0000(\d+)\u0000/g, function (_, index) { return store[Number(index)]; });
    return text;
  }

  function htmlToMarkdown(element, options) {
    if (!element) return '';
    var ctx = newContext(options);
    var out = renderNode(element, ctx);
    return normalize(out);
  }

  function collectImages(element, options) {
    if (!element) return [];
    var ctx = newContext(options);
    ctx.images = [];
    renderNode(element, ctx);
    var seen = {};
    return ctx.images.filter(function (image) {
      var key = image.url || image.raw;
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  core.markdown = {
    htmlToMarkdown: htmlToMarkdown,
    collectImages: collectImages,
    normalize: normalize,
    DEFAULT_IGNORE: DEFAULT_IGNORE,
    escapeText: escapeText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
