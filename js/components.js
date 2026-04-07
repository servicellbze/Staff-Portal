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
    { label: 'Dashboard', href: 'index.html', roles: ['technician', 'cashier', 'manager'] },
    { label: 'Current Jobs', href: 'current-jobs.html', roles: ['technician', 'cashier', 'manager'] },
    { label: 'New Job', href: 'new-job.html', roles: ['technician', 'cashier', 'manager'] },
    { label: 'Special Orders', href: 'special-orders.html', roles: ['technician', 'cashier', 'manager'] },
    { label: 'Inventory', href: 'inventory.html', roles: ['cashier', 'manager'] },
    { label: 'Payouts', href: 'payouts.html', roles: ['cashier', 'manager'] },
    { label: 'Statistics', href: 'statistics.html', roles: ['manager'] },
    { label: 'Settings', href: 'settings.html', roles: ['technician', 'cashier', 'manager'] },
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
              <div class="hamburger" id="hamburger">
                <span></span><span></span><span></span>
              </div>
            </div>
          </nav>
          <div class="mobile-menu-panel" id="mobilePanel">
            <div class="mobile-menu-links">
              ${visible.map(l => {
            const active = current === l.href ? 'active' : '';
            return `<a href="${l.href}" class="nav-btn ${active}">${l.label}</a>`;
        }).join('')}
            </div>
            ${username ? `
            <div class="mobile-menu-footer">
              <div class="mobile-user-info">
                <span class="mobile-username">${username}</span>
                <span class="mobile-role-badge">● ${role}</span>
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
        });

        // Scroll shrink effect
        const nav = document.getElementById('mainNav');
        window.addEventListener('scroll', () => {
            nav?.classList.toggle('scrolled', window.pageYOffset > 50);
        }, { passive: true });
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

// ── Global notification helper ────────────────────────────────────────────────
// Usage: sendNotification('type', 'Title', 'Body text')
// Types: 'received' | 'ready' | 'abandoned' | 'specialorder' | 'update' | 'jobstatus'
function sendNotification(type, title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('scNotif') === '0') return;
    if (localStorage.getItem('scNotif_' + type) === '0') return;
    try {
        new Notification(title, { body, icon: 'img/logo.png', badge: 'img/logo.png' });
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}
window.sendNotification = sendNotification;
