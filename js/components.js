/**
 * ServiCell Component Loader
 * Builds nav dynamically based on logged-in user role.
 * No external nav.html fetch needed.
 */

// ── Role helpers (global so other scripts can use them) ───────────────────────
function getLoggedInUser() {
    return localStorage.getItem('scUser') || sessionStorage.getItem('scUser') || '';
}

function deriveRole(username) {
    const u = (username || '').toLowerCase();
    if (u.startsWith('manager')) return 'manager';
    if (u.startsWith('cashier')) return 'cashier';
    if (u.startsWith('technician')) return 'technician';
    return 'technician';
}


// ── Nav link definitions ──────────────────────────────────────────────────────
const NAV_LINKS = [
    { label: 'Dashboard',      icon: '🏠', href: 'index.html',          roles: ['technician', 'cashier', 'manager'] },
    { label: 'Current Jobs',   icon: '🔧', href: 'current-jobs.html',   roles: ['technician', 'cashier', 'manager'] },
    { label: 'New Job',        icon: '➕', href: 'new-job.html',         roles: ['technician', 'cashier', 'manager'] },
    { label: 'Special Orders', icon: '🛒', href: 'special-orders.html', roles: ['technician', 'cashier', 'manager'] },
    { label: 'Inventory',      icon: '📦', href: 'inventory.html',       roles: ['cashier', 'manager'] },
    { label: 'Payouts',        icon: '💳', href: 'payouts.html',         roles: ['cashier', 'manager'] },
    { label: 'Statistics',     icon: '📊', href: 'statistics.html',      roles: ['manager'] },
    { label: 'Settings',       icon: '⚙️', href: 'settings.html',        roles: ['technician', 'cashier', 'manager'] },
];

// ── Auth helpers (global) ─────────────────────────────────────────────────────
function logOut() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('scUser');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('scUser');
    window.location.href = 'index.html';
}

function toggleAccountMenu(e) {
    e.stopPropagation();
    document.getElementById('accountDropdown')?.classList.toggle('open');
}

