/* ═══════════════════════════════════════════════════════════════
   RECALL AI — content.js
   
   APPROACH: XHR/Fetch interception (network-level capture)
   ─────────────────────────────────────────────────────────────
   Instead of guessing CSS selectors (which break every time
   ChatGPT/Gemini/Claude update their UI), we intercept the
   actual network requests the page makes when the user submits
   a prompt. This is 100% reliable regardless of UI changes.
   
   HOW IT WORKS:
   1. We inject a tiny script into the page context that wraps
      window.fetch and XMLHttpRequest BEFORE the page loads them.
   2. When Gemini/Claude/ChatGPT send a prompt, they call fetch()
      to their own API. We read the request body, extract the
      prompt text, and postMessage it to the content script.
   3. Content script receives it and sends to background.js.
   4. CSS selector strategies are kept as BACKUP for cases where
      network interception misses something.
   
   PLATFORMS:
   • ChatGPT  — POST to /backend-api/conversation
   • Gemini   — POST to /api/generate or /_/BardChatUi/data/
   • Claude   — POST to /api/organizations/.../messages
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

function isDuplicateQuery(q) {
  if (!q || q.length < 3) return true;
  if (q === lastQuery && Date.now() - lastQueryTime < 8000) return true;
  return false;
}

function markQuery(q) {
  lastQuery     = q;
  lastQueryTime = Date.now();
}

/* ── Send to background ──────────────────────────────────────── */
function saveQuery(query) {
  if (isDuplicateQuery(query)) return;
  markQuery(query);
  console.log(`[Recall AI] ✅ CAPTURED from ${SOURCE}: "${query.substring(0,80)}"`);
  chrome.runtime.sendMessage({
    type:    'RECALL_SAVE_QUERY',
    query:   query.trim(),
    source:  SOURCE,
    content: ''   // response content added later via DOM poll
  }, (r) => {
    if (chrome.runtime.lastError) return;
    if (r && r.ok) console.log(`[Recall AI] ✓ Saved (${r.tag})`);
  });
}

