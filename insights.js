/* ─────────────────────────────────────────
   RECALL AI — insights.js
   Uses the existing GET /api/searches/ endpoint
   (same one dashboard/history already use) and
   computes all stats client-side — no backend
   changes needed.
───────────────────────────────────────── */
'use strict';

const BACKEND_URL = 'http://localhost:5000';

const API = {
  history: `${BACKEND_URL}/api/searches/`,
};

/* ── AUTH (chrome.storage.local) — same pattern as dashbaord.js ── */
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

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)        return 'Just now';
  if (diff < 3600)      return Math.floor(diff/60) + 'm ago';
  if (diff < 86400)     return Math.floor(diff/3600) + 'h ago';
  if (diff < 172800)    return 'Yesterday';
  if (diff < 604800)    return Math.floor(diff/86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

/* ── TOAST ──────────────────────────────── */
let toastTimer = null;
function showToast(message) {
  clearTimeout(toastTimer);
  const toast = document.getElementById('toast');
  const msg   = document.getElementById('toastMsg');
  if (!toast) return;
  msg.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ── SIDEBAR PROFILE (same pattern as other pages) ─────────── */
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

/* ── PLATFORM DEFINITIONS ───────────────── */
const PLATFORMS = {
  ChatGPT: {
    label: 'ChatGPT', provider: 'OpenAI', color: '#2F9E64',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 41 41" fill="currentColor"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.239-2.368 10.079 10.079 0 0 0-9.612 6.977 9.967 9.967 0 0 0-6.663 4.834 10.079 10.079 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.239 2.367 10.079 10.079 0 0 0 9.612-6.976 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.24-11.818zm-17.208 14.532a7.478 7.478 0 0 1-4.797-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.491 7.013zm-16.134-6.874a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.648a7.504 7.504 0 0 1-10.24-2.743zm-2.063-17.369a7.47 7.47 0 0 1 3.903-3.287C7.962 8.018 8 8.087 8 8.192v9.199a1.29 1.29 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 21.4a7.504 7.504 0 0 1-2.917-10.211zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l7.857 4.533a7.504 7.504 0 0 1-1.158 13.528v-9.199a1.29 1.29 0 0 0-.456-1.292zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.999l-4.331 2.5-4.331-2.5V21.559z"/></svg>'
  },
  Claude: {
    label: 'Claude', provider: 'Anthropic', color: '#C97A3F',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-1.21-.097C2.012 12.49 2 12.25 2 12c0-.443.065-.866.185-1.28l.074-.23 2.65.17 2.599.097 1.822.097h.714l.006-.152-.104-.14-1.38-1.82-1.597-2.135-.976-1.38a9.491 9.491 0 0 1 1.628-1.41l.238.19 1.354 1.758 1.518 1.99.945 1.246.104.17h.195l.128-.225V8.6l.042-2.35V4.712a9.935 9.935 0 0 1 2.358-.006l.048 1.664.091 2.284v1.61l.006.335h.18l.128-.19 1.207-1.664 1.56-1.99.937-1.13a9.552 9.552 0 0 1 1.872 1.226l-.079.14-1.354 1.86-1.44 1.895-.729 1.087.006.134.128.049h.37l2.138-.11 2.668-.134 1.44-.073c.154.414.246.858.258 1.318.012.45-.055.887-.19 1.293l-1.664.128-2.497.07-2.174.123h-.37l-.006.128.128.226 1.14 1.506 1.432 1.944.862 1.245a9.566 9.566 0 0 1-1.737 1.44l-.214-.195-1.19-1.62-1.476-1.968-.917-1.246-.14-.213h-.19v.178l-.006.492-.006 2.008-.042 2.314c-.39.07-.79.11-1.192.116a9.927 9.927 0 0 1-1.245-.091l-.042-1.785-.073-2.22v-1.37l-.006-.397h-.19l-.104.165-1.011 1.52-1.476 2.063-.844 1.094a9.498 9.498 0 0 1-1.737-1.398l.067-.116 1.11-1.453z"/></svg>'
  },
  Gemini: {
    label: 'Gemini', provider: 'Google', color: '#5B7FBE',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><defs><linearGradient id="ggInsights" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4285F4"/><stop offset="50%" stop-color="#E8935A"/><stop offset="100%" stop-color="#D6484A"/></linearGradient></defs><path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12" fill="url(#ggInsights)"/></svg>'
  }
};
const MONTHLY_QUOTA = 350;

const CATEGORY_COLORS = {
  Tech:    '#5B7FBE',
  Science: '#2F9E64',
  Finance: '#F4A261',
  Health:  '#D6484A',
  History: '#C97A3F',
  Other:   '#A9B4C4'
};

/* ── DATE HELPERS ────────────────────────── */
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysAgo(n) {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - n);
  return d;
}
function startOfMonth(offset) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  d.setHours(0,0,0,0);
  return d;
}