// ── Component Loader ──────────────────────────────────────────────────────────
const ComponentLoader = {
    config: {
        footerPath: 'components/footer.html',
        minSplashTime: 3000,
    },

    state: {
        loadStartTime: Date.now(),
        splashHidden: false
    },

    async init() {
        this.state.loadStartTime = Date.now();
        this.createSplash();

        await Promise.all([
            this.loadNav(),
            this.loadFooter()
        ]);

        const elapsed = Date.now() - this.state.loadStartTime;
        const remaining = Math.max(0, this.config.minSplashTime - elapsed);
        setTimeout(() => this.hideSplash(), remaining);
    },

    createSplash() {
        // Don't create a second splash if one already exists
        if (document.getElementById('splash-screen')) return;
        const splash = document.createElement('div');
        splash.id = 'splash-screen';
        splash.className = 'splash-screen';
        splash.innerHTML = `
          <div class="splash-loader">
            <div class="rotating-grid">
              <div class="box"></div>
              <div class="box"></div>
              <div class="box"></div>
              <div class="box"></div>
            </div>
          </div>
          <div class="splash-loading-text">ServiCell Belize - Staff Portal</div>`;
        document.body.prepend(splash);
    },

    hideSplash() {
        const splash = document.getElementById('splash-screen');
        if (!splash || this.state.splashHidden) return;
        splash.classList.add('exiting');
        this.state.splashHidden = true;
        setTimeout(() => {
            splash.classList.add('hidden');
            document.body.classList.add('page-ready');
        }, 600);
    },

    async loadNav() {
        const placeholder = document.getElementById('nav-placeholder');
        if (!placeholder) return;

        const username = getLoggedInUser();
        const role = deriveRole(username);
        const current = window.location.pathname.split('/').pop() || 'index.html';
        const visible = NAV_LINKS.filter(l => l.roles.includes(role));

        const linksHTML = visible.map(l => {
            const active = current === l.href ? 'active' : '';
            return `<a href="${l.href}" class="nav-btn ${active}">${l.label}</a>`;
        }).join('');

        // Add this role icon map near the top with your other constants
        const ROLE_ICONS = {
            manager: '👑',
            cashier: '💵',
            technician: '🔧'
        };

        // Then in your loadNav() function, get the icon:
        const roleIcon = ROLE_ICONS[role] || '🔧';

        // Updated accountHTML with icons:
        const accountHTML = username ? `
  <div class="nav-account" id="navAccount">
    <button class="account-chip" onclick="toggleAccountMenu(event)" aria-label="Account menu">
      <span class="account-avatar" title="${role}">${roleIcon}</span>
      <span class="account-name">${username}</span>
      <span class="account-caret">▾</span>
    </button>
    <div class="account-dropdown" id="accountDropdown">
      <div class="dropdown-header">
        <span class="dropdown-username">${username}</span>
        <span class="dropdown-role-badge">${roleIcon} ${role}</span>
      </div>
      <div class="dropdown-divider"></div>
      <a href="settings.html" class="dropdown-item">⚙️ Settings</a>
      <button class="dropdown-item danger" onclick="logOut()">🚪 Log out</button>
    </div>
  </div>` : '';

        placeholder.innerHTML = `
          <nav id="mainNav">
            <div class="nav-wrapper">
              <span class="logo-text">ServiCell</span>
              <div class="nav-links" id="navLinks">${linksHTML}</div>
              ${accountHTML}
              <div class="nav-right-group">
                <div class="nav-bell" id="navBell">
                  <button class="bell-btn" id="notif-bell-btn" onclick="toggleNotifPanel(event)" aria-label="Notifications">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span class="notif-badge" id="notif-badge" style="display:none;">0</span>
                  </button>
                  <div class="notif-panel" id="notifPanel">
                    <div class="notif-panel-header">
                      <span class="notif-panel-title">Notifications</span>
                      <button class="notif-clear-btn" onclick="InAppNotif.clear();renderNotifPanel()">Clear all</button>
                    </div>
                    <div class="notif-list" id="notifList"></div>
                  </div>
                </div>
                <div class="hamburger" id="hamburger">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </nav>
          <div class="mobile-menu-panel" id="mobilePanel">
            <div class="mobile-menu-links" id="mobileMenuLinks">
              ${visible.map(l => {
            const active = current === l.href ? 'active' : '';
            return `<a href="${l.href}" class="nav-btn mobile-nav-btn ${active}">
                <span class="mobile-nav-icon">${l.icon}</span>
                <span class="mobile-nav-label">${l.label}</span>
              </a>`;
        }).join('')}
            </div>
            ${username ? `
            <div class="mobile-menu-footer">
              <div class="mobile-user-info">
                <div class="mobile-avatar">${roleIcon}</div>
                <div class="mobile-user-text">
                  <span class="mobile-username">${username}</span>
                  <span class="mobile-role-badge">${role}</span>
                </div>
              </div>
              <button class="mobile-logout" onclick="logOut()">🚪 Log out</button>
            </div>` : ''}
          </div>`;

        this.attachNavListeners();
    },

    async loadFooter() {
        try {
            const res = await fetch(this.config.footerPath);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const placeholder = document.getElementById('footer-placeholder');
            if (placeholder) placeholder.innerHTML = html;
        } catch (e) {
            console.error('Failed to load footer:', e);
        }
    },

    attachNavListeners() {
        const hamburger = document.getElementById('hamburger');
        const mobilePanel = document.getElementById('mobilePanel');

        if (hamburger && mobilePanel) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                mobilePanel.classList.toggle('open');
            });

            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !mobilePanel.contains(e.target)) {
                    hamburger.classList.remove('active');
                    mobilePanel.classList.remove('open');
                }
            });

            mobilePanel.querySelectorAll('.nav-btn').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    mobilePanel.classList.remove('open');
                });
            });
        }

        // Close account dropdown on outside click
        document.addEventListener('click', (e) => {
            const acct = document.getElementById('navAccount');
            if (acct && !acct.contains(e.target)) {
                document.getElementById('accountDropdown')?.classList.remove('open');
            }
            // Close notif panel on outside click
            const bell = document.getElementById('navBell');
            if (bell && !bell.contains(e.target)) {
                document.getElementById('notifPanel')?.classList.remove('open');
            }
        });

        // Scroll shrink effect
        const nav = document.getElementById('mainNav');
        window.addEventListener('scroll', () => {
            nav?.classList.toggle('scrolled', window.pageYOffset > 50);
        }, { passive: true });

        // Dynamic grid columns based on item count
        const menuLinks = document.getElementById('mobileMenuLinks');
        if (menuLinks) {
            const count = menuLinks.children.length;
            menuLinks.style.gridTemplateColumns = count >= 8 ? 'repeat(4,1fr)' : 'repeat(2,1fr)';
        }
    },

    fallbackNav() {
        const placeholder = document.getElementById('nav-placeholder');
        if (!placeholder) return;
        placeholder.innerHTML = `
          <nav style="position:fixed;top:25px;left:50%;transform:translateX(-50%);background:white;padding:10px 20px;border-radius:100px;z-index:1000;">
            <div style="font-weight:800;color:#2563eb;">ServiCell Belize</div>
          </nav>`;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ComponentLoader.init());
} else {
    ComponentLoader.init();
}

