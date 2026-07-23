/* ─────────────────────────────────────────
   RECALL AI — dashboard.js
   Fixed: uses chrome.storage.local
───────────────────────────────────────── */
'use strict';

const BACKEND_URL = 'http://localhost:5000';

const API = {
  history: `${BACKEND_URL}/api/searches/`,
  stats:   `${BACKEND_URL}/api/searches/stats`,
  insight: `${BACKEND_URL}/api/searches/insight`,
  search:  `${BACKEND_URL}/api/searches/?q=`,
  semanticSearch: `${BACKEND_URL}/api/searches/semantic-search?q=`,
};

/* ── AUTH (chrome.storage.local) ────────── */
async function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get(['recall_token'], r => resolve(r.recall_token || null));
  });
}

async function getUser() {
  return new Promise(resolve => {
    chrome.storage.local.get(['recall_user'], r => {
      try { resolve(JSON.parse(r.recall_user || '{}')); }
      catch { resolve({}); }
    });
  });
}

async function authHeaders() {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function checkAuth() {
  const token = await getToken();
  if (!token) window.location.href = '../login-page/login.html';
}

async function logout() {
  await new Promise(r => chrome.storage.local.remove(['recall_token','recall_user'], r));
  window.location.href = '../login-page/login.html';
}

/* ── TOAST ──────────────────────────────── */
let toastTimer = null;
function showToast(message, type) {
  type = type || 'success';
  clearTimeout(toastTimer);
  const toast     = document.getElementById('toast');
  const toastIcon = document.getElementById('toastIcon');
  const toastMsg  = document.getElementById('toastMsg');
  if (!toast) return;
  toastMsg.textContent  = message;
  toastIcon.textContent = type === 'success' ? '✓' : '✕';
  toast.className = 'toast toast-' + type + ' show';
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ── TAG HELPERS ────────────────────────── */
const TAG_ICONS = { Tech:'⚡', Science:'🔬', Health:'❤️', Finance:'💰', History:'📜', Sports:'🏆', Music:'🎵', Fitness:'🏋️', Other:'🔍' };
const TAG_COLORS = {
  Tech:    { bar:'#6366f1', iconBg:'rgba(99,102,241,0.15)' },
  Science: { bar:'#10b981', iconBg:'rgba(16,185,129,0.15)' },
  Health:  { bar:'#ef4444', iconBg:'rgba(239,68,68,0.15)'  },
  Finance: { bar:'#f59e0b', iconBg:'rgba(245,158,11,0.15)' },
  History: { bar:'#8b5cf6', iconBg:'rgba(139,92,246,0.15)' },
  Sports:  { bar:'#f97316', iconBg:'rgba(249,115,22,0.15)' },
  Music:   { bar:'#ec4899', iconBg:'rgba(236,72,153,0.15)' },
  Fitness: { bar:'#14b8a6', iconBg:'rgba(20,184,166,0.15)' },
  Other:   { bar:'#64748b', iconBg:'rgba(100,116,139,0.15)'},
};
function tagClass(tag) {
  const map = { Tech:'tech', Science:'science', Health:'health', Finance:'finance', History:'history', Other:'other' };
  return 'tag-' + (map[tag] || 'other');
}
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)        return 'Just now';
  if (diff < 3600)      return Math.floor(diff/60) + 'm ago';
  if (diff < 86400)     return Math.floor(diff/3600) + 'h ago';
  if (diff < 172800)    return 'Yesterday';
  if (diff < 604800)    return Math.floor(diff/86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── "Open Original" link resolver ───────────────────────────
   Prefers the exact saved conversation URL (source_url). For
   older entries saved before this field existed, falls back to
   the platform's homepage so the button still takes the user
   somewhere useful instead of doing nothing. */
const PLATFORM_HOME_URLS = {
  ChatGPT:      'https://chatgpt.com/',
  Gemini:       'https://gemini.google.com/',
  Claude:       'https://claude.ai/',
  Perplexity:   'https://www.perplexity.ai/',
  Copilot:      'https://copilot.microsoft.com/',
  'Meta AI':    'https://www.meta.ai/',
  Grok:         'https://grok.com/',
};
function getOriginalLink(s) {
  if (s && s.source_url && s.source_url.trim()) return s.source_url.trim();
  return PLATFORM_HOME_URLS[s && s.source] || null;
}

/* ── Platform brand colors — used for the source badge on each card ── */
const PLATFORM_COLORS = {
  ChatGPT:    { bg: 'rgba(16,163,127,0.14)',  color: '#10A37F' },
  Gemini:     { bg: 'rgba(66,133,244,0.14)',  color: '#4285F4' },
  Claude:     { bg: 'rgba(204,120,92,0.16)',  color: '#CC785C' },
  Perplexity: { bg: 'rgba(32,128,141,0.14)',  color: '#20808D' },
  Copilot:    { bg: 'rgba(0,120,212,0.14)',   color: '#0078D4' },
  'Meta AI':  { bg: 'rgba(8,102,255,0.14)',   color: '#0866FF' },
  Grok:       { bg: 'rgba(17,24,39,0.12)',    color: '#111827' },
};
function platformStyle(source) {
  return PLATFORM_COLORS[source] || { bg: 'rgba(85,104,138,0.14)', color: '#55688A' };
}
/* Exact date, e.g. "Jul 22, 2026, 11:58 AM" — shown alongside the relative time */
function exactDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── STATE ──────────────────────────────── */
let allSearches    = [];
let displayedCount = 10;
const PAGE_SIZE    = 10;
let filterTimer    = null;

/* ── SEMANTIC (AI) SEARCH STATE ─────────── */
let semanticMode    = false;   // true when AI Search toggle is on
let semanticResults = null;    // last semantic-search results, or null

/* ── RENDER ACTIVITY LIST ───────────────── */
function renderActivityList(searches, opts) {
  opts = opts || {};
  const isSemantic = !!opts.semantic;

  const list    = document.getElementById('activityList');
  const loading = document.getElementById('activityLoading');
  if (!list) return;
  if (loading) loading.style.display = 'none';

  if (!searches || searches.length === 0) {
    const emptyMsg = isSemantic
      ? 'No conceptually similar searches found. Try different wording.'
      : 'No searches yet. Start using ChatGPT, Gemini, or Claude to see your history here.';
    list.innerHTML = `<div class="activity-empty"><svg width="40" height="40" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>${emptyMsg}</span></div>`;
    return;
  }

  list.innerHTML = '';
  const slice = searches.slice(0, displayedCount);

  slice.forEach((s, i) => {
    const tag    = s.tag || 'Other';
    const colors = TAG_COLORS[tag] || TAG_COLORS['Other'];
    const icon   = TAG_ICONS[tag]  || '🔍';
    const item   = document.createElement('div');
    item.className   = 'activity-item';
    item.dataset.id  = s.id;
    item.style.opacity   = '0';
    item.style.transform = 'translateY(12px)';
    const ts = s.timestamp || s.created_at;
    const pStyle = platformStyle(s.source);
    item.innerHTML = `
      <div class="activity-item-bar" style="background:${colors.bar}"></div>
      <div class="activity-item-icon" style="background:${colors.iconBg}">${icon}</div>
      <div class="activity-item-body">
        <div class="activity-item-title">${escHtml(s.query)}</div>
        <div class="activity-item-summary">${escHtml(s.summary || 'Click to view AI summary')}</div>
      </div>
      <div class="activity-item-right">
        ${isSemantic && typeof s.matchScore === 'number'
          ? `<div class="activity-match-badge">🎯 ${s.matchScore}%</div>`
          : `<div class="activity-item-time" title="${escHtml(new Date(ts).toLocaleString())}">${timeAgo(ts)} &middot; ${exactDate(ts)}</div>`}
        <div class="activity-item-platform" style="background:${pStyle.bg};color:${pStyle.color}">${escHtml(s.source || 'Unknown')}</div>
        <div class="activity-item-tag ${tagClass(tag)}">${tag}</div>
        <button class="activity-open-original-btn" title="Open original conversation">↗</button>
      </div>
    `;
    item.addEventListener('click', () => openSummaryModal(s));
    const openOriginalBtn = item.querySelector('.activity-open-original-btn');
    if (openOriginalBtn) {
      openOriginalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const link = getOriginalLink(s);
        if (link) window.open(link, '_blank', 'noopener');
      });
    }
    list.appendChild(item);
    setTimeout(() => { item.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; item.style.opacity = '1'; item.style.transform = 'translateY(0)'; }, 40 * i);
  });

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.style.display = searches.length > displayedCount ? 'block' : 'none';
}