/* ── MAIN RENDER ─────────────────────────── */
let allSearches = [];
let freqDayMeta = [];          // [{start, end, shortLabel, fullLabel}, ...] for the 7-day frequency chart

// Unified drill-down selection shared by the Today/Week/Month stat cards
// and the Frequency chart below. Only one range can be "drilled into" at a time.
// shape: { type: 'day' | 'week', key, start, end, shortLabel, fullLabel } or null.
let selectedRange = null;

function computeDailyCounts7() {
  // Returns [count for 6-days-ago, ..., count for today]
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const day = daysAgo(i);
    const next = daysAgo(i - 1);
    const c = allSearches.filter(s => {
      const t = new Date(s.timestamp);
      return t >= day && t < next;
    }).length;
    counts.push(c);
  }
  return counts;
}

// Builds the 7 day buckets used by the Today card, the Week card, and the
// Frequency chart — one shared source of truth so all three stay in sync.
function buildDayBuckets() {
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const start = daysAgo(i);
    const end = daysAgo(i - 1);
    const count = allSearches.filter(s => {
      const t = new Date(s.timestamp);
      return t >= start && t < end;
    }).length;
    buckets.push({
      type: 'day',
      key: `day-${i}`,
      start, end, count,
      isCurrent: i === 0,
      shortLabel: start.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1).toUpperCase(),
      fullLabel: start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    });
  }
  return buckets;
}

