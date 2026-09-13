/*
 * AI Chat Exporter — image collection & packaging (Markdown + images → .zip).
 * Exposes: globalThis.AIChatExporter.core.images
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var core = (NS.core = NS.core || {});

  var EXT_BY_MIME = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/avif': 'avif'
  };

  function extFromUrl(url) {
    if (!url) return '';
    if (/^data:image\/([a-z0-9.+-]+)/i.test(url)) {
      var dataMatch = url.match(/^data:image\/([a-z0-9.+-]+)/i);
      var mime = 'image/' + dataMatch[1].toLowerCase();
      return EXT_BY_MIME[mime] || dataMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    try {
      var path = url.split('?')[0].split('#')[0];
      var match = path.match(/\.([a-z0-9]{2,5})$/i);
      if (match) return match[1].toLowerCase();
    } catch (err) { /* ignore */ }
    // OpenAI file URLs look like .../file-ABC123 (no extension) — default to png.
    return 'png';
  }

  function extFromContentType(contentType) {
    if (!contentType) return '';
    var mime = String(contentType).split(';')[0].trim().toLowerCase();
    return EXT_BY_MIME[mime] || '';
  }

  function baseNameFor(url, index) {
    var name = 'image-' + String(index + 1).padStart(3, '0');
    try {
      var path = String(url).split('?')[0].split('#')[0];
      var last = path.split('/').filter(Boolean).pop() || '';
      last = last.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40);
      if (last && !/^file-?[a-z0-9]*$/i.test(last)) name += '-' + last;
    } catch (err) { /* ignore */ }
    return name;
  }

  function collectFromMessages(messages) {
    var seen = {};
    var out = [];
    (messages || []).forEach(function (message) {
      (message.images || []).forEach(function (image) {
        var url = image.url || image.raw;
        if (!url || seen[url]) return;
        seen[url] = true;
        out.push({ url: url, alt: image.alt || '', messageIndex: message.index });
      });
    });
    return out;
  }

  function fetchAsBytes(url, options) {
    options = options || {};
    var fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('fetch is not available'));
    if (/^data:/i.test(url)) {
      var comma = url.indexOf(',');
      var meta = url.slice(5, comma);
      var payload = url.slice(comma + 1);
      if (/;base64/i.test(meta)) {
        var binary = typeof atob === 'function' ? atob(payload) : Buffer.from(payload, 'base64').toString('binary');
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return Promise.resolve({ bytes: bytes, contentType: meta.split(';')[0] || 'image/png' });
      }
      return Promise.resolve({ bytes: core.zip.encodeUtf8(decodeURIComponent(payload)), contentType: meta.split(';')[0] || 'image/svg+xml' });
    }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    if (controller && options.timeout) {
      timer = setTimeout(function () { controller.abort(); }, options.timeout);
    }
    return fetchImpl(url, { signal: controller ? controller.signal : undefined, credentials: 'include' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        var contentType = response.headers && response.headers.get ? (response.headers.get('content-type') || '') : '';
        return response.arrayBuffer().then(function (buffer) {
          return { bytes: new Uint8Array(buffer), contentType: contentType };
        });
      })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        return result;
      }, function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  /**
   * Downloads every image and returns zip entries plus a url→relative-path map
   * so the Markdown can point at the packaged files.
   */
  function packageImages(conversation, options) {
    options = options || {};
    var images = collectFromMessages(conversation.messages);
    var map = {};
    var entries = [];
    var failures = [];
    var limit = options.limit || images.length;
    var selected = images.slice(0, limit);

    function step(index) {
      if (index >= selected.length) {
        return Promise.resolve({ entries: entries, map: map, failures: failures, total: selected.length });
      }
      var image = selected[index];
      if (options.onProgress) {
        try { options.onProgress(index + 1, selected.length, image.url); } catch (err) { /* ignore */ }
      }
      return fetchAsBytes(image.url, options).then(function (result) {
        var ext = extFromContentType(result.contentType) || extFromUrl(image.url);
        var name = 'images/' + baseNameFor(image.url, index) + '.' + ext;
        entries.push({ name: name, data: result.bytes });
        map[image.url] = name;
        return step(index + 1);
      }, function (error) {
        failures.push({ url: image.url, error: error && error.message ? error.message : String(error) });
        return step(index + 1);
      });
    }

    return step(0);
  }

  core.images = {
    collectFromMessages: collectFromMessages,
    fetchAsBytes: fetchAsBytes,
    packageImages: packageImages,
    extFromUrl: extFromUrl,
    extFromContentType: extFromContentType,
    baseNameFor: baseNameFor
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
