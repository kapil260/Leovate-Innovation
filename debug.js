'use strict';

const BACKEND_URL = 'https://leovate-innovation-3.onrender.com';

function row(label, value, cls) {
  return `<div class="row"><span class="label">${label}</span><span class="val ${cls||''}">${value}</span></div>`;
}

function log(msg, type) {
  const el = document.getElementById('log');
  const color = type === 'ok' ? '#10b981' : type === 'fail' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#e2e8f0';
  el.innerHTML += `<span style="color:${color}">${new Date().toLocaleTimeString()} ${msg}\n</span>`;
  el.scrollTop = el.scrollHeight;
}

/* ── 1. Auth Token ── */
async function checkAuth() {
  return new Promise(resolve => {
    chrome.storage.local.get(['recall_token', 'recall_user'], (s) => {
      const token = s.recall_token;
      const user  = (() => { try { return JSON.parse(s.recall_user || '{}'); } catch { return {}; } })();
      let html = '';
      if (token) {
        html += row('Token present', '✅ YES', 'ok');
        html += row('Token (first 40 chars)', token.substring(0, 40) + '...');
        html += row('User email', user.email || '(not stored)', user.email ? 'ok' : 'warn');
        html += row('User name', user.name || '(not stored)');
        // Decode JWT expiry
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = new Date(payload.exp * 1000);
          const expired = exp < new Date();
          html += row('Token expires', exp.toLocaleString(), expired ? 'fail' : 'ok');
          if (expired) html += row('⚠️ WARNING', 'TOKEN IS EXPIRED — you need to log in again', 'fail');
        } catch { html += row('Token expiry', 'Could not decode', 'warn'); }
      } else {
        html += row('Token present', '❌ NO TOKEN — not logged in', 'fail');
        html += row('Fix', 'You need to log in first via the extension login page', 'warn');
      }
      document.getElementById('authSection').innerHTML = html;
      resolve(token);
    });
  });
}