// Builds the last N rolling 7-day windows (oldest → newest, ending with the
// current week) so the Week card shows a week-over-week TREND — "Week 1",
// "Week 2" ... up to "This Week" — instead of daily bars.
function buildRecentWeekBuckets(numWeeks = 5) {
  const buckets = [];
  for (let w = numWeeks - 1; w >= 0; w--) {
    const start = daysAgo(6 + 7 * w);
    const end = daysAgo(7 * w - 1); // exclusive
    const count = allSearches.filter(s => {
      const t = new Date(s.timestamp);
      return t >= start && t < end;
    }).length;
    const lastDay = new Date(end.getTime() - 86400000);
    buckets.push({
      type: 'week',
      key: `recentweek-${w}`,
      start, end, count,
      isCurrent: w === 0,
      shortLabel: `W${numWeeks - w}`,
      fullLabel: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${lastDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    });
  }
  return buckets;
}

// Builds the last N calendar months (oldest → newest, ending with the
// current month) so the Month card shows a month-over-month TREND —
// "Mar", "Apr", "May" ... — instead of weeks within a single month.
function buildRecentMonthBuckets(numMonths = 5) {
  const buckets = [];
  for (let m = numMonths - 1; m >= 0; m--) {
    const start = startOfMonth(-m);
    const end = startOfMonth(-m + 1); // exclusive, first of next month
    const count = allSearches.filter(s => {
      const t = new Date(s.timestamp);
      return t >= start && t < end;
    }).length;
    buckets.push({
      type: 'month',
      key: `recentmonth-${m}`,
      start, end, count,
      isCurrent: m === 0,
      shortLabel: start.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    });
  }
  return buckets;
}

// Renders one stat card's bars + labels from a bucket list, wiring up clicks
// so tapping a day (Today/Week cards) or a week (Month card) drills into it.
function renderStatBarsInteractive(barsId, labelsId, buckets) {
  const barsEl = document.getElementById(barsId);
  const labelsEl = document.getElementById(labelsId);
  if (!barsEl || !labelsEl) return;

  const max = Math.max(1, ...buckets.map(b => b.count));
  const hasSelection = !!selectedRange;
  barsEl.classList.toggle('has-selection', hasSelection);

  barsEl.innerHTML = buckets.map(b => {
    const h = Math.max(6, Math.round((b.count / max) * 100));
    const cls = ['bar'];
    if (b.isCurrent) cls.push('today');
    if (selectedRange && selectedRange.key === b.key) cls.push('selected');
    return `<div class="${cls.join(' ')}" data-key="${b.key}" style="height:${h}%;" title="${b.fullLabel}: ${b.count} search${b.count === 1 ? '' : 'es'}"></div>`;
  }).join('');

  labelsEl.innerHTML = buckets.map(b => {
    const isSelected = selectedRange && selectedRange.key === b.key;
    return `<span class="${isSelected ? 'selected' : ''}" data-key="${b.key}" title="${b.fullLabel}">${b.shortLabel}</span>`;
  }).join('');

  const bucketMap = {};
  buckets.forEach(b => { bucketMap[b.key] = b; });

  const clickHandler = (e) => {
    const target = e.target.closest('[data-key]');
    if (!target) return;
    toggleRangeSelection(bucketMap[target.dataset.key]);
  };
  barsEl.onclick = clickHandler;
  labelsEl.onclick = clickHandler;
}

// Toggles the shared drill-down selection: clicking the same bucket again
// clears it back to the overall (monthly) view.
function toggleRangeSelection(bucket) {
  if (selectedRange && selectedRange.key === bucket.key) {
    selectedRange = null;
  } else {
    selectedRange = bucket;
  }
  renderTopStats();          // refresh bar highlight across all 3 cards
  renderFrequencyChart();    // keep the frequency chart's own highlight in sync
  renderPlatformCredits();   // refresh gauges/numbers for the new scope
  updateDayFilterChip();
}

function renderTopStats() {
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const todayCount = allSearches.filter(s => new Date(s.timestamp) >= today).length;

  const weekStart = daysAgo(6);
  const prevWeekStart = daysAgo(13);
  const thisWeekCount = allSearches.filter(s => new Date(s.timestamp) >= weekStart).length;
  const lastWeekCount = allSearches.filter(s => {
    const t = new Date(s.timestamp);
    return t >= prevWeekStart && t < weekStart;
  }).length;

  const thisMonthStart = startOfMonth(0);
  const lastMonthStart = startOfMonth(-1);
  const thisMonthCount = allSearches.filter(s => new Date(s.timestamp) >= thisMonthStart).length;
  const lastMonthCount = allSearches.filter(s => {
    const t = new Date(s.timestamp);
    return t >= lastMonthStart && t < thisMonthStart;
  }).length;

  function pctDelta(cur, prev) {
    if (prev === 0) return cur > 0 ? '+New' : '—';
    const pct = Math.round(((cur - prev) / prev) * 100);
    return (pct >= 0 ? '↑ +' : '↓ ') + Math.abs(pct) + '%';
  }

  // Guarded setter — a single missing/renamed element must never throw and
  // take down the rest of renderAll() (frequency chart, categories,
  // platform table all run after this and would otherwise never render).
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setText('totalTracked', allSearches.length);

  // Today card — shows the drilled-in day's own total when a day bar is
  // selected, otherwise today's live count.
  const todaySel = selectedRange && selectedRange.type === 'day' ? selectedRange : null;
  setText('statToday', todaySel ? todaySel.count : todayCount);
  setText('statTodaySub', todaySel ? todaySel.fullLabel : 'Since midnight');

  // Week card — shows the drilled-in week's own total when a week bar is
  // selected, otherwise the current week vs. last week comparison.
  const weekSel = selectedRange && selectedRange.type === 'week' ? selectedRange : null;
  setText('statWeek', weekSel ? weekSel.count : thisWeekCount);
  setText('statWeekSub', weekSel ? weekSel.fullLabel : 'vs. last week');
  setText('statWeekDelta', weekSel ? weekSel.shortLabel : pctDelta(thisWeekCount, lastWeekCount));

  // Month card — shows the drilled-in month's own total when a month bar is
  // selected, otherwise the current month vs. last month comparison.
  const monthSel = selectedRange && selectedRange.type === 'month' ? selectedRange : null;
  setText('statMonth', monthSel ? monthSel.count : thisMonthCount);
  setText('statMonthSub', monthSel ? monthSel.fullLabel : 'vs. last month');
  setText('statMonthDelta', monthSel ? monthSel.shortLabel : pctDelta(thisMonthCount, lastMonthCount));

  // Today shows a 7-day trend. Week now shows a week-over-week trend
  // (Week 1, Week 2, ... This Week). Month shows a month-over-month trend
  // (Mar, Apr, May, ...) — each card's own granularity, not a copy of another's.
  const dayBuckets = buildDayBuckets();
  const weekBuckets = buildRecentWeekBuckets(5);
  const monthBuckets = buildRecentMonthBuckets(5);
  renderStatBarsInteractive('barsToday', 'daylabelsToday', dayBuckets);
  renderStatBarsInteractive('barsWeek', 'daylabelsWeek', weekBuckets);
  renderStatBarsInteractive('barsMonth', 'daylabelsMonth', monthBuckets);
}

function renderFrequencyChart() {
  const el = document.getElementById('freqChart');
  if (!el) return;
  const counts = computeDailyCounts7();
  const max = Math.max(1, ...counts);

  // Build metadata (exact date range + labels) for each of the 7 bars,
  // so a click can filter the platform cards to that single day.
  freqDayMeta = [];
  for (let i = 6; i >= 0; i--) {
    const start = daysAgo(i);
    const end = daysAgo(i - 1);
    freqDayMeta.push({
      start, end,
      shortLabel: start.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3),
      fullLabel: start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    });
  }

  el.innerHTML = counts.map((c, i) => {
    const h = Math.max(3, Math.round((c / max) * 100));
    const isToday = i === counts.length - 1;
    const isSelected = !!selectedRange && selectedRange.key === `day-${6 - i}`;
    return `
      <div class="ins-freq-col${isSelected ? ' selected' : ''}" data-day-idx="${i}" title="Click to see ${freqDayMeta[i].fullLabel} only">
        <div class="ins-freq-value">${c}</div>
        <div class="ins-freq-bar-wrap">
          <div class="ins-freq-bar${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" style="height:${h}%;"></div>
        </div>
        <div class="ins-freq-day">${freqDayMeta[i].shortLabel}</div>
      </div>`;
  }).join('');

  // Event delegation — one listener handles all 7 columns.
  el.onclick = (e) => {
    const col = e.target.closest('.ins-freq-col');
    if (!col) return;
    const idx = parseInt(col.dataset.dayIdx, 10);
    const meta = freqDayMeta[idx];
    toggleRangeSelection({
      type: 'day',
      key: `day-${6 - idx}`,
      start: meta.start, end: meta.end,
      shortLabel: meta.shortLabel, fullLabel: meta.fullLabel
    });
  };
}

