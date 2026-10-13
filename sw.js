// Service worker: keeps the trip usable offline.
// - App shell (pages, code, data, fonts): network-first, cached copy when offline.
// - Day assets (today + next 2 days): the page sends the list of photos; they're saved ahead of time in 'days'.
// - Map tiles (MapTiler, OpenStreetMap fallback): saved as you view them; no bulk pre-downloading.
// - /api: always network; the app keeps its own offline copy of shared state.
// - Flight alerts: the trip's server sends a push { title, body, tag, url }; tapping it opens that day.
const VERSION = 'japan2026-v21';
const KEEP = [VERSION, 'tiles', 'days'];
const SHELL = [
  './', './index.html', './money.html', './prototypes/tools.html', './js/store.js', './js/colors.js', './js/export-docx.js', './js/tour.js', './js/offline.js', './js/report.js',
  './data/itinerary.js', './data/places.js', './data/guide.js', './data/diet.js', './data/hotels-ja.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css', './vendor/maplibre/leaflet-maplibre-gl.js', './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png', './vendor/leaflet/images/marker-shadow.png',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './vendor/fonts/zen-kaku-gothic-new-latin-400-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-500-normal.woff2', './vendor/fonts/zen-kaku-gothic-new-latin-700-normal.woff2',
  './vendor/fonts/instrument-serif-latin-400-normal.woff2', './vendor/fonts/instrument-serif-latin-400-italic.woff2', './vendor/fonts/zen-old-mincho-700-subset.woff2',
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

const bareUrl = (u) => u.origin + u.pathname;
const fromCache = async (req) => {
  const url = new URL(req.url);
  return (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }))
    || (url.pathname.endsWith('/prototypes/tools') ? await caches.match(new URL('./prototypes/tools.html', self.registration.scope).href) : null)
    || (url.pathname.endsWith('/money') ? await caches.match(new URL('./money.html', self.registration.scope).href) : null)
    || (url.pathname.endsWith('/photos') ? await caches.match(new URL('./photos.html', self.registration.scope).href) : null)
    || (req.mode === 'navigate' ? await caches.match(new URL('./index.html', self.registration.scope).href) : null);
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // always network
  if (url.origin !== location.origin) {
    // Map tiles, styles, fonts and icons: saved as you view them (MapTiler's terms allow a personal browser cache).
    // Photos of added stops (Wikimedia): cache-first like our own, saved as they're seen
    if (url.host === 'upload.wikimedia.org' || url.host === 'thumb.wikimedia.org') {
      e.respondWith((async () => {
        const hit = await caches.match(e.request, { ignoreSearch: true }); if (hit) return hit;
        try { const r = await fetch(e.request); if (r.ok || r.type === 'opaque') (await caches.open('days')).put(e.request, r.clone()); return r; } catch { return Response.error(); }
      })());
      return;
    }
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
      // One saved copy per file: the deploy stamp (?v=…) is dropped from the key, so each visit refreshes the same
      // entry (the one the install step wrote) instead of adding a copy per deploy, and offline everything comes from
      // the same deploy. The pages' own ?v= (the Settings tabs) and ?d= (the day) serve the same file, so they share it too.
      if (r.ok) cache.put(bareUrl(url), r.clone());
      return r;
    } catch {
      return (await fromCache(e.request)) || Response.error();
    }
  })());
});

// Flight alerts (turned on in Settings). One alert per flight stays on the lock screen: a newer one replaces it.
self.addEventListener('push', (e) => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Japan 2026', {
    body: m.body || 'A flight changed.', tag: m.tag || 'flight', renotify: true,
    icon: new URL('./icons/icon-192.png', self.registration.scope).href, badge: new URL('./icons/icon-192.png', self.registration.scope).href,
    data: { url: m.url || self.registration.scope },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const page = open.find((c) => c.url.startsWith(self.registration.scope));
    if (page) { await page.focus(); return page.navigate ? page.navigate(url).catch(() => {}) : null; }
    return self.clients.openWindow(url);
  })());
});