window.ComponentLoader = ComponentLoader;

// ── Notification panel helpers ────────────────────────────────────────────────
function toggleNotifPanel(e) {
    e.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const opening = !panel.classList.contains('open');
    // Close account dropdown if open
    document.getElementById('accountDropdown')?.classList.remove('open');
    panel.classList.toggle('open', opening);
    if (opening) {
        renderNotifPanel();
        InAppNotif.markAllRead();
    }
}

function renderNotifPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    const notifs = InAppNotif.get();
    if (!notifs.length) {
        list.innerHTML = `<div class="notif-empty">
            <span style="font-size:1.8rem;">🔔</span>
            <p>No notifications yet</p>
        </div>`;
        return;
    }
    list.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}">
            <div class="notif-icon">${InAppNotif.typeIcon(n.type)}</div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-time">${InAppNotif.timeAgo(n.time)}</div>
            </div>
        </div>`).join('');
}
window.toggleNotifPanel = toggleNotifPanel;
window.renderNotifPanel = renderNotifPanel;

// Init badge, purge old notifications, and sync from GAS on every page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        InAppNotif.purgeOld();
        InAppNotif._updateBadge();
        InAppNotif.syncFromServer();
    }, 800));
} else {
    setTimeout(() => {
        InAppNotif.purgeOld();
        InAppNotif._updateBadge();
        InAppNotif.syncFromServer();
    }, 800);
}

// ── In-App Notification Store ─────────────────────────────────────────────────
// Stores up to 50 notifications in localStorage. No server needed.
const InAppNotif = {
    MAX: 50,
    KEY: 'sc_inapp_notifs',

    get() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
        catch (_) { return []; }
    },

    add(type, title, body) {
        const list = this.get();
        list.unshift({
            id:    Date.now() + Math.random().toString(36).slice(2),
            type, title, body,
            time:  Date.now(),
            read:  false
        });
        localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
        this._updateBadge();
        this._animateBell();
        if (typeof playNotifSound === 'function') playNotifSound();
    },

    markAllRead() {
        const list = this.get().map(n => ({ ...n, read: true }));
        localStorage.setItem(this.KEY, JSON.stringify(list));
        this._updateBadge();
    },

    clear() {
        localStorage.removeItem(this.KEY);
        this._updateBadge();
    },

    // Remove notifications older than 7 days
    purgeOld() {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const list   = this.get().filter(n => n.time > cutoff);
        localStorage.setItem(this.KEY, JSON.stringify(list));
        this._updateBadge();
    },

    // Sync pending notifications from GAS — makes bell cross-device
    async syncFromServer() {
        const url = typeof window.SCRIPT_URL !== 'undefined' ? window.SCRIPT_URL : null;
        if (!url || !navigator.onLine) return;
        if (localStorage.getItem('scNotif') === '0') return;
        const role = deriveRole(getLoggedInUser());
        try {
            const res   = await fetch(`${url}?action=getpending&role=${encodeURIComponent(role)}`);
            const data  = await res.json();
            const notifs = data.notifications || [];
            if (!notifs.length) return;

            // Merge into local store — skip duplicates by server ID
            const existing = this.get();
            const existingIds = new Set(existing.map(n => n.serverId).filter(Boolean));
            const toAdd = notifs.filter(n => !existingIds.has(n.id));

            toAdd.forEach(n => {
                existing.unshift({
                    id:       Date.now() + Math.random().toString(36).slice(2),
                    serverId: n.id,   // track server ID to avoid re-adding
                    type:     n.type,
                    title:    n.title,
                    body:     n.body,
                    time:     Date.now(),
                    read:     false
                });
            });

            if (toAdd.length) {
                localStorage.setItem(this.KEY, JSON.stringify(existing.slice(0, this.MAX)));
                this._updateBadge();
                this._animateBell();
            }

            // Mark all as delivered so they don't re-appear next sync
            await fetch(url + '?action=markdelivered', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ ids: notifs.map(n => n.id) })
            });
        } catch (_) {
            // Silent fail — offline or GAS unavailable
        }
    },

    unreadCount() {
        return this.get().filter(n => !n.read).length;
    },

    _updateBadge() {
        const badge = document.getElementById('notif-badge');
        const count = this.unreadCount();
        if (!badge) return;
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    },

    _animateBell() {
        const bell = document.getElementById('notif-bell-btn');
        if (!bell) return;
        bell.classList.remove('bell-ring');
        void bell.offsetWidth; // reflow to restart animation
        bell.classList.add('bell-ring');
    },

    timeAgo(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60)  return 'just now';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        return Math.floor(s / 86400) + 'd ago';
    },

    typeIcon(type) {
        const icons = {
            received:     '📦',
            ready:        '✅',
            abandoned:    '⚠️',
            specialorder: '🛒',
            update:       '🚀',
            jobstatus:    '🔧',
            general:      '🔔'
        };
        return icons[type] || '🔔';
    }
};
window.InAppNotif = InAppNotif;

// ── Offline banner ────────────────────────────────────────────────────────────
(function () {
    function createBanner() {
        if (document.getElementById('sc-offline-banner')) return;
        const b = document.createElement('div');
        b.id = 'sc-offline-banner';
        b.innerHTML = '📡 You\'re offline — showing cached data. Changes will not save.';
        b.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
            'background:#b45309', 'color:#fff', 'text-align:center',
            'font-size:0.78rem', 'font-weight:700', 'padding:8px 16px',
            'font-family:var(--font-family,sans-serif)',
            'transform:translateY(-100%)', 'transition:transform 0.3s ease'
        ].join(';');
        document.body.prepend(b);
        // small delay so transition plays
        requestAnimationFrame(() => requestAnimationFrame(() => {
            b.style.transform = 'translateY(0)';
        }));
    }

    function removeBanner() {
        const b = document.getElementById('sc-offline-banner');
        if (!b) return;
        b.style.transform = 'translateY(-100%)';
        setTimeout(() => b.remove(), 350);
    }

    function syncBanner() {
        if (!navigator.onLine) createBanner();
        else removeBanner();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncBanner);
    } else {
        syncBanner();
    }

    window.addEventListener('offline', createBanner);
    window.addEventListener('online', () => {
        removeBanner();
        // Dispatch a custom event so pages can auto-reload data
        window.dispatchEvent(new Event('sc-back-online'));
    });
})();
window.isOffline = () => !navigator.onLine;

// ── sendNotification — role-aware in-app bell ────────────────────────────────
// type: 'received'|'ready'|'abandoned'|'jobstatus'|'specialorder'|'update'
const NOTIF_ROLES = {
    received:     ['technician', 'cashier', 'manager'],
    ready:        ['technician', 'cashier', 'manager'],
    abandoned:    ['technician', 'cashier', 'manager'],
    jobstatus:    ['cashier', 'manager'],
    specialorder: ['technician', 'cashier', 'manager'],
    update:       ['technician', 'cashier', 'manager'],
    manageronly:  ['manager']   // inventory edits, sensitive alerts
};

function sendNotification(type, title, body) {
    if (localStorage.getItem('scNotif') === '0') return;
    const role    = deriveRole(getLoggedInUser());
    const allowed = NOTIF_ROLES[type] || ['technician', 'cashier', 'manager'];
    if (!allowed.includes(role)) return;
    InAppNotif.add(type, title, body);
}
window.sendNotification = sendNotification;

// ── Haptic feedback ───────────────────────────────────────────────────────────
// Android-only — iOS blocks the Vibration API entirely
// Patterns: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'
const IS_ANDROID = /android/i.test(navigator.userAgent);

function haptic(type = 'light') {
    if (!IS_ANDROID) return;
    if (!navigator.vibrate) return;
    if (localStorage.getItem('scHaptics') === '0') return;
    const patterns = {
        light:   [10],
        medium:  [20],
        heavy:   [40],
        success: [10, 50, 10],
        error:   [50, 30, 50],
        warning: [30, 20, 30]
    };
    navigator.vibrate(patterns[type] || patterns.light);
}
window.haptic = haptic;
window.IS_ANDROID = IS_ANDROID;

// Global light tap feedback on all buttons, links, and interactive elements
if (IS_ANDROID) {
    document.addEventListener('pointerdown', e => {
        const el = e.target.closest('button, a, select, .order-card, .job-row, .nav-btn, .card-btn, .theme-card, .toggle, .status-pill label, .edit-pill label, .job-type-pill label');
        if (el) haptic('light');
    }, { passive: true });
}

// ── Notification Sound Engine ─────────────────────────────────────────────────
// Pure Web Audio API — no sound files needed.
// Sound options: 'chime' | 'ping' | 'pop' | 'double' | 'marimba'
(function () {
    let _ctx = null;

    function getCtx() {
        if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (_ctx.state === 'suspended') _ctx.resume();
        return _ctx;
    }

    // Unlock audio on iOS — call this on any user gesture (e.g. login tap)
    function unlockAudio() {
        try {
            const ctx = getCtx();
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
        } catch (_) {}
    }

    function playTone(freq, type, startTime, duration, gainVal, ctx, gainNode) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(gainNode);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    const SOUNDS = {
        chime: (ctx) => {
            const g = ctx.createGain();
            g.connect(ctx.destination);
            g.gain.setValueAtTime(0.25, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            playTone(880,  'sine', ctx.currentTime,       0.6, 0.25, ctx, g);
            playTone(1320, 'sine', ctx.currentTime + 0.12, 0.5, 0.2,  ctx, g);
        },
        ping: (ctx) => {
            const g = ctx.createGain();
            g.connect(ctx.destination);
            g.gain.setValueAtTime(0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            playTone(1480, 'sine', ctx.currentTime, 0.25, 0.3, ctx, g);
        },
        pop: (ctx) => {
            const g = ctx.createGain();
            g.connect(ctx.destination);
            g.gain.setValueAtTime(0.25, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
            playTone(440, 'sine', ctx.currentTime, 0.08, 0.25, ctx, g);
            playTone(880, 'sine', ctx.currentTime + 0.04, 0.14, 0.15, ctx, g);
        },
        double: (ctx) => {
            const g = ctx.createGain();
            g.connect(ctx.destination);
            [0, 0.15].forEach(offset => {
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.setValueAtTime(1100, ctx.currentTime + offset);
                const gn = ctx.createGain();
                gn.gain.setValueAtTime(0.25, ctx.currentTime + offset);
                gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
                o.connect(gn);
                gn.connect(ctx.destination);
                o.start(ctx.currentTime + offset);
                o.stop(ctx.currentTime + offset + 0.12);
            });
        },
        marimba: (ctx) => {
            [0, 0.13, 0.26].forEach((offset, i) => {
                const freqs = [880, 740, 587];
                const o = ctx.createOscillator();
                o.type = 'triangle';
                o.frequency.setValueAtTime(freqs[i], ctx.currentTime + offset);
                const gn = ctx.createGain();
                gn.gain.setValueAtTime(0.28, ctx.currentTime + offset);
                gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
                o.connect(gn);
                gn.connect(ctx.destination);
                o.start(ctx.currentTime + offset);
                o.stop(ctx.currentTime + offset + 0.3);
            });
        }
    };

    function playNotifSound() {
        if (localStorage.getItem('scNotifSound') === '0') return;
        const sound = localStorage.getItem('scNotifSoundType') || 'chime';
        try {
            const ctx = getCtx();
            const fn  = SOUNDS[sound] || SOUNDS.chime;
            fn(ctx);
        } catch (e) {
            console.warn('Sound failed:', e);
        }
    }

    window.unlockAudio    = unlockAudio;
    window.playNotifSound = playNotifSound;
    window.NOTIF_SOUNDS   = Object.keys(SOUNDS);
})();
