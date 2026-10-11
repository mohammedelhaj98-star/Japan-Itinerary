// What this phone has saved for offline use, and saving the whole trip before a flight.
// The service worker (sw.js) keeps the app itself (pages, code, data) and saves the next days' place photos when the
// trip page opens. Here: check those, and save every place photo (the 'days' cache the service worker reads from).
// Map tiles are only kept for the areas already looked at (no bulk download, by the map provider's terms).
// The page passes its own data in (offline({ DAYS, HOTELS, PLACES })), so both use the same deploy's copy.

const at = (p) => new URL(p, import.meta.url).href;
const photo = (pi) => (pi && pi.img ? [at(`../img/places/${pi.img}`), at(`../img/places/t/${pi.img}`)] : []);
// the pages and code the app needs offline (the service worker keeps these)
const SHELL = ['../', '../index.html', '../money.html', '../prototypes/tools.html', './store.js', '../data/itinerary.js', '../data/places.js'].map(at);

export const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export function offline({ DAYS, HOTELS, PLACES }) {
  // today and the next 2 days (before the trip: its first 3 days; after it: nothing)
  function nextDays() {
    const t = todayJST(), i = DAYS.findIndex((d) => d.date === t);
    return i >= 0 ? DAYS.slice(i, i + 3) : t < DAYS[0].date ? DAYS.slice(0, 3) : [];
  }
  // every photo a day can show: its stops (all options of a choose-on-the-day), its hotel, stops edited or added on the phones
  function dayPhotos(d, custom = {}) {
    const out = new Set(); const add = (name) => photo(PLACES[name]).forEach((u) => out.add(u));
    const walk = (items) => { for (const it of items || []) { if (it.place) add(it.place.name); if (custom[it.id] && custom[it.id].place) add(custom[it.id].place.name); if (it.type === 'choice') for (const o of it.options || []) walk(o.items); } };
    walk(d.items);
    const h = HOTELS.find((x) => x.id === d.hotel); if (h) add(h.name);
    for (const c of Object.values(custom)) if (c && c.day === d.id && c.place) add(c.place.name);
    return out;
  }
  const allPhotos = () => new Set(Object.values(PLACES).flatMap(photo));

  const saved = async (url) => !!(await caches.match(url, { ignoreSearch: true }));
  const countSaved = async (urls) => (await Promise.all([...urls].map(saved))).filter(Boolean).length;

  // { ready, app, days: { n, saved, total }, whole: { saved, total } }
  async function offlineStatus(custom = {}) {
    if (!('caches' in window) || !('serviceWorker' in navigator)) return { ready: false, app: false };
    const app = !!navigator.serviceWorker.controller && (await countSaved(SHELL)) === SHELL.length;
    const days = nextDays(), du = new Set(days.flatMap((d) => [...dayPhotos(d, custom)])), all = allPhotos();
    const ds = await countSaved(du), ws = await countSaved(all);
    return { ready: app && ds === du.size, app, days: { n: days.length, saved: ds, total: du.size }, whole: { saved: ws, total: all.size } };
  }

  // Save every place photo (4 at a time); onProgress(done, total). Asks the phone to keep the saved files.
  async function saveWholeTrip(onProgress = () => {}) {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    // the app itself: the service worker saves it while the pages are fetched with it in control
    await Promise.all(SHELL.map((u) => fetch(u, { cache: 'no-cache' }).catch(() => null)));
    const c = await caches.open('days'), urls = [...allPhotos()]; let done = 0, failed = 0;
    const one = async (u) => { if (!(await saved(u))) { try { const r = await fetch(u); if (r.ok) await c.put(u, r); else failed++; } catch { failed++; } } onProgress(++done, urls.length); };
    for (let i = 0; i < urls.length; i += 4) await Promise.all(urls.slice(i, i + 4).map(one));
    return { total: urls.length, failed };
  }
  return { nextDays, dayPhotos, allPhotos, status: offlineStatus, saveWholeTrip };
}
