/* ─────────────────────────────────────────
   RECALL AI — subscription.js
   All subscription page logic in one place.
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG — update to match your backend
───────────────────────────────────────── */
const API = {
  upgrade:         '/api/subscription/upgrade',
  cancel:          '/api/subscription/cancel',
  manageBilling:   '/api/subscription/portal',
  invoices:        '/api/subscription/invoices',
  downloadInvoice: '/api/subscription/invoice/',
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  billingToggle:     document.getElementById('billingToggle'),
  labelMonthly:      document.getElementById('labelMonthly'),
  labelAnnual:       document.getElementById('labelAnnual'),
  saveBadge:         document.getElementById('saveBadge'),
  managePlanBtn:     document.getElementById('managePlanBtn'),
  exportInvoicesBtn: document.getElementById('exportInvoicesBtn'),
  btnFree:           document.getElementById('btnFree'),
  btnPro:            document.getElementById('btnPro'),
  btnUltra:          document.getElementById('btnUltra'),
  modalOverlay:      document.getElementById('modalOverlay'),
  modalClose:        document.getElementById('modalClose'),
  modalConfirmBtn:   document.getElementById('modalConfirmBtn'),
  modalBadge:        document.getElementById('modalBadge'),
  modalTitle:        document.getElementById('modalTitle'),
  modalSubtitle:     document.getElementById('modalSubtitle'),
  modalPrice:        document.getElementById('modalPrice'),
  modalFeatures:     document.getElementById('modalFeatures'),
  toast:             document.getElementById('toast'),
  toastIcon:         document.getElementById('toastIcon'),
  toastMsg:          document.getElementById('toastMsg'),
  invoiceDownloads:  document.querySelectorAll('.invoice-download'),
  usageBars:         document.querySelectorAll('.usage-bar-fill'),
  invoiceSection:    document.getElementById('invoiceSection'),
  currentPlanName:   document.getElementById('currentPlanName'),
  renewDate:         document.getElementById('renewDate'),
};

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
var billing      = 'monthly';
var pendingPlan  = null;
var currentPlan  = 'free';
var hasSubscribed = false;

