/* ─────────────────────────────────────────
   RECALL AI — theme.js  (shared utility)
   Load this in every page's <head> BEFORE
   the page's own stylesheet to avoid FOUC.
   It reads the saved theme from storage and
   applies data-theme="light"|"dark" to <html>
   immediately, so the correct CSS variables
   are active before any content paints.
───────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'recall_settings';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  function loadAndApply() {
    try {
      // Chrome extension context
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
          try {
            var settings = JSON.parse(result[STORAGE_KEY] || '{}');
            applyTheme(settings.theme || 'dark');
          } catch (_) {
            applyTheme('dark');
          }
        });
      } else {
        // Web / dev server context
        var settings = {};
        try { settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) {}
        applyTheme(settings.theme || 'dark');
      }
    } catch (_) {
      applyTheme('dark');
    }
  }

  // Run immediately so theme is set before first paint
  loadAndApply();
})();
