/**
 * ServiCell Auth Guard
 * Add <script src="js/auth-guard.js"></script> to the <head> of every
 * protected page EXCEPT index.html (which handles login itself).
 */
(function () {
    const PAGE_ACCESS = {
        'inventory.html':      ['cashier', 'manager'],
        'payouts.html':        ['cashier', 'manager'],
        'statistics.html':     ['manager'],
    };

    function getUser() {
        return localStorage.getItem('scUser') || sessionStorage.getItem('scUser') || '';
    }

    function isLoggedIn() {
        return localStorage.getItem('isLoggedIn') === 'true' ||
               sessionStorage.getItem('isLoggedIn') === 'true';
    }

    function deriveRole(username) {
        const u = (username || '').toLowerCase();
        if (u.startsWith('manager'))    return 'manager';
        if (u.startsWith('cashier'))    return 'cashier';
        if (u.startsWith('technician')) return 'technician';
        return 'technician';
    }

    const page = window.location.pathname.split('/').pop() || 'index.html';

    // Not logged in → back to login
    if (!isLoggedIn() && page !== 'index.html') {
        window.location.replace('index.html');
        throw new Error('Auth guard: not logged in.');
    }

    // Role-restricted page → check access
    if (PAGE_ACCESS[page]) {
        const role = deriveRole(getUser());
        if (!PAGE_ACCESS[page].includes(role)) {
            window.location.replace('index.html');
            throw new Error(`Auth guard: role "${role}" cannot access ${page}`);
        }
    }
})();