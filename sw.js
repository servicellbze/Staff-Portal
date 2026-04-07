// ─────────────────────────────────────────────────────────────────────────────
// ServiCell Staff Portal — Service Worker
// Update CACHE_DATE to today's date on every deploy — no manual versioning needed.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_DATE = '2026-04-06'; // ← change this to today's date on each deploy
const CACHE_NAME = 'servicell-' + CACHE_DATE;
const BASE = '/Staff-Portal';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyLNGR6L75MieV_R-s9yyjTfzpAAut_HIwhbZBBNyPxj9WDzRLNWics0FZ1ZayI3imx/exec';

// Files to pre-cache on install (shell only — keeps it lean)
const PRECACHE_URLS = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/current-jobs.html',
    BASE + '/new-job.html',
    BASE + '/special-orders.html',
    BASE + '/settings.html',
    BASE + '/inventory.html',
    BASE + '/payouts.html',
    BASE + '/statistics.html',
    BASE + '/css/variables.css',
    BASE + '/css/nav.css',
    BASE + '/css/main.css',
    BASE + '/css/footer.css',
    BASE + '/css/splash.css',
    BASE + '/js/components.js',
    BASE + '/js/auth-guard.js',
    BASE + '/js/theme-init.js',
    BASE + '/img/logo.png',
    BASE + '/manifest.json'
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
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
                    if (event.request.method === 'GET' && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE + '/index.html');
                }
            })
    );
});

// ── Push: fetch pending notifications from GAS for full context ──────────────
self.addEventListener('push', event => {
    event.waitUntil(
        fetch(GAS_URL + '?action=getpending')
            .then(r => r.json())
            .then(data => {
                const notifs = data.notifications || [];

                // Nothing pending — show generic fallback so push isn't silent
                if (!notifs.length) {
                    return self.registration.showNotification('ServiCell', {
                        body:  'You have a new update. Open the app to see details.',
                        icon:  BASE + '/img/logo.png',
                        badge: BASE + '/img/logo.png',
                        tag:   'servicell-notif',
                        data:  { url: BASE + '/index.html' }
                    });
                }

                // Mark all fetched notifications as delivered — fire and forget
                fetch(GAS_URL, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        action: 'markdelivered',
                        ids:    notifs.map(n => n.id)
                    })
                }).catch(() => {});

                // Show each notification with full context
                return Promise.all(notifs.map(n =>
                    self.registration.showNotification(n.title, {
                        body:     n.body,
                        icon:     BASE + '/img/logo.png',
                        badge:    BASE + '/img/logo.png',
                        tag:      n.type || 'servicell-notif',
                        renotify: true,
                        data:     { url: BASE + '/index.html', type: n.type }
                    })
                ));
            })
            .catch(() => {
                // Network unavailable — generic fallback so push isn't silent
                return self.registration.showNotification('ServiCell', {
                    body:  'You have a new update. Open the app to see details.',
                    icon:  BASE + '/img/logo.png',
                    badge: BASE + '/img/logo.png',
                    tag:   'servicell-notif',
                    data:  { url: BASE + '/index.html' }
                });
            })
    );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = event.notification.data?.url || (BASE + '/index.html');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow(target);
            })
    );
});