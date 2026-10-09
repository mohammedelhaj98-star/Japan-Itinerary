// Service worker: keeps the trip usable offline.
// - App shell (pages, code, data, fonts): network-first, cached copy when offline.
// - Day assets (today + next 2 days): the page sends the list of photos; they're saved ahead of time in 'days'.
// - Map tiles (MapTiler, OpenStreetMap fallback): saved as you view them; no bulk pre-downloading.
// - /api: always network; the app keeps its own offline copy of shared state.
const VERSION = 'japan2026-v13';
const KEEP = [VERSION, 'tiles', 'days'];
const SHELL = [
  './', './index.html', './prototypes/tools.html', './js/store.js', './js/colors.js', './js/export-docx.js', './js/tour.js',
  './data/itinerary.js', './data/places.js', './data/guide.js', './data/diet.js', './data/hotels-ja.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css', './vendor/maplibre/leaflet-maplibre-gl.js', './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png', './vendor/leaflet/images/marker-shadow.png',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './vendor/fonts/zen-kaku-gothic-new-latin-400-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-500-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// The page asks for the next days' photos to be saved: { type: 'precache', urls: [...] }.
self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type !== 'precache' || !Array.isArray(m.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open('days'); let saved = 0;
    for (const u of m.urls.slice(0, 400)) {
      const url = new URL(u, self.registration.scope).href;
      if (await c.match(url)) continue;
      try { const r = await fetch(url); if (r.ok) { await c.put(url, r); saved++; } } catch { /* offline: try again next time */ }
    }
    (e.source && e.source.postMessage) && e.source.postMessage({ type: 'precached', saved, total: m.urls.length });
  })());
});

const fromCache = async (req) => {
  const url = new URL(req.url);
  return (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }))
    || (url.pathname.endsWith('/prototypes/tools') ? await caches.match(new URL('./prototypes/tools.html', self.registration.scope).href) : null)
    || (url.pathname.endsWith('/photos') ? await caches.match(new URL('./photos.html', self.registration.scope).href) : null)
    || (req.mode === 'navigate' ? await caches.match(new URL('./index.html', self.registration.scope).href) : null);
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // always network
  if (url.origin !== location.origin) {
    // Map tiles, styles, fonts and icons: saved as you view them (MapTiler's terms allow a personal browser cache).
    if (/tile\.openstreetmap\.org/.test(url.host) || url.host === 'api.maptiler.com') {
      e.respondWith(caches.open('tiles').then(async (c) => {
        try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return (await c.match(e.request)) || Response.error(); }
      }));
    }
    return;
  }
  // Photos: cache-first (they never change), saved as they're seen.
  if (/\/img\/places\//.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(e.request, { ignoreSearch: true }); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) (await caches.open('days')).put(e.request, r.clone()); return r; } catch { return Response.error(); }
    })());
    return;
  }
  // Everything else: network-first so updates land fast, cached copy when offline.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      // Always revalidate, so a script stuck in the browser's HTTP cache can't outlive a deploy.
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch {
      return (await fromCache(e.request)) || Response.error();
    }
  })());
});
