/* ─────────────────────────────────────────
   RECALL AI — history.js
   Real data only — grouped by date,
   click to see summary, delete with confirm.

   NEW: Cross-platform Combine feature
   ─ Long-press or checkbox to select cards
   ─ Floating bar appears when 2+ selected
   ─ Combine calls /api/searches/combine
   ─ Result shown in a rich combined modal
───────────────────────────────────────── */
'use strict';

/* ── CONFIG ─────────────────────────────── */
const BACKEND_URL = 'https://leovate-innovation-3.onrender.com';
const API = {
  history: `${BACKEND_URL}/api/searches/`,
  search:  `${BACKEND_URL}/api/searches/?q=`,
  delete:  `${BACKEND_URL}/api/searches/`,
  combine: `${BACKEND_URL}/api/searches/combine`,
};

/* ── AUTH ────────────────────────────────── */
async function getToken() {
  return new Promise(r => chrome.storage.local.get(['recall_token'], s => r(s.recall_token || null)));
}
async function authHeaders() {
  const token = await getToken();
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
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
function showToast(msg, type) {
  type = type || 'success';
  clearTimeout(toastTimer);
  const t  = document.getElementById('toast');
  const ti = document.getElementById('toastIcon');
  const tm = document.getElementById('toastMsg');
  tm.textContent  = msg;
  ti.textContent  = type === 'success' ? '✓' : '✕';
  t.className     = 'toast toast-' + type + ' show';
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── HELPERS ────────────────────────────── */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const TAG_ICONS = {
  Tech:'⚡', Science:'🔬', Health:'❤️',
  Finance:'💰', History:'📜', Sports:'🏆',
  Music:'🎵', Fitness:'🏋️', Other:'🔍'
};
const TAG_COLORS = {
  Tech:    { bar:'#6366f1', bg:'rgba(99,102,241,0.15)'  },
  Science: { bar:'#10b981', bg:'rgba(16,185,129,0.15)'  },
  Health:  { bar:'#ef4444', bg:'rgba(239,68,68,0.15)'   },
  Finance: { bar:'#f59e0b', bg:'rgba(245,158,11,0.15)'  },
  History: { bar:'#8b5cf6', bg:'rgba(139,92,246,0.15)'  },
  Sports:  { bar:'#f97316', bg:'rgba(249,115,22,0.15)'  },
  Music:   { bar:'#ec4899', bg:'rgba(236,72,153,0.15)'  },
  Fitness: { bar:'#14b8a6', bg:'rgba(20,184,166,0.15)'  },
  Other:   { bar:'#64748b', bg:'rgba(100,116,139,0.15)' },
};

const SOURCE_COLORS = {
  ChatGPT:    '#10a37f',
  Claude:     '#d97706',
  Gemini:     '#4285f4',
  Perplexity: '#6366f1',
  Copilot:    '#0078d4',
  'Meta AI':  '#0866ff',
  Grok:       '#e7e9ea',
};

function sourceColor(src) {
  return SOURCE_COLORS[src] || '#94a3b8';
}

function tagCls(tag) {
  const m = {Tech:'tech',Science:'science',Health:'health',
             Finance:'finance',History:'history',Sports:'sports',
             Music:'music',Fitness:'fitness',Other:'other'};
  return 'tag-' + (m[tag] || 'other');
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function groupLabel(dateStr) {
  const now   = new Date();
  const d     = new Date(dateStr);
  const diffD = Math.floor((now - d) / 86400000);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (diffD === 1)  return 'Yesterday';
  if (diffD < 7)   return 'This Week';
  if (diffD < 14)  return 'Last Week';
  return d.toLocaleDateString([], { month:'long', year:'numeric' });
}

function groupSearchesByDate(searches) {
  const groups = {};
  const order  = [];
  searches.forEach(s => {
    const label = groupLabel(s.timestamp || s.created_at);
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(s);
  });
  const seen = new Set();
  return order.filter(l => seen.has(l) ? false : seen.add(l))
              .map(l => ({ label: l, items: groups[l] }));
}

/* ── STATE ──────────────────────────────── */
let allSearches     = [];
let displayedCount  = 20;
const PAGE_SIZE     = 20;
let activeTag       = 'All';
let searchTimer     = null;
let pendingDeleteId = null;

/* ── COMBINE SELECTION STATE ─────────────── */
// Map of id → search object for currently selected cards
let selectedItems   = new Map();
let selectMode      = false;   // true when ≥1 card is checked

/* ── SELECTION HELPERS ───────────────────── */
function enterSelectMode() {
  selectMode = true;
  document.getElementById('timelineReal').classList.add('select-mode');
  updateCombineBar();
}

function exitSelectMode() {
  selectMode = false;
  selectedItems.clear();
  document.getElementById('timelineReal').classList.remove('select-mode');
  // uncheck all checkboxes
  document.querySelectorAll('.hi-checkbox').forEach(cb => { cb.checked = false; });
  // remove selected class from all rows
  document.querySelectorAll('.hi-row').forEach(r => r.classList.remove('hi-row--selected'));
  updateCombineBar();
}

function toggleSelect(id, searchObj, checkboxEl, rowEl) {
  if (selectedItems.has(id)) {
    selectedItems.delete(id);
    if (checkboxEl) checkboxEl.checked = false;
    rowEl.classList.remove('hi-row--selected');
  } else {
    selectedItems.set(id, searchObj);
    if (checkboxEl) checkboxEl.checked = true;
    rowEl.classList.add('hi-row--selected');
  }

  if (selectedItems.size === 0) {
    exitSelectMode();
  } else {
    enterSelectMode();
  }
}

function updateCombineBar() {
  const bar   = document.getElementById('combineBar');
  const count = selectedItems.size;

  if (count >= 2) {
    bar.classList.add('visible');
    document.getElementById('combineCount').textContent = count;
    document.getElementById('combineBtn').disabled = false;

    // Show platform badges in bar
    const platforms = [...selectedItems.values()].map(s => s.source || 'Unknown');
    const unique    = [...new Set(platforms)];
    document.getElementById('combinePlatforms').innerHTML = unique
      .map(p => `<span class="cb-platform" style="background:${sourceColor(p)}22;color:${sourceColor(p)};border:1px solid ${sourceColor(p)}44">${escHtml(p)}</span>`)
      .join('');
  } else {
    bar.classList.remove('visible');
    document.getElementById('combinePlatforms').innerHTML = '';
  }

  // Update select-all button label
  const saBtn = document.getElementById('selectAllBtn');
  if (saBtn) {
    const filtered = getFilteredSearches().slice(0, displayedCount);
    saBtn.textContent = selectedItems.size === filtered.length ? 'Deselect All' : 'Select All';
  }
}

/* ── RENDER TIMELINE ────────────────────── */
function renderTimeline(searches) {
  const container = document.getElementById('timelineReal');
  const loading   = document.getElementById('histLoading');
  if (loading) loading.style.display = 'none';

  if (!searches || searches.length === 0) {
    container.innerHTML = `
      <div class="hist-empty">
        <svg width="44" height="44" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" viewBox="0 0 24 24">
          <polyline points="12 8 12 12 14 14"/>
          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
        </svg>
        <span style="font-size:13px;">No searches found. Start using ChatGPT to build your history.</span>
      </div>`;
    document.getElementById('loadMoreBtn').style.display = 'none';
    return;
  }

  const slice  = searches.slice(0, displayedCount);
  const groups = groupSearchesByDate(slice);

  container.innerHTML = '';

  groups.forEach((group, gi) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';

    // Group header
    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.innerHTML = `
      <div class="date-group-label">${escHtml(group.label)}</div>
      <div class="date-group-line"></div>
    `;
    groupEl.appendChild(header);

    // Items
    group.items.forEach((s, i) => {
      const tag    = s.tag || 'Other';
      const colors = TAG_COLORS[tag] || TAG_COLORS['Other'];
      const icon   = TAG_ICONS[tag]  || '🔍';
      const srcCol = sourceColor(s.source || 'ChatGPT');
      const isSelected = selectedItems.has(s.id);

      const row = document.createElement('div');
      row.className   = 'hi-row' + (isSelected ? ' hi-row--selected' : '');
      row.dataset.id  = s.id;
      row.style.opacity   = '0';
      row.style.transform = 'translateY(14px)';

      row.innerHTML = `
        <label class="hi-checkbox-wrap" title="Select for combine">
          <input type="checkbox" class="hi-checkbox" ${isSelected ? 'checked' : ''} />
          <span class="hi-checkbox-custom"></span>
        </label>
        <div class="hi-left">
          <div class="hi-icon-wrap" style="background:${colors.bg}">${icon}</div>
          <div class="hi-time">${formatTime(s.timestamp || s.created_at)}</div>
        </div>
        <div class="hi-card">
          <div class="hi-card-top">
            <div class="hi-query">${escHtml(s.query)}</div>
            <div class="hi-actions">
              <button class="hi-action-btn delete-btn" title="Delete" data-id="${s.id}">✕</button>
            </div>
          </div>
          ${s.summary ? `<div class="hi-summary-preview">${escHtml(s.summary.substring(0, 120))}${s.summary.length > 120 ? '…' : ''}</div>` : ''}
          <div class="hi-card-bottom">
            <div class="hi-tag ${tagCls(tag)}">${tag}</div>
            <div class="hi-source" style="color:${srcCol};opacity:0.85;font-weight:600;">${escHtml(s.source || 'ChatGPT')}</div>
          </div>
        </div>
      `;

      // Checkbox click → toggle selection
      const cb = row.querySelector('.hi-checkbox');
      cb.addEventListener('change', function(e) {
        e.stopPropagation();
        toggleSelect(s.id, s, cb, row);
      });

      // Click card → open summary (not delete, not checkbox)
      row.addEventListener('click', function(e) {
        if (e.target.closest('.delete-btn')) return;
        if (e.target.closest('.hi-checkbox-wrap')) return;
        // In select mode, clicking card toggles selection
        if (selectMode) {
          toggleSelect(s.id, s, cb, row);
          return;
        }
        openSummaryModal(s);
      });

      // Delete button
      row.querySelector('.delete-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        pendingDeleteId = s.id;
        document.getElementById('confirmOverlay').classList.add('open');
      });

      groupEl.appendChild(row);

      // Staggered animation
      const delay = gi * 30 + i * 45;
      setTimeout(() => {
        row.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        row.style.opacity    = '1';
        row.style.transform  = 'translateY(0)';
      }, delay);
    });

    container.appendChild(groupEl);
  });

  // Load more button
  const lmBtn = document.getElementById('loadMoreBtn');
  lmBtn.style.display = searches.length > displayedCount ? 'block' : 'none';
}

/* ── SUMMARY MODAL ──────────────────────── */
function openSummaryModal(s) {
  const tag    = s.tag || 'Other';
  const smTag  = document.getElementById('smTag');
  smTag.textContent = tag;
  smTag.className   = 'sm-tag ' + tagCls(tag);

  document.getElementById('smTitle').textContent =
    s.query.length > 90 ? s.query.slice(0,90) + '…' : s.query;

  const srcCol = sourceColor(s.source || 'ChatGPT');
  document.getElementById('smSource').innerHTML =
    `📡 <span style="color:${srcCol};font-weight:700;">${escHtml(s.source || 'ChatGPT')}</span>`;
  document.getElementById('smTime').textContent =
    '🕐 ' + new Date(s.timestamp || s.created_at).toLocaleString();

  const smBody = document.getElementById('smSummary');
  if (s.summary && s.summary.trim()) {
    // Check if this is a speech/biography format (has "Key Points:" section)
    const isSpeechFormat = /Key Points:/i.test(s.summary);

    if (isSpeechFormat) {
      // ── SPEECH / BIO RENDER ──────────────────────────────────
      // Splits on Key Points:, renders intro + bullet list + bold quotes
      smBody.innerHTML = renderSpeechSummary(s.summary);
    } else {
      // ── STANDARD PARAGRAPH RENDER ───────────────────────────
      smBody.innerHTML = s.summary.split(/\n\n+/).map(p => {
        // Process **bold** quotes inside paragraphs
        const processed = escHtml(p.trim())
          .replace(/\*\*(".*?")\*\*/g, '<strong class="sm-quote">$1</strong>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e2e8ff;font-weight:700;">$1</strong>')
          .replace(/\n/g, '<br>');
        return `<p>${processed}</p>`;
      }).join('');
    }
    smBody.style.color = 'rgba(255,255,255,0.78)';
  } else {
    smBody.textContent = 'No AI summary available for this search.';
    smBody.style.color = 'rgba(255,255,255,0.32)';
  }

  document.getElementById('smQuery').textContent = '"' + s.query + '"';
  document.getElementById('summaryOverlay').classList.add('open');

  document.getElementById('summaryOverlay').onclick = function(e) {
    if (e.target === this) closeSummaryModal();
  };
}

/* ── SPEECH SUMMARY RENDERER ────────────── */
// Converts speech/bio formatted text (with "Key Points:" and **"quotes"**)
// into rich HTML with a styled key-points list and highlighted quotes.
function renderSpeechSummary(txt) {
  const lines = txt.split('\n');
  let html = '';
  let inKeyPoints = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^Key Points:/i.test(line)) {
      // Start the key points section
      inKeyPoints = true;
      html += `<div class="sm-keypoints-label">Key Points</div><ul class="sm-keypoints-list">`;
      continue;
    }

    // Process **"quote"** → highlighted quote block
    // Process **text** → bold
    function processLine(text) {
      let safe = escHtml(text);
      // Bold quotes (speech format) — render as a block quote
      safe = safe.replace(/\*\*(&quot;.*?&quot;)\*\*/g,
        '<span class="sm-quote">$1</span>');
      // Regular bold
      safe = safe.replace(/\*\*([^*]+)\*\*/g,
        '<strong style="color:#e2e8ff;font-weight:700;">$1</strong>');
      return safe;
    }

    if (inKeyPoints && /^[•\-\*]/.test(line)) {
      const content = line.replace(/^[•\-\*]\s*/, '');
      html += `<li class="sm-keypoint-item">${processLine(content)}</li>`;
    } else if (inKeyPoints) {
      // A bold quote line standing alone inside key points section
      html += `<li class="sm-keypoint-item">${processLine(line)}</li>`;
    } else {
      // Intro paragraph (before Key Points:)
      html += `<p class="sm-intro-para">${processLine(line)}</p>`;
    }
  }

  if (inKeyPoints) {
    html += `</ul>`;
  }

  return html || `<p>${escHtml(txt)}</p>`;
}
function closeSummaryModal() {
  document.getElementById('summaryOverlay').classList.remove('open');
}

