/* ═══════════════════════════════════════════════════════════════
   RECALL AI — background.js  v3  (Manifest V3 Service Worker)
   New in v3:
     ✅ Offline queue: saves captured queries when backend is down
     ✅ Perplexity, Microsoft Copilot, Meta AI, Grok support
     ✅ Sync queue on reconnect
     ✅ Export trigger handling
═══════════════════════════════════════════════════════════════ */

'use strict';

const BACKEND_URL = 'https://leovate-innovation-3.onrender.com';

/* ── Recent query cache (dedup within 60 seconds per query) ─── */
const recentlySaved = new Map();

function isDuplicate(query) {
  const key = query.toLowerCase().slice(0, 100);
  const lastSaved = recentlySaved.get(key);
  if (!lastSaved) return false;
  return (Date.now() - lastSaved) < 60_000;
}

function markSaved(query) {
  const key = query.toLowerCase().slice(0, 100);
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

/* ── Save query to backend ──────────────────────────────────── */
// `content` is the full AI response text captured from the page.
// Passing it to the backend lets Groq AI write a proper multi-paragraph
// summary of the actual response instead of just the query.
async function saveQuery(query, source, content = '') {
  if (!query || query.trim().length < 3) {
    return { ok: false, error: 'Query too short' };
  }

  if (isDuplicate(query)) {
    return { ok: false, error: 'Duplicate (already saved recently)' };
  }

  const stored = await chrome.storage.local.get(['recall_token']);
  const token  = stored.recall_token;

  if (!token) {
    return { ok: false, error: 'Not logged in' };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/searches/save`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query:   query.trim(),
        source:  source || 'Unknown',
        content: (content || '').trim()   // ← NEW: pass full response text
      })
    });

    if (response.status === 401) {
      await chrome.storage.local.remove(['recall_token', 'recall_user']);
      return { ok: false, error: 'Session expired — please log in again' };
    }

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      markSaved(query);
      console.log(`[Recall AI BG] Saved: "${query.substring(0, 60)}" (${source}) → ${data.search?.tag}`);

      // Flush any previously queued items now that backend is reachable
      flushQueue(token).catch(() => {});

      return { ok: true, tag: data.search?.tag || 'Other', id: data.search?.id };
    } else {
      return { ok: false, error: data.error || 'Server error' };
    }

  } catch (err) {
    // ── OFFLINE: queue the save for later ────────────────────
    console.warn(`[Recall AI BG] Backend unreachable — queuing: "${query.substring(0, 60)}"`);
    await addToQueue(query.trim(), source || 'Unknown', content || '');
    markSaved(query); // prevent dedup-spamming the queue
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
