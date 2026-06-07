/* ══════════════════════════════════════════════════════════════
   RECALL AI — profile-edit.js  v6
   ✔ Save Changes  → header name / email / location update instantly
   ✔ Avatar upload → header avatar updates the moment you pick a file
   ✔ Language      → entire UI translates immediately on select change
   ✔ Logout btn    → confirmation modal → clears auth → login redirect
   ✔ Phone field   → digits only, max 10 numbers, invalid char toast
══════════════════════════════════════════════════════════════ */
'use strict';

const BACKEND_URL = 'http://localhost:5000';
const API_PROFILE = `${BACKEND_URL}/api/user/profile`;
const STORE_KEY   = 'recallai_profile';

/* ────────────────────────────────────────────────────────────
   TRANSLATIONS
   Every string visible on the page lives here.
   Keys match data-i18n / data-i18n-placeholder attributes.
──────────────────────────────────────────────────────────── */
const TRANSLATIONS = {
  en: {
    nav_dashboard: 'Dashboard',    nav_history: 'History',
    nav_profile: 'Profile',        nav_settings: 'Settings',
    upload: 'Upload',
    badge_pro: 'Pro Member',       badge_tier: 'Tier 2 Access',
    save_changes: 'Save Changes',
    personal_info: 'Personal Info',
    first_name: 'First Name',      last_name: 'Last Name',
    display_name: 'Display Name',  bio: 'Bio',   location: 'Location',
    ph_first_name: 'First name',   ph_last_name: 'Last name',
    ph_display_name: '@username',  ph_bio: 'Tell us about yourself...',
    ph_location: 'City, Country',
    contact_identity: 'Contact & Identity',
    email: 'Email Address',        phone: 'Phone Number',
    timezone: 'Timezone',          language: 'Language',
    ph_email: 'you@example.com',   ph_phone: '+1 234 567 8900',
    logout_title: 'Log Out',
    logout_desc: 'Sign out of your Recall AI account on this device.',
    logout_btn: 'Log Out',
    danger_zone: 'Danger Zone',
    danger_desc: 'Permanently delete your account and all data. This cannot be undone.',
    delete_account: 'Delete Account',
    delete_verify_msg: 'Account deletion requires email verification',
    privacy: 'Privacy Protocol',   terms: 'Terms & Conditions',
    modal_logout_title: 'Log Out?',
    modal_logout_desc: "You'll need to sign in again to access your Recall AI account.",
    cancel: 'Cancel',              yes_logout: 'Yes, Log Out',
    toast_saved: 'Profile saved successfully ✓',
    toast_avatar: 'Profile picture updated ✓',
    toast_local: 'Saved locally — will sync when online',
    toast_invalid_email: 'Please enter a valid email address',
    toast_img_large: 'Image too large — max 5 MB',
    toast_delete: 'Account deletion requires email verification',
    toast_invalid_char: 'Invalid character — numbers only',
    toast_phone_limit: 'Maximum 10 digits allowed',
    saving: 'Saving…',
  },
  np: {
    nav_dashboard: 'ड्यासबोर्ड',  nav_history: 'इतिहास',
    nav_profile: 'प्रोफाइल',      nav_settings: 'सेटिङ',
    upload: 'अपलोड',
    badge_pro: 'प्रो सदस्य',      badge_tier: 'स्तर २ पहुँच',
    save_changes: 'परिवर्तन सुरक्षित गर्नुहोस्',
    personal_info: 'व्यक्तिगत जानकारी',
    first_name: 'पहिलो नाम',       last_name: 'थर',
    display_name: 'प्रदर्शन नाम',  bio: 'परिचय',  location: 'स्थान',
    ph_first_name: 'पहिलो नाम',    ph_last_name: 'थर',
    ph_display_name: '@प्रयोगकर्ता', ph_bio: 'आफ्नो बारेमा लेख्नुहोस्...',
    ph_location: 'शहर, देश',
    contact_identity: 'सम्पर्क र पहिचान',
    email: 'इमेल ठेगाना',          phone: 'फोन नम्बर',
    timezone: 'समय क्षेत्र',       language: 'भाषा',
    ph_email: 'tapai@udaharan.com', ph_phone: '+977 98XXXXXXXX',
    logout_title: 'लग आउट',
    logout_desc: 'यस उपकरणबाट तपाईंको Recall AI खाताबाट बाहिर निस्कनुहोस्।',
    logout_btn: 'लग आउट',
    danger_zone: 'खतरा क्षेत्र',
    danger_desc: 'तपाईंको खाता र सबै डेटा स्थायी रूपमा मेटाउनुहोस्। यो पूर्ववत गर्न सकिँदैन।',
    delete_account: 'खाता मेटाउनुहोस्',
    delete_verify_msg: 'खाता मेटाउन इमेल प्रमाणीकरण आवश्यक छ',
    privacy: 'गोपनीयता नीति',     terms: 'नियम र सर्तहरू',
    modal_logout_title: 'लग आउट गर्ने?',
    modal_logout_desc: 'तपाईंको Recall AI खाता पुनः पहुँच गर्न फेरि साइन इन गर्नुपर्नेछ।',
    cancel: 'रद्द गर्नुहोस्',     yes_logout: 'हो, लग आउट',
    toast_saved: 'प्रोफाइल सफलतापूर्वक सुरक्षित ✓',
    toast_avatar: 'प्रोफाइल तस्विर अपडेट भयो ✓',
    toast_local: 'स्थानीय रूपमा सुरक्षित — अनलाइन हुँदा सिंक हुनेछ',
    toast_invalid_email: 'कृपया मान्य इमेल ठेगाना प्रविष्ट गर्नुहोस्',
    toast_img_large: 'छवि धेरै ठूलो छ — अधिकतम ५ MB',
    toast_delete: 'खाता मेटाउन इमेल प्रमाणीकरण आवश्यक छ',
    toast_invalid_char: 'अमान्य अक्षर — केवल संख्या',
    toast_phone_limit: 'अधिकतम १० अंक मात्र',
    saving: 'सुरक्षित गर्दैछ…',
  },
  hi: {
    nav_dashboard: 'डैशबोर्ड',    nav_history: 'इतिहास',
    nav_profile: 'प्रोफ़ाइल',     nav_settings: 'सेटिंग्स',
    upload: 'अपलोड',
    badge_pro: 'प्रो सदस्य',      badge_tier: 'स्तर 2 पहुँच',
    save_changes: 'परिवर्तन सहेजें',
    personal_info: 'व्यक्तिगत जानकारी',
    first_name: 'पहला नाम',        last_name: 'उपनाम',
    display_name: 'प्रदर्शन नाम', bio: 'परिचय', location: 'स्थान',
    ph_first_name: 'पहला नाम',     ph_last_name: 'उपनाम',
    ph_display_name: '@उपयोगकर्ता', ph_bio: 'अपने बारे में लिखें...',
    ph_location: 'शहर, देश',
    contact_identity: 'संपर्क और पहचान',
    email: 'ईमेल पता',             phone: 'फ़ोन नंबर',
    timezone: 'समय क्षेत्र',      language: 'भाषा',
    ph_email: 'aap@udaharan.com',  ph_phone: '+91 98765 43210',
    logout_title: 'लॉग आउट',
    logout_desc: 'इस डिवाइस से अपने Recall AI खाते से साइन आउट करें।',
    logout_btn: 'लॉग आउट',
    danger_zone: 'खतरा क्षेत्र',
    danger_desc: 'अपना खाता और सभी डेटा स्थायी रूप से हटाएं। इसे पूर्ववत नहीं किया जा सकता।',
    delete_account: 'खाता हटाएं',
    delete_verify_msg: 'खाता हटाने के लिए ईमेल सत्यापन आवश्यक है',
    privacy: 'गोपनीयता नीति',     terms: 'नियम और शर्तें',
    modal_logout_title: 'लॉग आउट करें?',
    modal_logout_desc: 'आपको अपने Recall AI खाते तक पहुँचने के लिए फिर से साइन इन करना होगा।',
    cancel: 'रद्द करें',           yes_logout: 'हाँ, लॉग आउट',
    toast_saved: 'प्रोफ़ाइल सफलतापूर्वक सहेजा गया ✓',
    toast_avatar: 'प्रोफ़ाइल चित्र अपडेट हुआ ✓',
    toast_local: 'स्थानीय रूप से सहेजा — ऑनलाइन होने पर सिंक होगा',
    toast_invalid_email: 'कृपया एक मान्य ईमेल पता दर्ज करें',
    toast_img_large: 'छवि बहुत बड़ी है — अधिकतम 5 MB',
    toast_delete: 'खाता हटाने के लिए ईमेल सत्यापन आवश्यक है',
    toast_invalid_char: 'अमान्य वर्ण — केवल संख्याएं',
    toast_phone_limit: 'अधिकतम 10 अंक',
    saving: 'सहेजा जा रहा है…',
  },
  zh: {
    nav_dashboard: '仪表板',       nav_history: '历史',
    nav_profile: '个人资料',       nav_settings: '设置',
    upload: '上传',
    badge_pro: '专业会员',         badge_tier: '二级访问',
    save_changes: '保存更改',
    personal_info: '个人信息',
    first_name: '名字',            last_name: '姓氏',
    display_name: '显示名称',      bio: '简介', location: '所在地',
    ph_first_name: '名字',         ph_last_name: '姓氏',
    ph_display_name: '@用户名',    ph_bio: '介绍一下自己...',
    ph_location: '城市，国家',
    contact_identity: '联系方式与身份',
    email: '电子邮箱',             phone: '电话号码',
    timezone: '时区',              language: '语言',
    ph_email: 'you@example.com',   ph_phone: '+86 138 0000 0000',
    logout_title: '退出登录',
    logout_desc: '从此设备退出您的 Recall AI 账户。',
    logout_btn: '退出登录',
    danger_zone: '危险区域',
    danger_desc: '永久删除您的账户和所有数据。此操作无法撤销。',
    delete_account: '删除账户',
    delete_verify_msg: '删除账户需要电子邮件验证',
    privacy: '隐私协议',           terms: '条款与条件',
    modal_logout_title: '退出登录？',
    modal_logout_desc: '您需要重新登录才能访问您的 Recall AI 账户。',
    cancel: '取消',                yes_logout: '是的，退出',
    toast_saved: '个人资料保存成功 ✓',
    toast_avatar: '头像已更新 ✓',
    toast_local: '已本地保存 — 联网后将同步',
    toast_invalid_email: '请输入有效的电子邮件地址',
    toast_img_large: '图片过大 — 最大 5 MB',
    toast_delete: '删除账户需要电子邮件验证',
    toast_invalid_char: '无效字符 — 仅限数字',
    toast_phone_limit: '最多 10 位数字',
    saving: '保存中…',
  },
  es: {
    nav_dashboard: 'Panel',        nav_history: 'Historial',
    nav_profile: 'Perfil',         nav_settings: 'Ajustes',
    upload: 'Subir',
    badge_pro: 'Miembro Pro',      badge_tier: 'Acceso Nivel 2',
    save_changes: 'Guardar Cambios',
    personal_info: 'Información Personal',
    first_name: 'Nombre',          last_name: 'Apellido',
    display_name: 'Nombre Visible',bio: 'Biografía', location: 'Ubicación',
    ph_first_name: 'Nombre',       ph_last_name: 'Apellido',
    ph_display_name: '@usuario',   ph_bio: 'Cuéntanos sobre ti...',
    ph_location: 'Ciudad, País',
    contact_identity: 'Contacto e Identidad',
    email: 'Correo Electrónico',   phone: 'Número de Teléfono',
    timezone: 'Zona Horaria',      language: 'Idioma',
    ph_email: 'tu@ejemplo.com',    ph_phone: '+34 600 000 000',
    logout_title: 'Cerrar Sesión',
    logout_desc: 'Cierra sesión en tu cuenta Recall AI en este dispositivo.',
    logout_btn: 'Cerrar Sesión',
    danger_zone: 'Zona de Peligro',
    danger_desc: 'Elimina permanentemente tu cuenta y todos los datos. Esta acción no se puede deshacer.',
    delete_account: 'Eliminar Cuenta',
    delete_verify_msg: 'La eliminación de la cuenta requiere verificación por correo',
    privacy: 'Protocolo de Privacidad', terms: 'Términos y Condiciones',
    modal_logout_title: '¿Cerrar Sesión?',
    modal_logout_desc: 'Necesitarás iniciar sesión de nuevo para acceder a tu cuenta Recall AI.',
    cancel: 'Cancelar',            yes_logout: 'Sí, Cerrar Sesión',
    toast_saved: 'Perfil guardado correctamente ✓',
    toast_avatar: 'Foto de perfil actualizada ✓',
    toast_local: 'Guardado localmente — se sincronizará al conectarse',
    toast_invalid_email: 'Por favor ingresa un correo electrónico válido',
    toast_img_large: 'Imagen demasiado grande — máximo 5 MB',
    toast_delete: 'La eliminación de la cuenta requiere verificación por correo',
    toast_invalid_char: 'Carácter inválido — solo números',
    toast_phone_limit: 'Máximo 10 dígitos',
    saving: 'Guardando…',
  },
};

