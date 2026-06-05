/* ─────────────────────────────────────────
   RECALL AI — signup.js
   Fixed: uses chrome.storage.local (not localStorage)
   Added: real-time email existence validation
───────────────────────────────────────── */

'use strict';

const BACKEND_URL = 'http://localhost:5000';
const API = {
  signup:      `${BACKEND_URL}/api/auth/signup`,
  checkEmail:  `${BACKEND_URL}/api/auth/check-email`,
};

const dom = {
  nameInput:     document.getElementById('name'),
  emailInput:    document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  nameError:     document.getElementById('nameError'),
  emailError:    document.getElementById('emailError'),
  passwordError: document.getElementById('passwordError'),
  submitBtn:     document.getElementById('submitBtn'),
  pwToggle:      document.getElementById('pwToggle'),
  eyeIcon:       document.getElementById('eyeIcon'),
  toast:         document.getElementById('toast'),
  toastIcon:     document.getElementById('toastIcon'),
  toastMsg:      document.getElementById('toastMsg'),
  latency:       document.getElementById('latencyDisplay'),
};

/* If already logged in, go to dashboard */
chrome.storage.local.get(['recall_token'], (stored) => {
  if (stored.recall_token) {
    window.location.href = '../dashboard-page/dashboard.html';
  }
});

/* ── Email validation state ───────────────────────────────────
   We cache the last checked email so we don't re-hit the API
   on every keystroke — only on blur or when the value changes. */
let emailCheckCache = { email: null, valid: false, reason: '' };
let emailCheckInFlight = false;

let toastTimer = null;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className = `toast toast--${type} show`;
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 3500);
}

function setLoading(isLoading) {
  dom.submitBtn.classList.toggle('loading', isLoading);
  dom.submitBtn.disabled = isLoading;
}

function clearErrors() {
  [[dom.nameInput, dom.nameError],[dom.emailInput, dom.emailError],[dom.passwordInput, dom.passwordError]]
    .forEach(([input, error]) => {
      input.classList.remove('is-error');
      error.classList.remove('show');
      error.textContent = '';
    });
}