/* ── 2. Backend Health ── */
async function checkBackend(token) {
  const el = document.getElementById('backendSection');
  let html = '';
  try {
    const r = await fetch(`${BACKEND_URL}/api/ping`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      html += row('Server reachable', '✅ YES — localhost:5000 is running', 'ok');
    } else {
      html += row('Server reachable', `⚠️ Responded with status ${r.status}`, 'warn');
    }
  } catch (e) {
    html += row('Server reachable', '❌ CANNOT CONNECT to localhost:5000', 'fail');
    html += row('Fix', 'Run "node server.js" (or "npm start") inside your /backend folder', 'warn');
    html += row('Error', e.message);
    el.innerHTML = html;
    return false;
  }

  // Check auth endpoint
  if (token) {
    try {
      const r2 = await fetch(`${BACKEND_URL}/api/searches/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(4000)
      });
      if (r2.ok) {
        html += row('Auth works', '✅ Token accepted by backend', 'ok');
      } else if (r2.status === 401) {
        html += row('Auth works', '❌ 401 — Token rejected by backend', 'fail');
        html += row('Fix', 'Log out and log in again — token may be from a different JWT_SECRET', 'warn');
      } else {
        html += row('Auth works', `⚠️ Status ${r2.status}`, 'warn');
      }
    } catch (e) {
      html += row('Auth check', '❌ Error: ' + e.message, 'fail');
    }
  }

  el.innerHTML = html;
  return true;
}

/* ── 3. Saved Searches ── */
async function checkSearches(token) {
  const el = document.getElementById('searchesSection');
  if (!token) { el.innerHTML = row('Skipped', 'No token available', 'warn'); return; }
  let html = '';
  try {
    const r = await fetch(`${BACKEND_URL}/api/searches/`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (r.ok) {
      const d = await r.json();
      const count = d.searches?.length || 0;
      html += row('Total saved searches', count > 0 ? `✅ ${count} searches found` : '⚠️ 0 searches — nothing saved yet', count > 0 ? 'ok' : 'warn');
      if (count > 0) {
        const latest = d.searches[0];
        html += row('Latest search', `"${(latest.query||'').substring(0,60)}"`);
        html += row('Latest source', latest.source || 'unknown');
        html += row('Latest time', latest.timestamp ? new Date(latest.timestamp).toLocaleString() : 'unknown');
      } else {
        html += row('Hint', 'Go to ChatGPT/Claude/Gemini, type a prompt, then re-run this check', 'warn');
      }
    } else if (r.status === 401) {
      html += row('Searches fetch', '❌ 401 Unauthorized — log in again', 'fail');
    } else {
      html += row('Searches fetch', `❌ Error status ${r.status}`, 'fail');
    }
  } catch (e) {
    html += row('Searches fetch', '❌ ' + e.message, 'fail');
  }
  el.innerHTML = html;
}

/* ── 4. Offline Queue ── */
async function checkQueue() {
  return new Promise(resolve => {
    chrome.storage.local.get(['recall_offline_queue'], (s) => {
      const queue = s.recall_offline_queue || [];
      let html = '';
      if (queue.length === 0) {
        html += row('Queue size', '✅ Empty (nothing waiting to sync)', 'ok');
      } else {
        html += row('Queue size', `⚠️ ${queue.length} prompts waiting to be saved`, 'warn');
        html += row('Reason', 'Backend was unreachable when these were captured', 'warn');
        html += row('Fix', 'Start backend and click "Flush offline queue" button below', 'warn');
        queue.slice(0, 3).forEach((item, i) => {
          html += row(`Item ${i+1}`, `"${(item.query||'').substring(0,50)}" [${item.source}]`);
        });
        if (queue.length > 3) html += row('...', `and ${queue.length - 3} more`);
      }
      document.getElementById('queueSection').innerHTML = html;
      resolve(queue);
    });
  });
}

/* ── Test save ── */
async function testSave() {
  log('Sending test prompt to backend...', 'info');
  const token = await new Promise(r => chrome.storage.local.get(['recall_token'], s => r(s.recall_token)));
  if (!token) { log('❌ No token — log in first', 'fail'); return; }
  try {
    const r = await fetch(`${BACKEND_URL}/api/searches/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: 'Debug test prompt from Recall AI diagnostic tool', source: 'Debug', content: '' }),
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (r.ok) {
      log(`✅ Saved! Tag: ${d.search?.tag} | ID: ${d.search?.id}`, 'ok');
      log('Now check your dashboard/history — this should appear', 'ok');
    } else {
      log(`❌ Save failed: ${d.error}`, 'fail');
    }
  } catch (e) {
    log(`❌ Network error: ${e.message}`, 'fail');
    log('Make sure your backend (node server.js) is running', 'warn');
  }
}

/* ── Flush queue ── */
async function flushQueue() {
  log('Sending RECALL_FLUSH_QUEUE to background...', 'info');
  chrome.runtime.sendMessage({ type: 'RECALL_FLUSH_QUEUE' }, (r) => {
    if (chrome.runtime.lastError) {
      log('❌ ' + chrome.runtime.lastError.message, 'fail');
    } else if (r?.ok) {
      log('✅ Queue flushed successfully', 'ok');
    } else {
      log('❌ Flush failed: ' + (r?.error || 'unknown'), 'fail');
    }
  });
}

/* ── Run all checks ── */
async function runAll() {
  document.getElementById('authSection').textContent = 'Checking...';
  document.getElementById('backendSection').textContent = 'Checking...';
  document.getElementById('searchesSection').textContent = 'Checking...';
  document.getElementById('queueSection').textContent = 'Checking...';

  const token = await checkAuth();
  const backendOk = await checkBackend(token);
  if (backendOk) await checkSearches(token);
  else document.getElementById('searchesSection').innerHTML =
    '<div class="row"><span class="val warn">⚠️ Skipped — backend not reachable</span></div>';
  await checkQueue();
}

/* ── Buttons ── */
document.getElementById('testSave').addEventListener('click', testSave);
document.getElementById('flushQueue').addEventListener('click', flushQueue);
document.getElementById('recheck').addEventListener('click', runAll);
document.getElementById('clearToken').addEventListener('click', () => {
  chrome.storage.local.remove(['recall_token', 'recall_user'], () => {
    log('Token cleared. Reload the debug page.', 'warn');
    setTimeout(runAll, 500);
  });
});
document.getElementById('clearQueue').addEventListener('click', () => {
  chrome.storage.local.remove(['recall_offline_queue'], () => {
    log('Offline queue cleared.', 'warn');
    setTimeout(checkQueue, 300);
  });
});

// Auto-run on load
runAll();