var plans = {
  pro: {
    label:    'PRO',
    name:     'Recall Pro',
    subtitle: "You're about to unlock everything in Recall Pro.",
    monthly:  10,
    annual:   8,
    features: [
      '1,000 searches / month',
      'All 7 AI platforms',
      'CSV + JSON export',
      'Share links',
      'Priority support',
      'Unlimited history',
    ],
  },
  ultra: {
    label:    'ULTRA',
    name:     'Recall AI Ultra',
    subtitle: "You're about to unlock unlimited neural infrastructure.",
    monthly:  50,
    annual:   40,
    features: [
      'Unlimited everything',
      '100 TB cognitive storage',
      'Sub-1ms dedicated latency',
      'Team neural workspaces',
      'Advanced API access',
      'Dedicated neural architect',
    ],
  },
  free: {
    label:    'FREE',
    name:     'Recall Lite',
    subtitle: 'You are about to downgrade to the free tier.',
    monthly:  0,
    annual:   0,
    features: [
      '100 searches / month',
      '3 AI platforms',
      'Basic JSON export',
      '7-day history',
    ],
  },
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
var toastTimer = null;

function showToast(message, type) {
  type = type || 'success';
  clearTimeout(toastTimer);
  dom.toastMsg.textContent  = message;
  dom.toastIcon.textContent = type === 'success' ? '✓' : '✕';
  dom.toast.className       = 'toast toast-' + type + ' show';
  toastTimer = setTimeout(function () {
    dom.toast.classList.remove('show');
  }, 3200);
}

/* ─────────────────────────────────────────
   BILLING TOGGLE
───────────────────────────────────────── */
function updatePrices() {
  var isAnnual = billing === 'annual';
  document.querySelectorAll('.card-price').forEach(function (el) {
    var monthly = parseInt(el.dataset.monthly, 10);
    var annual  = parseInt(el.dataset.annual, 10);
    el.textContent = isAnnual ? annual : monthly;
  });
  dom.labelMonthly.classList.toggle('billing-active', !isAnnual);
  dom.labelAnnual.classList.toggle('billing-active', isAnnual);
  dom.billingToggle.classList.toggle('annual-active', isAnnual);
  dom.saveBadge.classList.toggle('badge-active', isAnnual);
  if (pendingPlan && plans[pendingPlan]) {
    var price = isAnnual ? plans[pendingPlan].annual : plans[pendingPlan].monthly;
    dom.modalPrice.textContent = price;
  }
}

function handleBillingToggle() {
  billing = billing === 'monthly' ? 'annual' : 'monthly';
  updatePrices();
}

/* ─────────────────────────────────────────
   MODAL (Upgrade Confirmation)
───────────────────────────────────────── */
function openModal(plan) {
  var data = plans[plan];
  if (!data) return;
  pendingPlan = plan;
  dom.modalBadge.textContent    = data.label;
  dom.modalTitle.textContent    = 'Upgrade to ' + data.name;
  dom.modalSubtitle.textContent = data.subtitle;
  var price = billing === 'annual' ? data.annual : data.monthly;
  dom.modalPrice.textContent = price;
  dom.modalFeatures.innerHTML = data.features
    .map(function (f) { return '<div class="modal-feature">✓ ' + f + '</div>'; })
    .join('');
  dom.modalOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  dom.modalOverlay.classList.remove('show');
  document.body.style.overflow = '';
  pendingPlan = null;
}

/* ─────────────────────────────────────────
   PAYMENT MODAL
───────────────────────────────────────── */
function openPaymentModal(plan) {
  var data  = plans[plan];
  var price = billing === 'annual' ? data.annual : data.monthly;
  var period = billing === 'annual' ? 'mo billed annually' : 'month';

  closeModal();

  var existing = document.getElementById('paymentModalOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'paymentModalOverlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;background:rgba(0,0,0,0.80);',
    'backdrop-filter:blur(10px);z-index:10000;',
    'display:flex;align-items:center;justify-content:center;',
    'opacity:0;transition:opacity 0.25s ease;',
    'padding:16px;'
  ].join('');

  overlay.innerHTML = `
    <div id="paymentCard" style="
      background:linear-gradient(145deg,#0d1730,#111e3a);
      border:1px solid rgba(159,167,255,0.25);border-radius:20px;padding:36px;
      width:440px;max-width:100%;position:relative;
      box-shadow:0 40px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(159,167,255,0.1);
      transform:translateY(20px);transition:transform 0.3s ease;
      max-height:90vh;overflow-y:auto;">

      <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);width:60%;height:1px;background:linear-gradient(90deg,transparent,rgba(159,167,255,0.6),transparent);"></div>

      <button id="payClose" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:50%;width:32px;height:32px;cursor:pointer;color:#8893a7;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">×</button>

      <div style="margin-bottom:24px;">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:#9fa7ff;text-transform:uppercase;margin-bottom:6px;">🔒 Secure Payment</div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#fff;">Complete Your Upgrade</div>
        <div style="font-family:'Manrope',sans-serif;font-size:13px;color:#5a6480;margin-top:4px;">${data.name} · $${price}/${period}</div>
      </div>

      <div style="background:rgba(159,167,255,0.06);border:1px solid rgba(159,167,255,0.12);border-radius:12px;padding:14px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;color:#fff;">${data.name}</div>
          <div style="font-family:'Manrope',sans-serif;font-size:11px;color:#5a6480;margin-top:2px;">${billing === 'annual' ? 'Annual billing — 20% off' : 'Monthly billing'}</div>
        </div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#9fa7ff;">$${price}<span style="font-size:11px;color:#5a6480;font-weight:400;">/mo</span></div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#5a6480;text-transform:uppercase;display:block;margin-bottom:8px;">Card Number</label>
        <div style="position:relative;">
          <input id="payCardNum" type="text" inputmode="numeric" maxlength="19" placeholder="1234 5678 9012 3456"
            style="width:100%;padding:13px 48px 13px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(159,167,255,0.2);border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;letter-spacing:2px;outline:none;"/>
          <svg style="position:absolute;right:14px;top:50%;transform:translateY(-50%);opacity:0.35;" width="28" height="20" viewBox="0 0 28 20" fill="none">
            <rect width="28" height="20" rx="4" fill="#9fa7ff" opacity=".1"/>
            <rect y="4" width="28" height="4" fill="#9fa7ff" opacity=".25"/>
          </svg>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div>
          <label style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#5a6480;text-transform:uppercase;display:block;margin-bottom:8px;">Expiry</label>
          <input id="payExpiry" type="text" inputmode="numeric" maxlength="5" placeholder="MM / YY"
            style="width:100%;padding:13px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(159,167,255,0.2);border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;outline:none;"/>
        </div>
        <div>
          <label style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#5a6480;text-transform:uppercase;display:block;margin-bottom:8px;">CVV</label>
          <input id="payCvv" type="text" inputmode="numeric" maxlength="4" placeholder="• • •"
            style="width:100%;padding:13px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(159,167,255,0.2);border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;outline:none;"/>
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <label style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#5a6480;text-transform:uppercase;display:block;margin-bottom:8px;">Cardholder Name</label>
        <input id="payName" type="text" placeholder="Full name on card"
          style="width:100%;padding:13px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(159,167,255,0.2);border-radius:10px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;outline:none;"/>
      </div>

      <div id="payError" style="display:none;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-family:'Manrope',sans-serif;font-size:12px;color:#ff8080;"></div>

      <button id="paySubmitBtn" style="width:100%;padding:16px;background:linear-gradient(135deg,#5b6bff,#9fa7ff);border-radius:12px;color:#060e20;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 24px rgba(91,107,255,0.35);border:none;">
        PAY $${price} NOW
      </button>

      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;">
        <svg width="12" height="12" fill="none" stroke="#3a4460" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style="font-family:'Manrope',sans-serif;font-size:11px;color:#3a4460;">256-bit SSL encrypted · Secured by Stripe</span>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(function () {
    overlay.style.opacity = '1';
    document.getElementById('paymentCard').style.transform = 'translateY(0)';
  });

  /* Input formatters */
  document.getElementById('payCardNum').addEventListener('input', function (e) {
    var v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
  document.getElementById('payExpiry').addEventListener('input', function (e) {
    var v = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    e.target.value = v;
  });

  /* Focus styles */
  overlay.querySelectorAll('input').forEach(function (inp) {
    inp.addEventListener('focus', function () {
      this.style.borderColor = 'rgba(159,167,255,0.65)';
      this.style.background  = 'rgba(159,167,255,0.07)';
    });
    inp.addEventListener('blur', function () {
      this.style.borderColor = 'rgba(159,167,255,0.2)';
      this.style.background  = 'rgba(255,255,255,0.04)';
    });
  });

  function closePayModal() {
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 250);
  }

  document.getElementById('payClose').addEventListener('click', closePayModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closePayModal(); });

  /* Submit */
  document.getElementById('paySubmitBtn').addEventListener('click', function () {
    var cardNum = document.getElementById('payCardNum').value.replace(/\s/g, '');
    var expiry  = document.getElementById('payExpiry').value;
    var cvv     = document.getElementById('payCvv').value;
    var name    = document.getElementById('payName').value.trim();
    var errEl   = document.getElementById('payError');
    errEl.style.display = 'none';

    if (cardNum.length < 16) { errEl.textContent = 'Please enter a valid 16-digit card number.'; errEl.style.display = 'block'; return; }
    if (expiry.length < 5)   { errEl.textContent = 'Please enter a valid expiry date (MM/YY).';  errEl.style.display = 'block'; return; }
    if (cvv.length < 3)      { errEl.textContent = 'Please enter a valid CVV.';                   errEl.style.display = 'block'; return; }
    if (!name)               { errEl.textContent = 'Please enter the cardholder name.';            errEl.style.display = 'block'; return; }

    var btn = document.getElementById('paySubmitBtn');
    btn.textContent      = 'PROCESSING…';
    btn.style.opacity    = '0.65';
    btn.style.pointerEvents = 'none';

    setTimeout(function () {
      closePayModal();

      currentPlan   = plan;
      hasSubscribed = true;

      if (dom.invoiceSection) {
        dom.invoiceSection.style.display   = '';
        dom.invoiceSection.style.animation = 'fadeSlideUp 0.4s ease forwards';
      }

      if (dom.currentPlanName) dom.currentPlanName.textContent = data.name;
      if (dom.renewDate) {
        var now = new Date();
        now.setMonth(now.getMonth() + 1);
        dom.renewDate.textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      if (dom.managePlanBtn) dom.managePlanBtn.textContent = 'Manage Billing';

      showToast('Payment successful! Welcome to ' + data.name + '!', 'success');
      updateButtonStates();
    }, 1800);
  });
}

/* ─────────────────────────────────────────
   CONFIRM UPGRADE / DOWNGRADE
───────────────────────────────────────── */
async function confirmUpgrade() {
  if (!pendingPlan) return;

  if (pendingPlan === 'pro' || pendingPlan === 'ultra') {
    openPaymentModal(pendingPlan);
    return;
  }

  var btn      = dom.modalConfirmBtn;
  var original = btn.textContent;
  btn.textContent      = 'PROCESSING…';
  btn.style.opacity    = '0.6';
  btn.style.pointerEvents = 'none';

  try {
    await new Promise(function (r) { setTimeout(r, 1200); });
    currentPlan   = pendingPlan;
    hasSubscribed = false;
    if (dom.invoiceSection)  dom.invoiceSection.style.display = 'none';
    if (dom.currentPlanName) dom.currentPlanName.textContent = 'Free Plan';
    if (dom.renewDate)       dom.renewDate.textContent = 'Upgrade to unlock Pro';
    if (dom.managePlanBtn)   dom.managePlanBtn.textContent = 'Upgrade Now';
    closeModal();
    showToast('Downgraded to Free plan.', 'success');
    updateButtonStates();
  } catch (err) {
    showToast(err.message || 'Update failed. Try again.', 'error');
  } finally {
    btn.textContent      = original;
    btn.style.opacity    = '1';
    btn.style.pointerEvents = 'auto';
  }
}

/* ─────────────────────────────────────────
   UPDATE BUTTON STATES AFTER PLAN CHANGE
───────────────────────────────────────── */
function updateButtonStates() {
  var buttons = { free: dom.btnFree, pro: dom.btnPro, ultra: dom.btnUltra };

  Object.keys(buttons).forEach(function (plan) {
    var btn = buttons[plan];
    if (!btn) return;

    btn.className = 'card-btn';
    btn.disabled  = false;

    if (plan === currentPlan) {
      btn.textContent = 'YOUR CURRENT PLAN';
      btn.classList.add(plan === 'pro' ? 'card-btn-active' : plan === 'ultra' ? 'card-btn-ultra' : 'card-btn-ghost');
      btn.disabled = true;
    } else if (plan === 'ultra') {
      btn.textContent = 'UPGRADE TO ULTRA';
      btn.classList.add('card-btn-ultra');
    } else if (plan === 'pro') {
      btn.textContent = currentPlan === 'ultra' ? 'SWITCH TO PRO' : 'UPGRADE TO PRO';
      btn.classList.add('card-btn-active');
    } else if (plan === 'free') {
      btn.textContent = 'DOWNGRADE TO FREE';
      btn.classList.add('card-btn-ghost');
    }
  });
}

/* ─────────────────────────────────────────
   MANAGE BILLING
───────────────────────────────────────── */
async function manageBilling() {
  if (currentPlan === 'free') {
    openPaymentModal('pro');
    return;
  }
  showToast('Opening billing portal…', 'success');
}

/* ─────────────────────────────────────────
   EXPORT INVOICES
───────────────────────────────────────── */
function exportInvoices() {
  showToast('Preparing invoice export…', 'success');
}

/* ─────────────────────────────────────────
   DOWNLOAD SINGLE INVOICE
───────────────────────────────────────── */
function downloadInvoice(invoiceId) {
  showToast('Downloading invoice…', 'success');
}

/* ─────────────────────────────────────────
   USAGE BARS — animate on load
───────────────────────────────────────── */
function animateUsageBars() {
  dom.usageBars.forEach(function (bar) {
    var target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(function () { bar.style.width = target; }, 300);
  });
}

/* ─────────────────────────────────────────
   PRICING CARDS — entry animation
───────────────────────────────────────── */
function animateCardsIn() {
  document.querySelectorAll('.pricing-card').forEach(function (card, i) {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(24px)';
    setTimeout(function () {
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease, border-color 0.25s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, 80 * i);
  });
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */
function init() {
  if (dom.billingToggle) dom.billingToggle.addEventListener('click', handleBillingToggle);

  if (dom.btnPro)   dom.btnPro.addEventListener('click',   function () { if (currentPlan !== 'pro')   openModal('pro');   });
  if (dom.btnUltra) dom.btnUltra.addEventListener('click', function () { if (currentPlan !== 'ultra') openModal('ultra'); });
  if (dom.btnFree)  dom.btnFree.addEventListener('click',  function () { if (currentPlan !== 'free')  openModal('free');  });

  if (dom.modalClose)      dom.modalClose.addEventListener('click', closeModal);
  if (dom.modalOverlay)    dom.modalOverlay.addEventListener('click', function (e) { if (e.target === dom.modalOverlay) closeModal(); });
  if (dom.modalConfirmBtn) dom.modalConfirmBtn.addEventListener('click', confirmUpgrade);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  if (dom.managePlanBtn)     dom.managePlanBtn.addEventListener('click', manageBilling);
  if (dom.exportInvoicesBtn) dom.exportInvoicesBtn.addEventListener('click', exportInvoices);

  dom.invoiceDownloads.forEach(function (btn) {
    btn.addEventListener('click', function () { downloadInvoice(btn.dataset.id); });
  });

  updatePrices();
  updateButtonStates();
  animateCardsIn();
  setTimeout(animateUsageBars, 400);

  var style = document.createElement('style');
  style.textContent = '@keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }';
  document.head.appendChild(style);
}

/* ─────────────────────────────────────────
   LOAD REAL USAGE FROM STORAGE
───────────────────────────────────────── */
/*
 * Derived-metric ratios per search:
 *   apiCalls  — each chatbot search triggers 2 backend calls
 *               (one to /api/searches/save, one for Gemini AI summarisation).
 *   storageMb — each search stores query + AI summary (~8 KB average).
 *   exports   — users typically export once per ~15 searches.
 *
 * Neural Bandwidth (sidebar):
 *   Total DB capacity = 10 TB. Baseline already-used leaves 6.5 TB remaining.
 *   Each session's storage is subtracted from that remaining pool.
 *   Bar width = (remaining TB / 10 TB) × 100 %.
 */
var NEURAL_BANDWIDTH_TOTAL_TB = 10;
var NEURAL_BANDWIDTH_BASE_REMAINING_TB = 6.5;

/*
 * loadUsageStats — three-layer data strategy:
 *
 *  1. LIVE BACKEND  (/api/searches/stats)
 *     Fetches the real totalSearches from Supabase. This is the true source
 *     of truth — it counts every search the user has ever saved across all
 *     devices and sessions, including the ones visible in dashboard/history.
 *
 *  2. LOCAL STORAGE  (recallUsage in chrome.storage.local)
 *     Written by background.js on every save and by dashboard.js on load.
 *     Used to pick up the exports count (which the backend has no endpoint
 *     for) and as an instant pre-paint value while the fetch is in flight.
 *
 *  3. DERIVED FALLBACK
 *     If neither source has a value for apiCalls / storageMb, they are
 *     computed from searches (2 API calls + 8 KB storage per search).
 */
function loadUsageStats() {
  var defaultUsage = { searches: 0, storageMb: 0, apiCalls: 0, exports: 0 };

  function applyUsage(usage) {
    var searches  = usage.searches || 0;

    // Derive dependent metrics; prefer explicitly stored values when present
    var storageMb = (typeof usage.storageMb === 'number' && usage.storageMb > 0)
      ? usage.storageMb
      : searches * 0.008;                         // ~8 KB per search entry

    var apiCalls  = (typeof usage.apiCalls === 'number' && usage.apiCalls > 0)
      ? usage.apiCalls
      : searches * 2;                              // save + Gemini AI call

    var exports_n = (typeof usage.exports  === 'number' && usage.exports  > 0)
      ? usage.exports
      : Math.floor(searches / 15);                // ~1 export per 15 searches

    var searchPct  = Math.min((searches  / 1000)        * 100, 100).toFixed(1);
    var storagePct = Math.min((storageMb / (10 * 1024)) * 100, 100).toFixed(1);
    var apiPct     = Math.min((apiCalls  / 2000)        * 100, 100).toFixed(1);
    var exportPct  = Math.min((exports_n / 50)          * 100, 100).toFixed(1);

    // Smart storage label: show KB below 1 MB, MB below 1 GB, GB otherwise.
    // This prevents small values (e.g. 0.24 MB) from rounding to "0.00 GB".
    function formatStorage(mb) {
      if (mb <= 0)       return '0 KB';
      if (mb < 1)        return (mb * 1024).toFixed(0) + ' KB';
      if (mb < 1024)     return mb.toFixed(2) + ' MB';
      return (mb / 1024).toFixed(2) + ' GB';
    }
    var storageLabel    = formatStorage(storageMb);
    var storageGbRaw    = storageMb / 1024;               // keep as number for sub-label
    var storageSubLabel = storageGbRaw >= 0.01
      ? storageGbRaw.toFixed(2) + ' of 10 GB used'
      : (storageMb >= 1
          ? storageMb.toFixed(2) + ' MB of 10 GB used'
          : (storageMb * 1024).toFixed(0) + ' KB of 10 GB used');

    var el = function (id) { return document.getElementById(id); };

    if (el('usageSearchesVal')) el('usageSearchesVal').textContent = searches >= 1000 ? (searches / 1000).toFixed(1) + 'k' : searches;
    if (el('usageSearchesBar')) el('usageSearchesBar').style.width = searchPct + '%';
    if (el('usageSearchesSub')) el('usageSearchesSub').textContent = searches + ' of 1,000 used';

    if (el('usageStorageVal')) el('usageStorageVal').textContent = storageLabel;
    if (el('usageStorageBar')) el('usageStorageBar').style.width = storagePct + '%';
    if (el('usageStorageSub')) el('usageStorageSub').textContent = storageSubLabel;

    if (el('usageApiVal')) el('usageApiVal').textContent = apiCalls >= 1000 ? (apiCalls / 1000).toFixed(1) + 'k' : apiCalls;
    if (el('usageApiBar')) el('usageApiBar').style.width = apiPct + '%';
    if (el('usageApiSub')) el('usageApiSub').textContent = apiCalls + ' of 2,000 used';

    if (el('usageExportsVal')) el('usageExportsVal').textContent = exports_n;
    if (el('usageExportsBar')) el('usageExportsBar').style.width = exportPct + '%';
    if (el('usageExportsSub')) el('usageExportsSub').textContent = exports_n + ' of 50 exports used';

    // ── Neural Bandwidth (sidebar) ──────────────────────────────
    var sessionStorageTb = storageMb / (1024 * 1024);  // MB → TB
    var remainingTb  = Math.max(0, NEURAL_BANDWIDTH_BASE_REMAINING_TB - sessionStorageTb);
    var remainingPct = ((remainingTb / NEURAL_BANDWIDTH_TOTAL_TB) * 100).toFixed(1);
    var remainingDisplay = remainingTb >= 1
      ? remainingTb.toFixed(1) + 'TB'
      : (remainingTb * 1024).toFixed(0) + 'GB';

    if (el('neuralBandwidthBar'))   el('neuralBandwidthBar').style.width = remainingPct + '%';
    if (el('neuralBandwidthLabel')) el('neuralBandwidthLabel').textContent =
      remainingDisplay + ' / ' + NEURAL_BANDWIDTH_TOTAL_TB + 'TB REMAINING';
  }

  // ── Step 1: paint immediately from local storage (fast, no flicker) ──
  function paintFromLocal(onDone) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['recallUsage'], function (result) {
        applyUsage(result.recallUsage || defaultUsage);
        if (onDone) onDone(result.recallUsage || defaultUsage);
      });
    } else {
      try {
        var stored = JSON.parse(localStorage.getItem('recallUsage') || '{}');
        applyUsage(stored);
        if (onDone) onDone(stored);
      } catch (e) {
        applyUsage(defaultUsage);
        if (onDone) onDone(defaultUsage);
      }
    }
  }

  // ── Step 2: fetch live count from backend and update ─────────
  function fetchLiveAndUpdate(localUsage) {
    var token = null;

    function getToken(cb) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['recall_token'], function (r) { cb(r.recall_token || null); });
      } else {
        cb(null);
      }
    }

    getToken(function (t) {
      token = t;
      if (!token) return; // not logged in — keep local values

      fetch('http://localhost:5000/api/searches/stats', {
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.stats) return;

        var liveSearches = data.stats.totalSearches || 0;
        // Only override if backend count is higher than what local storage had
        if (liveSearches < (localUsage.searches || 0)) return;

        var merged = {
          searches:  liveSearches,
          apiCalls:  liveSearches * 2,
          storageMb: liveSearches * 0.008,
          // Preserve locally-tracked exports — backend has no export count endpoint
          exports:   localUsage.exports || 0,
        };

        applyUsage(merged);

        // Write the refreshed counts back to local storage so other pages benefit
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ recallUsage: merged });
        } else {
          try { localStorage.setItem('recallUsage', JSON.stringify(merged)); } catch (e) {}
        }
      })
      .catch(function () {
        // Backend unreachable — local values already painted, nothing to do
      });
    });
  }

  paintFromLocal(fetchLiveAndUpdate);
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  init();
  loadUsageStats();
});