function updateDayFilterChip() {
  const chip = document.getElementById('dayFilterChip');
  if (!chip) return;
  if (!selectedRange) {
    chip.style.display = 'none';
    chip.innerHTML = '';
    return;
  }
  let label = selectedRange.fullLabel;
  if (selectedRange.type === 'week') label = `Week of ${selectedRange.fullLabel}`;
  chip.style.display = 'flex';
  chip.innerHTML = `Showing ${label} only <span class="ins-chip-clear">✕</span>`;
  chip.onclick = () => toggleRangeSelection(selectedRange);
}

function renderCategoryBreakdown() {
  const el = document.getElementById('categoryList');
  if (!el) return;
  const counts = {};
  allSearches.forEach(s => {
    const tag = s.tag || 'Other';
    counts[tag] = (counts[tag] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    el.innerHTML = '<div style="color:#7C93B3;font-size:12px;">No searches tracked yet.</div>';
    return;
  }
  const max = Math.max(...entries.map(e => e[1]));
  el.innerHTML = entries.map(([tag, count]) => {
    const color = CATEGORY_COLORS[tag] || '#A9B4C4';
    const pct = Math.max(4, Math.round((count / max) * 100));
    return `
      <div class="ins-category-row">
        <div class="ins-category-top">
          <div class="ins-category-name"><span class="ins-category-dot" style="background:${color};"></span>${tag}</div>
          <div class="ins-category-count">${count}</div>
        </div>
        <div class="ins-category-track"><div class="ins-category-fill" style="width:${pct}%; background:${color};"></div></div>
      </div>`;
  }).join('');
}

function renderPlatformCredits() {
  const grid = document.getElementById('platformGrid');
  if (!grid) return;

  // Scope: either the clicked day/week/month, or the whole current month (default).
  let rangeStart, rangeEnd, quotaLabel;
  if (selectedRange) {
    rangeStart = selectedRange.start;
    rangeEnd   = selectedRange.end;
    quotaLabel = selectedRange.type === 'day'
      ? `${selectedRange.fullLabel}'s Usage`
      : `${selectedRange.shortLabel}'s Usage`;
  } else {
    rangeStart = startOfMonth(0);
    rangeEnd   = null; // open-ended, up to now
    quotaLabel = 'Monthly Quota';
  }

  grid.innerHTML = Object.keys(PLATFORMS).map(key => {
    const p = PLATFORMS[key];
    const platformSearches = allSearches.filter(s => (s.source || 'ChatGPT') === key);
    const scopedSearches = platformSearches.filter(s => {
      const t = new Date(s.timestamp);
      return t >= rangeStart && (rangeEnd ? t < rangeEnd : true);
    });
    const used = scopedSearches.length;
    const remaining = Math.max(0, MONTHLY_QUOTA - used);
    const pct = Math.min(100, Math.round((used / MONTHLY_QUOTA) * 100));
    const lastUsed = platformSearches.length
      ? platformSearches.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp
      : null;

    const gaugeBg = `conic-gradient(${p.color} ${pct * 3.6}deg, #EAEFF5 0deg)`;

    return `
      <div class="ins-platform-card">
        <div class="ins-platform-top">
          <div class="ins-platform-id">
            <div class="ins-platform-icon" style="background:${p.color}1F; color:${p.color};">${p.icon}</div>
            <div>
              <div class="ins-platform-name">${p.label}</div>
              <div class="ins-platform-provider">${p.provider}</div>
            </div>
          </div>
          <div class="ins-active-badge">Active</div>
        </div>
        <div class="ins-gauge-wrap">
          <div class="ins-gauge" style="background:${gaugeBg};">
            <div class="ins-gauge-inner">
              <div class="ins-gauge-pct" style="color:${p.color};">${pct}%</div>
              <div class="ins-gauge-label">Used</div>
            </div>
          </div>
        </div>
        <div class="ins-platform-stats">
          <div class="ins-platform-stat">
            <div class="ins-platform-stat-value">${used}</div>
            <div class="ins-platform-stat-label">Searches</div>
          </div>
          <div class="ins-platform-stat">
            <div class="ins-platform-stat-value">${remaining}</div>
            <div class="ins-platform-stat-label">Remaining</div>
          </div>
        </div>
        <div class="ins-quota-row">
          <span class="ins-quota-label">${quotaLabel}</span>
          <span class="ins-quota-value">${used} / ${MONTHLY_QUOTA.toLocaleString()}</span>
        </div>
        <div class="ins-quota-track"><div class="ins-quota-fill" style="width:${pct}%; background:${p.color};"></div></div>
        <div class="ins-lastused-row">
          <span class="ins-lastused-label">Last Used</span>
          <span class="ins-lastused-value">${timeAgo(lastUsed)}</span>
        </div>
      </div>`;
  }).join('');
}

function renderBreakdownTable() {
  const body = document.getElementById('breakdownBody');
  if (!body) return;

  // Count every distinct source that appears, seeded with the 3 known platforms
  const counts = {};
  Object.keys(PLATFORMS).forEach(k => counts[k] = 0);
  allSearches.forEach(s => {
    const src = s.source || 'ChatGPT';
    counts[src] = (counts[src] || 0) + 1;
  });
  const total = allSearches.length || 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  body.innerHTML = entries.map(([key, count]) => {
    const p = PLATFORMS[key] || { label: key, color: '#A9B4C4' };
    const pct = Math.round((count / total) * 100);
    const platformSearches = allSearches.filter(s => (s.source || 'ChatGPT') === key);
    const lastUsed = platformSearches.length
      ? platformSearches.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp
      : null;
    const status = count > 0
      ? `<span class="ins-tracked-badge">TRACKED</span>`
      : `<span class="ins-tracked-badge" style="background:rgba(169,180,196,0.15); color:#7C93B3;">IDLE</span>`;

    return `
      <tr>
        <td><div class="ins-table-platform"><span class="ins-table-dot" style="background:${p.color};"></span>${p.label}</div></td>
        <td>
          <div class="ins-table-usage">
            <div class="ins-table-usage-track"><div class="ins-table-usage-fill" style="width:${pct}%; background:${p.color};"></div></div>
            <span class="ins-table-usage-pct">${pct}%</span>
          </div>
        </td>
        <td>${count}</td>
        <td class="ins-table-lastused">${timeAgo(lastUsed)}</td>
        <td>${status}</td>
      </tr>`;
  }).join('');
}

function renderAll() {
  renderTopStats();
  renderFrequencyChart();
  renderCategoryBreakdown();
  renderPlatformCredits();
  renderBreakdownTable();
  updateDayFilterChip();
}

async function loadInsightsData() {
  const hdrs = await authHeaders();
  try {
    const res = await fetch(API.history, { headers: hdrs });
    if (res.status === 401) { await logout(); return; }
    if (res.ok) {
      const d = await res.json();
      allSearches = d.searches || [];
    } else {
      allSearches = [];
    }
    renderAll();
    applyProfileToSidebar();

    const profileCard = document.getElementById('profileCard');
    if (profileCard) {
      const goToProfile = () => { window.location.href = '../profile-page/profile.html'; };
      profileCard.addEventListener('click', goToProfile);
      profileCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') goToProfile(); });
    }
  } catch (err) {
    console.error('[Recall AI] Insights load error:', err);
    allSearches = [];
    renderAll();
  }
}

/* ── INIT ───────────────────────────────── */
function init() {
  document.querySelectorAll('.ins-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ins-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Visual range switch — stat cards + frequency chart already show
      // the last 7 days / this-month figures needed for all three tabs.
    });
  });

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => {
    showToast('Refreshing platform data…');
    await loadInsightsData();
    showToast('Insights updated');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  init();
  loadInsightsData();
});