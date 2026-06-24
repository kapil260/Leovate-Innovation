/* ═══════════════════════════════════════════════════════════════
   RECALL AI — background.js  v3  (Manifest V3 Service Worker)
   New in v3:
     ✅ Offline queue: saves captured queries when backend is down
     ✅ Perplexity, Microsoft Copilot, Meta AI, Grok support
     ✅ Sync queue on reconnect
     ✅ Export trigger handling
═══════════════════════════════════════════════════════════════ */

'use strict';

const BACKEND_URL = 'http://localhost:5000';

/* ── Recent query cache (dedup within 60 seconds, PER SOURCE) ──
   BUG FIX: the key previously did NOT include the source platform.
   That meant searching the same text on ChatGPT and then on Gemini
   within 60 seconds caused the SECOND platform's save to be silently
   dropped here as a "duplicate" — even though content.js correctly
   treats same-text-different-platform as two separate, valid saves.
   This was the root cause of "sometimes ChatGPT saves but Gemini
   doesn't, or vice versa." Including `source` in the key fixes it. */
const recentlySaved = new Map();

function dedupKey(query, source) {
  return (source || 'Unknown').toLowerCase() + '::' + query.toLowerCase().slice(0, 100);
}

function isDuplicate(query, source) {
  const key = dedupKey(query, source);
  const lastSaved = recentlySaved.get(key);
  if (!lastSaved) return false;
  return (Date.now() - lastSaved) < 60_000;
}

function markSaved(query, source) {
  const key = dedupKey(query, source);
  recentlySaved.set(key, Date.now());
  if (recentlySaved.size > 200) {
    const oldestKey = recentlySaved.keys().next().value;
    recentlySaved.delete(oldestKey);
  }
}

/* ── Offline queue helpers ──────────────────────────────────── */
async function getQueue() {
  const stored = await chrome.storage.local.get(['recall_offline_queue']);
  return stored.recall_offline_queue || [];
}

async function addToQueue(query, source, content = '') {
  const queue = await getQueue();
  queue.push({ query, source, content, capturedAt: new Date().toISOString() });
  // Keep max 200 items in queue
  const trimmed = queue.slice(-200);
  await chrome.storage.local.set({ recall_offline_queue: trimmed });
  console.log(`[Recall AI BG] Queued offline: "${query.substring(0, 60)}" (${source}). Queue size: ${trimmed.length}`);
}

async function flushQueue(token) {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[Recall AI BG] Flushing ${queue.length} offline-queued searches…`);
  const remaining = [];

  for (const item of queue) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/searches/save`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ query: item.query, source: item.source, content: item.content || '' })
      });
      if (response.ok) {
        console.log(`[Recall AI BG] ✅ Flushed: "${item.query.substring(0, 40)}"`);
      } else {
        remaining.push(item); // keep failed ones
      }
    } catch {
      remaining.push(item); // network still down, keep
    }
  }

  await chrome.storage.local.set({ recall_offline_queue: remaining });
  console.log(`[Recall AI BG] Flush complete. ${queue.length - remaining.length} synced, ${remaining.length} remaining.`);
}

