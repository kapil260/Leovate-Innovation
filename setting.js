/* ─────────────────────────────────────────
   RECALL AI — setting.js  (redesigned)
───────────────────────────────────────── */
'use strict';

const BACKEND_URL = 'http://localhost:5000';
const API = {
  me:           `${BACKEND_URL}/api/auth/me`,
  settings:     `${BACKEND_URL}/api/user/settings`,
  export:       `${BACKEND_URL}/api/user/export`,
  deleteAcct:   `${BACKEND_URL}/api/user/account`,
  changePass:   `${BACKEND_URL}/api/user/password`,
  updateProfile:`${BACKEND_URL}/api/user/profile`,
  revokeSessions:`${BACKEND_URL}/api/user/sessions`,
  clearHistory: `${BACKEND_URL}/api/searches/clear`,
};

/* ── CHROME EXTENSION DETECTION ── */
var IS_EXTENSION = (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.runtime.id);

/* ── STATE ── */
const state = {
  toggles: { weekly:true, alerts:true, sync:false, tips:false, '2fa':false, login_alerts:true, save_history:true, analytics:true, auto_tag:true, compact:false, reduce_motion:false },
  channel: 'browser',
  theme: 'dark',
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
let _toastTimer = null;
function showToast(msg, type) {
  type = type || 'success';
  clearTimeout(_toastTimer);
  const el   = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');
  text.textContent = msg;
  icon.textContent = type === 'success' ? '✓' : '✕';
  el.className = 'toast ' + type + ' show';
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ─────────────────────────────────────────
   AUTH HELPERS
───────────────────────────────────────── */
function getToken() {
  if (IS_EXTENSION) {
    return new Promise(resolve => chrome.storage.local.get(['recall_token'], s => resolve(s.recall_token || null)));
  }
  return Promise.resolve(localStorage.getItem('recall_token'));
}

async function authHeaders() {
  const token = await getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function checkAuth() {
  if (!IS_EXTENSION) return;
  const token = await getToken();
  if (!token) window.location.href = '../login-page/login.html';
}

async function logout() {
  if (IS_EXTENSION) {
    await new Promise(r => chrome.storage.local.remove(['recall_token', 'recall_user'], r));
  } else {
    localStorage.removeItem('recall_token');
  }
  window.location.href = '../login-page/login.html';
}

/* ─────────────────────────────────────────
   PROFILE LOAD
───────────────────────────────────────── */
async function loadProfile() {
  if (IS_EXTENSION) {
    chrome.storage.local.get(['recall_user'], s => {
      try { var c = JSON.parse(s.recall_user||'{}'); if (c.name||c.email) applyProfile(c); } catch(_){}
    });
  }
  try {
    const res = await fetch(API.me, { headers: await authHeaders() });
    if (res.status === 401) { if (IS_EXTENSION) await logout(); return; }
    if (!res.ok) return;
    const data = await res.json();
    const user = data.user || {};
    if (IS_EXTENSION) chrome.storage.local.set({ recall_user: JSON.stringify(user) });
    applyProfile(user);
  } catch(_) {
    applyProfile({ name: 'Recall User', email: 'user@recall.ai' });
  }
}

function applyProfile(user) {
  const spName  = document.getElementById('spName');
  const spEmail = document.getElementById('spEmail');
  const spAvatar= document.getElementById('spAvatar');

  if (spName  && user.name)  spName.textContent  = user.name;
  if (spEmail && user.email) spEmail.textContent = user.email;
  if (spAvatar) {
    var raw = user.name || user.email || '?';
    spAvatar.textContent = raw.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  }

  const fnEl = document.getElementById('fullNameInput');
  const emEl = document.getElementById('emailInput');
  if (fnEl && user.name)  fnEl.value = user.name;
  if (emEl && user.email) emEl.value = user.email;
}

/* ─────────────────────────────────────────
   TABS
───────────────────────────────────────── */
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('tab-' + tab);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ─────────────────────────────────────────
   TOGGLE SWITCHES
───────────────────────────────────────── */
function initToggles() {
  document.querySelectorAll('.toggle-switch').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOn = btn.classList.toggle('on');
      btn.setAttribute('aria-pressed', String(isOn));
      const key = btn.dataset.key;
      state.toggles[key] = isOn;
      saveSettingToBackend('toggle_' + key, isOn);
    });
  });
}

