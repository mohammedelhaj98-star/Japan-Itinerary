// Service worker: opens the app at once from the copy saved on the phone, and keeps the trip usable offline.
// - Pages, fonts, libraries: the saved copy straight away, while the newest is fetched in the background for next time
//   (so a deploy shows on each phone's next open). With nothing saved yet, the network.
// - The code and data a page imports (*.js?v=<deploy>): a new address each deploy, so each is saved once by its full
//   address and a page always runs with the code it names. A changed page brings its new code in at once; code that no
//   saved page names any more is dropped.
// - Day assets (today + next 2 days): the page sends the list of photos; they're saved ahead of time in 'days'.
// - Map tiles (MapTiler, OpenStreetMap fallback): saved as you view them, shown from the saved copy while refreshed;
//   no bulk pre-downloading.
// - /api: always network; the app keeps its own offline copy of shared state.
// - Flight alerts: the trip's server sends a push { title, body, tag, url }; tapping it opens that day.
const VERSION = 'japan2026-v22';
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
  e.waitUntil((async () => {
    const c = await caches.open(VERSION); await c.addAll(SHELL);
    // the code the saved pages name: the same files just saved (one deploy), filed under the addresses the pages use
    for (const p of ['./', './money.html', './prototypes/tools.html']) { const u = new URL(p, self.registration.scope).href; const r = await c.match(u); if (r) await warm(c, await r.text(), u, true); }
  })().then(() => self.skipWaiting()));
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
    // (no reply to the page: nothing listens, and a message to a page kept for the Back button would make the browser drop it)
  })());
});

const bareUrl = (u) => u.origin + u.pathname;
const isVersioned = (u) => u.pathname.endsWith('.js') && u.searchParams.has('v');
const isPage = (r) => /text\/html/.test(r.headers.get('content-type') || '');
// Save the code a page names (*.js?v=…) that isn't saved yet. At install the plain copies just saved are the same deploy,
// so they're filed under the versioned address without downloading them again.
async function warm(cache, html, base, fromPlain) {
  for (const u of new Set([...html.matchAll(/["']([^"'\s]+\.js\?v=\d+)["']/g)].map((m) => new URL(m[1], base).href))) {
    if (await cache.match(u)) continue;
    const plain = fromPlain && (await cache.match(bareUrl(new URL(u))));
    if (plain) { await cache.put(u, plain); continue; }
    try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await cache.put(u, r); } catch { return; } // offline: next time
  }
}
// Drop saved code that no saved page names any more (an old deploy's).
async function prune(cache) {
  const keys = await cache.keys(), live = new Set();
  for (const k of keys) { if (isVersioned(new URL(k.url))) continue; const r = await cache.match(k); if (!r || !isPage(r)) continue; for (const m of (await r.text()).matchAll(/\.js\?v=(\d+)/g)) live.add(m[1]); }
  await Promise.all(keys.filter((k) => { const u = new URL(k.url); return isVersioned(u) && !live.has(u.searchParams.get('v')); }).map((k) => cache.delete(k)));
}
// A newer copy from the network replaces the saved one, unless it's the same file (same ETag: nothing is rewritten).
// A changed page brings in the code it names now, so the next open needs no network either.
async function save(cache, key, r, hit) {
  const tag = r.headers.get('etag'); if (hit && tag && hit.headers.get('etag') === tag) return;
  const html = isPage(r) ? await r.clone().text() : null;
  await cache.put(key, r);
  if (html) { await warm(cache, html, key); await prune(cache); }
}
// The pages saved at install came through Cloudflare's redirect (money.html → money), and a browser refuses to open a
// page from a redirected copy, so it's handed over as a plain one.
const plain = (r) => (r && r.redirected ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r);
// the saved copy of this very file or page (the extensionless page addresses find their .html)
const saved = async (req) => {
  const url = new URL(req.url);
  return plain((await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }))
    || (url.pathname.endsWith('/prototypes/tools') ? await caches.match(new URL('./prototypes/tools.html', self.registration.scope).href) : null)
    || (url.pathname.endsWith('/money') ? await caches.match(new URL('./money.html', self.registration.scope).href) : null)
    || (url.pathname.endsWith('/photos') ? await caches.match(new URL('./photos.html', self.registration.scope).href) : null));
};
// offline, any page not saved yet opens the trip
const fromCache = async (req) => (await saved(req)) || (req.mode === 'navigate' ? plain(await caches.match(new URL('./', self.registration.scope).href)) : null);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || e.request.headers.has('range')) return; // (a part of a file, as a video asks for: the network)
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
        const hit = await c.match(e.request);
        const fresh = fetch(e.request).then((r) => { if (r.ok) e.waitUntil(c.put(e.request, r.clone())); return r; });
        if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
        try { return await fresh; } catch { return Response.error(); }
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
  // The code and data a page imports: saved once per deploy address, never stale (offline, any saved copy of the file).
  if (isVersioned(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request, { cache: 'no-cache' }); if (r.ok) e.waitUntil(cache.put(e.request, r.clone())); return r; }
      catch { return (await fromCache(e.request)) || Response.error(); }
    })());
    return;
  }
  // Everything else (pages, fonts, libraries): the saved copy at once, the newest fetched in the background for next time.
  // One saved copy per file: the pages' own ?v= (the Settings tabs) and ?d= (the day) serve the same file, so they share it.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await saved(e.request);
    // Always revalidate, so a file stuck in the browser's HTTP cache can't outlive a deploy.
    const fresh = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r.ok) e.waitUntil(save(cache, bareUrl(url), r.clone(), hit)); return r; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    try { return await fresh; } catch { return (await fromCache(e.request)) || Response.error(); }
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