/* ── MODAL ──────────────────────────────── */
function openSummaryModal(search) {
  const overlay = document.getElementById('summaryOverlay');
  if (!overlay) return;
  const tag = search.tag || 'Other';
  const modalTag = document.getElementById('modalTag');
  if (modalTag) { modalTag.textContent = tag; modalTag.className = 'summary-modal-tag ' + tagClass(tag); }
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = search.query.length > 80 ? search.query.substring(0,80) + '…' : search.query;
  const modalSource = document.getElementById('modalSource');
  if (modalSource) modalSource.textContent = '📡 ' + (search.source || 'Unknown');
  const modalTime = document.getElementById('modalTime');
  if (modalTime) modalTime.textContent = '🕐 ' + (search.timestamp ? new Date(search.timestamp).toLocaleString() : 'Unknown time');
  const summaryEl = document.getElementById('modalSummary');
  if (summaryEl) {
    if (search.summary && search.summary.trim()) {
      // Render each paragraph as its own <p>. The AI itself wraps only the
      // important words/phrases (names, numbers, formulas, key facts) in
      // **double asterisks** — we just turn those into <strong>. We don't
      // bold whole bullet lines; only what the AI flagged as important.
      summaryEl.innerHTML = search.summary
        .split(/\n\n+/)
        .map(p => {
          const lines = p.trim().split(/\n/).map(line => {
            const trimmedLine = line.trim();
            return escHtml(trimmedLine)
              .replace(/\*\*(&quot;.*?&quot;)\*\*/g, '<strong class="summary-quote">$1</strong>')
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          });
          return `<p>${lines.join('<br>')}</p>`;
        })
        .join('');
      summaryEl.style.color = 'rgba(31,58,96,0.78)';
    } else {
      summaryEl.textContent = 'No AI summary available.';
      summaryEl.style.color = 'rgba(31,58,96,0.4)';
    }
  }
  const modalQuery = document.getElementById('modalQuery');
  if (modalQuery) modalQuery.textContent = '"' + search.query + '"';

  const modalOpenOriginal = document.getElementById('modalOpenOriginal');
  if (modalOpenOriginal) {
    const originalHref = getOriginalLink(search);
    if (originalHref) {
      modalOpenOriginal.href = originalHref;
      modalOpenOriginal.style.display = 'inline-flex';
    } else {
      modalOpenOriginal.style.display = 'none';
    }
  }

  overlay.classList.add('open');
  overlay.onclick = e => { if (e.target === overlay) closeSummaryModal(); };
}

