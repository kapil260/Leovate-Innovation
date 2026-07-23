/* ─────────────────────────────────────────
   RECALL AI — login.js
   Fixed: pre-fills email after password reset
───────────────────────────────────────── */

'use strict';

const BACKEND_URL = 'http://localhost:5000';
const API = { signin: `${BACKEND_URL}/api/auth/login` };

const dom = {
  emailInput:    document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  emailError:    document.getElementById('emailError'),
  passwordError: document.getElementById('passwordError'),
  submitBtn:     document.getElementById('submitBtn'),
  pwToggle:      document.getElementById('pwToggle'),
  eyeIcon:       document.getElementById('eyeIcon'),
  signUpLink:    document.getElementById('signUpLink'),
  forgotLink:    document.getElementById('forgotLink'),
  toast:         document.getElementById('toast'),
  toastIcon:     document.getElementById('toastIcon'),
  toastMsg:      document.getElementById('toastMsg'),
};

/* ── If already logged in, go to dashboard ── */
chrome.storage.local.get(['recall_token', 'recall_prefill_email'], (stored) => {
  if (stored.recall_token) {
    window.location.href = '../dashboard-page/dashboard.html';
    return;
  }
  // ✅ Pre-fill email if coming from forgot-security-key flow
  if (stored.recall_prefill_email) {
    dom.emailInput.value = stored.recall_prefill_email;
    dom.passwordInput.focus();
    showToast('Security key updated! Enter your new key to sign in.', 'success');
    // Clear it after use so it doesn't persist
    chrome.storage.local.remove('recall_prefill_email');
  }
});

/* Fallback: sessionStorage pre-fill (for non-extension context) */
try {
  const prefill = sessionStorage.getItem('recall_prefill_email');
  if (prefill && !dom.emailInput.value) {
    dom.emailInput.value = prefill;
    dom.passwordInput.focus();
    sessionStorage.removeItem('recall_prefill_email');
  }
} catch(e) {}

let toastTimer = null;
function showToast(message, type) {
  clearTimeout(toastTimer);
  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className = 'toast toast-' + type + ' show';
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 4000);
}

function setLoading(isLoading) { dom.submitBtn.classList.toggle('loading', isLoading); }

function clearErrors() {
  [dom.emailInput, dom.passwordInput].forEach(inp => {
    const wrap = inp.closest('.input');
    if (wrap) wrap.classList.remove('is-error');
  });
  [dom.emailError, dom.passwordError].forEach(el => { el.classList.remove('show'); el.textContent = ''; });
}

function showFieldError(input, errorEl, message) {
  const wrap = input.closest('.input');
  if (wrap) wrap.classList.add('is-error');
  errorEl.textContent = message; errorEl.classList.add('show');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate() {
  clearErrors();
  let ok = true;
  const email    = dom.emailInput.value.trim();
  const password = dom.passwordInput.value;

  if (!email) {
    showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    ok = false;
  } else if (!EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    ok = false;
  }

  if (!password) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Security key is required.');
    ok = false;
  } else if (password.length < 8) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Security key must be at least 8 characters.');
    ok = false;
  }
  return ok;
}

async function signIn() {
  if (!validate()) return;
  setLoading(true);
  try {
    const response = await fetch(API.signin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dom.emailInput.value.trim(), password: dom.passwordInput.value }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Neural link established. Redirecting…', 'success');
      chrome.storage.local.set({ recall_token: data.token || '', recall_user: JSON.stringify(data.user || {}) }, () => {
        setTimeout(() => { window.location.href = '../dashboard-page/dashboard.html'; }, 1800);
      });
    } else {
      const message = data.message || data.error || 'Invalid credentials. Please try again.';
      showToast(message, 'error');
      const lower = message.toLowerCase();
      if (lower.includes('email') || lower.includes('user') || lower.includes('account')) showFieldError(dom.emailInput, dom.emailError, message);
      if (lower.includes('password') || lower.includes('key') || lower.includes('credential')) showFieldError(dom.passwordInput, dom.passwordError, 'Incorrect security key.');
    }
  } catch {
    showToast('Network error — check your connection.', 'error');
  } finally {
    setLoading(false);
  }
}

const EYE_OPEN   = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_CLOSED = '<line x1="2" y1="2" x2="22" y2="22"/><path d="M6.71 6.71A10.94 10.94 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.29-1.35M10.59 10.59a3 3 0 0 0 4 4.24"/><path d="M17.5 17.5A10.9 10.9 0 0 0 23 12s-4-8-11-8a10.9 10.9 0 0 0-3.18.5"/>';

function togglePassword() {
  const isPass = dom.passwordInput.type === 'password';
  dom.passwordInput.type = isPass ? 'text' : 'password';
  dom.eyeIcon.innerHTML  = isPass ? EYE_CLOSED : EYE_OPEN;
}

function init() {
  dom.submitBtn.addEventListener('click', signIn);
  [dom.emailInput, dom.passwordInput].forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  });
  dom.pwToggle.addEventListener('click', togglePassword);
  if (dom.signUpLink) dom.signUpLink.addEventListener('click', () => { window.location.href = '../home-page/Sigup.html'; });
  if (dom.forgotLink) dom.forgotLink.addEventListener('click', () => { window.location.href = '../forgot-page/forgot.html'; });
}

document.addEventListener('DOMContentLoaded', init);