/* ── COMBINED SUMMARY RENDERER ──────────── */
// Converts the structured text from Groq into rich HTML:
// • Lines starting with • become styled bullet points
// **word** becomes <strong>word</strong>
// (Platform) citations become colored badge spans
function renderCombinedText(txt) {
  const platformColors = {
    'chatgpt':    '#10b981',
    'claude':     '#f59e0b',
    'gemini':     '#6366f1',
    'perplexity': '#be83fa',
    'copilot':    '#0ea5e9',
    'meta ai':    '#3b82f6',
    'grok':       '#ec4899',
  };

  // Card icon pool — cycles through for each bullet card
  const cardIcons = [
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`,
  ];

  // Icon background colors — subtle, one per card cycling
  const iconBgColors = [
    'rgba(99,102,241,0.18)',
    'rgba(16,185,129,0.18)',
    'rgba(245,158,11,0.18)',
    'rgba(239,68,68,0.18)',
    'rgba(59,130,246,0.18)',
    'rgba(190,131,250,0.18)',
    'rgba(236,72,153,0.18)',
  ];
  const iconStrokeColors = [
    '#818cf8', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6',
  ];

  function getPlatformColor(name) {
    const key = name.toLowerCase();
    return platformColors[key] || 'rgba(255,255,255,0.5)';
  }

  // Extract platform badges from end of text like (ChatGPT)(Claude)
  function extractPlatforms(text) {
    const platforms = [];
    // Match all (PlatformName) at the end of the string
    const re = /\(([A-Za-z ]+)\)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      if (name.length > 0 && name.length < 25 && !/\d/.test(name)) {
        platforms.push(name);
      }
    }
    return platforms;
  }

  // Strip platform citations from text (they'll be shown as footer badges)
  function stripPlatforms(text) {
    return text.replace(/\s*\([A-Za-z ]{1,24}\)/g, '').trim();
  }

  // Extract the bold title from "**Title** rest of content..."
  function extractCardTitle(text) {
    const m = text.match(/^\*\*([^*]+)\*\*(.*)$/s);
    if (m) {
      return { title: m[1].trim(), body: m[2].replace(/^[:\s–—-]+/, '').trim() };
    }
    return { title: null, body: text };
  }

  // Process inline bold only (no platform citations — those become footer badges)
  function processInlineBold(text) {
    let safe = escHtml(text);
    safe = safe.replace(/\*\*([^*]+)\*\*/g,
      '<strong style="color:#e2e8ff;font-weight:700;">$1</strong>');
    return safe;
  }

  // Process inline formatting for paragraphs (bold + inline platform badges)
  function processInlinePara(text) {
    let safe = escHtml(text);
    safe = safe.replace(/\*\*([^*]+)\*\*/g,
      '<strong style="color:#e2e8ff;font-weight:700;">$1</strong>');
    safe = safe.replace(/\(([A-Za-z ]+)\)/g, function(match, name) {
      const trimmed = name.trim();
      if (trimmed.length > 0 && trimmed.length < 25 && !/\d/.test(trimmed)) {
        const col = getPlatformColor(trimmed);
        return `<span style="display:inline-block;padding:1px 7px;margin-left:3px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:0.03em;background:${col}22;color:${col};border:1px solid ${col}44;vertical-align:middle;">${escHtml(trimmed)}</span>`;
      }
      return match;
    });
    return safe;
  }

  // Split into lines and process
  const lines = txt.split('\n');
  let html = '';
  let cardIndex = 0;
  let bulletCards = [];
  let inBulletSection = false;

  // First pass: collect all bullets and paragraphs in order
  const segments = []; // { type: 'para'|'bullet', content }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^[•\-\*]\s/.test(line)) {
      const content = line.replace(/^[•\-\*]\s+/, '').trim();
      segments.push({ type: 'bullet', content });
    } else {
      segments.push({ type: 'para', content: line });
    }
  }

  // Render segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.type === 'para') {
      html += `<p class="cm-para">${processInlinePara(seg.content)}</p>`;
    } else {
      // Bullet → render as attractive card
      const raw = seg.content;
      const platforms = extractPlatforms(raw);
      const stripped = stripPlatforms(raw);
      const { title, body } = extractCardTitle(stripped);

      const iconHtml = cardIcons[cardIndex % cardIcons.length];
      const iconBg = iconBgColors[cardIndex % iconBgColors.length];
      const iconStroke = iconStrokeColors[cardIndex % iconStrokeColors.length];

      const platformBadges = platforms.map(p => {
        const col = getPlatformColor(p);
        return `<span class="cm-card-platform" style="background:${col}20;color:${col};border:1px solid ${col}40;">${escHtml(p)}</span>`;
      }).join('');

      // Build card HTML
      let cardHtml = `<div class="cm-insight-card">`;
      cardHtml += `<div class="cm-card-icon" style="background:${iconBg};color:${iconStroke};">${iconHtml}</div>`;
      cardHtml += `<div class="cm-card-content">`;
      if (title) {
        cardHtml += `<div class="cm-card-title">${escHtml(title)}</div>`;
        if (body) {
          cardHtml += `<div class="cm-card-desc">${processInlineBold(body)}</div>`;
        }
      } else {
        cardHtml += `<div class="cm-card-desc">${processInlineBold(body)}</div>`;
      }
      if (platformBadges) {
        cardHtml += `<div class="cm-card-platforms">${platformBadges}</div>`;
      }
      cardHtml += `</div></div>`;

      html += cardHtml;
      cardIndex++;
    }
  }

  return html || '<p style="color:rgba(255,255,255,0.3)">No content to display.</p>';
}

/* ── COMBINED SUMMARY MODAL ─────────────── */
function openCombinedModal(data) {
  const modal = document.getElementById('combinedOverlay');

  // Platforms row
  const platforms = data.platforms || [];
  document.getElementById('cmPlatforms').innerHTML = platforms
    .map(p => `<span class="cb-platform" style="background:${sourceColor(p)}22;color:${sourceColor(p)};border:1px solid ${sourceColor(p)}44">${escHtml(p)}</span>`)
    .join('');

  document.getElementById('cmCount').textContent =
    `${data.searchCount || platforms.length} sources combined`;

  document.getElementById('cmTopic').textContent = data.topic || '';

  // Render combined summary — supports paragraphs, • bullets, **bold**, (Platform) citations
  const bodyEl = document.getElementById('cmBody');
  const txt = (data.combinedSummary || '').trim();
  if (txt) {
    bodyEl.innerHTML = renderCombinedText(txt);
  } else {
    bodyEl.innerHTML = '<p style="color:rgba(255,255,255,0.3)">Could not generate combined summary.</p>';
  }

  modal.classList.add('open');
  modal.onclick = function(e) {
    if (e.target === this) closeCombinedModal();
  };
}
function closeCombinedModal() {
  document.getElementById('combinedOverlay').classList.remove('open');
}

/* ── COMBINE ACTION ─────────────────────── */
async function doCombine() {
  if (selectedItems.size < 2) {
    showToast('Select at least 2 searches to combine', 'error');
    return;
  }

  const ids    = [...selectedItems.keys()];
  const items  = [...selectedItems.values()];

  // Use the most common query as the topic (or the first one)
  const topic = items[0].query;

  // Show loading state on button
  const btn = document.getElementById('combineBtn');
  const originalHTML = btn.innerHTML;
  btn.disabled  = true;
  btn.innerHTML = `<span class="cb-spinner"></span> Combining…`;

  try {
    const res = await fetch(API.combine, {
      method:  'POST',
      headers: await authHeaders(),
      body:    JSON.stringify({ topic, searchIds: ids })
    });

    if (res.status === 401) { logout(); return; }

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Combine failed — try again', 'error');
      btn.disabled  = false;
      btn.innerHTML = originalHTML;
      return;
    }

    // Success — open the combined modal
    data.topic = topic;
    openCombinedModal(data);

    // Exit select mode
    exitSelectMode();

  } catch (err) {
    console.error('[Recall AI] Combine error:', err);
    showToast('Network error — is the backend running?', 'error');
    btn.disabled  = false;
    btn.innerHTML = originalHTML;
  }
}

/* ── SELECT ALL ─────────────────────────── */
function toggleSelectAll() {
  const filtered = getFilteredSearches().slice(0, displayedCount);
  if (selectedItems.size === filtered.length) {
    // All selected → deselect all
    exitSelectMode();
  } else {
    // Select all visible
    filtered.forEach(s => selectedItems.set(s.id, s));
    enterSelectMode();
    // Update checkboxes in DOM
    document.querySelectorAll('.hi-row').forEach(row => {
      const id = Number(row.dataset.id) || row.dataset.id;
      if (selectedItems.has(id) || selectedItems.has(String(id))) {
        const cb = row.querySelector('.hi-checkbox');
        if (cb) cb.checked = true;
        row.classList.add('hi-row--selected');
      }
    });
    updateCombineBar();
  }
}

/* ── DELETE ─────────────────────────────── */
async function doDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('open');

  try {
    const res = await fetch(API.delete + id, {
      method: 'DELETE', headers: await authHeaders()
    });
    if (res.status === 401) { logout(); return; }
    if (res.ok) {
      allSearches = allSearches.filter(s => s.id !== id && s.id !== Number(id));
      // Also remove from selection if present
      selectedItems.delete(id);
      selectedItems.delete(Number(id));
      renderTimeline(getFilteredSearches());
      updateCombineBar();
      showToast('Search deleted', 'success');
    } else {
      showToast('Could not delete — try again', 'error');
    }
  } catch (err) {
    showToast('Delete failed', 'error');
    console.error('[Recall AI] Delete error:', err);
  }
}

/* ── FILTERING ──────────────────────────── */
function getFilteredSearches() {
  let result = allSearches;
  if (activeTag !== 'All') {
    result = result.filter(s => (s.tag || 'Other') === activeTag);
  }
  return result;
}

function applyFilter(tag) {
  activeTag = tag;
  document.querySelectorAll('.filter-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.tag === tag);
  });
  const label = document.getElementById('filterLabel');
  label.textContent = tag === 'All' ? 'Filter' : tag;
  closeDropdown();
  displayedCount = PAGE_SIZE;
  exitSelectMode();
  renderTimeline(getFilteredSearches());
}

/* ── SEARCH ─────────────────────────────── */
function handleSearch(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderTimeline(getFilteredSearches()); return; }
  searchTimer = setTimeout(() => {
    const filtered = getFilteredSearches().filter(s =>
      (s.query   || '').toLowerCase().includes(q) ||
      (s.summary || '').toLowerCase().includes(q) ||
      (s.tag     || '').toLowerCase().includes(q)
    );
    renderTimeline(filtered);
  }, 300);
}

/* ── FILTER DROPDOWN ────────────────────── */
function toggleDropdown() { document.getElementById('filterDropdown').classList.toggle('open'); }
function closeDropdown()  { document.getElementById('filterDropdown').classList.remove('open'); }

/* ── LOAD MORE ──────────────────────────── */
function loadMore() {
  displayedCount += PAGE_SIZE;
  renderTimeline(getFilteredSearches());
}

/* ── PROFILE ────────────────────────────── */
function getProfileData() {
  try { const r = localStorage.getItem('recallai_profile'); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function makeInitials(fn, ln) {
  return [(fn||'')[0],(ln||'')[0]].filter(Boolean).join('').toUpperCase() || '?';
}
function applyProfileToHeader() {
  const p = getProfileData();
  if (!p) {
    try {
      chrome.storage.local.get(['recall_user'], (s) => {
        try {
          const u = typeof s.recall_user === 'string'
            ? JSON.parse(s.recall_user || '{}') : (s.recall_user || {});
          const nameEl = document.getElementById('userName');
          if (nameEl && u.name) nameEl.textContent = u.name;
          const emailEl = document.getElementById('userEmailDisplay');
          if (emailEl && u.email) emailEl.textContent = u.email;
          const initialsEl = document.getElementById('historyInitials');
          if (initialsEl && u.name) {
            const parts = u.name.trim().split(/\s+/);
            initialsEl.textContent = parts.length > 1
              ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
              : parts[0].slice(0,2).toUpperCase();
          }
        } catch {}
      });
    } catch {}
    return;
  }
  const fullName = [p.firstName,p.lastName].filter(Boolean).join(' ') || p.displayName || '';
  const email    = p.email || '';
  const initials = makeInitials(p.firstName, p.lastName);
  const nameEl = document.getElementById('userName');
  if (nameEl && fullName) nameEl.textContent = fullName;
  const emailEl = document.getElementById('userEmailDisplay');
  if (emailEl && email) emailEl.textContent = email;
  const initialsEl = document.getElementById('historyInitials');
  if (initialsEl) initialsEl.textContent = initials;
  if (p.avatarSrc) {
    const avatarEl = document.getElementById('historyAvatar');
    if (avatarEl) {
      avatarEl.style.backgroundImage    = `url('${p.avatarSrc}')`;
      avatarEl.style.backgroundSize     = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      const span = avatarEl.querySelector('span');
      if (span) span.style.display = 'none';
    }
  }
}

/* ── LOAD DATA ──────────────────────────── */
async function loadHistory() {
  try {
    const res = await fetch(API.history, { headers: await authHeaders() });
    if (res.status === 401) { logout(); return; }
    if (res.ok) {
      const data  = await res.json();
      allSearches = data.searches || [];
      renderTimeline(getFilteredSearches());
    } else {
      renderTimeline([]);
    }
    applyProfileToHeader();
    const profileCard = document.getElementById('profileCard');
    if (profileCard) {
      const go = () => { window.location.href = '../profile-page/profile.html'; };
      profileCard.addEventListener('click', go);
      profileCard.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') go(); });
    }
  } catch (err) {
    console.error('[Recall AI] History load error:', err);
    renderTimeline([]);
  }
}

/* ── INIT ───────────────────────────────── */
function init() {
  // Search input
  const si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', handleSearch);

  // Filter button
  const fb = document.getElementById('filterBtn');
  if (fb) fb.addEventListener('click', function(e) { e.stopPropagation(); toggleDropdown(); });

  // Filter options
  document.querySelectorAll('.filter-option').forEach(opt => {
    opt.addEventListener('click', function() { applyFilter(opt.dataset.tag); });
  });

  // Close dropdown on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.filter-wrap')) closeDropdown();
  });

  // Summary modal close
  const smClose = document.getElementById('smClose');
  if (smClose) smClose.addEventListener('click', closeSummaryModal);

  // Confirm delete
  document.getElementById('confirmCancel').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('confirmOverlay').classList.remove('open');
  });
  document.getElementById('confirmDelete').addEventListener('click', doDelete);

  // Load more
  const lmBtn = document.getElementById('loadMoreBtn');
  if (lmBtn) lmBtn.addEventListener('click', loadMore);

  // New query FAB - opens platform selector popup
  const nqBtn = document.getElementById('newQueryBtn');
  if (nqBtn) {
    nqBtn.addEventListener('click', function(e) {
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

  // Notifications
  const nb = document.getElementById('notifBtn');
  if (nb) nb.addEventListener('click', () => showToast('No new notifications', 'success'));

  // Escape key closes everything
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSummaryModal();
      closeCombinedModal();
      closeDropdown();
      if (selectMode) exitSelectMode();
    }
  });

  // ── Combine bar buttons ──────────────────
  const combineBtn = document.getElementById('combineBtn');
  if (combineBtn) combineBtn.addEventListener('click', doCombine);

  const cancelSelectBtn = document.getElementById('cancelSelectBtn');
  if (cancelSelectBtn) cancelSelectBtn.addEventListener('click', exitSelectMode);

  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) selectAllBtn.addEventListener('click', toggleSelectAll);

  // ── Combined modal close ─────────────────
  const cmClose = document.getElementById('cmClose');
  if (cmClose) cmClose.addEventListener('click', closeCombinedModal);

  // Copy combined summary
  const cmCopy = document.getElementById('cmCopy');
  if (cmCopy) cmCopy.addEventListener('click', () => {
    const text = document.getElementById('cmBody').innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Summary copied to clipboard!', 'success');
    }).catch(() => showToast('Could not copy', 'error'));
  });
}

/* ── BOOT ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function() {
  await checkAuth();
  init();
  loadHistory();
});
