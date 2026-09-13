/*
 * AI Chat Exporter — Markdown → HTML renderer + standalone/print document.
 * Used for the PDF export path (Chrome "另存为 PDF") and the HTML export.
 * Exposes: globalThis.AIChatExporter.core.html
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});
  var schema = core.schema;
  var serialize = core.serialize;

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function unescapeMarkdown(text) {
    return String(text == null ? '' : text).replace(/\\([\\`*_[\]{}()#+\-.!>~|])/g, '$1');
  }

  function inline(text) {
    var out = escapeHtml(unescapeMarkdown(text));
    var codeSpans = [];
    out = out.replace(/`+([^`]+)`+/g, function (match, code) {
      codeSpans.push(code);
      return '\u0000' + (codeSpans.length - 1) + '\u0000';
    });
    // Math first: $$…$$ then $…$ (the strict no-space form, so "$5 and 10$"
    // style prose is unlikely to be swallowed).
    out = out.replace(/\$\$([^$]+)\$\$/g, '<span class="math">$1</span>');
    out = out.replace(/\$([^\s$][^$\n]*?[^\s$])\$/g, '<span class="math-inline">$1</span>');
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    out = out.replace(/\u0000(\d+)\u0000/g, function (match, index) {
      return '<code>' + codeSpans[Number(index)] + '</code>';
    });
    return out;
  }

  function renderTable(rows) {
    var header = rows[0];
    var body = rows.slice(1);
    var html = '<table><thead><tr>';
    header.forEach(function (cell) { html += '<th>' + inline(cell) + '</th>'; });
    html += '</tr></thead><tbody>';
    body.forEach(function (row) {
      html += '<tr>';
      header.forEach(function (_, index) { html += '<td>' + inline(row[index] || '') + '</td>'; });
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  function splitTableRow(line) {
    var trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [];
    var current = '';
    for (var i = 0; i < trimmed.length; i++) {
      var ch = trimmed[i];
      if (ch === '\\' && trimmed[i + 1] === '|') { current += '|'; i++; continue; }
      if (ch === '|') { cells.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  }

  function isTableSeparator(line) {
    return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.indexOf('-') !== -1 && line.indexOf('|') !== -1;
  }

  function renderList(items, ordered) {
    var tag = ordered ? 'ol' : 'ul';
    var html = '<' + tag + '>';
    items.forEach(function (item) {
      html += '<li>' + inline(item.text);
      if (item.items && item.items.length) html += renderList(item.items, item.items[0].ordered);
      html += '</li>';
    });
    return html + '</' + tag + '>';
  }

  /** Consumes a whole (possibly nested) list block starting at `start`. */
  function parseListBlock(lines, start) {
    var matchAt = function (index) {
      return lines[index] && lines[index].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    };
    var first = matchAt(start);
    if (!first) return null;
    var baseIndent = first[1].replace(/\t/g, '    ').length;
    var roots = [];
    var stack = [];
    var index = start;
    while (index < lines.length) {
      var match = matchAt(index);
      if (!match) break;
      var indent = match[1].replace(/\t/g, '    ').length;
      if (indent < baseIndent) break;
      var node = { indent: indent, ordered: /\d/.test(match[2]), text: match[3], items: [] };
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (!stack.length) roots.push(node);
      else stack[stack.length - 1].items.push(node);
      stack.push(node);
      index++;
    }
    return { items: roots, next: index, ordered: roots.length ? roots[0].ordered : false };
  }

  /** Markdown → HTML for the subset the exporter itself emits. */
  function markdownToHtml(markdown) {
    var lines = String(markdown == null ? '' : markdown).replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var paragraph = [];
    var i = 0;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push('<p>' + inline(paragraph.join(' ')) + '</p>');
      paragraph = [];
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        flushParagraph();
        var lang = trimmed.replace(/^```/, '').trim();
        var code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i++; }
        i++;
        html.push('<pre><code' + (lang ? ' class="language-' + escapeHtml(lang) + '"' : '') + '>' + escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }

      if (!trimmed) { flushParagraph(); i++; continue; }

      // Display math: either "$$ … $$" on one line or a fenced "$$" block.
      var singleMath = trimmed.match(/^\$\$(.+?)\$\$$/);
      if (singleMath) {
        flushParagraph();
        html.push('<div class="math">' + escapeHtml(singleMath[1].trim()) + '</div>');
        i++;
        continue;
      }
      if (trimmed === '$$') {
        flushParagraph();
        var mathLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '$$') { mathLines.push(lines[i]); i++; }
        i++;
        html.push('<div class="math">' + escapeHtml(mathLines.join(' ').trim()) + '</div>');
        continue;
      }

      if (/^<details>/.test(trimmed)) {
        flushParagraph();
        var details = [];
        while (i < lines.length && !/<\/details>/.test(lines[i])) { details.push(lines[i]); i++; }
        details.push(lines[i] || '</details>');
        i++;
        var summaryMatch = details.join('\n').match(/<summary>([\s\S]*?)<\/summary>/);
        var summaryHtml = summaryMatch ? summaryMatch[1] : '详情';
        var bodyLines = details.slice(1).join('\n').replace(/<\/?details>|<\/summary>/g, '').replace(/<summary>[\s\S]*?<\/summary>/, '');
        html.push('<details><summary>' + escapeHtml(summaryHtml) + '</summary><div class="details-body">' + markdownToHtml(bodyLines) + '</div></details>');
        continue;
      }

      var heading = trimmed.match(/^(#{1,6})\s+(.*)$/);      if (heading) {
        flushParagraph();
        var level = heading[1].length;
        html.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^(---|\*\*\*|___)$/.test(trimmed)) {
        flushParagraph();
        html.push('<hr>');
        i++;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        flushParagraph();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quote.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        html.push('<blockquote>' + markdownToHtml(quote.join('\n')) + '</blockquote>');
        continue;
      }

      if (trimmed.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushParagraph();
        var rows = [splitTableRow(trimmed)];
        i += 2;
        while (i < lines.length && lines[i].trim().indexOf('|') !== -1 && lines[i].trim()) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        html.push(renderTable(rows));
        continue;
      }

      var listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (listMatch) {
        flushParagraph();
        var parsed = parseListBlock(lines, i);
        html.push(renderList(parsed.items, parsed.ordered));
        i = parsed.next;
        continue;
      }

      paragraph.push(trimmed);
      i++;
    }
    flushParagraph();
    return html.join('\n');
  }

  var BASE_CSS = [
    ':root { --fg:#1f2328; --muted:#6a737d; --line:#e2e5e9; --user:#0b5cad; --assistant:#0f7b4f; --code-bg:#f6f8fa; }',
    '* { box-sizing: border-box; }',
    'body { margin: 0; padding: 32px 40px 64px; color: var(--fg); background: #fff;',
    '  font: 15px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }',
    '.doc { max-width: 900px; margin: 0 auto; }',
    '.doc-title { font-size: 26px; line-height: 1.3; margin: 0 0 12px; }',
    '.meta { color: var(--muted); font-size: 13px; border-left: 3px solid var(--line); padding: 8px 12px; margin: 0 0 24px; background: #fafbfc; }',
    '.meta div { margin: 2px 0; word-break: break-all; }',
    '.toc { background: #fafbfc; border: 1px solid var(--line); border-radius: 8px; padding: 12px 18px; margin-bottom: 28px; }',
    '.toc ol { margin: 6px 0 0 18px; padding: 0; }',
    '.toc li { margin: 2px 0; font-size: 13px; }',
    '.msg { border-top: 1px solid var(--line); padding-top: 18px; margin-top: 22px; }',
    '.msg-head { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; margin-bottom: 8px; }',
    '.msg-user .msg-head { color: var(--user); }',
    '.msg-assistant .msg-head { color: var(--assistant); }',
    '.msg-index { color: var(--muted); font-weight: 400; font-size: 13px; }',
    '.body > :first-child { margin-top: 0; }',
    '.body p { margin: 0 0 12px; }',
    '.body h1,.body h2,.body h3,.body h4,.body h5,.body h6 { margin: 20px 0 10px; line-height: 1.35; }',
    '.body code { background: var(--code-bg); padding: 2px 5px; border-radius: 4px; font-size: 13px;',
    '  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }',
    '.body pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; overflow: auto; }',
    '.body pre code { background: none; padding: 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }',
    '.body blockquote { margin: 12px 0; padding: 4px 14px; border-left: 3px solid var(--line); color: var(--muted); }',
    '.body table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }',
    '.body th,.body td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }',
    '.body th { background: #f6f8fa; }',
    '.body img { max-width: 100%; height: auto; border-radius: 6px; }',
    '.body ul,.body ol { margin: 8px 0 12px 22px; padding: 0; }',
    '.body li { margin: 4px 0; }',
    '.body details { margin: 10px 0; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; background: #fbfbfc; }',
    '.body summary { cursor: pointer; color: var(--muted); font-size: 13px; }',
    '.body .math { text-align: center; margin: 12px 0; font-family: "Cambria Math", "Latin Modern Math", Georgia, serif; font-size: 15px; }',
    '.body .math-inline { font-family: "Cambria Math", "Latin Modern Math", Georgia, serif; }',
    '.citations { font-size: 13px; color: var(--muted); }'
  ].join('\n');

  var PRINT_CSS = [
    '@page { size: A4; margin: 16mm 14mm; }',
    'body { padding: 0; font-size: 12pt; }',
    '.msg { page-break-inside: auto; }',
    '.msg-head { page-break-after: avoid; }',
    '.body pre, .body table, .body img, .body blockquote { page-break-inside: avoid; }',
    '.body h1,.body h2,.body h3,.body h4 { page-break-after: avoid; }',
    'a { color: inherit; text-decoration: none; }'
  ].join('\n');

  function buildHtmlDocument(conversation, rawOptions) {
    var options = serialize.normalizeOptions ? serialize.normalizeOptions(rawOptions) : (rawOptions || {});
    var locale = options.locale || conversation.locale || 'zh-CN';
    var table = serialize.STRINGS[locale] || serialize.STRINGS['zh-CN'];
    var title = conversation.title || table.untitled;
    var parts = [];
    parts.push('<!DOCTYPE html>');
    parts.push('<html lang="' + escapeHtml(String(locale).toLowerCase()) + '">');
    parts.push('<head>');
    parts.push('<meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    parts.push('<title>' + escapeHtml(title) + '</title>');
    parts.push('<style>');
    parts.push(BASE_CSS);
    if (options.print) parts.push(PRINT_CSS);
    parts.push('</style>');
    parts.push('</head>');
    parts.push('<body>');
    parts.push('<div class="doc">');
    parts.push('<h1 class="doc-title">' + escapeHtml(title) + '</h1>');

    var metaLines = [];
    metaLines.push(table.platform + ': ' + escapeHtml(conversation.platformLabel || conversation.platform));
    metaLines.push(table.messages + ': ' + conversation.messages.length);
    metaLines.push(table.exportedAt + ': ' + escapeHtml(serialize.formatDateTime(conversation.exportedAt, locale)));
    if (conversation.model) metaLines.push(table.model + ': ' + escapeHtml(conversation.model));
    if (conversation.url) metaLines.push(table.source + ': <a href="' + escapeHtml(conversation.url) + '">' + escapeHtml(conversation.url) + '</a>');
    parts.push('<div class="meta">' + metaLines.map(function (line) { return '<div>' + line + '</div>'; }).join('') + '</div>');

    if (options.includeToc) {
      var toc = conversation.messages.map(function (message, index) {
        return '<li><a href="#msg-' + index + '">' + escapeHtml(schema.roleLabel(message.role, locale)) + ' · ' +
          escapeHtml((message.text || message.markdown || '').replace(/\s+/g, ' ').slice(0, 60)) + '</a></li>';
      }).join('');
      parts.push('<div class="toc"><strong>' + escapeHtml(table.toc) + '</strong><ol>' + toc + '</ol></div>');
    }

    conversation.messages.forEach(function (message, index) {
      var body = typeof core.html.toBodyHtml === 'function'
        ? core.html.toBodyHtml(message, options, table)
        : markdownToHtml(message.markdown || message.text || '');
      parts.push('<section class="msg msg-' + escapeHtml(message.role) + '" id="msg-' + index + '">');
      parts.push('<div class="msg-head"><span>' + schema.roleEmoji(message.role) + ' ' +
        escapeHtml(schema.roleLabel(message.role, locale)) + '</span><span class="msg-index">#' + (index + 1) + '</span>' +
        (options.includeTimestamps && message.createdAt ? '<span class="msg-index">' + escapeHtml(serialize.formatDateTime(message.createdAt, locale)) + '</span>' : '') +
        '</div>');
      parts.push('<div class="body">' + body + '</div>');
      parts.push('</section>');
    });

    parts.push('</div>');
    if (options.autoPrint) {
      parts.push('<script>window.addEventListener("load", function () { setTimeout(function () { window.focus(); window.print(); }, 250); });</script>');
    }
    parts.push('</body>');
    parts.push('</html>');
    return parts.join('\n');
  }

  function toBodyHtml(message, options, table) {
    var chunks = [];
    if (options.includeReasoning && message.reasoning) {
      chunks.push('<details><summary>' + escapeHtml(table.reasoning) + '</summary><div class="details-body">' +
        markdownToHtml(message.reasoning) + '</div></details>');
    }
    var main = message.markdown || message.text || '';
    if (main && main.trim()) chunks.push(markdownToHtml(main));
    if (options.includeToolCalls && message.toolCalls) {
      chunks.push('<details><summary>' + escapeHtml(table.toolCalls) + '</summary><div class="details-body">' +
        markdownToHtml(message.toolCalls) + '</div></details>');
    }

    var body = core.serialize && core.serialize.rewriteImageLinks
      ? core.serialize.rewriteImageLinks(chunks.join('\n'), options.imageMap)
      : chunks.join('\n');

    var extraImages = (message.images || []).filter(function (image) {
      var mapped = options.imageMap && options.imageMap[image.url];
      if (body.indexOf('src="' + image.url + '"') !== -1) return false;
      if (mapped && body.indexOf('src="' + mapped + '"') !== -1) return false;
      return true;
    });
    if (extraImages.length) {
      body += '\n' + extraImages.map(function (image) {
        var src = (options.imageMap && options.imageMap[image.url]) || image.url;
        return '<p><img alt="' + escapeHtml(image.alt || '') + '" src="' + escapeHtml(src) + '"></p>';
      }).join('\n');
    }

    if (options.includeCitations && message.citations && message.citations.length) {
      body += '\n<div class="citations"><strong>' + escapeHtml(table.citations) + '</strong><ol>' +
        message.citations.map(function (citation) {
          return '<li><a href="' + escapeHtml(citation.url) + '">' + escapeHtml(citation.title || citation.url) + '</a></li>';
        }).join('') + '</ol></div>';
    }
    return body;
  }

  core.html = {
    escapeHtml: escapeHtml,
    inline: inline,
    markdownToHtml: markdownToHtml,
    toBodyHtml: toBodyHtml,
    buildHtmlDocument: buildHtmlDocument,
    BASE_CSS: BASE_CSS,
    PRINT_CSS: PRINT_CSS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
