/* ═══════════════════════════════════════════════════════════════
   RECALL AI — theme.js  (shared across ALL pages)
   Load this in every page's <head> BEFORE the page stylesheet.

   Handles:
   1. Dark / Light mode across all pages
   2. Custom accent color (user picks from swatches)
   3. Saves to chrome.storage so it persists permanently
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STORAGE_KEY = 'recall_settings';

  /* ── Preset accent colors ────────────────────────────────── */
  var ACCENT_PRESETS = {
    indigo:  { h: '239', s: '84%',  l: '67%' },
    violet:  { h: '258', s: '90%',  l: '66%' },
    blue:    { h: '217', s: '91%',  l: '60%' },
    cyan:    { h: '192', s: '82%',  l: '51%' },
    teal:    { h: '172', s: '66%',  l: '50%' },
    green:   { h: '142', s: '71%',  l: '45%' },
    emerald: { h: '152', s: '69%',  l: '46%' },
    lime:    { h: '84',  s: '81%',  l: '44%' },
    yellow:  { h: '45',  s: '93%',  l: '47%' },
    orange:  { h: '25',  s: '95%',  l: '53%' },
    red:     { h: '0',   s: '84%',  l: '60%' },
    rose:    { h: '351', s: '83%',  l: '62%' },
    pink:    { h: '330', s: '81%',  l: '60%' },
    fuchsia: { h: '292', s: '84%',  l: '61%' },
    gold:    { h: '38',  s: '92%',  l: '50%' },
    silver:  { h: '220', s: '14%',  l: '66%' },
  };

  /* ── Apply dark/light theme ──────────────────────────────── */
  function applyTheme(theme) {
    document.documentElement.setAttribute(
      'data-theme', theme === 'light' ? 'light' : 'dark'
    );
  }

  /* ── Apply accent color via CSS custom properties ────────── */
  function applyAccent(accentName, customHex) {
    var r = document.documentElement;

    if (customHex && /^#[0-9a-fA-F]{6}$/.test(customHex)) {
      // User picked a custom hex — convert to HSL
      var hsl = hexToHsl(customHex);
      r.style.setProperty('--accent-h', String(Math.round(hsl.h)));
      r.style.setProperty('--accent-s', Math.round(hsl.s) + '%');
      r.style.setProperty('--accent-l', Math.round(hsl.l) + '%');
    } else if (accentName && ACCENT_PRESETS[accentName]) {
      var p = ACCENT_PRESETS[accentName];
      r.style.setProperty('--accent-h', p.h);
      r.style.setProperty('--accent-s', p.s);
      r.style.setProperty('--accent-l', p.l);
    } else {
      // Default: indigo
      r.style.setProperty('--accent-h', '239');
      r.style.setProperty('--accent-s', '84%');
      r.style.setProperty('--accent-l', '67%');
    }
  }

  /* ── hex → HSL conversion ────────────────────────────────── */
  function hexToHsl(hex) {
    var r = parseInt(hex.slice(1,3),16)/255;
    var g = parseInt(hex.slice(3,5),16)/255;
    var b = parseInt(hex.slice(5,7),16)/255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b);
    var h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      var d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max) {
        case r: h = ((g-b)/d + (g<b?6:0))/6; break;
        case g: h = ((b-r)/d + 2)/6; break;
        default: h = ((r-g)/d + 4)/6;
      }
    }
    return { h: h*360, s: s*100, l: l*100 };
  }

  /* ── Load saved settings and apply ──────────────────────── */
  function loadAndApply() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
          try {
            var s = JSON.parse(result[STORAGE_KEY] || '{}');
            applyTheme(s.theme || 'dark');
            applyAccent(s.accentColor, s.accentHex);
          } catch (_) { applyTheme('dark'); applyAccent('indigo'); }
        });
      } else {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) {}
        applyTheme(s.theme || 'dark');
        applyAccent(s.accentColor, s.accentHex);
      }
    } catch (_) { applyTheme('dark'); applyAccent('indigo'); }
  }

  // Expose for setting.js to call after user changes
  window.__recallApplyTheme  = applyTheme;
  window.__recallApplyAccent = applyAccent;
  window.__recallAccentPresets = ACCENT_PRESETS;

  loadAndApply();
})();
