/* ─────────────────────────────────────────
   RECALL AI — signup.js
   2-step signup: collect details → verify email OTP → create account
───────────────────────────────────────── */

'use strict';

const BACKEND_URL = 'http://localhost:5000';
const API = {
  sendOtp:   `${BACKEND_URL}/api/auth/signup-send-otp`,
  verifyOtp: `${BACKEND_URL}/api/auth/signup-verify`,
  resendOtp: `${BACKEND_URL}/api/auth/signup-resend-otp`,
  ping:      `${BACKEND_URL}/api/ping`,
};

// ── DOM refs ──────────────────────────────────────────────────
const dom = {
  // Step 1
  step1:         document.getElementById('step1'),
  nameInput:     document.getElementById('name'),
  emailInput:    document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  nameError:     document.getElementById('nameError'),
  emailError:    document.getElementById('emailError'),
  passwordError: document.getElementById('passwordError'),
  submitBtn:     document.getElementById('submitBtn'),
  pwToggle:      document.getElementById('pwToggle'),
  eyeIcon:       document.getElementById('eyeIcon'),
  // Step 2
  step2:         document.getElementById('step2'),
  otpEmailLabel: document.getElementById('otpEmailLabel'),
  otpInputs:     Array.from({ length: 6 }, (_, i) => document.getElementById(`o${i}`)),
  otpError:      document.getElementById('otpError'),
  verifyBtn:     document.getElementById('verifyBtn'),
  resendBtn:     document.getElementById('resendBtn'),
  resendTimer:   document.getElementById('resendTimer'),
  // Shared
  toast:         document.getElementById('toast'),
  toastIcon:     document.getElementById('toastIcon'),
  toastMsg:      document.getElementById('toastMsg'),
  latency:       document.getElementById('latencyDisplay'),
};

// ── State ─────────────────────────────────────────────────────
let pendingEmail = '';
let resendCountdown = null;

// ── Redirect if already logged in ────────────────────────────
chrome.storage.local.get(['recall_token'], (stored) => {
  if (stored.recall_token) window.location.href = '../dashboard-page/dashboard.html';
});

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className = `toast toast--${type} show`;
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 3500);
}

// ── Loading state ─────────────────────────────────────────────
function setLoading(btn, isLoading) {
  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;
}

// ── Field errors ──────────────────────────────────────────────
function clearErrors() {
  [[dom.nameInput, dom.nameError], [dom.emailInput, dom.emailError], [dom.passwordInput, dom.passwordError]]
    .forEach(([input, err]) => { input.classList.remove('is-error'); err.classList.remove('show'); err.textContent = ''; });
}
function showFieldError(input, errorEl, message) {
  input.classList.add('is-error'); errorEl.textContent = message; errorEl.classList.add('show');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Validate step 1 inputs ────────────────────────────────────
function validateStep1() {
  clearErrors();
  let ok = true;
  if (!dom.nameInput.value.trim())      { showFieldError(dom.nameInput, dom.nameError, 'Please enter your full name.'); ok = false; }
  if (!dom.emailInput.value.trim())     { showFieldError(dom.emailInput, dom.emailError, 'Email address is required.'); ok = false; }
  else if (!EMAIL_RE.test(dom.emailInput.value.trim())) { showFieldError(dom.emailInput, dom.emailError, 'Please enter a valid email address.'); ok = false; }
  if (!dom.passwordInput.value)         { showFieldError(dom.passwordInput, dom.passwordError, 'Password is required.'); ok = false; }
  else if (dom.passwordInput.value.length < 8) { showFieldError(dom.passwordInput, dom.passwordError, 'Password must be at least 8 characters.'); ok = false; }
  return ok;
}

// ── STEP 1: Send OTP ──────────────────────────────────────────
async function sendOtp() {
  if (!validateStep1()) return;
  setLoading(dom.submitBtn, true);
  try {
    const res  = await fetch(API.sendOtp, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:     dom.nameInput.value.trim(),
        email:    dom.emailInput.value.trim(),
        password: dom.passwordInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      pendingEmail = dom.emailInput.value.trim().toLowerCase();
      showToast(`Code sent to ${pendingEmail}`, 'success');
      showStep2();
    } else {
      const msg = data.error || 'Something went wrong.';
      showToast(msg, 'error');
      const lower = msg.toLowerCase();
      if (lower.includes('email'))    showFieldError(dom.emailInput,    dom.emailError,    msg);
      if (lower.includes('name'))     showFieldError(dom.nameInput,     dom.nameError,     msg);
      if (lower.includes('password')) showFieldError(dom.passwordInput, dom.passwordError, msg);
    }
  } catch {
    showToast('Cannot reach server — is the backend running on port 5000?', 'error');
  } finally {
    setLoading(dom.submitBtn, false);
  }
}

// ── Show / hide steps ─────────────────────────────────────────
function showStep2() {
  dom.step1.style.display = 'none';
  dom.step2.style.display = 'block';
  dom.step2.classList.add('step-enter');
  if (dom.otpEmailLabel) dom.otpEmailLabel.textContent = pendingEmail;
  dom.otpInputs[0].focus();
  startResendCountdown(60);
}

function showStep1() {
  dom.step2.style.display = 'none';
  dom.step1.style.display = 'block';
}

// ── OTP input behaviour ───────────────────────────────────────
function initOtpInputs() {
  dom.otpInputs.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      if (box.value && i < 5) dom.otpInputs[i + 1].focus();
      clearOtpError();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        dom.otpInputs[i - 1].focus();
        dom.otpInputs[i - 1].value = '';
      }
      if (e.key === 'Enter') verifyOtp();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      digits.split('').forEach((d, j) => { if (dom.otpInputs[j]) dom.otpInputs[j].value = d; });
      const next = Math.min(digits.length, 5);
      dom.otpInputs[next].focus();
      clearOtpError();
    });
  });
}