function closeSummaryModal() {
  const overlay = document.getElementById('summaryOverlay');
  if (overlay) overlay.classList.remove('open');
}

/* ── FILTER & SEARCH ────────────────────── */
function handleActivityFilter(e) {
  clearTimeout(filterTimer);
  const q = e.target.value.trim().toLowerCase();
  filterTimer = setTimeout(() => {
    if (!q) { renderActivityList(allSearches); return; }
    renderActivityList(allSearches.filter(s =>
      (s.query||'').toLowerCase().includes(q) ||
      (s.summary||'').toLowerCase().includes(q) ||
      (s.tag||'').toLowerCase().includes(q)
    ));
  }, 300);
}

let searchTimer = null;
async function handleHeaderSearch(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) {
    semanticResults = null;
    renderActivityList(allSearches);
    return;
  }
  searchTimer = setTimeout(async () => {
    if (semanticMode) {
      await runSemanticSearch(q);
      return;
    }
    try {
      const res  = await fetch(API.search + encodeURIComponent(q), { headers: await authHeaders() });
      const data = await res.json();
      renderActivityList(data.searches || []);
    } catch(err) { console.error('[Recall AI] Search error:', err); }
  }, 400);
}

/* ── SEMANTIC (AI) SEARCH ───────────────── */
async function runSemanticSearch(q) {
  const list = document.getElementById('activityList');
  if (list) {
    list.innerHTML = `<div class="activity-empty"><span style="font-size:13px;">🔮 Searching by meaning…</span></div>`;
  }
  try {
    const res  = await fetch(API.semanticSearch + encodeURIComponent(q), { headers: await authHeaders() });
    if (res.status === 401) { await logout(); return; }

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Semantic search failed — try again', 'error');
      semanticResults = [];
      renderActivityList([], { semantic: true });
      return;
    }

    semanticResults = data.searches || [];
    displayedCount  = PAGE_SIZE;
    renderActivityList(semanticResults, { semantic: true });

  } catch (err) {
    console.error('[Recall AI] Semantic search error:', err);
    showToast('Semantic search failed — check your connection', 'error');
  }
}

