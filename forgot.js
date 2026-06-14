/* ═══════════════════════════════════════════════════════════
   RECALL AI — forgot.js
   Handles the 4-step forgot password flow:
   Step 1 → Enter email → send OTP
   Step 2 → Enter 6-digit OTP code
   Step 3 → Set new password
   Step 4 → Success → go to login
═══════════════════════════════════════════════════════════ */
'use strict';

const API = 'http://localhost:5000';

let email      = '';
let resetToken = '';
let countdown  = null;
let toastTmr   = null;

/* ── Helpers ─────────────────────────────────────────────── */
function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  updateDots(n);
}

function updateDots(n) {
  for (let i = 1; i <= 3; i++) {
    const d = document.getElementById('pd' + i);
    d.className = 'p-dot';
    if (i < n)   d.classList.add('done');
    if (i === n) d.classList.add('active');
  }
  for (let i = 1; i <= 2; i++) {
    const l = document.getElementById('pl' + i);
    l.className = 'p-line';
    if (i < n) l.classList.add('done');
  }
  document.getElementById('progressWrap').style.display = n === 4 ? 'none' : 'flex';
}

function toast(msg, type) {
  type = type || 'ok';
  clearTimeout(toastTmr);
  document.getElementById('toastMsg').textContent  = msg;
  const icon = document.getElementById('toastIcon');
  icon.textContent = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';
  icon.className   = type === 'ok' ? 't-ok' : type === 'err' ? 't-err' : 't-info';
  const t = document.getElementById('toast');
  t.classList.add('show');
  toastTmr = setTimeout(function() { t.classList.remove('show'); }, 3500);
}

function setLoading(btn, on) {
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

function showErr(id, msg) {
  document.getElementById(id + 'Txt').textContent = msg;
  document.getElementById(id).classList.add('show');
}
function clearErr(id) {
  document.getElementById(id).classList.remove('show');
}

/* ── OTP boxes ───────────────────────────────────────────── */
var boxes = [0,1,2,3,4,5].map(function(i) {
  return document.getElementById('o' + i);
});

boxes.forEach(function(box, i) {
  box.addEventListener('input', function() {
    box.value = box.value.replace(/\D/g, '').slice(0, 1);
    clearErr('otpErr');
    box.classList.toggle('filled', !!box.value);
    box.classList.remove('err');
    if (box.value && i < 5) boxes[i + 1].focus();
  });

  box.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && !box.value && i > 0) {
      boxes[i - 1].value = '';
      boxes[i - 1].classList.remove('filled');
      boxes[i - 1].focus();
    }
    if (e.key === 'Enter') document.getElementById('verifyBtn').click();
  });

  box.addEventListener('paste', function(e) {
    e.preventDefault();
    var txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (txt.length >= 6) {
      boxes.forEach(function(b, j) {
        b.value = txt[j] || '';
        b.classList.toggle('filled', !!b.value);
      });
      boxes[5].focus();
    }
  });
});

function getOtp()   { return boxes.map(function(b) { return b.value; }).join(''); }
function resetOtp() { boxes.forEach(function(b) { b.value = ''; b.classList.remove('filled', 'err'); }); boxes[0].focus(); }
function errorOtp() {
  boxes.forEach(function(b) {
    b.classList.add('err');
    setTimeout(function() { b.classList.remove('err'); }, 600);
  });
}

/* ── Countdown timer ─────────────────────────────────────── */
function startCountdown(sec) {
  clearInterval(countdown);
  var t = sec;
  document.getElementById('countNum').textContent = t;
  document.getElementById('countdownTxt').style.display = 'inline';
  document.getElementById('resendBtn').style.display = 'none';
  countdown = setInterval(function() {
    t--;
    document.getElementById('countNum').textContent = t;
    if (t <= 0) {
      clearInterval(countdown);
      document.getElementById('countdownTxt').style.display = 'none';
      document.getElementById('resendBtn').style.display    = 'inline';
    }
  }, 1000);
}

/* ── Password strength ───────────────────────────────────── */
document.getElementById('newPass').addEventListener('input', function() {
  var v = this.value;

  document.getElementById('req-len').classList.toggle('met',   v.length >= 8);
  document.getElementById('req-upper').classList.toggle('met', /[A-Z]/.test(v));
  document.getElementById('req-num').classList.toggle('met',   /[0-9]/.test(v));

  var s = 0;
  if (v.length >= 8)           s++;
  if (v.length >= 12)          s++;
  if (/[A-Z]/.test(v))         s++;
  if (/[0-9]/.test(v))         s++;
  if (/[^A-Za-z0-9]/.test(v))  s++;

  var bar  = document.getElementById('sBar');
  var lbl  = document.getElementById('sLabel');
  var hint = document.getElementById('sHint');
  var pct  = v ? (s / 5) * 100 : 0;
  bar.style.width = pct + '%';

  var levels = [
    ['#ff6b6b', 'Weak',   'Add uppercase & numbers'],
    ['#ff6b6b', 'Weak',   'Add uppercase & numbers'],
    ['#f59e0b', 'Fair',   'Add a special character'],
    ['#9fa7ff', 'Good',   'Almost there!'],
    ['#4ade80', 'Strong', 'Great security key!'],
    ['#4ade80', 'Strong', 'Great security key!']
  ];
  var col  = levels[s][0];
  var name = levels[s][1];
  var tip  = levels[s][2];
  bar.style.background = v ? col : 'transparent';
  lbl.textContent = v ? name : '';
  lbl.style.color = col;
  hint.textContent = v ? tip : '';
  clearErr('newPassErr');
});