/* ── Current language state ──────────────────────────────── */
let currentLang = 'en';

/* ── Translate the whole page ────────────────────────────── */
function applyLanguage(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  currentLang = lang;

  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // Save button special handling (has SVG + span inside)
  const saveBtn = $('saveBtn');
  if (saveBtn && !saveBtn.disabled) {
    const span = saveBtn.querySelector('span[data-i18n="save_changes"]');
    if (span) span.textContent = t['save_changes'];
  }

  // Page title
  document.title = `${t['nav_profile'] || 'Profile'} — Recall AI`;

  // html lang attr
  document.documentElement.lang = lang;
}

/* ── i18n helper used inline (e.g. onclick toast) ────────── */
function i18n(key) {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];
  return t[key] || key;
}

/* ────────────────────────────────────────────────────────────
   DOM HELPER
──────────────────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function getInitials(first, last) {
  return [(first || '')[0], (last || '')[0]]
    .filter(Boolean).join('').toUpperCase() || '?';
}

/* ────────────────────────────────────────────────────────────
   AUTH HELPERS
──────────────────────────────────────────────────────────── */
async function getToken() {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['recall_token'], r => resolve(r.recall_token || null));
    } else {
      resolve(localStorage.getItem('recall_token') || null);
    }
  });
}

async function getChromeUser() {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['recall_user'], r => {
        try {
          const u = typeof r.recall_user === 'string'
            ? JSON.parse(r.recall_user || '{}') : (r.recall_user || {});
          resolve(u);
        } catch { resolve({}); }
      });
    } else {
      try { resolve(JSON.parse(localStorage.getItem('recall_user') || '{}')); }
      catch { resolve({}); }
    }
  });
}