function getOtpValue() { return dom.otpInputs.map(b => b.value).join(''); }

function clearOtpError() {
  dom.otpInputs.forEach(b => b.classList.remove('otp-err'));
  if (dom.otpError) { dom.otpError.textContent = ''; dom.otpError.style.display = 'none'; }
}

function showOtpError(msg) {
  dom.otpInputs.forEach(b => b.classList.add('otp-err'));
  if (dom.otpError) { dom.otpError.textContent = msg; dom.otpError.style.display = 'block'; }
}

// ── STEP 2: Verify OTP + create account ──────────────────────
async function verifyOtp() {
  const otp = getOtpValue();
  if (otp.length < 6) { showOtpError('Please enter all 6 digits.'); return; }
  clearOtpError();
  setLoading(dom.verifyBtn, true);
  try {
    const res  = await fetch(API.verifyOtp, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: pendingEmail, otp }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('Account created! Redirecting…', 'success');
      chrome.storage.local.set(
        { recall_token: data.token || '', recall_user: JSON.stringify(data.user || {}) },
        () => { setTimeout(() => { window.location.href = '../dashboard-page/dashboard.html'; }, 1800); }
      );
    } else {
      const msg = data.error || 'Incorrect code. Please try again.';
      showOtpError(msg);
      showToast(msg, 'error');
      // Clear boxes on wrong code so user can retype cleanly
      dom.otpInputs.forEach(b => b.value = '');
      dom.otpInputs[0].focus();
    }
  } catch {
    showToast('Cannot reach server — is the backend running on port 5000?', 'error');
  } finally {
    setLoading(dom.verifyBtn, false);
  }
}

// ── Resend OTP with cooldown timer ────────────────────────────
function startResendCountdown(seconds) {
  clearInterval(resendCountdown);
  dom.resendBtn.disabled = true;
  let remaining = seconds;
  function tick() {
    if (dom.resendTimer) dom.resendTimer.textContent = `Resend in ${remaining}s`;
    remaining--;
    if (remaining < 0) {
      clearInterval(resendCountdown);
      dom.resendBtn.disabled = false;
      if (dom.resendTimer) dom.resendTimer.textContent = '';
    }
  }
  tick();
  resendCountdown = setInterval(tick, 1000);
}

async function resendOtp() {
  if (dom.resendBtn.disabled) return;
  setLoading(dom.resendBtn, true);
  try {
    const res  = await fetch(API.resendOtp, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: pendingEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast('New code sent!', 'success');
      dom.otpInputs.forEach(b => b.value = '');
      dom.otpInputs[0].focus();
      clearOtpError();
      startResendCountdown(60);
    } else {
      showToast(data.error || 'Could not resend. Please try again.', 'error');
    }
  } catch {
    showToast('Cannot reach server.', 'error');
  } finally {
    setLoading(dom.resendBtn, false);
  }
}

// ── Password toggle ───────────────────────────────────────────
const EYE_OPEN   = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const EYE_CLOSED = `<line x1="2" y1="2" x2="22" y2="22"/><path d="M6.71 6.71A10.94 10.94 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.29-1.35"/><path d="M17.5 17.5A10.9 10.9 0 0 0 23 12s-4-8-11-8"/>`;
function togglePassword() {
  const isPass = dom.passwordInput.type === 'password';
  dom.passwordInput.type = isPass ? 'text' : 'password';
  dom.eyeIcon.innerHTML  = isPass ? EYE_CLOSED : EYE_OPEN;
}

// ── Latency ping ──────────────────────────────────────────────
async function pingLatency() {
  try {
    const t0 = performance.now();
    await fetch(API.ping, { cache: 'no-store' });
    if (dom.latency) dom.latency.textContent = `Latency: ${Math.round(performance.now() - t0)}ms`;
  } catch {
    if (dom.latency) dom.latency.textContent = 'Server: offline';
  }
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  // Step 1
  dom.submitBtn.addEventListener('click', sendOtp);
  [dom.nameInput, dom.emailInput, dom.passwordInput].forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });
  });
  dom.pwToggle.addEventListener('click', togglePassword);

  // Step 2
  initOtpInputs();
  dom.verifyBtn.addEventListener('click', verifyOtp);
  dom.resendBtn.addEventListener('click', resendOtp);

  // "Change email" link — go back to step 1
  const changeEmailLink = document.getElementById('changeEmailLink');
  if (changeEmailLink) changeEmailLink.addEventListener('click', showStep1);

  pingLatency();
}

document.addEventListener('DOMContentLoaded', init);
