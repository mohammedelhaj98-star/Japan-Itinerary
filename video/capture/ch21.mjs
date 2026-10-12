// Chapter 21: Photos, settings and offline
// Photos live in Google Drive, so this chapter never talks to a real Drive: every /api/photos call and the upload
// itself are answered here (pg.route) with sample pictures already in the repo (img/places), and the two "new" photos
// are those pictures turned into JPEGs with a Day 7 camera date, so the app files them by time like a real upload.
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PLACES_DIR = path.join(REPO, 'img/places');
const jst = (hm) => Date.parse(`2026-10-22T${hm}:00+09:00`);

// already in the gallery: Day 7 in Osaka, a photo per stop (who's in it and hearts make it look lived in)
const GALLERY = [
  ['g1', 'kuromon-ichiba-market.webp', 'd07-kuromon', '11:42', 'mariam', ['mariam', 'm'], ['naf', 'sara']],
  ['g2', 'tsutenkaku-tower.webp', 'd07-shinsekai', '13:18', 'naf', ['naf', 'sara', 'mariam', 'm'], ['m']],
  ['g3', 'komehyo-shinsaibashi.webp', 'd07-shinsaibashi', '15:26', 'sara', ['sara'], []],
  ['g4', 'amerikamura-triangle-park.webp', 'd07-amemura', '16:51', 'm', ['m'], []],
  ['g5', 'dotonbori-glico-sign.webp', 'd07-dotonbori', '17:36', 'mariam', ['naf', 'sara', 'mariam', 'm'], ['naf', 'sara', 'mariam']],
  ['g6', 'don-quijote-dotonbori.webp', 'd07-ferris', '19:44', 'naf', ['naf', 'sara'], []],
  ['g7', 'hozenji-yokocho.webp', 'd07-hozenji', '20:06', 'm', ['mariam'], ['m']],
  ['g8', 'osaka-castle.webp', 'd07-castle-ev', '20:41', 'sara', [], ['sara']],
].map(([id, img, stop, hm, by, inn, hearts]) => ({ id, name: `IMG_${id}.jpg`, mime: 'image/jpeg', day: 'd07', stop, t: jst(hm), by, in: inn, hearts, img }));
// what Mo uploads in the chapter: this morning in Nara
const UPLOADS = [['IMG_2041.jpg', 'todai-ji.webp', '2026:10:22 08:41:12'], ['IMG_2057.jpg', 'nara-park.webp', '2026:10:22 09:37:40']];

// a JPEG with an EXIF DateTimeOriginal (the same minimal block tests/photos.mjs writes)
function withExif(jpg, date) {
  const le = (n, b) => { const x = Buffer.alloc(b); if (b === 2) x.writeUInt16LE(n); else x.writeUInt32LE(n); return x; };
  const ent = (tag, type, count, val) => Buffer.concat([le(tag, 2), le(type, 2), le(count, 4), le(val, 4)]);
  const exifOff = 8 + 2 + 12 + 4, dateOff = exifOff + 18, dateB = Buffer.from(date + '\0', 'latin1');
  const tiff = Buffer.concat([Buffer.from('II'), le(42, 2), le(8, 4), le(1, 2), ent(0x8769, 4, 1, exifOff), le(0, 4), le(1, 2), ent(0x9003, 2, dateB.length, dateOff), le(0, 4), dateB]);
  const len = tiff.length + 8;
  return Buffer.concat([jpg.slice(0, 2), Buffer.from([0xff, 0xe1, len >> 8, len & 255]), Buffer.from('Exif\0\0', 'latin1'), tiff, jpg.slice(2)]);
}
// the browser turns the repo's .webp pictures into JPEGs (a phone camera's format), then the camera date goes in
async function makeUploads(pg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch21-')); const out = [];
  for (const [name, img, date] of UPLOADS) {
    const b64 = await pg.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }, '/japan/img/places/' + img);
    const f = path.join(dir, name); fs.writeFileSync(f, withExif(Buffer.from(b64, 'base64'), date)); out.push({ out: f, img });
  }
  return out;
}

// The screencast only sends a frame when something on screen changes, and the clip's last frame isn't held,
// so a still closing screen would cut the closing hold short. A 2px, near-invisible dot that moves every frame keeps frames coming.

