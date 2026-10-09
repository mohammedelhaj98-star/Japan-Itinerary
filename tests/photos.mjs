// Photos test: the real photos page and API (lib/photos.js) against a stand-in for Google (OAuth + Drive + resumable
// uploads), with real Day 7 photos and a video made here (with camera dates and a location), on two phones.
// Checks connecting the Drive, uploads in pieces (with a dropped piece, and carrying on after the page was closed),
// duplicates, the gallery by day and stop, hearts, tags, moving, hiding, the plan photo on the trip page, video
// streaming, downloads, and guests with the photos PIN.
//   npm run test:photos       (CHROMIUM=/path/to/chrome to pick a browser; screenshots in tests/shots/photos/)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = REPO + '/dist';
execSync('BUILD_ONLY=1 bash scripts/deploy.sh', { cwd: REPO });
const { onRequest } = await import(REPO + '/functions/api/[[path]].js?' + Date.now());
const OUT = REPO + '/tests/shots/photos/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (n, c, info = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, info); };

/* ── stand-in Google ── */
const G = 'http://localhost:8798';
const files = new Map(), sessions = new Map(); let nid = 1, failPuts = 0, putDelay = 0, sessionsMade = 0;
const newId = () => 'fileid' + String(nid++).padStart(8, '0');
const body = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const pick = (q, re) => { const m = re.exec(q); return m ? m[1].replace(/\\'/g, "'") : null; };
function query(q) {
  const name = pick(q, /name='((?:[^'\\]|\\.)*)'/), mime = pick(q, /mimeType='([^']+)'/), parent = pick(q, /'([^']+)' in parents/);
  const props = [...q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']*)' \}/g)].map((m) => [m[1], m[2]]);
  return [...files.values()].filter((f) => !f.trashed && (!name || f.name === name) && (!mime || f.mimeType === mime) && (!parent || f.parents.includes(parent)) && props.every(([k, v]) => (f.appProperties || {})[k] === v));
}
const fileJson = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, size: String(f.data ? f.data.length : 0), appProperties: f.appProperties,
  thumbnailLink: f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/') ? `${G}/thumb/${f.id}=s220` : undefined,
  imageMediaMetadata: f.mimeType.startsWith('image/') ? { width: 1200, height: 1600, rotation: 0 } : undefined, videoMediaMetadata: f.mimeType.startsWith('video/') ? { width: 1080, height: 1920, durationMillis: '4000' } : undefined });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const google = http.createServer(async (req, res) => {
  const u = new URL(req.url, G);
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,OPTIONS'); res.setHeader('access-control-allow-headers', 'content-range,content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const send = (s, j, h = {}) => { res.writeHead(s, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(j)); };
  if (u.pathname === '/o/oauth2/v2/auth') { res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=good&state=${encodeURIComponent(u.searchParams.get('state'))}` }); return res.end(); }
  if (u.pathname === '/token') { const f = new URLSearchParams((await body(req)).toString()); if (f.get('client_secret') !== 'csec') return send(401, {}); if (f.get('grant_type') === 'authorization_code' && f.get('code') === 'good') return send(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }); if (f.get('grant_type') === 'refresh_token' && f.get('refresh_token') === 'RT') return send(200, { access_token: 'AT', expires_in: 3600 }); return send(400, { error: 'invalid_grant' }); }
  const th = /^\/thumb\/([^=]+)=s(\d+)$/.exec(u.pathname);
  if (th) { const f = files.get(th[1]); if (!f) return send(404, {}); res.writeHead(200, { 'content-type': f.mimeType.startsWith('image/') ? f.mimeType : 'image/png' }); return res.end(f.mimeType.startsWith('image/') ? f.data : PNG); }
  const ss = /^\/session\/(\w+)$/.exec(u.pathname);
  if (ss && req.method === 'PUT') {
    const s = sessions.get(ss[1]); if (!s) return send(404, {});
    const cr = req.headers['content-range'] || '';
    if (failPuts > 0 && !/\*/.test(cr)) { failPuts--; req.socket.destroy(); return; } // the connection drops mid-upload
    const data = await body(req); if (putDelay) await new Promise((r) => setTimeout(r, putDelay));
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(cr);
    if (m) { const start = +m[1]; if (start <= s.got) { const tail = data.slice(s.got - start); s.parts.push(tail); s.got += tail.length; } }
    if (s.got >= s.size) { if (!s.id) { s.id = newId(); files.set(s.id, { ...s.meta, id: s.id, data: Buffer.concat(s.parts) }); } return send(200, { id: s.id }); }
    res.writeHead(308, s.got ? { range: `bytes=0-${s.got - 1}` } : {}); return res.end();
  }
  if (req.headers.authorization !== 'Bearer AT') return send(401, { error: 'unauthorized' });
  if (u.pathname === '/upload/drive/v3/files' && req.method === 'POST') {
    const meta = JSON.parse((await body(req)).toString()); const sid = crypto.randomBytes(6).toString('hex'); sessionsMade++;
    sessions.set(sid, { meta: { ...meta, mimeType: meta.mimeType || req.headers['x-upload-content-type'] }, size: +req.headers['x-upload-content-length'], got: 0, parts: [], origin: req.headers.origin });
    res.writeHead(200, { location: `${G}/session/${sid}` }); return res.end();
  }
  if (u.pathname === '/drive/v3/files' && req.method === 'GET') return send(200, { files: query(u.searchParams.get('q') || '').map(fileJson) });
  if (u.pathname === '/drive/v3/files' && req.method === 'POST') { const m = JSON.parse((await body(req)).toString()); const id = newId(); files.set(id, { ...m, id, appProperties: m.appProperties || {} }); return send(200, { id }); }
  const fm = /^\/drive\/v3\/files\/([\w-]+)$/.exec(u.pathname);
  if (fm) {
    const f = files.get(fm[1]); if (!f) return send(404, {});
    if (req.method === 'PATCH') { const m = JSON.parse((await body(req)).toString()); f.appProperties = { ...(f.appProperties || {}), ...(m.appProperties || {}) }; return send(200, { id: f.id }); }
    if (u.searchParams.get('alt') === 'media') {
      const rg = /bytes=(\d+)-(\d*)/.exec(req.headers.range || ''); const all = f.data;
      if (rg) { const a = +rg[1], b = rg[2] ? Math.min(+rg[2], all.length - 1) : all.length - 1; res.writeHead(206, { 'content-type': f.mimeType, 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${all.length}`, 'accept-ranges': 'bytes' }); return res.end(all.slice(a, b + 1)); }
      res.writeHead(200, { 'content-type': f.mimeType, 'content-length': all.length }); return res.end(all);
    }
    return send(200, fileJson(f));
  }
  send(404, { error: 'not here' });
});
await new Promise((r) => google.listen(8798, r));

