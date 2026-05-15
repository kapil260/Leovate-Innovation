/* ─────────────────────────────────────────
   RECALL AI — login.js
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG — update to match your backend
───────────────────────────────────────── */
const API = {
  signin:         '/api/auth/signin',         // POST { email, password }
  forgotPassword: '/api/auth/forgot-password', // POST { email }
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  emailInput:    document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  emailError:    document.getElementById('emailError'),
  passwordError: document.getElementById('passwordError'),
  submitBtn:     document.getElementById('submitBtn'),
  buttonText:    document.querySelector('.button-text'),
  spinner:       document.getElementById('spinner'),
  pwToggle:      document.getElementById('pwToggle'),
  eyeIcon:       document.getElementById('eyeIcon'),
  signUpLink:    document.getElementById('signUpLink'),
  forgotLink:    document.getElementById('forgotLink'),
  toast:         document.getElementById('toast'),
  toastIcon:     document.getElementById('toastIcon'),
  toastMsg:      document.getElementById('toastMsg'),
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
let toastTimer = null;

function showToast(message, type) {
  clearTimeout(toastTimer);

  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className       = 'toast toast-' + type + ' show';

  toastTimer = setTimeout(function () {
    dom.toast.classList.remove('show');
  }, 3500);
}

/* ─────────────────────────────────────────
   LOADING STATE
───────────────────────────────────────── */
function setLoading(isLoading) {
  dom.submitBtn.classList.toggle('loading', isLoading);
}

/* ─────────────────────────────────────────
   FIELD ERROR HELPERS
───────────────────────────────────────── */
function clearErrors() {
  dom.emailInput.closest('.input').classList.remove('is-error');
  dom.passwordInput.closest('.input').classList.remove('is-error');
  dom.emailError.classList.remove('show');
  dom.passwordError.classList.remove('show');
  dom.emailError.textContent    = '';
  dom.passwordError.textContent = '';
}

function showFieldError(input, errorEl, message) {
  input.closest('.input').classList.add('is-error');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

/* ─────────────────────────────────────────
   VALIDATION
───────────────────────────────────────── */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate() {
  clearErrors();

  var email    = dom.emailInput.value.trim();
  var password = dom.passwordInput.value;
  var isValid  = true;

  if (!email) {
    showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    isValid = false;
  } else if (!EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    isValid = false;
  }

  if (!password) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Security key is required.');
    isValid = false;
  } else if (password.length < 8) {
    showFieldError(dom.passwordInput, dom.passwordError, 'Security key must be at least 8 characters.');
    isValid = false;
  }

  return isValid;
}

/* ─────────────────────────────────────────
   SIGN IN — API CALL
───────────────────────────────────────── */
async function signIn() {
  if (!validate()) return;

  setLoading(true);

  var payload = {
    email:    dom.emailInput.value.trim(),
    password: dom.passwordInput.value,
  };

  try {
    var response = await fetch(API.signin, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    var data = await response.json().catch(function () { return {}; });

    if (response.ok) {
      // ── SUCCESS ──────────────────────────
      showToast('Neural link established. Redirecting…', 'success');

      // Store token if API returns one
      if (data.token) {
        localStorage.setItem('recall_token', data.token);
      }

      // Store user info if API returns it
      if (data.user) {
        localStorage.setItem('recall_user', JSON.stringify(data.user));
      }

      // Redirect — update '/dashboard' to your actual route
      setTimeout(function () {
        window.location.href = data.redirect || '/dashboard';
      }, 1800);

    } else {
      // ── SERVER ERROR ─────────────────────
      var message = data.message || data.error || 'Invalid credentials. Please try again.';
      showToast(message, 'error');

      // Map server errors back to specific fields
      var lower = message.toLowerCase();
      if (lower.includes('email') || lower.includes('user') || lower.includes('account')) {
        showFieldError(dom.emailInput, dom.emailError, message);
      }
      if (lower.includes('password') || lower.includes('key') || lower.includes('credential')) {
        showFieldError(dom.passwordInput, dom.passwordError, 'Incorrect security key.');
      }
    }

  } catch (networkError) {
    // ── NETWORK ERROR ─────────────────────
    showToast('Network error — check your connection.', 'error');
    console.error('[Recall AI] Signin error:', networkError);

  } finally {
    setLoading(false);
  }
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD
───────────────────────────────────────── */
async function forgotPassword() {
  var email = dom.emailInput.value.trim();

  if (!email || !EMAIL_RE.test(email)) {
    showFieldError(dom.emailInput, dom.emailError, 'Enter your email above first.');
    return;
  }

  try {
    var response = await fetch(API.forgotPassword, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email }),
    });

    if (response.ok) {
      showToast('Reset link sent to ' + email, 'success');
    } else {
      showToast('Could not send reset link. Try again.', 'error');
    }
  } catch {
    showToast('Network error — check your connection.', 'error');
  }
}

/* ─────────────────────────────────────────
   PASSWORD TOGGLE
───────────────────────────────────────── */
var EYE_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
var EYE_CLOSED = '<line x1="2" y1="2" x2="22" y2="22"/><path d="M6.71 6.71A10.94 10.94 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.29-1.35M10.59 10.59a3 3 0 0 0 4 4.24"/><path d="M17.5 17.5A10.9 10.9 0 0 0 23 12s-4-8-11-8a10.9 10.9 0 0 0-3.18.5"/>';

function togglePassword() {
  var isPassword = dom.passwordInput.type === 'password';
  dom.passwordInput.type = isPassword ? 'text' : 'password';
  dom.eyeIcon.innerHTML  = isPassword ? EYE_CLOSED : EYE_OPEN;
  dom.pwToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
}

/* ─────────────────────────────────────────
   LIVE VALIDATION (on blur)
───────────────────────────────────────── */
function attachLiveValidation() {
  dom.emailInput.addEventListener('blur', function () {
    var val = dom.emailInput.value.trim();
    if (!val) {
      showFieldError(dom.emailInput, dom.emailError, 'Email address is required.');
    } else if (!EMAIL_RE.test(val)) {
      showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.');
    } else {
      dom.emailInput.closest('.input').classList.remove('is-error');
      dom.emailError.classList.remove('show');
    }
  });

  dom.passwordInput.addEventListener('blur', function () {
    var val = dom.passwordInput.value;
    if (!val) {
      showFieldError(dom.passwordInput, dom.passwordError, 'Security key is required.');
    } else if (val.length < 8) {
      showFieldError(dom.passwordInput, dom.passwordError, 'Security key must be at least 8 characters.');
    } else {
      dom.passwordInput.closest('.input').classList.remove('is-error');
      dom.passwordError.classList.remove('show');
    }
  });
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */
function init() {
  // Submit button click
  dom.submitBtn.addEventListener('click', signIn);

  // Enter key on any field
  [dom.emailInput, dom.passwordInput].forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') signIn();
    });
  });

  // Password visibility
  dom.pwToggle.addEventListener('click', togglePassword);

  // Forgot password
  dom.forgotLink.addEventListener('click', forgotPassword);

  // Sign up link — update '/signup' to your route
  dom.signUpLink.addEventListener('click', function () {
    window.location.href = 'Signup.html';
  });

  dom.signUpLink.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = 'Signup.html';
    }
  });

  // Live validation
  attachLiveValidation();
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);