/* ══════════════════════════════════════════════════════════════
   NETWORK INTERCEPTOR — injected into PAGE context
   (content scripts can't wrap fetch/XHR directly because they
    run in an isolated world; we inject a <script> tag to get
    into the main page context where fetch/XHR live)
══════════════════════════════════════════════════════════════ */
function injectNetworkInterceptor() {
  const script = document.createElement('script');
  script.id = '__recallai_interceptor__';
  script.textContent = `
(function() {
  if (window.__recallai_injected__) return;
  window.__recallai_injected__ = true;

  const HOST = location.hostname;

  /* ── Which URLs carry the user prompt ── */
  function isPromptRequest(url) {
    if (!url) return false;
    // ChatGPT
    if (url.includes('/backend-api/conversation')) return true;
    // Gemini (multiple endpoint patterns)
    if (url.includes('generativelanguage.googleapis.com')) return true;
    if (url.includes('/_/BardChatUi/data/assistant.lamda.BardFrontendService')) return true;
    if (url.includes('/api/generate')) return true;
    if (url.includes('bard.google.com')) return true;
    if (url.includes('gemini.google.com') && url.includes('StreamGenerate')) return true;
    // Claude
    if (url.includes('/api/') && url.includes('/messages')) return true;
    if (url.includes('claude.ai/api')) return true;
    // Perplexity
    if (url.includes('perplexity.ai') && (url.includes('/socket') || url.includes('/search'))) return true;
    return false;
  }

  /* ── Extract prompt text from request body ── */
  function extractPrompt(url, bodyText) {
    if (!bodyText || typeof bodyText !== 'string') return null;
    try {
      // ── ChatGPT ──────────────────────────────
      if (url.includes('/backend-api/conversation')) {
        const parsed = JSON.parse(bodyText);
        const messages = parsed.messages || [];
        for (const msg of messages) {
          if (msg.author?.role === 'user' || msg.role === 'user') {
            const parts = msg.content?.parts || msg.content || [];
            if (Array.isArray(parts)) {
              const text = parts.filter(p => typeof p === 'string').join(' ').trim();
              if (text.length > 2) return text;
            }
            if (typeof msg.content === 'string' && msg.content.length > 2) {
              return msg.content.trim();
            }
          }
        }
      }
      
      // ── Claude ───────────────────────────────
      if (url.includes('/messages') || url.includes('claude.ai')) {
        const parsed = JSON.parse(bodyText);
        const messages = parsed.messages || [];
        // Take the last user message
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === 'user') {
            if (typeof msg.content === 'string' && msg.content.length > 2) {
              return msg.content.trim();
            }
            if (Array.isArray(msg.content)) {
              const text = msg.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join(' ').trim();
              if (text.length > 2) return text;
            }
          }
        }
        // Also check top-level prompt field
        if (parsed.prompt && typeof parsed.prompt === 'string') {
          return parsed.prompt.trim();
        }
      }

      // ── Gemini ───────────────────────────────
      // Gemini sends data in a protobuf-like or JSON format
      if (url.includes('gemini') || url.includes('bard') || url.includes('BardFrontendService') || url.includes('generativelanguage')) {
        // Try JSON parse first
        try {
          const parsed = JSON.parse(bodyText);
          // Look for contents / parts / text structure (Gemini API format)
          const contents = parsed.contents || parsed.messages || [];
          for (let i = contents.length - 1; i >= 0; i--) {
            const c = contents[i];
            if (c.role === 'user' || !c.role) {
              const parts = c.parts || [];
              for (const p of parts) {
                if (p.text && p.text.length > 2) return p.text.trim();
              }
            }
          }
          // prompt field
          if (parsed.prompt) {
            if (typeof parsed.prompt === 'string') return parsed.prompt.trim();
            if (parsed.prompt.text) return parsed.prompt.text.trim();
          }
          // input field
          if (parsed.input && typeof parsed.input === 'string') return parsed.input.trim();
        } catch(e) {}
        
        // Gemini web app sends URL-encoded or nested array format
        // The user text is typically in a long nested array
        // We search for any string > 10 chars that looks like a prompt
        // by finding the first long quoted string in the body
        const rawMatches = bodyText.match(/"([^"]{10,500})"/g);
        if (rawMatches) {
          for (const m of rawMatches) {
            const text = m.slice(1, -1).trim();
            // Skip technical strings (URLs, tokens, IDs)
            if (text.startsWith('http') || text.startsWith('eyJ') || text.includes('\\n\\n\\n')) continue;
            if (text.length > 8 && /[a-zA-Z]/.test(text)) return text;
          }
        }
      }
      
    } catch (e) {}
    return null;
  }

  /* ── Wrap fetch ── */
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = (typeof input === 'string' ? input : input?.url) || '';
    if (isPromptRequest(url) && init?.body) {
      let bodyText = init.body;
      if (bodyText instanceof ReadableStream) {
        // Can't easily read streams here — fall through to DOM strategy
      } else {
        if (typeof bodyText !== 'string') {
          try { bodyText = new TextDecoder().decode(bodyText); } catch(e) {}
        }
        const prompt = extractPrompt(url, bodyText);
        if (prompt) {
          window.postMessage({ __recallai: true, prompt, source: HOST }, '*');
        }
      }
    }
    return origFetch.apply(this, arguments);
  };

  /* ── Wrap XHR ── */
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__recallUrl = url;
    return origOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const url = this.__recallUrl || '';
    if (isPromptRequest(url) && body) {
      let bodyText = body;
      if (typeof bodyText !== 'string') {
        try { bodyText = new TextDecoder().decode(bodyText); } catch(e) {}
      }
      const prompt = extractPrompt(url, bodyText);
      if (prompt) {
        window.postMessage({ __recallai: true, prompt, source: location.hostname }, '*');
      }
    }
    return origSend.apply(this, arguments);
  };

  console.log('[Recall AI] 🔌 Network interceptor active on', HOST);
})();
  `;

  // Inject BEFORE page scripts run
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // clean up DOM after injection
}

/* ── Listen for postMessage from injected script ─────────────── */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || !event.data.__recallai) return;
  const prompt = (event.data.prompt || '').trim();
  if (prompt.length < 3) return;
  saveQuery(prompt);
});

/* ══════════════════════════════════════════════════════════════
   BACKUP STRATEGY — CSS selector approach
   Used as a fallback when network interception doesn't fire
   (e.g. the platform uses WebSocket or streaming that's hard
   to intercept). We watch for new user-turn DOM nodes appearing.
══════════════════════════════════════════════════════════════ */

/* Selectors for user message turns (not input box — the rendered message) */
const USER_TURN_SELECTORS = {
  ChatGPT:    '[data-message-author-role="user"] .whitespace-pre-wrap, [data-message-author-role="user"] p',
  Gemini:     'user-query p, user-query span, .query-text p, .query-text span, [data-role="user"] p, .user-prompt-container p',
  Claude:     '[data-testid="user-message"] p, [data-testid="user-message"]',
  Perplexity: '[data-testid="user-message"] p',
  Copilot:    'cib-message[source="user"] p',
  'Meta AI':  '[data-testid="user-message"] p',
  Grok:       '[data-testid="user-message"] p'
};