let files = [];
export default {
  name: 'ch21-photos-settings',
  path: '/japan/photos',
  time: '2026-10-22T12:30:00Z', // Day 7, 9:30 pm in Japan: the day's photos are in
  tourStep: 27, // the tour's "Your profile" step on the tools page: it opens Settings and has nothing to finish
  // The recorder blocks service workers, so Settings would say the app isn't saved for offline. Stand in for the
  // service worker the phone would have: it controls the page, and (in prepare) the app files and the next days' photos are cached.
  init: () => { try { Object.defineProperty(navigator.serviceWorker, 'controller', { configurable: true, get: () => ({ state: 'activated' }) }); } catch {} },
  meta: {
    why: "Everyone's photos in one place, and the trip ready for a flight.",
    recap: ['Upload', 'Choose photos', 'Relive', 'Colour', 'Save whole trip', 'Take the tour'],
    next: "That's the whole tutorial",
  },
  async prepare(pg) {
    files = await makeUploads(pg);
    const byId = Object.fromEntries(GALLERY.map((p) => [p.id, p.img]));
    const list = GALLERY.map(({ img, ...p }) => p);
    const pending = {}; let n = 0;
    const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    // the photos API (normally lib/photos.js talking to Google Drive)
    await pg.route(/\/api\/photos(\/|\?|$)/, async (route) => {
      const req = route.request(), u = new URL(req.url()), p = u.pathname.replace(/^\/api\/photos/, '');
      const body = req.method() === 'POST' ? JSON.parse(req.postData() || '{}') : null;
      if (p === '/token' || p === '/unlock') return json(route, { token: 'practice-token' });
      if (p === '/status') return json(route, { configured: true, connected: true });
      if (p === '' || p === '/') return json(route, { photos: list, covers: {} });
      if (p === '/session') { const id = 'up' + ++n; pending[id] = { id, name: body.name, mime: body.mime, day: body.day, stop: body.stop, t: body.t, by: body.by, in: [], hearts: [] }; const up = files.find((f) => path.basename(f.out) === body.name); if (up) byId[id] = up.img; return json(route, { url: `${u.origin}/stub-drive/session/${id}` }); }
      const th = /^\/(thumb|file)\/([\w-]+)/.exec(p);
      if (th) { const img = byId[th[2]]; if (!img) return route.fulfill({ status: 404 }); return route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(path.join(PLACES_DIR, img)) }); }
      return json(route, { ok: true }); // /update, /cover: hearts, tags and the like
    });
    // the upload itself (normally straight to Google): every piece arrives, and the file gets an id
    await pg.route(/\/stub-drive\/session\//, async (route) => {
      const id = route.request().url().split('/').pop(); const meta = pending[id];
      if (meta && !list.some((x) => x.id === id)) list.push(meta);
      return json(route, { id });
    });
    // what the phone already keeps for offline (the service worker's job): the app's pages, and today's and the next 2 days' photos
    await pg.evaluate(async () => {
      const { offline } = await import('/japan/js/offline.js?v=9'); const { DAYS, HOTELS } = await import('/japan/data/itinerary.js?v=9'); const { PLACES } = await import('/japan/data/places.js?v=9');
      const O = offline({ DAYS, HOTELS, PLACES });
      const shell = ['/japan/', '/japan/index.html', '/japan/money.html', '/japan/prototypes/tools.html', '/japan/js/store.js', '/japan/data/itinerary.js', '/japan/data/places.js'];
      await (await caches.open('app')).addAll(shell);
      await (await caches.open('days')).addAll([...new Set(O.nextDays().flatMap((d) => [...O.dayPhotos(d)]))]);
    });
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForSelector('#fab:not([hidden])', { timeout: 15000 });
    await pg.waitForTimeout(1500);
  },
  async script({ tap, point, hold, wait, pg }) {
    await hold(2, "The Photos page: everyone's, by day and stop.");
    await tap('#fab', { step: 1, caption: 'Tap Upload', opens: true });
    pg.once('filechooser', (fc) => fc.setFiles(files.map((f) => f.out)).catch(() => {}));
    await tap('.up-pick', { step: 2, caption: 'Choose photos: each goes to its stop' });
    if (!(await pg.$('.uprow'))) await pg.setInputFiles('#upfiles', files.map((f) => f.out));
    await pg.waitForFunction(() => document.querySelectorAll('.uprow.done').length >= 2, null, { timeout: 30000 });
    await wait(1.2);
    await tap('#sheet [data-sheetx]', { caption: 'Tap Close', opens: true });
    await tap('[data-relive="d07"]', { step: 3, caption: 'Tap Relive to replay the day', opens: true });
    await hold(5, 'It plays the day stop by stop, like a story.');
    const goSettings = hold(2.2, 'Settings is under the + button too.');
    await pg.goto(new URL('/japan/prototypes/tools?v=5', pg.url()).href, { waitUntil: 'load' });
    await goSettings;
    await pg.waitForSelector('[data-saveall]', { timeout: 15000 });
    await tap('[data-pcolor="#1f98b8"]', { step: 4, caption: 'Pick your colour: every phone sees it' });
    await tap('[data-saveall]', { step: 5, caption: 'Tap Save whole trip before a flight' });
    await pg.waitForFunction(() => /whole trip is saved/.test(document.getElementById('off-line')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    await wait(0.8);
    await point('a[href="../?tour=1"]', { step: 6, caption: 'Take the tour to practise any time' });
    await hold(3, 'Export to Word is at the bottom of Settings.');
  },
};