async function persistUser(user) {
  const str = JSON.stringify(user);
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await new Promise(r => chrome.storage.local.set({
      recall_user: str,
    }, r));
  }
  const profileData = {
    firstName:   (user.name || '').split(' ')[0] || '',
    lastName:    (user.name || '').split(' ').slice(1).join(' ') || '',
    displayName: user.displayName || user.name || '',
    bio:         user.bio         || '',
    location:    user.location    || '',
    email:       user.email       || '',
    phone:       user.phone       || '',
    timezone:    user.timezone    || 'asia/kathmandu',
    language:    user.language    || 'en',
    avatarSrc:   user.avatarUrl   || '',
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(profileData));
}

async function authHeaders() {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/* ────────────────────────────────────────────────────────────
   HEADER — live update
──────────────────────────────────────────────────────────── */
function updateHeader({ firstName, lastName, email, location, avatarSrc }) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
  $('headerName').textContent = fullName;
  $('headerEmail').textContent = email || '—';
  $('headerLocationText').textContent = location || '';
  const locRow = $('headerLocation');
  if (locRow) locRow.style.display = location ? 'flex' : 'none';

  const img = $('avatarImg');
  const ini = $('avatarInitials');
  if (avatarSrc) {
    if (img) { img.src = avatarSrc; img.style.display = 'block'; }
    if (ini) ini.style.display = 'none';
  } else if (!img || img.style.display === 'none') {
    if (ini) ini.textContent = getInitials(firstName, lastName);
  }
}