function toggleSemanticMode() {
  semanticMode = !semanticMode;

  const btn = document.getElementById('aiSearchToggle');
  const si  = document.getElementById('searchInput');
  if (btn) btn.classList.toggle('active', semanticMode);
  if (si)  si.placeholder = semanticMode
    ? 'Ask anything — search by meaning…'
    : 'Search your history…';

  const q = si ? si.value.trim() : '';

  if (semanticMode) {
    showToast('AI Search on — searching by meaning', 'success');
    if (q) { runSemanticSearch(q); return; }
  } else {
    showToast('AI Search off — back to keyword search', 'success');
    semanticResults = null;
    if (q) {
      handleHeaderSearch({ target: { value: q } });
      return;
    }
  }

  renderActivityList(allSearches);
}

/* ── EXPORT ─────────────────────────────── */
function exportHistory() {
  if (!allSearches.length) { showToast('Nothing to export', 'error'); return; }
  const lines = ['Query,Tag,Summary,Source,Date'];
  allSearches.forEach(s => {
    lines.push([
      '"' + (s.query||'').replace(/"/g,'""') + '"',
      '"' + (s.tag||'') + '"',
      '"' + (s.summary||'').replace(/"/g,'""') + '"',
      '"' + (s.source||'') + '"',
      '"' + new Date(s.timestamp||s.created_at).toLocaleString() + '"',
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'recall-ai-history.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('History exported!', 'success');
}

/* ── PROFILE SYNC (from recallai_profile in localStorage) ── */
function getProfileData() {
  try {
    const raw = localStorage.getItem('recallai_profile');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function makeInitials(firstName, lastName) {
  return [(firstName || '')[0], (lastName || '')[0]]
    .filter(Boolean).join('').toUpperCase() || '?';
}

function applyProfileToSidebar() {
  const p = getProfileData();

  // Fall back to chrome user data if no profile saved yet
  const fallback = async () => {
    const user = await getUser();
    if (!user || !user.name) return;
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.name;
    const emailEl = document.getElementById('userEmailDisplay');
    if (emailEl && user.email) emailEl.textContent = user.email;
    const initialsEl = document.getElementById('sidebarInitials');
    if (initialsEl && user.name) {
      const parts = user.name.trim().split(/\s+/);
      initialsEl.textContent = parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }
  };

  if (!p) { fallback(); return; }

  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || '';
  const email    = p.email || '';
  const initials = makeInitials(p.firstName, p.lastName);

  const nameEl = document.getElementById('userName');
  if (nameEl && fullName) nameEl.textContent = fullName;

  const emailEl = document.getElementById('userEmailDisplay');
  if (emailEl && email) emailEl.textContent = email;

  const initialsEl = document.getElementById('sidebarInitials');
  if (initialsEl) initialsEl.textContent = initials;

  // If a profile photo was saved, show it instead of initials
  if (p.avatarSrc) {
    const avatarEl = document.getElementById('sidebarAvatar');
    if (avatarEl) {
      avatarEl.style.backgroundImage = `url('${p.avatarSrc}')`;
      avatarEl.style.backgroundSize  = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      const span = avatarEl.querySelector('span');
      if (span) span.style.display = 'none';
    }
  }
}

/* ── LOAD DASHBOARD ─────────────────────── */
async function loadDashboardData() {
  const hdrs = await authHeaders();
  try {
    // Insight
    const insightRes = await fetch(API.insight, { headers: hdrs });
    if (insightRes.status === 401) { await logout(); return; }
    if (insightRes.ok) {
      const d  = await insightRes.json();
      const el = document.getElementById('insightText');
      if (el && d.insight) el.textContent = d.insight;
    }

    // Searches
    const histRes = await fetch(API.history, { headers: hdrs });
    if (histRes.status === 401) { await logout(); return; }
    if (histRes.ok) {
      const d  = await histRes.json();
      allSearches = d.searches || [];
      renderActivityList(allSearches);

      // ── Sync real search count into recallUsage ────────────────
      // This ensures the subscription Usage page shows the true
      // backend total, not just locally-incremented counts.
      const realCount = allSearches.length;

      // Show the total tracked searches on the dashboard itself.
      const totalSearchesEl = document.getElementById('totalSearchesValue');
      if (totalSearchesEl) totalSearchesEl.textContent = realCount.toLocaleString();
      chrome.storage.local.get(['recallUsage'], (stored) => {
        const usage = stored.recallUsage || { searches: 0, apiCalls: 0, storageMb: 0, exports: 0 };
        // Only update if backend count is higher (prevents going backwards on stale cache)
        if (realCount >= (usage.searches || 0)) {
          usage.searches  = realCount;
          usage.apiCalls  = realCount * 2;         // 2 API calls per search (save + AI)
          usage.storageMb = realCount * 0.008;     // ~8 KB per search entry
          // exports stay as-is — they are tracked separately on each export action
          chrome.storage.local.set({ recallUsage: usage });
        }
      });
    } else {
      renderActivityList([]);
    }

    // User info — prefer recallai_profile (from profile page) over chrome.storage
    applyProfileToSidebar();

    // Profile card click → profile page
    const profileCard = document.getElementById('profileCard');
    if (profileCard) {
      const goToProfile = () => { window.location.href = '../profile-page/profile.html'; };
      profileCard.addEventListener('click', goToProfile);
      profileCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') goToProfile(); });
    }

  } catch(err) {
    console.error('[Recall AI] Dashboard load error:', err);
    renderActivityList([]);
  }
}

/* ── INIT ───────────────────────────────── */
function init() {
  const searchInput    = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', handleHeaderSearch);

  const aiSearchToggle = document.getElementById('aiSearchToggle');
  if (aiSearchToggle) aiSearchToggle.addEventListener('click', toggleSemanticMode);

  const activityFilter = document.getElementById('activityFilter');
  if (activityFilter) activityFilter.addEventListener('input', handleActivityFilter);

  const summaryClose   = document.getElementById('summaryClose');
  if (summaryClose) summaryClose.addEventListener('click', closeSummaryModal);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSummaryModal(); });

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportHistory);

  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => {
    displayedCount += PAGE_SIZE;
    if (semanticMode && semanticResults) {
      renderActivityList(semanticResults, { semantic: true });
    } else {
      renderActivityList(allSearches);
    }
  });

  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) notifBtn.addEventListener('click', () => showToast('No new notifications', 'success'));

  const analysisBtn = document.getElementById('viewAnalysisBtn');
  if (analysisBtn) analysisBtn.addEventListener('click', () => { window.location.href = '../insights-page/insights.html'; });

  const totalSearchesStat = document.getElementById('totalSearchesStat');
  if (totalSearchesStat) {
    const goToInsights = () => { window.location.href = '../insights-page/insights.html'; };
    totalSearchesStat.addEventListener('click', goToInsights);
    totalSearchesStat.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') goToInsights(); });
  }

  // FAB button - opens platform selector popup
  const fabBtn = document.getElementById('fabBtn');
  if (fabBtn) {
    fabBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var overlay = document.getElementById('platformPopupOverlay');
      if (overlay) overlay.classList.add('pp-open');
    });
  }

  // Platform popup close handlers
  var platformOverlay = document.getElementById('platformPopupOverlay');
  var platformClose = document.getElementById('platformPopupClose');

  function closePlatformPopup() {
    var overlay = document.getElementById('platformPopupOverlay');
    if (overlay) overlay.classList.remove('pp-open');
  }

  if (platformClose) {
    platformClose.addEventListener('click', function(e) {
      e.stopPropagation();
      closePlatformPopup();
    });
  }

  if (platformOverlay) {
    platformOverlay.addEventListener('click', function(e) {
      if (e.target === platformOverlay) closePlatformPopup();
    });
  }

  document.querySelectorAll('.pp-card').forEach(function(card) {
    card.addEventListener('click', function() {
      setTimeout(closePlatformPopup, 150);
    });
  });
  

  // Logout button (if exists in dashboard HTML)
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

/* ── BOOT ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  init();
  loadDashboardData();
});
