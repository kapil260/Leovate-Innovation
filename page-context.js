/* ═══════════════════════════════════════════════════════════════
   RECALL AI — page-context.js   (world: "MAIN")

   WHY THIS FILE EXISTS
   ─────────────────────
   Content scripts run in an "isolated world" — they share the DOM
   but NOT the page's JavaScript environment. That means a content
   script cannot wrap window.fetch or XMLHttpRequest because it gets
   its OWN copies, not the ones the page actually calls.

   The previous approach (content.js injecting a <script> tag with
   inline code) is silently blocked by the strict Content-Security-
   Policy headers that ChatGPT, Claude, and Gemini all send:
       content-security-policy: script-src 'self' ...  (no unsafe-inline)
   Chrome refuses to run the injected tag, so the interceptor never
   activates and ZERO prompts are captured on Claude / Gemini.

   THE FIX
   ────────
   Register this file in manifest.json as a SECOND content_scripts
   entry with  "world": "MAIN".  Chrome injects it straight into the
   page's own JS context — no CSP restriction applies to extension-
   registered scripts.  It wraps fetch/XHR before the page can use
   them and postMessages every captured prompt to content.js.

   PLATFORMS HANDLED
   ─────────────────
   • ChatGPT  — POST /backend-api/conversation  (JSON body)
   • Claude   — POST claude.ai/api/…/completion or …/messages
   • Gemini   — POST /_/BardChatUi/data/… (f.req= encoded)
                POST generativelanguage.googleapis.com (JSON)
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (window.__recallai_injected__) return;
  window.__recallai_injected__ = true;

  const HOST = location.hostname;

  /* ─────────────────────────────────────────────────────────────
     1.  URL MATCHER
     Which network requests carry a user prompt?
  ───────────────────────────────────────────────────────────── */
  function isPromptRequest(url) {
    if (!url || typeof url !== 'string') return false;

    // ChatGPT
    if (url.includes('/backend-api/conversation')) return true;
    if (url.includes('/backend-api/f/'))           return true;   // newer route

    // Claude  (matches /completion and /messages under any org/project path)
    if (HOST.includes('claude.ai') && url.includes('/api/')) return true;
    if (url.includes('claude.ai/api'))                        return true;

    // Gemini web app
    if (url.includes('/_/BardChatUi/data/'))               return true;
    if (url.includes('bard.google.com'))                    return true;
    if (url.includes('BardFrontendService'))                return true;
    // Gemini API / AI Studio
    if (url.includes('generativelanguage.googleapis.com')) return true;
    if (HOST.includes('gemini.google.com') && (
          url.includes('StreamGenerate') ||
          url.includes('rich_text') ||
          url.includes('/api/generate')
       )) return true;

    // Perplexity (bonus)
    if (url.includes('perplexity.ai') &&
        (url.includes('/socket') || url.includes('/search'))) return true;

    return false;
  }

  /* ─────────────────────────────────────────────────────────────
     2.  BODY READER
     Converts any body type to a plain string we can parse.
  ───────────────────────────────────────────────────────────── */
  function bodyToString(body) {
    if (!body) return null;
    if (typeof body === 'string')         return body;
    if (body instanceof URLSearchParams)  return body.toString();
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      try { return new TextDecoder().decode(body); } catch (_) { return null; }
    }
    return null; // ReadableStream handled separately — see readStreamBody()
  }

  /* Reads a ReadableStream body without consuming the original request.
     IMPORTANT: this only ever runs on a CLONE of the Request, never on
     the real one — cloning preserves the original body so the actual
     network call the page makes is completely unaffected. This is the
     fix for requests built as `new Request(url, { body, ... })` objects
     (common on Claude's web app), where `init.body` is empty and the
     only place the text lives is `input.body`, which the Fetch spec
     always exposes as a ReadableStream rather than a plain string —
     the old code saw that and gave up immediately. */
  async function readStreamBody(requestLike) {
    try {
      const clone = requestLike.clone();
      return await clone.text();
    } catch (_) {
      return null;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     3.  PROMPT EXTRACTOR
     Pulls the user's text out of the parsed request body.
  ───────────────────────────────────────────────────────────── */
  function extractPrompt(url, bodyText) {
    if (!bodyText || typeof bodyText !== 'string') return null;

    try {

      /* ── ChatGPT ──────────────────────────────────────────── */
      if (url.includes('/backend-api/conversation') ||
          url.includes('/backend-api/f/')) {
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
        return null;
      }

      /* ── Claude ───────────────────────────────────────────── */
      if (HOST.includes('claude.ai') ||
          (url.includes('/api/') && (
            url.includes('/completion') ||
            url.includes('/messages') ||
            url.includes('/chat_conversations')
          ))) {
        const parsed = JSON.parse(bodyText);

        // /completion format  →  "prompt": "\n\nHuman: <text>\n\nAssistant:"
        if (parsed.prompt && typeof parsed.prompt === 'string') {
          const matches = parsed.prompt.match(/\n\nHuman:\s*([\s\S]*?)(?:\n\nAssistant:|$)/g);
          if (matches && matches.length > 0) {
            const last = matches[matches.length - 1]
              .replace(/\n\nHuman:\s*/i, '')
              .replace(/\n\nAssistant:.*$/i, '')
              .trim();
            if (last.length > 2) return last;
          }
          const raw = parsed.prompt.trim();
          if (raw.length > 2) return raw;
        }

        // /messages format  →  messages: [{role:"user", content:"…"}]
        const messages = parsed.messages || [];
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
                .join(' ')
                .trim();
              if (text.length > 2) return text;
            }
          }
        }
        return null;
      }

      /* ── Gemini ───────────────────────────────────────────── */
      if (url.includes('gemini') || url.includes('bard') ||
          url.includes('BardFrontendService') ||
          url.includes('generativelanguage')) {

        // Decode f.req= URL-encoded body (Gemini web app)
        let decoded = bodyText;
        if (bodyText.includes('f.req=')) {
          try {
            const m = bodyText.match(/f\.req=([^&]+)/);
            if (m) decoded = decodeURIComponent(m[1]);
          } catch (_) { /* keep original */ }
        }

        // Attempt 1: structured JSON  (Gemini API / newer web)
        try {
          const parsed = JSON.parse(decoded);
          const contents = parsed.contents || parsed.messages || [];
          for (let i = contents.length - 1; i >= 0; i--) {
            const c = contents[i];
            if (c.role === 'user' || !c.role) {
              for (const p of (c.parts || [])) {
                if (p.text && p.text.length > 2) return p.text.trim();
              }
            }
          }
          if (parsed.prompt) {
            if (typeof parsed.prompt === 'string' && parsed.prompt.length > 2)
              return parsed.prompt.trim();
            if (parsed.prompt.text && parsed.prompt.text.length > 2)
              return parsed.prompt.text.trim();
          }
          if (parsed.input && typeof parsed.input === 'string' && parsed.input.length > 2)
            return parsed.input.trim();
        } catch (_) { /* not clean JSON */ }

        // Attempt 2: string scan of f.req nested arrays.
        // We look for the SHORTEST real-text string that isn't a URL / hash /
        // base64 blob and doesn't start with a known AI-response opener.
        // (AI replies are long; user questions are shorter.)
        try {
          const AI_OPENERS = [
            'you said','as i ','sure,','sure!','of course','here is',
            'here are','let me','great question','innovation is',
            'the following','based on','according to','in summary',
            'to summarize','certainly,',
          ];
          const candidates = [];
          const RE = /"((?:[^"\\]|\\.)*)"/g;
          let m;
          while ((m = RE.exec(decoded)) !== null) {
            try {
              const val = JSON.parse('"' + m[1] + '"');
              if (typeof val !== 'string' || val.length < 5) continue;
              if (val.startsWith('http') || val.startsWith('data:')) continue;
              if (/^[A-Za-z0-9+/]{40,}={0,2}$/.test(val))          continue; // base64
              if (/^[a-f0-9-]{32,}$/i.test(val))                    continue; // UUID/hash
              if (!/[a-zA-Z]/.test(val) || !val.includes(' '))      continue; // needs real words
              if (val.length > 1000)                                 continue; // too long
              const lo = val.toLowerCase().trimStart();
              if (AI_OPENERS.some(p => lo.startsWith(p)))           continue;
              candidates.push(val);
            } catch (_) { /* unparseable escape — skip */ }
          }
          if (candidates.length > 0) {
            candidates.sort((a, b) => a.length - b.length); // shortest = user question
            return candidates[0].trim();
          }
        } catch (_) { /* give up */ }
      }

    } catch (_) { /* outer safety net */ }
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
     4.  EMIT
     Send captured prompt to content.js via postMessage.
  ───────────────────────────────────────────────────────────── */
  function emit(prompt, source) {
    if (!prompt || prompt.length < 3) return;
    window.postMessage({ __recallai: true, prompt: prompt.trim(), source }, '*');
  }

  /* ─────────────────────────────────────────────────────────────
     5.  WRAP fetch
  ───────────────────────────────────────────────────────────── */
  const _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = (input instanceof Request ? input.url : String(input || ''));
      if (isPromptRequest(url)) {
        // Body may be on init (plain string — the common case) OR baked
        // into the Request object itself (e.g. `fetch(new Request(url, {body}))`,
        // which some of Claude's web app code paths use). In the Request
        // case the spec only exposes the body as a ReadableStream, which
        // needs to be read asynchronously via .clone().text() — done in
        // readStreamBody() below WITHOUT touching the original request,
        // so the real network call is never affected either way.
        const rawBody = (init && init.body != null) ? init.body : null;
        const bodyText = bodyToString(rawBody);

        if (bodyText) {
          const prompt = extractPrompt(url, bodyText);
          if (prompt) emit(prompt, HOST);
        } else if (input instanceof Request) {
          // Fire-and-forget async read — does not block or delay the
          // real fetch happening below.
          readStreamBody(input).then((text) => {
            if (!text) return;
            const prompt = extractPrompt(url, text);
            if (prompt) emit(prompt, HOST);
          });
        }
      }
    } catch (_) { /* never break the page */ }
    return _origFetch(input, init);
  };

  /* ─────────────────────────────────────────────────────────────
     6.  WRAP XMLHttpRequest
  ───────────────────────────────────────────────────────────── */
  const _origOpen = XMLHttpRequest.prototype.open;
  const _origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__recallUrl = url ? String(url) : '';
    return _origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const url = this.__recallUrl || '';
      if (isPromptRequest(url) && body) {
        const bodyText = bodyToString(body);
        if (bodyText) {
          const prompt = extractPrompt(url, bodyText);
          if (prompt) emit(prompt, HOST);
        }
      }
    } catch (_) { /* never break the page */ }
    return _origSend.apply(this, arguments);
  };

  console.log('[Recall AI] ✅ page-context interceptor active on', HOST);
})();