/* ── the site, with the real API on an in-memory KV ── */
const kv = new Map();
const KV = { async get(k, t) { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
const env = { TRIP_KV: KV, TRIP_PIN: '6666', PHOTO_PIN: '1212', PHOTO_SECRET: 'test-secret', GOOGLE_API: G, GOOGLE_OAUTH: G, GOOGLE_AUTH: G };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const B = 'http://localhost:8796';
const site = http.createServer(async (req, res) => {
  const u = new URL(req.url, B);
  if (u.pathname.startsWith('/api/')) {
    const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: ['POST', 'PUT'].includes(req.method) ? await body(req) : undefined, redirect: 'manual' }), env });
    const h = {}; r.headers.forEach((v, k) => (h[k] = v)); res.writeHead(r.status, h); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = decodeURIComponent(u.pathname); let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => site.listen(8796, r));
const api = async (p, opts = {}) => { const r = await onRequest({ request: new Request(B + '/api/photos' + p, opts), env }); return r; };

/* ── test files: JPEGs with camera dates (and one with a location), and a phone-style video ── */
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
{
  const pg = await browser.newPage();
  const jpeg = async (w, h, hue) => Buffer.from((await pg.evaluate(([w, h, hue]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h); for (let i = 0; i < im.data.length; i += 4) { im.data[i] = (Math.random() * 255) | 0; im.data[i + 1] = (hue + Math.random() * 60) | 0; im.data[i + 2] = 120; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }, [w, h, hue])), 'base64');
  const le = (n, b) => { const x = Buffer.alloc(b); if (b === 2) x.writeUInt16LE(n); else x.writeUInt32LE(n); return x; };
  const exif = (jpg, date, gps) => {
    const n0 = gps ? 2 : 1, ifd0Size = 2 + n0 * 12 + 4, exifOff = 8 + ifd0Size, dateOff = exifOff + 18, dateB = Buffer.from(date + '\0', 'latin1'), gpsOff = dateOff + dateB.length, latOff = gpsOff + 54, lngOff = latOff + 24;
    const ent = (tag, type, count, val) => Buffer.concat([le(tag, 2), le(type, 2), le(count, 4), Buffer.isBuffer(val) ? val : le(val, 4)]);
    const rat = (v) => { const d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 6000); return Buffer.concat([le(d, 4), le(1, 4), le(m, 4), le(1, 4), le(s, 4), le(100, 4)]); };
    const ref = (c) => Buffer.from([c.charCodeAt(0), 0, 0, 0]);
    const tiff = Buffer.concat([Buffer.from('II'), le(42, 2), le(8, 4), le(n0, 2), ent(0x8769, 4, 1, exifOff), ...(gps ? [ent(0x8825, 4, 1, gpsOff)] : []), le(0, 4), le(1, 2), ent(0x9003, 2, dateB.length, dateOff), le(0, 4), dateB,
      ...(gps ? [le(4, 2), ent(1, 2, 2, ref('N')), ent(2, 5, 3, latOff), ent(3, 2, 2, ref('E')), ent(4, 5, 3, lngOff), le(0, 4), rat(gps[0]), rat(gps[1])] : [])]);
    const len = tiff.length + 8;
    return Buffer.concat([jpg.slice(0, 2), Buffer.from([0xff, 0xe1, len >> 8, len & 255]), Buffer.from('Exif\0\0', 'latin1'), tiff, jpg.slice(2)]);
  };
  const mp4 = (ms) => { const box = (t, b) => { const h = Buffer.alloc(8); h.writeUInt32BE(8 + b.length); h.write(t, 4, 'latin1'); return Buffer.concat([h, b]); }; const mv = Buffer.alloc(100); const s = Math.floor(ms / 1000) + 2082844800; mv.writeUInt32BE(s, 4); mv.writeUInt32BE(s, 8); mv.writeUInt32BE(1000, 12); mv.writeUInt32BE(4000, 16); return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1')), box('mdat', Buffer.alloc(300000, 7)), box('moov', box('mvhd', mv))]); };
  fs.writeFileSync(FIX + '/shinsaibashi.jpg', exif(await jpeg(1400, 1400, 40), '2026:10:22 15:42:07'));            // Day 7, 3:42 PM → Shinsaibashi, by time
  fs.writeFileSync(FIX + '/castle.jpg', exif(await jpeg(500, 600, 120), '2026:10:22 12:05:00', [34.6873, 135.5262])); // GPS at Osaka Castle → by location
  fs.writeFileSync(FIX + '/before.jpg', exif(await jpeg(400, 500, 200), '2026:10:09 10:30:00'));                   // before the trip → nearest day (Day 1)
  fs.writeFileSync(FIX + '/dinner.mp4', mp4(Date.parse('2026-10-22T09:50:00Z')));                                      // 6:50 PM in Japan → Dinner
  fs.writeFileSync(FIX + '/kyoto.jpg', exif(await jpeg(1300, 1300, 80), '2026:10:23 10:10:00'));                     // for the carry-on test
  await pg.close();
}
const sizeOf = (f) => fs.statSync(FIX + '/' + f).size;
console.log('fixtures', ['shinsaibashi.jpg', 'castle.jpg', 'before.jpg', 'dinner.mp4', 'kyoto.jpg'].map((f) => `${f} ${Math.round(sizeOf(f) / 1024)}KB`).join(', '));

