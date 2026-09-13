/*
 * AI Chat Exporter — core DOM helpers.
 * Classic script (no ES modules) so it can run as a content script and be
 * evaluated inside jsdom in the Node test-suite.
 * Exposes: globalThis.AIChatExporter.core.dom
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var layoutCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function isElement(node) {
    return !!node && node.nodeType === ELEMENT_NODE;
  }

  function isText(node) {
    return !!node && node.nodeType === TEXT_NODE;
  }

  /** querySelectorAll over several selectors, de-duplicated, document order kept. */
  function queryAll(root, selectors) {
    var list = Array.isArray(selectors) ? selectors : [selectors];
    var seen = [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var sel = list[i];
      if (!sel || typeof sel !== 'string') continue;
      var found;
      try {
        found = root.querySelectorAll(sel);
      } catch (err) {
        continue; // invalid selector: ignore instead of crashing the export
      }
      for (var j = 0; j < found.length; j++) {
        var el = found[j];
        if (seen.indexOf(el) === -1) {
          seen.push(el);
          out.push(el);
        }
      }
    }
    return out;
  }

  function queryOne(root, selectors) {
    var all = queryAll(root, selectors);
    return all.length ? all[0] : null;
  }

  /** True when the document actually performs layout (browsers yes, jsdom no). */
  function hasLayout(doc) {
    if (!doc) return false;
    if (layoutCache && layoutCache.has(doc)) return layoutCache.get(doc);
    var value = false;
    try {
      var body = doc.body;
      if (body && typeof body.getBoundingClientRect === 'function') {
        var rect = body.getBoundingClientRect();
        value = !!(rect && (rect.width > 0 || rect.height > 0));
      }
    } catch (err) {
      value = false;
    }
    if (layoutCache) layoutCache.set(doc, value);
    return value;
  }

  function isVisible(el) {
    if (!isElement(el)) return false;
    if (el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    var inline = el.getAttribute('style') || '';
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(inline)) return false;
    var doc = el.ownerDocument;
    var win = doc && doc.defaultView;
    if (win && typeof win.getComputedStyle === 'function') {
      var cs = null;
      try {
        cs = win.getComputedStyle(el);
      } catch (err) {
        cs = null;
      }
      if (cs) {
        if (cs.display === 'none') return false;
        if (cs.visibility === 'hidden') return false;
      }
    }
    if (hasLayout(doc)) {
      var rects = typeof el.getClientRects === 'function' ? el.getClientRects() : null;
      if (rects && rects.length === 0) return false;
    }
    return true;
  }

  function normalizeText(text) {
    return String(text == null ? '' : text)
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
      .replace(/^[ \t]+/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Raw text of a node (innerText when layout exists and node is connected). */
  function rawText(node) {
    if (!node) return '';
    var doc = node.ownerDocument;
    var connected = node.isConnected !== false;
    if (connected && hasLayout(doc) && typeof node.innerText === 'string') return node.innerText;
    return node.textContent || '';
  }

  function stripIgnored(node, ignoreSelectors) {
    if (!ignoreSelectors || !ignoreSelectors.length || !node || !node.cloneNode) return node;
    var clone;
    try {
      clone = node.cloneNode(true);
    } catch (err) {
      return node;
    }
    for (var i = 0; i < ignoreSelectors.length; i++) {
      var sel = ignoreSelectors[i];
      if (!sel) continue;
      var hits;
      try {
        hits = clone.querySelectorAll(sel);
      } catch (err) {
        continue;
      }
      for (var j = hits.length - 1; j >= 0; j--) {
        var hit = hits[j];
        if (hit.parentNode) hit.parentNode.removeChild(hit);
      }
    }
    return clone;
  }

  /** Normalised text of an element, optionally ignoring chrome (avatars, buttons…). */
  function textOf(el, ignoreSelectors) {
    if (!el) return '';
    var node = ignoreSelectors && ignoreSelectors.length ? stripIgnored(el, ignoreSelectors) : el;
    return normalizeText(rawText(node));
  }

  function textLength(el, ignoreSelectors) {
    return textOf(el, ignoreSelectors).length;
  }

  /** tagName + sorted class list — a cheap structural fingerprint of an element. */
  function signatureOf(el) {
    if (!isElement(el)) return '';
    var classes = [];
    var list = el.classList;
    if (list) {
      for (var i = 0; i < list.length; i++) classes.push(list[i]);
    }
    classes.sort();
    return el.tagName + (classes.length ? '.' + classes.join('.') : '');
  }

  function matchesSignature(el, signature) {
    return !!signature && signatureOf(el) === signature;
  }

  /** Loose match: same tag and ≥ minRatio of the signature's classes present. */
  function signatureSimilarity(el, signature) {
    if (!isElement(el) || !signature) return 0;
    var parts = String(signature).split('.');
    if (parts[0] !== el.tagName) return 0;
    var want = parts.slice(1).filter(Boolean);
    if (!want.length) return 1;
    var have = [];
    var list = el.classList;
    if (list) {
      for (var i = 0; i < list.length; i++) have.push(list[i]);
    }
    var hit = 0;
    for (var k = 0; k < want.length; k++) if (have.indexOf(want[k]) !== -1) hit++;
    return hit / want.length;
  }

  function ancestors(el, maxDepth) {
    var out = [];
    var node = el && el.parentElement;
    var depth = 0;
    while (node && (!maxDepth || depth < maxDepth)) {
      out.push(node);
      node = node.parentElement;
      depth++;
    }
    return out;
  }

  function closestMatch(el, matcher, maxDepth) {
    var node = el;
    var depth = 0;
    while (node && (!maxDepth || depth < maxDepth)) {
      var ok = false;
      try {
        ok = matcher(node);
      } catch (err) {
        ok = false;
      }
      if (ok) return node;
      node = node.parentElement;
      depth++;
    }
    return null;
  }

  function depthOf(el, root) {
    var depth = 0;
    var node = el;
    while (node && node !== root && node.parentElement) {
      node = node.parentElement;
      depth++;
    }
    return depth;
  }

  function sortDocumentOrder(nodes) {
    return nodes.slice().sort(function (a, b) {
      if (a === b) return 0;
      var pos = a.compareDocumentPosition(b);
      if (pos & 4 /* DOCUMENT_POSITION_FOLLOWING */) return -1;
      if (pos & 2 /* DOCUMENT_POSITION_PRECEDING */) return 1;
      return 0;
    });
  }

  function attrOf(el, names) {
    if (!el || !el.getAttribute) return null;
    for (var i = 0; i < names.length; i++) {
      var value = el.getAttribute(names[i]);
      if (value != null && value !== '') return value;
    }
    return null;
  }

  /** Searches the element and up to maxDepth ancestors for the first attribute hit. */
  function attrFromAncestors(el, names, maxDepth) {
    var node = el;
    var depth = 0;
    while (node && (!maxDepth || depth <= maxDepth)) {
      var value = attrOf(node, names);
      if (value != null) return { value: value, node: node, attribute: names.find ? names.find(function (n) { return node.getAttribute(n); }) : null };
      node = node.parentElement;
      depth++;
    }
    return null;
  }

  function classString(el) {
    return el && el.className && typeof el.className === 'string' ? el.className : '';
  }

  function describe(el) {
    if (!isElement(el)) return String(el);
    var chain = [];
    var node = el;
    var depth = 0;
    while (node && depth < 3) {
      var cls = classString(node).split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      chain.push(node.tagName.toLowerCase() + (cls ? '.' + cls : ''));
      node = node.parentElement;
      depth++;
    }
    return chain.join(' < ');
  }

  /** Does any of the given selectors match the element itself or a descendant? */
  function containsAny(el, selectors) {
    if (!el || !selectors) return false;
    for (var i = 0; i < selectors.length; i++) {
      var sel = selectors[i];
      if (!sel) continue;
      try {
        if (el.matches && el.matches(sel)) return true;
      } catch (err) { /* invalid selector */ }
      try {
        if (el.querySelector && el.querySelector(sel)) return true;
      } catch (err) { /* invalid selector */ }
    }
    return false;
  }

  core.dom = {
    isElement: isElement,
    isText: isText,
    queryAll: queryAll,
    queryOne: queryOne,
    hasLayout: hasLayout,
    isVisible: isVisible,
    normalizeText: normalizeText,
    rawText: rawText,
    textOf: textOf,
    textLength: textLength,
    stripIgnored: stripIgnored,
    signatureOf: signatureOf,
    matchesSignature: matchesSignature,
    signatureSimilarity: signatureSimilarity,
    ancestors: ancestors,
    closestMatch: closestMatch,
    depthOf: depthOf,
    sortDocumentOrder: sortDocumentOrder,
    attrOf: attrOf,
    attrFromAncestors: attrFromAncestors,
    classString: classString,
    describe: describe,
    containsAny: containsAny
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
