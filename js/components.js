/**
 * ServiCell Component Loader
 * Handles dynamic loading of navigation, footer, and splash screen
 */

const ComponentLoader = {
    // Configuration
    config: {
        navPath: 'components/nav.html',
        footerPath: 'components/footer.html',
        splashDuration: 1000, // Updated to 3 seconds
        minSplashTime: 3000,   // Force it to stay for 3s
    },

    // State
    state: {
        componentsLoaded: 0,
        totalComponents: 2,
        loadStartTime: Date.now(),
        splashHidden: false
    },

    /**
     * Initialize all components
     */
    async init() {
        this.state.loadStartTime = Date.now();

        // Show splash immediately
        this.createSplash();

        // Load components in parallel
        await Promise.all([
            this.loadNav(),
            this.loadFooter()
        ]);

        // Calculate remaining splash time for premium feel
        const elapsed = Date.now() - this.state.loadStartTime;
        const remaining = Math.max(0, this.config.minSplashTime - elapsed);

        setTimeout(() => {
            this.hideSplash();
        }, remaining);
    },

    /**
     * Create and inject splash screen
     */
    createSplash() {
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
      <div class="splash-loading-text">ServiCell Belize - Staff Portal</div>
    </div>
</div>
`;

        document.body.prepend(splash);
    },

    /**
     * Hide splash with exit animation
     */
    hideSplash() {
        const splash = document.getElementById('splash-screen');
        if (!splash || this.state.splashHidden) return;

        splash.classList.add('exiting');
        this.state.splashHidden = true;

        setTimeout(() => {
            splash.classList.add('hidden');
            // Trigger page entry animation
            document.body.classList.add('page-ready');
        }, 600);
    },

    /**
     * Load navigation component
     */
    async loadNav() {
        try {
            const response = await fetch(this.config.navPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            const placeholder = document.getElementById('nav-placeholder');

            if (placeholder) {
                placeholder.innerHTML = html;
                this.setActiveNavLink();
                this.attachNavListeners();
            }
        } catch (error) {
            console.error('Failed to load navigation:', error);
            this.fallbackNav();
        }
    },

    /**
     * Load footer component
     */
    async loadFooter() {
        try {
            const response = await fetch(this.config.footerPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            const placeholder = document.getElementById('footer-placeholder');

            if (placeholder) {
                placeholder.innerHTML = html;
            }
        } catch (error) {
            console.error('Failed to load footer:', error);
        }
    },

    /**
     * Set active state on current page link
     */
    setActiveNavLink() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';

        document.querySelectorAll('.nav-btn').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            // Exact match or index.html for root
            const isActive = href === currentPage ||
                (currentPage === '' && href === 'index.html') ||
                (currentPage === '/' && href === 'index.html');

            if (isActive) {
                link.classList.add('active');
            }
        });
    },

    /**
     * Attach nav event listeners
     */
    attachNavListeners() {
        // Hamburger toggle
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.getElementById('navLinks');

        if (hamburger && navLinks) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburger.classList.toggle('active');
                navLinks.classList.toggle('active');
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                }
            });

            // Close on link click (mobile)
            navLinks.querySelectorAll('.nav-btn').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                });
            });
        }

        // Navbar scroll effect
        let lastScroll = 0;
        const nav = document.querySelector('nav');

        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;

            if (currentScroll > 50) {
                nav?.classList.add('scrolled');
            } else {
                nav?.classList.remove('scrolled');
            }

            lastScroll = currentScroll;
        }, { passive: true });
    },

    /**
     * Fallback navigation if fetch fails
     */
    fallbackNav() {
        const placeholder = document.getElementById('nav-placeholder');
        if (!placeholder) return;

        placeholder.innerHTML = `
      <nav style="position:fixed;top:25px;left:50%;transform:translateX(-50%);background:white;padding:10px 20px;border-radius:100px;z-index:1000;">
        <div style="font-weight:800;color:#2563eb;">ServiCell Belize</div>
      </nav>
    `;
    }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ComponentLoader.init());
} else {
    ComponentLoader.init();
}

// Expose for manual use
window.ComponentLoader = ComponentLoader;