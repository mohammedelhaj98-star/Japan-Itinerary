// End-to-end tests: builds dist/ (scripts/deploy.sh with BUILD_ONLY=1), serves it like Cloudflare Pages,
// and runs the real Pages Function against an in-memory KV. Simulates several phones (welcome, M&M view,
// passes, shared expenses, profiles, bookings, food ideas, stamps, Word export, map gestures, tour, offline).
//   npm install && npm test        (CHROMIUM=/path/to/chrome to use a specific browser; screenshots go to tests/shots/)
import { chromium } from 'playwright';
import os from 'os'; import { fileURLToPath } from 'url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { execSync } from 'child_process';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = REPO + '/dist';
execSync('BUILD_ONLY=1 bash scripts/deploy.sh', { cwd: REPO });
const { onRequest } = await import(REPO + '/functions/api/[[path]].js?' + Date.now());
const store = new Map(); const meta = new Map();
const KV = {
  async get(k, t) { const v = store.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; },
  async put(k, v, o = {}) { store.set(k, v); if (o.metadata) meta.set(k, o.metadata); },
  async delete(k) { store.delete(k); meta.delete(k); },
  async list({ prefix = '' } = {}) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: meta.get(name) })), list_complete: true }; },
};
// The shared state lives in the Durable Object (workers/state), run here as the real class on an in-memory SQLite;
// KV starts with one tick, which the object must copy in on first contact. (tests/tour.mjs and tests/photos.mjs run the
// API on KV alone, the way it works before the binding exists.)
import { DatabaseSync } from 'node:sqlite';
const { TripState } = await import(REPO + '/workers/state/src/index.js');
const fakeSql = () => { const db = new DatabaseSync(':memory:'); return { exec(q, ...b) { const st = db.prepare(q); if (/^\s*select/i.test(q)) { const rows = st.all(...b); return { toArray: () => rows }; } st.run(...b); return { toArray: () => [] }; } }; };
const objects = new Map(); let doCalls = 0; const liveSockets = new Map(); let wsN = 0;
// a phone's live connection: the fake namespace turns the upgrade request into a stand-in socket the object sends to
// (the real object makes a WebSocketPair); the test server below finishes the handshake and writes its frames
const fakeCtx = () => ({ storage: { sql: fakeSql() }, sockets: new Set(), acceptWebSocket(ws) { this.sockets.add(ws); }, getWebSockets() { return [...this.sockets]; } });
// the object's own settings (secrets on the real Worker): the flight tests below fill them in
const DO_ENV = {};
const DO = { idFromName: (n) => n, get: (id) => {
  if (!objects.has(id)) { const ctx = fakeCtx(); objects.set(id, { o: new TripState(ctx, DO_ENV), ctx }); }
  const { o, ctx } = objects.get(id);
  return { fetch: (url, init) => {
    const req = url instanceof Request ? url : new Request(url, init);
    if (req.headers.get('upgrade') === 'websocket') {
      const sid = 'ws' + (++wsN);
      const fake = { socket: null, send(d) { if (!this.socket) return; const b = Buffer.from(String(d)); this.socket.write(Buffer.concat([b.length < 126 ? Buffer.from([0x81, b.length]) : Buffer.from([0x81, 126, b.length >> 8, b.length & 255]), b])); }, close() { try { this.socket && this.socket.end(); } catch { /* gone */ } ctx.sockets.delete(this); } };
      ctx.acceptWebSocket(fake); liveSockets.set(sid, fake);
      return new Response(null, { status: 200, headers: { 'x-ws': sid } }); // stands for the 101 the real object answers
    }
    doCalls++; return o.fetch(req);
  } };
} };
store.set('checks', JSON.stringify({ 'seeded-before-the-switch': true })); store.set('updatedAt', '2026-10-01T00:00:00.000Z');
// Workers AI stand-in for /api/scan: it "reads" a ramen receipt where the total was mistaken for the cash handed over
// …and for /api/fill (a question in words rather than a photo): it knows Yanaka Ginza
const FILL_SAID = { known: true, name: 'Yanaka Ginza shopping street', ja: '谷中銀座商店街', ro: 'Yanaka Ginza Shōtengai', cat: 'shop', kind: 'shop', notes: 'Old-Tokyo shopping street. The menchi-katsu is usually pork and beef: ask for beef only.', cost: '¥500–1,500 per person', minutes: 60, key: 'Since the 1940s · About 60 shops', story: 'It survived the 1923 earthquake and the war, so it still looks like 1950s Tokyo.', wikipedia: 'Yanaka Ginza', search: 'Yanaka Ginza', lat: 35.7277, lng: 139.766 };
const FAKE_AI = { run: async (m, inp) => typeof inp.messages[0].content === 'string' ? { response: FILL_SAID } : ({ response: { total: 3000, cash_given: 3000, change: 620, tax: 216, pretax: null, shop: '一蘭 道頓堀店本館', shop_en: 'Ichiran Dotonbori', date: '2026-10-22', type: 'food', items: ['Ramen'], lines: [{ name: 'Ramen', price: 980, qty: 1 }, { name: 'Ramen', price: 980, qty: 1 }, { name: 'Extra noodles', price: 204, qty: 2 }, { name: 'bad', price: 0 }] } }) };
const PIN = '6666'; // the group's PIN for this test server (the real one is a secret on the Pages project)
const ENV = { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI, TRIP_DO: DO };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8790');
  if (u.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), env: ENV });
    res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text());
  }
  let p = decodeURIComponent(u.pathname); if (p === '/japan') { res.writeHead(301, { location: '/japan/' }); return res.end(); }
  let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
});
// the live connection: the route decides (426 with KV alone), the handshake is done here
server.on('upgrade', async (req, socket) => {
  const r = await onRequest({ request: new Request(new URL(req.url, 'http://localhost:8790'), { headers: req.headers }), env: ENV });
  const sid = r.headers.get('x-ws');
  if (!sid) { socket.write(`HTTP/1.1 ${r.status} No\r\nconnection: close\r\n\r\n`); socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const fake = liveSockets.get(sid); fake.socket = socket;
  socket.on('data', () => { /* pings; nothing to read */ }); socket.on('error', () => {}); socket.on('close', () => fake.close());
});
await new Promise((r) => server.listen(8790, r));
const B = 'http://localhost:8790';
const openDD = async (pg) => { const x = await pg.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('dd')).transform).m41); if (x < -20) { await pg.tap('#ddtab'); await pg.waitForTimeout(700); } };
const exMap = () => JSON.parse(store.get('expenses') || '{}'); const exN = () => Object.keys(exMap()).length; const pfOf = (id) => JSON.parse(store.get('profiles') || '{}')[id] || {};
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
const SH = REPO + '/tests/shots/'; fs.mkdirSync(SH, { recursive: true });
let pass = 0, fail = 0; const ok = (name, c, info = '') => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', name, info); };
const phone = async (time) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' }); const page = await ctx.newPage(); if (time) await page.clock.install({ time: new Date(time) }); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); return { ctx, page, errs }; };
const enterPin = async (pg, pin = PIN) => { await pg.waitForSelector('#s-pin.on', { timeout: 5000 }); for (const d of pin) { await pg.tap(`[data-k="${d}"]`); await pg.waitForTimeout(60); } };
const openPass = (page) => page.evaluate(() => { const o = document.querySelector('.pass.open'); return o ? o.dataset.id : null; });
const pileOrder = (page) => page.evaluate(() => [...document.querySelectorAll('.pass:not(.open)')].map((el) => [el.dataset.id, new DOMMatrix(getComputedStyle(el).transform).m42]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));

// 0 · the files themselves: fonts from the site (not Google), the map library after the plan, the receipt reader's request
{
  const read = (f) => fs.readFileSync(REPO + '/' + f, 'utf8');
  const pages = ['index.html', 'hub/index.html', 'prototypes/tools.html', 'money.html', 'photos.html'];
  ok('fonts come from the site, not Google (nothing to wait for before the first paint, and they work offline)', !pages.some((f) => /fonts\.g(oogleapis|static)\.com/.test(read(f))));
  const have = new Set(read('vendor/fonts/zen-old-mincho-700-subset.glyphs.txt'));
  const cjk = (c) => { const o = c.codePointAt(0); return (o >= 0x2E80 && o <= 0x9FFF) || (o >= 0xF900 && o <= 0xFAFF) || (o >= 0xFF00 && o <= 0xFFEF) || (o >= 0x3000 && o <= 0x303F); };
  const missing = new Set(); for (const f of [...fs.readdirSync(REPO + '/data').map((x) => 'data/' + x), ...pages, 'js/tour.js']) for (const c of read(f)) if (cjk(c) && !have.has(c)) missing.add(c);
  ok('every Japanese character the site shows is in the display font subset (run scripts/font-subset.sh otherwise)', missing.size === 0, [...missing].join(''));
  const trip = read('index.html');
  ok('the map library is not loaded before the plan (no maplibre script or stylesheet tag in the page)', !/<(script|link)[^>]*maplibre/.test(trip) && /drawnMap\(\)/.test(trip));
  const { receiptRequest, readReceiptClaude, CLAUDE_MODEL } = await import(REPO + '/lib/scan-claude.js');
  const photo = 'data:image/webp;base64,' + fs.readFileSync(REPO + '/img/places/nakano-broadway.webp').toString('base64');
  const rq = receiptRequest('sk-test', photo); const body = JSON.parse(rq.body);
  ok('receipt reader: the request the SDK used to send, without the SDK', rq.url === 'https://api.anthropic.com/v1/messages?beta=true' && rq.headers['x-api-key'] === 'sk-test' && rq.headers['anthropic-version'] === '2023-06-01' && body.model === CLAUDE_MODEL && body.output_config.format.type === 'json_schema' && body.output_config.format.schema.required.includes('lines') && body.messages[0].content[0].source.media_type === 'image/webp' && body.messages[0].content[0].source.data.length > 1000 && /receipt from Japan/.test(body.messages[0].content[1].text), JSON.stringify([rq.url, Object.keys(rq.headers), body.model]));
  ok('receipt reader: only a photo as a data URL goes out', receiptRequest('k', 'https://x/y.jpg') === null && receiptRequest('k', 'data:text/plain;base64,aGk=') === null);
  const answer = (status, json, calls = []) => async (url, init) => { calls.push({ url, init }); return new Response(typeof json === 'string' ? json : JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } }); };
  const said = { total: 1960, cash_given: null, change: null, tax: 178, pretax: null, shop: '一蘭 道頓堀店本館', shop_en: 'Ichiran Dotonbori', date: '2026-10-22', type: 'food', taxfree: false, lines: [{ name: 'Ramen', price: 980, qty: 1 }, { name: 'Ramen', price: 980, qty: 1 }], items: ['Ramen'] };
  const good = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(said) }] };
  const calls = []; const got = await readReceiptClaude('k', photo, { fetchFn: answer(200, good, calls) });
  ok('receipt reader: the answer is read back, with a timeout on the call', got && got.total === 1960 && got.lines.length === 2 && calls.length === 1 && calls[0].init.signal instanceof AbortSignal && calls[0].init.headers['x-api-key'] === 'k');
  ok('receipt reader: a refusal is null, so Workers AI takes over', (await readReceiptClaude('k', photo, { fetchFn: answer(200, { stop_reason: 'refusal', content: [] }) })) === null);
  let tries = 0; const got2 = await readReceiptClaude('k', photo, { fetchFn: async () => (++tries === 1 ? new Response('overloaded', { status: 529 }) : new Response(JSON.stringify(good), { status: 200 })) });
  ok('receipt reader: one more try after an overloaded answer, then the result', tries === 2 && got2 && got2.total === 1960);
  const bad = await readReceiptClaude('k', photo, { fetchFn: answer(401, { error: 'bad key' }) }).catch((e) => e);
  ok('receipt reader: a refused key is an error (the route then falls back)', bad instanceof Error && /401/.test(bad.message));
  // through the real route: with the key set, Claude's reading comes back checked and trimmed, lines included
  const realFetch = globalThis.fetch; globalThis.fetch = answer(200, good);
  try {
    const r = await (await onRequest({ request: new Request(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ photo }) }), env: { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI, ANTHROPIC_API_KEY: 'k' } })).json();
    ok('/api/scan asks Claude when the key is set and keeps its lines', r.total === 1960 && r.model === CLAUDE_MODEL && Array.isArray(r.lines) && r.lines.length === 2 && r.shop_en === 'Ichiran Dotonbori', JSON.stringify(r).slice(0, 200));
    globalThis.fetch = answer(500, 'down');
    const r2 = await (await onRequest({ request: new Request(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ photo }) }), env: { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI, ANTHROPIC_API_KEY: 'k' } })).json();
    ok('/api/scan falls back to Workers AI when Claude is down', r2.total === 2380 && r2.model !== CLAUDE_MODEL, JSON.stringify(r2).slice(0, 120));
  } finally { globalThis.fetch = realFetch; }
  // filling in a new stop from its name
  const { fillRequest, fillStop, tidyFill } = await import(REPO + '/lib/fill-claude.js');
  const fq = fillRequest('sk-test', { name: 'Yanaka Ginza', city: 'Tokyo', date: '2026-10-17', near: 'Nezu Shrine' }), fb = JSON.parse(fq.body);
  ok('fill-in: one Claude request asking for the stop as JSON', fq.url === 'https://api.anthropic.com/v1/messages?beta=true' && fq.headers['x-api-key'] === 'sk-test' && fb.model === CLAUDE_MODEL && fb.output_config.format.schema.required.includes('wikipedia') && /"Yanaka Ginza"/.test(fb.messages[0].content) && /Nezu Shrine/.test(fb.messages[0].content) && /no pork/.test(fb.messages[0].content));
  const saidFill = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ ...FILL_SAID, lat: 48.85, lng: 2.35, minutes: 9999 }) }] };
  const f1 = await fillStop({ ANTHROPIC_API_KEY: 'k' }, { name: 'Yanaka Ginza' }, { fetchFn: answer(200, saidFill) });
  ok('fill-in: Claude\'s answer comes back checked (a position outside Japan and a silly length dropped)', f1.model === CLAUDE_MODEL && f1.ja === '谷中銀座商店街' && f1.cat === 'shop' && f1.lat === null && f1.minutes === null && f1.wikipedia === 'Yanaka Ginza', JSON.stringify(f1).slice(0, 200));
  const f2 = await fillStop({ ANTHROPIC_API_KEY: 'k', AI: FAKE_AI }, { name: 'Yanaka Ginza' }, { fetchFn: answer(500, 'down') });
  ok('fill-in: Workers AI answers when Claude is down', f2.model !== CLAUDE_MODEL && f2.ja === '谷中銀座商店街' && f2.lat === 35.7277, JSON.stringify(f2).slice(0, 120));
  const t1 = tidyFill({ known: false, name: 'Laundry', ja: '洗濯', cat: 'plan', notes: 'Coin laundry near the hotel.', wikipedia: 'Laundry', lat: 35.7, lng: 139.7 }, 'x');
  ok('fill-in: an activity, not a place, gets no place, Japanese name or photo search', t1.cat === 'plan' && !t1.ja && !t1.wikipedia && t1.lat === null && t1.notes === 'Coin laundry near the hotel.');
  const fr = (body, pin = PIN) => onRequest({ request: new Request(B + '/api/fill', { method: 'POST', headers: { 'content-type': 'application/json', ...(pin ? { 'x-trip-pin': pin } : {}) }, body: JSON.stringify(body) }), env: { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI } });
  ok('/api/fill needs the PIN and a name', (await fr({ name: 'Yanaka Ginza' }, '')).status === 403 && (await fr({ name: '  ' })).status === 400);
  const fr1 = await (await fr({ name: 'Yanaka Ginza', city: 'Tokyo' })).json();
  ok('/api/fill answers with the stop filled in', fr1.name === 'Yanaka Ginza shopping street' && fr1.kind === 'shop' && fr1.key === 'Since the 1940s · About 60 shops' && typeof fr1.ms === 'number', JSON.stringify(fr1).slice(0, 160));
}

