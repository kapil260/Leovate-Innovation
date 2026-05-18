/* ─────────────────────────────────────────
   RECALL AI — subscription.js
   All subscription page logic in one place.
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG — update to match your backend
───────────────────────────────────────── */
const API = {
  upgrade:        '/api/subscription/upgrade',   // POST { plan, billing }
  cancel:         '/api/subscription/cancel',    // POST
  manageBilling:  '/api/subscription/portal',    // GET  → billing portal URL
  invoices:       '/api/subscription/invoices',  // GET  → invoice list
  downloadInvoice:'/api/subscription/invoice/',  // GET /:id → PDF
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  billingToggle:    document.getElementById('billingToggle'),
  labelMonthly:     document.getElementById('labelMonthly'),
  labelAnnual:      document.getElementById('labelAnnual'),
  saveBadge:        document.getElementById('saveBadge'),
  managePlanBtn:    document.getElementById('managePlanBtn'),
  exportInvoicesBtn:document.getElementById('exportInvoicesBtn'),
  btnFree:          document.getElementById('btnFree'),
  btnPro:           document.getElementById('btnPro'),
  btnUltra:         document.getElementById('btnUltra'),
  modalOverlay:     document.getElementById('modalOverlay'),
  modalClose:       document.getElementById('modalClose'),
  modalConfirmBtn:  document.getElementById('modalConfirmBtn'),
  modalBadge:       document.getElementById('modalBadge'),
  modalTitle:       document.getElementById('modalTitle'),
  modalSubtitle:    document.getElementById('modalSubtitle'),
  modalPrice:       document.getElementById('modalPrice'),
  modalFeatures:    document.getElementById('modalFeatures'),
  toast:            document.getElementById('toast'),
  toastIcon:        document.getElementById('toastIcon'),
  toastMsg:         document.getElementById('toastMsg'),
  invoiceDownloads: document.querySelectorAll('.invoice-download'),
  usageBars:        document.querySelectorAll('.usage-bar-fill'),
};

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
var billing      = 'monthly'; // 'monthly' | 'annual'
var pendingPlan  = null;
var currentPlan  = 'pro';

