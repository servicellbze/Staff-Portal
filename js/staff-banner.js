/**
 * Staff broadcast — sticky glass card for active manager messages.
 */
(function () {
  const DISMISS_KEY = 'sc_broadcast_dismissed';
  const POLL_MS = 60000;

  let _pollTimer = null;
  let _current = null;

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
    if (document.getElementById('staff-broadcast-card')) return;

    const card = document.createElement('div');
    card.id = 'staff-broadcast-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
      <div class="scb-card-inner">
        <span class="scb-accent" aria-hidden="true"></span>
        <div class="scb-content">
          <div class="scb-label">Team notice</div>
          <div class="scb-title"></div>
          <div class="scb-message"></div>
        </div>
        <button type="button" class="scb-dismiss" aria-label="Dismiss notice">&times;</button>
      </div>`;
    document.body.appendChild(card);

    card.querySelector('.scb-dismiss').addEventListener('click', () => {
      if (_current && _current.id != null) {
        localStorage.setItem(DISMISS_KEY, String(_current.id));
      }
      hideCard();
    });
  }

  function hideCard() {
    const el = document.getElementById('staff-broadcast-card');
    if (el) el.classList.remove('is-visible');
  }

  function showCard(b) {
    const el = document.getElementById('staff-broadcast-card');
    if (!el || !b) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && String(dismissed) === String(b.id)) {
      hideCard();
      return;
    }

    const variant = ['info', 'warning', 'urgent'].includes(b.variant) ? b.variant : 'info';
    el.className = 'scb-' + variant;
    el.querySelector('.scb-title').textContent = b.title || 'Announcement';

    const msgEl = el.querySelector('.scb-message');
    if (b.message && b.message.trim()) {
      msgEl.textContent = b.message.trim();
      msgEl.style.display = '';
    } else {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }

    el.classList.add('is-visible');
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
      hideCard();
      _current = null;
      return;
    }

    const active = await fetchActive();
    _current = active;

    if (!active) {
      hideCard();
      return;
    }

    showCard(active);
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