function attachDOMObserver() {
  const sel = USER_TURN_SELECTORS[SOURCE];
  if (!sel) return;

  const knownTurns = new Set();

  // Seed existing turns (from prior conversation in the page)
  document.querySelectorAll(sel).forEach(el => knownTurns.add(el));

  const observer = new MutationObserver(() => {
    document.querySelectorAll(sel).forEach(el => {
      if (knownTurns.has(el)) return;
      knownTurns.add(el);
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 3) {
        console.log(`[Recall AI] 🔍 DOM observer caught: "${text.substring(0,60)}"`);
        saveQuery(text);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`[Recall AI] 👁 DOM observer watching for: ${sel}`);
}

/* ══════════════════════════════════════════════════════════════
   BACKUP STRATEGY 2 — keyboard Enter key capture
   Reads the input box text on Enter before platform clears it.
══════════════════════════════════════════════════════════════ */

/* Input box selectors — used ONLY to read text on Enter/click */
const INPUT_SELECTORS = {
  ChatGPT:    '#prompt-textarea, div[contenteditable="true"].ProseMirror',
  Gemini:     'rich-textarea p[contenteditable="true"], rich-textarea div[contenteditable="true"], div[contenteditable="true"]',
  Claude:     'div[contenteditable="true"].ProseMirror, fieldset div[contenteditable="true"]',
  Perplexity: 'textarea[placeholder*="Ask"], textarea',
  Copilot:    'textarea, div[contenteditable="true"][role="textbox"]',
  'Meta AI':  'div[contenteditable="true"][role="textbox"]',
  Grok:       'textarea'
};

/* Send button selectors */
const SEND_BTN_SELECTORS = {
  ChatGPT:    'button[data-testid="send-button"], button[aria-label="Send message"], button[aria-label="Send prompt"]',
  Gemini:     'button[aria-label="Send message"], button.send-button',
  Claude:     'button[aria-label="Send Message"], button[data-testid="send-button"]',
  Perplexity: 'button[aria-label="Submit"], button[type="submit"]',
  Copilot:    'button[aria-label="Submit"], button[aria-label="Send"]',
  'Meta AI':  'button[aria-label="Send message"]',
  Grok:       'button[aria-label="Send"]'
};

let inputSnapshot = '';

function findInputEl() {
  const sel = INPUT_SELECTORS[SOURCE] || '';
  for (const s of sel.split(',').map(x => x.trim())) {
    try {
      const el = document.querySelector(s);
      if (el) return el;
    } catch(e) {}
  }
  return null;
}

function readInputText() {
  const el = findInputEl();
  if (!el) return inputSnapshot;
  const live = el.isContentEditable ? (el.innerText || '').trim() : (el.value || '').trim();
  return (live.length > 2) ? live : inputSnapshot;
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
      // Small delay — let network interceptor fire first; DOM fallback handles the rest
      setTimeout(() => saveQuery(inputSnapshot), 200);
    }
  }, true);
}

function attachSendButtonCapture() {
  const sel = SEND_BTN_SELECTORS[SOURCE] || '';
  if (!sel) return;

  function tryAttach() {
    sel.split(',').map(s => s.trim()).forEach(s => {
      let btns;
      try { btns = document.querySelectorAll(s); } catch(e) { return; }
      btns.forEach(btn => {
        if (btn.__recall_sb) return;
        btn.__recall_sb = true;

        // Snapshot BEFORE click (mousedown fires before click)
        btn.addEventListener('mousedown', () => {
          const text = readInputText();
          if (text.length > 2) inputSnapshot = text;
        }, true);

        btn.addEventListener('click', () => {
          const text = readInputText();
          if (text.length > 2) {
            setTimeout(() => saveQuery(text), 200);
          }
        }, true);
      });
    });
  }

  tryAttach();
  setInterval(tryAttach, 2000);
}

/* ── Ping handler ────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RECALL_PING') {
    sendResponse({ ok: true, source: SOURCE });
  }
});

/* ── Init ────────────────────────────────────────────────────── */
function init() {
  if (isInitialized) return;
  isInitialized = true;

  console.log(`[Recall AI] 🚀 Starting on ${SOURCE} (${location.hostname})`);

  // PRIMARY: network interception (most reliable)
  injectNetworkInterceptor();

  // BACKUPS: DOM + keyboard (catch anything network missed)
  attachDOMObserver();
  attachKeyboardCapture();
  attachSendButtonCapture();
}

if (document.readyState === 'loading') {
  // Inject interceptor as early as possible
  injectNetworkInterceptor();
  document.addEventListener('DOMContentLoaded', () => {
    isInitialized = false; // reset so init() runs properly
    init();
  });
} else {
  init();
}

/* ── Re-init on SPA navigation ───────────────────────────────── */
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl       = location.href;
    isInitialized = false;
    inputSnapshot = '';
    setTimeout(init, 1200);
  }
}).observe(document, { subtree: true, childList: true });