/* ────────────────────────────────────────────────────────────
   FORM — populate & collect
──────────────────────────────────────────────────────────── */
function populateForm(user) {
  const parts     = (user.name || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ') || '';

  $('firstName').value   = firstName;
  $('lastName').value    = lastName;
  $('displayName').value = user.displayName || user.name || '';
  $('bio').value         = user.bio         || '';
  $('location').value    = user.location    || '';
  $('emailInput').value  = user.email       || '';
  $('phone').value       = user.phone       || '';

  const tz = $('timezone');
  const lg = $('language');
  if (tz && user.timezone) tz.value = user.timezone;
  if (lg && user.language) {
    lg.value = user.language;
    applyLanguage(user.language);
  }

  const avatarSrc = user.avatarUrl || user.avatarSrc || '';
  updateHeader({ firstName, lastName, email: user.email, location: user.location, avatarSrc });
}

function collectForm() {
  const first = $('firstName').value.trim();
  const last  = $('lastName').value.trim();
  return {
    username:     [first, last].filter(Boolean).join(' '),
    display_name: $('displayName').value.trim(),
    bio:          $('bio').value.trim(),
    location:     $('location').value.trim(),
    email:        $('emailInput').value.trim(),
    phone:        $('phone').value.trim(),
    timezone:     $('timezone').value,
    language:     $('language').value,
    ...($('avatarFile').dataset.pendingSrc
        ? { avatar_url: $('avatarFile').dataset.pendingSrc } : {}),
  };
}

/* ────────────────────────────────────────────────────────────
   LOAD PROFILE
──────────────────────────────────────────────────────────── */
async function loadProfile() {
  const hdrs = await authHeaders();
  if (!hdrs['Authorization']) {
    window.location.href = '../login-page/login.html';
    return;
  }

  try {
    const res = await fetch(API_PROFILE, { headers: hdrs });
    if (res.status === 401) { window.location.href = '../login-page/login.html'; return; }
    if (res.ok) {
      const { user } = await res.json();
      console.log('[RecallAI] Profile loaded from Supabase ✓', user.displayName || user.name);
      populateForm(user);
      await persistUser(user);
      return;
    }
    const errData = await res.json().catch(() => ({}));
    console.error('[RecallAI] Profile load error:', res.status, errData.error);
  } catch (err) {
    console.warn('[RecallAI] Backend unreachable, using local cache:', err.message);
  }

  // Fallback: chrome.storage
  const cu = await getChromeUser();
  if (cu && (cu.name || cu.email)) { populateForm(cu); return; }

  // Last resort: localStorage
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      populateForm({
        name: [p.firstName, p.lastName].filter(Boolean).join(' '),
        email: p.email, bio: p.bio, location: p.location,
        displayName: p.displayName, phone: p.phone,
        timezone: p.timezone, language: p.language, avatarUrl: p.avatarSrc,
      });
    }
  } catch (e) { /* ignore */ }
}

