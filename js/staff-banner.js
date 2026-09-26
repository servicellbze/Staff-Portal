/**
 * Staff broadcast — sticky glass card for active manager messages.
 */
(function () {
  const DISMISS_KEY = 'sc_broadcast_dismissed';
  const POLL_MS = 60000;
  const TITLE_CHAR_HINT = 72;
  const MESSAGE_CHAR_HINT = 140;

  let _pollTimer = null;
  let _current = null;
  let _shownBroadcastId = null;

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
          <div class="scb-title scb-clamp"></div>
          <div class="scb-message scb-clamp"></div>
          <button type="button" class="scb-more-btn" aria-expanded="false">More info</button>
        </div>
        <button type="button" class="scb-dismiss" aria-label="Dismiss notice">&times;</button>
      </div>`;
    document.body.appendChild(card);

    card.querySelector('.scb-dismiss').addEventListener('click', (e) => {
      e.stopPropagation();
      if (_current && _current.id != null) {
        localStorage.setItem(DISMISS_KEY, String(_current.id));
      }
      hideCard();
    });

    card.querySelector('.scb-more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleExpanded(card);
    });
  }

  function toggleExpanded(card) {
    const expanded = card.classList.toggle('is-expanded');
    const btn = card.querySelector('.scb-more-btn');
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.textContent = expanded ? 'Show less' : 'More info';
    if (!expanded) {
      card.scrollTop = 0;
    }
  }

  function setMoreButtonVisible(card, visible) {
    const btn = card.querySelector('.scb-more-btn');
    if (!btn) return;
    btn.classList.toggle('is-visible', visible);
    if (!visible) {
      card.classList.remove('is-expanded');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'More info';
    }
  }

  function contentNeedsMore(title, message) {
    if ((title || '').length > TITLE_CHAR_HINT) return true;
    if ((message || '').length > MESSAGE_CHAR_HINT) return true;
    return false;
  }

  function measureOverflow(card) {
    const titleEl = card.querySelector('.scb-title');
    const msgEl = card.querySelector('.scb-message');
    const titleOverflow = titleEl && titleEl.scrollHeight > titleEl.clientHeight + 1;
    const msgHidden = !msgEl || msgEl.style.display === 'none' || !msgEl.textContent;
    const msgOverflow = !msgHidden && msgEl.scrollHeight > msgEl.clientHeight + 1;
    return titleOverflow || msgOverflow;
  }

  function updateTruncateUi(card, title, message) {
    setMoreButtonVisible(card, false);

    const titleEl = card.querySelector('.scb-title');
    const msgEl = card.querySelector('.scb-message');
    titleEl.classList.add('scb-clamp');
    if (msgEl.style.display !== 'none') {
      msgEl.classList.add('scb-clamp');
    }

    const check = () => {
      const needs = contentNeedsMore(title, message) || measureOverflow(card);
      setMoreButtonVisible(card, needs);
    };

    requestAnimationFrame(() => {
      check();
      requestAnimationFrame(check);
    });
  }

  function hideCard() {
    const el = document.getElementById('staff-broadcast-card');
    if (el) {
      el.classList.remove('is-visible', 'is-expanded');
      setMoreButtonVisible(el, false);
    }
  }

  function showCard(b) {
    const el = document.getElementById('staff-broadcast-card');
    if (!el || !b) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && String(dismissed) === String(b.id)) {
      hideCard();
      return;
    }

    if (_shownBroadcastId !== b.id) {
      el.classList.remove('is-expanded');
      _shownBroadcastId = b.id;
    }

    const variant = ['info', 'warning', 'urgent'].includes(b.variant) ? b.variant : 'info';
    el.className = 'scb-' + variant;

    const title = (b.title || 'Announcement').trim();
    const message = (b.message || '').trim();

    el.querySelector('.scb-title').textContent = title;

    const msgEl = el.querySelector('.scb-message');
    if (message) {
      msgEl.textContent = message;
      msgEl.style.display = '';
    } else {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
      msgEl.classList.remove('scb-clamp');
    }

    updateTruncateUi(el, title, message);
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
      _shownBroadcastId = null;
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

    window.addEventListener('resize', () => {
      const el = document.getElementById('staff-broadcast-card');
      if (!el || !el.classList.contains('is-visible') || !_current) return;
      if (el.classList.contains('is-expanded')) return;
      updateTruncateUi(el, (_current.title || '').trim(), (_current.message || '').trim());
    }, { passive: true });
  }

  window.loadStaffBanner = loadStaffBanner;
  window.staffBannerRefresh = refresh;
  window.staffBannerStop = stopPoll;
})();
