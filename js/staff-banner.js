/**
 * Staff broadcast banner — active manager message for all logged-in users.
 */
(function () {
  const DISMISS_KEY = 'sc_broadcast_dismissed';
  const TOAST_KEY = 'sc_broadcast_toast_shown';
  const POLL_MS = 60000;

  let _pollTimer = null;
  let _current = null;

  function escH(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function ensureAssets() {
    if (!document.getElementById('staff-banner-css')) {
      const link = document.createElement('link');
      link.id = 'staff-banner-css';
      link.rel = 'stylesheet';
      link.href = 'css/staff-banner.css';
      document.head.appendChild(link);
    }
  }

  function ensureShell() {
    if (!document.getElementById('staff-broadcast-banner')) {
      const banner = document.createElement('div');
      banner.id = 'staff-broadcast-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.innerHTML = `
        <div class="scb-inner">
          <span class="scb-icon" aria-hidden="true"></span>
          <div class="scb-text">
            <div class="scb-title"></div>
            <div class="scb-message"></div>
          </div>
          <button type="button" class="scb-dismiss" aria-label="Dismiss broadcast">&times;</button>
        </div>`;
      document.body.appendChild(banner);
      banner.querySelector('.scb-dismiss').addEventListener('click', () => {
        if (_current && _current.id != null) {
          localStorage.setItem(DISMISS_KEY, String(_current.id));
        }
        hideBanner();
      });
    }
    if (!document.getElementById('staff-broadcast-toast')) {
      const toast = document.createElement('div');
      toast.id = 'staff-broadcast-toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = `
        <div class="scb-toast-title"></div>
        <div class="scb-toast-body"></div>`;
      document.body.appendChild(toast);
    }
  }

  function variantIcon(variant) {
    if (variant === 'urgent') {
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }
    if (variant === 'warning') {
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  function hideBanner() {
    const el = document.getElementById('staff-broadcast-banner');
    if (el) el.classList.remove('is-visible');
    document.body.classList.remove('has-staff-broadcast');
  }

  function showBanner(b) {
    const el = document.getElementById('staff-broadcast-banner');
    if (!el || !b) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && String(dismissed) === String(b.id)) {
      hideBanner();
      return;
    }

    const variant = ['info', 'warning', 'urgent'].includes(b.variant) ? b.variant : 'info';
    el.className = 'scb-' + variant + ' is-visible';
    el.querySelector('.scb-icon').innerHTML = variantIcon(variant);
    el.querySelector('.scb-title').textContent = b.title || 'Announcement';
    const msgEl = el.querySelector('.scb-message');
    if (b.message && b.message.trim()) {
      msgEl.textContent = b.message.trim();
      msgEl.style.display = '';
    } else {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }
    document.body.classList.add('has-staff-broadcast');
  }

  function maybeToast(b) {
    if (!b || b.id == null) return;
    const shown = sessionStorage.getItem(TOAST_KEY);
    if (shown && String(shown) === String(b.id)) return;

    const toast = document.getElementById('staff-broadcast-toast');
    if (!toast) return;

    toast.querySelector('.scb-toast-title').textContent = b.title || 'Team announcement';
    const body = b.message && b.message.trim()
      ? b.message.trim()
      : 'A new message from management is shown above.';
    toast.querySelector('.scb-toast-body').textContent = body;
    toast.classList.add('is-visible');
    sessionStorage.setItem(TOAST_KEY, String(b.id));

    setTimeout(() => toast.classList.remove('is-visible'), 5500);
  }

  async function fetchActive() {
    if (typeof Broadcast === 'undefined' || !Broadcast.getActive) return null;
    try {
      const res = await Broadcast.getActive();
      return res && res.broadcast ? res.broadcast : null;
    } catch (e) {
      console.warn('[StaffBanner]', e.message || e);
      return null;
    }
  }

  async function refresh() {
    const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : '';
    if (!user) {
      hideBanner();
      _current = null;
      return;
    }

    const active = await fetchActive();
    _current = active;

    if (!active) {
      hideBanner();
      return;
    }

    showBanner(active);
    maybeToast(active);
  }

  function startPoll() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(refresh, POLL_MS);
  }

  function stopPoll() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  async function loadStaffBanner() {
    const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : '';
    if (!user) return;

    ensureAssets();
    ensureShell();
    await refresh();
    startPoll();
  }

  window.loadStaffBanner = loadStaffBanner;
  window.staffBannerRefresh = refresh;
  window.staffBannerStop = stopPoll;
})();