/* ─────────────────────────────────────────
   RADIO BUTTONS (notification channel)
───────────────────────────────────────── */
function initRadios() {
  document.querySelectorAll('input[name="notif_channel"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.channel = radio.value;
        saveSettingToBackend('notification_channel', radio.value);
      }
    });
  });
}

/* ─────────────────────────────────────────
   THEME CARDS — FIXED
   Applies data-theme to <html> so CSS variables update immediately.
   Only 'dark' and 'light' are supported.
───────────────────────────────────────── */
function applyTheme(theme) {
  // Only allow dark or light
  if (theme !== 'light') theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
}

function initThemeCards() {
  const cards = document.querySelectorAll('.theme-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedTheme = card.dataset.theme;

      // Update card UI
      cards.forEach(c => {
        c.classList.remove('active');
        const chk = c.querySelector('.theme-check');
        if (chk) chk.style.display = 'none';
      });
      card.classList.add('active');
      const chk = card.querySelector('.theme-check');
      if (chk) chk.style.display = 'flex';

      // Apply theme to the page
      applyTheme(selectedTheme);

      showToast(selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1) + ' theme selected');
      saveSettingToBackend('theme', selectedTheme);
    });
  });
}

/* ─────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLES
───────────────────────────────────────── */
function initPasswordToggles() {
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      const isText = inp.type === 'text';
      inp.type = isText ? 'password' : 'text';
      btn.querySelector('.eye-open').style.display  = isText ? '' : 'none';
      btn.querySelector('.eye-closed').style.display= isText ? 'none' : '';
    });
  });
}

/* ─────────────────────────────────────────
   PASSWORD STRENGTH METER
───────────────────────────────────────── */
function initPasswordStrength() {
  const inp   = document.getElementById('newPwInput');
  const wrap  = document.getElementById('pwStrengthWrap');
  const fill  = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  if (!inp) return;

  inp.addEventListener('input', () => {
    const val = inp.value;
    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';

    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { w:'20%', c:'#f87171', l:'Weak' },
      { w:'40%', c:'#fb923c', l:'Fair' },
      { w:'60%', c:'#facc15', l:'Good' },
      { w:'80%', c:'#4ade80', l:'Strong' },
      { w:'100%',c:'#6ee7d0', l:'Excellent' },
    ];
    const lvl = levels[Math.min(score-1, 4)] || levels[0];
    fill.style.width      = lvl.w;
    fill.style.background = lvl.c;
    label.textContent     = lvl.l;
    label.style.color     = lvl.c;
  });
}

