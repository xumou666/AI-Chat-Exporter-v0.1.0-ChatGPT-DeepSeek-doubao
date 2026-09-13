/*
 * AI Chat Exporter — generic conversation extraction engine.
 *
 * The engine is deliberately "hint driven": platform adapters only describe
 * what a message row looks like, how roles can be recognised and where the
 * content lives. Everything else (row discovery, role inference, ordering,
 * markdown conversion) happens here, so a DOM redesign on one site can be
 * fixed with a few selectors — or with the built-in sample calibration.
 *
 * Exposes: globalThis.AIChatExporter.core.engine
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});
  var dom = core.dom;
  var md = core.markdown;

  var ENGINE_VERSION = '0.1.0';

  /** UI chrome that must never be treated as message content. */
  var BASE_IGNORE = [
    '[data-aice-ui]',
    'script',
    'style',
    'noscript',
    'template',
    'textarea',
    '[contenteditable="true"]',
    '[data-testid*="copy" i]',
    '[class*="avatar" i]',
    '[data-testid*="avatar" i]',
    '[class*="toolbar" i]',
    '[class*="copy-code" i]',
    '[aria-label*="复制"]',
    '[aria-label*="Copy" i]'
  ];

  /** Elements that never form a message row themselves. */
  var ROW_BLOCKLIST = 'nav, aside, form, textarea, script, style, [data-aice-ui], [contenteditable="true"]';

  /** Marker every element of the exporter's own UI carries. */
  var UI_SELECTOR = '[data-aice-ui]';

  /** True for the exporter's own panel/FAB — it must never be exported. */
  function insideUi(el) {
    if (!el || !el.closest) return false;
    try {
      return !!el.closest(UI_SELECTOR);
    } catch (err) {
      return false;
    }
  }

  var ROLE_ATTRIBUTE_NAMES = [
    'data-message-author-role',
    'data-author-role',
    'data-message-role',
    'data-role',
    'data-turn',
    'data-author',
    'data-sender',
    'data-speaker',
    'data-message-type'
  ];

  var ROLE_HINT_ATTRIBUTE_NAMES = ['data-testid', 'data-test-id', 'data-test', 'class', 'aria-label', 'data-type'];

  var DEFAULT_HINTS = {
    id: 'generic',
    label: 'Generic',
    rowSelectors: [],
    contentSelectors: [
      '[class*="markdown" i]',
      '[class*="prose" i]',
      '[class*="message-content" i]',
      '[class*="message_content" i]',
      '[data-testid*="message_text_content"]',
      '[class*="whitespace-pre-wrap" i]'
    ],
    reasoningSelectors: [
      '[data-testid*="reasoning" i]',
      '[class*="reasoning" i]',
      '[class*="thinking" i]',
      '[class*="think-block" i]',
      '[class*="chain-of-thought" i]'
    ],
    toolSelectors: [
      '[data-testid*="tool" i]',
      '[class*="tool-call" i]',
      '[class*="tool_use" i]',
      '[class*="toolCall" i]'
    ],
    userValues: ['user', 'human', 'me', 'prompt', 'question', 'send', 'sent', 'query', '你', '用户'],
    assistantValues: ['assistant', 'ai', 'bot', 'model', 'gpt', 'answer', 'response', 'receive', 'received', 'chatbot', '豆包', 'deepseek', '助手'],
    userPatterns: [
      /(^|[^a-z])user([^a-z]|$)/i,
      /user[-_]?message/i,
      /send[-_]?message/i,
      /human/i,
      /question/i,
      /(^|[^a-z])me([^a-z]|$)/i,
      /right[-_]?align/i,
      /flex[-_]?row[-_]?reverse/i
    ],
    assistantPatterns: [
      /assistant/i,
      /receive[-_]?message/i,
      /bot[-_]?message/i,
      /ds-markdown/i,
      /markdown[-_]?body/i,
      /message[-_]?content/i,
      /(^|[^a-z])ai([^a-z]|$)/i,
      /answer/i,
      /response/i
    ],
    userTestIdPatterns: [/user/i, /send[-_ ]?message/i, /prompt/i, /question/i],
    assistantTestIdPatterns: [/assistant/i, /receive[-_ ]?message/i, /message[_ -]?text[_ -]?content/i, /answer/i, /response/i],
    userAvatarAlt: ['you', 'user', 'me', '你', '我'],
    assistantAvatarAlt: ['chatgpt', 'gpt', 'assistant', 'ai', 'claude', 'gemini', 'deepseek', 'doubao', '豆包', '助手'],
    minRowTextLength: 1,
    minGroupTextLength: 60,
    ignoreSelectors: []
  };

  function mergeHints(platform) {
    var hints = {};
    var key;
    for (key in DEFAULT_HINTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_HINTS, key)) hints[key] = DEFAULT_HINTS[key];
    }
    platform = platform || {};
    for (key in platform) {
      if (!Object.prototype.hasOwnProperty.call(platform, key)) continue;
      var value = platform[key];
      if (Array.isArray(value) && Array.isArray(DEFAULT_HINTS[key])) {
        hints[key] = value.concat(DEFAULT_HINTS[key]);
      } else {
        hints[key] = value;
      }
    }
    hints.ignoreSelectors = BASE_IGNORE.concat(md.DEFAULT_IGNORE, platform.ignoreSelectors || []);
    hints.id = platform.id || hints.id;
    hints.label = platform.label || hints.label;
    hints.hintsVersion = platform.hintsVersion || 1;
    if (platform.match) hints.match = platform.match;
    if (platform.getMeta) hints.getMeta = platform.getMeta;
    return hints;
  }

  function matchesAnywhere(el, patterns) {
    if (!el || !patterns || !patterns.length) return false;
    var haystack = [
      dom.classString(el),
      el.getAttribute('data-testid') || '',
      el.getAttribute('data-test-id') || '',
      el.getAttribute('aria-label') || '',
      el.getAttribute('data-type') || '',
      el.getAttribute('title') || ''
    ].join(' ');
    if (!haystack.trim()) return false;
    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      if (!pattern) continue;
      if (pattern instanceof RegExp) {
        pattern.lastIndex = 0;
        if (pattern.test(haystack)) return true;
      } else if (haystack.toLowerCase().indexOf(String(pattern).toLowerCase()) !== -1) {
        return true;
      }
    }
    return false;
  }

  function matchRoleValue(value, hints) {
    if (!value) return null;
    var normalised = String(value).trim().toLowerCase();
    if (!normalised) return null;
    var i;
    for (i = 0; i < hints.userValues.length; i++) {
      var userValue = String(hints.userValues[i]).toLowerCase();
      if (normalised === userValue) return 'user';
    }
    for (i = 0; i < hints.assistantValues.length; i++) {
      var assistantValue = String(hints.assistantValues[i]).toLowerCase();
      if (normalised === assistantValue) return 'assistant';
    }
    for (i = 0; i < hints.userValues.length; i++) {
      if (normalised.indexOf(String(hints.userValues[i]).toLowerCase()) !== -1) return 'user';
    }
    for (i = 0; i < hints.assistantValues.length; i++) {
      if (normalised.indexOf(String(hints.assistantValues[i]).toLowerCase()) !== -1) return 'assistant';
    }
    return null;
  }

  /** Role from attributes on the row itself, a wrapping ancestor, or an inner wrapper. */
  function roleFromAttributes(row, hints) {
    var node = row;
    var depth = 0;
    while (node && depth < 6) {
      for (var i = 0; i < ROLE_ATTRIBUTE_NAMES.length; i++) {
        var raw = node.getAttribute && node.getAttribute(ROLE_ATTRIBUTE_NAMES[i]);
        var role = matchRoleValue(raw, hints);
        if (role) return { role: role, reason: ROLE_ATTRIBUTE_NAMES[i] + '="' + raw + '"', confidence: 'high' };
      }
      node = node.parentElement;
      depth++;
    }
    // Some sites put the role marker on an inner bubble instead of the row.
    if (row.querySelectorAll) {
      var selector = ROLE_ATTRIBUTE_NAMES.map(function (name) { return '[' + name + ']'; }).join(',');
      var inner;
      try {
        inner = row.querySelectorAll(selector);
      } catch (err) {
        inner = [];
      }
      for (var d = 0; d < inner.length && d < 20; d++) {
        for (var a = 0; a < ROLE_ATTRIBUTE_NAMES.length; a++) {
          var value = inner[d].getAttribute(ROLE_ATTRIBUTE_NAMES[a]);
          var innerRole = matchRoleValue(value, hints);
          if (innerRole) {
            return { role: innerRole, reason: ROLE_ATTRIBUTE_NAMES[a] + '="' + value + '" (inner)', confidence: 'high' };
          }
        }
      }
    }
    return null;
  }

  function roleFromTestIds(row, hints) {
    var scope = [row];
    var descendants = row.querySelectorAll ? row.querySelectorAll('[data-testid], [data-test-id], [class]') : [];
    for (var i = 0; i < descendants.length && scope.length < 40; i++) scope.push(descendants[i]);
    for (var s = 0; s < scope.length; s++) {
      var el = scope[s];
      var testId = (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test-id'))) || '';
      if (testId) {
        for (var u = 0; u < hints.userTestIdPatterns.length; u++) {
          if (hints.userTestIdPatterns[u].test(testId)) return { role: 'user', reason: 'data-testid~' + testId, confidence: 'high' };
        }
        for (var a = 0; a < hints.assistantTestIdPatterns.length; a++) {
          if (hints.assistantTestIdPatterns[a].test(testId)) return { role: 'assistant', reason: 'data-testid~' + testId, confidence: 'high' };
        }
      }
    }
    return null;
  }

  function roleFromClass(row, hints) {
    // The row itself first, then its ancestors (message wrappers often carry the role class).
    var chain = [row].concat(dom.ancestors(row, 4));
    for (var i = 0; i < chain.length; i++) {
      var el = chain[i];
      var haystack = [dom.classString(el), el.getAttribute && (el.getAttribute('data-testid') || ''), el.getAttribute && (el.getAttribute('aria-label') || '')].join(' ');
      if (!haystack.trim()) continue;
      for (var a = 0; a < hints.assistantPatterns.length; a++) {
        if (hints.assistantPatterns[a].test(haystack)) {
          for (var u = 0; u < hints.userPatterns.length; u++) {
            if (hints.userPatterns[u].test(haystack)) break;
            if (u === hints.userPatterns.length - 1) return { role: 'assistant', reason: 'class~' + haystack.trim().slice(0, 40), confidence: 'medium' };
          }
        }
      }
      for (var u2 = 0; u2 < hints.userPatterns.length; u2++) {
        if (hints.userPatterns[u2].test(haystack)) return { role: 'user', reason: 'class~' + haystack.trim().slice(0, 40), confidence: 'medium' };
      }
    }
    return null;
  }

  function roleFromAvatar(row, hints) {
    var images = row.querySelectorAll ? row.querySelectorAll('img[alt], [role="img"][aria-label], svg title') : [];
    for (var i = 0; i < images.length; i++) {
      var el = images[i];
      var alt = (el.getAttribute('alt') || el.getAttribute('aria-label') || el.textContent || '').toLowerCase();
      if (!alt) continue;
      for (var u = 0; u < hints.userAvatarAlt.length; u++) {
        if (alt.indexOf(hints.userAvatarAlt[u]) !== -1) return { role: 'user', reason: 'avatar:' + alt.slice(0, 24), confidence: 'low' };
      }
      for (var a = 0; a < hints.assistantAvatarAlt.length; a++) {
        if (alt.indexOf(hints.assistantAvatarAlt[a]) !== -1) return { role: 'assistant', reason: 'avatar:' + alt.slice(0, 24), confidence: 'low' };
      }
    }
    return null;
  }

  function roleFromLayout(row) {
    var doc = row.ownerDocument;
    var win = doc && doc.defaultView;
    if (!win || typeof win.getComputedStyle !== 'function') return null;
    var candidates = [row].concat(dom.queryAll(row, ['[class*="content" i]', '[class*="bubble" i]', '[class*="text" i]']).slice(0, 6));
    for (var i = 0; i < candidates.length; i++) {
      var cs;
      try {
        cs = win.getComputedStyle(candidates[i]);
      } catch (err) {
        continue;
      }
      if (!cs) continue;
      if (cs.textAlign === 'right' || cs.justifyContent === 'flex-end') {
        return { role: 'user', reason: 'layout', confidence: 'low' };
      }
    }
    return null;
  }

  function classifyRow(row, hints) {
    var attempts = [roleFromAttributes, roleFromTestIds, roleFromClass, roleFromAvatar];
    for (var i = 0; i < attempts.length; i++) {
      var result = attempts[i](row, hints);
      if (result) return result;
    }
    var layout = roleFromLayout(row);
    if (layout) return layout;
    return { role: null, reason: 'unknown', confidence: 'none' };
  }

  /** Fills rows without a role by strict alternation around known neighbours. */
  function fillUnknownRoles(classified) {
    var lastKnown = null;
    for (var i = 0; i < classified.length; i++) {
      if (classified[i].role) {
        lastKnown = classified[i].role;
        continue;
      }
      var previous = null;
      for (var back = i - 1; back >= 0; back--) {
        if (classified[back].role) { previous = classified[back].role; break; }
      }
      var next = null;
      for (var forward = i + 1; forward < classified.length; forward++) {
        if (classified[forward].role) { next = classified[forward].role; break; }
      }
      var inferred;
      if (previous) inferred = previous === 'user' ? 'assistant' : 'user';
      else if (next) inferred = next === 'user' ? 'assistant' : 'user';
      else inferred = lastKnown === 'user' ? 'assistant' : 'user';
      classified[i] = { role: inferred, reason: 'alternation', confidence: 'low' };
    }
    return classified;
  }

  /**
   * Assign a role to every row. Rows with no signal fall back to strict
   * alternation seeded by the nearest known neighbour.
   */
  function assignRoles(rows, hints) {
    var classified = rows.map(function (row) {
      var info = classifyRow(row, hints);
      return { role: info.role || null, reason: info.reason, confidence: info.confidence };
    });
    var known = classified.filter(function (info) { return !!info.role; }).length;
    fillUnknownRoles(classified);
    return { roles: classified, knownRoles: known };
  }

  /** Removes ancestors/descendants duplicates, keeping the innermost matches. */
  function dedupeNested(elements) {
    var result = [];
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var drop = false;
      for (var j = 0; j < elements.length; j++) {
        if (i === j) continue;
        if (el !== elements[j] && el.contains && el.contains(elements[j])) { drop = true; break; }
      }
      if (!drop) result.push(el);
    }
    return result;
  }

  function rowTextLength(row, hints) {
    return dom.textLength(row, hints.ignoreSelectors);
  }

  function isUsableRow(row, hints) {
    if (!dom.isVisible(row)) return false;
    if (insideUi(row)) return false;
    if (row.matches && row.matches(ROW_BLOCKLIST)) return false;
    if (rowTextLength(row, hints) < hints.minRowTextLength) return false;
    return true;
  }

  /**
   * Scores one container as a message list. Two shapes are supported:
   *   a) all rows share one signature (classic repeated siblings);
   *   b) rows alternate between two/few signatures (e.g. DeepSeek, where user
   *      and assistant bubbles use different hashed CSS-module classes).
   */
  function scoreContainer(container, children, hints) {
    var groups = {};
    var order = [];
    for (var i = 0; i < children.length; i++) {
      var signature = dom.signatureOf(children[i]);
      if (!groups[signature]) { groups[signature] = []; order.push(signature); }
      groups[signature].push(children[i]);
    }
    var usable = children.filter(function (child) { return isUsableRow(child, hints); });
    if (usable.length < 2) return null;

    var totalText = 0;
    var markdownMembers = 0;
    for (var u = 0; u < usable.length; u++) {
      totalText += rowTextLength(usable[u], hints);
      if (dom.containsAny(usable[u], hints.contentSelectors)) markdownMembers++;
    }
    if (totalText < hints.minGroupTextLength) return null;

    var largestSignature = order[0];
    for (var o = 1; o < order.length; o++) {
      if (groups[order[o]].length > groups[largestSignature].length) largestSignature = order[o];
    }
    var largest = groups[largestSignature] || [];
    var rows;
    var signatureOut;
    if (order.length === 1) {
      rows = usable;
      signatureOut = order[0];
    } else if (largest.length >= usable.length * 0.75) {
      rows = largest.filter(function (row) { return isUsableRow(row, hints); });
      signatureOut = largestSignature;
    } else {
      rows = usable;
      signatureOut = order.length + ' alternating shapes';
    }
    if (rows.length < 2) return null;

    var tag = rows[0].tagName;
    var navPenalty = (container.tagName === 'NAV' || tag === 'A' || tag === 'BUTTON' || tag === 'OPTION' || tag === 'LI') ? 0.15 : 1;
    var markdownRatio = markdownMembers / usable.length;
    var shapeFactor = 1 / Math.sqrt(order.length);
    var score = rows.length * Math.log(1 + totalText) * (0.35 + markdownRatio) * shapeFactor * navPenalty;
    return { score: score, rows: rows, signature: signatureOut, container: container };
  }

  function findRepeatedGroups(doc, hints, limit) {
    var all = doc.body ? doc.body.querySelectorAll('*') : [];
    var budget = limit || 8000;
    var best = null;
    var count = Math.min(all.length, budget);
    for (var i = 0; i < count; i++) {
      var container = all[i];
      if (container.getAttribute && container.getAttribute('data-aice-ui') != null) continue;
      if (insideUi(container)) continue;
      if (container.tagName === 'SCRIPT' || container.tagName === 'STYLE') continue;
      var children = [];
      for (var c = 0; c < container.children.length; c++) {
        var child = container.children[c];
        if (dom.isVisible(child)) children.push(child);
      }
      if (children.length < 2) continue;
      var candidate = scoreContainer(container, children, hints);
      if (candidate && (!best || candidate.score > best.score)) {
        best = {
          score: candidate.score,
          rows: candidate.rows,
          container: container,
          signature: candidate.signature,
          source: 'repeated-siblings'
        };
      }
    }
    return best;
  }

  function rowsFromSelectors(doc, hints) {
    var rows = [];
    for (var i = 0; i < hints.rowSelectors.length; i++) {
      var selector = hints.rowSelectors[i];
      var found = dom.queryAll(doc, [selector]);
      for (var f = 0; f < found.length; f++) {
        if (rows.indexOf(found[f]) === -1) rows.push(found[f]);
      }
    }
    rows = dedupeNested(rows);
    rows = rows.filter(function (row) { return dom.isVisible(row) && rowTextLength(row, hints) >= hints.minRowTextLength; });
    return dom.sortDocumentOrder(rows);
  }

  function detectRows(doc, hints) {
    var explicit = rowsFromSelectors(doc, hints);
    if (explicit.length >= 2) {
      return { rows: explicit, source: 'platform-selectors', signature: hints.rowSelectors[0] || '' };
    }
    var group = findRepeatedGroups(doc, hints);
    if (group && group.rows.length >= 2) {
      return { rows: dedupeNested(group.rows), source: group.source, signature: group.signature, container: group.container };
    }
    if (explicit.length === 1) return { rows: explicit, source: 'platform-selectors-single', signature: hints.rowSelectors[0] || '' };
    if (group && group.rows.length === 1) return { rows: group.rows, source: 'repeated-siblings-single', signature: group.signature };
    return { rows: [], source: 'none' };
  }

  /** Best content container inside a row. */
  function contentRoot(row, hints, ignoreSelectors) {
    var preferred = dom.queryAll(row, hints.contentSelectors || []);
    var rowLength = dom.textLength(row, ignoreSelectors);
    var best = null;
    var bestLength = 0;
    for (var i = 0; i < preferred.length; i++) {
      var el = preferred[i];
      if (!dom.isVisible(el)) continue;
      var length = dom.textLength(el, ignoreSelectors);
      if (length > bestLength) { best = el; bestLength = length; }
    }
    if (best && (rowLength === 0 || bestLength >= rowLength * 0.35)) return best;

    var descendants = row.querySelectorAll ? row.querySelectorAll('*') : [];
    var chosen = null;
    var threshold = rowLength * 0.9;
    for (var d = 0; d < descendants.length; d++) {
      var node = descendants[d];
      if (!dom.isVisible(node)) continue;
      var matchesIgnore = false;
      for (var ig = 0; ig < (ignoreSelectors || []).length; ig++) {
        try {
          if (ignoreSelectors[ig] && node.matches(ignoreSelectors[ig])) { matchesIgnore = true; break; }
        } catch (err) { /* invalid selector */ }
      }
      if (matchesIgnore) continue;
      var nodeLength = dom.textLength(node, ignoreSelectors);
      if (nodeLength > 0 && nodeLength >= threshold) chosen = node;
    }
    return chosen || row;
  }

  function collectCitations(root, baseUrl) {
    if (!root || !root.querySelectorAll) return [];
    var links = root.querySelectorAll('a[href]');
    var seen = {};
    var out = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (!/^https?:/i.test(href)) continue;
      if (seen[href]) continue;
      seen[href] = true;
      out.push({ url: href, title: dom.normalizeText(links[i].textContent).slice(0, 200) || href });
    }
    return out;
  }

  function extractSection(row, selectors, hints, options) {
    var nodes = dom.queryAll(row, selectors || []);
    if (!nodes.length) return null;
    var picked = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!dom.isVisible(node)) continue;
      var inner = dom.textOf(node, hints.ignoreSelectors);
      if (!inner) continue;
      picked.push(md.htmlToMarkdown(node, { ignoreSelectors: hints.ignoreSelectors, baseUrl: options.baseUrl }));
    }
    var text = picked.join('\n\n').trim();
    return text || null;
  }

  function extractTimestamp(row) {
    if (!row.querySelector) return null;
    var time = row.querySelector('time[datetime], [data-timestamp], [data-time]');
    if (!time) return null;
    return time.getAttribute('datetime') || time.getAttribute('data-timestamp') || time.getAttribute('data-time') || null;
  }

  function extractRow(row, roleInfo, hints, options) {
    var ignore = hints.ignoreSelectors;
    var root = contentRoot(row, hints, ignore) || row;
    var message = {
      role: roleInfo.role || 'unknown',
      roleConfidence: roleInfo.confidence || 'none',
      roleReason: roleInfo.reason || '',
      markdown: md.htmlToMarkdown(root, { ignoreSelectors: ignore, baseUrl: options.baseUrl }),
      text: dom.textOf(root, ignore),
      html: options.captureHtml ? (root.innerHTML || '') : undefined,
      images: md.collectImages(root, { ignoreSelectors: ignore }),
      citations: collectCitations(root, options.baseUrl),
      reasoning: options.captureReasoning ? extractSection(row, hints.reasoningSelectors, hints, options) : null,
      toolCalls: options.captureToolCalls ? extractSection(row, hints.toolSelectors, hints, options) : null,
      createdAt: extractTimestamp(row)
    };
    if (!message.markdown && !message.text) return null;
    return message;
  }

  function extractMessagesFromRows(rows, hints, options) {
    var assigned = assignRoles(rows, hints);
    var messages = [];
    var failures = 0;
    for (var i = 0; i < rows.length; i++) {
      var message = extractRow(rows[i], assigned.roles[i], hints, options);
      if (!message) { failures++; continue; }
      message.index = messages.length;
      messages.push(message);
    }
    return {
      messages: messages,
      knownRoles: assigned.knownRoles,
      rowCount: rows.length,
      emptyRows: failures
    };
  }

  /**
   * Calibration: derive reusable row signatures from two sample elements that
   * the user clicked (one user message, one assistant message).
   */
  function rowForSample(el, maxDepth) {
    var node = el;
    var depth = 0;
    while (node && node.parentElement && depth < (maxDepth || 12)) {
      var parent = node.parentElement;
      var signature = dom.signatureOf(node);
      var siblings = 0;
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i] !== node && dom.signatureOf(parent.children[i]) === signature) siblings++;
      }
      if (siblings >= 1 && rowTextLength(node, { ignoreSelectors: BASE_IGNORE }) > 0) return node;
      node = parent;
      depth++;
    }
    return el;
  }

  function deriveRules(userEl, assistantEl, doc) {
    if (!userEl || !assistantEl) throw new Error('deriveRules requires two sample elements');
    var userRow = rowForSample(userEl);
    var assistantRow = rowForSample(assistantEl);
    var userContent = contentRoot(userRow, { contentSelectors: DEFAULT_HINTS.contentSelectors, ignoreSelectors: BASE_IGNORE }, BASE_IGNORE);
    var assistantContent = contentRoot(assistantRow, { contentSelectors: DEFAULT_HINTS.contentSelectors, ignoreSelectors: BASE_IGNORE }, BASE_IGNORE);
    return {
      schema: 'ai-chat-exporter/rules@1',
      createdAt: new Date().toISOString(),
      pageHost: doc && doc.location ? doc.location.host : '',
      threshold: 0.8,
      userSignature: dom.signatureOf(userRow),
      assistantSignature: dom.signatureOf(assistantRow),
      userContentSignature: userContent && userContent !== userRow ? dom.signatureOf(userContent) : null,
      assistantContentSignature: assistantContent && assistantContent !== assistantRow ? dom.signatureOf(assistantContent) : null,
      samples: {
        user: dom.textOf(userRow, BASE_IGNORE).slice(0, 200),
        assistant: dom.textOf(assistantRow, BASE_IGNORE).slice(0, 200)
      }
    };
  }

  /** Highest structural similarity between the element and any descendant. */
  function bestDescendantSimilarity(el, signature) {
    if (!signature || !el.querySelectorAll) return 0;
    var best = dom.signatureSimilarity(el, signature);
    if (best >= 1) return best;
    var nodes;
    try {
      nodes = el.querySelectorAll('*');
    } catch (err) {
      return best;
    }
    var limit = Math.min(nodes.length, 200);
    for (var i = 0; i < limit; i++) {
      var score = dom.signatureSimilarity(nodes[i], signature);
      if (score > best) best = score;
      if (best >= 1) break;
    }
    return best;
  }

  function extractWithRules(doc, rules, options) {
    options = options || {};
    var threshold = typeof rules.threshold === 'number' ? rules.threshold : 0.8;
    var candidates = [];
    var all = doc.body ? doc.body.querySelectorAll('*') : [];
    var limit = Math.min(all.length, 20000);
    for (var i = 0; i < limit; i++) {
      var el = all[i];
      if (!dom.isVisible(el)) continue;
      if (insideUi(el)) continue;
      if (el.matches && el.matches(ROW_BLOCKLIST)) continue;
      var userScore = rules.userSignature ? dom.signatureSimilarity(el, rules.userSignature) : 0;
      var assistantScore = rules.assistantSignature ? dom.signatureSimilarity(el, rules.assistantSignature) : 0;
      if (rules.userContentSignature) {
        userScore = Math.max(userScore, bestDescendantSimilarity(el, rules.userContentSignature));
      }
      if (rules.assistantContentSignature) {
        assistantScore = Math.max(assistantScore, bestDescendantSimilarity(el, rules.assistantContentSignature));
      }
      if (Math.max(userScore, assistantScore) < threshold) continue;
      if (extractTextLengthForRules(el) <= 0) continue;
      var role = null;
      if (userScore > assistantScore) role = 'user';
      else if (assistantScore > userScore) role = 'assistant';
      candidates.push({ el: el, role: role, score: Math.max(userScore, assistantScore) });
    }

    var elements = candidates.map(function (item) { return item.el; });
    var kept = dedupeNested(elements);
    var filtered = [];
    for (var c = 0; c < candidates.length; c++) {
      if (kept.indexOf(candidates[c].el) === -1) continue;
      filtered.push(candidates[c]);
    }
    var ordered = filtered.slice().sort(function (a, b) {
      var pos = a.el.compareDocumentPosition(b.el);
      if (pos & 4) return -1;
      if (pos & 2) return 1;
      return 0;
    });

    var classified = ordered.map(function (item) {
      return item.role
        ? { role: item.role, reason: 'custom-rules', confidence: 'calibrated' }
        : { role: null, reason: 'unknown', confidence: 'none' };
    });
    fillUnknownRoles(classified);

    var hints = mergeHints(options.platform || {});
    var messages = [];
    for (var m = 0; m < ordered.length; m++) {
      var message = extractRow(ordered[m].el, classified[m], hints, options);
      if (!message) continue;
      message.index = messages.length;
      messages.push(message);
    }
    return { messages: messages, rowCount: ordered.length, source: 'custom-rules' };
  }

  function extractTextLengthForRules(el) {
    return dom.textLength(el, BASE_IGNORE);
  }

  function extractConversation(doc, platform, options) {
    options = options || {};
    var hints = mergeHints(platform);
    var warnings = [];
    var detection = options.customRules
      ? { rows: [], source: 'custom-rules', signature: '' }
      : detectRows(doc, hints);
    var extraction;

    if (options.customRules) {
      extraction = extractWithRules(doc, options.customRules, options);
      if (!extraction.messages.length) {
        warnings.push('custom-rules-found-nothing');
        extraction = null;
      }
    }
    if (!extraction) {
      if (!detection.rows.length) {
        return {
          messages: [],
          warnings: ['no-message-rows-detected'],
          strategy: detection.source,
          debug: { hints: hints.id, rows: 0 }
        };
      }
      extraction = extractMessagesFromRows(detection.rows, hints, options);
    }

    if (extraction.messages.length === 0) warnings.push('all-rows-empty');
    if (extraction.knownRoles === 0 && extraction.messages.length > 1) warnings.push('roles-inferred-by-alternation');
    else if (typeof extraction.knownRoles === 'number' && extraction.knownRoles < extraction.messages.length) warnings.push('some-roles-inferred');
    var lowConfidence = extraction.messages.filter(function (message) { return message.roleConfidence === 'low'; }).length;
    if (lowConfidence) warnings.push('low-confidence-rows:' + lowConfidence);

    return {
      messages: extraction.messages,
      warnings: warnings,
      strategy: detection.source,
      debug: {
        hints: hints.id,
        rows: extraction.rowCount,
        emptyRows: extraction.emptyRows || 0,
        knownRoles: extraction.knownRoles,
        signature: detection.signature || ''
      }
    };
  }

  /** Diagnostics for the on-page panel: what does the engine currently see? */
  function debugCandidates(doc, platform) {
    var hints = mergeHints(platform);
    var detection = detectRows(doc, hints);
    var preview = detection.rows.slice(0, 12).map(function (row, index) {
      var info = classifyRow(row, hints);
      return {
        index: index,
        signature: dom.signatureOf(row),
        role: info.role,
        confidence: info.confidence,
        reason: info.reason,
        text: dom.textOf(row, hints.ignoreSelectors).slice(0, 120)
      };
    });
    return {
      strategy: detection.source,
      signature: detection.signature || '',
      rowCount: detection.rows.length,
      hints: hints.id,
      rows: preview
    };
  }

  core.engine = {
    version: ENGINE_VERSION,
    mergeHints: mergeHints,
    detectRows: detectRows,
    classifyRow: classifyRow,
    assignRoles: assignRoles,
    contentRoot: contentRoot,
    extractConversation: extractConversation,
    deriveRules: deriveRules,
    extractWithRules: extractWithRules,
    debugCandidates: debugCandidates,
    BASE_IGNORE: BASE_IGNORE,
    DEFAULT_HINTS: DEFAULT_HINTS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