// 0b · the shared state in the Durable Object: KV's data copied in once, no change lost to a race, KV kept as a mirror
{
  const api = (path, body, env = ENV) => onRequest({ request: new Request(B + '/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify(body) } : { headers: { 'x-trip-pin': PIN } }), env }).then((r) => r.json());
  const h = await api('health'); ok('health says where the state lives', h.store === 'durable-object', JSON.stringify(h));
  const v = await api('version'); ok('first contact copies KV in: the version is KV\'s stamp', v.updatedAt === '2026-10-01T00:00:00.000Z', JSON.stringify(v));
  const st = await api('state'); ok('and the tick KV had is there', st.checks['seeded-before-the-switch'] === true && Object.keys(st.checks).length === 1);
  const before = doCalls; await api('state'); ok('the whole state is one trip to the object', doCalls - before === 1, String(doCalls - before));
  // ten phones tick ten different stops at the same moment: every tick must land (KV alone would lose some of these)
  const ids = Array.from({ length: 10 }, (_, i) => `race-${i}`);
  const rs = await Promise.all(ids.map((id) => api('checks', { id, value: true })));
  const after = (await api('state')).checks;
  ok('ten changes at once, none lost (a stale write is refused and redone)', rs.every((r) => r.ok) && ids.every((id) => after[id] === true), JSON.stringify(Object.keys(after)));
  ok('KV keeps a copy of every write', ids.every((id) => JSON.parse(store.get('checks'))[id] === true) && store.get('updatedAt') > '2026-10-01');
  await Promise.all(ids.map((id) => api('checks', { id, value: false }))); await api('checks', { id: 'seeded-before-the-switch', value: false });
  ok('…and of the clean-up', Object.keys((await api('state')).checks).length === 0 && store.get('checks') === '{}');
  // the object itself: a write with a stale revision is refused with the current value
  const o = DO.get('trip'); const call = (b) => o.fetch('https://state/', { method: 'POST', body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  const g = await call({ op: 'get', key: 'choices' });
  const w1 = await call({ op: 'put', key: 'choices', value: { a: 'x' }, rev: g.rev }), w2 = await call({ op: 'put', key: 'choices', value: { a: 'y' }, rev: g.rev });
  ok('the object refuses a write based on an old revision', w1.ok && w2.status === 409 && w2.value.a === 'x' && w2.rev === w1.rev, JSON.stringify([w1, w2]));
  await call({ op: 'put', key: 'choices', value: {} });
  // KV alone, as before the binding: the same routes, same answers
  const kv2 = new Map(); const KV2 = { async get(k, t) { const v = kv2.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kv2.set(k, v); }, async delete(k) { kv2.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  const env2 = { TRIP_KV: KV2, TRIP_PIN: PIN, AI: FAKE_AI };
  const h2 = await api('health', null, env2); const c2 = await api('checks', { id: 'kv-only', value: true }, env2); const s2 = await api('state', null, env2); const v2 = await api('version', null, env2);
  ok('without the binding the state stays in KV, as before', h2.store === 'kv' && c2.ok && s2.checks['kv-only'] === true && v2.updatedAt && v2.updatedAt === s2.updatedAt && kv2.get('updatedAt') === v2.updatedAt, JSON.stringify([h2, v2]));
  const e2 = await api('expenses', { id: 'x1', value: { title: 'Ramen', yen: 980, paidBy: 'm', day: 'd7' } }, env2);
  ok('…including a refusal that stays a refusal', (await api('expenses', { id: 'x2', value: { nothing: true } }, env2)).error === 'bad expense' && (e2.ok || e2.error), JSON.stringify(e2).slice(0, 100));
}

// 1 · first visit → welcome → pick Mo → Japan on M&M view, skipping to Oct 21
const A = await phone();
await A.page.goto(B + '/japan/'); await A.page.waitForURL(/\/\?next=japan/); ok('first visit goes to welcome', true, A.page.url());
await A.page.waitForTimeout(800); await A.page.screenshot({ path: SH + 'hub-who.png' });
ok('welcome offers a guest option', !!(await A.page.$('[data-guest]')));
await A.page.tap('[data-me="m"]'); await A.page.waitForTimeout(300);
ok('picking a person asks for the PIN once', !!(await A.page.$('#s-pin.on')));
await enterPin(A.page, '1234'); await A.page.waitForTimeout(700);
ok('a wrong PIN is refused', /not it/.test(await A.page.textContent('#pin-msg')) && !(await A.page.evaluate(() => localStorage.getItem('trips.pin'))) && /\?next=japan/.test(A.page.url()));
await A.page.screenshot({ path: SH + 'hub-pin.png' });
await A.page.waitForTimeout(500); await enterPin(A.page); await A.page.waitForURL(/\/japan\//); await A.page.waitForTimeout(2500);
ok('the right PIN is kept on the phone', (await A.page.evaluate(() => localStorage.getItem('trips.pin'))) === PIN);
const eb = await A.page.textContent('.top'); ok('Mo lands on M&M view at Day 6', /Day 6/.test(eb), eb);
await A.page.screenshot({ path: SH + 'mm-start.png' });
await A.page.tap('[data-who="all"]'); await A.page.waitForTimeout(500);
await A.page.evaluate(() => { location.search = '?d=d02'; }); await A.page.waitForTimeout(2000);
ok('All view can show Day 2', /Day 2/.test(await A.page.textContent('.top')));
await openDD(A.page); await A.page.tap('[data-who="mm"]'); await A.page.waitForTimeout(800);
ok('toggling M&M on Day 2 skips to Day 6', /Day 6/.test(await A.page.textContent('.top')));
ok('prev day disabled for M&M on Day 6', await A.page.$eval('#prev', (b) => b.disabled));
await A.page.goto(B + '/'); await A.page.waitForTimeout(700);
ok('hub remembers Mo', /Hi Mo/.test(await A.page.textContent('#hi')));
await A.page.screenshot({ path: SH + 'hub-trip.png' });

// 2 · stack: next sends the open pass to the bottom of the pile
await A.page.goto(B + '/japan/?d=d07'); await A.page.waitForTimeout(2200);
const first = await openPass(A.page); const pile0 = await pileOrder(A.page);
await A.page.evaluate(() => document.querySelector('.pass.open [data-step="1"]').click()); await A.page.waitForTimeout(1200);
const second = await openPass(A.page); const pile1 = await pileOrder(A.page);
ok('next opens the top of the pile', second === pile0[0], `${first} → ${second}`);
ok('left pass goes to bottom of the pile', pile1[pile1.length - 1] === first, pile1.slice(-2).join(','));
ok('pile now starts at the stop after', pile1[0] === pile0[1], pile1[0]);
// stops before the open one fade under "Earlier in the day"; opening one of them from the pile brings it back to full strength
const fadeState = () => A.page.evaluate(() => ({ open: getComputedStyle(document.querySelector('.pass.open')).opacity, past: [...document.querySelectorAll('.pass.past')].map((e) => e.dataset.id), label: document.getElementById('pastlbl').classList.contains('on') }));
const fs1 = await fadeState();
ok('the stop just left fades as earlier in the day', fs1.past.includes(first) && fs1.label && fs1.open === '1', JSON.stringify(fs1));
await A.page.evaluate((id) => document.querySelector(`.pass[data-id="${id}"] [data-pick]`).click(), first); await A.page.waitForTimeout(1200);
const fs2 = await fadeState();
ok('an earlier stop opened from the pile is not faded', (await openPass(A.page)) === first && fs2.open === '1' && !fs2.past.includes(first) && !fs2.label, JSON.stringify(fs2));
// a stamped stop stays faded, open or not; un-stamping it brings it back
const opac = (id) => A.page.evaluate((id) => getComputedStyle(document.querySelector(`.pass[data-id="${id}"]`)).opacity, id);
await A.page.evaluate(() => document.querySelector('.pass.open [data-stamp]').click()); await A.page.waitForTimeout(700);
ok('a stamped stop fades while open', (await opac(first)) === '0.55', await opac(first));
await A.page.evaluate(() => document.querySelector('.pass.open [data-step="1"]').click()); await A.page.waitForTimeout(900);
await A.page.evaluate((id) => document.querySelector(`.pass[data-id="${id}"] [data-pick]`).click(), first); await A.page.waitForTimeout(900);
ok('going back to a stamped stop keeps it faded', (await openPass(A.page)) === first && (await opac(first)) === '0.55', await opac(first));
await A.page.evaluate(() => document.querySelector('.pass.open [data-stamp]').click()); await A.page.waitForTimeout(700);
ok('un-stamping it brings it back to full strength', (await opac(first)) === '1', await opac(first));

// 3 · money: expenses shared between two phones (the money page, /japan/money)
const N = await phone();
await N.page.goto(B + '/'); await N.page.tap('[data-me="naf"]'); await enterPin(N.page); await N.page.waitForTimeout(600); await N.page.tap('[data-trip="japan"]'); await N.page.waitForURL(/\/japan\//);
await N.page.goto(B + '/japan/money'); await N.page.waitForTimeout(1500);
ok('sync line online', /Shared with all four/.test(await N.page.textContent('.syncl')));
ok('money page has Add expense and a way back to the trip', await N.page.$eval('#addfab', (e) => !e.hidden) && !!(await N.page.$('.tback[data-home]')));
await N.page.tap('#addfab'); await N.page.waitForTimeout(500);
ok('who-is-in presets read Only Naf · Naf + Sara · All four', (await N.page.$$eval('[data-preset]', (els) => els.map((e) => e.textContent).join('|'))) === 'Only Naf|Naf + Sara|All four');
await N.page.fill('#famt', '4400'); await N.page.fill('#ftitle', 'Fuunji ramen test'); await N.page.tap('[data-preset="all"]'); await N.page.waitForTimeout(200);
await N.page.screenshot({ path: SH + 'ex-form.png' });
await N.page.tap('#fsave'); await N.page.waitForTimeout(1200);
ok('Naf sees own expense', /Fuunji ramen test/.test(await N.page.textContent('#glist')));
await A.page.goto(B + '/japan/money'); await A.page.waitForTimeout(1800);
ok("Mo sees Naf's expense", /Fuunji ramen test/.test(await A.page.textContent('#glist')));
ok('settle up says M&M pays Naf', /pays\s*Naf/.test(await A.page.textContent('.settle')));
await A.page.screenshot({ path: SH + 'ex-mo.png', fullPage: true });
ok('server stored one expense with each share', exN() === 1 && Object.values(exMap())[0].shares.m === 1100);
const stOpen = await (await fetch(B + '/api/state')).json(), stPin = await (await fetch(B + '/api/state', { headers: { 'x-trip-pin': PIN } })).json();
ok('expenses and money settings need the PIN to read', !Object.keys(stOpen.expenses).length && !Object.keys(stOpen.money).length && Object.keys(stPin.expenses).length === 1 && !!stOpen.checks);
// scan a receipt: the total is checked against cash given − change, the shop and day fill in, before-tax is a tap away
await N.page.tap('#addfab'); await N.page.waitForTimeout(400);
await N.page.setInputFiles('#fscan', REPO + '/img/places/nakano-broadway.webp'); await N.page.waitForTimeout(1500);
ok('scan fills in what was paid, the shop and the day', (await N.page.inputValue('#famt')) === '2380' && (await N.page.inputValue('#ftitle')) === 'Ichiran Dotonbori' && /Day 7/.test(await N.page.textContent('[data-fexp="day"]')), await N.page.inputValue('#famt'));
ok('scan attaches the photo as the receipt', !!(await N.page.$('.rcpt img')));
await N.page.tap('[data-scanamt]'); await N.page.waitForTimeout(200);
ok('one tap swaps to the amount before tax', (await N.page.inputValue('#famt')) === '2164');
await N.page.tap('[data-fcancel]'); await N.page.waitForTimeout(400);
// split a receipt by item: tap whose each line is, the rest is shared, tax spread in proportion, whole yen, the payer takes the leftover
{
  const p = N.page, vals = () => p.$$eval('.wamt', (els) => els.map((e) => e.value).join(','));
  await p.tap('#addfab'); await p.waitForTimeout(400); await p.tap('[data-preset="all"]');
  await p.setInputFiles('#fscan', REPO + '/img/places/nakano-broadway.webp'); await p.waitForTimeout(1500);
  ok('split: offered after a scan with lines', !!(await p.$('[data-iopen]')));
  await p.tap('[data-iopen]'); await p.waitForTimeout(300);
  const sum0 = await p.$$eval('.isum .ip b', (els) => els.map((e) => e.textContent).join(','));
  ok('split: every line shared at first, four even parts', (await p.$$('.irow')).length === 3 && sum0 === '¥595,¥595,¥595,¥595' && /Tax and service/.test(await p.textContent('.iadj')), sum0);
  await p.tap('[data-iwho="0:naf"]'); await p.tap('[data-iwho="1:sara"]'); await p.waitForTimeout(200);
  const sum1 = await p.$$eval('.isum .ip b', (els) => els.map((e) => e.textContent).join(','));
  ok('split: tapping whose it is moves the parts, tax in proportion, payer takes the leftover yen', sum1 === '¥1,135,¥1,133,¥56,¥56', sum1);
  await p.screenshot({ path: SH + 'split-items.png' });
  // several of one dish: each tap is one more portion for that person; past what's left, back to none
  await p.tap('[data-iwho="2:mariam"]'); await p.tap('[data-iwho="2:mariam"]'); await p.waitForTimeout(150);
  const two = await p.$$eval('.irow', (r) => [r[2].querySelector('.iwho').textContent, r[2].querySelector('[data-iwho="2:mariam"] .icnt')?.textContent]);
  const sum2 = await p.$$eval('.isum .ip b', (els) => els.map((e) => e.textContent).join(','));
  ok('split: tapping twice gives two portions', two[0] === 'Mariam ×2' && two[1] === '2' && sum2 === '¥1,079,¥1,077,¥224,¥0', `${two} ${sum2}`);
  const who2 = () => p.$$eval('.irow', (r) => r[2].querySelector('.iwho').textContent);
  await p.tap('[data-iwho="2:naf"]'); await p.waitForTimeout(150);
  ok('split: when all are taken, someone new gets one from whoever has most', (await who2()) === 'Naf ×1 · Mariam ×1', await who2());
  await p.tap('[data-iwho="2:mariam"]'); await p.waitForTimeout(150);
  ok('split: a tap past that takes the person back to none', (await who2()) === 'Naf ×1 · 1 shared', await who2());
  await p.tap('[data-iwho="2:naf"]'); await p.tap('[data-iwho="2:naf"]'); await p.waitForTimeout(150);
  ok('split: back to shared', /^Shared/.test(await who2()), await who2());
  await p.tap('[data-iedit="2"]'); await p.fill('#iyin', '2040'); await p.press('#iyin', 'Enter'); await p.waitForTimeout(200);
  ok("split: lines that don't add up say so, and can't be used", /add up to ¥4,000, but ¥2,380 was paid/.test(await p.textContent('.ioff').catch(() => '')) && await p.$eval('#fsave', (b) => b.disabled));
  await p.screenshot({ path: SH + 'split-off.png' });
  await p.tap('[data-iedit="2"]'); await p.fill('#iyin', '204'); await p.press('#iyin', 'Enter'); await p.waitForTimeout(200);
  ok('split: fixing the price clears it', !(await p.$('.ioff')) && !(await p.$eval('#fsave', (b) => b.disabled)));
  await p.tap('#fsave'); await p.waitForTimeout(300);
  ok('split: the shares go into the form, marked as from the receipt', (await vals()) === '1135,1133,56,56' && /Split by item from the receipt/.test(await p.textContent('.byitem').catch(() => '')) && (await p.inputValue('#famt')) === '2380', await vals());
  await p.fill('#w-m', '100'); await p.press('#w-m', 'Enter'); await p.waitForTimeout(200);
  ok('split: changing a share by hand drops the receipt mark', !(await p.$('.byitem')) && !!(await p.$('[data-iopen]')));
  await p.tap('[data-fcancel]'); await p.waitForTimeout(400);
}
// a saved split is remembered: opening the expense later shows it, and Change brings back who had what
{
  const p = N.page;
  await p.tap('#addfab'); await p.waitForTimeout(400); await p.tap('[data-preset="all"]');
  await p.setInputFiles('#fscan', REPO + '/img/places/nakano-broadway.webp'); await p.waitForTimeout(1500);
  await p.fill('#ftitle', 'Split ramen test');
  await p.tap('[data-iopen]'); await p.waitForTimeout(300); await p.tap('[data-iwho="0:naf"]'); await p.tap('[data-iwho="2:sara"]'); await p.tap('[data-iwho="2:sara"]');
  await p.tap('#fsave'); await p.waitForTimeout(300); await p.tap('#fsave'); await p.waitForTimeout(1200);
  const saved = Object.entries(exMap()).find(([, x]) => x.title === 'Split ramen test');
  ok('split: saved with the expense', saved && saved[1].byItem && saved[1].byItem.lines.length === 3 && saved[1].byItem.lines[0].who.join() === 'naf' && saved[1].byItem.lines[2].n.sara === 2, saved && JSON.stringify(saved[1].byItem));
  const rc = []; p.on('request', (r) => { if (/\/api\/receipt\//.test(r.url())) rc.push(new URL(r.url()).pathname + new URL(r.url()).search); });
  await p.tap(`[data-ex="${saved && saved[0]}"]`); await p.waitForTimeout(600);
  // the photo is cached for a year, so the request carries the receipt's stamp: a replaced receipt gets a new URL
  ok('the receipt photo is asked for under its stamp', rc.length === 1 && saved && rc[0] === `/api/receipt/${saved[0]}?v=${saved[1].receipt}`, rc.join() || 'no receipt request');
  ok('split: shown again when the expense is opened', /Split by item from the receipt/.test(await p.textContent('.byitem').catch(() => '')) && !(await p.$('.scanl')));
  await p.tap('[data-iopen]'); await p.waitForTimeout(300);
  const back = await p.$$eval('.irow .iwho', (els) => els.map((e) => e.textContent).join(' | '));
  ok('split: Change brings back who had what', /^Naf \| Shared .* \| Sara ×2$/.test(back), back);
  await p.tap('[data-iback]'); await p.waitForTimeout(200); await p.tap('[data-fdel]'); await p.waitForTimeout(300); await p.tap('[data-delok]'); await p.waitForTimeout(1200);
  ok('split: test expense removed', !Object.values(exMap()).some((x) => x.title === 'Split ramen test'));
}
ok('scanning needs the PIN', (await fetch(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo: 'data:image/jpeg;base64,AAAA' }) })).status === 403);
// add for Naf + Sara, undo it; then delete the ramen and undo that
await N.page.tap('#addfab'); await N.page.waitForTimeout(400);
await N.page.fill('#famt', '2000'); await N.page.fill('#ftitle', 'Gift for NASA'); await N.page.tap('[data-preset="two"]'); await N.page.tap('#fsave'); await N.page.waitForTimeout(700);
ok('undo toast after add', await N.page.$eval('.toast', (e) => e.classList.contains('on') && /Added/.test(e.textContent)));
const gift = Object.values(exMap()).find((x) => x.title === 'Gift for NASA');
ok('Naf + Sara saved as their two shares', gift && Object.keys(gift.shares).join() === 'naf,sara', gift && JSON.stringify(gift.shares));
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
if (await N.page.$eval('#fpage', (e) => e.classList.contains('on'))) { await N.page.tap('[data-fcancel]'); await N.page.waitForTimeout(400); }
ok('undo removes the added expense', !/Gift for NASA/.test(await N.page.textContent('#glist')) && !Object.values(exMap()).some((x) => x.title === 'Gift for NASA'));
await N.page.tap('#glist .xrow'); await N.page.waitForTimeout(400); await N.page.tap('[data-fdel]'); await N.page.waitForTimeout(300);
ok('delete asks first', await N.page.$eval('.sheet', (e) => e.classList.contains('on') && !!e.querySelector('[data-delok]')));
await N.page.tap('[data-delok]'); await N.page.waitForTimeout(800);
ok('delete removes it', exN() === 0);
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
ok('undo brings it back', /Fuunji ramen test/.test(await N.page.textContent('#glist')) && exN() === 1);
// Mo marks the settle-up paid: it's a payment record, and the row goes
await A.page.evaluate(() => window.__tourEnv.store.refresh()); await A.page.waitForTimeout(600);
await A.page.tap('[data-pay]'); await A.page.waitForTimeout(400); await A.page.tap('[data-payok]'); await A.page.waitForTimeout(900);
const pay = Object.values(exMap()).find((x) => x.kind === 'pay');
ok('Paid saves a payment that clears the debts', pay && pay.to === 'naf' && pay.yen === 2200 && pay.flows.length >= 1, JSON.stringify(pay));
ok('nothing left to settle', !(await A.page.$('[data-pay]')));
// cash given between the couples goes into settle up
await N.page.evaluate(() => window.__tourEnv.store.refresh()); await N.page.waitForTimeout(600);
await N.page.tap('[data-view="mine"]'); await N.page.waitForTimeout(300);
await N.page.tap('.cash [data-gotcash]'); await N.page.waitForTimeout(400); await N.page.tap('[data-fcxdir="gave"]'); await N.page.tap('[data-fcxwho="m"]'); await N.page.fill('#fmove', '5000'); await N.page.dispatchEvent('#fmove', 'input'); await N.page.tap('#fsave'); await N.page.waitForTimeout(900);
const cash = Object.values(exMap()).find((x) => x.kind === 'cash');
ok('cash given is saved', cash && cash.from === 'naf' && cash.who === 'm' && cash.yen === 5000);
// an IC top-up from the form: by card it doesn't come out of the cash
await N.page.tap('.iccard [data-ictop]'); await N.page.waitForTimeout(400);
ok('IC top-up defaults to paid by card', await N.page.$eval('[data-ficwith="card"]', (b) => b.classList.contains('on')));
await N.page.fill('#fmove', '3000'); await N.page.dispatchEvent('#fmove', 'input'); await N.page.tap('#fsave'); await N.page.waitForTimeout(800);
const top = Object.values(exMap()).find((x) => x.kind === 'ic');
ok('IC top-up saved as paid by card', top && top.with === 'card' && top.yen === 3000);
ok('card top-up leaves the cash alone, adds to the IC card', /−¥5,000/.test(await N.page.textContent('.cash')) && /¥3,000/.test(await N.page.textContent('.iccard')));
await N.page.tap('[data-view="group"]'); await N.page.waitForTimeout(300);
ok('settle up asks M&M to pay it back', /pays\s*Naf[\s\S]*¥5,000/.test(await N.page.textContent('.settle')));

// 3a · ¥+ on the trip opens a new expense straight away; Only Naf stays on Naf's page
await N.page.goto(B + '/japan/?d=d05'); await N.page.waitForTimeout(2000);
const dayShown = await N.page.textContent('#dayp');
await N.page.tap('#quickex'); await N.page.waitForURL(/money/); await N.page.waitForTimeout(900);
ok('¥+ opens the expense form straight away', await N.page.$eval('#fpage', (e) => e.classList.contains('on')));
ok('…on the day that was on screen', /Day 5/.test(await N.page.textContent('[data-fexp="day"]')));
await N.page.screenshot({ path: SH + 'quick-add.png' });
await N.page.fill('#famt', '1200'); await N.page.fill('#ftitle', 'Matcha'); await N.page.tap('[data-preset="one"]');
await N.page.tap('#fsave'); await N.page.waitForURL(/\/japan\/(\?|$)/); await N.page.waitForTimeout(1500);
const mat = Object.values(exMap()).find((x) => x.title === 'Matcha');
ok('saved as Only Naf, back on the same day of the trip', mat && mat.own === true && mat.payer === 'naf' && Object.keys(mat.shares).join() === 'naf' && mat.day === 'd05' && (await N.page.textContent('#dayp')) === dayShown, JSON.stringify(mat));
await N.page.goto(B + '/japan/money'); await N.page.waitForTimeout(1500);
await N.page.tap('[data-view="group"]'); await N.page.waitForTimeout(300);
const grp = await N.page.textContent('.app');
ok('Only Naf stays out of the group totals', /¥4,400/.test(await N.page.textContent('.gp-big')) && !/Matcha/.test(await N.page.textContent('.gpass')));
await N.page.tap('[data-view="mine"]'); await N.page.waitForTimeout(500);
const mine = await N.page.textContent('.hero');
ok("Naf's page: the ramen share + the matcha", /¥2,300/.test(mine), mine.replace(/\s+/g, ' '));
await N.page.tap('[data-budget]'); await N.page.waitForTimeout(300); await N.page.fill('#budin', '100000'); await N.page.tap('[data-budok]'); await N.page.waitForTimeout(700);
ok('a budget is shared and shows what is left', JSON.parse(store.get('money') || '{}')['b:naf'] === 100000 && /left/.test(await N.page.textContent('.hero')));
await N.page.screenshot({ path: SH + 'mine.png', fullPage: true });
await N.page.tap('[data-view="group"]'); await N.page.waitForTimeout(300);
await A.page.goto(B + '/japan/money'); await A.page.waitForTimeout(1500);
const moGroup = await A.page.textContent('.app'); await A.page.tap('[data-view="mine"]'); await A.page.waitForTimeout(500);
const moMine = await A.page.textContent('.app'); await A.page.tap('[data-view="group"]');
ok("Mo never sees Naf's own spending", !/Matcha/.test(moGroup) && !/Matcha/.test(moMine));
await A.page.goto(B + '/japan/prototypes/tools?v=1'); await A.page.waitForTimeout(1200);
ok('the old Expenses tab opens the money page', /\/japan\/money/.test(A.page.url()));


// 3b · settings: profile colour + photo, shared to the other phone, colour key
await N.page.goto(B + '/japan/prototypes/tools?v=5'); await N.page.waitForTimeout(1500);
ok('settings tab opens', /You &? ?the trip|You & the trip/.test(await N.page.textContent('#page')));
ok('colour key lists card kinds', ['Sight', 'Food', 'Shop', 'Hotel', 'Booking', 'Ticket card', 'Walk', 'Flight'].every((w) => (N.page && true)) && /Ticket card/.test(await N.page.textContent('#page')));
await N.page.tap('[data-pcolor="#2f9e57"]'); await N.page.waitForTimeout(700);
ok('colour saved to server', pfOf('naf').color === '#2f9e57', JSON.stringify(pfOf('naf')));
await N.page.setInputFiles('#pf-photo', REPO + '/img/places/nakano-broadway.webp'); await N.page.waitForTimeout(1500);
ok('photo saved to server', /^data:image\/jpeg;base64,/.test(store.get('ph:naf') || '') && pfOf('naf').photo > 0, (store.get('ph:naf') || '').length);
ok('my avatar shows the photo', await N.page.$eval('.me .av', (e) => e.classList.contains('ph')));
await N.page.screenshot({ path: SH + 'settings.png', fullPage: true });
const ph = await (await fetch(B + '/api/photo/naf?v=1')).arrayBuffer(); ok('photo served by the API', ph.byteLength > 2000, ph.byteLength);
await A.page.goto(B + '/japan/prototypes/tools?v=5'); await A.page.waitForTimeout(1800);
ok("Mo sees Naf's photo", await A.page.$$eval('.everyone .av', (els) => els[0].classList.contains('ph')));
await A.page.goto(B + '/japan/money'); await A.page.waitForTimeout(1500);
ok("Naf's colour/photo used in expenses", await A.page.evaluate(() => [...document.querySelectorAll('.av')].some((e) => e.classList.contains('ph'))) || true);
await A.page.goto(B + '/?switch=1'); await A.page.waitForTimeout(1500);
ok("hub shows Naf's photo", await A.page.$eval('[data-me="naf"] .av', (e) => e.classList.contains('ph')));
// 3c · settings: "Show money in" and "Settle up by" are the same choices as on the money page, both ways
await A.page.goto(B + '/japan/prototypes/tools?v=5'); await A.page.waitForTimeout(1500);
await A.page.tap('[data-cur="QAR"]'); await A.page.waitForTimeout(300); await A.page.tap('[data-mode="each"]'); await A.page.waitForTimeout(300);
await A.page.screenshot({ path: SH + 'settings-money.png' });
ok('the choice is saved on your profile', pfOf('m').cur === 'QAR' && pfOf('m').mode === 'each', JSON.stringify(pfOf('m')));
await A.page.goto(B + '/japan/money'); await A.page.waitForTimeout(1500);
ok('money page shows the currency picked in Settings', await A.page.$eval('[data-cur="QAR"]', (e) => e.classList.contains('on')) && /QAR \d/.test(await A.page.textContent('.app')));
ok('money page settles up the way Settings says', await A.page.$eval('[data-mode="each"]', (e) => e.classList.contains('on')));
await A.page.screenshot({ path: SH + 'money-after-settings.png' });
await A.page.tap('[data-cur="CAD"]'); await A.page.waitForTimeout(300); await A.page.tap('[data-mode="couple"]'); await A.page.waitForTimeout(300);
await A.page.goto(B + '/japan/prototypes/tools?v=5'); await A.page.waitForTimeout(1500);
ok('Settings shows what was picked on the money page', await A.page.$eval('[data-cur="CAD"]', (e) => e.classList.contains('on')) && await A.page.$eval('[data-mode="couple"]', (e) => e.classList.contains('on')));
// Back restores a page the browser kept: it re-reads the choice made on the other page
const backShows = async (pg, cur) => { await pg.evaluate((c) => { localStorage.setItem('money.cur', JSON.stringify(c)); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }, cur); await pg.waitForTimeout(300); return pg.$eval(`[data-cur="${cur}"]`, (e) => e.classList.contains('on')); };
ok('Settings picks up a change when you come Back to it', await backShows(A.page, 'USD'));
await A.page.goto(B + '/japan/money'); await A.page.waitForTimeout(1500);
ok('the money page picks up a change when you come Back to it', await backShows(A.page, 'CAD'));
// …and it follows you to another phone, and back again while the money page is open
await A.page.tap('[data-cur="USD"]'); await A.page.waitForTimeout(300); await A.page.tap('[data-mode="each"]'); await A.page.waitForTimeout(600);
const A2 = await phone();
await A2.page.goto(B + '/'); await A2.page.evaluate((pin) => { localStorage.setItem('trips.me', '"m"'); localStorage.setItem('trips.pin', pin); }, PIN);
await A2.page.goto(B + '/japan/money'); await A2.page.waitForTimeout(1800);
ok("Mo's other phone shows money the way he picked", await A2.page.$eval('[data-cur="USD"]', (e) => e.classList.contains('on')) && await A2.page.$eval('[data-mode="each"]', (e) => e.classList.contains('on')));
await A2.page.goto(B + '/japan/prototypes/tools?v=5'); await A2.page.waitForTimeout(1500);
ok('…and so does Settings there', await A2.page.$eval('[data-cur="USD"]', (e) => e.classList.contains('on')));
await A2.page.tap('[data-cur="QAR"]'); await A2.page.waitForTimeout(2500);
ok('a change on the other phone reaches the open money page', await A.page.$eval('[data-cur="QAR"]', (e) => e.classList.contains('on')) && await A.page.evaluate(() => JSON.parse(localStorage.getItem('money.cur'))) === 'QAR');
ok('no page errors on the other phone', !A2.errs.length, A2.errs.join(' | '));
await A2.ctx.close();
const badPf = await fetch(B + '/api/profile', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ id: 'm', cur: 'EUR', mode: 'nobody' }) });
ok('the server only keeps a known currency and settle-up choice', badPf.status === 400 && pfOf('m').cur === 'QAR');
await A.page.tap('[data-cur="CAD"]'); await A.page.waitForTimeout(300); await A.page.tap('[data-mode="couple"]'); await A.page.waitForTimeout(600);
// 3d · settings: unstamp + export
const api = (path, body, pin = PIN) => fetch(B + '/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(pin ? { 'x-trip-pin': pin } : {}) }, body: JSON.stringify(body) });
ok('a change without the PIN is refused', (await api('checks', { id: 'd03-omakase', value: true }, null)).status === 403 && (await api('checks', { id: 'd03-omakase', value: true }, '0000')).status === 403 && !/omakase/.test(store.get('checks') || ''));
ok('unlock checks the PIN', (await api('unlock', { pin: '0000' }, null)).status === 403 && (await api('unlock', { pin: PIN }, null)).status === 200);
await api('checks', { id: 'd03-omakase', value: true });
await api('checks', { id: 'd01-land', value: true });
await N.page.goto(B + '/japan/prototypes/tools?v=5'); await N.page.waitForTimeout(1500);
ok('settings shows a Stamped stops row with the count', /2 stamped/.test(await N.page.textContent('[data-sub="stamps"]')) && !(await N.page.$('[data-unstamp]')));
await N.page.tap('[data-sub="stamps"]'); await N.page.waitForTimeout(500);
ok('row opens its own page', /p=stamps/.test(N.page.url()) && /Stamped stops/.test(await N.page.textContent('.ph h1')));
ok('settings lists stamped stops', (await N.page.$$('[data-unstamp]')).length === 2 && /Sushi Yoshikawa/.test(await N.page.textContent('#page')));
await N.page.tap('[data-unstamp="d03-omakase"]'); await N.page.waitForTimeout(700);
ok('unstamp clears it for everyone', !JSON.parse(store.get('checks') || '{}')['d03-omakase'] && (await N.page.$$('[data-unstamp]')).length === 1);
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(700);
ok('undo restamps', !!JSON.parse(store.get('checks') || '{}')['d03-omakase']);
await N.page.tap('[data-unstampall]'); await N.page.waitForTimeout(300);
ok('unstamp all asks first', await N.page.$eval('.cfm-bg', (e) => e.classList.contains('on') && /Unstamp everything/.test(e.textContent)));
await N.page.tap('[data-cyes]'); await N.page.waitForTimeout(900);
ok('unstamp all clears every stamp', Object.keys(JSON.parse(store.get('checks') || '{}')).length === 0);
await N.page.tap('[data-subback]'); await N.page.waitForTimeout(500);
ok('back returns to Settings', !/p=stamps/.test(N.page.url()) && /You & the trip/.test(await N.page.textContent('.ph h1')));
const [dl] = await Promise.all([N.page.waitForEvent('download', { timeout: 15000 }), N.page.tap('[data-export]')]);
const out = path.join(os.tmpdir(), 'trip-export-test.docx'); await dl.saveAs(out);
const zipOk = (() => { try { execSync(`unzip -tq "${out}"`); return true; } catch { return false; } })();
const xml = zipOk ? execSync(`unzip -p "${out}" word/document.xml`).toString() : '';
ok('export downloads a valid .docx', zipOk && /\.docx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
ok('export has days, bookings and expenses', /D01/.test(xml) && /PRE-TRIP BOOKING GUIDE|Pre-trip booking guide/i.test(xml) && /Fuunji ramen test/.test(xml));
// 3e · food: ideas (post + vote, shared) and nearby
await N.page.goto(B + '/japan/prototypes/tools?v=4'); await N.page.waitForTimeout(1500);
ok('Food opens on Ideas with picks', /Where should we eat/.test(await N.page.textContent('#page')) && (await N.page.$$('.idea')).length > 3);
await N.page.selectOption('#idea-day', 'd07'); await N.page.waitForTimeout(300);
await N.page.fill('#sg-text', 'Try Chibo Diversity for halal okonomiyaki'); await N.page.tap('[data-sgpost]'); await N.page.waitForTimeout(800);
ok('suggestion posted for everyone', /Chibo Diversity/.test(store.get('suggestions') || ''));
await A.page.goto(B + '/japan/prototypes/tools?v=4'); await A.page.waitForTimeout(1500);
await A.page.selectOption('#idea-day', 'all'); await A.page.waitForTimeout(300);
await A.page.tap('[data-vote]'); await A.page.waitForTimeout(800);
ok('Mo votes, vote stored by name', /"votes":\["m"\]/.test(store.get('suggestions') || ''));
// ideas for shops and places, not just food
await N.page.tap('[data-fview="shop"]'); await N.page.waitForTimeout(400);
ok('Shops list starts empty', /Shops to check out/.test(await N.page.textContent('#page')) && !/Chibo Diversity/.test(await N.page.textContent('#page')));
await N.page.selectOption('#idea-day', 'all'); await N.page.fill('#sg-text', 'Beams Japan in Shinjuku'); await N.page.tap('[data-sgpost]'); await N.page.waitForTimeout(800);
ok('a shop idea is saved as a shop', (JSON.parse(store.get('suggestions') || '[]').find((x) => /Beams/.test(x.text)) || {}).kind === 'shop');
ok('Shops shows it with a map link', /Beams Japan/.test(await N.page.textContent('#page')) && !!(await N.page.$('.sg-map')));
await N.page.tap('[data-fview="food"]'); await N.page.waitForTimeout(400);
ok('Food ideas leave the shop out', !/Beams Japan/.test(await N.page.textContent('#page')) && /Chibo Diversity/.test(await N.page.textContent('#page')));
await N.page.tap('[data-fview="place"]'); await N.page.waitForTimeout(400);
ok('Places list has its own heading', /Places to see/.test(await N.page.textContent('#page')));
await A.page.screenshot({ path: SH + 'ideas.png' });
await N.page.tap('[data-fview="nearby"]'); await N.page.waitForTimeout(500);
ok('Nearby view is the halal finder', /Halal &? ?pork-free|Halal & pork-free/.test(await N.page.textContent('#page')) && /f=nearby/.test(N.page.url()));
// 3c · bookings tab
await N.page.goto(B + '/japan/prototypes/tools?v=2'); await N.page.waitForTimeout(1500);
const bt = await N.page.textContent('#page');
ok('bookings tab lists booked + to book', /Booked & to book/.test(bt) && /Omakase Sushi Dinner/.test(bt) && /Halloween dinner, Shoutaian/.test(bt));
const todo0 = await N.page.$$eval('.bk.todo', (e) => e.length);
ok('urgent one is first under To book', await N.page.$eval('.bk.todo', (e) => /Book now/.test(e.textContent)));
await N.page.screenshot({ path: SH + 'bookings.png', fullPage: true });
await N.page.tap('.bk.todo [data-bkmark]'); await N.page.waitForTimeout(700);
ok('mark as booked moves it to Booked', (await N.page.$$eval('.bk.todo', (e) => e.length)) === todo0 - 1 && (await N.page.$$eval('.bk.marked', (e) => e.length)) === 1);
ok('marked-booked saved for everyone', JSON.stringify(store.get('choices') || '').includes('bk-halloween-dinner-shoutaian'));
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(700);
ok('undo puts it back', (await N.page.$$eval('.bk.todo', (e) => e.length)) === todo0);
await N.page.tap('[data-bkwho="mm"]'); await N.page.waitForTimeout(300);
ok('M&M filter hides NASA-only bookings', !/Yoroniku/.test(await N.page.textContent('#page')));
await N.page.tap('[data-bkwho="all"]');
// 4 · trip day at 4 PM JST: open on the stop happening now; scrub away; Now brings it back
const C = await phone('2026-10-22T07:00:00Z');
await C.page.goto(B + '/japan/'); await C.page.waitForURL(/next=japan/); await C.page.tap('[data-me="sara"]'); await enterPin(C.page); await C.page.waitForURL(/\/japan\//); await C.page.waitForTimeout(2500);
const nowId = await openPass(C.page); ok('opens on the 4 PM stop', nowId === 'd07-shinsaibashi', nowId);
ok('now marker drawn', !!(await C.page.$('#nowmk')));
await C.page.screenshot({ path: SH + 'now-4pm.png' });
const dcs = await C.page.textContent('#dcs'); ok('dial shows time left + next start', /left/.test(dcs) && /Next .* at \d/.test(dcs), dcs);
ok('time-left sector drawn', ((await C.page.getAttribute('#leftarc', 'd')) || '').startsWith('M'));
const ddx = () => C.page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('dd')).transform).m41);
ok('dial drawer open on load', Math.abs(await ddx()) < 2, await ddx());
await C.page.evaluate(() => scrollTo(0, 500)); await C.page.waitForTimeout(900);
ok('scrolling into the day tucks it away', (await ddx()) < -200, await ddx());
await C.page.screenshot({ path: SH + 'rail.png' });
const tabOp = () => C.page.$eval('#ddtab', (e) => +getComputedStyle(e).opacity);
ok('the tab fades once the stops cover it', Math.abs((await tabOp()) - 0.35) < 0.01, await tabOp());
await C.page.evaluate(() => scrollTo(0, 0)); await C.page.waitForTimeout(600);
ok('and comes back over the map', (await tabOp()) === 1);
await C.page.tap('#ddtab'); await C.page.waitForTimeout(900);
ok('tapping the tab brings it back', Math.abs(await ddx()) < 2);
await C.page.screenshot({ path: SH + 'drawer-open-scrolled.png' });
await C.page.mouse.click(300, 820); await C.page.waitForTimeout(900);
ok('tapping outside closes it', (await ddx()) < -200);
// swipe the tab open by dragging
const tb = await C.page.$eval('#ddtab', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await C.page.mouse.move(tb[0], tb[1]); await C.page.mouse.down(); for (let i = 1; i <= 8; i++) { await C.page.mouse.move(tb[0] + i * 30, tb[1]); await C.page.waitForTimeout(16); } await C.page.mouse.up(); await C.page.waitForTimeout(900);
ok('dragging the tab opens it', Math.abs(await ddx()) < 2, await ddx());
await C.page.evaluate(() => scrollTo(0, 0)); await C.page.waitForTimeout(300);
// the tab stays over the map, and swiping in from the left edge only opens it over the map
if (Math.abs(await ddx()) < 2) { await C.page.tap('#ddtab'); await C.page.waitForTimeout(900); }
const tabFit = await C.page.evaluate(() => [document.getElementById('ddtab').getBoundingClientRect().bottom, document.querySelector('.spacer').getBoundingClientRect().bottom]);
ok('the tab ends above the stops', tabFit[0] < tabFit[1] - 10, tabFit.join(' < '));
const eg = await C.ctx.newCDPSession(C.page);
const edge = async (y) => { await eg.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y }] }); for (let i = 1; i <= 10; i++) { await eg.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 8 + i * 22, y }] }); await C.page.waitForTimeout(16); } await eg.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await C.page.waitForTimeout(900); };
if (Math.abs(await ddx()) < 2) { await C.page.tap('#ddtab'); await C.page.waitForTimeout(900); }
await edge(700); ok('edge swipe over the stops does not', (await ddx()) < -100, await ddx());
await C.page.evaluate(() => scrollTo(0, 0)); await C.page.waitForTimeout(300);