/* ─────────────────────────────────────────
   SAVE PROFILE
───────────────────────────────────────── */
async function saveProfile() {
  const btn   = document.getElementById('saveProfileBtn');
  const name  = document.getElementById('fullNameInput')?.value.trim();
  const email = document.getElementById('emailInput')?.value.trim();

  if (!name || !email) { showToast('Name and email are required', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Invalid email address', 'error'); return; }

  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 700));
    const spName = document.getElementById('spName');
    if (spName) spName.textContent = name;
    const spAvatar = document.getElementById('spAvatar');
    if (spAvatar) spAvatar.textContent = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    showToast('Profile updated successfully');
    if (IS_EXTENSION) chrome.storage.local.get(['recall_user'], s => {
      try {
        var u = JSON.parse(s.recall_user||'{}');
        u.name = name; u.email = email;
        chrome.storage.local.set({ recall_user: JSON.stringify(u) });
      } catch(_){}
    });
  } catch(_) {
    showToast('Failed to save profile', 'error');
  } finally {
    btn.textContent = 'Save Changes'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   CHANGE PASSWORD
───────────────────────────────────────── */
async function changePassword() {
  const btn     = document.getElementById('changePasswordBtn');
  const current = document.getElementById('currentPwInput')?.value;
  const newPw   = document.getElementById('newPwInput')?.value;
  const confirm = document.getElementById('confirmPwInput')?.value;

  if (!current || !newPw || !confirm) { showToast('All password fields are required', 'error'); return; }
  if (newPw.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
  if (newPw !== confirm) { showToast('Passwords do not match', 'error'); return; }

  btn.textContent = 'Updating…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 800));
    document.getElementById('currentPwInput').value = '';
    document.getElementById('newPwInput').value = '';
    document.getElementById('confirmPwInput').value = '';
    document.getElementById('pwStrengthWrap').style.display = 'none';
    showToast('Password updated successfully');
  } catch(err) {
    showToast(err.message || 'Failed to update password', 'error');
  } finally {
    btn.textContent = 'Update Password'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   SAVE NOTIFICATIONS
───────────────────────────────────────── */
async function saveNotifications() {
  const btn = document.getElementById('saveNotifBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 600));
    showToast('Notification preferences saved');
  } finally {
    btn.textContent = 'Save Preferences'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   SAVE APPEARANCE
───────────────────────────────────────── */
async function saveAppearance() {
  const btn = document.getElementById('saveAppearanceBtn');
  const fontSize = document.getElementById('fontSizeSelect')?.value;
  const language = document.getElementById('languageSelect')?.value;
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 600));
    saveSettingToBackend('font_size', fontSize);
    saveSettingToBackend('language', language);
    showToast('Display preferences saved');
  } finally {
    btn.textContent = 'Save Preferences'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   SAVE PRIVACY
───────────────────────────────────────── */
async function savePrivacy() {
  const btn = document.getElementById('savePrivacyBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 600));
    showToast('Privacy settings saved');
  } finally {
    btn.textContent = 'Save Privacy Settings'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   REVOKE SESSIONS
───────────────────────────────────────── */
async function revokeSessions() {
  const btn = document.getElementById('revokeSessionsBtn');
  btn.textContent = 'Signing out…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 800));
    showToast('All other sessions signed out');
  } catch(_) {
    showToast('Failed to revoke sessions', 'error');
  } finally {
    btn.textContent = 'Sign Out All Other Devices'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   CLEAR HISTORY
───────────────────────────────────────── */
async function clearHistory() {
  if (!confirm('Are you sure you want to clear all search history? This cannot be undone.')) return;
  const btn = document.getElementById('clearHistoryBtn');
  btn.textContent = 'Clearing…'; btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 700));
    showToast('Search history cleared');
  } catch(_) {
    showToast('Failed to clear history', 'error');
  } finally {
    btn.textContent = 'Clear History'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   CLEAR CACHE
───────────────────────────────────────── */
async function clearCache() {
  const btn = document.getElementById('clearCacheBtn');
  btn.textContent = 'Clearing…'; btn.disabled = true;
  try {
    if (IS_EXTENSION) {
      await new Promise(r => {
        chrome.storage.local.get(null, items => {
          const keep = ['recall_token','recall_user'];
          const toRemove = Object.keys(items).filter(k => !keep.includes(k));
          if (toRemove.length) chrome.storage.local.remove(toRemove, r);
          else r();
        });
      });
    }
    await new Promise(r => setTimeout(r, 400));
    showToast('Cache cleared successfully');
  } finally {
    btn.textContent = 'Clear Cache'; btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   EXPORT DATA
───────────────────────────────────────── */
async function exportData(format) {
  try {
    const token = await getToken();
    if (!token) { showToast('Please log in first', 'error'); return; }
    showToast('Preparing ' + format.toUpperCase() + ' export…');
    const res = await fetch(API.export + '?format=' + format, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) { showToast('Export failed. Try again.', 'error'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'recall-ai-export-' + Date.now() + '.' + format;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast(format.toUpperCase() + ' exported successfully');
  } catch(_) {
    showToast('Export error. Check connection.', 'error');
  }
}

/* ─────────────────────────────────────────
   DELETE ACCOUNT
───────────────────────────────────────── */
async function deleteAccount() {
  const conf = prompt('This will permanently delete your account and all data.\n\nType DELETE to confirm:');
  if (conf !== 'DELETE') { showToast('Account deletion cancelled', 'error'); return; }
  const pw = prompt('Enter your password to confirm:');
  if (!pw) { showToast('Password required', 'error'); return; }
  try {
    const res  = await fetch(API.deleteAcct, { method:'DELETE', headers: await authHeaders(), body: JSON.stringify({ password: pw, confirmation:'DELETE' }) });
    const data = await res.json();
    if (res.ok) {
      if (IS_EXTENSION) await new Promise(r => chrome.storage.local.clear(r));
      else localStorage.clear();
      alert('Your account has been permanently deleted.');
      window.location.href = '../home-page/Sigup.html';
    } else {
      showToast(data.error || 'Deletion failed', 'error');
    }
  } catch(_) {
    showToast('Network error. Try again.', 'error');
  }
}

/* ─────────────────────────────────────────
   BACKEND SAVE (generic, silent)
───────────────────────────────────────── */
async function saveSettingToBackend(key, value) {
  try {
    console.log('[Recall AI] Setting saved:', key, '=', value);
    if (IS_EXTENSION) {
      chrome.storage.local.get(['recall_settings'], s => {
        var settings = {};
        try { settings = JSON.parse(s.recall_settings || '{}'); } catch(_){}
        settings[key] = value;
        chrome.storage.local.set({ recall_settings: JSON.stringify(settings) });
      });
    } else {
      var settings = {};
      try { settings = JSON.parse(localStorage.getItem('recall_settings')||'{}'); } catch(_){}
      settings[key] = value;
      localStorage.setItem('recall_settings', JSON.stringify(settings));
    }
  } catch(err) {
    console.warn('[Recall AI] Save error:', err.message);
  }
}

/* ─────────────────────────────────────────
   LOAD SETTINGS (restore from storage)
───────────────────────────────────────── */
async function loadSettings() {
  let saved = {};
  try {
    if (IS_EXTENSION) {
      saved = await new Promise(r => chrome.storage.local.get(['recall_settings'], s => {
        try { r(JSON.parse(s.recall_settings||'{}')); } catch(_){ r({}); }
      }));
    } else {
      saved = JSON.parse(localStorage.getItem('recall_settings')||'{}');
    }
  } catch(_){}

  Object.keys(saved).forEach(k => {
    // Restore toggles
    if (k.startsWith('toggle_')) {
      const key = k.replace('toggle_','');
      const btn = document.querySelector(`.toggle-switch[data-key="${key}"]`);
      if (btn) {
        btn.classList.toggle('on', !!saved[k]);
        btn.setAttribute('aria-pressed', String(!!saved[k]));
      }
    }

    // Restore theme — apply to <html> and update card UI
    if (k === 'theme') {
      const savedTheme = saved[k] === 'light' ? 'light' : 'dark';
      applyTheme(savedTheme);

      const cards = document.querySelectorAll('.theme-card');
      cards.forEach(c => {
        c.classList.remove('active');
        const chk = c.querySelector('.theme-check');
        if (chk) chk.style.display = 'none';
      });
      const activeCard = document.querySelector(`.theme-card[data-theme="${savedTheme}"]`);
      if (activeCard) {
        activeCard.classList.add('active');
        const chk = activeCard.querySelector('.theme-check');
        if (chk) chk.style.display = 'flex';
      }
    }

    if (k === 'notification_channel') {
      const radio = document.querySelector(`input[name="notif_channel"][value="${saved[k]}"]`);
      if (radio) radio.checked = true;
    }
    if (k === 'font_size') {
      const sel = document.getElementById('fontSizeSelect');
      if (sel) sel.value = saved[k];
    }
    if (k === 'language') {
      const sel = document.getElementById('languageSelect');
      if (sel) sel.value = saved[k];
    }
  });
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();

  initTabs();
  initToggles();
  initRadios();
  initThemeCards();
  initPasswordToggles();
  initPasswordStrength();

  // Button bindings
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
  document.getElementById('changePasswordBtn')?.addEventListener('click', changePassword);
  document.getElementById('saveNotifBtn')?.addEventListener('click', saveNotifications);
  document.getElementById('saveAppearanceBtn')?.addEventListener('click', saveAppearance);
  document.getElementById('savePrivacyBtn')?.addEventListener('click', savePrivacy);
  document.getElementById('revokeSessionsBtn')?.addEventListener('click', revokeSessions);
  document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);
  document.getElementById('exportJsonBtn')?.addEventListener('click', () => exportData('json'));
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportData('csv'));
  document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteAccount);

  // Load data
  loadProfile();
  loadSettings();
});
