/* ─────────────────────────────────────────
   RECALL AI — app.js
   All JavaScript logic in one place.
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG
   Update these endpoints to match your backend.
───────────────────────────────────────── */
const API = {
  signup:   '/api/auth/signup',   // POST  { name, email, password }
  signin:   '/api/auth/signin',   // POST  { email, password }
  ping:     '/api/ping',          // GET   — latency check
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  form:           document.getElementById('signupForm'),
  nameInput:      document.getElementById('name'),
  emailInput:     document.getElementById('email'),
  passwordInput:  document.getElementById('password'),
  nameError:      document.getElementById('nameError'),
  emailError:     document.getElementById('emailError'),
  passwordError:  document.getElementById('passwordError'),
  submitBtn:      document.getElementById('submitBtn'),
  pwToggle:       document.getElementById('pwToggle'),
  eyeIcon:        document.getElementById('eyeIcon'),
  signInLink:     document.getElementById('signInLink'),
  toast:          document.getElementById('toast'),
  toastIcon:      document.getElementById('toastIcon'),
  toastMsg:       document.getElementById('toastMsg'),
  latency:        document.getElementById('latencyDisplay'),
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
let toastTimer = null;

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);

  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';

  dom.toast.className = `toast toast--${type} show`;

  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 3500);
}

/* ─────────────────────────────────────────
   BUTTON LOADING STATE
───────────────────────────────────────── */
function setLoading(isLoading) {
  dom.submitBtn.classList.toggle('loading', isLoading);
  dom.submitBtn.disabled = isLoading;
}

/* ─────────────────────────────────────────
   FIELD ERROR HELPERS
───────────────────────────────────────── */
function clearErrors() {
  const fields = [
    { input: dom.nameInput,     error: dom.nameError },
    { input: dom.emailInput,    error: dom.emailError },
    { input: dom.passwordInput, error: dom.passwordError },
  ];

  fields.forEach(({ input, error }) => {
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

/* ─────────────────────────────────────────
   VALIDATION
───────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate() {
  clearErrors();

  const name     = dom.nameInput.value.trim();
  const email    = dom.emailInput.value.trim();
  const password = dom.passwordInput.value;
  let isValid    = true;

  if (!name) {
    showFieldError(dom.nameInput, dom.nameError, 'Please enter your full name.');
    isValid = false;
  }

  if (!email) {
    showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    isValid = false;
  } else if (!EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    isValid = false;
  }

  if (!password) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Password is required.');
    isValid = false;
  } else if (password.length < 8) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Password must be at least 8 characters.');
    isValid = false;
  }

  return isValid;
}

/* ─────────────────────────────────────────
   SIGN UP — API CALL
───────────────────────────────────────── */
async function signUp() {
  if (!validate()) return;

  setLoading(true);

  const t0 = performance.now();

  const payload = {
    name:     dom.nameInput.value.trim(),
    email:    dom.emailInput.value.trim(),
    password: dom.passwordInput.value,
  };

  try {
    const response = await fetch(API.signup, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    // Update latency display
    const latencyMs = Math.round(performance.now() - t0);
    dom.latency.textContent = `Latency: ${latencyMs}ms`;

    // Parse JSON safely
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      // ── SUCCESS ──────────────────────────
      showToast('Account created! Redirecting…', 'success');

      // Store auth token if API returns one
      if (data.token) {
        localStorage.setItem('recall_token', data.token);
      }

      // Store user info if API returns it
      if (data.user) {
        localStorage.setItem('recall_user', JSON.stringify(data.user));
      }

      // Redirect — update '/dashboard' to your actual route
      setTimeout(() => {
        window.location.href = data.redirect || '/dashboard';
      }, 1800);

    } else {
      // ── SERVER ERROR ─────────────────────
      const message = data.message || data.error || 'Something went wrong. Please try again.';
      showToast(message, 'error');

      // Map server errors back to specific fields
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('email')) {
        showFieldError(dom.emailInput, dom.emailError, message);
      }
      if (lowerMsg.includes('name')) {
        showFieldError(dom.nameInput, dom.nameError, message);
      }
      if (lowerMsg.includes('password')) {
        showFieldError(dom.passwordInput, dom.passwordError, message);
      }
    }

  } catch (networkError) {
    // ── NETWORK / CONNECTION ERROR ────────
    showToast('Network error — please check your connection.', 'error');
    console.error('[Recall AI] Signup network error:', networkError);

  } finally {
    setLoading(false);
  }
}

/* ─────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLE
───────────────────────────────────────── */
const EYE_OPEN = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
`;

const EYE_CLOSED = `
  <line x1="2" y1="2" x2="22" y2="22"/>
  <path d="M6.71 6.71A10.94 10.94 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.29-1.35M10.59 10.59a3 3 0 0 0 4 4.24"/>
  <path d="M17.5 17.5A10.9 10.9 0 0 0 23 12s-4-8-11-8a10.9 10.9 0 0 0-3.18.5"/>
`;

function togglePassword() {
  const isPassword = dom.passwordInput.type === 'password';
  dom.passwordInput.type  = isPassword ? 'text' : 'password';
  dom.eyeIcon.innerHTML   = isPassword ? EYE_CLOSED : EYE_OPEN;
  dom.pwToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
}

/* ─────────────────────────────────────────
   LATENCY PING
───────────────────────────────────────── */
async function pingLatency() {
  try {
    const t0 = performance.now();
    await fetch(API.ping, { method: 'GET', cache: 'no-store' });
    const ms = Math.round(performance.now() - t0);
    dom.latency.textContent = `Latency: ${ms}ms`;
  } catch {
    dom.latency.textContent = 'Latency: —';
  }
}

/* ─────────────────────────────────────────
   LIVE FIELD VALIDATION (on blur)
───────────────────────────────────────── */
function attachLiveValidation() {
  dom.nameInput.addEventListener('blur', () => {
    if (!dom.nameInput.value.trim()) {
      showFieldError(dom.nameInput, dom.nameError, 'Please enter your full name.');
    } else {
      dom.nameInput.classList.remove('is-error');
      dom.nameError.classList.remove('show');
    }
  });

  dom.emailInput.addEventListener('blur', () => {
    const val = dom.emailInput.value.trim();
    if (!val) {
      showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    } else if (!EMAIL_RE.test(val)) {
      showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    } else {
      dom.emailInput.classList.remove('is-error');
      dom.emailError.classList.remove('show');
    }
  });

  dom.passwordInput.addEventListener('blur', () => {
    const val = dom.passwordInput.value;
    if (!val) {
      showFieldError(dom.passwordInput, dom.passwordError, 'Password is required.');
    } else if (val.length < 8) {
      showFieldError(dom.passwordInput, dom.passwordError, 'Password must be at least 8 characters.');
    } else {
      dom.passwordInput.classList.remove('is-error');
      dom.passwordError.classList.remove('show');
    }
  });
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */
function init() {
  // Submit button click
  dom.submitBtn.addEventListener('click', signUp);

  // Enter key submits from any field
  [dom.nameInput, dom.emailInput, dom.passwordInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') signUp();
    });
  });

  // Password toggle
  dom.pwToggle.addEventListener('click', togglePassword);

  // Sign In link
  dom.signInLink.addEventListener('click', () => {
    // Update '/signin' to your actual sign-in route
    window.location.href = '/signin';
  });

  // Keyboard accessibility for Sign In link
  dom.signInLink.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = '/signin';
    }
  });

  // Live field validation on blur
  attachLiveValidation();

  // Initial latency ping
  pingLatency();

  // Optional: refresh latency every 10 seconds
  // setInterval(pingLatency, 10000);
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);