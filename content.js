/* ═══════════════════════════════════════════════════════════════
   RECALL AI — content.js   (isolated world)

   This file runs in the extension's isolated world.
   It receives prompts captured by page-context.js (MAIN world)
   via postMessage, deduplicates them, validates them, and
   forwards them to background.js which saves them to the backend.

   DOM observer + keyboard/button listeners are kept as backups
   for cases where the network interceptor misses something.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Platform detection ──────────────────────────────────────── */
function getSource() {
  const h = location.hostname;
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'ChatGPT';
  if (h.includes('gemini.google.com'))  return 'Gemini';
  if (h.includes('claude.ai'))          return 'Claude';
  if (h.includes('perplexity.ai'))      return 'Perplexity';
  if (h.includes('copilot.microsoft.com') || h.includes('bing.com/chat')) return 'Copilot';
  if (h.includes('meta.ai'))            return 'Meta AI';
  if (h.includes('grok.x.ai') || (h.includes('x.com') && location.pathname.includes('grok'))) return 'Grok';
  return 'Unknown';
}

const SOURCE = getSource();

/* ── Dedup state ─────────────────────────────────────────────── */
let lastQuery     = '';
let lastQueryTime = 0;
let isInitialized = false;

// sessionStorage-backed dedup — survives SPA navigation.
// KEY CHANGE: the dedup key includes SOURCE so that the same prompt
// searched on ChatGPT and then on Gemini/Claude is saved separately.
// Each platform's capture is independent. We only deduplicate the
// exact same (text + platform) pair within 5 minutes, which prevents
// double-saves when both the network interceptor AND the DOM backup
// fire for the same submission on the same platform.
const _SS_KEY = '__recall_seen__';
const _SS_TTL = 5 * 60 * 1000; // 5 minutes

function _ssRead() {
  try { return JSON.parse(sessionStorage.getItem(_SS_KEY) || '{}'); } catch { return {}; }
}
function _ssWrite(obj) {
  try { sessionStorage.setItem(_SS_KEY, JSON.stringify(obj)); } catch {}
}

function isDuplicateQuery(q) {
  if (!q || q.length < 3) return true;

  // In-memory burst check: same text from the SAME source within 15 s.
  // (Gemini can fire both fetch and XHR interceptors for the same prompt.)
  if (q === lastQuery && Date.now() - lastQueryTime < 15000) return true;

  // Cross-navigation persistence — key includes SOURCE so the same text
  // on a different platform is NOT treated as a duplicate.
  const seen = _ssRead();
  const key  = SOURCE + ':' + q.toLowerCase().trim().slice(0, 120);
  if (seen[key] && Date.now() - seen[key] < _SS_TTL) return true;

  return false;
}

function markQuery(q) {
  lastQuery     = q;
  lastQueryTime = Date.now();
  const seen = _ssRead();
  const key  = SOURCE + ':' + q.toLowerCase().trim().slice(0, 120);
  seen[key]  = Date.now();
  // Evict expired entries to keep sessionStorage lean
  const now = Date.now();
  for (const k in seen) { if (now - seen[k] > _SS_TTL) delete seen[k]; }
  _ssWrite(seen);
}

/* ── Prompt quality gate ─────────────────────────────────────── */
// Only blocks strings that are clearly AI responses / system noise,
// NOT the user's own prompt text.
//
// IMPORTANT: the same user prompt searched on different platforms
// (ChatGPT, Gemini, Claude) must ALL be saved because the "Combine"
// feature depends on having all three versions to cross-summarise them.
//
// Rules:
//   ✅ ALLOW  — any real user question/instruction, any length
//   ✅ ALLOW  — same text sent to a different platform
//   ❌ BLOCK  — strings that start with "you said", "as I mentioned", etc.
//              (these are fragments of AI replies leaking through the
//               Gemini f.req body parser)
//   ❌ BLOCK  — strings shorter than 4 chars

const NOISE_PREFIXES = [
  'you said',
  'as i mentioned', 'as i said', 'i mentioned',
  'sure, here', 'sure! here',
  'of course,', 'certainly,',
  'here is a ', 'here are ',          // space prevents blocking "here is my question"
  'let me explain',
  'great question',
  'the following',
  'in summary,', 'in conclusion,',
  'to summarize', 'to sum up',
];

function isValidPrompt(q) {
  if (!q || q.length < 4) return false;
  // NO length cap — user prompts can be long (code, documents, detailed instructions)
  const lower = q.toLowerCase().trimStart();
  for (const prefix of NOISE_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }
  return true;
}

/* ── Send to background ──────────────────────────────────────── */
function saveQuery(query) {
  if (isDuplicateQuery(query)) return;
  if (!isValidPrompt(query)) {
    console.log(`[Recall AI] ⛔ Rejected noise: "${query.substring(0, 80)}"`);
    return;
  }
  markQuery(query);
  console.log(`[Recall AI] ✅ CAPTURED from ${SOURCE}: "${query.substring(0, 80)}"`);
  chrome.runtime.sendMessage({
    type:    'RECALL_SAVE_QUERY',
    query:   query.trim(),
    source:  SOURCE,
    content: ''
  }, (r) => {
    if (chrome.runtime.lastError) return;
    if (r && r.ok) console.log(`[Recall AI] ✓ Saved (${r.tag})`);
  });
}

/* ══════════════════════════════════════════════════════════════
   PRIMARY: postMessage from page-context.js
   page-context.js runs in MAIN world and wraps window.fetch /
   XMLHttpRequest at the page level (no CSP restriction).
   It postMessages every captured prompt here.
══════════════════════════════════════════════════════════════ */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || !event.data.__recallai) return;
  const prompt = (event.data.prompt || '').trim();
  if (prompt.length < 3) return;
  console.log(`[Recall AI] 📨 network capture: "${prompt.substring(0, 80)}"`);
  saveQuery(prompt);
});