/* ────────────────────────────────────────────────────────────
   AVATAR UPLOAD — updates header immediately on file pick
──────────────────────────────────────────────────────────── */
function initAvatarUpload() {
  const fileInput = $('avatarFile');
  if (!fileInput) return;

  fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast(i18n('toast_img_large'), 'err');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const src = ev.target.result;

      // Immediately update the avatar circle in the header
      const img = $('avatarImg');
      const ini = $('avatarInitials');
      if (img) { img.src = src; img.style.display = 'block'; }
      if (ini) ini.style.display = 'none';

      // Store so saveProfile can send it
      $('avatarFile').dataset.pendingSrc = src;

      showToast(i18n('toast_avatar'));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}

/* ────────────────────────────────────────────────────────────
   LIVE HEADER UPDATE — as user types in name / email / location
──────────────────────────────────────────────────────────── */
function initLivePreview() {
  ['firstName', 'lastName', 'emailInput', 'location'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      updateHeader({
        firstName: $('firstName').value.trim(),
        lastName:  $('lastName').value.trim(),
        email:     $('emailInput').value.trim(),
        location:  $('location').value.trim(),
        // keep existing avatar src
        avatarSrc: ($('avatarImg').style.display !== 'none') ? $('avatarImg').src : '',
      });
    });
  });
}