var plans = {
  ultra: {
    label:    'ULTRA',
    name:     'Ether Ultra',
    subtitle: "You're about to unlock unlimited neural infrastructure.",
    monthly:  79,
    annual:   63,
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
    name:     'Ether Lite',
    subtitle: 'You are about to downgrade to the free tier.',
    monthly:  0,
    annual:   0,
    features: [
      '100 neural queries / day',
      '1 GB cognitive storage',
      'Standard latency sync',
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

  // Update all price elements
  document.querySelectorAll('.card-price').forEach(function (el) {
    var monthly = parseInt(el.dataset.monthly, 10);
    var annual  = parseInt(el.dataset.annual, 10);
    el.textContent = isAnnual ? annual : monthly;
  });

  // Toggle label colours
  dom.labelMonthly.classList.toggle('billing-active', !isAnnual);
  dom.labelAnnual.classList.toggle('billing-active', isAnnual);

  // Toggle thumb & background
  dom.billingToggle.classList.toggle('annual-active', isAnnual);

  // Save badge visibility
  dom.saveBadge.classList.toggle('badge-active', isAnnual);

  // Update modal price if open
  if (pendingPlan && plans[pendingPlan]) {
    var price = isAnnual ? plans[pendingPlan].annual : plans[pendingPlan].monthly;
    dom.modalPrice.textContent = '$' + price;
  }
}

function handleBillingToggle() {
  billing = billing === 'monthly' ? 'annual' : 'monthly';
  updatePrices();
}

/* ─────────────────────────────────────────
   MODAL
───────────────────────────────────────── */
function openModal(plan) {
  var data = plans[plan];
  if (!data) return;

  pendingPlan = plan;

  dom.modalBadge.textContent    = data.label;
  dom.modalTitle.textContent    = 'Upgrade to ' + data.name;
  dom.modalSubtitle.textContent = data.subtitle;

  var price = billing === 'annual' ? data.annual : data.monthly;
  dom.modalPrice.textContent = '$' + price;

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
   CONFIRM UPGRADE / DOWNGRADE
───────────────────────────────────────── */
async function confirmUpgrade() {
  if (!pendingPlan) return;

  var btn      = dom.modalConfirmBtn;
  var original = btn.textContent;

  btn.textContent         = 'PROCESSING…';
  btn.style.opacity       = '0.6';
  btn.style.pointerEvents = 'none';

  try {
    /* Uncomment when backend is ready:
    var res  = await fetch(API.upgrade, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan: pendingPlan, billing: billing }),
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upgrade failed');
    */

    // Demo delay
    await new Promise(function (r) { setTimeout(r, 1200); });

    currentPlan = pendingPlan;
    closeModal();
    showToast('Plan upgraded successfully!', 'success');
    updateButtonStates();

  } catch (err) {
    showToast(err.message || 'Upgrade failed. Try again.', 'error');
    console.error('[Recall AI] Upgrade error:', err);
  } finally {
    btn.textContent         = original;
    btn.style.opacity       = '1';
    btn.style.pointerEvents = 'auto';
  }
}

/* ─────────────────────────────────────────
   UPDATE BUTTON STATES AFTER PLAN CHANGE
───────────────────────────────────────── */
function updateButtonStates() {
  var buttons = {
    free:  dom.btnFree,
    pro:   dom.btnPro,
    ultra: dom.btnUltra,
  };

  var labels = {
    free:  'CURRENT FREE',
    pro:   'YOUR CURRENT PLAN',
    ultra: 'UPGRADE TO ULTRA',
  };

  Object.keys(buttons).forEach(function (plan) {
    var btn = buttons[plan];
    if (!btn) return;

    btn.className = 'card-btn';

    if (plan === currentPlan) {
      btn.textContent = plan === 'free' ? 'CURRENT FREE' : 'YOUR CURRENT PLAN';
      btn.classList.add(plan === 'pro' ? 'card-btn-active' : 'card-btn-ghost');
      btn.disabled = true;
    } else if (plan === 'ultra') {
      btn.textContent = 'UPGRADE TO ULTRA';
      btn.classList.add('card-btn-ultra');
      btn.disabled = false;
    } else if (plan === 'free') {
      btn.textContent = 'DOWNGRADE TO FREE';
      btn.classList.add('card-btn-ghost');
      btn.disabled = false;
    } else {
      btn.textContent = 'SWITCH TO PRO';
      btn.classList.add('card-btn-active');
      btn.disabled = false;
    }
  });
}

/* ─────────────────────────────────────────
   MANAGE BILLING
───────────────────────────────────────── */
async function manageBilling() {
  showToast('Opening billing portal…', 'success');

  try {
    /* Uncomment when backend is ready:
    var res  = await fetch(API.manageBilling);
    var data = await res.json();
    window.open(data.url, '_blank');
    */
  } catch (err) {
    showToast('Could not open billing portal', 'error');
  }
}

/* ─────────────────────────────────────────
   EXPORT INVOICES
───────────────────────────────────────── */
function exportInvoices() {
  showToast('Preparing invoice export…', 'success');
  /* Uncomment when backend is ready:
  window.location.href = API.invoices + '?format=csv';
  */
}

/* ─────────────────────────────────────────
   DOWNLOAD SINGLE INVOICE
───────────────────────────────────────── */
function downloadInvoice(invoiceId) {
  showToast('Downloading invoice…', 'success');
  /* Uncomment when backend is ready:
  window.open(API.downloadInvoice + invoiceId, '_blank');
  */
}

/* ─────────────────────────────────────────
   USAGE BARS — animate on load
───────────────────────────────────────── */
function animateUsageBars() {
  dom.usageBars.forEach(function (bar) {
    var target = bar.style.width;
    bar.style.width = '0%';
    setTimeout(function () {
      bar.style.width = target;
    }, 300);
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

  // Billing toggle
  if (dom.billingToggle) {
    dom.billingToggle.addEventListener('click', handleBillingToggle);
  }

  // Plan buttons
  if (dom.btnUltra) {
    dom.btnUltra.addEventListener('click', function () { openModal('ultra'); });
  }

  if (dom.btnFree) {
    dom.btnFree.addEventListener('click', function () {
      if (currentPlan !== 'free') openModal('free');
    });
  }

  if (dom.btnPro) {
    dom.btnPro.addEventListener('click', function () {
      if (currentPlan !== 'pro') openModal('pro');
    });
  }

  // Modal close
  if (dom.modalClose) {
    dom.modalClose.addEventListener('click', closeModal);
  }

  if (dom.modalOverlay) {
    dom.modalOverlay.addEventListener('click', function (e) {
      if (e.target === dom.modalOverlay) closeModal();
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // Confirm upgrade
  if (dom.modalConfirmBtn) {
    dom.modalConfirmBtn.addEventListener('click', confirmUpgrade);
  }

  // Manage billing
  if (dom.managePlanBtn) {
    dom.managePlanBtn.addEventListener('click', manageBilling);
  }

  // Export invoices
  if (dom.exportInvoicesBtn) {
    dom.exportInvoicesBtn.addEventListener('click', exportInvoices);
  }

  // Invoice download buttons
  dom.invoiceDownloads.forEach(function (btn) {
    btn.addEventListener('click', function () {
      downloadInvoice(btn.dataset.id);
    });
  });

  // Initial states
  updatePrices();
  updateButtonStates();
  animateCardsIn();

  // Delay usage bar animation slightly
  setTimeout(animateUsageBars, 400);
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);