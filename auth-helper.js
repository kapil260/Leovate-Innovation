/* ═══════════════════════════════════════════════════════════════
   RECALL AI — auth-helper.js
   Chrome extensions CANNOT use localStorage across pages.
   All auth data must be stored in chrome.storage.local.
   This file provides a unified API for all pages to use.
═══════════════════════════════════════════════════════════════ */

'use strict';

const AuthHelper = {

  /* Save token + user after login/signup */
  async setSession(token, user) {
    await chrome.storage.local.set({
      recall_token: token,
      recall_user:  JSON.stringify(user)
    });
  },

  /* Get the auth token */
  async getToken() {
    const result = await chrome.storage.local.get(['recall_token']);
    return result.recall_token || null;
  },

  /* Get the logged-in user object */
  async getUser() {
    const result = await chrome.storage.local.get(['recall_user']);
    if (!result.recall_user) return null;
    try {
      return typeof result.recall_user === 'string'
        ? JSON.parse(result.recall_user)
        : result.recall_user;
    } catch {
      return null;
    }
  },

  /* Check if logged in */
  async isLoggedIn() {
    const token = await this.getToken();
    return !!token;
  },

  /* Clear session (logout) */
  async clearSession() {
    await chrome.storage.local.remove(['recall_token', 'recall_user']);
    // Notify background to also clear
    chrome.runtime.sendMessage({ type: 'RECALL_LOGOUT' }).catch(() => {});
  },

  /* Redirect to login if not authenticated */
  async requireAuth(loginPath) {
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      window.location.href = loginPath || '../login-page/login.html';
      return false;
    }
    return true;
  },

  /* Auth headers for fetch calls */
  async headers() {
    const token = await this.getToken();
    return {
      'Content-Type':  'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }
};