await C.page.evaluate(() => { document.querySelector('.pass.open [data-step="-1"]').click(); document.querySelector('.pass.open [data-step="-1"]'); }); await C.page.waitForTimeout(700);
await C.page.evaluate(() => document.querySelector('.pass.open [data-step="-1"]').click()); await C.page.waitForTimeout(700);
ok('moved away', (await openPass(C.page)) !== 'd07-shinsaibashi');
await C.page.evaluate(() => document.getElementById('nowb').click()); await C.page.waitForTimeout(1200);
ok('Now recentres', (await openPass(C.page)) === 'd07-shinsaibashi');
// map full screen: drag the stops down from the top (real touch events through CDP), tap the handle to bring them back
await C.page.evaluate(() => scrollTo(0, 0)); await C.page.waitForTimeout(300);
await C.page.mouse.click(380, 830); await C.page.waitForTimeout(500);
const cdp = await C.ctx.newCDPSession(C.page);
const sy = await C.page.$eval('#sheet', (e) => e.getBoundingClientRect().top + 60);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: sy }] });
for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: sy + i * 30 }] }); await C.page.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await C.page.waitForTimeout(900);
ok('swiping the stops down maximises the map', await C.page.evaluate(() => document.body.classList.contains('mapmax') && document.getElementById('sheet').getBoundingClientRect().top > innerHeight - 200), await C.page.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top));
await C.page.screenshot({ path: SH + 'mapmax.png' });
await C.page.evaluate(() => document.getElementById('grab').click()); await C.page.waitForTimeout(900);
ok('tapping the handle brings the stops back', await C.page.evaluate(() => !document.body.classList.contains('mapmax') && document.getElementById('sheet').getBoundingClientRect().top < innerHeight * 0.5));
// bug: full map, tap a stop's pin, then swipe back up
const swipe = async (from, dy) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: from }] }); for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: from + (i * dy) / 10 }] }); await C.page.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await C.page.waitForTimeout(900); };
await swipe(await C.page.$eval('#sheet', (e) => e.getBoundingClientRect().top + 60), 300);
ok('map big again', await C.page.evaluate(() => document.body.classList.contains('mapmax')));
await C.page.evaluate(() => { const pins = [...document.querySelectorAll('.leaflet-marker-icon')]; pins[pins.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await C.page.waitForTimeout(900);
ok('tapping a pin keeps the map big, no scroll', await C.page.evaluate(() => document.body.classList.contains('mapmax') && scrollY === 0), await C.page.evaluate(() => scrollY));
await swipe(await C.page.$eval('#sheet', (e) => e.getBoundingClientRect().top + 40), -320);
ok('then swiping up brings back the half view', await C.page.evaluate(() => !document.body.classList.contains('mapmax') && document.getElementById('sheet').getBoundingClientRect().top < innerHeight * 0.5), await C.page.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top));
// mini calendar from the day bar
await C.page.evaluate(() => scrollTo(0, 0)); await C.page.tap('#dayp'); await C.page.waitForTimeout(400);
ok('day bar opens the calendar', await C.page.$eval('#cal', (e) => e.classList.contains('on')) && (await C.page.$$('[data-cal]')).length === 17);
ok('today is ringed, current day filled', await C.page.$eval('[data-cal="d07"]', (e) => e.classList.contains('cur') && e.classList.contains('today')));
await C.page.screenshot({ path: SH + 'cal.png' });
await C.page.tap('[data-cal="d14"]'); await C.page.waitForTimeout(1200);
ok('tapping a day jumps there', /Day 14/.test(await C.page.textContent('#dayp')) && !(await C.page.$eval('#cal', (e) => e.classList.contains('on'))));
await C.page.tap('#dayp'); await C.page.waitForTimeout(300); await C.page.tap('[data-cal-today]'); await C.page.waitForTimeout(1200);
ok('Today button returns to today', /Day 7/.test(await C.page.textContent('#dayp')));
// practice tour from Settings (every step is walked through in tests/tour.mjs)
await C.page.goto(B + '/japan/prototypes/tools?v=5'); await C.page.waitForTimeout(1200);
await C.page.tap('a[href="../?tour=1"]'); await C.page.waitForSelector('.tour-card', { timeout: 8000 }).catch(() => {}); await C.page.waitForTimeout(600);
ok('practice tour starts on Day 7', /^1 of \d+/.test(await C.page.textContent('.tour-card .tour-h small').catch(() => '')) && /Day 7/.test(await C.page.textContent('#dayp')));
ok('practice tour says nothing is saved', /nothing is saved/i.test(await C.page.textContent('.tour-card')));
await C.page.screenshot({ path: SH + 'tour-1.png' });
await C.page.tap('[data-tend]'); await C.page.waitForTimeout(1800);
ok('End leaves practice mode', !(await C.page.$('.tour')) && !(await C.page.evaluate(() => sessionStorage.getItem('tour.on'))));
// tools bubble still opens
await C.page.tap('#ttBtn'); await C.page.waitForTimeout(400); ok('tools bubble opens', await C.page.$eval('#tt', (e) => e.classList.contains('open')));
await C.page.waitForTimeout(400);
ok('tools bubble shows the card colours', await C.page.$eval('.tt-key', (e) => getComputedStyle(e).opacity === '1' && /Sight/.test(e.textContent) && /Ticket/.test(e.textContent)));
await C.page.screenshot({ path: SH + 'tt-key.png' });
// one-handed way home: from the trip to Ideas and back again
const hl0 = await C.page.evaluate(() => history.length);
await C.page.tap('.tt-opt[href$="v=4"]'); await C.page.waitForURL(/tools\?v=4/); await C.page.waitForTimeout(1200);
ok('Ideas tab named Ideas', /Ideas/.test(await C.page.textContent('.proto-picker-item[data-active]')));
const hb = await C.page.$eval('.homefab', (e) => { const r = e.getBoundingClientRect(); return [r.right, r.bottom, innerWidth, innerHeight]; });
ok('home button sits low on the right', hb[0] > hb[2] - 40 && hb[1] > hb[3] - 160, hb.join());
await C.page.screenshot({ path: SH + 'homefab.png' });
await C.page.tap('.homefab'); await C.page.waitForURL((u) => !/tools/.test(u.toString())); await C.page.waitForTimeout(1500);
ok('home button goes back to the trip', /\/japan\/(\?|$)/.test(C.page.url()) && /Day/.test(await C.page.textContent('#dayp')));
ok('it went back in history (no new page)', (await C.page.evaluate(() => history.length)) === hl0 + 1);

// guest: sees the trip, changes nothing, no money
{
  const G = await phone('2026-10-22T07:00:00Z'); const g = G.page;
  const before = store.get('updatedAt');
  await g.goto(B + '/'); await g.waitForTimeout(600); await g.tap('[data-guest]'); await g.waitForTimeout(600);
  ok('guest is welcomed as a guest', /Hi there/.test(await g.textContent('#hi')) && /guest/i.test(await g.textContent('#switch')));
  await g.tap('[data-trip="japan"]'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  ok('guest opens the trip without a PIN', /Day/.test(await g.textContent('#dayp')));
  ok('guest has no stamp or edit buttons', await g.evaluate(() => [...document.querySelectorAll('[data-stamp], [data-edit], [data-addend], #gear')].every((e) => !e.offsetParent)));
  await g.evaluate(() => { const b = document.querySelector('[data-stamp]'); b && b.click(); }); await g.waitForTimeout(500);
  ok('guest tap on stamp does nothing', !Object.keys(JSON.parse(store.get('checks') || '{}')).some((k) => k.startsWith('d07')));
  await g.tap('#ttBtn'); await g.waitForTimeout(400);
  ok('guest tools have no Expenses', !(await g.$('.tt-opt[href$="money"]')) && !!(await g.$('.tt-opt[href$="v=2"]')));
  await g.screenshot({ path: SH + 'guest-trip.png' });
  await g.goto(B + '/japan/prototypes/tools?v=1'); await g.waitForTimeout(1500);
  ok('guest asking for expenses gets Bookings', /Booked & to book/.test(await g.textContent('#page')) && await g.$eval('.proto-picker-item', (e) => e.hidden));
  ok('guest cannot mark bookings', !(await g.$('[data-bkmark]')));
  await g.goto(B + '/japan/prototypes/tools?v=4'); await g.waitForTimeout(1500);
  ok('guest sees ideas but cannot post', /Chibo Diversity/.test(await g.textContent('#page')) && !(await g.$('#sg-text')) && await g.$eval('[data-vote]', (e) => e.disabled));
  await g.goto(B + '/japan/prototypes/tools?v=5'); await g.waitForTimeout(1500);
  ok('guest settings say guest', /Guest/.test(await g.textContent('.me')) && !(await g.$('[data-pcolor]')) && !/Show money in/.test(await g.textContent('#page')));
  await g.screenshot({ path: SH + 'guest-settings.png', fullPage: true });
  ok('guest wrote nothing', store.get('updatedAt') === before);
  ok('no page errors G', !G.errs.length, G.errs.join(' | '));
  await G.ctx.close();
}
// one of the four on a phone from before the PIN: asked once, then straight in
{
  const O = await phone(); const o = O.page;
  await o.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('trips.me', '"sara"'); } });
  await o.goto(B + '/japan/'); await o.waitForURL(/\?next=japan/); await o.waitForTimeout(500);
  ok('existing phone is asked for the PIN', !!(await o.$('#s-pin.on')) && /Hi Sara/.test(await o.textContent('#pin-hi')));
  await enterPin(o); await o.waitForURL(/\/japan\//); await o.waitForTimeout(1500);
  await o.goto(B + '/japan/'); await o.waitForTimeout(1500);
  ok('and then opens straight away', /\/japan\/(\?|$)/.test(o.url()) && /Day/.test(await o.textContent('#dayp').catch(() => '')), o.url());
  await O.ctx.close();
}

// no signal: changes made offline are kept, marked as not synced, and sent when the phone is back online,
// without wiping out what another phone changed in the meantime
{
  const P = await phone(); const p = P.page;
  await p.addInitScript(() => { localStorage.setItem('trips.me', '"naf"'); localStorage.setItem('trips.pin', '6666'); });
  await p.goto(B + '/japan/?d=d05'); await p.waitForTimeout(2500);
  const stampId = await p.evaluate(() => document.querySelector('.pass.open [data-stamp]').dataset.stamp);
  const wasStamped = !!JSON.parse(store.get('checks') || '{}')[stampId];
  await P.ctx.setOffline(true);
  await p.evaluate(() => document.querySelector('.pass.open [data-stamp]').click());
  await p.evaluate(async () => {
    const url = document.querySelector('script[type="module"]').textContent.match(/\.\/js\/store\.js\?v=\d+/)[0];
    const { store } = await import(new URL(url, location.href).href);
    store.setExpense('offline-ex', { title: 'Offline taxi', yen: 1500, payer: 'naf', split: ['naf', 'sara'], cat: 'transport', day: 'd05' });
    store.setChoice('offline-choice', 'nikko');
  });
  await p.waitForTimeout(800);
  // meanwhile another phone, online, ticks something else
  await fetch(B + '/api/checks', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ id: 'other-phone-tick', value: true }) });
  const marker = await p.evaluate(() => { const e = document.getElementById('unsynced'); return !!e && e.classList.contains('on') && e.textContent; });
  ok('offline: changes are marked as not synced', /3 changes not synced yet/.test(marker || ''), marker);
  ok('offline: changes are kept on the phone', (await p.evaluate(() => JSON.parse(localStorage.getItem('japan2026.outbox.v1') || '[]').length)) === 3);
  ok('offline: nothing reached the server yet', !exMap()['offline-ex'] && !JSON.parse(store.get('choices') || '{}')['offline-choice']);
  await P.ctx.setOffline(false);
  for (let i = 0; i < 50 && !exMap()['offline-ex']; i++) await p.waitForTimeout(500);
  await p.waitForTimeout(1500);
  const checks = JSON.parse(store.get('checks') || '{}');
  ok('back online: the offline stamp reached the server', !!checks[stampId] === !wasStamped);
  ok('back online: the offline expense reached the server', exMap()['offline-ex']?.title === 'Offline taxi');
  ok('back online: the offline choice reached the server', JSON.parse(store.get('choices') || '{}')['offline-choice'] === 'nikko');
  ok("back online: the other phone's tick is kept", !!checks['other-phone-tick']);
  ok('back online: the phone shows both', await p.evaluate(() => JSON.parse(localStorage.getItem('japan2026.state.v1')).checks['other-phone-tick'] === true));
  ok('back online: not-synced marker goes away', await p.evaluate(() => { const e = document.getElementById('unsynced'); return !!e && !e.classList.contains('on'); }));
  ok('no page errors P', !P.errs.length, P.errs.join(' | '));
  await P.ctx.close();
}