/* ── STEP 1: Send OTP ────────────────────────────────────── */
document.getElementById('sendBtn').addEventListener('click', async function() {
  var val = document.getElementById('emailInput').value.trim();
  clearErr('emailErr');
  document.getElementById('emailInput').classList.remove('err');

  if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    document.getElementById('emailInput').classList.add('err');
    showErr('emailErr', 'Please enter a valid email address.');
    return;
  }

  var btn = document.getElementById('sendBtn');
  setLoading(btn, true);

  try {
    var res  = await fetch(API + '/api/user/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: val })
    });
    var data = await res.json();

    if (!res.ok) {
      showErr('emailErr', data.error || 'Failed to send code. Try again.');
      document.getElementById('emailInput').classList.add('err');
      return;
    }

    email = val;
    document.getElementById('sentToEmail').textContent = val;
    showStep(2);
    setTimeout(function() { boxes[0].focus(); }, 350);
    startCountdown(60);

    // Dev mode — auto-fill OTP if returned
    if (data.devOtp) {
      var d = String(data.devOtp);
      boxes.forEach(function(b, j) {
        b.value = d[j] || '';
        b.classList.toggle('filled', !!d[j]);
      });
      toast('Code auto-filled (dev mode)', 'info');
    } else {
      toast('Code sent! Check your email.', 'ok');
    }

  } catch (err) {
    showErr('emailErr', 'Cannot reach server. Make sure backend is running.');
  } finally {
    setLoading(btn, false);
  }
});

document.getElementById('emailInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

/* ── Resend code ─────────────────────────────────────────── */
async function resendCode() {
  if (!email) return;
  document.getElementById('resendBtn').style.display    = 'none';
  document.getElementById('countdownTxt').style.display = 'inline';
  document.getElementById('countNum').textContent       = '…';

  try {
    var res  = await fetch(API + '/api/user/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email })
    });
    var data = await res.json();
    resetOtp();
    clearErr('otpErr');
    startCountdown(60);
    toast('New code sent!', 'ok');

    if (data.devOtp) {
      var d = String(data.devOtp);
      boxes.forEach(function(b, j) {
        b.value = d[j] || '';
        b.classList.toggle('filled', !!d[j]);
      });
    }
  } catch (err) {
    toast('Could not resend. Try again.', 'err');
    startCountdown(30);
  }
}

document.getElementById('resendBtn').addEventListener('click', resendCode);

/* ── STEP 2: Verify OTP ──────────────────────────────────── */
document.getElementById('verifyBtn').addEventListener('click', async function() {
  var otp = getOtp();
  clearErr('otpErr');

  if (otp.length < 6) {
    showErr('otpErr', 'Enter all 6 digits of the code.');
    errorOtp();
    return;
  }

  var btn = document.getElementById('verifyBtn');
  setLoading(btn, true);

  try {
    var res  = await fetch(API + '/api/user/verify-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email, otp: otp })
    });
    var data = await res.json();

    if (!res.ok) {
      showErr('otpErr', data.error || 'Incorrect code. Please try again.');
      errorOtp();
      return;
    }

    resetToken = data.resetToken;
    clearInterval(countdown);
    showStep(3);
    setTimeout(function() { document.getElementById('newPass').focus(); }, 350);

  } catch (err) {
    showErr('otpErr', 'Cannot reach server.');
  } finally {
    setLoading(btn, false);
  }
});

/* ── STEP 3: Reset password ──────────────────────────────── */
document.getElementById('resetBtn').addEventListener('click', async function() {
  var np = document.getElementById('newPass').value;
  var cp = document.getElementById('confPass').value;
  clearErr('newPassErr');
  clearErr('confErr');
  document.getElementById('newPass').classList.remove('err');
  document.getElementById('confPass').classList.remove('err');

  if (np.length < 8) {
    showErr('newPassErr', 'Security key must be at least 8 characters.');
    document.getElementById('newPass').classList.add('err');
    return;
  }
  if (np !== cp) {
    showErr('confErr', 'Security keys do not match.');
    document.getElementById('confPass').classList.add('err');
    return;
  }

  var btn = document.getElementById('resetBtn');
  setLoading(btn, true);

  try {
    var res  = await fetch(API + '/api/user/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ resetToken: resetToken, newPassword: np })
    });
    var data = await res.json();

    if (res.ok) {
      // Save email so login page can pre-fill it
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ recall_prefill_email: email });
        }
      } catch(e) {}
      try { sessionStorage.setItem('recall_prefill_email', email); } catch(e) {}
      showStep(4);
    } else {
      toast(data.error || 'Reset failed. Please start over.', 'err');
    }
  } catch (err) {
    toast('Cannot reach server.', 'err');
  } finally {
    setLoading(btn, false);
  }
});

/* ── STEP 4 → login ──────────────────────────────────────── */
document.getElementById('goLoginFinal').addEventListener('click', function() {
  window.location.href = '../login-page/login.html';
});

/* ── Navigation ──────────────────────────────────────────── */
document.getElementById('goLogin').addEventListener('click', function() {
  window.location.href = '../login-page/login.html';
});

document.getElementById('backToEmail').addEventListener('click', function() {
  clearInterval(countdown);
  resetOtp();
  clearErr('otpErr');
  showStep(1);
});

/* ── Password eye toggles ────────────────────────────────── */
document.getElementById('eye1').addEventListener('click', function() {
  var i = document.getElementById('newPass');
  i.type = i.type === 'password' ? 'text' : 'password';
});
document.getElementById('eye2').addEventListener('click', function() {
  var i = document.getElementById('confPass');
  i.type = i.type === 'password' ? 'text' : 'password';
});
