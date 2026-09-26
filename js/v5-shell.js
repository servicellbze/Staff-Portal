/**
 * Staff Portal V5 — shell UI (sidebar, top bar, tab bar, More sheet)
 */
(function (global) {
    'use strict';

    var TAB_HREFS = ['index.html', 'current-jobs.html', 'sales.html'];
    var PAGE_TITLES = {
        'index.html': 'Home',
        'current-jobs.html': 'Jobs',
        'new-job.html': 'New Job',
        'sales.html': 'Sales',
        'inventory.html': 'Inventory',
        'special-orders.html': 'Special Orders',
        'statistics.html': 'Statistics',
        'settings.html': 'Settings'
    };

    function icon(name, size) {
        return typeof global.scIcon === 'function' ? global.scIcon(name, size || 22) : '';
    }

    function isTabActive(href, current) {
        if (href === 'index.html') return current === 'index.html' || current === '';
        return current === href;
    }

    function moreLinks(visible, role) {
        return visible.filter(function (l) {
            return TAB_HREFS.indexOf(l.href) === -1;
        });
    }

    function renderShell(placeholder, opts) {
        var username = opts.username;
        var role = opts.role;
        var current = opts.current || 'index.html';
        var visible = opts.visible || [];
        var loggedIn = !!username;

        global.document.body.classList.add('sc-v5');
        global.document.body.classList.toggle('sc-logged-in', loggedIn);
        global.document.body.classList.toggle('sc-logged-out', !loggedIn);

        if (localStorage.getItem('scSidebarCollapsed') === '1') {
            global.document.body.classList.add('sc-sidebar-collapsed');
        }

        var ROLE_ICONS = { manager: 'crown', cashier: 'cash', technician: 'wrench' };
        var roleIconName = ROLE_ICONS[role] || 'wrench';
        var roleIconSvg = icon(roleIconName, 16);

        var sidebarLinks = visible.map(function (l) {
            var active = isTabActive(l.href, current) ? ' active' : '';
            return '<a href="' + l.href + '" class="sc-sidebar-link' + active + '" data-tour="nav-' + l.href + '">' +
                icon(l.icon, 22) +
                '<span class="sc-sidebar-link-label">' + l.label + '</span></a>';
        }).join('');

        var thirdTab = (role === 'technician')
            ? { href: 'new-job.html', label: 'New', ic: 'plus', tour: 'tab-new' }
            : { href: 'sales.html', label: 'Sales', ic: 'dollar', tour: 'tab-sales' };
        var tabs = [
            { href: 'index.html', label: 'Home', ic: 'home', tour: 'tab-home' },
            { href: 'current-jobs.html', label: 'Jobs', ic: 'wrench', tour: 'tab-jobs' },
            thirdTab
        ];

        var tabHtml = tabs.map(function (t) {
            var active = isTabActive(t.href, current) ? ' active' : '';
            return '<a href="' + t.href + '" class="sc-tab' + active + '" data-tour="' + t.tour + '">' +
                icon(t.ic, 22) + '<span class="sc-tab-label">' + t.label + '</span></a>';
        }).join('');

        tabHtml += '<button type="button" class="sc-tab" id="scTabMore" data-tour="tab-more" aria-expanded="false">' +
            icon('list', 22) + '<span class="sc-tab-label">More</span></button>';

        var moreItems = moreLinks(visible, role).map(function (l) {
            return '<a href="' + l.href + '" class="sc-more-link">' + icon(l.icon, 20) + '<span>' + l.label + '</span></a>';
        }).join('');

        function accountBlock(id) {
            if (!username) return '';
            return '<div class="nav-account" id="navAccount' + id + '">' +
                '<button class="account-chip" onclick="toggleAccountMenu(event)" aria-label="Account menu">' +
                '<span class="account-avatar" title="' + role + '">' + roleIconSvg + '</span>' +
                '<span class="account-name">' + username + '</span>' +
                '<span class="account-caret">' + icon('chevronDown', 10) + '</span>' +
                '</button>' +
                '<div class="account-dropdown" id="accountDropdown' + id + '">' +
                '<div class="dropdown-header">' +
                '<span class="dropdown-username">' + username + '</span>' +
                '<span class="dropdown-role-badge">' + roleIconSvg + ' ' + role + '</span>' +
                '</div>' +
                '<div class="dropdown-divider"></div>' +
                '<a href="settings.html" class="dropdown-item">' + icon('settings', 15) + ' Settings</a>' +
                '<button class="dropdown-item danger" onclick="logOut()">' + icon('logout', 15) + ' Log out</button>' +
                '</div></div>';
        }

        var bellBtn =
            '<button class="bell-btn" onclick="toggleNotifPanel(event)" aria-label="Notifications">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
            '<span class="notif-badge" id="notif-badge" style="display:none;">0</span></button>';

        var notifPanel =
            '<div class="nav-bell sc-notif-anchor" id="navBell">' +
            bellBtn +
            '<div class="notif-panel" id="notifPanel">' +
            '<div class="notif-panel-header">' +
            '<span class="notif-panel-title">Notifications</span>' +
            '<button class="notif-clear-btn" onclick="InAppNotif.clear();renderNotifPanel()">Clear all</button>' +
            '</div><div class="notif-list" id="notifList"></div></div></div>';

        var pageTitle = PAGE_TITLES[current] || 'Staff Portal';

        placeholder.innerHTML =
            '<aside class="sc-sidebar" id="scSidebar" aria-label="Main navigation">' +
            '<div class="sc-sidebar-brand">' +
            '<div class="sc-sidebar-logo">SC</div>' +
            '<span class="sc-sidebar-title">ServiCell</span></div>' +
            '<nav class="sc-sidebar-nav">' + sidebarLinks + '</nav>' +
            '<div class="sc-sidebar-foot sc-sidebar-util">' +
            (loggedIn ? '<div class="sc-sidebar-bell">' + bellBtn + '</div>' : '') +
            (loggedIn ? '<div class="sc-sidebar-account">' + accountBlock('Sidebar') + '</div>' : '') +
            '<button type="button" class="sc-sidebar-toggle" id="scSidebarToggle" aria-label="Collapse sidebar">' +
            icon('chevronLeft', 18) + '<span class="sc-sidebar-link-label">Collapse</span></button></div></aside>' +

            '<header class="sc-topbar" id="scTopbar">' +
            '<div class="sc-topbar-title">' + pageTitle + '</div>' +
            '<div class="sc-topbar-actions">' + (loggedIn ? '<div class="sc-topbar-bell">' + bellBtn + '</div>' + accountBlock('Top') : '') + '</div></header>' +

            '<nav class="sc-tabbar" id="scTabbar" aria-label="Primary">' + tabHtml + '</nav>' +

            '<div class="sc-more-backdrop" id="scMoreBackdrop" aria-hidden="true"></div>' +
            '<div class="sc-more-sheet" id="scMoreSheet" role="dialog" aria-label="More menu">' +
            '<div class="sc-more-handle"></div>' +
            '<div class="sc-more-head">More</div>' +
            '<div class="sc-more-sub">Shortcuts for your role (' + role + ')</div>' +
            '<div class="sc-more-grid">' + moreItems + '</div></div>' +
            (loggedIn ? notifPanel : '');

        initShellListeners();
        dispatchChromeChange();
    }

    function openMore(open) {
        var sheet = global.document.getElementById('scMoreSheet');
        var back = global.document.getElementById('scMoreBackdrop');
        var btn = global.document.getElementById('scTabMore');
        if (!sheet || !back) return;
        sheet.classList.toggle('open', open);
        back.classList.toggle('open', open);
        if (btn) btn.classList.toggle('active', open);
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        dispatchChromeChange();
    }

    function dispatchChromeChange() {
        try {
            global.window.dispatchEvent(new Event('sc-bottom-chrome-change'));
        } catch (_) { /* ignore */ }
    }

    function initShellListeners() {
        var toggle = global.document.getElementById('scSidebarToggle');
        if (toggle && !toggle._scV5Bound) {
            toggle._scV5Bound = true;
            toggle.addEventListener('click', function () {
                var collapsed = global.document.body.classList.toggle('sc-sidebar-collapsed');
                localStorage.setItem('scSidebarCollapsed', collapsed ? '1' : '0');
                var chev = toggle.querySelector('svg');
                if (chev && typeof global.scIcon === 'function') {
                    toggle.innerHTML = global.scIcon(collapsed ? 'chevronRight' : 'chevronLeft', 18) +
                        '<span class="sc-sidebar-link-label">' + (collapsed ? 'Expand' : 'Collapse') + '</span>';
                }
                dispatchChromeChange();
            });
        }

        var moreBtn = global.document.getElementById('scTabMore');
        var back = global.document.getElementById('scMoreBackdrop');
        if (moreBtn && !moreBtn._scV5Bound) {
            moreBtn._scV5Bound = true;
            moreBtn.addEventListener('click', function (e) {
                e.preventDefault();
                var sheet = global.document.getElementById('scMoreSheet');
                openMore(!(sheet && sheet.classList.contains('open')));
            });
        }
        if (back && !back._scV5Bound) {
            back._scV5Bound = true;
            back.addEventListener('click', function () { openMore(false); });
        }

        var sheet = global.document.getElementById('scMoreSheet');
        if (sheet) {
            sheet.querySelectorAll('.sc-more-link').forEach(function (a) {
                a.addEventListener('click', function () { openMore(false); });
            });
        }
    }

    global.SCV5 = {
        renderShell: renderShell,
        openMore: openMore,
        dispatchChromeChange: dispatchChromeChange
    };
})(typeof window !== 'undefined' ? window : this);