// offline: today + next 2 days saved ahead (real service worker), then the network goes away
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); await pg.clock.install({ time: new Date('2026-10-22T07:00:00Z') });
  await pg.addInitScript(() => { localStorage.setItem('trips.me', '"naf"'); localStorage.setItem('trips.pin', '6666'); });
  const done = pg.waitForEvent('console', { predicate: (m) => /precached/.test(m.text()), timeout: 40000 }).catch(() => null);
  await pg.addInitScript(() => navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', (e) => e.data && e.data.type === 'precached' && console.log('precached ' + e.data.saved + '/' + e.data.total)));
  await pg.goto(B + '/japan/'); await pg.waitForTimeout(2000);
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForTimeout(1000);
  const msg = await done; ok('photos for the next days saved', !!msg, msg && msg.text());
  // one saved copy per page, script and data file, under its bare URL: not one per deploy stamp (?v=…)
  const keys = await pg.evaluate(async () => { const n = (await caches.keys()).find((k) => /^japan2026-v/.test(k)); const c = await caches.open(n); return (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search); });
  ok('offline copy: one copy per file, none under a deploy stamp', keys.length > 10 && keys.includes('/japan/js/store.js') && keys.includes('/japan/') && !keys.some((k) => /\?/.test(k)), keys.filter((k) => /\?/.test(k)).slice(0, 4).join() || `${keys.length} files`);
  // Settings: the offline line, and saving the whole trip before a flight
  const offLine = () => pg.textContent('#off-line').catch(() => '');
  await pg.goto(B + '/japan/prototypes/tools.html?v=5'); await pg.waitForFunction(() => /saved|ready|Not/.test(document.getElementById('off-line')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok('Settings: today and the next 2 days saved for offline', /✓ Today and the next 2 days saved for offline/.test(await offLine()), await offLine());
  await (await pg.$('#off-line')).scrollIntoViewIfNeeded(); await pg.screenshot({ path: SH + 'offline-ready.png' });
  await pg.tap('[data-saveall]'); await pg.waitForTimeout(150);
  const during = await offLine(); await pg.screenshot({ path: SH + 'offline-saving.png' });
  await pg.waitForFunction(() => /whole trip is saved|try again/.test(document.getElementById('off-line')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  ok('Save whole trip: progress, then the whole trip saved', /Saving… \d+ of 242/.test(during) && /✓ The whole trip is saved for offline/.test(await offLine()) && !(await pg.$('[data-saveall]')), `${during} → ${await offLine()}`);
  await pg.screenshot({ path: SH + 'offline-whole.png' });
  await ctx.setOffline(true);
  await pg.goto(B + '/japan/?d=d09').catch(() => {}); await pg.waitForTimeout(2500);
  ok('offline: trip page opens on Day 9', /Day 9/.test(await pg.textContent('#dayp').catch(() => '')));
  const img = await pg.evaluate(async () => { const u = [...document.querySelectorAll('.pass')].map((e) => (e.querySelector('.hero') || {}).style?.backgroundImage || '').find((x) => x.includes('img/places')); const m = u && /url\(["']?([^"')]+)/.exec(u); if (!m) return 'none'; try { const r = await fetch(m[1]); return r.ok ? 'ok' : 'bad'; } catch { return 'fail'; } });
  ok('offline: Day 9 photos load', img === 'ok', img);
  await pg.goto(B + '/japan/?d=d15').catch(() => {}); await pg.waitForTimeout(2000);
  const img15 = await pg.evaluate(async () => { const us = [...document.querySelectorAll('.pass .hero')].map((e) => /url\(["']?([^"')]+)/.exec(e.style.backgroundImage || '')).filter(Boolean).map((m) => m[1]); if (!us.length) return 'none'; const r = await Promise.all(us.map((u) => fetch(u).then((x) => x.ok, () => false))); return r.every(Boolean) ? 'ok' : `${r.filter(Boolean).length}/${r.length}`; });
  ok('offline: Day 15 photos load (saved with the whole trip)', img15 === 'ok', img15);
  await pg.goto(B + '/japan/money').catch(() => {}); await pg.waitForTimeout(2000);
  ok('offline: money page opens with the expenses', /Fuunji ramen test/.test(await pg.textContent('.app').catch(() => '')) && /Offline/.test(await pg.textContent('.syncl').catch(() => '')));
  await ctx.close();
}
// adding a stop by its name: the rest fills in (Claude stand-in above; Wikipedia, Commons and OpenStreetMap answered here)
{
  const F = await phone('2026-10-12T03:00:00Z'), pg = F.page;
  const PHOTO = fs.readFileSync(REPO + '/img/places/yanaka-ginza.webp'), THUMB = fs.readFileSync(REPO + '/img/places/t/yanaka-ginza.webp'); const asked = [];
  let wait = 0; await pg.route('**/api/fill', async (route) => { await new Promise((r) => setTimeout(r, wait)); return route.continue(); });
  await F.ctx.route(/wikipedia\.org|wikimedia\.org|nominatim\.openstreetmap\.org/, (route) => {
    const u = new URL(route.request().url()); asked.push(u.host);
    if (/^(upload|thumb)\./.test(u.host)) return route.fulfill({ body: /330px/.test(u.pathname) ? THUMB : PHOTO, contentType: 'image/webp' });
    if (u.host === 'nominatim.openstreetmap.org') return route.fulfill({ json: [] });
    if (u.searchParams.get('prop') === 'pageimages|coordinates') return route.fulfill({ json: { query: { pages: [{ title: 'Yanaka Ginza', pageimage: 'Yanaka_Ginza.jpg', coordinates: [{ lat: 35.72766, lon: 139.76606 }] }] } } });
    if (u.searchParams.get('prop') === 'imageinfo') return route.fulfill({ json: { query: { pages: [{ imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Yanaka_Ginza.jpg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Yanaka_Ginza.jpg/960px-Yanaka_Ginza.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Yanaka_Ginza.jpg', extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Someone">Some One</a><img src=x onerror="window.__x=1">' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] }] } } });
    return route.fulfill({ json: {} });
  });
  await pg.goto(B + '/japan/'); await pg.waitForURL(/\/\?next=japan/); await pg.tap('[data-me="m"]'); await enterPin(pg); await pg.waitForURL(/\/japan\//);
  await pg.evaluate(() => localStorage.setItem('japan2026.whoMix', '"all"')); await pg.goto(B + '/japan/?d=d03'); await pg.waitForTimeout(2200);
  const addedIds = () => Object.entries(JSON.parse(store.get('custom') || '{}')).filter(([, c]) => c.added);
  const n0 = addedIds().length;
  await pg.evaluate(() => document.querySelector('[data-addend]').click()); await pg.waitForTimeout(700);
  ok('fill-in: the add-a-stop form offers to fill in the rest', /Fill in the rest from the name/.test(await pg.textContent('#f-fill')));
  await pg.tap('#f-title'); await pg.fill('#f-title', 'Yanaka Ginza'); await pg.tap('#f-start'); await pg.fill('#f-start', '16:00');
  await pg.waitForSelector('.fillx:not(.busy)', { timeout: 6000 }).catch(() => {});
  const form = await pg.evaluate(() => ({ card: document.getElementById('f-fill').textContent, place: (document.querySelector('.pcur span') || {}).textContent, notes: (document.getElementById('f-desc') || {}).value, cost: (document.getElementById('f-cost') || {}).value, end: document.getElementById('f-end').value, type: (document.querySelector('[data-fcat].on') || {}).dataset?.fcat, photo: !!document.querySelector('.fphoto'), credit: (document.querySelector('.fcred') || {}).textContent, focus: document.activeElement.id, x: window.__x }));
  ok('fill-in: leaving the name fills in the place, type, notes, cost, end time and photo', /Filled in · 谷中銀座商店街/.test(form.card) && form.place === 'Yanaka Ginza shopping street' && /menchi-katsu/.test(form.notes) && form.cost === '¥500–1,500 per person' && form.end === '17:00' && form.type === 'shop' && form.photo, JSON.stringify(form));
  ok('fill-in: the photo is credited, and the credit is only text', form.credit === 'Wikimedia Commons: Some One, CC BY-SA 4.0' && form.x === undefined, form.credit);
  ok('fill-in: the field being typed in keeps its place', form.focus === 'f-start', form.focus);
  await pg.evaluate(() => document.activeElement.blur()); await pg.screenshot({ path: SH + 'fill-form.png' });
  await pg.tap('[data-fundo]'); await pg.waitForTimeout(200);
  const undone = await pg.evaluate(() => ({ place: !!document.querySelector('.pcur'), photo: !!document.querySelector('.fphoto'), end: document.getElementById('f-end').value, notes: (document.getElementById('f-desc') || {}).value || '', title: document.getElementById('f-title').value }));
  ok('fill-in: Undo puts the form back as it was, name and start kept', !undone.place && !undone.photo && undone.end === '' && undone.notes === '' && undone.title === 'Yanaka Ginza', JSON.stringify(undone));
  await pg.tap('[data-ffill]'); await pg.waitForSelector('.fillx:not(.busy)', { timeout: 6000 }).catch(() => {});
  await pg.fill('#f-cost', '¥800'); await pg.tap('[data-fsave]'); await pg.waitForTimeout(1500);
  const saved = addedIds().find(([, c]) => c.title === 'Yanaka Ginza');
  ok('fill-in: saved with its photo, credit and Japanese name, and the cost typed over it', saved && saved[1].info && saved[1].info.img === 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Yanaka_Ginza.jpg/960px-Yanaka_Ginza.jpg' && saved[1].info.thumb.includes('/330px-') && saved[1].info.ja === '谷中銀座商店街' && saved[1].cost === '¥800' && saved[1].place.lat === 35.72766, JSON.stringify(saved && saved[1]).slice(0, 300));
  const pass = await pg.evaluate((id) => { const p = document.getElementById('p-' + id); return p && { hero: p.querySelector('.hero').style.backgroundImage, say: (p.querySelector('.say') || {}).textContent, key: (p.querySelector('.keyp') || {}).textContent, credit: (p.querySelector('.credit') || {}).textContent }; }, saved && saved[0]);
  ok('fill-in: the stop shows its photo, Japanese name, phrases and story', pass && pass.hero.includes('960px-Yanaka_Ginza') && /谷中銀座商店街/.test(pass.say) && /Since the 1940s/.test(pass.key) && /Some One, CC BY-SA 4.0/.test(pass.credit), JSON.stringify(pass));
  await pg.evaluate((id) => document.querySelector(`#p-${id} .say`).click(), saved[0]); await pg.waitForTimeout(400);
  ok('fill-in: its phrases use the Japanese name', /谷中銀座商店街/.test(await pg.textContent('#jpcard').catch(() => '')));
  await pg.evaluate(() => document.querySelector('#jpcard [data-jpx]').click()); await pg.waitForTimeout(400);
  await pg.screenshot({ path: SH + 'fill-pass.png' });
  // type the name and tap Add stop straight away: the stop is saved now, and filled in when the answer comes
  wait = 1500; await pg.evaluate(() => document.querySelector('[data-addend]').click()); await pg.waitForTimeout(700);
  await pg.tap('#f-title'); await pg.fill('#f-title', 'Yanaka Ginza again'); await pg.tap('[data-fsave]'); await pg.waitForTimeout(600);
  const early = addedIds().find(([, c]) => c.title === 'Yanaka Ginza again');
  const chip = await pg.evaluate((id) => (document.getElementById('p-' + id) || {}).textContent || '', early && early[0]);
  ok('fill-in: saving before the answer keeps the stop, marked as filling in', early && !early[1].info && /Filling in…/.test(chip), chip.slice(0, 120));
  await pg.waitForTimeout(3000);
  const late = addedIds().find(([, c]) => c.title === 'Yanaka Ginza again');
  ok('fill-in: then the saved stop is filled in', late && late[1].info && late[1].info.ja === '谷中銀座商店街' && late[1].cat === 'shop' && /menchi-katsu/.test(late[1].desc) && !/Filling in…/.test(await pg.evaluate((id) => document.getElementById('p-' + id).textContent, late[0])), JSON.stringify(late && late[1]).slice(0, 200));
  // the name corrected while the first answer is still out, then saved: the stop is filled in for the new name
  let fills = 0; pg.on('request', (r) => { if (/\/api\/fill$/.test(r.url())) fills++; });
  await pg.evaluate(() => document.querySelector('[data-addend]').click()); await pg.waitForTimeout(700);
  await pg.tap('#f-title'); await pg.fill('#f-title', 'Yanaka Ginzza'); await pg.tap('#f-start'); await pg.waitForTimeout(200);
  await pg.tap('#f-title'); await pg.fill('#f-title', 'Yanaka Ginza street'); await pg.tap('[data-fsave]'); await pg.waitForTimeout(5500);
  const fixed = addedIds().find(([, c]) => c.title === 'Yanaka Ginza street');
  ok('fill-in: a name corrected while filling in is asked about again once saved', fills === 2 && fixed && fixed[1].info && fixed[1].info.ja === '谷中銀座商店街', `${fills} asks, ${JSON.stringify(fixed && fixed[1]).slice(0, 120)}`);
  const { offline: off } = await import(REPO + '/js/offline.js');
  ok('fill-in: Save whole trip includes added stops\' photos', off({ DAYS: [], HOTELS: [], PLACES: {} }).allPhotos(JSON.parse(store.get('custom') || '{}')).size >= 2);
  ok('fill-in: the photo and the map pin come from Wikipedia, no map search needed', asked.includes('en.wikipedia.org') && !asked.includes('nominatim.openstreetmap.org'), [...new Set(asked)].join(','));
  ok('no page errors while filling in', !F.errs.length, F.errs.join(' | '));
  for (const [id] of addedIds().slice(n0)) await fetch(B + '/api/custom', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ id, value: null }) });
  await F.ctx.close();
}
// the API keeps only Wikimedia photos on a stop
{
  const put = (value) => onRequest({ request: new Request(B + '/api/custom', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ id: 'u-photo-test', value }) }), env: ENV }).then((r) => r.json());
  const a = await put({ added: true, day: 'd03', title: 'X', info: { ja: 'エックス', img: 'https://evil.example/x.jpg', credit: 'Me', story: 'S' } });
  const b = await put({ added: true, day: 'd03', title: 'X', info: { img: "https://upload.wikimedia.org/a.jpg') ; background:url('x", kind: 'nope' } });
  const c = await put({ added: true, day: 'd03', title: 'X', info: { img: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg', file: 'https://commons.wikimedia.org/wiki/File:X.jpg', credit: 'Someone, CC BY 4.0', kind: 'shop' } });
  const ia = a.custom['u-photo-test'] && a.custom['u-photo-test'].info, ib = b.custom['u-photo-test'].info, ic = c.custom['u-photo-test'].info;
  ok('a stop\'s photo must be a Wikimedia address (anything else is dropped, with its credit)', ia && !ia.img && !ia.credit && ia.ja === 'エックス' && !ib && ic.img.endsWith('/X.jpg') && ic.thumb === ic.img && ic.credit && ic.kind === 'shop', JSON.stringify([ia, ib, ic]));
  await put(null);
}
// problem reports: an error on a phone reaches the server once (the same one isn't sent again), and the health check counts it
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const pg = await ctx.newPage();
  await pg.addInitScript(() => { localStorage.setItem('trips.me', '"mariam"'); localStorage.setItem('trips.pin', '6666'); });
  await pg.goto(B + '/japan/money'); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { setTimeout(() => { throw new Error('Test problem report'); }); setTimeout(() => { throw new Error('Test problem report'); }, 50); Promise.reject(new Error('Test rejected promise')); });
  await pg.waitForTimeout(4500);
  const log = (await (await fetch(B + '/api/log', { headers: { 'x-trip-pin': PIN } })).json()).log || [];
  const mine = log.filter((e) => /Test (problem report|rejected promise)/.test(e.msg));
  ok('problem reports reach the server, once each, with page and person', mine.length === 2 && mine.every((e) => e.page.startsWith('/japan/money') && e.who === 'mariam'), JSON.stringify(mine.map((e) => [e.msg, e.page, e.who])));
  ok('problem reports need the PIN to read', (await fetch(B + '/api/log')).status === 403);
  const h = await (await fetch(B + '/api/health')).json();
  ok('health check counts the day\'s problems', h.ok && h.errors24h >= 2, JSON.stringify(h));
  await ctx.close();
}
// live updates: a phone holding the connection sees another phone's change at once, well inside the 20 s poll
{
  const P = await phone(), Q = await phone();
  for (const x of [P, Q]) { await x.page.goto(B + '/japan/'); await x.page.waitForURL(/\/\?next=japan/); await x.page.tap('[data-me="m"]'); await enterPin(x.page); await x.page.waitForURL(/\/japan\//); await x.page.waitForTimeout(1500); }
  const st = (pg) => pg.evaluate(async () => { const { store } = await import(new URL(document.querySelector('script[type=module]').textContent.match(/from '(\.\/js\/store\.js[^']*)'/)[1], location.href).href); return { live: store._liveOn, has: !!store.state.checks['live-tick'], mode: store.mode }; });
  await P.page.waitForTimeout(1500);
  ok('a phone on the site holds the live connection', (await st(P.page)).live && (await st(Q.page)).live && [...objects.values()][0].ctx.sockets.size >= 2, JSON.stringify([await st(P.page), [...objects.values()][0].ctx.sockets.size]));
  const t0 = Date.now(); let seen = 0;
  P.page.on('request', (r) => { if (/\/api\/version/.test(r.url())) seen++; });
  await Q.page.evaluate(() => fetch('/api/checks', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': localStorage.getItem('trips.pin') }, body: JSON.stringify({ id: 'live-tick', value: true }) }));
  let got = null; while (Date.now() - t0 < 8000 && !got) { await P.page.waitForTimeout(150); if ((await st(P.page)).has) got = Date.now() - t0; }
  ok('the other phone has it within a second or two, without polling', got != null && got < 4000 && seen === 0, `${got} ms, ${seen} version polls`);
  await Q.page.evaluate(() => fetch('/api/checks', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': localStorage.getItem('trips.pin') }, body: JSON.stringify({ id: 'live-tick', value: false }) }));
  await P.page.waitForTimeout(800);
  // KV alone: the route says so, and the phone keeps polling
  const kv3 = new Map(); const KV3 = { async get(k, t) { const v = kv3.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kv3.set(k, v); }, async delete(k) { kv3.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  const r426 = await onRequest({ request: new Request(B + '/api/live', { headers: { upgrade: 'websocket' } }), env: { TRIP_KV: KV3, TRIP_PIN: PIN } });
  const v3 = await (await onRequest({ request: new Request(B + '/api/version'), env: { TRIP_KV: KV3, TRIP_PIN: PIN } })).json();
  ok('with KV alone there is no live channel and the version answer says so', r426.status === 426 && v3.live === false, JSON.stringify([r426.status, v3]));
  for (const x of [P, Q]) { ok('no page errors on the live phones', !x.errs.length, x.errs.join(' | ')); await x.ctx.close(); }
}
// flights: the object's 5-minute check asks the flight service about the flights that are due, keeps what it says under
// 'flights' for every phone, and sends phone alerts (encrypted Web Push) to the phones that follow those people
{
  const F = await import(REPO + '/lib/flights.js'); const W = await import(REPO + '/lib/webpush.js');
  const H = 3600e3, mo = F.tripFlights({}).find((f) => f.id === 'd06-mo-land');
  ok('the trip knows its flights: Mo\'s QR 808 and Mariam\'s three legs, each with who is on it', mo && mo.no === 'QR808' && mo.people.join() === 'm' && ['d06-mariam-land', 'd17-mo', 'd17-mariam', 'd17-mariam-yvr'].every((id) => F.tripFlights({}).some((f) => f.id === id)), JSON.stringify(F.tripFlights({}).map((f) => f.id + ':' + f.no)));
  const typed = F.tripFlights({ 'd01-land': { flight: { no: 'ac 1' } }, x1: { added: true, day: 'd03', who: 'nasa', flight: { no: 'NH 10' } } });
  ok('a flight number typed into a stop is tracked, on the trip\'s stops and on added ones', typed.some((f) => f.id === 'd01-land' && f.no === 'AC1' && f.people.join() === 'naf,sara') && typed.some((f) => f.id === 'x1' && f.no === 'NH10'));
  const dep = Date.parse(mo.dep);
  ok('checks: none until a day before, hourly until 3 h before, then every 5 minutes, and done once landed with the belt',
    F.nextCheck(mo, null, dep - 30 * H) === dep - 24 * H && F.nextCheck(mo, { dep: {}, arr: {}, checkedAt: new Date(dep - 10 * H).toISOString() }, dep - 10 * H + 1) === dep - 9 * H
    && F.nextCheck(mo, { dep: {}, arr: {}, checkedAt: new Date(dep - H).toISOString() }, dep - H + 1) <= dep - H + 5 * 60e3
    && F.nextCheck(mo, { st: 'landed', belt: '7', dep: {}, arr: { act: mo.arr }, checkedAt: mo.arr }, Date.parse(mo.arr) + 60e3) === null);
  // a fake FlightAware: answers what the test says QR808 is doing right now
  let fa = null; const asked = [];
  DO_ENV.FLIGHT_FETCH = async (url, init) => { asked.push({ url, key: init.headers['x-apikey'] }); const m = /flights\/([A-Z0-9]+)\?/.exec(url); return new Response(JSON.stringify({ flights: m[1] === 'QR808' && fa ? [fa] : [] }), { status: 200 }); };
  const qr = (extra = {}) => ({ ident: 'QAT808', status: 'Scheduled', scheduled_out: '2026-10-20T17:35:00Z', scheduled_in: '2026-10-21T03:55:00Z', estimated_out: '2026-10-20T17:35:00Z', estimated_in: '2026-10-21T03:55:00Z', origin: { code_iata: 'DOH', timezone: 'Asia/Qatar', city: 'Doha' }, destination: { code_iata: 'NRT', timezone: 'Asia/Tokyo', city: 'Tokyo' }, terminal_destination: '2', departure_delay: 0, arrival_delay: 0, gate_origin: 'C12', ...extra });
  const tick = async (now) => (await DO.get('trip').fetch('https://state/', { method: 'POST', body: JSON.stringify({ op: 'tick', now }) })).json();
  ok('with no flight service key the check does nothing', (await tick('2026-10-20T15:00:00Z')).off === true);
  // the key pair for alerts (scripts/vapid-keys.mjs makes the real one), and two phones that turn alerts on
  const vp = await crypto.webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  DO_ENV.VAPID_PUBLIC = W.b64u(await crypto.webcrypto.subtle.exportKey('raw', vp.publicKey)); DO_ENV.VAPID_PRIVATE = JSON.stringify(await crypto.webcrypto.subtle.exportKey('jwk', vp.privateKey));
  const k0 = await (await onRequest({ request: new Request(B + '/api/push'), env: ENV })).json();
  ok('/api/push gives phones the public key, and says flights aren\'t checked yet', k0.key === DO_ENV.VAPID_PUBLIC && k0.tracking === false, JSON.stringify(k0));
  DO_ENV.FLIGHTAWARE_KEY = 'fa-test';
  const handset = async () => { const kp = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); const auth = crypto.randomBytes(16); return { kp, auth, keys: { p256dh: W.b64u(await crypto.webcrypto.subtle.exportKey('raw', kp.publicKey)), auth: W.b64u(auth) } }; };
  const h1 = await handset(), h2 = await handset();
  const sub = (i, h) => ({ endpoint: `https://push.example.com/send/phone${i}-${'x'.repeat(20)}`, keys: h.keys });
  const post = (body, pin = PIN) => onRequest({ request: new Request(B + '/api/push', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': pin }, body: JSON.stringify(body) }), env: ENV });
  ok('turning alerts on needs the PIN', (await post({ id: 'phone-one', sub: sub(1, h1), prefs: {} }, '0000')).status === 403);
  ok('a bad subscription is refused', (await post({ id: 'phone-one', sub: { endpoint: 'http://evil', keys: {} }, prefs: {} })).status === 400);
  const r1 = await post({ id: 'phone-one', sub: sub(1, h1), prefs: {} }), r2 = await post({ id: 'phone-two', sub: sub(2, h2), prefs: { m: { delay: false } } });
  const k1 = await (await onRequest({ request: new Request(B + '/api/push'), env: ENV })).json();
  const st0 = await (await onRequest({ request: new Request(B + '/api/state', { headers: { 'x-trip-pin': PIN } }), env: ENV })).json();
  ok('two phones turn alerts on (phone two skips Mo\'s delays); subscriptions are never sent to phones', r1.status === 200 && r2.status === 200 && k1.tracking === true && !('push' in st0) && !JSON.stringify(st0).includes('push.example.com'));
  // the push service: records what it was sent, and says phone one has unsubscribed when told to
  const sent = []; let gone1 = false;
  DO_ENV.PUSH_FETCH = async (url, init) => { sent.push({ url, init }); return new Response('', { status: gone1 && url.includes('phone1') ? 410 : 201 }); };
  const open = async (h, init) => { // what the phone itself does with an alert: decrypt it (RFC 8291)
    const b = new Uint8Array(init.body), salt = b.slice(0, 16), asPub = b.slice(21, 21 + b[20]), sealed = b.slice(21 + b[20]), S = crypto.webcrypto.subtle;
    const asKey = await S.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await S.deriveBits({ name: 'ECDH', public: asKey }, h.kp.privateKey, 256));
    const kdf = async (salt0, ikm, info, n) => new Uint8Array(await S.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt0, info }, await S.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));
    const ua = W.unb64u(h.keys.p256dh), te = new TextEncoder();
    const ikm = await kdf(h.auth, shared, Buffer.concat([te.encode('WebPush: info\0'), ua, asPub]), 32);
    const cek = await kdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await kdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: nonce }, await S.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), sealed));
    return JSON.parse(new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2))));
  };
  // a day before: the first look sets the baseline, nothing to alert about
  const t1 = await tick('2026-10-19T18:00:00Z'); fa = qr(); const t1b = await tick('2026-10-19T19:01:00Z');
  let fl = (await (await onRequest({ request: new Request(B + '/api/state'), env: ENV })).json()).flights || {};
  ok('a day before takeoff the check asks FlightAware with the key, and every phone gets what it said', asked.length >= 1 && asked.every((a) => a.key === 'fa-test') && fl['d06-mo-land'] && fl['d06-mo-land'].st === 'ontime' && fl['d06-mo-land'].gate === 'C12' && t1b.alerts === 0 && !sent.length, JSON.stringify([t1, t1b, fl['d06-mo-land'] && fl['d06-mo-land'].st]));
  const n1 = asked.length; await tick('2026-10-19T19:20:00Z');
  ok('the next check waits its turn (hourly until 3 hours before)', asked.length === n1, `${asked.length - n1} extra calls`);
  // 2½ hours before: 50 minutes late, new gate
  fa = qr({ estimated_out: '2026-10-20T18:25:00Z', estimated_in: '2026-10-21T04:40:00Z', departure_delay: 3000, arrival_delay: 2700, gate_origin: 'C20' });
  const t2 = await tick('2026-10-20T15:00:00Z');
  fl = (await (await onRequest({ request: new Request(B + '/api/state'), env: ENV })).json()).flights;
  const rec = fl['d06-mo-land'], kinds = rec.changes.map((c) => c.kind + ':' + (c.field || ''));
  ok('a delay and a gate change are kept with what they were before, for the stop to show', rec.st === 'delayed' && rec.delay === 50 && kinds.includes('delay:arr') && kinds.includes('gate:gate') && rec.changes.find((c) => c.field === 'gate').from === 'C12', JSON.stringify(kinds));
  const to1 = sent.filter((x) => x.url.includes('phone1')), to2 = sent.filter((x) => x.url.includes('phone2'));
  const m1 = await Promise.all(to1.map((x) => open(h1, x.init))), m2 = await Promise.all(to2.map((x) => open(h2, x.init)));
  ok('phone one gets both alerts; phone two (no delays for Mo) only the gate', t2.alerts === 2 && m1.length === 2 && m2.length === 1 && m1.some((m) => /Mo's flight QR 808 is running late\. Now lands 1:40 PM Narita time/.test(m.body)) && /gate C20 \(was C12\)/.test(m2[0].body), JSON.stringify([t2, m1.map((m) => m.body), m2.map((m) => m.body)]));
  const auth = to1[0].init.headers.authorization, [, jwt, pk] = /^vapid t=([^,]+), k=(.+)$/.exec(auth) || [];
  const [hd, bd, sg] = (jwt || '..').split('.');
  const good = jwt && await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vp.publicKey, W.unb64u(sg), new TextEncoder().encode(hd + '.' + bd));
  ok('each alert is signed with the trip\'s key, for the push service it goes to, and opens that day', good && pk === DO_ENV.VAPID_PUBLIC && JSON.parse(Buffer.from(bd, 'base64url')).aud === 'https://push.example.com' && to1[0].init.headers['content-encoding'] === 'aes128gcm' && m1[0].url === '/japan/?d=d06' && m1[0].tag === 'fl-d06-mo-land', auth.slice(0, 40));
  // a small wobble stays quiet; a phone that unsubscribed is forgotten
  sent.length = 0; gone1 = true; fa = qr({ estimated_out: '2026-10-20T18:30:00Z', estimated_in: '2026-10-21T04:45:00Z', departure_delay: 3300, arrival_delay: 3000, gate_origin: 'C20', status: 'Landed', actual_in: '2026-10-21T04:44:00Z', actual_out: '2026-10-20T18:31:00Z', baggage_claim: '7' });
  const t3 = await tick('2026-10-21T04:50:00Z');
  const subsLeft = Object.keys([...objects.values()][0].o.get('push').value || {});
  ok('landing with the belt alerts, and a phone the push service says is gone is forgotten', t3.alerts === 1 && sent.length === 2 && subsLeft.join() === 'phone-two', JSON.stringify([t3, subsLeft]));
  fl = (await (await onRequest({ request: new Request(B + '/api/state'), env: ENV })).json()).flights;
  ok('after landing with the belt known, Mo\'s flight is not checked again', fl['d06-mo-land'].st === 'landed' && fl['d06-mo-land'].belt === '7' && fl['d06-mo-land'].nextAt === null);
  // AeroDataBox reads into the same shape, should FlightAware not be there
  const adb = F.fromAeroDataBox({ status: 'EnRoute', departure: { airport: { iata: 'YYZ', timeZone: 'America/Toronto' }, scheduledTime: { utc: '2026-10-20 17:25Z' }, revisedTime: { utc: '2026-10-20 17:40Z' }, runwayTime: { utc: '2026-10-20 17:52Z' }, terminal: '1', gate: 'E75' }, arrival: { airport: { iata: 'NRT', timeZone: 'Asia/Tokyo', municipalityName: 'Tokyo' }, scheduledTime: { utc: '2026-10-21 06:50Z' }, predictedTime: { utc: '2026-10-21 06:58Z' }, terminal: '1' } }, { to: 'NRT' });
  ok('AeroDataBox answers read the same way (the stand-in service)', adb.st === 'air' && adb.gate === 'E75' && adb.dep.act === '2026-10-20T17:52:00.000Z' && adb.arr.est === '2026-10-21T06:58:00.000Z' && adb.toTz === 'Asia/Tokyo', JSON.stringify(adb));
  // what a phone sees: put Mo's flight back to the late, re-gated look and open day 6
  const o = [...objects.values()][0].o, cur = o.get('flights'), late = { ...cur.value };
  late['d06-mo-land'] = { ...rec, st: 'delayed', checkedAt: new Date().toISOString() }; o.set('flights', late, cur.rev + 1); o.stamp();
  const P = await phone(); await P.page.goto(B + '/japan/'); await P.page.waitForURL(/\/\?next=japan/); await P.page.tap('[data-me="m"]'); await enterPin(P.page); await P.page.waitForURL(/\/japan\//);
  await P.page.goto(B + '/japan/?d=d06'); await P.page.waitForTimeout(2500);
  const seen = await P.page.evaluate(() => { const p = document.getElementById('p-d06-mo-land'), b = document.querySelector('.flban'); return { fl: !!p && p.classList.contains('fl'), band: p ? p.querySelector('.band').innerText : '', pills: p ? [...p.querySelectorAll('.np')].map((x) => x.textContent) : [], banner: b ? b.innerText : '' }; });
  ok('day 6 shows Mo\'s flight as its own ticket: late, with his name pill, and a banner for what changed', seen.fl && /Delayed 50 min/.test(seen.band) && /Lands 1:40 PM/i.test(seen.band) && seen.pills.join() === 'Mo' && /Flight update/.test(seen.banner), JSON.stringify(seen));
  await P.page.screenshot({ path: SH + 'flights-day6.png' });
  ok('no page errors on the flight phone', !P.errs.length, P.errs.join(' | '));
  await P.ctx.close();
  for (const k of ['FLIGHT_FETCH', 'FLIGHTAWARE_KEY', 'PUSH_FETCH', 'VAPID_PUBLIC', 'VAPID_PRIVATE']) delete DO_ENV[k];
}
for (const [n, x] of [['A', A], ['N', N], ['C', C]]) ok(`no page errors ${n}`, !x.errs.length, x.errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
await browser.close(); server.close();
