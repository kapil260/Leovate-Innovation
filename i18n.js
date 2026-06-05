/* ═══════════════════════════════════════════════════════════════
   RECALL AI — i18n.js  (Shared Language File)
   Include this in every page BEFORE the page's own JS file.
   It reads the saved language from chrome.storage and
   automatically translates all nav items and page text.
═══════════════════════════════════════════════════════════════ */
'use strict';

const RECALL_TRANSLATIONS = {
  en: {
    nav_dashboard:    'DASHBOARD',
    nav_history:      'HISTORY',
    nav_settings:     'SETTINGS',
    nav_subscription: 'SUBSCRIPTION',
    nav_profile:      'PROFILE',
    page_history:     'History',
    page_dashboard:   'Dashboard',
    page_settings:    'Settings',
    filter_label:     'Filter',
    filter_all:       'All Tags',
    filter_tech:      '⚡ Tech',
    filter_science:   '🔬 Science',
    filter_health:    '🏥 Health',
    filter_finance:   '💰 Finance',
    filter_history:   '📜 History',
    filter_other:     '🌐 Other',
    combine_btn:      'Summarize All',
    combine_label:    'selected',
    combine_hint:     'Select searches to combine',
    no_results:       'No searches found',
    load_more:        'Load More',
    today:            'Today',
    yesterday:        'Yesterday',
    this_week:        'This Week',
    older:            'Older',
  },
  np: {
    nav_dashboard:    'ड्यासबोर्ड',
    nav_history:      'इतिहास',
    nav_settings:     'सेटिङ',
    nav_subscription: 'सदस्यता',
    nav_profile:      'प्रोफाइल',
    page_history:     'इतिहास',
    page_dashboard:   'ड्यासबोर्ड',
    page_settings:    'सेटिङ',
    filter_label:     'फिल्टर',
    filter_all:       'सबै ट्याग',
    filter_tech:      '⚡ प्रविधि',
    filter_science:   '🔬 विज्ञान',
    filter_health:    '🏥 स्वास्थ्य',
    filter_finance:   '💰 वित्त',
    filter_history:   '📜 इतिहास',
    filter_other:     '🌐 अन्य',
    combine_btn:      'सबै सारांश गर्नुहोस्',
    combine_label:    'चयन गरिएको',
    combine_hint:     'जोड्न खोजीहरू चयन गर्नुहोस्',
    no_results:       'कुनै खोजी भेटिएन',
    load_more:        'थप लोड गर्नुहोस्',
    today:            'आज',
    yesterday:        'हिजो',
    this_week:        'यस हप्ता',
    older:            'पुरानो',
  },
  hi: {
    nav_dashboard:    'डैशबोर्ड',
    nav_history:      'इतिहास',
    nav_settings:     'सेटिंग्स',
    nav_subscription: 'सदस्यता',
    nav_profile:      'प्रोफ़ाइल',
    page_history:     'इतिहास',
    page_dashboard:   'डैशबोर्ड',
    page_settings:    'सेटिंग्स',
    filter_label:     'फ़िल्टर',
    filter_all:       'सभी टैग',
    filter_tech:      '⚡ तकनीक',
    filter_science:   '🔬 विज्ञान',
    filter_health:    '🏥 स्वास्थ्य',
    filter_finance:   '💰 वित्त',
    filter_history:   '📜 इतिहास',
    filter_other:     '🌐 अन्य',
    combine_btn:      'सभी सारांश करें',
    combine_label:    'चयनित',
    combine_hint:     'जोड़ने के लिए खोजें चुनें',
    no_results:       'कोई खोज नहीं मिली',
    load_more:        'और लोड करें',
    today:            'आज',
    yesterday:        'कल',
    this_week:        'इस सप्ताह',
    older:            'पुराना',
  },
  zh: {
    nav_dashboard:    '仪表板',
    nav_history:      '历史',
    nav_settings:     '设置',
    nav_subscription: '订阅',
    nav_profile:      '个人资料',
    page_history:     '历史',
    page_dashboard:   '仪表板',
    page_settings:    '设置',
    filter_label:     '筛选',
    filter_all:       '所有标签',
    filter_tech:      '⚡ 科技',
    filter_science:   '🔬 科学',
    filter_health:    '🏥 健康',
    filter_finance:   '💰 财经',
    filter_history:   '📜 历史',
    filter_other:     '🌐 其他',
    combine_btn:      '合并摘要',
    combine_label:    '已选',
    combine_hint:     '选择要合并的搜索',
    no_results:       '未找到搜索记录',
    load_more:        '加载更多',
    today:            '今天',
    yesterday:        '昨天',
    this_week:        '本周',
    older:            '更早',
  },
  es: {
    nav_dashboard:    'PANEL',
    nav_history:      'HISTORIAL',
    nav_settings:     'AJUSTES',
    nav_subscription: 'SUSCRIPCIÓN',
    nav_profile:      'PERFIL',
    page_history:     'Historial',
    page_dashboard:   'Panel',
    page_settings:    'Ajustes',
    filter_label:     'Filtrar',
    filter_all:       'Todas las etiquetas',
    filter_tech:      '⚡ Tecnología',
    filter_science:   '🔬 Ciencia',
    filter_health:    '🏥 Salud',
    filter_finance:   '💰 Finanzas',
    filter_history:   '📜 Historia',
    filter_other:     '🌐 Otro',
    combine_btn:      'Resumir todo',
    combine_label:    'seleccionados',
    combine_hint:     'Selecciona búsquedas para combinar',
    no_results:       'No se encontraron búsquedas',
    load_more:        'Cargar más',
    today:            'Hoy',
    yesterday:        'Ayer',
    this_week:        'Esta semana',
    older:            'Anterior',
  },
};