function showFieldError(input, errorEl, message) {
  input.classList.add('is-error');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function clearFieldError(input, errorEl) {
  input.classList.remove('is-error');
  errorEl.classList.remove('show');
  errorEl.textContent = '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Email existence check (calls backend → eva API) ──────────
   Returns true if the email is valid & deliverable, false otherwise.
   Shows an inline field error automatically on failure. */
async function checkEmailExists(email) {
  // Skip if unchanged from last check
  if (emailCheckCache.email === email) {
    if (!emailCheckCache.valid) {
      showFieldError(dom.emailInput, dom.emailError, emailCheckCache.reason);
    }
    return emailCheckCache.valid;
  }

  // Show a subtle "checking…" state on the field
  dom.emailError.textContent = 'Verifying email…';
  dom.emailError.classList.add('show');
  dom.emailInput.classList.remove('is-error');
  emailCheckInFlight = true;

  try {
    const res = await fetch(`${API.checkEmail}?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    emailCheckCache = { email, valid: data.valid, reason: data.reason || '' };

    if (data.valid) {
      // Clear the "Verifying…" message — email is good
      clearFieldError(dom.emailInput, dom.emailError);
      return true;
    } else {
      showFieldError(
        dom.emailInput,
        dom.emailError,
        data.reason || 'This email address does not appear to exist.'
      );
      return false;
    }
  } catch {
    // Backend unreachable — clear the message and allow signup (fail open)
    clearFieldError(dom.emailInput, dom.emailError);
    emailCheckCache = { email, valid: true, reason: 'Could not verify (offline).' };
    return true;
  } finally {
    emailCheckInFlight = false;
  }
}

/* ── On blur: validate email existence as soon as user leaves field ── */
dom.emailInput.addEventListener('blur', async () => {
  const email = dom.emailInput.value.trim();
  if (!email) return; // empty — the submit validate() will catch it
  if (!EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    return;
  }
  await checkEmailExists(email);
});

/* Clear cache when user edits the email field again */
dom.emailInput.addEventListener('input', () => {
  // Only clear the cached result — don't re-run the API on every keystroke
  emailCheckCache.email = null;
  if (dom.emailInput.classList.contains('is-error')) {
    clearFieldError(dom.emailInput, dom.emailError);
  }
});

/* ── Basic sync validation (format + required) ──────────────── */
function validateSync() {
  clearErrors();
  let ok = true;
  const name     = dom.nameInput.value.trim();
  const email    = dom.emailInput.value.trim();
  const password = dom.passwordInput.value;

  if (!name) {
    showFieldError(dom.nameInput, dom.nameError, 'Please enter your full name.');
    ok = false;
  }
  if (!email) {
    showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    ok = false;
  } else if (!EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    ok = false;
  }
  if (!password) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Password is required.');
    ok = false;
  } else if (password.length < 8) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Password must be at least 8 characters.');
    ok = false;
  }
  return ok;
}

/* ── Main sign-up handler ─────────────────────────────────────
   Flow:
     1. Sync format/required validation
     2. Email existence check (async — calls backend)
     3. POST to /api/auth/signup
*/
async function signUp() {
  if (!validateSync()) return;

  const email = dom.emailInput.value.trim();

  // ── Step 2: email existence check ──────────────────────────
  setLoading(true);

  const emailIsReal = await checkEmailExists(email);
  if (!emailIsReal) {
    // Error already shown in the field by checkEmailExists()
    setLoading(false);
    return;
  }

  // ── Step 3: submit to backend ───────────────────────────────
  const t0 = performance.now();
  try {
    const response = await fetch(API.signup, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     dom.nameInput.value.trim(),
        email:    email,
        password: dom.passwordInput.value,
      }),
    });

    const latencyMs = Math.round(performance.now() - t0);
    if (dom.latency) dom.latency.textContent = `Latency: ${latencyMs}ms`;

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      showToast('Account created! Redirecting…', 'success');
      chrome.storage.local.set(
        { recall_token: data.token || '', recall_user: JSON.stringify(data.user || {}) },
        () => { setTimeout(() => { window.location.href = '../dashboard-page/dashboard.html'; }, 1800); }
      );
    } else {
      const message = data.message || data.error || 'Something went wrong.';
      showToast(message, 'error');
      const lower = message.toLowerCase();
      if (lower.includes('email'))    showFieldError(dom.emailInput,    dom.emailError,    message);
      if (lower.includes('name'))     showFieldError(dom.nameInput,     dom.nameError,     message);
      if (lower.includes('password')) showFieldError(dom.passwordInput, dom.passwordError, message);
    }
  } catch {
    showToast('Cannot reach server — is the backend running on port 5000?', 'error');
  } finally {
    setLoading(false);
  }
}

/* ── Password visibility toggle ─────────────────────────────── */
const EYE_OPEN   = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const EYE_CLOSED = `<line x1="2" y1="2" x2="22" y2="22"/><path d="M6.71 6.71A10.94 10.94 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.29-1.35"/><path d="M17.5 17.5A10.9 10.9 0 0 0 23 12s-4-8-11-8"/>`;

function togglePassword() {
  const isPass = dom.passwordInput.type === 'password';
  dom.passwordInput.type = isPass ? 'text' : 'password';
  dom.eyeIcon.innerHTML  = isPass ? EYE_CLOSED : EYE_OPEN;
}

/* ── Latency ping ────────────────────────────────────────────── */
async function pingLatency() {
  try {
    const t0 = performance.now();
    await fetch(`${BACKEND_URL}/api/ping`, { cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    if (dom.latency) dom.latency.textContent = `Latency: ${ms}ms`;
  } catch {
    if (dom.latency) dom.latency.textContent = 'Server: offline';
  }
}

/* ── Init ────────────────────────────────────────────────────── */
function init() {
  dom.submitBtn.addEventListener('click', signUp);
  [dom.nameInput, dom.emailInput, dom.passwordInput].forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') signUp(); });
  });
  dom.pwToggle.addEventListener('click', togglePassword);
  pingLatency();
}

document.addEventListener('DOMContentLoaded', init);
