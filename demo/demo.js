/*
 * Demo page helper — deep links so a screenshot, a tutorial link or a curious
 * visitor can open the panel in a specific state:
 *
 *   demo/index.html            → panel closed (floating button only)
 *   demo/index.html#panel      → panel open, scope = 全部消息
 *   demo/index.html#range=2-4  → panel open, scope = 指定范围 2–4 (with previews)
 *   demo/index.html#diag       → panel open with 结构诊断 expanded
 *
 * It only talks to the public `window.__AICE__` API that content.js exposes.
 */
(function () {
  'use strict';

  function apply() {
    var api = window.__AICE__;
    if (!api || typeof api.getPanel !== 'function') return false;
    var panel = api.getPanel();
    if (!panel) return false;

    var hash = String(window.location.hash || '');
    if (!hash) return true; // nothing to do — keep the panel closed

    var root = document.getElementById('aice-root');
    if (!root) return false;

    var rangeMatch = hash.match(/range=(\d+)\s*-\s*(\d+)/);
    if (hash.indexOf('range') !== -1 && root.querySelector('select')) {
      var select = root.querySelector('select');
      select.value = 'range';
      select.dispatchEvent(new Event('change'));
      var inputs = root.querySelectorAll('input[type="number"]');
      if (rangeMatch && inputs.length >= 2) {
        inputs[0].value = rangeMatch[1];
        inputs[0].dispatchEvent(new Event('input'));
        inputs[1].value = rangeMatch[2];
        inputs[1].dispatchEvent(new Event('input'));
      }
    }

    if (hash.indexOf('diag') !== -1) {
      var diag = root.querySelector('.aice-diag');
      if (diag) diag.open = true;
    }

    panel.toggle(true);
    return true;
  }

  var attempts = 0;
  (function wait() {
    if (apply() || ++attempts > 80) return;
    window.setTimeout(wait, 25);
  })();
})();
