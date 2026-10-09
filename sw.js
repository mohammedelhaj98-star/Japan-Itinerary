// Service worker: cache the app shell for offline use. Map tiles and /api are network-first.
const VERSION = 'japan2026-v6';
const SHELL = [
  './', './index.html', './css/app.css', './js/app.js', './js/map.js', './js/store.js',
  './data/itinerary.js', './data/places.js', './data/guide.js', './classic.html', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png', './vendor/leaflet/images/marker-shadow.png',
  './manifest.webmanifest', './icons/icon.svg', './vendor/fonts/zen-kaku-gothic-new-latin-400-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-500-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // always network
  if (url.origin !== location.origin) {
    // Tiles + routing: network, fall back to cache; cache tiles opportunistically.
    if (/tile\.openstreetmap\.org/.test(url.host)) {
      e.respondWith(caches.open('tiles').then(async (c) => {
        try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return (await c.match(e.request)) || Response.error(); }
      }));
    }
    return;
  }
  // App shell: network-first so updates land fast, cache fallback for offline.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const r = await fetch(e.request);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await cache.match(e.request)) || (await cache.match('./index.html'));
    }
  })());
});