/* ── fetch with timeout ─────────────────────────────────────────
   A slow/hanging response (e.g. the service worker was just woken
   up by Chrome and the network stack is still warming up) used to
   hang forever with no timeout, occasionally outliving the message
   port back to content.js — the save would then silently vanish
   with no error and no queue entry. A hard timeout turns that into
   a normal "treat as failed, queue it" case instead. */
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ── Save query to backend ──────────────────────────────────── */
// `content` is the full AI response text captured from the page.
// Passing it to the backend lets Groq AI write a proper multi-paragraph
// summary of the actual response instead of just the query.
//
// RELIABILITY FIX: this now retries once on a transient failure
// (timeout / network hiccup / worker just woke up) before falling
// back to the offline queue. This was the second cause of saves
// "randomly" not happening on one platform — a momentary delay
// right as the MV3 service worker spun back up from idle was being
// treated as a permanent failure on the first attempt.
async function saveQuery(query, source, content = '', _isRetry = false) {
  if (!query || query.trim().length < 3) {
    return { ok: false, error: 'Query too short' };
  }

  if (isDuplicate(query, source)) {
    return { ok: false, error: 'Duplicate (already saved recently)' };
  }

  const stored = await chrome.storage.local.get(['recall_token']);
  const token  = stored.recall_token;

  if (!token) {
    return { ok: false, error: 'Not logged in' };
  }

  try {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/searches/save`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query:   query.trim(),
        source:  source || 'Unknown',
        content: (content || '').trim()
      })
    }, 8000);

    if (response.status === 401) {
      await chrome.storage.local.remove(['recall_token', 'recall_user']);
      return { ok: false, error: 'Session expired — please log in again' };
    }

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      markSaved(query, source);
      console.log(`[Recall AI BG] Saved: "${query.substring(0, 60)}" (${source}) → ${data.search?.tag}`);

      // ── Increment recallUsage.searches in local storage ───────
      // subscription.js reads this to show live stats on the Usage page.
      chrome.storage.local.get(['recallUsage'], (stored) => {
        const usage = stored.recallUsage || { searches: 0, apiCalls: 0, storageMb: 0, exports: 0 };
        usage.searches  = (usage.searches  || 0) + 1;
        usage.apiCalls  = (usage.apiCalls  || 0) + 2;   // save + Gemini AI call
        usage.storageMb = (usage.storageMb || 0) + 0.008; // ~8 KB per entry
        chrome.storage.local.set({ recallUsage: usage });
      });

      // Flush any previously queued items now that backend is reachable
      flushQueue(token).catch(() => {});

      return { ok: true, tag: data.search?.tag || 'Other', id: data.search?.id };
    } else {
      return { ok: false, error: data.error || 'Server error' };
    }

  } catch (err) {
    // Timeout (AbortError) or network error.
    // Retry exactly once before giving up and queuing — covers the
    // common case where the service worker was waking up from idle
    // and the very first request stalled.
    if (!_isRetry) {
      console.warn(`[Recall AI BG] First attempt failed for "${query.substring(0, 40)}" (${source}) — retrying once…`);
      return saveQuery(query, source, content, true);
    }

    // ── OFFLINE: queue the save for later ────────────────────
    console.warn(`[Recall AI BG] Backend unreachable after retry — queuing: "${query.substring(0, 60)}" (${source})`);
    await addToQueue(query.trim(), source || 'Unknown', content || '');
    markSaved(query, source); // prevent dedup-spamming the queue
    return { ok: false, queued: true, error: 'Backend offline — saved to queue' };
  }
}

/* ── Export data ─────────────────────────────────────────────── */
async function triggerExport(format = 'json') {
  const stored = await chrome.storage.local.get(['recall_token']);
  const token  = stored.recall_token;
  if (!token) return { ok: false, error: 'Not logged in' };

  try {
    const response = await fetch(`${BACKEND_URL}/api/user/export?format=${format}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return { ok: false, error: 'Export failed' };

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `recall-ai-export-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    // ── Increment recallUsage.exports ─────────────────────────
    chrome.storage.local.get(['recallUsage'], (stored) => {
      const usage = stored.recallUsage || { searches: 0, apiCalls: 0, storageMb: 0, exports: 0 };
      usage.exports = (usage.exports || 0) + 1;
      chrome.storage.local.set({ recallUsage: usage });
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Network error' };
  }
}

/* ── On action icon click: open side panel ───────────────────── */
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'RECALL_SAVE_QUERY') {
    // msg.content is the full AI response text (may be empty for older clients)
    saveQuery(msg.query, msg.source, msg.content || '').then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (msg.type === 'RECALL_GET_STATUS') {
    chrome.storage.local.get(['recall_token', 'recall_user', 'recall_offline_queue']).then(stored => {
      const queue = stored.recall_offline_queue || [];
      sendResponse({
        loggedIn:     !!stored.recall_token,
        user:         stored.recall_user || null,
        queuedCount:  queue.length
      });
    });
    return true;
  }

  if (msg.type === 'RECALL_FLUSH_QUEUE') {
    chrome.storage.local.get(['recall_token']).then(async stored => {
      if (stored.recall_token) {
        await flushQueue(stored.recall_token);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Not logged in' });
      }
    });
    return true;
  }

  if (msg.type === 'RECALL_GET_QUEUE') {
    getQueue().then(queue => sendResponse({ queue }));
    return true;
  }

  if (msg.type === 'RECALL_LOGOUT') {
    chrome.storage.local.remove(['recall_token', 'recall_user']).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'RECALL_EXPORT') {
    triggerExport(msg.format || 'json').then(result => sendResponse(result));
    return true;
  }
});

/* ── On install: show onboarding ────────────────────────────── */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Show onboarding page instead of signup directly
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding-page/onboarding.html')
    });
  }
});

/* ── Periodic queue flush (every 5 minutes) ─────────────────── */
chrome.alarms.create('recallFlushQueue', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'recallFlushQueue') {
    const stored = await chrome.storage.local.get(['recall_token']);
    if (stored.recall_token) {
      const queue = await getQueue();
      if (queue.length > 0) {
        console.log(`[Recall AI BG] Periodic flush: ${queue.length} items in queue`);
        await flushQueue(stored.recall_token);
      }
    }
  }
});

console.log('[Recall AI] Background service worker v3 started ✓');
