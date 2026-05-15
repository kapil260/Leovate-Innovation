/* ─────────────────────────────────────────
   RECALL AI — dashboard.js
   All dashboard logic in one place.
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG — update to match your backend
───────────────────────────────────────── */
const API = {
  history:     '/api/history',         // GET  → returns history cards
  loadMore:    '/api/history?page=',   // GET  → paginated
  analysis:    '/api/insights',        // GET  → weekly analysis
  search:      '/api/search?q=',       // GET  → search results
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  searchInput:   document.getElementById('searchInput'),
  notifBtn:      document.getElementById('notifBtn'),
  viewAnalysis:  document.getElementById('viewAnalysisBtn'),
  filterBtns:    document.querySelectorAll('.filter-btn'),
  historyGrid:   document.getElementById('historyGrid'),
  loadMoreBtn:   document.getElementById('loadMoreBtn'),
  exportBtn:     document.getElementById('exportBtn'),
  fabBtn:        document.getElementById('fabBtn'),
  navLinks:      document.querySelectorAll('.nav-link'),
  cardBtns:      document.querySelectorAll('.card-action-btn'),
  historyCards:  document.querySelectorAll('.history-card'),
  activityItems: document.querySelectorAll('.container13'),
  toast:         document.getElementById('toast'),
  toastIcon:     document.getElementById('toastIcon'),
  toastMsg:      document.getElementById('toastMsg'),
};

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
let currentPage   = 1;
let currentFilter = 'all';
let searchTimer   = null;

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
let toastTimer = null;

function showToast(message, type) {
  type = type || 'success';
  clearTimeout(toastTimer);

  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className       = 'toast toast-' + type + ' show';

  toastTimer = setTimeout(function () {
    dom.toast.classList.remove('show');
  }, 3000);
}

/* ─────────────────────────────────────────
   FILTER TABS
───────────────────────────────────────── */
function setActiveFilter(btn) {
  dom.filterBtns.forEach(function (b) {
    b.classList.remove('button3', 'active-filter');
    b.classList.add('button4');
    b.querySelector('div').className = 'text10';
  });

  btn.classList.remove('button4');
  btn.classList.add('button3', 'active-filter');
  btn.querySelector('div').className = 'text9';

  currentFilter = btn.dataset.filter;
  filterCards(currentFilter);
}

function filterCards(filter) {
  /* ── Wire your own filter logic here ──
     Example: show/hide cards by data attribute.
     Currently just shows all cards for demo. */
  dom.historyCards.forEach(function (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';

    setTimeout(function () {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, 50);
  });
}

/* ─────────────────────────────────────────
   SEARCH
───────────────────────────────────────── */
function handleSearch(e) {
  clearTimeout(searchTimer);
  var query = e.target.value.trim();

  if (!query) return;

  searchTimer = setTimeout(async function () {
    try {
      /* Uncomment when backend is ready:
      var res  = await fetch(API.search + encodeURIComponent(query));
      var data = await res.json();
      renderSearchResults(data);
      */
      console.log('[Recall AI] Search query:', query);
    } catch (err) {
      console.error('[Recall AI] Search error:', err);
    }
  }, 400);
}

/* ─────────────────────────────────────────
   LOAD MORE
───────────────────────────────────────── */
async function loadMore() {
  var btn      = dom.loadMoreBtn;
  var original = btn.querySelector('.load-more-history').textContent;

  btn.querySelector('.load-more-history').textContent = 'Loading…';
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';

  try {
    currentPage++;

    /* Uncomment when backend is ready:
    var res  = await fetch(API.loadMore + currentPage);
    var data = await res.json();
    appendCards(data.cards);
    if (!data.hasMore) btn.style.display = 'none';
    */

    // Demo delay
    await new Promise(function (r) { setTimeout(r, 800); });
    showToast('All history loaded', 'success');

  } catch (err) {
    showToast('Failed to load history', 'error');
    console.error('[Recall AI] Load more error:', err);
  } finally {
    btn.querySelector('.load-more-history').textContent = original;
    btn.style.opacity      = '1';
    btn.style.pointerEvents = 'auto';
  }
}

/* ─────────────────────────────────────────
   VIEW ANALYSIS
───────────────────────────────────────── */
async function viewAnalysis() {
  try {
    /* Uncomment when backend is ready:
    var res  = await fetch(API.analysis);
    var data = await res.json();
    // e.g. open a modal with data
    */
    showToast('Opening analysis report…', 'success');
    // window.location.href = '/analysis';
  } catch (err) {
    showToast('Could not load analysis', 'error');
    console.error('[Recall AI] Analysis error:', err);
  }
}

/* ─────────────────────────────────────────
   OPEN HISTORY CARD
───────────────────────────────────────── */
function openCard(card) {
  var id    = card.dataset.id;
  var title = card.querySelector('.card-title-text').textContent;
  showToast('Opening: ' + title, 'success');
  // window.location.href = '/session/' + id;
}

/* ─────────────────────────────────────────
   FAB — NEW SESSION
───────────────────────────────────────── */
function newSession() {
  showToast('Starting new neural session…', 'success');
  // window.location.href = '/new-session';
}

/* ─────────────────────────────────────────
   EXPORT
───────────────────────────────────────── */
function exportHistory() {
  showToast('Exporting neural history…', 'success');
  /* Uncomment when backend is ready:
  window.location.href = '/api/history/export';
  */
}

/* ─────────────────────────────────────────
   NOTIFICATIONS
───────────────────────────────────────── */
function toggleNotifications() {
  showToast('No new notifications', 'success');
  // Open a notifications panel here
}

/* ─────────────────────────────────────────
   ACTIVITY ITEMS
───────────────────────────────────────── */
function handleActivityClick(item) {
  var title = item.querySelector('.what-is-ai, .text7');
  if (title) {
    showToast('Opening: ' + title.textContent, 'success');
  }
}

/* ─────────────────────────────────────────
   CARD ENTRY ANIMATION
───────────────────────────────────────── */
function animateCardsIn() {
  dom.historyCards.forEach(function (card, i) {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(20px)';

    setTimeout(function () {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, 80 * i);
  });
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */
function init() {

  // Search
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', handleSearch);
  }

  // Filter tabs
  dom.filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { setActiveFilter(btn); });
  });

  // View Analysis button
  if (dom.viewAnalysis) {
    dom.viewAnalysis.addEventListener('click', viewAnalysis);
  }

  // Load more
  if (dom.loadMoreBtn) {
    dom.loadMoreBtn.addEventListener('click', loadMore);
  }

  // Export button
  if (dom.exportBtn) {
    dom.exportBtn.addEventListener('click', exportHistory);
  }

  // FAB
  if (dom.fabBtn) {
    dom.fabBtn.addEventListener('click', newSession);
  }

  // Notification button
  if (dom.notifBtn) {
    dom.notifBtn.addEventListener('click', toggleNotifications);
  }

  // History card open buttons
  dom.cardBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openCard(btn.closest('.history-card'));
    });
  });

  // Clicking the whole card also opens it
  dom.historyCards.forEach(function (card) {
    card.addEventListener('click', function () { openCard(card); });
  });

  // Activity items
  dom.activityItems.forEach(function (item) {
    item.addEventListener('click', function () { handleActivityClick(item); });
  });

  // Entry animations
  animateCardsIn();
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);