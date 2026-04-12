// ─────────────────────────────────────────────────────────────────────────────
// ServiCell Staff Portal — Service Worker
// Update CACHE_DATE to today's date on every deploy — no manual versioning needed.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_DATE = '2026-04-12f'; // ← change this to today's date on each deploy
const CACHE_NAME = 'servicell-' + CACHE_DATE;
const BASE = '/Staff-Portal';

// Files to pre-cache on install (shell only — keeps it lean)
const PRECACHE_URLS = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/current-jobs.html',
    BASE + '/new-job.html',
    BASE + '/special-orders.html',
    BASE + '/settings.html',
    BASE + '/inventory.html',
    BASE + '/sales.html',
    BASE + '/statistics.html',
    BASE + '/css/variables.css',
    BASE + '/css/nav.css',
    BASE + '/css/main.css',
    BASE + '/css/footer.css',
    BASE + '/css/splash.css',
    BASE + '/css/perf.css',
    BASE + '/js/components.js',
    BASE + '/js/auth-guard.js',
    BASE + '/js/theme-init.js',
    BASE + '/js/sales.js',
    BASE + '/js/statistics.js',
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

    // Ignore non-http requests (chrome-extension, data, etc.)
    if (!url.protocol.startsWith('http')) return;

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

// ── Push: show notification from Cloudflare Worker delivery ──────────────────
self.addEventListener('push', event => {
    let data = { title: 'ServiCell Portal', body: 'You have a new notification.', type: 'general' };
    try { if (event.data) data = event.data.json(); } catch (_) {}
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body:     data.body,
            icon:     BASE + '/img/logo.png',
            badge:    BASE + '/img/logo.png',
            tag:      data.type || 'servicell',
            renotify: true,
            data:     { url: BASE + '/index.html' }
        })
    );
});

// ── Notification click: focus or open the app ────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || (BASE + '/index.html');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(target);
        })
    );
});
