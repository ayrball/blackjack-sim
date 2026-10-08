// Bump the version whenever the asset list changes so old caches are cleared.
const CACHE_NAME = 'blackjack-sim-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './counting.js',
  './analytics.js',
  './betting.js',
  './strategy.js',
  './game.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first so new deploys show up immediately; fall back to the cache offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (sameOrigin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