const phone = async (who, vw = 390, vh = 844) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|tile\.openstreetmap|net::ERR/.test(m.text())) errs.push(m.text()); });
  await pg.addInitScript(([who]) => { if (location.protocol === 'about:') return; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('trips.me', JSON.stringify(who)); if (who !== 'guest') localStorage.setItem('trips.pin', '6666'); } window.__CHUNK = 256 * 1024; }, [who]);
  return { ctx, pg, errs };
};
const waitRows = (pg, n) => pg.waitForFunction((n) => document.querySelectorAll('.uprow.done, .uprow.err').length >= n, n, { timeout: 30000 }).catch(() => {});

// 1 · before Google is set up for the site
const N = await phone('naf'); const n = N.pg;
await n.goto(B + '/japan/photos'); await n.waitForTimeout(1200);
ok('member before setup: "almost ready"', /almost ready/.test(await n.textContent('#gate')));
const Gst = await phone('guest'); const gp = Gst.pg;
await gp.goto(B + '/japan/photos'); await gp.waitForTimeout(1000);
ok('guest gets the photos PIN pad', !!(await gp.$('#dots')) && /photos PIN/.test(await gp.textContent('#gate')));
for (const d of '0000') await gp.tap(`[data-k="${d}"]`); await gp.waitForTimeout(600);
ok('wrong photos PIN refused', /not it/.test(await gp.textContent('#pin-msg')));
await gp.screenshot({ path: OUT + 'guest-pin.png' });
for (const d of '1212') await gp.tap(`[data-k="${d}"]`); await gp.waitForTimeout(900);
ok('photos PIN lets the guest in (not set up yet)', /aren't set up yet/.test(await gp.textContent('#gate')) && !!(await gp.evaluate(() => localStorage.getItem('trips.photok'))));

// 2 · Google set up: connect the Drive
env.GOOGLE_CLIENT_ID = 'cid'; env.GOOGLE_CLIENT_SECRET = 'csec';
ok('connect needs the member PIN', (await api('/connect?k=0000')).status === 403);
await n.reload(); await n.waitForTimeout(1200);
ok('member sees Connect Google Drive', /Connect Google Drive/.test(await n.textContent('#gate')));
await n.screenshot({ path: OUT + 'connect.png' });
await n.click('#gate a.go'); await n.waitForURL(/\/japan\/photos/, { timeout: 10000 }); await n.waitForTimeout(1500);
ok('Drive connected and stored', JSON.parse(kv.get('gdrive') || '{}').refresh === 'RT');
ok('back on the photos page, empty, with Upload', /No photos yet/.test(await n.textContent('#content')) && await n.isVisible('#fab'));
ok('connected toast', /connected/i.test(await n.textContent('#toast')));

// 3 · uploads, in 256 KB pieces, with a dropped piece along the way
failPuts = 1;
await n.tap('[data-upload]'); await n.waitForTimeout(400);
await n.setInputFiles('#upfiles', ['shinsaibashi.jpg', 'castle.jpg', 'before.jpg', 'dinner.mp4'].map((f) => FIX + '/' + f));
await waitRows(n, 4); await n.waitForTimeout(500);
const rowsTxt = await n.$$eval('.uprow', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
console.log(rowsTxt.join('\n'));
await n.screenshot({ path: OUT + 'uploaded.png' });
ok('all four uploaded', (await n.$$('.uprow.done')).length === 4, (await n.$$('.uprow.err')).length + ' failed');
const byName = (nm) => [...files.values()].find((f) => f.name === nm && f.data);
const shot = byName('shinsaibashi.jpg');
ok('the big photo arrived whole, through a dropped piece', shot && shot.data.equals(fs.readFileSync(FIX + '/shinsaibashi.jpg')), shot && shot.data.length);
ok('…and was sent in pieces', sizeOf('shinsaibashi.jpg') > 3 * 256 * 1024);
const stopOf = async (day, title) => n.evaluate(([day, title]) => import('./js/plan-time.js').then(async (m) => { const { DAYS } = await import('./data/itinerary.js'); return m.stopsOf(DAYS.find((d) => d.id === day)).find((s) => s.title.startsWith(title)).id; }), [day, title]);
const shinId = await stopOf('d07', 'Shinsaibashi'), castleId = await stopOf('d07', 'Osaka Castle'), dinnerId = await stopOf('d07', 'Dinner');
ok('3:42 PM photo → Day 7 · Shinsaibashi', shot && shot.appProperties.day === 'd07' && shot.appProperties.stop === shinId && shot.appProperties.by === 'naf', JSON.stringify(shot && shot.appProperties));
ok('photo with a location → Osaka Castle', byName('castle.jpg').appProperties.stop === castleId);
ok('video dated by its own clock → Dinner', byName('dinner.mp4').appProperties.stop === dinnerId && byName('dinner.mp4').mimeType === 'video/mp4');
ok('before-the-trip photo → nearest day (Day 1)', byName('before.jpg').appProperties.day === 'd01');
const folderNames = [...files.values()].filter((f) => f.mimeType === 'application/vnd.google-apps.folder').map((f) => f.name);
ok('Drive folders: Our Trips / Japan 2026 / Day 07 · …', folderNames.includes('Our Trips') && folderNames.includes('Japan 2026') && folderNames.some((x) => /^Day 07 · /.test(x)) && folderNames.some((x) => /^Day 01 · /.test(x)), folderNames.join(' | '));
ok('uploads were started from the site\'s address (needed for Google\'s CORS)', [...sessions.values()].every((s) => s.origin === B));

// 4 · the same photo again is skipped
const before = files.size;
await n.setInputFiles('#upfiles', [FIX + '/shinsaibashi.jpg']); await waitRows(n, 5); await n.waitForTimeout(400);
ok('duplicate skipped', /Already uploaded/.test(await n.textContent('#uplist')) && files.size === before);
await n.tap('[data-sheetx]'); await n.waitForTimeout(300);

// 5 · the gallery from Google Drive
await n.reload(); await n.waitForTimeout(1600);
const g1 = await n.evaluate(() => ({ n: document.querySelectorAll('.grid .th').length, stops: [...document.querySelectorAll('.stop .sh b')].map((e) => e.textContent), days: [...document.querySelectorAll('.dh b')].map((e) => e.textContent) }));
ok('gallery lists them by day and stop', g1.n === 4 && g1.days.join() === 'Day 1,Day 7' && g1.stops.some((s) => /Shinsaibashi/.test(s)) && g1.stops.some((s) => /Osaka Castle/.test(s)) && g1.stops.some((s) => /Dinner/.test(s)), JSON.stringify(g1));
const loaded = await n.evaluate(() => Promise.all([...document.querySelectorAll('.grid .th img')].map((im) => (im.complete ? Promise.resolve(im.naturalWidth) : new Promise((r) => { im.onload = () => r(im.naturalWidth); im.onerror = () => r(0); })))));
ok('thumbnails load from Google', loaded.length >= 3 && loaded.every((w) => w > 0), loaded.join());
await n.screenshot({ path: OUT + 'gallery.png', fullPage: true });

// 6 · heart, tag, move, hide, plan photo
const drag = async (x0, y0, x1, y1, k = 12) => { await n.mouse.move(x0, y0); await n.mouse.down(); for (let i = 1; i <= k; i++) { await n.mouse.move(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k); await n.waitForTimeout(12); } await n.mouse.up(); };
await n.tap(`.grid .th[data-pid="${shot.id}"]`); await n.waitForTimeout(700);
await n.tap('[data-heart]'); await n.waitForTimeout(600);
ok('heart saved to Drive', files.get(shot.id).appProperties.hearts === 'naf');
await drag(195, 470, 195, 170); await n.waitForTimeout(700);
await n.tap('#vinfo [data-vtag="m"]'); await n.waitForTimeout(500);
ok('tag Mo saved to Drive', files.get(shot.id).appProperties.in === 'm');
await n.tap('[data-vcover]'); await n.waitForTimeout(500);
ok('chosen as the plan photo for Shinsaibashi', JSON.parse(kv.get('covers') || '{}')[shinId] === shot.id);
await n.screenshot({ path: OUT + 'info.png' });
await n.keyboard.press('Escape'); await n.waitForTimeout(700);
// bulk: select the castle + dinner, tag Sara, then move the castle photo, then hide the Day 1 one
await n.tap('[data-select]'); await n.waitForTimeout(300);
const castle = byName('castle.jpg'), dinner = byName('dinner.mp4'), early = byName('before.jpg');
await n.tap(`.grid .th[data-pid="${castle.id}"]`); await n.tap(`.grid .th[data-pid="${dinner.id}"]`);
await n.tap('#selbar [data-tag]'); await n.waitForTimeout(400); await n.tap('[data-tagp="sara"]'); await n.waitForTimeout(600);
ok('bulk tag keeps each photo\'s other tags', files.get(castle.id).appProperties.in === 'sara' && files.get(dinner.id).appProperties.in === 'sara');
await n.tap('[data-sheetx]'); await n.waitForTimeout(400);
await n.tap('[data-select]'); await n.tap(`.grid .th[data-pid="${early.id}"]`); await n.tap('#selbar [data-assign]'); await n.waitForTimeout(400);
await n.tap('[data-aday="d02"]'); await n.waitForTimeout(300); await n.tap('.stoplist button >> nth=0'); await n.waitForTimeout(600);
ok('moved to another day and stop in Drive', files.get(early.id).appProperties.day === 'd02' && !!files.get(early.id).appProperties.stop);
await n.tap('[data-select]'); await n.tap(`.grid .th[data-pid="${early.id}"]`); await n.tap('#selbar [data-hide]'); await n.waitForTimeout(600);
ok('hidden (kept in Drive, not deleted)', files.get(early.id).appProperties.hidden === '1' && !files.get(early.id).trashed);

// 7 · the plan photo shows on the trip page, for anyone
await n.goto(B + '/japan/?d=d07'); await n.waitForTimeout(2200);
const hero = await n.evaluate((sid) => { const el = document.querySelector(`.pass[data-id="${sid}"] .hero`); return el ? el.style.backgroundImage : null; }, shinId);
ok('the Shinsaibashi pass shows the chosen photo', hero && hero.includes('/api/photos/thumb/' + shot.id), hero);
ok('…and the picture loads without a PIN', (await (await fetch(`${B}/api/photos/thumb/${shot.id}?s=1200`)).status) === 200);
ok('other photos stay private', (await fetch(`${B}/api/photos/thumb/${castle.id}?s=600`)).status === 403 && (await fetch(`${B}/api/photos/file/${castle.id}`)).status === 403);
await n.tap('#ttBtn'); await n.waitForTimeout(500);
ok('Photos is in the + menu', await n.$eval('.tt-opt[href="photos"]', (e) => getComputedStyle(e).opacity === '1'));
await n.screenshot({ path: OUT + 'plus-menu.png' });
await n.tap('.tt-opt[href="photos"]'); await n.waitForURL(/\/japan\/photos/); await n.waitForTimeout(1200);
ok('+ → Photos opens the gallery', (await n.$$('.grid .th')).length === 3);

// 8 · video streams in pieces; originals download
const tok = await n.evaluate(() => localStorage.getItem('trips.photok'));
const vr = await fetch(`${B}/api/photos/file/${dinner.id}?k=${encodeURIComponent(tok)}`, { headers: { range: 'bytes=0-99' } });
ok('video streams with Range (206)', vr.status === 206 && (await vr.arrayBuffer()).byteLength === 100 && /bytes 0-99\//.test(vr.headers.get('content-range')));
const dl = await fetch(`${B}/api/photos/file/${shot.id}?k=${encodeURIComponent(tok)}&dl=1`);
ok('download original', dl.status === 200 && /attachment/.test(dl.headers.get('content-disposition')) && Buffer.from(await dl.arrayBuffer()).equals(shot.data));
await n.tap(`.grid .th[data-pid="${dinner.id}"]`); await n.waitForTimeout(800);
ok('viewer plays the video from Drive', /\/api\/photos\/file\//.test(await n.$eval('#track .slide:nth-child(2) video', (v) => v.getAttribute('src'))));
await n.keyboard.press('Escape'); await n.waitForTimeout(600);

// 9 · changes need the member PIN
ok('upload needs the member PIN', (await api('/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trip: 'japan', folder: 'x', name: 'a.jpg', mime: 'image/jpeg', size: 10, day: 'd01', t: 1, by: 'naf' }) })).status === 403);
ok('editing needs the member PIN', (await api('/update', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '1212' }, body: JSON.stringify({ ids: [shot.id], set: { hidden: true } }) })).status === 403 && files.get(shot.id).appProperties.hidden !== '1');

// 10 · carrying on after the page was closed mid-upload
putDelay = 350; const made = sessionsMade;
await n.tap('[data-upload]'); await n.waitForTimeout(300); await n.setInputFiles('#upfiles', [FIX + '/kyoto.jpg']);
await n.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('photos.queue') || '{}')).some((q) => q.offset > 0), null, { timeout: 15000 }).catch(() => {});
const partial = await n.evaluate(() => Object.values(JSON.parse(localStorage.getItem('photos.queue') || '{}'))[0]);
n.on('dialog', (d) => d.accept());
await n.goto('about:blank'); putDelay = 0; await n.goto(B + '/japan/photos'); await n.waitForTimeout(1500);
ok('page remembers the unfinished upload', /1 upload didn't finish/.test(await n.textContent('#resume')), JSON.stringify(partial));
await n.tap('#resume [data-upload]'); await n.waitForTimeout(300); await n.setInputFiles('#upfiles', [FIX + '/kyoto.jpg']); await waitRows(n, 1); await n.waitForTimeout(500);
const ky = byName('kyoto.jpg');
ok('…and carries on in the same upload', ky && ky.data.equals(fs.readFileSync(FIX + '/kyoto.jpg')) && sessionsMade === made + 1 && partial && partial.offset > 0, `sessions +${sessionsMade - made}`);
ok('queue cleared', (await n.evaluate(() => localStorage.getItem('photos.queue'))) === null);

// 11 · a guest with the photos PIN: sees photos (not hidden ones), changes nothing
await gp.reload(); await gp.waitForTimeout(1800);
const gv = await gp.evaluate(() => ({ n: document.querySelectorAll('.grid .th').length, fab: document.getElementById('fab').hidden, sel: document.querySelector('[data-select]').hidden, ids: [...document.querySelectorAll('.grid .th')].map((e) => e.dataset.pid) }));
ok('guest sees the photos, not the hidden one', gv.n === 4 && !gv.ids.includes(early.id), JSON.stringify(gv));
ok('guest has no Upload or Select', gv.fab && gv.sel);
await gp.tap(`.grid .th[data-pid="${shot.id}"]`); await gp.waitForTimeout(700);
ok('guest viewer: no heart', await gp.$eval('[data-heart]', (e) => e.hidden));
await gp.screenshot({ path: OUT + 'guest-viewer.png' });
// small phone
const S = await phone('sara', 375, 667); await S.pg.goto(B + '/japan/photos'); await S.pg.waitForTimeout(1600);
ok('small phone: gallery renders', (await S.pg.$$('.grid .th')).length === 4);
await S.pg.screenshot({ path: OUT + 'small.png' });

for (const [k, x] of [['naf', N], ['guest', Gst], ['sara', S]]) ok(`no page errors (${k})`, !x.errs.length, x.errs.join(' | '));
console.log(fails ? `\n${fails} failed` : '\nall photo checks passed');
await browser.close(); site.close(); google.close(); fs.rmSync(FIX, { recursive: true, force: true });
process.exitCode = fails ? 1 : 0;