/* ────────────────────────────────────────────────────────────
   PHONE VALIDATION — digits only, max 10 numbers
──────────────────────────────────────────────────────────── */
let _phoneToastTimer = null;

function initPhoneValidation() {
  const phoneInput = $('phone');
  if (!phoneInput) return;

  phoneInput.addEventListener('keydown', function (e) {
    // Allow: navigation & control keys
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ];
    if (allowedKeys.includes(e.key)) return;

    // Allow: Ctrl/Cmd + A, C, V, X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;

    // Allow: + sign only at the very start (position 0) and only if not already present
    if (e.key === '+' && phoneInput.selectionStart === 0 && !phoneInput.value.startsWith('+')) return;

    // Block non-digit characters and show toast
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      showToast(i18n('toast_invalid_char'), 'err');
      return;
    }

    // Count current digits (exclude the + prefix)
    const digitCount = phoneInput.value.replace(/\D/g, '').length;

    // Check if adding this digit would exceed 10
    const selStart = phoneInput.selectionStart;
    const selEnd   = phoneInput.selectionEnd;
    const selectedDigits = phoneInput.value.slice(selStart, selEnd).replace(/\D/g, '').length;
    const netDigits = digitCount - selectedDigits; // digits after removing selection

    if (netDigits >= 10) {
      e.preventDefault();
      showToast(i18n('toast_phone_limit'), 'warn');
    }
  });

  phoneInput.addEventListener('paste', function (e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');

    // Check for invalid (non-digit, non-+) characters
    const cleaned = pasted.replace(/[\d+\s\-().]/g, '');
    if (cleaned.length > 0) {
      showToast(i18n('toast_invalid_char'), 'err');
    }

    // Extract digits only from pasted content
    const pastedDigits = pasted.replace(/\D/g, '');
    const currentDigits = phoneInput.value.replace(/\D/g, '');
    const hasPlus = phoneInput.value.startsWith('+') || pasted.trimStart().startsWith('+');

    // Merge and cap at 10 digits
    const combined = (currentDigits + pastedDigits).slice(0, 10);

    if (currentDigits.length + pastedDigits.length > 10) {
      showToast(i18n('toast_phone_limit'), 'warn');
    }

    phoneInput.value = (hasPlus ? '+' : '') + combined;
  });

  // Clean up on blur — strip anything that's not digits or a leading +
  phoneInput.addEventListener('blur', function () {
    const val = phoneInput.value;
    const hasPlus = val.startsWith('+');
    const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
    phoneInput.value = (hasPlus ? '+' : '') + digitsOnly;
  });
}
/* ────────────────────────────────────────────────────────────
   PHONE SAVE VALIDATION — only valid numbers can be saved
──────────────────────────────────────────────────────────── */
function validatePhone(value) {
  if (!value || value.trim() === '' || value === '+') return { valid: true }; // empty is OK

  const raw = value.trim();

  // Strip the optional leading +
  const digits = raw.replace(/^\+/, '').replace(/\D/g, '');

  // Must be exactly 10 digits
  if (digits.length < 10) {
    return { valid: false, msg: i18n('toast_phone_too_short') };
  }
  if (digits.length > 10) {
    return { valid: false, msg: i18n('toast_phone_limit') };
  }

  // Must not be all same digit (e.g. 0000000000, 1111111111)
  if (/^(\d)\1{9}$/.test(digits)) {
    return { valid: false, msg: i18n('toast_phone_invalid') };
  }

  // Must not be sequential (1234567890 or 0987654321)
  if (digits === '1234567890' || digits === '0987654321') {
    return { valid: false, msg: i18n('toast_phone_invalid') };
  }

  return { valid: true };
}

