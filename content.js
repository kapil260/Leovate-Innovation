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

/* ── Conversation URL detection ──────────────────────────────────
   On a brand-new chat, the platform hasn't assigned a conversation
   ID to the address bar yet at the exact moment the prompt is
   submitted — grabbing location.href right away often captures the
   generic homepage instead of the real deep link. These patterns
   let us tell "this URL already points at a specific conversation"
   apart from "this is still the generic/new-chat URL".
   NOTE: platforms change their URL schemes without notice — if a
   button ever links to the wrong place, these patterns are the
   first thing to check and update. */
const CONVERSATION_URL_PATTERNS = {
  ChatGPT:     /\/c\/([a-zA-Z0-9:_-]+)/,        // https://chatgpt.com/c/<uuid>
  Claude:      /\/chat\/([a-zA-Z0-9:_-]+)/,     // https://claude.ai/chat/<uuid>
  Gemini:      /\/app\/([a-zA-Z0-9:_-]+)/,      // https://gemini.google.com/app/<id>
  Perplexity:  /\/search\/([a-zA-Z0-9:_-]+)/,   // https://www.perplexity.ai/search/<slug>
  Copilot:     /\/chats?\/([a-zA-Z0-9:_-]+)/,   // best-effort
  'Meta AI':   /\/c\/([a-zA-Z0-9:_-]+)/,        // best-effort
  Grok:        /\/(?:chat|c)\/([a-zA-Z0-9:_-]+)/, // best-effort
};

function looksLikeConversationUrl(url, source) {
  const pattern = CONVERSATION_URL_PATTERNS[source];
  if (!pattern) return true; // unknown platform — don't bother waiting

  const match = url.match(pattern);
  if (!match) return false;

  const idSegment = match[1] || '';
  // Some platforms (e.g. ChatGPT) briefly show a PLACEHOLDER id right
  // after sending — like "WEB:921d2962-fde0-4b92-903a-dfedf1d68c71" —
  // before swapping it for the real permanent conversation id a moment
  // later. Saving that placeholder produces a link that 404s / bounces
  // to a new chat when clicked later. A colon is the tell-tale sign of
  // this placeholder format, so we reject it and keep waiting.
  if (idSegment.includes(':')) return false;

  // Also reject anything too short to plausibly be a real conversation id.
  if (idSegment.replace(/[^a-zA-Z0-9]/g, '').length < 8) return false;

  return true;
}

// ── URL-change pub/sub ────────────────────────────────────────
// The bottom-of-file MutationObserver (search "Re-init on SPA
// navigation") already detects every SPA address-bar change, since
// it needs to re-run init() after one. Anything waiting on a real
// conversation URL subscribes here too, instead of relying only on
// a fixed polling window — this matters because Gemini in particular
// can take well over 8 seconds to assign a real conversation ID to
// the URL (it doesn't happen until the reply starts streaming), and
// the old fixed 8s timeout was giving up before that happened, which
// left "Open Original Conversation" pointing at the generic
// gemini.google.com/app homepage instead of the actual chat.
const _urlChangeSubscribers = new Set();
function _notifyUrlChange(newUrl) {
  for (const cb of _urlChangeSubscribers) cb(newUrl);
}

// Waits for the SPA to assign a real conversation URL — reacting
// immediately to address-bar changes (via the subscriber above) AND
// polling as a fallback, for up to `timeoutMs`. Gives up and returns
// whatever URL is current if the pattern never matches in time (still
// better than nothing — it'll just fall back to the homepage link in
// the UI). The generous default timeout is safe: this runs AFTER the
// prompt itself has already been saved, so a slow-to-appear URL only
// delays the follow-up enrichment, never the instant save the user sees.
function waitForConversationUrl(initialUrl, source, timeoutMs = 45000, intervalMs = 250) {
  return new Promise((resolve) => {
    let settled = false;
    const start = Date.now();

    function finish(url) {
      if (settled) return;
      settled = true;
      _urlChangeSubscribers.delete(onChange);
      resolve(url);
    }

    function tryUrl(current) {
      if (current !== initialUrl && looksLikeConversationUrl(current, source)) {
        finish(current);
      }
    }

    function onChange(newUrl) { tryUrl(newUrl); }
    _urlChangeSubscribers.add(onChange);

    (function poll() {
      if (settled) return;
      tryUrl(location.href);
      if (settled) return;
      if (Date.now() - start >= timeoutMs) {
        finish(location.href); // best-effort fallback
        return;
      }
      setTimeout(poll, intervalMs);
    })();
  });
}

/* ── Assistant response capture ──────────────────────────────────
   `content` is supposed to carry the AI's full reply text (see
   background.js / searchRoutes.js), but it was being hardcoded to ''
   below — nothing ever actually read it off the page. This section
   fills that in.

   There's no cross-platform "generation finished" event to hook into,
   so this uses a generic, best-effort heuristic: find the most recent
   assistant turn in the DOM, poll its rendered text, and treat it as
   "done" once the text stops changing for `quietMs`. A hard `maxWaitMs`
   cap guarantees we still save (with whatever we have, or '') even if
   a response never stabilizes.

   NOTE: like USER_TURN_SELECTORS / CONVERSATION_URL_PATTERNS above,
   these selectors are best-effort guesses at each platform's current
   markup and WILL need updating if a platform changes its UI. ChatGPT
   and Claude's selectors mirror the corresponding USER_TURN_SELECTORS
   pattern and are fairly stable; the rest are lower-confidence. */
