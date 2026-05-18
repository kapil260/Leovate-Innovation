/* ─────────────────────────────────────────
   RECALL AI — settings.js
   All settings page logic in one place.
───────────────────────────────────────── */

'use strict';

/* ─────────────────────────────────────────
   CONFIG — update to match your backend
───────────────────────────────────────── */
const API = {
  saveSettings:  '/api/settings',          // POST  { key, value }
  rotateKey:     '/api/auth/rotate-key',   // POST  → new key
  updateProfile: '/api/user/profile',      // PATCH { name, email }
  uploadAvatar:  '/api/user/avatar',       // POST  multipart
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const dom = {
  rotateKeyBtn:    document.getElementById('rotateKeyBtn'),
  editAvatarBtn:   document.getElementById('editAvatarBtn'),
  workspaceInput:  document.getElementById('workspaceInput'),
  toggleBtns:      document.querySelectorAll('.toggle-btn'),
  channelBtns:     document.querySelectorAll('.channel-btn'),
  segBtns:         document.querySelectorAll('.seg-btn'),
  toast:           document.getElementById('toast'),
  toastIcon:       document.getElementById('toastIcon'),
  toastMsg:        document.getElementById('toastMsg'),
};

/* ─────────────────────────────────────────
   STATE
   Mirrors what would be stored in backend.
───────────────────────────────────────── */
var settings = {
  toggles: {
    weekly: true,
    alerts: false,
    sync:   true,
  },
  channel:   'haptic',
  viz:       'vector',
  proc:      'precision',
  workspace: 'workspace-alpha-nine',
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
  }, 3000);
}

/* ─────────────────────────────────────────
   SAVE SETTING (generic)
───────────────────────────────────────── */
async function saveSetting(key, value) {
  try {
    /* Uncomment when backend is ready:
    await fetch(API.saveSettings, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key, value }),
    });
    */
    console.log('[Recall AI] Setting saved:', key, '=', value);
  } catch (err) {
    console.error('[Recall AI] Save error:', err);
    showToast('Failed to save setting', 'error');
  }
}

/* ─────────────────────────────────────────
   ROTATE KEY
───────────────────────────────────────── */
async function rotateKey() {
  var btn      = dom.rotateKeyBtn;
  var original = btn.querySelector('.text5').textContent;

  btn.querySelector('.text5').textContent = 'ROTATING…';
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';

  try {
    /* Uncomment when backend is ready:
    var res  = await fetch(API.rotateKey, { method: 'POST' });
    var data = await res.json();
    */

    await new Promise(function (r) { setTimeout(r, 900); });
    showToast('Neural Interface Key rotated', 'success');

    // Update "last rotated" text
    var label = document.querySelector('.last-rotated-2-days-ago');
    if (label) label.textContent = 'Last rotated: just now';

  } catch (err) {
    showToast('Failed to rotate key', 'error');
    console.error('[Recall AI] Rotate key error:', err);
  } finally {
    btn.querySelector('.text5').textContent = original;
    btn.style.opacity       = '1';
    btn.style.pointerEvents = 'auto';
  }
}

/* ─────────────────────────────────────────
   EDIT AVATAR
───────────────────────────────────────── */
function editAvatar() {
  // Create a hidden file input and trigger it
  var fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = 'image/*';

  fileInput.addEventListener('change', async function () {
    var file = fileInput.files[0];
    if (!file) return;

    /* Uncomment when backend is ready:
    var form = new FormData();
    form.append('avatar', file);
    await fetch(API.uploadAvatar, { method: 'POST', body: form });
    */

    // Preview locally
    var reader = new FileReader();
    reader.onload = function (e) {
      document.querySelector('.user-avatar').src = e.target.result;
      showToast('Avatar updated', 'success');
    };
    reader.readAsDataURL(file);
  });

  fileInput.click();
}