/* ────────────────────────────────────────────────────────────
   LANGUAGE CHANGE — instant full-page translation
──────────────────────────────────────────────────────────── */
function initLanguageSwitch() {
  const langSelect = $('language');
  if (!langSelect) return;
  langSelect.addEventListener('change', function () {
    const lang = this.value;
    applyLanguage(lang);

    // Immediately persist language to chrome.storage so all other
    // pages (history, dashboard, settings) pick it up right away
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['recall_user'], (stored) => {
        try {
          const user = stored.recall_user
            ? (typeof stored.recall_user === 'string'
                ? JSON.parse(stored.recall_user) : stored.recall_user)
            : {};
          user.language = lang;
          chrome.storage.local.set({ recall_user: JSON.stringify(user) });
        } catch (e) {}
      });
    }

    // Also save to localStorage profile cache
    try {
      const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      existing.language = lang;
      localStorage.setItem(STORE_KEY, JSON.stringify(existing));
    } catch (e) {}
  });
}

/* ────────────────────────────────────────────────────────────
   SAVE CHANGES
──────────────────────────────────────────────────────────── */
async function saveProfile() {
  const btn = $('saveBtn');
  const emailVal = $('emailInput').value.trim();

  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    showToast(i18n('toast_invalid_email'), 'err');
    return;
  }
  
  // ── Phone validation ──