/* ══════════════════════════════════════════════════════════════
   BACKUP A — DOM MutationObserver
   Watches for rendered user-turn elements appearing in the DOM.
   Safety net if the network interceptor misses a prompt.

   Dedup (15-second same-source window) prevents double-saves
   when both the network capture AND the DOM backup fire for
   the same submission.
══════════════════════════════════════════════════════════════ */
const USER_TURN_SELECTORS = {
  ChatGPT:    '[data-message-author-role="user"] .whitespace-pre-wrap, [data-message-author-role="user"] p',
  Gemini:     'user-query p, user-query span, .query-text p, .query-text span, [data-role="user"] p, .user-prompt-container p',
  Claude:     '[data-testid="user-message"] p, [data-testid="user-message"]',
  Perplexity: '[data-testid="user-message"] p',
  Copilot:    'cib-message[source="user"] p',
  'Meta AI':  '[data-testid="user-message"] p',
  Grok:       '[data-testid="user-message"] p',
};

function attachDOMObserver() {
  const sel = USER_TURN_SELECTORS[SOURCE];
  if (!sel) return;

  const knownTurns = new Set();
  // Seed with already-rendered turns so we don't re-capture history
  document.querySelectorAll(sel).forEach(el => knownTurns.add(el));

  const observer = new MutationObserver(() => {
    document.querySelectorAll(sel).forEach(el => {
      if (knownTurns.has(el)) return;
      knownTurns.add(el);
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 3) {
        console.log(`[Recall AI] 🔍 DOM backup: "${text.substring(0, 60)}"`);
        saveQuery(text);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`[Recall AI] 👁 DOM observer active (${SOURCE})`);
}

/* ══════════════════════════════════════════════════════════════
   BACKUP B — keyboard Enter + send-button capture
   Reads the input box text at the moment the user submits.
══════════════════════════════════════════════════════════════ */
const INPUT_SELECTORS = {
  ChatGPT:    '#prompt-textarea, div[contenteditable="true"].ProseMirror',
  Gemini:     'rich-textarea p[contenteditable="true"], rich-textarea div[contenteditable="true"], div[contenteditable="true"]',
  Claude:     'div[contenteditable="true"].ProseMirror, fieldset div[contenteditable="true"]',
  Perplexity: 'textarea[placeholder*="Ask"], textarea',
  Copilot:    'textarea, div[contenteditable="true"][role="textbox"]',
  'Meta AI':  'div[contenteditable="true"][role="textbox"]',
  Grok:       'textarea',
};

const SEND_BTN_SELECTORS = {
  ChatGPT:    'button[data-testid="send-button"], button[aria-label="Send message"], button[aria-label="Send prompt"]',
  Gemini:     'button[aria-label="Send message"], button.send-button',
  Claude:     'button[aria-label="Send Message"], button[data-testid="send-button"]',
  Perplexity: 'button[aria-label="Submit"], button[type="submit"]',
  Copilot:    'button[aria-label="Submit"], button[aria-label="Send"]',
  'Meta AI':  'button[aria-label="Send message"]',
  Grok:       'button[aria-label="Send"]',
};

let inputSnapshot = '';

function findInputEl() {
  const sel = INPUT_SELECTORS[SOURCE] || '';
  for (const s of sel.split(',').map(x => x.trim())) {
    try { const el = document.querySelector(s); if (el) return el; } catch (_) {}
  }
  return null;
}

function readInputText() {
  const el = findInputEl();
  if (!el) return inputSnapshot;
  const live = el.isContentEditable ? (el.innerText || '').trim() : (el.value || '').trim();
  return live.length > 2 ? live : inputSnapshot;
}

function attachKeyboardCapture() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = document.activeElement;
    if (!el) return;
    const isInput = el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
    if (!isInput) return;
    const text = el.isContentEditable ? (el.innerText || '').trim() : (el.value || '').trim();
    if (text.length > 2) {
      inputSnapshot = text;
      // Delay so the network interceptor fires first; dedup handles the rest
      setTimeout(() => saveQuery(inputSnapshot), 300);
    }
  }, true);
}

function attachSendButtonCapture() {
  const sel = SEND_BTN_SELECTORS[SOURCE] || '';
  if (!sel) return;

  function tryAttach() {
    sel.split(',').map(s => s.trim()).forEach(s => {
      let btns;
      try { btns = document.querySelectorAll(s); } catch (_) { return; }
      btns.forEach(btn => {
        if (btn.__recall_sb) return;
        btn.__recall_sb = true;
        btn.addEventListener('mousedown', () => {
          const t = readInputText();
          if (t.length > 2) inputSnapshot = t;
        }, true);
        btn.addEventListener('click', () => {
          const t = readInputText();
          if (t.length > 2) setTimeout(() => saveQuery(t), 300);
        }, true);
      });
    });
  }

  tryAttach();
  setInterval(tryAttach, 2000);
}

/* ── Ping handler ────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECALL_PING') sendResponse({ ok: true, source: SOURCE });
});

/* ── Init ────────────────────────────────────────────────────── */
function init() {
  if (isInitialized) return;
  isInitialized = true;
  console.log(`[Recall AI] 🚀 content.js active on ${SOURCE} (${location.hostname})`);
  attachDOMObserver();
  attachKeyboardCapture();
  attachSendButtonCapture();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ── Re-init on SPA navigation ───────────────────────────────── */
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl       = location.href;
    inputSnapshot = '';
    isInitialized = false;
    setTimeout(init, 1200);
  }
}).observe(document, { subtree: true, childList: true });
