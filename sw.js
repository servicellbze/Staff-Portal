// ─────────────────────────────────────────────────────────────────────────────
// ServiCell Staff Portal — Service Worker
// Bump CACHE_NAME when you deploy a new version to force clients to update.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'servicell-v2';

// Files to pre-cache on install (shell only — keeps it lean)
const PRECACHE_URLS = [
    '/index.html',
    '/current-jobs.html',
    '/new-job.html',
    '/special-orders.html',
    '/settings.html',
    '/inventory.html',
    '/payouts.html',
    '/statistics.html',
    '/css/variables.css',
    '/css/nav.css',
    '/css/main.css',
    '/css/footer.css',
    '/css/splash.css',
    '/js/components.js',
    '/js/auth-guard.js',
    '/js/theme-init.js',
    '/img/logo.png',
    '/manifest.json'
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting()) // activate immediately
    );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim()) // take control of open tabs immediately
    );
});

// ── Fetch: network-first for API calls, cache-first for assets ───────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always go network-first for Google Apps Script API calls
    if (url.hostname === 'script.google.com' || url.hostname === 'fonts.googleapis.com') {
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 503 }))
        );
        return;
    }

    // Cache-first for everything else (app shell, CSS, JS, images)
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    // Cache valid GET responses
                    if (event.request.method === 'GET' && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});

// ── Push: handle incoming push messages ──────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'ServiCell Portal', body: 'You have a new notification.', type: 'general' };
    try {
        if (event.data) data = event.data.json();
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }

    // Map type to icon/badge colour via tag
    const icons = {
        received:     '/img/logo.png',
        ready:        '/img/logo.png',
        abandoned:    '/img/logo.png',
        specialorder: '/img/logo.png',
        update:       '/img/logo.png',
        jobstatus:    '/img/logo.png'
    };

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:     data.body,
            icon:     icons[data.type] || '/img/logo.png',
            badge:    '/img/logo.png',
            tag:      data.type || 'servicell-notif',
            renotify: true,
            data:     { url: data.url || '/index.html', type: data.type }
        })
    );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = event.notification.data?.url || '/index.html';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // If app is already open, focus it
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window
                if (clients.openWindow) return clients.openWindow(target);
            })
    );
});