const ASSISTANT_TURN_SELECTORS = {
  ChatGPT:    '[data-message-author-role="assistant"]',
  Gemini:     'model-response, message-content, .model-response-text, .markdown-main-panel',
  Claude:     '[data-testid="assistant-message"], .font-claude-message',
  Perplexity: '[data-testid="answer-mode-tabs"], .prose, [data-testid="answer"]',
  Copilot:    'cib-message[source="bot"] p',
  'Meta AI':  '[data-testid="assistant-message"]',
  Grok:       '[data-testid="assistant-message"]',
};

// Max total content chars kept (backend already caps embeddings input,
// this just avoids sending megabytes of a giant chat back and forth).
const MAX_CONTENT_CHARS = 12000;

function getLastAssistantText() {
  const sel = ASSISTANT_TURN_SELECTORS[SOURCE];
  if (!sel) return null;
  let nodes;
  try { nodes = document.querySelectorAll(sel); } catch (_) { return null; }
  if (!nodes || nodes.length === 0) return null;
  const el = nodes[nodes.length - 1];
  return (el.innerText || el.textContent || '').trim();
}

// Resolves with the assistant's reply text once it looks finished
// (unchanged for `quietMs`), or '' if nothing showed up / it never
// settles within `maxWaitMs`. Never rejects — a capture miss here
// should never block saving the prompt itself.
function captureAssistantResponse(maxWaitMs = 45000, quietMs = 1500, pollMs = 400) {
  return new Promise((resolve) => {
    if (!ASSISTANT_TURN_SELECTORS[SOURCE]) { resolve(''); return; }

    const start = Date.now();
    let lastText = '';
    let lastChangeAt = Date.now();
    let sawAnyText = false;

    (function poll() {
      const text = getLastAssistantText() || '';
      if (text !== lastText) {
        lastText = text;
        lastChangeAt = Date.now();
        if (text.length > 0) sawAnyText = true;
      }

      const quietFor = Date.now() - lastChangeAt;
      const elapsed  = Date.now() - start;

      if ((sawAnyText && quietFor >= quietMs) || elapsed >= maxWaitMs) {
        resolve(lastText.substring(0, MAX_CONTENT_CHARS));
        return;
      }
      setTimeout(poll, pollMs);
    })();
  });
}

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
// Returns a Promise so callers can chain the follow-up enrich step.
function sendSavedQuery(query, url, content = '') {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type:    'RECALL_SAVE_QUERY',
      query:   query.trim(),
      source:  SOURCE,
      content: (content || '').trim(),
      // The exact page URL the prompt was submitted on — lets the
      // History/Dashboard UI send the user back to the original
      // conversation on the AI platform instead of just the summary.
      url:     url
    }, (r) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      if (r && r.ok) console.log(`[Recall AI] ✓ Saved instantly (${r.tag})`);
      resolve(r || null);
    });
  });
}

// Follow-up call once we have the full assistant reply / final URL —
// updates the row that was already saved instead of blocking the
// original save on it.
function sendEnrichUpdate(id, finalUrl, content) {
  if (!id) return;
  chrome.runtime.sendMessage({
    type:    'RECALL_UPDATE_QUERY',
    id:      id,
    content: (content || '').trim(),
    url:     finalUrl || ''
  }, (r) => {
    if (chrome.runtime.lastError) return;
    if (r && r.ok) console.log(`[Recall AI] ✓ Enriched with full response (${SOURCE})`);
  });
}

function saveQuery(query) {
  if (isDuplicateQuery(query)) return;
  if (!isValidPrompt(query)) {
    console.log(`[Recall AI] ⛔ Rejected noise: "${query.substring(0, 80)}"`);
    return;
  }
  markQuery(query);
  console.log(`[Recall AI] ✅ CAPTURED from ${SOURCE}: "${query.substring(0, 80)}"`);

  const initialUrl = location.href;

  // ── INSTANT SAVE ─────────────────────────────────────────────
  // Save the prompt itself immediately — the user should see it show
  // up in their history right away instead of waiting for the AI's
  // reply to finish rendering (which can take anywhere from a couple
  // seconds to 45s). The conversation URL and full response text are
  // enriched onto this same row a moment later, in the background.
  sendSavedQuery(query, initialUrl, '').then((saveResult) => {
    const id = saveResult && saveResult.id;

    // If the save itself failed (offline/queued/not logged in) there's
    // no row to enrich yet — skip the follow-up rather than send an
    // update for an id that doesn't exist.
    if (!saveResult || !saveResult.ok || !id) return;

    // In parallel (does NOT delay the save above): wait for the SPA to
    // assign the real conversation URL (if this was a brand-new chat),
    // then wait (in parallel, not sequentially — same walltime as the
    // slower of the two, not their sum) for the assistant's reply to
    // finish, then enrich.
    const urlPromise = looksLikeConversationUrl(initialUrl, SOURCE)
      ? Promise.resolve(initialUrl)
      : waitForConversationUrl(initialUrl, SOURCE);

    Promise.all([urlPromise, captureAssistantResponse()]).then(([finalUrl, content]) => {
      // Only bother with the follow-up if we actually got something
      // new to add (a resolved URL different from what was already
      // saved, or non-empty response content).
      if (content || (finalUrl && finalUrl !== initialUrl)) {
        sendEnrichUpdate(id, finalUrl, content);
      }
    });
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
    _notifyUrlChange(lastUrl); // wake up any pending waitForConversationUrl()
    setTimeout(init, 1200);
  }
}).observe(document, { subtree: true, childList: true });