const phoneVal = $('phone').value.trim();
const phoneCheck = validatePhone(phoneVal);
if (!phoneCheck.valid) {
  showToast(phoneCheck.msg, 'err');
  $('phone').focus();
  return;
}

  btn.disabled = true;
  btn.innerHTML = `
    <span class="spin">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </span>&nbsp;${i18n('saving')}`;

  const payload = collectForm();

  // Build local user object immediately
  const localUser = {
    name:        payload.username,
    displayName: payload.display_name,
    bio:         payload.bio,
    location:    payload.location,
    email:       payload.email,
    phone:       payload.phone,
    timezone:    payload.timezone,
    language:    payload.language,
    ...(payload.avatar_url ? { avatarUrl: payload.avatar_url } : {}),
  };

  // Update the header right now — don't wait for API
  updateHeader({
    firstName: payload.username.split(' ')[0] || '',
    lastName:  payload.username.split(' ').slice(1).join(' ') || '',
    email:     payload.email,
    location:  payload.location,
    avatarSrc: payload.avatar_url || (($('avatarImg').style.display !== 'none') ? $('avatarImg').src : ''),
  });

  try {
    const hdrs = await authHeaders();
    const res  = await fetch(API_PROFILE, {
      method: 'PATCH', headers: hdrs, body: JSON.stringify(payload),
    });

    if (res.status === 401) { window.location.href = '../login-page/login.html'; return; }

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error || 'Save failed — please try again';
      console.error('[RecallAI] Profile save failed:', errMsg, '| HTTP:', res.status);
      showToast(errMsg, 'err');
      return;
    }

    // Saved to Supabase successfully
    const updatedUser = { ...localUser, ...data.user };
    await persistUser(updatedUser);
    delete $('avatarFile').dataset.pendingSrc;
    showToast(i18n('toast_saved'));
    console.log('[RecallAI] Profile saved to Supabase ✓', updatedUser.displayName);

  } catch (err) {
    // Offline fallback — persist locally, header already updated above
    console.warn('[RecallAI] Offline save:', err.message);
    const existing = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const merged = {
      ...existing,
      firstName:   payload.username.split(' ')[0] || '',
      lastName:    payload.username.split(' ').slice(1).join(' ') || '',
      displayName: payload.display_name,
      bio:         payload.bio,
      location:    payload.location,
      email:       payload.email,
      phone:       payload.phone,
      timezone:    payload.timezone,
      language:    payload.language,
      ...(payload.avatar_url ? { avatarSrc: payload.avatar_url } : {}),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(merged));

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise(r => chrome.storage.local.set({ recall_user: JSON.stringify(localUser) }, r));
    }

    delete $('avatarFile').dataset.pendingSrc;
    showToast(i18n('toast_local'), 'warn');

  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span data-i18n="save_changes">${i18n('save_changes')}</span>`;
  }
}

/* ────────────────────────────────────────────────────────────
   LOGOUT
──────────────────────────────────────────────────────────── */
function handleLogout() {
  $('logoutModal').classList.add('active');
}

function closeLogoutModal() {
  $('logoutModal').classList.remove('active');
}

async function confirmLogout() {
  const btn = $('modalConfirmBtn');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise(r => chrome.storage.local.remove(['recall_token', 'recall_user'], r));
    }
    localStorage.removeItem('recall_token');
    localStorage.removeItem('recall_user');
    localStorage.removeItem(STORE_KEY);

    const token = await getToken();
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  window.location.href = '../login-page/login.html';
}

/* ────────────────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, type) {
  const el = $('toastEl'), iconEl = $('toastIcon'), msgEl = $('toastMsg');
  if (!el) return;
  iconEl.textContent   = type === 'warn' ? '⚠' : type === 'err' ? '✗' : '✓';
  msgEl.textContent    = msg;
  el.style.borderColor = type === 'err'  ? 'rgba(186,0,0,0.4)'
                       : type === 'warn' ? 'rgba(255,140,0,0.35)'
                       :                   'rgba(159,167,255,0.22)';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ────────────────────────────────────────────────────────────
   EXPOSE GLOBALS
──────────────────────────────────────────────────────────── */
window.saveProfile      = saveProfile;
window.showToast        = showToast;
window.handleLogout     = handleLogout;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout    = confirmLogout;
window.i18n             = i18n;

/* ────────────────────────────────────────────────────────────
   INIT
──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  initAvatarUpload();
  initLivePreview();
  initLanguageSwitch();
  initPhoneValidation();

  // ── Wire all buttons in JS (no inline onclick in HTML — CSP requires this) ──

  // Save Changes button
  const saveBtn = $('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveProfile);

  // Avatar wrap click
  const avatarWrap = $('avatarWrap');
  if (avatarWrap) avatarWrap.addEventListener('click', () => $('avatarFile').click());

  // Avatar edit pencil button
  const avatarEditBtn = $('avatarEditBtn');
  if (avatarEditBtn) avatarEditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    $('avatarFile').click();
  });

  // Log Out button
  const logoutMainBtn = $('logoutMainBtn');
  if (logoutMainBtn) logoutMainBtn.addEventListener('click', handleLogout);

  // Danger: Delete Account button
  const dangerDeleteBtn = $('dangerDeleteBtn');
  if (dangerDeleteBtn) dangerDeleteBtn.addEventListener('click', () => showToast(i18n('delete_verify_msg'), 'warn'));

  // Modal: Cancel button
  const modalCancelBtn = $('modalCancelBtn');
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeLogoutModal);

  // Modal: Confirm logout button
  const modalConfirmBtn = $('modalConfirmBtn');
  if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', confirmLogout);

  // Close modal on backdrop click or Escape key
  $('logoutModal').addEventListener('click', e => { if (e.target === $('logoutModal')) closeLogoutModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLogoutModal(); });
});