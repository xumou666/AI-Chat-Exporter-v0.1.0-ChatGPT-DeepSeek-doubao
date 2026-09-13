/*
 * Platform registry — picks the adapter that matches the current page.
 * Exposes: globalThis.AIChatExporter.platforms.detect(location)
 */
(function (global) {
  'use strict';

  var NS = (global.AIChatExporter = global.AIChatExporter || {});
  var platforms = (NS.platforms = NS.platforms || { list: [] });

  function hostMatches(patterns, hostname) {
    if (!patterns || !patterns.length) return false;
    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      if (!pattern) continue;
      if (pattern instanceof RegExp) {
        pattern.lastIndex = 0;
        if (pattern.test(hostname)) return true;
      } else if (String(pattern).toLowerCase() === String(hostname).toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  function detect(location) {
    var hostname = '';
    try {
      hostname = (location && location.hostname) || (global.location && global.location.hostname) || '';
    } catch (err) {
      hostname = '';
    }
    for (var i = 0; i < platforms.list.length; i++) {
      var platform = platforms.list[i];
      if (platform.id === 'generic') continue;
      if (hostMatches(platform.hosts, hostname)) return platform;
    }
    return platforms.generic;
  }

  function getById(id) {
    for (var i = 0; i < platforms.list.length; i++) {
      if (platforms.list[i].id === id) return platforms.list[i];
    }
    return null;
  }

  platforms.detect = detect;
  platforms.getById = getById;
  platforms.hostMatches = hostMatches;

  NS.platforms = platforms;
})(typeof globalThis !== 'undefined' ? globalThis : this);
