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
const files = new Map(), sessions = new Map(); let nid = 1, failPuts = 0, putDelay = 0, sessionsMade = 0, failDrive = false;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'; let aboutUser = { displayName: 'Naf Test', emailAddress: 'naf@example.com' };
const newId = () => 'fileid' + String(nid++).padStart(8, '0');
const body = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const multipart = (raw, b) => { const sep = Buffer.from('--' + b), out = []; let i = raw.indexOf(sep); while (i >= 0) { const j = raw.indexOf(sep, i + sep.length); if (j < 0) break; const part = raw.slice(i + sep.length + 2, j - 2), h = part.indexOf('\r\n\r\n'); out.push({ head: part.slice(0, h).toString(), data: part.slice(h + 4) }); i = j; } return out; };
const pick = (q, re) => { const m = re.exec(q); return m ? m[1].replace(/\\'/g, "'") : null; };
function query(q) {
  const not = [...q.matchAll(/not appProperties has \{ key='([^']+)' and value='([^']*)' \}/g)].map((m) => [m[1], m[2]]); q = q.replace(/not appProperties has \{[^}]*\}/g, '');
  const parents = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]), media = /mimeType contains 'image\/'/.test(q);
  const name = pick(q, /name='((?:[^'\\]|\\.)*)'/), mime = pick(q, /mimeType='([^']+)'/), parent = pick(q, /'([^']+)' in parents/);
  const props = [...q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']*)' \}/g)].map((m) => [m[1], m[2]]);
  return [...files.values()].filter((f) => !f.trashed && (!name || f.name === name) && (!mime || f.mimeType === mime) && (!parent || parents.some((x) => (f.parents || []).includes(x))) && (!media || /^(image|video)\//.test(f.mimeType)) && props.every(([k, v]) => (f.appProperties || {})[k] === v) && !not.some(([k, v]) => (f.appProperties || {})[k] === v));
}
const fileJson = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, parents: f.parents, size: String(f.data ? f.data.length : 0), appProperties: f.appProperties, createdTime: f.createdTime, owners: f.owners, trashed: !!f.trashed,
  thumbnailLink: f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/') ? `${G}/thumb/${f.id}=s220` : undefined,
  imageMediaMetadata: f.mimeType.startsWith('image/') ? { width: 1200, height: 1600, rotation: 0, ...(f.meta || {}) } : undefined, videoMediaMetadata: f.mimeType.startsWith('video/') ? { width: 1080, height: 1920, durationMillis: '4000' } : undefined });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const google = http.createServer(async (req, res) => {
  const u = new URL(req.url, G);
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,OPTIONS'); res.setHeader('access-control-allow-headers', 'content-range,content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const send = (s, j, h = {}) => { res.writeHead(s, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(j)); };
  if (u.pathname === '/o/oauth2/v2/auth') { res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=good&state=${encodeURIComponent(u.searchParams.get('state'))}` }); return res.end(); }
  if (u.pathname === '/token') { const f = new URLSearchParams((await body(req)).toString()); if (f.get('client_secret') !== 'csec') return send(401, {}); if (f.get('grant_type') === 'authorization_code' && f.get('code') === 'good') return send(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: DRIVE_SCOPE }); if (f.get('grant_type') === 'refresh_token' && f.get('refresh_token') === 'RT') return send(200, { access_token: 'AT', expires_in: 3600 }); return send(400, { error: 'invalid_grant' }); }
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
  if (failDrive && u.pathname.startsWith('/upload/')) return send(500, { error: 'backend error' });
  if (u.pathname === '/upload/drive/v3/files' && req.method === 'POST' && u.searchParams.get('uploadType') === 'multipart') {
    const parts = multipart(await body(req), /boundary=([^;]+)/.exec(req.headers['content-type'])[1]); const meta = JSON.parse(parts[0].data.toString()); const id = newId();
    files.set(id, { ...meta, id, appProperties: meta.appProperties || {}, data: parts[1].data, type: /content-type: (.+)/i.exec(parts[1].head)[1].trim(), uploads: 1 }); return send(200, { id });
  }
  const um = /^\/upload\/drive\/v3\/files\/([\w-]+)$/.exec(u.pathname);
  if (um && req.method === 'PATCH') { const f = files.get(um[1]); if (!f) return send(404, {}); f.data = await body(req); f.uploads++; return send(200, { id: f.id }); }
  if (u.pathname === '/upload/drive/v3/files' && req.method === 'POST') {
    const meta = JSON.parse((await body(req)).toString()); const sid = crypto.randomBytes(6).toString('hex'); sessionsMade++;
    sessions.set(sid, { meta: { ...meta, mimeType: meta.mimeType || req.headers['x-upload-content-type'] }, size: +req.headers['x-upload-content-length'], got: 0, parts: [], origin: req.headers.origin });
    res.writeHead(200, { location: `${G}/session/${sid}` }); return res.end();
  }
  if (u.pathname === '/drive/v3/about') return send(200, { user: aboutUser });
  if (u.pathname === '/drive/v3/files' && req.method === 'GET') return send(200, { files: query(u.searchParams.get('q') || '').map(fileJson) });
  if (u.pathname === '/drive/v3/files' && req.method === 'POST') { const m = JSON.parse((await body(req)).toString()); const id = newId(); files.set(id, { ...m, id, appProperties: m.appProperties || {} }); return send(200, { id }); }
  const fm = /^\/drive\/v3\/files\/([\w-]+)$/.exec(u.pathname);
  if (fm) {
    const f = files.get(fm[1]); if (!f) return send(404, {});
    if (req.method === 'PATCH') {
      const m = JSON.parse((await body(req)).toString() || '{}'); f.appProperties = { ...(f.appProperties || {}), ...(m.appProperties || {}) };
      if (m.name) f.name = m.name; if (m.trashed) f.trashed = true;
      const add = u.searchParams.get('addParents'), rm = u.searchParams.get('removeParents');
      if (add || rm) f.parents = [...(f.parents || []).filter((x) => x !== rm), ...(add ? [add] : [])];
      return send(200, { id: f.id });
    }
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
/* ── the faces server (workers/faces): its container's real models when they're here (workers/faces/fetch-parts.sh, and a
   Python with onnxruntime: FACES_PY), else none (those checks are skipped); what it found, kept like FaceLooks does ── */
const PARTS = REPO + '/workers/faces/server/parts/models/', PY = process.env.FACES_PY || 'python3'; let faceBox = null;
const canFaces = fs.existsSync(PARTS + 'w600k_r50.onnx') && (() => { try { execSync(`${PY} -c "import onnxruntime, cv2, PIL"`, { stdio: 'ignore' }); return true; } catch { return false; } })();
if (canFaces) {
  const { spawn } = await import('child_process');
  faceBox = spawn(PY, [REPO + '/workers/faces/server/main.py', '8797'], { env: { ...process.env, MODELS: PARTS }, stdio: 'ignore' });
  process.on('exit', () => faceBox.kill());
  for (let t = 0; t < 60 && !(await fetch('http://localhost:8797/').then((r) => r.ok, () => false)); t++) await new Promise((r) => setTimeout(r, 500));
}
const looksKept = new Map(); let lookCalls = 0;
const FACES = { async fetch(u, init) {
  const p = new URL(u).pathname, j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
  if (p === '/look') { lookCalls++; return canFaces ? fetch('http://localhost:8797/look' + new URL(u).search, { method: 'POST', body: init.body }) : j({ f: [], b: [] }); }
  const b = JSON.parse(init.body);
  if (p === '/get') return j({ looks: Object.fromEntries(b.keys.filter((k) => looksKept.has(k)).map((k) => [k, looksKept.get(k)])) });
  if (p === '/missing') return j({ keys: b.keys.filter((k) => !looksKept.has(k)) });
  if (p === '/put') { looksKept.set(b.key, b.look); return j({ ok: true }); }
  return j({}, 404);
} };
const env = { TRIP_KV: KV, TRIP_PIN: '6666', PHOTO_PIN: '1212', PHOTO_SECRET: 'test-secret', GOOGLE_API: G, GOOGLE_OAUTH: G, GOOGLE_AUTH: G, FACES, FACES_KEY: 'faces-key' };
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
const FIX = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-')); let exifOf = null;
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
  exifOf = exif;
  const mp4 = (ms) => { const box = (t, b) => { const h = Buffer.alloc(8); h.writeUInt32BE(8 + b.length); h.write(t, 4, 'latin1'); return Buffer.concat([h, b]); }; const mv = Buffer.alloc(100); const s = Math.floor(ms / 1000) + 2082844800; mv.writeUInt32BE(s, 4); mv.writeUInt32BE(s, 8); mv.writeUInt32BE(1000, 12); mv.writeUInt32BE(4000, 16); return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1')), box('mdat', Buffer.alloc(300000, 7)), box('moov', box('mvhd', mv))]); };
  fs.writeFileSync(FIX + '/shinsaibashi.jpg', exif(await jpeg(1400, 1400, 40), '2026:10:22 15:42:07'));            // Day 7, 3:42 PM → Shinsaibashi, by time
  fs.writeFileSync(FIX + '/castle.jpg', exif(await jpeg(500, 600, 120), '2026:10:22 12:05:00', [34.6873, 135.5262])); // GPS at Osaka Castle → by location
  fs.writeFileSync(FIX + '/before.jpg', exif(await jpeg(400, 500, 200), '2026:10:09 10:30:00'));                   // before the trip → nearest day (Day 1)
  fs.writeFileSync(FIX + '/dinner.mp4', mp4(Date.parse('2026-10-22T09:50:00Z')));                                      // 6:50 PM in Japan → Dinner
  fs.writeFileSync(FIX + '/kyoto.jpg', exif(await jpeg(1300, 1300, 80), '2026:10:23 10:10:00'));                     // for the carry-on test
  // for the sort (the stand-in Claude answers by shape): tall = one person, wide = a view, square = a selfie of two
  fs.writeFileSync(FIX + '/gion.jpg', exif(await jpeg(900, 1200, 20), '2026:10:21 15:20:00', [35.0027, 135.7750])); // Day 6, Gion: NASA's stop
  fs.writeFileSync(FIX + '/view.jpg', exif(await jpeg(1200, 800, 160), '2026:10:22 09:30:00'));
  fs.writeFileSync(FIX + '/us.jpg', exif(await jpeg(1000, 1000, 100), '2026:10:22 10:20:00'));
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
// (folders as the older site made them: the money backups inside the trip folder)
const FOLDER_T = 'application/vnd.google-apps.folder', mkdir = (name, parent) => { const id = newId(); files.set(id, { id, name, mimeType: FOLDER_T, parents: [parent], appProperties: {} }); return id; };
const OT = mkdir('Our Trips', 'root'), JP = mkdir('Japan 2026', OT), OLDBK = mkdir('Backups', JP);
const oldMoney = newId(); files.set(oldMoney, { id: oldMoney, name: 'Saved earlier.json', mimeType: 'application/json', parents: [OLDBK], appProperties: {}, data: Buffer.from('{}') });
kv.set('gfolders', JSON.stringify({ 'root/Our Trips': OT, [`${OT}/Japan 2026`]: JP, [`${JP}/Backups`]: OLDBK }));
ok('connect needs the member PIN', (await api('/connect?k=0000')).status === 403);
await n.reload(); await n.waitForTimeout(1200);
ok('member sees Connect Google Drive', /Connect Google Drive/.test(await n.textContent('#gate')));
await n.screenshot({ path: OUT + 'connect.png' });
await n.click('#gate a.go'); await n.waitForURL(/\/japan\/photos/, { timeout: 10000 }); await n.waitForTimeout(1500);
ok('Drive connected and stored', JSON.parse(kv.get('gdrive') || '{}').refresh === 'RT');
ok('back on the photos page, empty, with Upload', /No photos yet/.test(await n.textContent('#content')) && await n.isVisible('#fab'));
ok('connected toast', /connected/i.test(await n.textContent('#toast')));
await n.waitForTimeout(600);
ok('the old Backups folder moved next to the trip folder as "Japan 2026 backups", with its files', files.get(OLDBK).name === 'Japan 2026 backups' && files.get(OLDBK).parents.join() === OT && files.get(oldMoney).parents[0] === OLDBK && JSON.parse(kv.get('gfolders'))[`${OT}/Japan 2026 backups`] === OLDBK && !JSON.parse(kv.get('gfolders'))[`${JP}/Backups`], JSON.stringify(files.get(OLDBK)));

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
ok('one Drive folder: everything straight in Our Trips / Japan 2026, no day folders', !folderNames.some((x) => /^Day \d/.test(x)) && ['shinsaibashi.jpg', 'castle.jpg', 'before.jpg', 'dinner.mp4'].every((nm) => byName(nm).parents.join() === JP), folderNames.join(' | '));
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

// 5b · the Drive link: the Japan 2026 folder, for uploading with the Google Drive app in the background
const tripFolder = [...files.values()].find((f) => f.name === 'Japan 2026' && f.mimeType === 'application/vnd.google-apps.folder');
const driveHref = 'https://drive.google.com/drive/folders/' + (tripFolder && tripFolder.id);
ok('Drive button in the top bar opens the Japan 2026 folder', await n.isVisible('.bar [data-drive]') && (await n.getAttribute('.bar [data-drive]', 'href')) === driveHref, await n.getAttribute('.bar [data-drive]', 'href'));
await n.tap('[data-upload]'); await n.waitForTimeout(400);
ok('upload sheet offers the Drive app with the same link', (await n.getAttribute('#sheet [data-drive]', 'href')) === driveHref && /Google Drive app/.test(await n.textContent('#sheet')));
await n.screenshot({ path: OUT + 'upload-drive.png' });
await n.tap('[data-sheetx]'); await n.waitForTimeout(300);
ok('folder link needs the member PIN', (await api('/folder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"trip":"japan"}' })).status === 403);

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

// 8b · saving originals to the phone: a download each on Android, the share sheet on iPhone (20 at a time)
{
  const got = []; const onDl = (d) => got.push(d); n.on('download', onDl);
  await n.tap(`.grid .th[data-pid="${shot.id}"]`); await n.waitForTimeout(700);
  await n.screenshot({ path: OUT + 'save-viewer.png' });
  await n.tap('.vw [data-vsave]'); await n.waitForFunction(() => /Saved/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).catch(() => {});
  const f0 = got[0] && fs.readFileSync(await got[0].path());
  ok('viewer Save downloads the original', got.length === 1 && got[0].suggestedFilename() === shot.name && f0 && f0.equals(shot.data), got.map((d) => d.suggestedFilename()).join());
  ok('…and says so', /Saved 1 photo/.test(await n.textContent('#toast')), await n.textContent('#toast'));
  await n.keyboard.press('Escape'); await n.waitForTimeout(600);
  const th0 = await n.$(`.grid .th[data-pid="${castle.id}"]`); await th0.scrollIntoViewIfNeeded(); const bb = await th0.boundingBox();
  await n.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await n.mouse.down(); await n.waitForTimeout(650); await n.mouse.up(); await n.waitForTimeout(300);
  ok('press and hold a photo: Select opens with it ticked', await n.evaluate(() => document.body.classList.contains('sel') && !document.getElementById('vw').classList.contains('on')) && (await n.textContent('#seln')) === '1 selected'
    && (await n.$eval(`.grid .th[data-pid="${castle.id}"]`, (e) => e.classList.contains('on'))), await n.textContent('#seln'));
  await n.screenshot({ path: OUT + 'save-hold-to-select.png' });
  await n.tap('[data-selx]'); await n.waitForTimeout(300);
  await n.tap('[data-pp="sara"]'); await n.waitForTimeout(400);
  await n.tap('[data-select]'); await n.waitForTimeout(300); await n.tap('#selbar [data-selall]'); await n.waitForTimeout(200);
  const sel = await n.evaluate(() => [...document.querySelectorAll('.grid .th.on')].map((e) => e.dataset.pid).sort());
  ok('Select all follows the filters (photos with Sara)', (await n.textContent('#seln')) === '2 selected' && sel.join() === [castle.id, dinner.id].sort().join(), sel.join());
  await n.tap('[data-selx]'); await n.tap('[data-clrppl]').catch(() => n.tap('[data-pp="sara"]')); await n.waitForTimeout(400);
  const nv = (await n.$$('.grid .th')).length;
  await n.tap('[data-select]'); await n.waitForTimeout(300); await n.tap('#selbar [data-selall]'); await n.waitForTimeout(200);
  ok('Select all picks every photo shown', (await n.textContent('#seln')) === `${nv} selected` && (await n.textContent('#selbar [data-selall]')) === 'Clear');
  await n.screenshot({ path: OUT + 'save-select-all.png' });
  got.length = 0; await n.evaluate(() => (document.getElementById('toast').textContent = '')); await n.tap('#selbar [data-save]');
  await n.waitForFunction(() => /Saved/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => {});
  const names = got.map((d) => d.suggestedFilename()).sort();
  ok('Save in Select downloads each original', got.length === nv && names.includes('dinner.mp4') && names.includes('castle.jpg'), names.join());
  ok('…and counts them', new RegExp(`Saved ${nv} photos`).test(await n.textContent('#toast')), await n.textContent('#toast'));
  await n.tap('#selbar [data-selall]'); ok('…tap again to clear', (await n.textContent('#seln')) === 'Tap or drag across');
  await n.tap('[data-selx]'); await n.waitForTimeout(300); n.off('download', onDl);

  // iPhone: the share sheet, from a tap on Save once the files are here; two at a time here (20 on the site)
  const ictx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const ip = await ictx.newPage(); const ierrs = []; ip.on('pageerror', (e) => ierrs.push(e.message)); ip.on('download', () => ierrs.push('downloaded instead of sharing'));
  await ip.addInitScript(() => { if (location.protocol === 'about:') return; localStorage.setItem('trips.me', '"mariam"'); localStorage.setItem('trips.pin', '6666'); window.__SAVECHUNK = 2;
    navigator.canShare = (d) => !!(d && d.files); navigator.share = async (d) => { (window.__shared = window.__shared || []).push(d.files.map((f) => [f.name, f.type, f.size])); }; });
  await ip.goto(B + '/japan/photos'); await ip.waitForTimeout(1800);
  await ip.tap(`.grid .th[data-pid="${shot.id}"]`); await ip.waitForTimeout(700); await ip.tap('.vw [data-vsave]');
  await ip.waitForSelector('#savec.on [data-savego]', { timeout: 8000 }).catch(() => {});
  ok('iPhone: the photo is fetched, then a Save button', /1 photo ready/.test(await ip.textContent('#savec')) && !(await ip.evaluate(() => window.__shared)), await ip.textContent('#savec'));
  await ip.waitForTimeout(350); await ip.screenshot({ path: OUT + 'save-iphone-ready.png' });
  await ip.tap('[data-savego]'); await ip.waitForTimeout(500);
  const sh1 = await ip.evaluate(() => window.__shared);
  ok('…which opens the share sheet with the original', sh1 && sh1.length === 1 && sh1[0].length === 1 && sh1[0][0][0] === shot.name && sh1[0][0][1] === 'image/jpeg' && sh1[0][0][2] === shot.data.length, JSON.stringify(sh1));
  ok('…and says saved', /Saved 1 photo/.test(await ip.textContent('#toast')) && !(await ip.$('#savec.on')));
  await ip.keyboard.press('Escape'); await ip.waitForTimeout(600);
  await ip.evaluate(() => { window.__shared = []; document.getElementById('toast').textContent = ''; }); const iv = (await ip.$$('.grid .th')).length;
  await ip.tap('[data-select]'); await ip.waitForTimeout(300); await ip.tap('#selbar [data-selall]'); await ip.tap('#selbar [data-save]');
  for (let k = 0; k < Math.ceil(iv / 2); k++) { await ip.waitForSelector('#savec.on [data-savego]', { timeout: 8000 }).catch(() => {}); if (k === 0) { await ip.waitForTimeout(350); await ip.screenshot({ path: OUT + 'save-iphone-many.png' }); } await ip.tap('#savec [data-savego]'); await ip.waitForTimeout(400); }
  await ip.waitForTimeout(300);
  const sh2 = await ip.evaluate(() => window.__shared);
  ok('iPhone: many go to the share sheet in groups', sh2.length === Math.ceil(iv / 2) && sh2.flat().length === iv && sh2.every((g) => g.length <= 2), JSON.stringify(sh2.map((g) => g.length)));
  ok('…and the total is counted', new RegExp(`Saved ${iv} photos`).test(await ip.textContent('#toast')), await ip.textContent('#toast'));
  ok('iPhone saving: no page errors', !ierrs.length, ierrs.join(' | '));
  await ictx.close();
}

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
ok('guest has no Upload, Select or Drive link', gv.fab && gv.sel && (await gp.$eval('.bar [data-drive]', (e) => e.hidden)));
await gp.tap(`.grid .th[data-pid="${shot.id}"]`); await gp.waitForTimeout(700);
ok('guest viewer: no heart', await gp.$eval('[data-heart]', (e) => e.hidden));
await gp.screenshot({ path: OUT + 'guest-viewer.png' });
// small phone
const S = await phone('sara', 375, 667); await S.pg.goto(B + '/japan/photos'); await S.pg.waitForTimeout(1600);
ok('small phone: gallery renders', (await S.pg.$$('.grid .th')).length === 4);
await S.pg.screenshot({ path: OUT + 'small.png' });

// 12 · money backups to the same Drive: Our Trips / Japan 2026 backups
{
  const { resetBackupMemory, japanDay } = await import(REPO + '/lib/backup.js');
  const pend = [];
  const post = async (p, b) => { const r = await onRequest({ request: new Request(B + '/api/' + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify(b) }), env, waitUntil: (x) => pend.push(x) }); await Promise.all(pend.splice(0)); return r; };
  const named = (re) => [...files.values()].filter((f) => re.test(f.name || ''));
  const folderId = (name) => ([...files.values()].find((f) => f.name === name && f.mimeType === 'application/vnd.google-apps.folder') || {}).id;
  const today = japanDay(), esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const one = (name) => named(new RegExp(`^${esc(name)}$`));
  const photo = 'data:image/jpeg;base64,' + fs.readFileSync(FIX + '/before.jpg').toString('base64');
  ok('receipt saved', (await post('receipt', { id: 'bk1', photo })).ok);
  await post('expenses', { id: 'bk1', value: { title: '=Ramen, "Ichiran"', yen: 4000, payer: 'naf', cat: 'food', day: 'd03', shares: { naf: 1000, sara: 1000, mariam: 1000, m: 1000 }, with: 'card', by: 'naf', at: Date.now(), receipt: 1700000000000 } });
  const bkDir = folderId('Japan 2026 backups'), js = one(`Money ${today}.json`), cs = one(`Expenses ${today}.csv`), sh = one(`Expenses ${today}`), rc = named(/ bk1\.jpg$/);
  ok('first money change of the day backs up by itself', bkDir && js.length === 1 && cs.length === 1 && sh.length === 1 && [js[0], cs[0], sh[0]].every((f) => f.parents[0] === bkDir), `${js.length}/${cs.length}/${sh.length}`);
  ok('…in Our Trips, next to the trip folder', files.get(bkDir) && files.get(bkDir).parents[0] === folderId('Our Trips') && bkDir === OLDBK);
  const J = JSON.parse(js[0].data.toString());
  ok('JSON has every money record', J.expenses.bk1 && J.expenses.bk1.yen === 4000 && J.money && typeof J.money === 'object');
  const csv = cs[0].data.toString();
  ok('CSV: a row per expense, shares by name, formula-safe', /^\ufeffDate,Day,What,Type,Yen,Paid by,Paid with,Naf,Sara,Mariam,Mo,/.test(csv) && csv.includes('2026-10-18,Day 3," =Ramen, ""Ichiran""",Food,4000,Naf,Card,1000,1000,1000,1000'), csv.split('\r\n')[1]);
  ok('Google Sheet made from the CSV', sh[0].mimeType === 'application/vnd.google-apps.spreadsheet' && sh[0].type === 'text/csv' && !sh[0].data.toString().startsWith('\ufeff'));
  ok('receipt photo copied into Japan 2026 backups / Receipts', rc.length === 1 && rc[0].parents[0] === folderId('Receipts') && rc[0].data.equals(fs.readFileSync(FIX + '/before.jpg')) && rc[0].name === '2026-10-18 =Ramen, Ichiran bk1.jpg', rc[0] && rc[0].name);

  await post('expenses', { id: 'bk2', value: { kind: 'pay', from: 'sara', to: 'naf', yen: 1000, day: 'd03', cash: true, by: 'sara', at: Date.now() } });
  ok('later changes the same day: no second backup', js[0].uploads === 1 && named(/^Money /).length === 1);

  // Settings: the status and Back up now
  await n.goto(B + '/japan/prototypes/tools.html?v=5'); await n.waitForFunction(() => /Last backup: today/.test(document.getElementById('bk-line')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok('Settings shows the last backup', /Last backup: today \d\d:\d\d/.test(await n.textContent('#bk-line')), await n.textContent('#bk-line'));
  await (await n.$('#bk-line')).scrollIntoViewIfNeeded(); await n.screenshot({ path: OUT + 'backup-settings.png' });
  await n.tap('[data-backup]'); await n.waitForFunction(() => !/Backing up/.test(document.getElementById('bk-line').textContent), null, { timeout: 8000 });
  ok('Back up now updates the same day\'s files', js[0].uploads === 2 && sh[0].uploads === 2 && named(/^Money /).length === 1 && JSON.parse(js[0].data.toString()).expenses.bk2, `uploads ${js[0].uploads}`);
  ok('payments listed under the expenses', cs[0].data.toString().includes('Sara paid Naf in cash,Payment,1000,Sara'));
  ok('receipt not copied twice', named(/ bk1\.jpg$/).length === 1 && rc[0].uploads === 1);

  failDrive = true; await n.tap('[data-backup]'); await n.waitForFunction(() => !/Backing up/.test(document.getElementById('bk-line').textContent), null, { timeout: 8000 }); failDrive = false;
  ok('a failed backup says so', /Last try didn't work: Google Drive didn't answerLast backup: today/.test(await n.textContent('#bk-line')), await n.textContent('#bk-line'));
  await (await n.$('#bk-line')).scrollIntoViewIfNeeded(); await n.screenshot({ path: OUT + 'backup-failed.png' });

  // the next day: yesterday's backup is there, the first change makes today's
  const yday = new Date(Date.parse(today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  js[0].name = `Money ${yday}.json`;
  const st = JSON.parse(kv.get('backup')); kv.set('backup', JSON.stringify({ ...st, day: yday, tried: Date.now() - 864e5, error: null, files: { [yday]: st.files[today] } })); resetBackupMemory();
  await post('money', { id: 'b:naf', value: 50000 });
  const js2 = one(`Money ${today}.json`);
  ok('next day: a new day\'s files, yesterday\'s kept', js2.length === 1 && one(`Money ${yday}.json`).length === 1 && JSON.parse(js2[0].data.toString()).money['b:naf'] === 50000);

  // Drive not connected: nothing runs, Settings says what to do
  const g = kv.get('gdrive'); kv.delete('gdrive'); resetBackupMemory(); kv.set('backup', JSON.stringify({ ...JSON.parse(kv.get('backup')), day: '2026-10-17', tried: null })); const before = files.size;
  await post('money', { id: 'b:sara', value: 40000 });
  ok('not connected: no backup tried', files.size === before && JSON.parse(kv.get('backup')).day === '2026-10-17');
  await n.reload(); await n.waitForFunction(() => /Photos page/.test(document.getElementById('bk-line')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok('not connected: Settings points to the Photos page', /Connect Google Drive on the Photos page/.test(await n.textContent('#bk-line')) && await n.$eval('[data-backup]', (b) => b.disabled));
  kv.set('gdrive', g);
  ok('backup needs the PIN', (await onRequest({ request: new Request(B + '/api/backup'), env })).status === 403);
}

// 13 · photos added straight into the trip's folders with the Google Drive app show up, filed by day and stop
{
  const FOLDER = 'application/vnd.google-apps.folder';
  const fid = (re) => ([...files.values()].find((f) => re.test(f.name || '') && f.mimeType === FOLDER) || {}).id;
  const tripDir = fid(/^Japan 2026$/);
  // day folders as the older site made them, one with a photo the site had already filed
  const d7 = mkdir('Day 07 · Nara + Osaka', tripDir), d8 = mkdir('Day 08 · Arashiyama + samurai', tripDir);
  const oldFiled = newId(); files.set(oldFiled, { id: oldFiled, name: 'old.jpg', mimeType: 'image/jpeg', parents: [d7], appProperties: { trip: 'japan', day: 'd07', stop: '', t: String(Date.parse('2026-10-22T03:00:00Z')), by: 'naf', in: '', hearts: '' }, data: fs.readFileSync(FIX + '/castle.jpg') });
  const add = (name, mimeType, parents, extra) => { const id = newId(); files.set(id, { id, name, mimeType, parents, appProperties: {}, data: fs.readFileSync(FIX + '/castle.jpg'), ...extra }); return id; };
  const heic = add('IMG_1001.HEIC', 'image/heic', [d7], { meta: { time: '2026:10:22 12:05:00', location: { latitude: 34.6873, longitude: 135.5262 } }, owners: [{ displayName: 'Mariam Q' }], createdTime: '2026-10-22T05:00:00Z' });
  const jpg = add('IMG_1002.JPG', 'image/jpeg', [tripDir], { meta: { time: '2026:10:22 15:42:07' }, owners: [{ displayName: 'Sara' }], createdTime: '2026-10-22T07:00:00Z' });
  const mov = add('IMG_1003.MOV', 'video/quicktime', [d8], { owners: [{ displayName: 'Mohammed E' }], createdTime: '2026-10-23T01:10:00Z' });
  const pdf = add('notes.pdf', 'application/pdf', [tripDir], { createdTime: '2026-10-22T07:00:00Z' });
  const away = add('elsewhere.jpg', 'image/jpeg', ['root'], { meta: { time: '2026:10:22 15:00:00' }, createdTime: '2026-10-22T07:00:00Z' });
  const g0 = JSON.parse(kv.get('gdrive'));
  ok('connecting remembered whose Drive it is and the access', g0.email === 'naf@example.com' && g0.scope === DRIVE_SCOPE);

  // an older connection (only the site's own files): the page asks for a reconnect, nothing is filed
  kv.set('gdrive', JSON.stringify({ ...g0, scope: 'https://www.googleapis.com/auth/drive.file' }));
  await n.goto(B + '/japan/photos'); await n.waitForSelector('#drivebanner .banner', { timeout: 8000 }).catch(() => {});
  ok('old connection: a banner asks Naf to reconnect', /don't show here yet/.test(await n.textContent('#drivebanner')) && /Naf needs to reconnect/.test(await n.textContent('#drivebanner')), await n.textContent('#drivebanner'));
  ok('…and nothing is filed meanwhile', !files.get(heic).appProperties.trip && !files.get(jpg).appProperties.trip);
  await n.screenshot({ path: OUT + 'drive-reconnect.png' });

  // reconnecting with a different Google account is refused (the photos would move to another Drive)
  aboutUser = { displayName: 'Someone Else', emailAddress: 'else@example.com' };
  await n.tap('#drivebanner a'); await n.waitForTimeout(1200);
  ok('reconnect with another account refused', /different Google account/.test(await n.textContent('body')) && JSON.parse(kv.get('gdrive')).scope.endsWith('drive.file'));
  aboutUser = { displayName: 'Naf Test', emailAddress: 'naf@example.com' };

  // the same account: wider access, and the Drive-app photos are filed
  await n.goto(B + '/japan/photos'); await n.waitForSelector('#drivebanner .banner', { timeout: 8000 }).catch(() => {});
  await n.tap('#drivebanner a'); await n.waitForURL(/\/japan\/photos/, { timeout: 10000 });
  await n.waitForFunction(() => /from the Drive app added/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok('reconnected with full access, banner gone', JSON.parse(kv.get('gdrive')).scope === DRIVE_SCOPE && !(await n.textContent('#drivebanner')).trim());
  ok('toast: 3 from the Drive app added', /3 from the Drive app added/.test(await n.textContent('#toast')), await n.textContent('#toast'));
  const ap = (id) => files.get(id).appProperties;
  ok('HEIC in the Day 7 folder, with a location → Osaka Castle, by Mariam', ap(heic).trip === 'japan' && ap(heic).day === 'd07' && ap(heic).stop === castleId && ap(heic).by === 'mariam', JSON.stringify(ap(heic)));
  ok('photo in the trip folder → Day 7 · Shinsaibashi by its camera time, by Sara', ap(jpg).day === 'd07' && ap(jpg).stop === shinId && ap(jpg).by === 'sara', JSON.stringify(ap(jpg)));
  ok('video in the Day 8 folder → Day 8, by Mo (Mohammed)', ap(mov).day === 'd08' && ap(mov).by === 'm' && +ap(mov).t === Date.parse('2026-10-23T01:10:00Z'), JSON.stringify(ap(mov)));
  ok('a PDF and a photo outside the trip folders are left alone', !ap(pdf).trip && !ap(away).trip);
  const adoptAway = await onRequest({ request: new Request(B + '/api/photos/adopt', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', items: [{ id: away, day: 'd07', t: Date.now() }] }) }), env });
  ok('adopt refuses a file outside the trip folders', (await adoptAway.json()).filed === 0 && !ap(away).trip);
  await n.waitForTimeout(800);
  ok('they show in the gallery', !!(await n.$(`.grid .th[data-pid="${heic}"]`)) && !!(await n.$(`.grid .th[data-pid="${mov}"]`)));
  await n.screenshot({ path: OUT + 'drive-filed.png' });
  const again = await onRequest({ request: new Request(B + '/api/photos/inbox', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: '{"trip":"japan"}' }), env });
  ok('nothing left to file afterwards', (await again.json()).items.length === 0);
  ok('the old day folders are emptied into the trip folder and binned', files.get(d7).trashed && files.get(d8).trashed && [heic, mov, oldFiled].every((id) => files.get(id).parents.join() === tripDir && !files.get(id).trashed), JSON.stringify([d7, d8].map((id) => files.get(id))));
  // someone bins the trip folder itself in Drive: the site makes a fresh one rather than uploading into the bin
  files.get(tripDir).trashed = true; env.FOLDER_CHECK_MS = 0;
  const fr = await onRequest({ request: new Request(B + '/api/photos/folder', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: '{"trip":"japan"}' }), env });
  const newTrip = fid(/^Japan 2026$/) === tripDir ? [...files.values()].find((f) => f.name === 'Japan 2026' && f.mimeType === FOLDER && !f.trashed) : null;
  ok('a binned trip folder is replaced by a fresh one', newTrip && newTrip.id !== tripDir && newTrip.parents.join() === fid(/^Our Trips$/) && (await fr.json()).url.endsWith(newTrip.id), newTrip && newTrip.id);
  delete env.FOLDER_CHECK_MS;
  const upd = await onRequest({ request: new Request(B + '/api/photos/update', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', ids: [away, pdf], set: { hidden: true } }) }), env });
  ok('changes to files that aren\'t trip photos are refused', upd.status === 400 && !ap(away).hidden && !ap(pdf).hidden);
  const before = kv.get('gdrive'); aboutUser = null;
  await n.goto(B + '/api/photos/connect?k=6666'); await n.waitForTimeout(800);
  ok('a reconnect Google won\'t name the account of is refused', /didn't say which account/.test(await n.textContent('body')) && kv.get('gdrive') === before);
  aboutUser = { displayName: 'Naf Test', emailAddress: 'naf@example.com' };
}

// 14 · who's in it: said while uploading, guessed by the sort (Claude counts people, the plan says who was there), checked one by one
{
  const { guessWho, sortRequest, SORT_MODEL } = await import(REPO + '/lib/sort-claude.js');
  const ALL = ['naf', 'sara', 'mariam', 'm'];
  ok('guess: one person at a NASA-only stop, taken by Naf → Sara', guessWho({ people: 1, selfie: false }, ['naf', 'sara'], 'naf').join() === 'sara');
  ok('guess: a selfie of two with all four there, by Mo → Mariam & Mo', guessWho({ people: 2, selfie: true }, ALL, 'm').join() === 'mariam,m');
  ok('guess: three people by Naf with all four there → the other three', guessWho({ people: 3, selfie: false }, ALL, 'naf').join() === 'sara,mariam,m');
  ok('guess: two people (not a selfie) with all four there → no guess', guessWho({ people: 2, selfie: false }, ALL, 'naf').length === 0);
  ok('guess: four or more people → all four', guessWho({ people: 6, selfie: false }, ALL, 'sara').join() === ALL.join());
  ok('guess: a view → no one', guessWho({ people: 0, selfie: false }, ALL, 'naf').length === 0);
  const rb = JSON.parse(sortRequest('k', 'data:image/jpeg;base64,AAAA').body);
  ok('sort: one small Haiku request that never asks who anyone is', rb.model === SORT_MODEL && SORT_MODEL === 'claude-haiku-5-5' && rb.thinking.type === 'disabled' && rb.max_tokens <= 400 && /Don't say who anyone is/.test(rb.messages[0].content[1].text) && rb.output_config.format.schema.required.join() === 'people,selfie,kind,words', JSON.stringify(rb).slice(0, 160));
  ok('sort: off without the Anthropic key', (await (await api('/sort', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', items: [] }) })).json()).off === true);

  const sof = (b) => { for (let i = 2; i < b.length - 9; i++) if (b[i] === 0xff && b[i + 1] >= 0xc0 && b[i + 1] <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; return [0, 0]; };
  const asked = [];
  const claude = http.createServer(async (req, res) => {
    const q = JSON.parse((await body(req)).toString()); const [w, h] = sof(Buffer.from(q.messages[0].content[0].source.data, 'base64')); asked.push({ key: req.headers['x-api-key'], w, h });
    const a = h > w * 1.1 ? { people: 1, selfie: false, kind: 'us', words: ['Gion', 'street'] } : w > h * 1.1 ? { people: 0, selfie: false, kind: 'place', words: ['view', 'temple'] } : { people: 2, selfie: true, kind: 'us', words: ['selfie'] };
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(a) }] }));
  });
  await new Promise((r) => claude.listen(8799, r));
  env.ANTHROPIC_API_KEY = 'sk-test'; env.SORT_API = 'http://localhost:8799/v1/messages';
  const ap = (id) => (files.get(id) || {}).appProperties || {};

  await n.goto(B + '/japan/photos'); await n.waitForTimeout(2500); // the photos from before get sorted on the way in
  const sortedBefore = [...files.values()].filter((f) => f.appProperties && f.appProperties.trip && f.appProperties.ai).length;
  ok('photos from before (and from the Drive app) get sorted when a member opens the page', sortedBefore >= 6 && asked.every((a) => a.key === 'sk-test'), `${sortedBefore} sorted`);
  putDelay = 300;
  await n.tap('[data-upload]'); await n.waitForTimeout(300);
  await n.setInputFiles('#upfiles', ['gion.jpg', 'view.jpg', 'us.jpg'].map((f) => FIX + '/' + f)); await n.waitForTimeout(200);
  ok('upload sheet: a row of faces on each photo, and one for all of them', (await n.$$('.uprow .rw button')).length === 12 && await n.isVisible('.upall [data-rwall="naf"]'));
  await n.tap('.uprow[data-row="2"] [data-rw="naf"]'); await n.tap('.uprow[data-row="2"] [data-rw="sara"]'); // while the first one is still going up
  await waitRows(n, 3); await n.waitForSelector('.uprow[data-row="0"] .rw.g', { timeout: 8000 }).catch(() => {}); putDelay = 0;
  await n.screenshot({ path: OUT + 'upload-who.png' });
  const gion = byName('gion.jpg'), view = byName('view.jpg'), us = byName('us.jpg');
  ok('tagged while uploading: Naf & Sara saved with the photo, as checked', ap(us.id).in === 'naf,sara' && ap(us.id).ck === '1' && !ap(us.id).ig, JSON.stringify(ap(us.id)));
  ok('…and the sort leaves a photo someone tagged alone', !ap(us.id).ai);
  ok('one person at NASA\'s Gion stop, uploaded by Naf → guessed Sara', ap(gion.id).in === 'sara' && ap(gion.id).ig === '1' && ap(gion.id).ai === 'us' && ap(gion.id).np === '1' && /gion/.test(ap(gion.id).aw), JSON.stringify(ap(gion.id)));
  ok('a view → no one, kind Places, search words', ap(view.id).in === '' && ap(view.id).ai === 'place' && ap(view.id).np === '0' && ap(view.id).aw === 'view temple', JSON.stringify(ap(view.id)));
  ok('the upload row shows the guess, dotted, to fix with a tap', await n.isVisible('.uprow[data-row="0"] .rw.g [data-rw="sara"].on') && /Guessed/.test(await n.textContent('.uprow[data-row="0"]')));
  ok('the sort looked at the phone\'s own small copy (≤ 640 px)', asked.slice(-2).every((a) => Math.max(a.w, a.h) <= 640 && a.w > 0), JSON.stringify(asked.slice(-2)));
  await n.tap('[data-sheetx]'); await n.waitForTimeout(300);

  await n.reload(); await n.waitForTimeout(2500);
  ok('gallery: a guessed tag is dotted', !!(await n.$(`.grid .th[data-pid="${gion.id}"] .faces.g`)) && !(await n.$(`.grid .th[data-pid="${us.id}"] .faces.g`)));
  ok('kind filters appear', await n.isVisible('#what [data-what="place"]') && await n.isVisible('#what [data-what="us"]'));
  await n.tap('#what [data-what="place"]'); await n.waitForTimeout(400);
  const placeIds = await n.$$eval('.grid .th', (els) => els.map((e) => e.dataset.pid));
  ok('Places shows only views and sights', placeIds.includes(view.id) && placeIds.every((id) => ap(id).ai === 'place'), placeIds.length + ' shown');
  await n.screenshot({ path: OUT + 'kind-places.png' });
  await n.tap('#what [data-what="place"]'); await n.fill('#q', 'gion'); await n.waitForTimeout(500);
  ok('search finds the sort\'s words', (await n.$$eval('.grid .th', (els) => els.map((e) => e.dataset.pid))).includes(gion.id));
  await n.fill('#q', ''); await n.waitForTimeout(400);
  // speed: pictures at a steady address (Google's links change with every list), and the gallery opens from the saved list
  const srcOf = () => n.getAttribute(`.grid .th[data-pid="${view.id}"] img`, 'src');
  const src1 = await srcOf(); await n.reload(); await n.waitForTimeout(2500);
  ok('speed: a photo\'s picture keeps the same address from one visit to the next', /^\/api\/photos\/thumb\//.test(src1) && (await srcOf()) === src1, src1);
  await n.route('**/api/photos**', (r) => r.abort()); await n.reload(); await n.waitForTimeout(1500);
  ok('speed: with no signal, the gallery opens from the list saved on the phone', !!(await n.$(`.grid .th[data-pid="${view.id}"]`)) && /saved on this phone/.test(await n.textContent('#toast')), await n.textContent('#toast'));
  await n.screenshot({ path: OUT + 'offline-saved.png' });
  await n.unroute('**/api/photos**'); await n.reload(); await n.waitForTimeout(2500);
  await n.tap(`.grid .th[data-pid="${view.id}"]`); await n.waitForTimeout(700);
  const vb = await n.$('.vw .slide:nth-child(2) .frame').then((f) => f.boundingBox());
  await n.mouse.click(vb.x + vb.width / 2, vb.y + vb.height / 2); await n.mouse.click(vb.x + vb.width / 2, vb.y + vb.height / 2); await n.waitForTimeout(900);
  ok('speed: zooming in swaps in the full-size picture', /s=4000/.test(await n.getAttribute('.vw .slide:nth-child(2) .frame img', 'src')), await n.getAttribute('.vw .slide:nth-child(2) .frame img', 'src'));
  await n.keyboard.press('Escape'); await n.waitForTimeout(700);
  ok('a nudge offers to check who\'s in the rest', await n.isVisible('#nudge [data-check]') && /Who's in these \d+/.test(await n.textContent('#nudge')), await n.textContent('#nudge'));
  await n.screenshot({ path: OUT + 'nudge.png' });
  await n.tap('[data-check]'); await n.waitForTimeout(600);
  const curId = async () => { const src = await n.getAttribute('#tgpic img', 'src').catch(() => ''); return (/thumb\/([\w-]+)[=?]/.exec(src || '') || [])[1]; };
  const first = await curId();
  ok('the check starts with the earliest: the Gion guess, "Looks right"', first === gion.id && /^1 of \d+$/.test(await n.textContent('#tgn')) && (await n.textContent('[data-tgnext]')) === 'Looks right' && /Guessed Sara/.test(await n.textContent('#tghint')), `${first} · ${await n.textContent('#tgn')} · ${await n.textContent('#tghint')}`);
  ok('…people who weren\'t at that stop say so', /wasn't there/.test(await n.textContent('[data-tgp="m"]')));
  await n.screenshot({ path: OUT + 'check-guess.png' });
  await n.tap('[data-tgnext]'); await n.waitForTimeout(500);
  ok('Looks right confirms the guess', ap(gion.id).in === 'sara' && ap(gion.id).ck === '1' && !ap(gion.id).ig, JSON.stringify(ap(gion.id)));
  const second = await curId();
  await n.tap('[data-tgp="mariam"]'); await n.waitForTimeout(150);
  ok('a tap changes it and the button says Next', /^(Next|Done)$/.test(await n.textContent('[data-tgnext]')) && !(await n.$('#tgppl.g')));
  await n.tap('[data-tgnext]'); await n.waitForTimeout(500);
  ok('…saved as checked', second && ap(second).in.split(',').includes('mariam') && ap(second).ck === '1' && !ap(second).ig, JSON.stringify(ap(second)));
  const third = await curId();
  if (third) { await n.tap('[data-tgnone]'); await n.waitForTimeout(500); ok('No one: no tags, and it isn\'t asked again', ap(third).in === '' && ap(third).ck === '1', JSON.stringify(ap(third))); }
  await n.tap('[data-tgx]'); await n.waitForTimeout(400);
  ok('closing the check goes back to the gallery', !(await n.isVisible('#tagr')));
  // the viewer: a guess says so, and "Looks right" confirms it
  const g2 = [...files.values()].find((f) => f.appProperties && f.appProperties.ig === '1' && !f.appProperties.hidden && !f.trashed);
  if (g2) {
    await n.tap(`.grid .th[data-pid="${g2.id}"]`); await n.waitForTimeout(700); await n.tap('#vcapt'); await n.waitForTimeout(600);
    ok('viewer Info: the guess is dotted, with Looks right', await n.isVisible('#vinfo .tagrow.g') && await n.isVisible('#vinfo [data-vsure]'));
    await n.screenshot({ path: OUT + 'viewer-guess.png' });
    await n.tap('#vinfo [data-vsure]'); await n.waitForTimeout(500);
    ok('…which saves it as checked', ap(g2.id).ck === '1' && !ap(g2.id).ig && !(await n.$('#vinfo .tagrow.g')));
    await n.keyboard.press('Escape'); await n.waitForTimeout(500);
  } else ok('a guessed photo is left for the viewer check', false);
  await gp.goto(B + '/japan/photos'); await gp.waitForTimeout(1500);
  ok('guests see no nudge and sort nothing', !(await gp.textContent('#nudge')).trim() && !(await gp.$('#what button.on')));
  claude.close(); delete env.ANTHROPIC_API_KEY; delete env.SORT_API;
}

// 15 · faces: the faces server looks at each photo once; the four's phones learn the four from tagged photos and name
// who's in new ones (no model on any phone)
let M = null;
{
  const F = await import(REPO + '/js/faces.js'); const ap = (id) => (files.get(id) || {}).appProperties || {};
  const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const fr = (x) => x - Math.floor(x);
  const vec = (seed) => unit(Float32Array.from({ length: 512 }, (_, i) => fr(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) - 0.5)); // a face print: 512 numbers, length 1 (two people: ~1.4 apart)
  const near = (v, k) => unit(v.map((x, i) => x + (fr(Math.sin(k * 3.7 + i * 12.345) * 24634.6345) - 0.5) * 0.06)); // the same face in another photo (~0.4)
  const face = (v, w = 0.1) => ({ x: 0.3, y: 0.3, w, h: 0.08, q: F.pack(v) });
  const A = vec(1), Bv = vec(2), C = vec(3);
  const pr = { naf: [A], sara: [Bv] };
  ok('faces: prints survive being stored as whole numbers', Math.abs(F.unpack(F.pack(A))[5] - A[5]) < 0.0015 && F.pack(A).length === 684);
  ok('faces: one person tagged, one face → their print', F.learnFrom([face(C)], ['mariam'], {}).map((x) => x.who).join() === 'mariam');
  ok('faces: a tiny face in the background isn\'t counted', F.learnFrom([face(C), face(A, 0.02)], ['mariam'], {}).length === 1);
  ok('faces: a group photo teaches too: the face it knows, then the last face is the last person',
    F.learnFrom([face(near(A, 3)), face(C)], ['naf', 'mariam'], pr).map((x) => x.who).sort().join() === 'mariam,naf'
    && F.learnFrom([face(A), face(C)], ['naf', 'mariam'], {}).length === 0 // (knowing no one: nothing to go on)
    && F.learnFrom([face(near(Bv, 3)), face(C)], ['naf', 'mariam'], pr).length === 0); // (a face that's Sara, not tagged: the photo teaches nothing)
  ok('faces: a small face isn\'t learned from', F.learnFrom([face(C, 0.05)], ['mariam'], {}).length === 0);
  ok('faces: a face that looks like someone else we know isn\'t learned as the person tagged', F.learnFrom([face(near(A, 4))], ['mariam'], pr).length === 0 && F.learnFrom([face(near(A, 4))], ['naf'], pr).length === 1);
  const fpOdd = { by: { naf: [{ id: 'p1', q: F.pack(A) }, { id: 'p2', q: F.pack(near(A, 2)) }], sara: [{ id: 'p3', q: F.pack(Bv) }, { id: 'p4', q: F.pack(near(Bv, 3)) }, { id: 'p5', q: F.pack(near(A, 5)) }] } };
  ok('faces: a print learned under the wrong name is found', F.suspects(fpOdd).join() === 'p5', F.suspects(fpOdd).join());
  ok('faces: more faces than people tagged → nothing learned', F.learnFrom([face(A), face(C)], ['naf'], pr).length === 0);
  ok('faces: a known face is named, among who was there', F.nameFaces([face(near(Bv, 5))], pr, ['naf', 'sara']).join() === 'sara' && F.nameFaces([face(near(Bv, 5))], pr, ['naf', 'mariam']) === null);
  ok('faces: a face halfway between two people isn\'t named', F.nameFaces([face(A.map((x, i) => (x + Bv[i]) / 2))], pr, ['naf', 'sara']) === null);
  ok('faces: a stranger isn\'t named', F.nameFaces([face(C)], pr, ['naf', 'sara']) === null);
  ok('doubts: tagged Mariam, but the face is surely Naf → "Naf, not Mariam"', JSON.stringify(F.doubts({ f: [face(near(A, 2))], b: [] }, pr, ['mariam'], ['naf', 'sara', 'mariam', 'm'])) === '{"seen":["naf"],"instead":"mariam"}');
  ok('doubts: faces that agree with the tags, or no face it knows → nothing to say', F.doubts({ f: [face(near(A, 2))], b: [] }, pr, ['naf'], ['naf', 'sara', 'mariam', 'm']) === null && F.doubts({ f: [face(C)], b: [] }, pr, ['mariam'], ['naf', 'sara', 'mariam', 'm']) === null);
  // what someone's wearing (28 colour shares), for when their face doesn't settle it
  const dress = (i) => { const h = new Array(28).fill(0); h[i] = 200; h[(i + 1) % 28] = 55; return Buffer.from(h).toString('base64'); };
  const body = (o, fi = -1, h = 0.5) => ({ x: 0.2, y: 0.3, w: 0.3, h, o, fi });
  ok('outfits: the same colours are alike, different ones aren\'t', F.alike(dress(4), dress(4)) > 0.99 && F.alike(dress(4), dress(12)) < 0.2);
  ok('outfits: a tagged photo of one person shows what they wore', F.outfitsIn({ f: [], b: [body(dress(2))] }, pr, ['naf'], true).map((x) => x.who + x.o).join() === 'naf' + dress(2));
  ok('outfits: …and so does a face it recognises', F.outfitsIn({ f: [face(near(A, 2))], b: [body(dress(4), 0)] }, pr, ['naf', 'sara'], false).map((x) => x.who).join() === 'naf');
  ok('outfits: someone whose face doesn\'t show is named by what they wore that day', (F.nameAll({ f: [], b: [body(dress(4))] }, pr, ['naf', 'sara'], [], { naf: [dress(4)], sara: [dress(10)] }) || []).join() === 'naf');
  ok('outfits: two people dressed alike → no name', F.nameAll({ f: [], b: [body(dress(4))] }, pr, ['naf', 'sara'], [], { naf: [dress(4)], sara: [dress(4)] }) === null);
  ok('outfits: a face it recognises wins over the outfit', (F.nameAll({ f: [face(near(Bv, 5))], b: [body(dress(4), 0)] }, pr, ['naf', 'sara'], [], { naf: [dress(4)] }) || []).join() === 'sara');
  ok('outfits: someone half hidden behind another (dressed alike, further back) teaches no outfit', F.outfitsIn({ f: [face(near(A, 2)), face(near(Bv, 3))], b: [{ x: 0.2, y: 0.2, w: 0.3, h: 0.4, o: dress(4), fi: 0 }, { x: 0.3, y: 0.4, w: 0.3, h: 0.55, o: dress(4), fi: 1 }] }, pr, ['naf', 'sara'], false).map((x) => x.who).join() === 'sara');
  ok('outfits: someone small in the background isn\'t named', F.nameAll({ f: [], b: [body(dress(4), -1, 0.12)] }, pr, ['naf', 'sara'], [], { naf: [dress(4)] }) === null);
  ok('faces: one known of two faces keeps an earlier guess that fits', F.nameFaces([face(near(A, 2)), face(C)], pr, ['naf', 'sara', 'mariam'], ['mariam']).join() === 'naf,mariam' && F.nameFaces([face(near(A, 2)), face(C)], pr, ['naf', 'sara', 'mariam'], ['sara', 'mariam']).join() === 'naf');

  // the server keeps the prints: members only, checked, and dropped when a photo's tags change
  const tok = await n.evaluate(() => localStorage.getItem('trips.photok')), gtok = await gp.evaluate(() => localStorage.getItem('trips.photok'));
  ok('prints: a guest can\'t read them', (await api('/prints', { headers: { 'x-photo-token': gtok } })).status === 403);
  const post = (b, pin = '6666') => api('/prints', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': pin }, body: JSON.stringify(b) });
  ok('prints: saving needs the member PIN', (await post({ add: [] }, '0000')).status === 403);
  await post({ add: [{ who: 'naf', id: 'fileid99999999', q: F.pack(A) }, { who: 'nobody', id: 'fileid99999999', q: F.pack(A) }, { who: 'sara', id: 'fileid99999999', q: '<script>' }], used: ['fileid99999999'] });
  let fp = await (await api('/prints', { headers: { 'x-photo-token': tok } })).json();
  ok('prints: only good ones are kept', fp.by.naf.length === 1 && !fp.by.nobody && !(fp.by.sara || []).length && fp.used.includes('fileid99999999'), JSON.stringify(fp).slice(0, 120));
  await post({ drop: ['fileid99999999'] }); fp = await (await api('/prints', { headers: { 'x-photo-token': tok } })).json();
  ok('prints: dropping a photo takes its prints and lets it be learned again', !fp.by.naf.length && !fp.used.includes('fileid99999999'));

  // the faces server's minute: the photos no one has looked at yet, a few at a time (only with its key)
  const sweep = (k) => onRequest({ request: new Request(B + '/api/photos/sweep', { method: 'POST', headers: { 'content-type': 'application/json', 'x-faces-key': k }, body: '{"trip":"japan"}' }), env });
  ok('sweep: needs the faces server\'s key', (await sweep('nope')).status === 403);
  let sw = null; for (let t = 0; t < 10 && !(sw && sw.left === 0); t++) sw = await (await sweep('faces-key')).json();
  ok('sweep: in a few goes, every photo has been looked at', sw && sw.left === 0 && looksKept.size > 0, JSON.stringify(sw));

  // real faces: the group photo on the trips page, cut up so each of the four has a photo of their own (it isn't in the
  // repo: the copy the deploy fetched, or the live one)
  const GROUP = REPO + '/hub/img/group.webp';
  const groupPic = fs.existsSync(GROUP) ? fs.readFileSync(GROUP) : await fetch('https://ourtrips.date/img/group.webp', { headers: { 'user-agent': 'Mozilla/5.0' } }).then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)).catch(() => null);
  if (!groupPic) { ok('the group photo for the face checks (hub/img/group.webp, or ourtrips.date/img/group.webp)', false); throw new Error('no group photo'); }
  const pg = await browser.newPage();
  const cuts = await pg.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const box = [[372, 666, 122, 101], [680, 755, 113, 96], [791, 622, 100, 85], [667, 478, 86, 80]]; // (where face-api finds them)
    const out = (c) => c.toDataURL('image/jpeg', 0.9).split(',')[1];
    const cut = (i, k, px) => { const [x, y, w, h] = box[i], cx = x + w / 2, cy = y + h / 2, side = w * k; const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); const s = px / side;
      g.drawImage(im, cx - side / 2, cy - side / 2, side, side, 0, 0, px, px); g.fillStyle = '#888';
      box.forEach(([bx, by, bw, bh], j) => { if (j !== i) g.fillRect((bx - bw * 0.3 - (cx - side / 2)) * s, (by - bh * 0.3 - (cy - side / 2)) * s, bw * 1.6 * s, bh * 1.6 * s); }); return out(c); };
    const all = document.createElement('canvas'); all.width = 600; all.height = 800; all.getContext('2d').drawImage(im, 0, 0, 600, 800);
    const nf = document.createElement('canvas'); nf.width = 600; nf.height = 800; const ng = nf.getContext('2d'); ng.drawImage(im, 0, 0, 600, 800); ng.fillStyle = '#777';
    box.forEach(([x, y, w, h]) => { ng.beginPath(); ng.ellipse((x + w / 2) / 2, (y + h / 2) / 2, w * 0.4, h * 0.5, 0, 0, 7); ng.fill(); }); // no faces to see
    return { one: [0, 1, 2, 3].map((i) => cut(i, 3, 360)), again: cut(0, 4.5, 400), all: out(all), noface: out(nf) };
  }, 'data:image/webp;base64,' + groupPic.toString('base64'));
  await pg.close();
  const WHO = ['naf', 'sara', 'mariam', 'm'];
  cuts.one.forEach((b, i) => fs.writeFileSync(FIX + `/face-${WHO[i]}.jpg`, exifOf(Buffer.from(b, 'base64'), `2026:10:22 11:0${i}:00`)));
  fs.writeFileSync(FIX + '/face-again.jpg', exifOf(Buffer.from(cuts.again, 'base64'), '2026:10:22 11:20:00'));
  fs.writeFileSync(FIX + '/group.jpg', exifOf(Buffer.from(cuts.all, 'base64'), '2026:10:22 11:30:00'));
  fs.writeFileSync(FIX + '/noface.jpg', exifOf(Buffer.from(cuts.noface, 'base64'), '2026:10:22 11:40:00'));

  if (!canFaces) console.log('SKIP faces with the real models (run workers/faces/fetch-parts.sh, and set FACES_PY to a Python with onnxruntime, opencv and pillow)');
  else {
  M = await phone('m'); const m = M.pg; const fetched = [];
  const model = /vendor\/(face-api|person)|\.onnx|model\.json|\.bin(\?|$)/;
  m.on('request', (r) => { if (model.test(r.url())) fetched.push(r.url()); });
  n.on('request', (r) => { if (model.test(r.url())) fetched.push('naf:' + r.url()); });
  await m.goto(B + '/japan/photos'); await m.waitForTimeout(1500);
  await m.evaluate(() => localStorage.setItem('japan2026.state.v1', JSON.stringify({ profiles: { m: { color: '#0a7f6e' } } }))); await m.reload(); await m.waitForTimeout(1200);
  const cOf = (sel) => m.$eval(sel, (e) => e.style.getPropertyValue('--c'));
  ok('everyone in their own colour: the one Mo picked, the others the Money page\'s', (await cOf('[data-pp="m"] i')) === '#0a7f6e' && (await cOf('[data-pp="naf"] i')) === '#1f98b8' && (await cOf('[data-pp="mariam"] i')) === '#2f9e57');
  await m.waitForFunction(() => /learns from photos you tag/.test(document.querySelector('#facebox').textContent), null, { timeout: 120000 }).catch(() => {});
  ok('nothing to switch on or download: the server looked at the photos, and it asks for tagged photos', /learns from photos you tag/.test(await m.textContent('#facebox')) && !fetched.length && lookCalls > 0 && !(await m.$('[data-faceson]')), await m.textContent('#facebox'));
  await m.screenshot({ path: OUT + 'faces-offer.png' });
  await m.tap('[data-upload]'); await m.waitForTimeout(300);
  await m.setInputFiles('#upfiles', WHO.map((w) => FIX + `/face-${w}.jpg`));
  for (let i = 0; i < 4; i++) await m.tap(`.uprow[data-row="${i}"] [data-rw="${WHO[i]}"]`);
  await waitRows(m, 4);
  const learned = () => { const f = JSON.parse(kv.get('faceprints') || '{"by":{}}'); return WHO.filter((w) => (f.by[w] || []).length); };
  for (let t = 0; t < 120 && learned().length < 4; t++) await m.waitForTimeout(1000);
  ok('it learns one face print for each of the four from their own tagged photo', learned().length === 4 && WHO.every((w) => JSON.parse(kv.get('faceprints')).by[w].length === 1), learned().join());
  await m.waitForFunction(() => /Recognises/.test(document.querySelector('#facebox').textContent), null, { timeout: 30000 }).catch(() => {});
  ok('…and says who it knows', /Recognises Naf, Sara, Mariam & Mo \(from 4 tagged faces\)\./.test(await m.textContent('#facebox')), await m.textContent('#facebox'));
  await m.tap('[data-sheetx]'); await m.waitForTimeout(300);
  await m.tap('[data-upload]'); await m.waitForTimeout(300);
  await m.setInputFiles('#upfiles', [FIX + '/group.jpg', FIX + '/face-again.jpg']);
  await waitRows(m, 6);
  await m.waitForFunction(() => document.querySelectorAll('.uprow .rw.g').length >= 2, null, { timeout: 120000 }).catch(() => {});
  await m.waitForTimeout(800); await m.$eval('.uprow[data-row="4"]', (e) => e.scrollIntoView({ block: 'center' }));
  await m.screenshot({ path: OUT + 'faces-upload.png' });
  const grp = byName('group.jpg'), again = byName('face-again.jpg');
  ok('a new photo of all four: each face named, as a guess', ap(grp.id).in === 'naf,sara,mariam,m' && ap(grp.id).ig === '1' && ap(grp.id).ck !== '1', JSON.stringify(ap(grp.id)));
  ok('another photo of one of them: just them', ap(again.id).in === 'naf' && ap(again.id).ig === '1', JSON.stringify(ap(again.id)));
  ok('the upload row shows the names dotted, to fix with a tap, in each person\'s colour', await m.isVisible('.uprow[data-row="4"] .rw.g [data-rw="m"].on') && (await cOf('.uprow[data-row="4"] [data-rw="m"]')) === '#0a7f6e' && (await cOf('.uprow[data-row="4"] [data-rw="sara"]')) === '#d26b9c');
  await m.tap('[data-sheetx]'); await m.waitForTimeout(300);
  // the same people later that day with no face to see: named by what they're wearing (learned from the photo above)
  await m.evaluate(() => window.__photos.facePass()); await m.waitForFunction(() => !window.__photos.faceBusy, null, { timeout: 120000 }).catch(() => {});
  await m.tap('[data-upload]'); await m.waitForTimeout(300);
  await m.setInputFiles('#upfiles', [FIX + '/noface.jpg']); await waitRows(m, 7);
  const nof = byName('noface.jpg');
  for (let t = 0; t < 12 && nof && !ap(nof.id).in; t++) { await m.evaluate(() => window.__photos.facePass()); await m.waitForTimeout(5000); } // (named while it went up, or on the next go)
  ok('no faces showing: named by what they wore that day (the three who aren\'t half hidden)', nof && ap(nof.id).in === 'naf,sara,mariam' && ap(nof.id).ig === '1', JSON.stringify(nof && ap(nof.id)));
  await m.screenshot({ path: OUT + 'faces-outfits.png' });
  await m.tap('[data-sheetx]'); await m.waitForTimeout(300);
  await n.reload(); await n.waitForTimeout(2500);
  ok('on Naf\'s phone: the names show (dotted)', !!(await n.$(`.grid .th[data-pid="${grp.id}"] .faces.g`)));
  await m.screenshot({ path: OUT + 'faces-on.png' });
  // a tag changed by hand: that photo's print goes, and it's learned again from the new tags
  await n.evaluate((id) => fetch('/api/photos/update', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', ids: [id], set: { in: ['sara'] } }) }), byName('face-naf.jpg').id);
  await m.reload(); await m.waitForTimeout(1500);
  const relearned = () => { const f = JSON.parse(kv.get('faceprints')); return !f.by.naf.length && (f.by.sara || []).some((x) => x.id === byName('face-naf.jpg').id); };
  for (let t = 0; t < 60 && !relearned(); t++) await m.waitForTimeout(1000);
  const fp2 = JSON.parse(kv.get('faceprints'));
  ok('a photo retagged by hand: its old print is dropped, and it teaches the new name', !fp2.by.naf.length && fp2.by.sara.some((x) => x.id === byName('face-naf.jpg').id), JSON.stringify(Object.fromEntries(Object.entries(fp2.by).map(([k, v]) => [k, v.length]))));
  // the way it learned before: forgotten and learned again, and the names it guessed then taken back
  await n.evaluate((id) => fetch('/api/photos/update', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', ids: [id], set: { in: ['naf'] } }) }), byName('face-naf.jpg').id);
  Object.assign(files.get(grp.id).appProperties, { in: 'mariam', ig: '1', gf: '' });
  kv.set('faceprints', JSON.stringify({ by: { mariam: [{ id: 'fileid99999998', q: F.pack(vec(5)) }] }, used: [] }));
  await m.reload(); await m.waitForTimeout(1500);
  for (let t = 0; t < 60 && !(JSON.parse(kv.get('faceprints')).v === 3 && ap(grp.id).in === 'naf,sara,mariam,m'); t++) await m.waitForTimeout(1000);
  const fp3 = JSON.parse(kv.get('faceprints'));
  ok('learned the old way: forgotten, learned again from photos of one person', fp3.v === 3 && WHO.every((w) => fp3.by[w].length === 1) && !fp3.by.mariam.some((x) => x.id === 'fileid99999998'), JSON.stringify(Object.fromEntries(Object.entries(fp3.by).map(([k, v]) => [k, v.length]))));
  ok('…and its old guess taken back and guessed again', ap(grp.id).in === 'naf,sara,mariam,m' && ap(grp.id).ig === '1' && ap(grp.id).gf === '1', JSON.stringify(ap(grp.id)));
  // tags the faces question: a card, then the same one-by-one check
  const setIn = (id, who) => n.evaluate(([id, who]) => fetch('/api/photos/update', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': '6666' }, body: JSON.stringify({ trip: 'japan', ids: [id], set: { in: who } }) }), [id, who]);
  await setIn(again.id, ['mariam']); await setIn(grp.id, ['naf', 'sara', 'mariam']);
  await m.reload(); await m.waitForSelector('#facebox [data-doubts]', { timeout: 120000 }).catch(() => {});
  ok('a card asks to check the tags a face disagrees with', /Check these 2 tags\?/.test(await m.textContent('#facebox')), await m.textContent('#facebox'));
  await m.screenshot({ path: OUT + 'faces-doubts.png' });
  await m.tap('[data-doubts]'); await m.waitForTimeout(500);
  ok('…it says what it noticed: "Looks like Naf, not Mariam"', /Looks like Naf, not Mariam\./.test(await m.textContent('#tghint')) && (await m.textContent('[data-tgnext]')) === 'Tags are right', await m.textContent('#tghint'));
  await m.screenshot({ path: OUT + 'faces-doubt-check.png' });
  await m.tap('[data-tgp="mariam"]'); await m.tap('[data-tgp="naf"]'); await m.tap('[data-tgnext]'); await m.waitForTimeout(600);
  ok('fixed with a tap each: saved as Naf', ap(again.id).in === 'naf' && ap(again.id).ck === '1', JSON.stringify(ap(again.id)));
  ok('next: "Looks like Mo is in it too"', /Looks like Mo is in it too\./.test(await m.textContent('#tghint')), await m.textContent('#tghint'));
  await m.tap('[data-tgnext]'); await m.waitForTimeout(600);
  ok('"Tags are right" keeps them, and it won\'t ask again', ap(grp.id).in === 'naf,sara,mariam' && ap(grp.id).dk === 'naf,sara,mariam' && !(await m.isVisible('#tagr')) && !(await m.$('#facebox [data-doubts]')), JSON.stringify(ap(grp.id)));
  ok('no phone downloaded a model', !fetched.length, fetched.join());
  }
}

// 16 · turning a photo: a quarter turn a tap in the viewer, saved for everyone; a turned plan photo shows turned on the plan
{
  const ap = (id) => (files.get(id) || {}).appProperties || {};
  const tp = [...files.values()].find((f) => f.data && /^image\//.test(f.mimeType) && f.appProperties && f.appProperties.trip && !f.appProperties.hidden && f.appProperties.stop && !f.trashed && f.name !== 'group.jpg');
  const tok = await n.evaluate(() => localStorage.getItem('trips.photok'));
  await n.goto(B + '/japan/photos'); await n.waitForTimeout(2000);
  await n.tap(`.grid .th[data-pid="${tp.id}"]`); await n.waitForTimeout(800);
  const box = () => n.$eval('#track .slide:nth-child(2) .frame', (f) => [f.offsetWidth, f.offsetHeight]);
  const [w0, h0] = await box();
  ok('viewer: a Turn button for members', await n.isVisible('[data-vrot]'));
  await n.tap('[data-vrot]'); await n.waitForTimeout(300);
  const [w1, h1] = await box();
  ok('one tap: a quarter turn, the frame takes the turned shape', Math.abs(w0 / h0 - h1 / w1) < 0.05 && await n.$eval('#track .slide:nth-child(2) .frame img', (im) => im.classList.contains('q') && getComputedStyle(im).rotate === '90deg'), `${w0}x${h0} → ${w1}x${h1}`);
  await n.screenshot({ path: OUT + 'turned-viewer.png' });
  await n.tap('[data-vrot]'); await n.waitForTimeout(1300);
  ok('taps are saved once they stop: half a turn', ap(tp.id).rot === '180', JSON.stringify(ap(tp.id)));
  await n.tap('[data-vrot]'); await n.waitForTimeout(1300);
  await n.keyboard.press('Escape'); await n.waitForTimeout(500);
  ok('the gallery tile is turned too', await n.$eval(`.grid .th[data-pid="${tp.id}"] img`, (im) => im.classList.contains('q') && im.style.getPropertyValue('--rot') === '270deg'));
  const list = await (await api('?trip=japan', { headers: { 'x-photo-token': tok } })).json();
  ok('the list says how it\'s turned, for every phone', list.photos.find((p) => p.id === tp.id).rot === 270);
  await gp.goto(B + '/japan/photos'); await gp.waitForTimeout(1500);
  ok('a guest sees it turned, and has no Turn button', await gp.$eval(`.grid .th[data-pid="${tp.id}"] img`, (im) => im.style.getPropertyValue('--rot') === '270deg') && !(await gp.isVisible('[data-vrot]')));
  // the plan photo: turned on the trip page too
  const pin = { 'content-type': 'application/json', 'x-trip-pin': '6666' };
  await api('/cover', { method: 'POST', headers: pin, body: JSON.stringify({ stop: ap(tp.id).stop, id: tp.id }) });
  let cv = (await (await api('?trip=japan', { headers: { 'x-photo-token': tok } })).json()).covers;
  ok('made the plan photo: its turn goes with it', cv['~rot'] && cv['~rot'][tp.id] === 270, JSON.stringify(cv));
  await api('/update', { method: 'POST', headers: pin, body: JSON.stringify({ trip: 'japan', ids: [tp.id], set: { rot: 90 } }) });
  cv = (await (await api('?trip=japan', { headers: { 'x-photo-token': tok } })).json()).covers;
  ok('turned again: the plan photo follows', cv['~rot'][tp.id] === 90 && ap(tp.id).rot === '90');
  await n.goto(B + `/japan/?d=${ap(tp.id).day}`); await n.waitForTimeout(2500);
  ok('the trip page draws the plan photo turned', await n.$eval(`.hero[data-pick="${ap(tp.id).stop}"]`, (h) => h.classList.contains('turned') && !!h.querySelector('.hturn.q')).catch(() => false));
  await api('/update', { method: 'POST', headers: pin, body: JSON.stringify({ trip: 'japan', ids: [tp.id], set: { rot: 0 } }) });
  await api('/cover', { method: 'POST', headers: pin, body: JSON.stringify({ stop: ap(tp.id).stop, id: null }) });
  cv = (await (await api('?trip=japan', { headers: { 'x-photo-token': tok } })).json()).covers;
  ok('turned back and unpicked: nothing left over', ap(tp.id).rot === '' && !Object.keys(cv['~rot'] || {}).length, JSON.stringify(cv));
}

for (const [k, x] of [['naf', N], ['guest', Gst], ['sara', S], ['mo', M]].filter(([, x]) => x)) ok(`no page errors (${k})`, !x.errs.length, x.errs.join(' | '));
console.log(fails ? `\n${fails} failed` : '\nall photo checks passed');
await browser.close(); site.close(); google.close(); if (faceBox) faceBox.kill(); fs.rmSync(FIX, { recursive: true, force: true });
process.exitCode = fails ? 1 : 0;