// Get translation value
function recallT(key) {
  const lang = window.__recallLang || 'en';
  const t = RECALL_TRANSLATIONS[lang] || RECALL_TRANSLATIONS['en'];
  return t[key] || RECALL_TRANSLATIONS['en'][key] || key;
}

// Apply translations to the current page
function recallApplyLang(lang) {
  window.__recallLang = lang;
  const t = RECALL_TRANSLATIONS[lang] || RECALL_TRANSLATIONS['en'];

  // Translate nav items — works on all pages
  const navMap = {
    'DASHBOARD':    t.nav_dashboard,
    'HISTORY':      t.nav_history,
    'SETTINGS':     t.nav_settings,
    'SUBSCRIPTION': t.nav_subscription,
    'PROFILE':      t.nav_profile,
  };

  // Find all text elements in the sidebar nav and translate them
  document.querySelectorAll('.text13, .text14').forEach(el => {
    const txt = el.textContent.trim().toUpperCase();
    if (navMap[txt]) el.textContent = navMap[txt];
  });

  // Also handle profile-style nav (uses data-i18n)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // Page heading — "History", "Dashboard", "Settings"
  const heading = document.querySelector('.heading-2 .text, h1.page-title, .page-heading');
  if (heading) {
    const txt = heading.textContent.trim();
    if (txt === 'History' || txt === t.page_history)   heading.textContent = t.page_history;
    if (txt === 'Dashboard' || txt === t.page_dashboard) heading.textContent = t.page_dashboard;
    if (txt === 'Settings' || txt === t.page_settings)   heading.textContent = t.page_settings;
  }

  // Filter button label
  const filterLabel = document.getElementById('filterLabel');
  if (filterLabel) filterLabel.textContent = t.filter_label;

  // Filter dropdown options
  const filterOptions = document.querySelectorAll('.filter-option');
  filterOptions.forEach(btn => {
    const tag = btn.getAttribute('data-tag');
    const map = {
      'All':      t.filter_all,
      'Tech':     t.filter_tech,
      'Science':  t.filter_science,
      'Health':   t.filter_health,
      'Finance':  t.filter_finance,
      'History':  t.filter_history,
      'Other':    t.filter_other,
    };
    if (tag && map[tag]) btn.textContent = map[tag];
  });

  // Combine button
  const combineBtn = document.getElementById('combineBtn');
  if (combineBtn) {
    const span = combineBtn.querySelector('span:last-child') || combineBtn;
    if (span) span.textContent = t.combine_btn;
  }

  // Page title in browser tab
  if (document.title.includes('History'))   document.title = `${t.page_history} — Recall AI`;
  if (document.title.includes('Dashboard')) document.title = `${t.page_dashboard} — Recall AI`;
  if (document.title.includes('Settings'))  document.title = `${t.page_settings} — Recall AI`;
}

// Load saved language from chrome.storage and apply immediately
async function recallInitLang() {
  try {
    // Try chrome.storage first (extension environment)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['recall_user', 'recallai_profile'], (stored) => {
        let lang = 'en';

        // Try recall_user first (set by profile save)
        if (stored.recall_user) {
          try {
            const user = typeof stored.recall_user === 'string'
              ? JSON.parse(stored.recall_user) : stored.recall_user;
            if (user.language) lang = user.language;
          } catch (e) {}
        }

        // Try recallai_profile as fallback
        if (lang === 'en' && stored.recallai_profile) {
          try {
            const profile = typeof stored.recallai_profile === 'string'
              ? JSON.parse(stored.recallai_profile) : stored.recallai_profile;
            if (profile.language) lang = profile.language;
          } catch (e) {}
        }

        // Also check localStorage
        if (lang === 'en') {
          try {
            const lsProfile = JSON.parse(localStorage.getItem('recallai_profile') || '{}');
            if (lsProfile.language) lang = lsProfile.language;
          } catch (e) {}
        }

        recallApplyLang(lang);
      });
    } else {
      // Fallback for non-extension environment
      const lsProfile = JSON.parse(localStorage.getItem('recallai_profile') || '{}');
      recallApplyLang(lsProfile.language || 'en');
    }
  } catch (e) {
    recallApplyLang('en');
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', recallInitLang);
} else {
  recallInitLang();
}