/* ─────────────────────────────────────────
   TOGGLE SWITCHES
───────────────────────────────────────── */
function handleToggle(btn) {
  var key      = btn.dataset.toggle;
  var isOn     = btn.dataset.state === 'on';
  var newState = !isOn;

  btn.dataset.state = newState ? 'on' : 'off';
  settings.toggles[key] = newState;

  if (newState) {
    // Switch to ON style (button3)
    btn.className    = 'button3 toggle-btn';
    btn.style.background = '#9fa7ff';
    btn.style.padding    = '0px 4px 0px 24px';
    btn.innerHTML        = '<div class="background"></div>';
  } else {
    // Switch to OFF style (button4)
    btn.className    = 'button4 toggle-btn';
    btn.style.background = '#192540';
    btn.style.padding    = '0px 24px 0px 4px';
    btn.innerHTML        = '<div class="background2"></div>';
  }

  btn.dataset.toggle = key;
  btn.dataset.state  = newState ? 'on' : 'off';

  var label = key.charAt(0).toUpperCase() + key.slice(1);
  showToast(label + ' notifications ' + (newState ? 'enabled' : 'disabled'), 'success');
  saveSetting('toggle_' + key, newState);
}

/* ─────────────────────────────────────────
   NOTIFICATION CHANNEL
───────────────────────────────────────── */
function handleChannel(btn) {
  var channel = btn.dataset.channel;
  settings.channel = channel;

  dom.channelBtns.forEach(function (b) {
    if (b.dataset.channel === channel) {
      b.className = 'button6 channel-btn active-channel';
      b.querySelector('div').className = 'text10';
    } else {
      b.className = 'button5 channel-btn';
      b.querySelector('div').className = 'text9';
    }
  });

  showToast('Channel set to ' + channel.toUpperCase(), 'success');
  saveSetting('notification_channel', channel);
}

/* ─────────────────────────────────────────
   SEGMENTED CONTROLS
───────────────────────────────────────── */
function handleSegment(btn) {
  var group = btn.dataset.group;
  var val   = btn.dataset.val;

  // Update state
  if (group === 'viz')  settings.viz  = val;
  if (group === 'proc') settings.proc = val;

  // Find all buttons in this group and update styles
  document.querySelectorAll('[data-group="' + group + '"]').forEach(function (b) {
    var isActive = b.dataset.val === val;

    if (isActive) {
      b.style.background = '#8d98ff';
      b.querySelector('div:last-child').className = 'text11';
      b.querySelector('div:last-child').style.color = '#000a7b';
    } else {
      b.style.background = '';
      b.querySelector('div:last-child').className = 'text9';
      b.querySelector('div:last-child').style.color = '';
    }
  });

  showToast(val.charAt(0).toUpperCase() + val.slice(1) + ' selected', 'success');
  saveSetting(group + '_preference', val);
}

/* ─────────────────────────────────────────
   WORKSPACE INPUT
───────────────────────────────────────── */
var workspaceTimer = null;

function handleWorkspaceInput(e) {
  clearTimeout(workspaceTimer);
  var val = e.target.value.trim();

  workspaceTimer = setTimeout(function () {
    if (!val) return;
    settings.workspace = val;
    saveSetting('workspace', val);
    showToast('Workspace saved', 'success');
  }, 800);
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────── */
function init() {

  // Rotate key
  if (dom.rotateKeyBtn) {
    dom.rotateKeyBtn.addEventListener('click', rotateKey);
  }

  // Edit avatar
  if (dom.editAvatarBtn) {
    dom.editAvatarBtn.addEventListener('click', editAvatar);
  }

  // Toggle switches
  dom.toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { handleToggle(btn); });
  });

  // Notification channel buttons
  dom.channelBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { handleChannel(btn); });
  });

  // Segmented control buttons
  dom.segBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { handleSegment(btn); });
  });

  // Workspace input (auto-save on stop typing)
  if (dom.workspaceInput) {
    dom.workspaceInput.addEventListener('input', handleWorkspaceInput);

    // Also save on Enter key
    dom.workspaceInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(workspaceTimer);
        settings.workspace = dom.workspaceInput.value.trim();
        saveSetting('workspace', settings.workspace);
        showToast('Workspace saved', 'success');
      }
    });
  }

  // Footer links
  document.querySelectorAll('.link').forEach(function (link) {
    link.addEventListener('click', function () {
      var label = link.querySelector('div').textContent;
      if (label.toLowerCase().includes('privacy')) {
        // window.open('/privacy', '_blank');
        showToast('Opening Privacy Protocol…', 'success');
      } else {
        // window.open('/terms', '_blank');
        showToast('Opening Terms & Conditions…', 'success');
      }
    });
  });
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);