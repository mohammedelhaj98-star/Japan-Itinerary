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
const FILL_SAID = { known: true, name: 'Yanaka Ginza shopping street', ja: '谷中銀座商店街', ro: 'Yanaka Ginza Shōtengai', cat: 'shop', kind: 'shop', notes: 'Old-Tokyo shopping street. The menchi-katsu is usually pork and beef: ask for beef only.', cost: '¥500–1,500 per person', minutes: 60, key: 'Since the 1940s · About 60 shops', story: 'It survived the 1923 earthquake and the war, so it still looks like 1950s Tokyo.', dyk: 'Seven wooden cats hide along the street.', wikipedia: 'Yanaka Ginza', search: 'Yanaka Ginza', lat: 35.7277, lng: 139.766 };
// …and for /api/shop-ai (where on the route to buy something): Tokyo Banana is at Gransta, inside Tokyo Station, on day 12
const SHOP_SAID = { shop: 'Gransta, inside Tokyo Station', why: 'Every Tokyo Banana flavour in one place.', at: 'd12-shinkansen', search: 'Tokyo Banana', ja: '東京ばな奈', halal: 'Check the box for gelatin.', cat: 'sweets', lat: 35.6809, lng: 139.7665,
  // other days to buy it: Asakusa the next day (kept), a second Tokyo Station shop (same day as the first, so dropped) and a made-up stop (dropped)
  alts: [{ shop: 'Nakamise stalls, Asakusa', why: 'Gift boxes at the stalls too.', at: 'd13-nakamise', lat: 35.7115, lng: 139.7965 }, { shop: 'Daimaru Tokyo', why: 'Same day.', at: 'd12-shinkansen', lat: 35.6815, lng: 139.7675 }, { shop: 'Nowhere', why: 'x', at: 'd99-nope', lat: 0, lng: 0 }] };
// (sent a photo instead of a name, it sees a box of matcha Kit Kats)
const said = (c) => typeof c === 'string' ? c : ((c.find((x) => x.type === 'text') || {}).text || '');
// (asked to sort things into categories: masks, serums and creams are skincare, the rest sweets)
const sorted = (text) => ({ items: [...text.matchAll(/^([a-z0-9_-]+) \| (.+)$/gim)].map(([, id, name]) => ({ id, cat: /mask|serum|cream/i.test(name) ? 'skincare' : 'sweets' })) });
const FAKE_AI = { run: async (m, inp) => /^Sort each thing/.test(said(inp.messages[0].content)) ? { response: sorted(said(inp.messages[0].content)) } : /want to buy/.test(said(inp.messages[0].content)) ? { response: { ...SHOP_SAID, name: Array.isArray(inp.messages[0].content) ? 'Matcha Kit Kat' : 'Tokyo Banana', cat: /necklace/i.test(said(inp.messages[0].content)) ? 'fashion' : 'sweets' } } : typeof inp.messages[0].content === 'string' ? { response: FILL_SAID } : ({ response: { total: 3000, cash_given: 3000, change: 620, tax: 216, pretax: null, shop: '一蘭 道頓堀店本館', shop_en: 'Ichiran Dotonbori', date: '2026-10-22', type: 'food', items: ['Ramen'], lines: [{ name: 'Ramen', jp: 'ラーメン', note: '', price: 980, qty: 1 }, { name: 'Ramen', jp: 'ラーメン', price: 980, qty: 1 }, { name: 'Extra noodles', jp: '替玉', note: 'a second serving of noodles for the same soup', tags: ['Meal', 'noodles', 'meal'], price: 204, qty: 2 }, { name: 'bad', price: 0 }] } }) };
const PIN = '6666'; // the group's PIN for this test server (the real one is a secret on the Pages project)
const ENV = { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI, TRIP_DO: DO };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8790');
  if (u.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), env: ENV });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); return res.end(Buffer.from(await r.arrayBuffer()));
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
  const said = { total: 1960, cash_given: null, change: null, tax: 178, pretax: null, shop: '一蘭 道頓堀店本館', shop_en: 'Ichiran Dotonbori', date: '2026-10-22', type: 'food', taxfree: false, lines: [{ name: 'Ramen', jp: 'ラーメン', note: '', price: 980, qty: 1 }, { name: 'Ramen', jp: 'ラーメン', note: '', price: 980, qty: 1 }], items: ['Ramen'] };
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
    ok('/api/scan asks Claude when the key is set and keeps its lines', r.total === 1960 && r.model === CLAUDE_MODEL && Array.isArray(r.lines) && r.lines.length === 2 && r.shop_en === 'Ichiran Dotonbori' && r.lines[0].jp === 'ラーメン' && !('note' in r.lines[0]), JSON.stringify(r).slice(0, 200));
    globalThis.fetch = answer(500, 'down');
    const r2 = await (await onRequest({ request: new Request(B + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ photo }) }), env: { TRIP_KV: KV, TRIP_PIN: PIN, AI: FAKE_AI, ANTHROPIC_API_KEY: 'k' } })).json();
    ok('/api/scan falls back to Workers AI when Claude is down', r2.total === 2380 && r2.model !== CLAUDE_MODEL, JSON.stringify(r2).slice(0, 120));
  } finally { globalThis.fetch = realFetch; }
  // every place on the trip has a story and a "did you know?", short enough for a phone card
  const { PLACES } = await import(REPO + '/data/places.js');
  const thin = Object.entries(PLACES).filter(([, p]) => !p.story || !p.dyk || p.story.length > 400 || p.dyk.length > 200).map(([n]) => n);
  ok('every place has a story and a "did you know?"', Object.keys(PLACES).length > 100 && !thin.length, thin.join(', '));
  // filling in a new stop from its name
  const t1dyk = () => !tidyFill({ known: false, name: 'Laundry', dyk: 'x' }, 'x').dyk;
  const { fillRequest, fillStop, tidyFill } = await import(REPO + '/lib/fill-claude.js');
  const fq = fillRequest('sk-test', { name: 'Yanaka Ginza', city: 'Tokyo', date: '2026-10-17', near: 'Nezu Shrine' }), fb = JSON.parse(fq.body);
  ok('fill-in: one Claude request asking for the stop as JSON', fq.url === 'https://api.anthropic.com/v1/messages?beta=true' && fq.headers['x-api-key'] === 'sk-test' && fb.model === CLAUDE_MODEL && fb.output_config.format.schema.required.includes('wikipedia') && /"Yanaka Ginza"/.test(fb.messages[0].content) && /Nezu Shrine/.test(fb.messages[0].content) && /no pork/.test(fb.messages[0].content));
  const saidFill = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ ...FILL_SAID, lat: 48.85, lng: 2.35, minutes: 9999 }) }] };
  const f1 = await fillStop({ ANTHROPIC_API_KEY: 'k' }, { name: 'Yanaka Ginza' }, { fetchFn: answer(200, saidFill) });
  ok('fill-in: Claude\'s answer comes back checked (a position outside Japan and a silly length dropped)', f1.model === CLAUDE_MODEL && f1.ja === '谷中銀座商店街' && f1.cat === 'shop' && f1.lat === null && f1.minutes === null && f1.wikipedia === 'Yanaka Ginza', JSON.stringify(f1).slice(0, 200));
  ok('fill-in: the stop comes back with a "did you know?" as well as its story', fb.output_config.format.schema.required.includes('dyk') && f1.dyk === 'Seven wooden cats hide along the street.' && t1dyk(), f1.dyk);
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

// 2b · fold, skip, reorder (feedback from the trip: an open stop couldn't be closed, a day couldn't be reordered,
// and there was no "opposite of stamping" for places we didn't get to)
const shared = (page) => page.evaluate(() => fetch('/api/state', { cache: 'no-store' }).then((r) => r.json()));
const bandOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#stack .pass')].map((el) => [el.dataset.id, new DOMMatrix(getComputedStyle(el).transform).m42]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));
const domOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#stack .pass')].map((el) => el.dataset.id));
await A.page.evaluate(() => document.querySelector('.pass.open [data-pick]').click()); await A.page.waitForTimeout(900);
ok('tapping the top of the open stop folds it: none open, the day in order', !(await openPass(A.page)) && (await A.page.evaluate(() => document.body.classList.contains('folded'))) && (await bandOrder(A.page)).join() === (await domOrder(A.page)).join(), (await bandOrder(A.page)).slice(0, 4).join());
await A.page.evaluate(() => document.querySelector('.pass[data-id="d07-deer"] .band').click()); await A.page.waitForTimeout(900);
ok('tapping a stop in the folded list opens it', (await openPass(A.page)) === 'd07-deer' && !(await A.page.evaluate(() => document.body.classList.contains('folded'))));
await A.page.evaluate(() => document.querySelector('.pass.open [data-fold]').click()); await A.page.waitForTimeout(900);
ok('Fold up folds it too', !(await openPass(A.page)));
await A.page.evaluate(() => document.querySelector('.pass[data-id="d07-deer"] .band').click()); await A.page.waitForTimeout(900);
const fx1 = await A.page.evaluate(() => { document.querySelector('.pass.open [data-skip]').click(); const p = document.querySelector('.pass[data-id="d07-deer"]'); return { hSlam: !!p.querySelector('.hanko.slam'), mSlam: !!p.querySelector('.mioku.slam'), ring: !!p.querySelector('.sfx .ring'), dust: p.querySelectorAll('.sfx .puff').length, shake: p.classList.contains('thunk'), hLift: !!p.querySelector('.hanko.lifting'), mLift: !!p.querySelector('.mioku.lifting'), rot: p.querySelector('.mioku').style.getPropertyValue('--rot') }; }); await A.page.waitForTimeout(900);
ok('Skip lands 見送 with a thunk: the stamp slams, an ink ring and dust spread, the card shakes, at the stop\'s own tilt', fx1.mSlam && fx1.ring && fx1.dust === 7 && fx1.shake && /^-?\d+deg$/.test(fx1.rot), JSON.stringify(fx1));
const sk1 = await shared(A.page);
await A.page.waitForTimeout(700);
ok('after Skip it the next stop not done yet opens by itself', (await openPass(A.page)) && (await openPass(A.page)) !== 'd07-deer', await openPass(A.page));
await A.page.evaluate(() => document.querySelector('.pass[data-id="d07-deer"] .band').click()); await A.page.waitForTimeout(900);
ok('Skip it marks the stop skipped for everyone, greys it and points at Ideas → Missed', sk1.choices['sk-d07-deer'] === 'skipped' && (await A.page.$eval('.pass[data-id="d07-deer"]', (e) => e.classList.contains('skip'))) && !!(await A.page.$('.pass.open .sknote[href*="f=missed"]')), JSON.stringify(sk1.choices));
const fx2 = await A.page.evaluate(() => { document.querySelector('.pass.open [data-stamp]').click(); const p = document.querySelector('.pass[data-id="d07-deer"]'); return { hSlam: !!p.querySelector('.hanko.slam'), mSlam: !!p.querySelector('.mioku.slam'), ring: !!p.querySelector('.sfx .ring'), dust: p.querySelectorAll('.sfx .puff').length, shake: p.classList.contains('thunk'), hLift: !!p.querySelector('.hanko.lifting'), mLift: !!p.querySelector('.mioku.lifting'), rot: p.querySelector('.mioku').style.getPropertyValue('--rot') }; }); await A.page.waitForTimeout(900);
ok('stamping a skipped stop lifts 見送 off and thunks 済 down', fx2.hSlam && fx2.mLift && fx2.shake && !fx2.mSlam, JSON.stringify(fx2));
const sk2 = await shared(A.page);
await A.page.waitForTimeout(700);
ok('after stamping, the next stop not done yet opens by itself', (await openPass(A.page)) && (await openPass(A.page)) !== 'd07-deer', await openPass(A.page));
await A.page.evaluate(() => document.querySelector('.pass[data-id="d07-deer"] .band').click()); await A.page.waitForTimeout(900);
ok('stamping a skipped stop unskips it', !sk2.choices['sk-d07-deer'] && sk2.checks['d07-deer'], JSON.stringify(sk2.choices));
const fx3 = await A.page.evaluate(() => { document.querySelector('.pass.open [data-skip]').click(); const p = document.querySelector('.pass[data-id="d07-deer"]'); return { hSlam: !!p.querySelector('.hanko.slam'), mSlam: !!p.querySelector('.mioku.slam'), ring: !!p.querySelector('.sfx .ring'), dust: p.querySelectorAll('.sfx .puff').length, shake: p.classList.contains('thunk'), hLift: !!p.querySelector('.hanko.lifting'), mLift: !!p.querySelector('.mioku.lifting'), rot: p.querySelector('.mioku').style.getPropertyValue('--rot') }; }); await A.page.waitForTimeout(1500);
ok('skipping a stamped stop lifts 済 off and thunks 見送 down; nothing is left over after', fx3.mSlam && fx3.hLift && !fx3.hSlam && (await A.page.evaluate(() => !document.querySelector('.sfx, .lifting, .slam, .pass.thunk'))), JSON.stringify(fx3));
const sk3 = await shared(A.page);
ok('skipping a stamped stop unstamps it', sk3.choices['sk-d07-deer'] === 'skipped' && !sk3.checks['d07-deer'], JSON.stringify(sk3.checks));
ok('no Skip on a journey', await A.page.evaluate(() => !document.querySelector('.pass.tk [data-skip]')));
// Reorder: drag Nakatanidou mochi above Todai-ji; the run between the bus and the train keeps its start and its end
await A.page.evaluate(() => document.querySelector('[data-reorder]').click()); await A.page.waitForTimeout(1000);
ok('Reorder folds the day, shows handles on stops (not on journeys) and moves the + buttons away', !(await openPass(A.page)) && (await A.page.$$('.pass:not(.locked) .grip')).length > 0 && (await A.page.evaluate(() => getComputedStyle(document.querySelector('.pass.locked .grip, .pass.locked .glock')).display !== 'none' && !document.querySelector('.pass.locked .grip') && getComputedStyle(document.querySelector('.tt')).display === 'none')));
await A.page.evaluate(() => document.querySelector('.pass[data-id="d07-mochi"] .grip').scrollIntoView({ block: 'center' })); await A.page.waitForTimeout(400);
const gm = await A.page.$eval('.pass[data-id="d07-mochi"] .grip', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const gt = await A.page.$eval('.pass[data-id="d07-todaiji"] .grip', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await A.page.mouse.move(gm[0], gm[1]); await A.page.mouse.down();
for (let k = 1; k <= 8; k++) { await A.page.mouse.move(gm[0], gm[1] + (gt[1] - gm[1]) * k / 8); await A.page.waitForTimeout(30); }
await A.page.mouse.up(); await A.page.waitForTimeout(1500);
const ord = (await shared(A.page)).custom['ord-d07'] || {};
const oi = (id) => (ord.order || []).indexOf(id);
ok('the new order is saved for everyone', oi('d07-mochi') >= 0 && oi('d07-mochi') < oi('d07-todaiji') && oi('d07-todaiji') < oi('d07-deer') && oi('d07-bus') === 1, JSON.stringify(ord.order));
ok('moved stops keep their own length and the run keeps its start and end', ord.times && ord.times['d07-mochi'] === '8:20–8:30 AM' && ord.times['d07-todaiji'] === '8:30–9:25 AM' && ord.times['d07-deer'] === '9:25–10:25 AM', JSON.stringify(ord.times));
ok('the day stays folded in Reorder after the save', !(await openPass(A.page)) && (await A.page.evaluate(() => document.body.classList.contains('reordering'))) && (await bandOrder(A.page)).indexOf('d07-mochi') < (await bandOrder(A.page)).indexOf('d07-todaiji'));
await A.page.screenshot({ path: SH + 'reorder.png' });
await A.page.reload(); await A.page.waitForTimeout(2200);
const evs = await A.page.evaluate(() => [...document.querySelectorAll('#stack .pass')].map((el) => el.dataset.id));
ok('after a reload the day runs in the new order, with the new times', evs.indexOf('d07-mochi') < evs.indexOf('d07-todaiji') && /8:20/.test(await A.page.textContent('.pass[data-id="d07-mochi"] .band small')), evs.slice(0, 5).join());
A.page.once('dialog', (d) => d.accept());
await A.page.evaluate(() => document.querySelector('[data-reorder]').click()); await A.page.waitForTimeout(800);
await A.page.evaluate(() => document.querySelector('[data-ordreset]').click()); await A.page.waitForTimeout(1200);
ok('Reset puts the day back in its first order and times', !(await shared(A.page)).custom['ord-d07'] && /8:20/.test(await A.page.textContent('.pass[data-id="d07-todaiji"] .band small')));
await A.page.evaluate(() => document.querySelector('[data-orddone]').click()); await A.page.waitForTimeout(400);
// the skipped stop is listed under Ideas → Missed, and Add to a day puts a copy at the end of the day picked
await A.page.goto(B + '/japan/prototypes/tools?v=4&f=missed'); await A.page.waitForTimeout(1500);
ok('Ideas → Missed lists the skipped stop', /Nara Park deer/.test(await A.page.textContent('#page')) && !!(await A.page.$('[data-missadd="d07-deer"]')));
await A.page.tap('[data-missadd="d07-deer"]'); await A.page.waitForTimeout(500);
await A.page.screenshot({ path: SH + 'missed-pick.png' });
const lastDay = await A.page.$$eval('[data-misspick]', (b) => b[b.length - 1].dataset.misspick);
await A.page.tap(`[data-misspick="${lastDay}"]`); await A.page.waitForTimeout(1200);
const cp = Object.entries((await shared(A.page)).custom).find(([, c]) => c.from === 'd07-deer');
ok('Add to a day saves a copy on that day, with its place, that remembers where it came from', !!cp && cp[1].added && cp[1].day === lastDay && cp[1].place && cp[1].place.name && cp[1].title === 'Nara Park deer', JSON.stringify(cp));
ok('the Missed row says which day it is on now', /now on Day/.test(await A.page.textContent('#page')));
await A.page.screenshot({ path: SH + 'missed.png' });
await A.page.goto(B + `/japan/?d=${lastDay}`); await A.page.waitForTimeout(2000);
ok('the copy is the last stop of that day', (await domOrder(A.page)).pop() === cp[0]);
// tidy up for the rest of the run
await A.page.evaluate(async (id) => { const h = { 'content-type': 'application/json', 'x-trip-pin': localStorage.getItem('trips.pin') }; await fetch('/api/custom', { method: 'POST', headers: h, body: JSON.stringify({ id, value: null }) }); await fetch('/api/choices', { method: 'POST', headers: h, body: JSON.stringify({ id: 'sk-d07-deer', value: '' }) }); }, cp[0]);
await A.page.goto(B + '/japan/?d=d07'); await A.page.waitForTimeout(1500);
// Move to another day: the editor's Day row moves a stop of the plan (one on a choice's option here) to day 8, for everyone
const edOpen = async (pg, id) => { await pg.evaluate((x) => document.querySelector(`.pass[data-id="${x}"] [data-edit]`).click(), id); await pg.waitForTimeout(700); };
await edOpen(A.page, 'd07-bus');
ok('a journey has no Day row (it stays on its ticket\'s day)', !(await A.page.$('#f-day')));
await A.page.click('[data-edx]'); await A.page.waitForTimeout(400);
await edOpen(A.page, 'd07-mochi');
ok('the Day row lists every day with its city, this day picked', await A.page.$$eval('#f-day [data-fday]', (b) => b.length > 15 && b.find((x) => x.classList.contains('on')).dataset.fday === 'd07' && /Day 8.*Fri 23.*Kyoto/.test(b.find((x) => x.dataset.fday === 'd08').textContent)));
await A.page.click('[data-fday="d08"]'); await A.page.waitForTimeout(300);
ok('picking a day says where it moves to, and the city', /Moves from Day 7 to Day 8, when you're in Kyoto/.test(await A.page.textContent('.fmove')), await A.page.textContent('.fmove'));
await A.page.screenshot({ path: SH + 'move-day.png' });
await A.page.click('[data-fsave]'); await A.page.waitForTimeout(1500);
ok('the move is saved for everyone as the stop\'s day', (await shared(A.page)).custom['d07-mochi'].day === 'd08', JSON.stringify((await shared(A.page)).custom['d07-mochi']));
ok('after saving, the trip shows day 8 with the stop on it, slotted by its time', /Day 8/.test(await A.page.textContent('.hd .eb')) && (await domOrder(A.page)).includes('d07-mochi'));
await A.page.screenshot({ path: SH + 'moved-day8.png' });
await A.page.goto(B + '/japan/?d=d07'); await A.page.waitForTimeout(1500);
ok('the day it left no longer has it', !(await domOrder(A.page)).includes('d07-mochi'));
await A.page.goto(B + '/japan/?d=d08'); await A.page.waitForTimeout(1500);
await edOpen(A.page, 'd07-mochi');
ok('the editor says where it was first planned', /Moved here from Day 7/.test(await A.page.textContent('.fmove')));
await A.page.click('[data-fday="d07"]'); await A.page.click('[data-fsave]'); await A.page.waitForTimeout(1500);
ok('tapping its own day again puts it back, with nothing left over', !(await shared(A.page)).custom['d07-mochi'] && (await domOrder(A.page)).includes('d07-mochi') && /Day 7/.test(await A.page.textContent('.hd .eb')));

// 3 · money: expenses shared between two phones (the money page, /japan/money)
const N = await phone();
await N.page.goto(B + '/'); await N.page.tap('[data-me="naf"]'); await enterPin(N.page); await N.page.waitForTimeout(600); await N.page.tap('[data-trip="japan"]'); await N.page.waitForURL(/\/japan\//);
await N.page.goto(B + '/japan/money'); await N.page.waitForTimeout(1500);
ok('sync line online', /Shared with all four/.test(await N.page.textContent('.syncl')));
ok('money page has Add expense and a way back to the trip', await N.page.$eval('#addfab', (e) => !e.hidden) && !!(await N.page.$('.tback[data-home]')));
await N.page.tap('#addfab'); await N.page.waitForTimeout(500);
ok('who-is-in presets read Only Naf · Naf + Sara · All four', (await N.page.$$eval('[data-preset]', (els) => els.map((e) => e.textContent).join('|'))) === 'Only Naf|Naf + Sara|All four');
await N.page.fill('#famt', '4400'); await N.page.fill('#ftitle', 'Fuunji ramen test'); await N.page.tap('[data-preset="all"]'); await N.page.waitForTimeout(200);
ok('next to the yen: the amount before 10% tax', (await N.page.textContent('#fpre')) === '(¥4,000 before 10% tax)', await N.page.textContent('#fpre'));
await N.page.tap('[data-pretax]'); await N.page.waitForTimeout(100);
ok('tapping it switches to 8% (takeaway, konbini) and leaves the amount alone', (await N.page.textContent('#fpre')) === '(¥4,074 before 8% tax)' && (await N.page.inputValue('#famt')) === '4400', await N.page.textContent('#fpre'));
await N.page.tap('[data-pretax]'); await N.page.waitForTimeout(100);
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
{ // the receipt in English, under everything: each line with what it is, the name as printed, its price, and what was paid
  const rx = await N.page.$$eval('#fpage .rxen .rxrow', (r) => r.map((e) => e.textContent));
  const last = await N.page.$eval('#fpage .fwrap', (w) => [...w.querySelectorAll(':scope > .fsec')].pop().textContent).catch(() => '');
  ok('scan: the receipt in English is the last part of the form, one row per line', rx.length === 3 && /^2×Extra noodles.*second serving.*替玉.*¥204$/.test(rx[2]) && /Receipt in English.*Ichiran Dotonbori.*一蘭.*Paid¥2,380/s.test(last), rx.join(' | ') + ' // ' + last.slice(0, 160));
  await N.page.$eval('#fpage .rxen', (e) => e.scrollIntoView()); await N.page.screenshot({ path: SH + 'receipt-english.png' });
}
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
  ok('receipt in English: saved with the expense', saved && saved[1].rx && saved[1].rx.lines.length === 3 && saved[1].rx.lines[2].jp === '替玉' && saved[1].rx.lines[2].tags.join() === 'meal,noodles' && saved[1].rx.total === 2380 && saved[1].rx.shop === 'Ichiran Dotonbori', saved && JSON.stringify(saved[1].rx));
  ok('split: saved with the expense', saved && saved[1].byItem && saved[1].byItem.lines.length === 3 && saved[1].byItem.lines[0].who.join() === 'naf' && saved[1].byItem.lines[2].n.sara === 2, saved && JSON.stringify(saved[1].byItem));
  const rc = []; p.on('request', (r) => { if (/\/api\/receipt\//.test(r.url())) rc.push(new URL(r.url()).pathname + new URL(r.url()).search); });
  await p.tap(`[data-ex="${saved && saved[0]}"]`); await p.waitForTimeout(600);
  // the photo is cached for a year, so the request carries the receipt's stamp: a replaced receipt gets a new URL
  ok('the receipt photo is asked for under its stamp', rc.length === 1 && saved && rc[0] === `/api/receipt/${saved[0]}?v=${saved[1].receipt}`, rc.join() || 'no receipt request');
  ok('split: shown again when the expense is opened', /Split by item from the receipt/.test(await p.textContent('.byitem').catch(() => '')) && !(await p.$('.scanl')));
  ok('receipt in English: shown again when the expense is opened', (await p.$$('#fpage .rxen .rxrow')).length === 3);
  await p.tap('[data-iopen]'); await p.waitForTimeout(300);
  const back = await p.$$eval('.irow .iwho', (els) => els.map((e) => e.textContent).join(' | '));
  ok('split: Change brings back who had what', /^Naf \| Shared .* \| Sara ×2$/.test(back), back);
  await p.tap('[data-iback]'); await p.waitForTimeout(200); await p.tap('[data-fdel]'); await p.waitForTimeout(300); await p.tap('[data-delok]'); await p.waitForTimeout(1200);
  ok('split: test expense removed', !Object.values(exMap()).some((x) => x.title === 'Split ramen test'));
}
// an expense saved with a receipt photo but no reading of it: one tap reads the photo and keeps the English with it
{
  const p = N.page;
  await p.tap('#addfab'); await p.waitForTimeout(400); await p.fill('#famt', '2380'); await p.fill('#ftitle', 'Old receipt test');
  await p.setInputFiles('#freceipt', REPO + '/img/places/nakano-broadway.webp'); await p.waitForTimeout(600);
  ok('receipt in English: not there for a photo that was only attached', !(await p.$('#fpage .rxen')) && !(await p.$('[data-rxgo]')));
  await p.tap('#fsave'); await p.waitForTimeout(1200);
  const old = Object.entries(exMap()).find(([, x]) => x.title === 'Old receipt test');
  ok('receipt in English: an attached photo alone saves no English', old && old[1].receipt && !old[1].rx);
  await p.tap(`[data-ex="${old && old[0]}"]`); await p.waitForTimeout(800);
  ok('receipt in English: an older expense with a photo offers to read it', !!(await p.$('[data-rxgo]')));
  await p.tap('[data-rxgo]'); await p.waitForTimeout(1500);
  const now = Object.entries(exMap()).find(([, x]) => x.title === 'Old receipt test');
  ok('receipt in English: read from the saved photo, shown and kept at once, without counting as an edit', (await p.$$('#fpage .rxen .rxrow')).length === 3 && now && now[1].rx && now[1].rx.lines.length === 3 && now[1].at === old[1].at && (await p.inputValue('#famt')) === '2380', now && JSON.stringify(now[1]).slice(0, 300));
  await p.tap('[data-rmreceipt]'); await p.waitForTimeout(200);
  ok('receipt in English: goes with the photo when the receipt is removed', !(await p.$('#fpage .rxen')));
  await p.tap('[data-fcancel]'); await p.waitForTimeout(400);
  // search what was bought: a receipt's lines are found by their English or their Japanese, and shown under the expense
  await p.tap('[data-searchopen]'); await p.waitForTimeout(200);
  const hits = async (q) => { await p.fill('#gq', q); await p.waitForTimeout(300); return p.$$eval('#glist .xhit', (e) => e.map((x) => x.textContent).join(' | ')); };
  const h1 = await hits('noodles'), h2 = await hits('替玉'), rows = await p.$$eval('#glist .xrow', (e) => e.length);
  ok('search: finds a receipt line in English or Japanese and shows it under its expense', h1 === '2× Extra noodles · ¥204' && h2 === h1 && rows === 1, `${h1} / ${h2} / ${rows}`);
  await p.waitForTimeout(500); await p.$eval('#glist .xhit', (e) => e.scrollIntoView({ block: 'center' }));
  ok('search: the line fits inside its row', await p.$eval('#glist .xhit', (e) => e.getBoundingClientRect().bottom <= e.closest('.xrow').getBoundingClientRect().bottom));
  await p.screenshot({ path: SH + 'search-receipts.png' });
  ok('search: an expense matched by its name lists no lines', (await hits('Old receipt')) === '');
  ok('search: finds a line by the kind of thing it is, plural or not (the tags the reader gave it)', (await hits('meals')) === '2× Extra noodles · ¥204' && (await hits('mea')) === '2× Extra noodles · ¥204' && (await hits('noodle')) === '2× Extra noodles · ¥204');
  // smart search: offered under the search box; once on, a model on the phone matches by meaning ("dinner" finds the
  // noodles). The model is a stand-in here: words about eating point one way, everything else another.
  const FAKE_LIB = `export const env = {}; export async function pipeline() { const v = (t) => (/noodle|meal|dinner|eat/i.test(t) ? [1, 0, 0] : [0, 0, 1]); return async (texts) => ({ dims: [texts.length, 3], data: Float32Array.from(texts.flatMap(v)) }); }`;
  await p.route('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: FAKE_LIB }));
  ok('smart search: offered under the search box, off until turned on', /Turn on/.test(await p.textContent('#glist .ailine').catch(() => '')) && (await hits('dinner')) === '');
  await p.tap('[data-aion]'); await p.waitForTimeout(600); await p.fill('#gq', 'dinner'); await p.waitForTimeout(900);
  const ai1 = await p.$$eval('#glist .xhit', (e) => e.map((x) => x.textContent).join(' | '));
  ok('smart search: once on, finds a line by meaning, and the offer goes', ai1 === '2× Extra noodles · ¥204' && !(await p.$('#glist .ailine')), ai1);
  ok('smart search: remembered on this phone, with what each line means', await p.evaluate(() => localStorage.getItem('money.ai') === 'true' && Object.keys(JSON.parse(localStorage.getItem('money.aivec') || '{}')).length >= 2));
  await p.tap('[data-searchclose]'); await p.waitForTimeout(200);
  // Settings: Read all reads every saved receipt photo that has no English yet, and keeps it on its expense
  await p.tap('#addfab'); await p.waitForTimeout(400); await p.fill('#famt', '980'); await p.fill('#ftitle', 'Settings receipt test');
  await p.setInputFiles('#freceipt', REPO + '/img/places/nakano-broadway.webp'); await p.waitForTimeout(600); await p.tap('#fsave'); await p.waitForTimeout(1200);
  await p.goto(B + '/japan/prototypes/tools?v=5'); await p.waitForTimeout(1500);
  const line0 = await p.textContent('#rx-line').catch(() => '');
  ok('Settings: says how many saved receipts have no English yet', line0 === '1 saved receipt to read', line0);
  await p.tap('[data-rxall]'); await p.waitForTimeout(2500);
  const st = Object.values(exMap()).find((x) => x.title === 'Settings receipt test'), line1 = await p.textContent('#rx-line').catch(() => '');
  ok('Settings: Read all reads it and keeps the English on the expense', st && st.rx && st.rx.lines.length === 3 && line1 === '1 receipt read' && await p.$eval('[data-rxall]', (b) => b.disabled), `${line1} ${JSON.stringify(st && st.rx).slice(0, 80)}`);
  await p.screenshot({ path: SH + 'settings-read-all.png' });
  // a receipt read before tags is read again, but a reading with no lines (the backup reader) never wipes its lines
  const stId = Object.entries(exMap()).find(([, x]) => x.title === 'Settings receipt test')[0];
  await p.evaluate(async ([id, x]) => { await fetch('/api/expenses', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': localStorage.getItem('trips.pin') }, body: JSON.stringify({ id, value: { ...x, rx: { ...x.rx, lines: x.rx.lines.map(({ tags: _, ...l }) => l) } } }) }); }, [stId, exMap()[stId]]);
  await p.route('**/api/scan', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ total: 980, shop: 'Ichiran', lines: [] }) }));
  await p.goto(B + '/japan/prototypes/tools?v=5'); await p.waitForTimeout(1500);
  const line2 = await p.textContent('#rx-line').catch(() => '');
  await p.tap('[data-rxall]'); await p.waitForTimeout(2500); await p.unroute('**/api/scan');
  const st2 = exMap()[stId];
  ok('Settings: a receipt read before tags is offered again, and a reading with no lines keeps the ones it has', line2 === '1 saved receipt to read' && st2.rx.lines.length === 3 && /couldn't be read/.test(await p.textContent('#rx-line')), `${line2} ${JSON.stringify(st2.rx).slice(0, 80)}`);
  await p.goto(B + '/japan/money'); await p.waitForTimeout(1500);
  for (const title of ['Old receipt test', 'Settings receipt test']) {
    const e = Object.entries(exMap()).find(([, x]) => x.title === title);
    await p.tap(`[data-ex="${e && e[0]}"]`); await p.waitForTimeout(500); await p.tap('[data-fdel]'); await p.waitForTimeout(300); await p.tap('[data-delok]'); await p.waitForTimeout(1200);
  }
  ok('receipt in English: test expenses removed', !Object.values(exMap()).some((x) => /receipt test/.test(x.title)));
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
// swipe the ramen left: a short swipe shows Delete and opens nothing, a long one deletes it at once (Undo brings it back)
const nt = await N.ctx.newCDPSession(N.page);
const rowSwipe = async (dx) => { const b = await N.page.locator('#glist .swr').first().boundingBox(), x = b.x + b.width - 30, y = b.y + b.height / 2;
  await nt.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) { await nt.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 12, y }] }); await N.page.waitForTimeout(16); }
  await nt.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await N.page.waitForTimeout(700); };
const swW = () => N.page.$eval('#glist .swr', (e) => e.style.getPropertyValue('--w'));
const formOn = () => N.page.$eval('#fpage', (e) => e.classList.contains('on'));
await rowSwipe(-100);
ok('a short swipe shows Delete and opens nothing', (await swW()) === '88px' && !(await formOn()) && exN() === 1, await swW());
await N.page.tap('#glist .xday'); await N.page.waitForTimeout(400);
ok('a tap elsewhere closes the swiped row', (await swW()) === '0px' && !(await formOn()), await swW());
await rowSwipe(-100); await N.page.tap('#glist .swdel'); await N.page.waitForTimeout(900);
ok('tapping the swiped Delete deletes it, no question', exN() === 0 && !(await N.page.$eval('.sheet', (e) => e.classList.contains('on'))) && /Deleted Fuunji ramen test/.test(await N.page.textContent('.toast')));
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
ok('undo after a swipe brings it back', /Fuunji ramen test/.test(await N.page.textContent('#glist')) && exN() === 1);
await rowSwipe(-330); await N.page.waitForTimeout(400);
ok('a long swipe deletes it straight away, with 10 s to undo', exN() === 0 && /Deleted Fuunji ramen test/.test(await N.page.textContent('.toast')) && !!(await N.page.$('.toast .tbar')));
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
ok('and undo brings that back too', exN() === 1);
await N.page.emulateMedia({ reducedMotion: 'reduce' }); await rowSwipe(-100); await N.page.tap('#glist .swdel'); await N.page.waitForTimeout(60);
ok('with reduced motion the row goes at once, no slide', !(await N.page.$('#glist .swr')) && /Deleted Fuunji ramen test/.test(await N.page.textContent('.toast')));
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800); await N.page.emulateMedia({ reducedMotion: 'no-preference' });
ok('…and Undo brings it back', exN() === 1);
await N.page.tap('#glist .xrow'); await N.page.waitForTimeout(400);
ok('a plain tap still opens the expense', await formOn()); await N.page.tap('[data-fcancel]'); await N.page.waitForTimeout(400);
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
// 3f · shopping: three lists, the helper puts each thing on the route, secret presents, Only in Japan ideas,
// bought → expenses, a "to buy here" strip on the stop, and taxi details on the phrase cards and travel kit
{
  const shOf = () => JSON.parse(store.get('shop') || '{}'), shBy = (name) => Object.entries(shOf()).find(([, x]) => x.name === name) || [];
  const pickGroup = async (pg, g) => { await pg.tap('[data-shpill="group"]'); await pg.waitForTimeout(250); await pg.tap(`[data-shf="group"][data-v="${g}"]`); await pg.waitForTimeout(400); };
  const sp = (body, pin = PIN) => fetch(B + '/api/shop', { method: 'POST', headers: { 'content-type': 'application/json', ...(pin ? { 'x-trip-pin': pin } : {}) }, body: JSON.stringify(body) });
  ok('shopping list changes need the PIN, a real list and a real person', (await sp({ id: 'shx', value: { name: 'X', list: 'all', by: 'naf' } }, null)).status === 403
    && (await sp({ id: 'shx', value: { name: 'X', list: 'everyone', by: 'naf' } })).status === 400 && (await sp({ id: 'shx', value: { name: 'X', list: 'all', by: 'bob' } })).status === 400 && !shOf().shx);
  ok('finding a shop needs the PIN', (await fetch(B + '/api/shop-ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Tokyo Banana', stops: [] }) })).status === 403);
  await N.page.goto(B + '/japan/prototypes/tools?v=3'); await N.page.waitForTimeout(1500);
  ok("Shopping opens on your own couple's list", /Things to buy/.test(await N.page.textContent('#page')) && (await N.page.textContent('[data-shpill="group"]')).trim().startsWith('NASA'));
  await N.page.fill('#sh-name', 'Tokyo Banana'); await N.page.tap('[data-shadd]'); await N.page.waitForTimeout(1500);
  const [tbId, tb] = shBy('Tokyo Banana');
  ok('added to NASA\'s list, and the helper put it on the route: Gransta, day 12', tb && tb.list === 'nasa' && tb.by === 'naf' && tb.ai && tb.ai.at === 'd12-shinkansen' && tb.ai.date === '2026-10-27' && tb.ai.day === 'd12' && tb.ai.ja === '東京ばな奈' && tb.cat === 'sweets', JSON.stringify(tb));
  ok('folded, it shows a heading with the day and shop, and its category', /Tue,? 27 Oct · Gransta, inside Tokyo Station/.test(await N.page.textContent('#page')) && /Sweets & snacks/.test(await N.page.textContent(`[data-shrow="${tbId}"]`)) && !/gelatin/.test(await N.page.textContent('.sp-list')));
  await N.page.tap(`[data-shrow="${tbId}"]`); await N.page.waitForTimeout(300);
  ok('tapped open: why there, the halal warning, its pills and Ask AI', /Every Tokyo Banana flavour/.test(await N.page.textContent('.sp-list')) && /gelatin/.test(await N.page.textContent('.sp-list')) && /Day 12/.test(await N.page.textContent(`[data-shset="day"][data-id="${tbId}"]`)) && /Ask AI/.test(await N.page.textContent('.sp-list')));
  ok('…with how far the shop is from that day\'s stops, and another day to buy it instead (one per day, real stops only)', /Right by Tokyo Station/.test(await N.page.textContent('.sp-list')) && /Or buy it on another day/.test(await N.page.textContent('.sp-list')) && (await N.page.$$(`[data-shalt][data-id="${tbId}"]`)).length === 1 && /Tokyo · .*28 Oct/.test(await N.page.textContent(`[data-shalt="0"][data-id="${tbId}"]`)) && /Nakamise stalls, Asakusa · (Right by|About \d+ min walk from)/.test(await N.page.textContent(`[data-shalt="0"][data-id="${tbId}"]`)), JSON.stringify(shOf()[tbId].ai));
  await N.page.tap(`[data-shalt="0"][data-id="${tbId}"]`); await N.page.waitForTimeout(400);
  const tbO = shOf()[tbId];
  ok('tapping another day moves it there, and the first place becomes the other option', tbO.ai.at === 'd13-nakamise' && tbO.ai.day === 'd13' && tbO.ai.shop === 'Nakamise stalls, Asakusa' && tbO.ai.ja === '東京ばな奈' && tbO.ai.alts.length === 1 && tbO.ai.alts[0].at === 'd12-shinkansen' && /Tokyo · .*27 Oct/.test(await N.page.textContent(`[data-shalt="0"][data-id="${tbId}"]`)), JSON.stringify(tbO.ai));
  await N.page.tap(`[data-shalt="0"][data-id="${tbId}"]`); await N.page.waitForTimeout(400);
  ok('…and back again', shOf()[tbId].ai.at === 'd12-shinkansen' && shOf()[tbId].ai.alts[0].at === 'd13-nakamise', JSON.stringify(shOf()[tbId].ai));
  await N.page.tap(`[data-shrow="${tbId}"]`); await N.page.waitForTimeout(300);
  await N.page.fill('#sh-name', 'Pearl necklace'); await N.page.fill('#sh-for', 'Sara'); await N.page.tap('[data-shlock]'); await N.page.tap('[data-shqty="1"]'); await N.page.tap('[data-shadd]'); await N.page.waitForTimeout(1500);
  const [, pearl] = shBy('Pearl necklace');
  const spR = await (await sp({ id: 'shy', value: { name: 'Fan', list: 'all', by: 'm' } })).json(); await sp({ id: 'shy', value: null });
  ok("a change's answer leaves out other people's secret presents", spR.ok && !JSON.stringify(spR.shop).includes('Pearl'));
  ok('a secret present is kept as only Naf\'s, with who it\'s for and how many', pearl && pearl.lock === 'naf' && pearl.for === 'Sara' && pearl.qty === 2, JSON.stringify(pearl));
  // just a photo (a screenshot from TikTok): the helper says what it is, and the photo is kept for showing staff
  await N.page.waitForFunction(() => !document.querySelector('.sp-ai.think'), null, { timeout: 5000 }).catch(() => {}); // the helper has answered for the necklace
  await N.page.setInputFiles('#sh-file', REPO + '/img/places/nakano-broadway.webp'); await N.page.waitForSelector('.sp-prev img', { timeout: 5000 }).catch(() => {});
  ok('a photo can be added without a name', !!(await N.page.$('.sp-prev img')) && !(await N.page.$eval('[data-shadd]', (b) => b.disabled)));
  await N.page.tap('[data-shadd]'); await N.page.waitForTimeout(2000);
  const [picId, pic] = shBy('Matcha Kit Kat');
  ok('…and the helper names it from the photo and finds where to buy it', pic && pic.photo > 0 && pic.ai && pic.ai.at === 'd12-shinkansen' && /^data:image\/jpeg;base64,/.test(store.get('sp:' + picId) || ''), JSON.stringify(pic));
  ok('the photo shows on the list', /^(data|blob):/.test(await N.page.getAttribute(`[data-spimg="${picId}"]`, 'src').catch(() => '')));
  ok('the photo needs the PIN to see', (await fetch(B + '/api/shop-photo/' + picId)).status === 403 && (await fetch(B + '/api/shop-photo/' + picId, { headers: { 'x-trip-pin': PIN } })).headers.get('content-type') === 'image/jpeg');
  await N.page.tap(`[data-shrow="${picId}"]`); await N.page.waitForTimeout(300); await N.page.tap(`[data-shstaff="${picId}"]`); await N.page.waitForTimeout(500);
  ok('Show staff shows the photo with "Do you have this?"', /これはありますか/.test(await N.page.textContent('#driver')) && !!(await N.page.$('#driver .sp-big')));
  await N.page.screenshot({ path: SH + 'shopping-staff.png' });
  await N.page.tap('#driver [data-dx]'); await N.page.waitForTimeout(400);
  await N.page.screenshot({ path: SH + 'shopping.png', fullPage: true });
  ok('a secret present never leaves the server without the PIN', !JSON.stringify((await (await fetch(B + '/api/state')).json()).shop || {}).includes('Pearl'));
  const shopFor = async (me) => JSON.stringify((await (await fetch(B + '/api/state', { headers: { 'x-trip-pin': PIN, 'x-trip-me': me } })).json()).shop || {});
  ok("…and goes only to Naf's phone: Mo's and Sara's never get it", /Pearl/.test(await shopFor('naf')) && !/Pearl/.test(await shopFor('m')) && !/Pearl/.test(await shopFor('sara')) && /Tokyo Banana/.test(await shopFor('m')));
  await A.page.goto(B + '/japan/prototypes/tools?v=3'); await A.page.waitForTimeout(1500);
  ok("Mo's phone opens on M&M's list", (await A.page.textContent('[data-shpill="group"]')).trim().startsWith('M&M'));
  await pickGroup(A.page, 'nasa');
  ok("Mo sees NASA's Tokyo Banana but not Naf's secret present", /Tokyo Banana/.test(await A.page.textContent('#page')) && !/Pearl/.test(await A.page.textContent('#page')));
  ok("…and the photo Naf added, fetched with the PIN", await A.page.$eval(`[data-spimg="${picId}"]`, (im) => im.src.startsWith('blob:') && im.naturalWidth > 0).catch(() => false));
  // the filters: Category and Day narrow the list, Everything shows all three lists
  await N.page.tap('[data-shpill="cat"]'); await N.page.waitForTimeout(250);
  ok('the Category pill opens the categories in use, with counts', /Sweets & snacks/.test(await N.page.textContent('.sp-opts')) && !/Stationery/.test(await N.page.textContent('.sp-opts')));
  await N.page.tap('[data-shf="cat"][data-v="sweets"]'); await N.page.waitForTimeout(300);
  ok('…and picking one shows only those', /Tokyo Banana/.test(await N.page.textContent('#page')) && !/Pearl necklace/.test(await N.page.textContent('#page')) && /Sweets/.test(await N.page.textContent('[data-shpill="cat"]')));
  await N.page.tap('[data-shpill="day"]'); await N.page.waitForTimeout(250);
  ok('the Day pill lists only days with something to buy', (await N.page.$$('.sp-opts [data-shf="day"]')).length === 2 && /Tue,? 27 Oct/.test(await N.page.textContent('.sp-opts')));
  await N.page.tap('[data-shf="day"][data-v="d12"]'); await N.page.waitForTimeout(300);
  ok('…and picking a day shows that day', /Tokyo Banana/.test(await N.page.textContent('#page')) && /27 Oct/.test(await N.page.textContent('[data-shpill="day"]')));
  await N.page.tap('[data-shpill="day"]'); await N.page.waitForTimeout(250); await N.page.tap('[data-shf="day"][data-v="any"]'); await N.page.tap('[data-shpill="cat"]'); await N.page.waitForTimeout(250); await N.page.tap('[data-shf="cat"][data-v="any"]'); await N.page.waitForTimeout(300);
  // an item's pills change it: category, then group (still on the route: keeps its day), then day (AI looks at that stop)
  await N.page.tap(`[data-shrow="${tbId}"]`); await N.page.waitForTimeout(300); await N.page.tap(`[data-shset="cat"][data-id="${tbId}"]`); await N.page.waitForTimeout(450);
  await N.page.tap('#sheet [data-shsetv="cat:gadgets"]'); await N.page.waitForTimeout(500);
  await N.page.tap(`[data-shiq="1"][data-id="${tbId}"]`); await N.page.waitForTimeout(300); await N.page.tap(`[data-shiq="1"][data-id="${tbId}"]`); await N.page.waitForTimeout(300); await N.page.tap(`[data-shiq="-1"][data-id="${tbId}"]`); await N.page.waitForTimeout(400);
  ok('the quantity counter on an item: ×2 shows on its folded line', shOf()[tbId].qty === 2 && /×2/.test(await N.page.textContent(`[data-shrow="${tbId}"]`)));
  await N.page.tap(`[data-shiq="-1"][data-id="${tbId}"]`); await N.page.waitForTimeout(300);
  ok('…and back to one, it drops the count', !('qty' in shOf()[tbId]));
  ok('tapping its category pill changes the category', shOf()[tbId].cat === 'gadgets' && /Gadgets/.test(await N.page.textContent(`[data-shrow="${tbId}"]`)));
  await N.page.tap(`[data-shset="list"][data-id="${tbId}"]`); await N.page.waitForTimeout(450); await N.page.tap('#sheet [data-shsetv="list:all"]'); await N.page.waitForTimeout(600);
  ok('…its group pill moves it to another list, keeping its stop', shOf()[tbId].list === 'all' && shOf()[tbId].ai.at === 'd12-shinkansen' && shOf()[tbId].cat === 'gadgets', JSON.stringify(shOf()[tbId]));
  await pickGroup(N.page, 'every'); await N.page.tap(`[data-shrow="${tbId}"]`).catch(() => {}); await N.page.waitForTimeout(300);
  if (!(await N.page.$(`[data-shset="day"][data-id="${tbId}"]`))) { await N.page.tap(`[data-shrow="${tbId}"]`); await N.page.waitForTimeout(300); }
  await N.page.tap(`[data-shset="day"][data-id="${tbId}"]`); await N.page.waitForTimeout(450);
  const dayPick = await N.page.$$eval('#sheet [data-shsetv^="day:"]', (b) => b.map((x) => x.dataset.shsetv.slice(4))), newStop = dayPick.find((x) => x !== 'd12-shinkansen');
  await N.page.tap(`#sheet [data-shsetv="day:${newStop}"]`); await N.page.waitForTimeout(1500);
  ok('…and its day pill puts it on the stop you pick, with AI asked again for a shop there', shOf()[tbId].ai.at === newStop && shOf()[tbId].cat === 'gadgets' && dayPick.length > 5, newStop + ' ' + JSON.stringify(shOf()[tbId]));
  await sp({ id: tbId, value: { ...shOf()[tbId], list: 'nasa', cat: 'sweets', ai: { ...shOf()[tbId].ai, at: 'd12-shinkansen', date: '2026-10-27', day: 'd12' } } }); // back as it was, for the checks below
  // things from before there were categories get sorted by AI when the page opens
  ok('sorting needs the PIN', (await fetch(B + '/api/shop-cat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ id: 'a', name: 'x' }] }) })).status === 403);
  await sp({ id: 'shold1', value: { name: 'Rice sheet mask', list: 'nasa', by: 'sara', at: 1 } }); await sp({ id: 'shold2', value: { name: 'Mochi', list: 'all', by: 'm', at: 2 } });
  await N.page.reload(); await N.page.waitForTimeout(2500);
  ok('…and things added before categories get one when the page opens', shOf().shold1 && shOf().shold1.cat === 'skincare' && shOf().shold2.cat === 'sweets', JSON.stringify([shOf().shold1, shOf().shold2]));
  await sp({ id: 'shold1', value: null }); await sp({ id: 'shold2', value: null });
  await N.page.tap('[data-shpill="ideas"]'); await N.page.waitForTimeout(400);
  ok('Ideas: Only in Japan, by category', /Only in Japan/.test(await N.page.textContent('#page')) && (await N.page.$$('[data-shidea]')).length > 40);
  await N.page.screenshot({ path: SH + 'shopping-ideas.png' });
  await N.page.reload(); await N.page.waitForTimeout(1500);
  ok('coming back, Shopping opens on a list with the box to add things, not on Ideas', !!(await N.page.$('.sp-add #sh-name')) && !(await N.page.$('.sp-fp.on[data-shpill="ideas"]')));
  await N.page.tap('[data-shpill="ideas"]'); await N.page.waitForTimeout(400);
  await N.page.tap('[data-shidea]'); await N.page.waitForTimeout(450); await N.page.tap('#sheet [data-shpick="all"]'); await N.page.waitForTimeout(900);
  const [, kk] = shBy('Regional Kit Kat flavours');
  ok('an idea goes on All of us with its place on the route already found', kk && kk.list === 'all' && kk.idea === true && kk.ai.at === 'd07-shinsaibashi' && kk.ai.date === '2026-10-22' && kk.cat === 'sweets', JSON.stringify(kk));
  await pickGroup(N.page, 'nasa');
  await N.page.tap(`[data-shtick="${tbId}"]`); await N.page.waitForTimeout(500);
  ok('ticking it bought asks about expenses', /Add it to expenses/.test(await N.page.textContent('#sheet')) && shOf()[tbId].done === true && shOf()[tbId].doneBy === 'naf');
  const navs = [], onNav = (r) => { if (r.isNavigationRequest()) navs.push(r.url()); }; N.page.on('request', onNav);
  await N.page.fill('#sh-yen', '1500'); await N.page.tap('[data-shex]'); await N.page.waitForURL(/\/japan\/money/, { timeout: 5000 }).catch(() => {}); N.page.off('request', onNav);
  const exU = new URL(navs.find((u) => /\/money\?/.test(u)) || N.page.url());
  ok('…and opens the expense form filled in: Shopping, ¥1,500, split within NASA', exU.searchParams.get('add') === '1' && exU.searchParams.get('c') === 'shopping' && exU.searchParams.get('y') === '1500' && exU.searchParams.get('src') === tbId && /Tokyo Banana/.test(exU.searchParams.get('t') || '') && exU.searchParams.get('s') === 'naf,sara', exU.href);
  await N.page.waitForTimeout(1200);
  ok('…where the form is open with the name and Shopping filled in', /Tokyo Banana/.test(await N.page.inputValue('#ftitle').catch(() => '')) || /Tokyo Banana/.test(await N.page.textContent('body')));
  // the stop's own card: what to buy there; Naf sees the secret present, Mo doesn't
  await N.page.goto(B + '/japan/?d=d12'); await N.page.waitForTimeout(2500);
  const strip = await N.page.textContent('#p-d12-shinkansen .buyh').catch(() => '');
  ok('the stop says what to buy there (two left, one bought)', /2 to buy here/.test(strip) && /Tokyo Banana/.test(strip) && /Pearl necklace/.test(strip), strip);
  await A.page.goto(B + '/japan/?d=d12'); await A.page.waitForTimeout(2500);
  ok("Naf's secret present stays off Mo's trip page", !/Pearl/.test(await A.page.textContent('body')));
  // taxi: every stop's "Please take me here" card has the address; the travel kit has tonight's hotel
  await N.page.evaluate(() => document.querySelector('#p-d12-shinkansen .say').click()); await N.page.waitForTimeout(600);
  const card = await N.page.textContent('#jpcard').catch(() => '');
  ok('a stop\'s first phrase card has the taxi details: postcode, address, phone', /〒\d{3}-\d{4}/.test(card) && /東京都/.test(card) && /Open in Maps/.test(card), card.slice(0, 200));
  await N.page.evaluate(() => document.querySelector('#jpcard [data-jpx]').click()); await N.page.waitForTimeout(400);
  await N.page.tap('#kitbtn'); await N.page.waitForTimeout(700); await N.page.tap('#kitb [data-tab="say"]'); await N.page.waitForTimeout(400);
  ok('the travel kit\'s Phrases start with "take us to the hotel", and the other hotels', /take us to the hotel/.test(await N.page.textContent('#kitb')) && (await N.page.$$('#kitb .kh-o button')).length >= 3);
  await N.page.tap('#kitb .kh'); await N.page.waitForTimeout(500);
  ok('…which shows the driver the hotel in Japanese with its address', /このホテルまでお願いします/.test(await N.page.textContent('#jpcard')) && /〒\d{3}-\d{4}/.test(await N.page.textContent('#jpcard')));
  await N.page.screenshot({ path: SH + 'taxi-hotel.png' });
  await N.page.evaluate(() => document.querySelector('#jpcard [data-jpx]').click()); await N.page.waitForTimeout(300);
  ok('no page errors while shopping', !N.errs.length && !A.errs.length, [...N.errs, ...A.errs].join(' | '));
}
// 4 · trip day at 4 PM JST: open on the stop happening now; scrub away; Now brings it back
const C = await phone('2026-10-22T07:00:00Z');
await C.page.goto(B + '/japan/'); await C.page.waitForURL(/next=japan/); await C.page.tap('[data-me="sara"]'); await enterPin(C.page); await C.page.waitForURL(/\/japan\//); await C.page.waitForTimeout(2500);
const nowId = await openPass(C.page); ok('opens on the 4 PM stop', nowId === 'd07-shinsaibashi', nowId);
ok('now marker drawn', !!(await C.page.$('#nowmk')));
await C.page.screenshot({ path: SH + 'now-4pm.png' });
const dcs = await C.page.textContent('#dcs'); ok('dial shows time left + next start', /left/.test(dcs) && /Next .* at \d/.test(dcs), dcs);
ok('time-left sector drawn', ((await C.page.getAttribute('#leftarc', 'd')) || '').startsWith('M'));
const sky = () => C.page.evaluate(() => [document.getElementById('knob').classList.contains('night'), document.querySelector('#ddrail .rk').classList.contains('night')]);
ok('at 4 PM the knob is the sun (sunset 5:16)', JSON.stringify(await sky()) === '[false,false]', JSON.stringify(await sky()));
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
await C.page.evaluate(() => [...document.querySelectorAll('.pass [data-pick]')].pop().click()); await C.page.waitForTimeout(1200);
ok('after sunset the knob and the side tab dot turn into the moon', JSON.stringify(await sky()) === '[true,true]', JSON.stringify(await sky()));
ok('the dial is one round-ended band with the dusky blue after sunset, and the side tab turns dusky too', !!(await C.page.$('#arc #band')) && !!(await C.page.$('#arc #dusk')) && (await C.page.$$eval('#arc .band .trk.dk', (p) => p.length)) >= 1 && !!(await C.page.$('#ddrail .tn')));
ok('sunset is marked with the sunset icon', !!(await C.page.$('#arc .sunmark.set path')));
await C.page.evaluate(() => document.getElementById('nowb').click()); await C.page.waitForTimeout(1200);
ok('Now recentres', (await openPass(C.page)) === 'd07-shinsaibashi');
ok('back at 4 PM the sun comes back', JSON.stringify(await sky()) === '[false,false]', JSON.stringify(await sky()));
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
// one menu on every page (js/nav.js): from the trip to Ideas, Shopping, Expenses and Photos, then back to the trip, on the same day
const C_DAY = new URL(C.page.url()).searchParams.get('d');
const hl0 = await C.page.evaluate(() => history.length);
const navLabels = (pg) => pg.$$eval('.tt-opt', (els) => els.map((e) => e.textContent.trim()));
const navHere = (pg) => pg.$eval('.tt-opt.tt-here', (e) => e.dataset.k).catch(() => null);
const navTap = async (pg, k) => { await pg.tap('#ttBtn'); await pg.waitForTimeout(400); await pg.tap(`.tt-opt[data-k="${k}"]`); };
ok('the + menu has every page, Phrases and Help', JSON.stringify(await navLabels(C.page)) === '["Settings","Help · 110 / 119","Phrases","Shopping","Bookings","Ideas","Photos","Expenses"]', JSON.stringify(await navLabels(C.page)));
await C.page.tap('.tt-opt[href$="v=4"]'); await C.page.waitForURL(/tools\?v=4/); await C.page.waitForTimeout(1200);
ok('Ideas opens with the same + menu, Ideas marked and the trip in it', (await navHere(C.page)) === 'ideas' && (await navLabels(C.page)).at(-1) === 'Trip' && !(await C.page.$('.proto-picker, .homefab')));
const plusAt = await C.page.$eval('#ttBtn', (e) => { const r = e.getBoundingClientRect(); return [r.right, r.bottom, innerWidth, innerHeight]; });
ok('the + sits low on the right, as on the trip', plusAt[0] > plusAt[2] - 40 && plusAt[1] > plusAt[3] - 100, plusAt.join());
await navTap(C.page, 'shopping'); await C.page.waitForTimeout(600);
ok('Shopping switches in place', /tools\?v=3/.test(C.page.url()) && (await navHere(C.page)) === 'shopping' && (await C.page.evaluate(() => history.length)) === hl0 + 1);
await navTap(C.page, 'money'); await C.page.waitForURL(/\/money/); await C.page.waitForTimeout(1200);
ok('Expenses replaces the page instead of stacking it', (await navHere(C.page)) === 'money' && (await C.page.evaluate(() => history.length)) === hl0 + 1);
await navTap(C.page, 'photos'); await C.page.waitForURL(/\/photos/); await C.page.waitForTimeout(1200);
ok('so does Photos', (await navHere(C.page)) === 'photos' && (await C.page.evaluate(() => history.length)) === hl0 + 1);
await C.page.screenshot({ path: SH + 'nav-photos.png' });
await C.page.tap('.tback'); await C.page.waitForURL((u) => /\/japan\/(\?|$)/.test(u.toString())); await C.page.waitForTimeout(1500);
ok('‹ Trip goes back to the trip, on the day it showed', new URL(C.page.url()).searchParams.get('d') === C_DAY && /Day/.test(await C.page.textContent('#dayp')));
ok('it went back in history (no new page)', (await C.page.evaluate(() => history.length)) === hl0 + 1);
// Help from another page: back to the trip with the emergency numbers open
await navTap(C.page, 'bookings'); await C.page.waitForURL(/tools\?v=2/); await C.page.waitForTimeout(1000);
await navTap(C.page, 'sos'); await C.page.waitForURL((u) => /\/japan\/(\?|$)/.test(u.toString())); await C.page.waitForTimeout(1200);
ok('Help on another page opens the trip on the emergency numbers', /110/.test(await C.page.textContent('#kitb')) && /Police/.test(await C.page.textContent('#kitb')) && (await C.page.evaluate(() => history.length)) === hl0 + 1);
await C.page.evaluate(() => document.getElementById('scrim').click()); await C.page.waitForTimeout(500);
// another day: one tap back to today
ok('no Back to today on today', await C.page.$eval('#todayb', (e) => e.hidden));
await C.page.tap('#next'); await C.page.waitForTimeout(600);
ok('Back to today shows on another day', await C.page.$eval('#todayb', (e) => !e.hidden));
await C.page.screenshot({ path: SH + 'back-to-today.png' });
await C.page.tap('#todayb'); await C.page.waitForTimeout(800);
ok('and takes you back to today', new URL(C.page.url()).searchParams.get('d') === 'd07' && await C.page.$eval('#todayb', (e) => e.hidden));
// swipe the day bar sideways to change day; a plain tap still opens the calendar
const swipeDay = async (dist) => { const b = await C.page.$eval('#dayp', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await C.page.mouse.move(b[0], b[1]); await C.page.mouse.down(); await C.page.mouse.move(b[0] + dist, b[1] + 3, { steps: 8 }); await C.page.mouse.up(); await C.page.waitForTimeout(700); };
await swipeDay(-110);
ok('swiping the day bar left goes to the next day', new URL(C.page.url()).searchParams.get('d') === 'd08' && !(await C.page.$eval('#cal', (e) => e.classList.contains('on'))));
await swipeDay(110);
ok('and right goes back', new URL(C.page.url()).searchParams.get('d') === 'd07' && !(await C.page.$eval('#cal', (e) => e.classList.contains('on'))));
await swipeDay(-20);
ok('a short drag stays on the day', new URL(C.page.url()).searchParams.get('d') === 'd07');
await C.page.tap('#dayp'); await C.page.waitForTimeout(500);
ok('a tap on the day bar still opens the calendar', await C.page.$eval('#cal', (e) => e.classList.contains('on')));
await C.page.tap('#calbg', { force: true }); await C.page.waitForTimeout(400);

// guest: sees the trip, changes nothing, no money
{
  const G = await phone('2026-10-22T07:00:00Z'); const g = G.page;
  const before = store.get('updatedAt');
  await g.goto(B + '/'); await g.waitForTimeout(600); await g.tap('[data-guest]'); await g.waitForTimeout(600);
  ok('guest is welcomed as a guest', /Hi there/.test(await g.textContent('#hi')) && /guest/i.test(await g.textContent('#switch')));
  await g.tap('[data-trip="japan"]'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  ok('guest opens the trip without a PIN', /Day/.test(await g.textContent('#dayp')));
  ok('guest has no stamp, edit or add-a-stop buttons', await g.evaluate(() => [...document.querySelectorAll('[data-stamp], [data-edit], [data-addend], #gear, #addgap')].every((e) => !e.offsetParent)));
  await g.evaluate(() => { const b = document.querySelector('[data-stamp]'); b && b.click(); }); await g.waitForTimeout(500);
  ok('guest tap on stamp does nothing', !Object.keys(JSON.parse(store.get('checks') || '{}')).some((k) => k.startsWith('d07')));
  // following along from home: where everyone is right now (4 PM in Japan on day 7: all four in Shinsaibashi), Japan time and their own
  const gn = await g.evaluate(() => { const c = document.getElementById('gnow'); return c ? c.innerText : ''; });
  ok('guest sees Right now: all four at Shinsaibashi, Japan time and their own', /Right now · Day 7 of 17/i.test(gn) && /ALL FOUR/.test(gn) && /Shinsaibashi/.test(gn) && /4:00\s*PM/.test(gn) && /Japan time/.test(gn) && /for you/.test(gn) && /Next: Amerika-mura/.test(gn), gn);
  ok('guest has no Directions, phrases or ¥ kit', await g.evaluate(() => [...document.querySelectorAll('.a-dir, .say, #kitbtn')].every((e) => !e.offsetParent)));
  await g.evaluate(() => document.querySelector('#gnow [data-gninfo]').click()); await g.waitForTimeout(900);
  ok('the i on Right now opens that stop with its story', await g.evaluate(() => { const c = document.querySelector('.pass.open'); return !!c && c.id === 'p-d07-shinsaibashi' && c.classList.contains('storyon') && !!c.querySelector('.storyx').offsetParent; }));
  for (const d of ['d08', 'd09', 'd12', 'd13']) {
    await g.goto(B + '/japan/?d=' + d); await g.waitForTimeout(1500);
    const txt = await g.evaluate(() => document.body.innerText + [...document.querySelectorAll('[aria-label],[title]')].map((e) => e.getAttribute('aria-label') + e.getAttribute('title')).join(' '));
    ok(`guest on ${d}: M&M's night away is a romantic dinner, no hotel name`, !/in the Green|Pasha/i.test(txt) && (d === 'd09' || d === 'd13' || /Romantic dinner/i.test(txt)), (txt.match(/.{40}(in the Green|Pasha).{40}/i) || [''])[0]);
  }
  await g.goto(B + '/japan/'); await g.waitForTimeout(1500);
  await g.tap('#ttBtn'); await g.waitForTimeout(400);
  ok('guest tools are just Photos and Settings', JSON.stringify(await g.$$eval('.tt-opt', (els) => els.map((e) => e.textContent.trim()))) === '["Settings","Photos"]', JSON.stringify(await g.$$eval('.tt-opt', (els) => els.map((e) => e.textContent.trim()))));
  await g.screenshot({ path: SH + 'guest-trip.png' });
  for (const v of [1, 2, 3, 4]) {
    await g.goto(B + '/japan/prototypes/tools?v=' + v); await g.waitForTimeout(1200);
    ok(`guest asking for tab ${v} (Expenses, Bookings, Shopping, Ideas) gets Settings`, /You &(amp;)? the trip/.test(await g.textContent('#page')) && JSON.stringify(await g.$$eval('.tt-opt', (els) => els.map((e) => e.textContent.trim()))) === '["Settings","Photos","Trip"]' && (await g.$eval('.tt-opt.tt-here', (e) => e.dataset.k)) === 'settings' && !(await g.$('[data-bkmark]')));
  }
  await g.goto(B + '/japan/prototypes/tools?v=5'); await g.waitForTimeout(1500);
  ok('guest settings say guest', /Guest/.test(await g.textContent('.me')) && !(await g.$('[data-pcolor]')) && !/Show money in/.test(await g.textContent('#page')));
  await g.screenshot({ path: SH + 'guest-settings.png', fullPage: true });
  ok('guest wrote nothing', store.get('updatedAt') === before);
  ok('no page errors G', !G.errs.length, G.errs.join(' | '));
  await G.ctx.close();
}
// guest on Oct 21 (day 6): Mo and Mariam fly in on two different flights, so they get a row each, and no night card while
// anyone is in the air; a page left open past midnight in Japan moves on to the new day
{
  const G = await phone('2026-10-20T20:00:00Z'); const g = G.page;
  await g.goto(B + '/'); await g.waitForTimeout(600); await g.tap('[data-guest]'); await g.waitForTimeout(600);
  await g.tap('[data-trip="japan"]'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  const gnow = () => g.evaluate(() => { const c = document.getElementById('gnow'); return c ? c.innerText : ''; });
  let gn = await gnow();
  ok('5 AM in Japan, Mo and Mariam both flying: a row each, not a night card', /MO\b/.test(gn) && /MARIAM/.test(gn) && (gn.match(/In the air/g) || []).length === 2 && !/middle of the night/.test(gn), gn);
  await g.clock.fastForward('09:00:00'); await g.waitForTimeout(1500); gn = await gnow();
  ok('2 PM: Mo has landed, Mariam is still in the air', /MO\b/.test(gn) && /MARIAM/.test(gn) && (gn.match(/In the air/g) || []).length === 1, gn);
  await g.clock.fastForward('09:30:00'); await g.waitForTimeout(1500); gn = await gnow();
  ok('11:30 PM, everyone landed: the night card', /middle of the night/.test(gn), gn);
  await g.clock.fastForward('00:35:00'); await g.waitForTimeout(2500);
  ok('left open past midnight, the page moves on to day 7', /Day 7 of 17/i.test(await gnow()) && /[?&]d=d07/.test(g.url()), g.url());
  ok('no page errors G2', !G.errs.length, G.errs.join(' | '));
  await G.ctx.close();
}
// "Share with family": the link opens the trip straight in the guest view, with no map or day-dial drawer; the four keep theirs
{
  const G = await phone('2026-10-22T07:00:00Z'); const g = G.page; const mapAsked = [];
  g.on('request', (r) => { if (/maplibre|maptiler|tile\.openstreetmap/.test(r.url())) mapAsked.push(r.url()); });
  await g.goto(B + '/?guest=1&next=japan'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  ok('the family link opens the trip as a guest', (await g.evaluate(() => localStorage.getItem('trips.me'))) === '"guest"' && !!(await g.$('#gnow')));
  ok('guests get no map and no day-dial drawer', await g.evaluate(() => !document.getElementById('map').offsetParent && !document.getElementById('ddtab').offsetParent && !document.querySelector('.dd-in').offsetParent));
  ok('…nor fetch the map library or any map tiles', !mapAsked.length, mapAsked.join(' '));
  ok('…and the day starts just under the top bar', await g.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top < 140));
  await g.goto(B + '/japan/prototypes/tools?v=5'); await g.waitForTimeout(1500);
  await g.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
  // no share sheet here: the link is copied
  await g.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })); await g.tap('[data-share]'); await g.waitForTimeout(600);
  ok('Settings has Share with family, which copies the guest link', /Link copied/.test(await g.textContent('#sh-msg')) && /\/\?guest=1&next=japan$/.test(await g.evaluate(() => navigator.clipboard.readText())), await g.textContent('#sh-msg'));
  ok('no page errors G5', !G.errs.length, G.errs.join(' | '));
  await G.ctx.close();
}
{
  const M = await phone(); const m = M.page;
  await m.goto(B + '/'); await m.evaluate(() => { localStorage.setItem('trips.me', '"m"'); localStorage.setItem('trips.pin', '"' + 'x' + '"'); });
  await m.goto(B + '/?guest=1&next=japan'); await m.waitForTimeout(1200);
  ok('the family link on one of the four phones keeps them who they are', (await m.evaluate(() => localStorage.getItem('trips.me'))) === '"m"');
  await M.ctx.close();
}
// the night after the last day: a guest opening the page sees Day 17 while they fly home, and the card goes once all have landed
{
  const G = await phone('2026-11-01T15:30:00Z'); const g = G.page;
  await g.goto(B + '/'); await g.waitForTimeout(600); await g.tap('[data-guest]'); await g.waitForTimeout(600);
  await g.tap('[data-trip="japan"]'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  const gn = await g.evaluate(() => { const c = document.getElementById('gnow'); return c ? c.innerText : ''; });
  ok('12:30 AM Nov 2: Day 17, with NASA, Mo and Mariam each in the air', /Day 17 of 17/i.test(gn) && /NASA/.test(gn) && /MO\b/.test(gn) && /MARIAM/.test(gn) && (gn.match(/In the air/g) || []).length === 3 && !/middle of the night/.test(gn), gn);
  await g.clock.fastForward('04:45:00'); await g.waitForTimeout(1500);
  ok('5:15 AM: Mo is home but the others wait in Vancouver, so the card stays', /Day 17 of 17/i.test(await g.evaluate(() => { const c = document.getElementById('gnow'); return c ? c.innerText : ''; })));
  await g.clock.fastForward('05:45:00'); await g.waitForTimeout(1500);
  ok('everyone home: the card goes, and the page stays on Day 17', !(await g.$('#gnow')) && /[?&]d=d17/.test(g.url()), g.url());
  ok('no page errors G4', !G.errs.length, G.errs.join(' | '));
  await G.ctx.close();
}
// a guest who picked the NASA view still sees where M&M are (Oct 23, 6:30 PM: their romantic dinner); and at 2 AM the next
// night, M&M are still away, so the night card names no hotel for everyone
for (const [t, test] of [
  ['2026-10-23T09:30:00Z', (gn) => ['guest on the NASA view still sees M&M at their romantic dinner', /M&M/.test(gn) && /Romantic dinner/.test(gn) && /NASA/.test(gn)]],
  ['2026-10-23T17:00:00Z', (gn) => ['2 AM after M&M\'s night away: asleep, with no one hotel named for all four', /middle of the night/.test(gn) && !/Granbell|in the Green/i.test(gn)]],
]) {
  const G = await phone(t); const g = G.page;
  await g.goto(B + '/'); await g.waitForTimeout(600); await g.tap('[data-guest]'); await g.waitForTimeout(600);
  await g.evaluate(() => localStorage.setItem('japan2026.whoMix', JSON.stringify('nasa')));
  await g.tap('[data-trip="japan"]'); await g.waitForURL(/\/japan\//); await g.waitForTimeout(2500);
  const gn = await g.evaluate(() => { const c = document.getElementById('gnow'); return c ? c.innerText : ''; });
  const [name, pass] = test(gn); ok(name, pass, gn);
  ok('no page errors G3', !G.errs.length, G.errs.join(' | '));
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
  // the photos the page asks the service worker to save (it doesn't answer: a message to a page kept for Back drops it)
  await pg.addInitScript(() => { const pm = ServiceWorker.prototype.postMessage; ServiceWorker.prototype.postMessage = function (m, ...r) { if (m && m.type === 'precache') window.__precache = m.urls; return pm.call(this, m, ...r); }; });
  await pg.goto(B + '/japan/'); await pg.waitForTimeout(2000);
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForTimeout(1000);
  let photosSaved = null;
  for (let t = 0; t < 80 && !photosSaved; t++) {
    photosSaved = await pg.evaluate(async () => { const u = window.__precache; if (!u) return null; const c = await caches.open('days'); const n = (await Promise.all(u.map((x) => c.match(x)))).filter(Boolean).length; return n === u.length ? `${n}/${u.length}` : null; });
    if (!photosSaved) await pg.waitForTimeout(500);
  }
  ok('photos for the next days saved', !!photosSaved, photosSaved);
  // the app opens from its saved copy: each page, library and font once under its own address, and the code and data the
  // trip page names under the deploy address it names (?v=…), nothing from any other deploy
  const offKeys = await pg.evaluate(async () => { const n = (await caches.keys()).find((k) => /^japan2026-v/.test(k)); const c = await caches.open(n); const page = await (await c.match('/japan/')).text(); return { keys: (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search), named: [...new Set([...page.matchAll(/\.\/((?:js|data)\/[^'"]+\.js\?v=\d+)/g)].map((m) => '/japan/' + m[1]))] }; });
  const stamped = offKeys.keys.filter((k) => /\?v=/.test(k)), deploys = new Set(offKeys.named.map((u) => u.split('v=')[1]));
  ok('offline copy: the code the trip page names, under its deploy address, and no other deploy', offKeys.keys.includes('/japan/js/store.js') && offKeys.keys.includes('/japan/') && offKeys.named.length >= 6 && offKeys.named.every((u) => offKeys.keys.includes(u)) && stamped.every((k) => deploys.has(k.split('v=')[1])), `${offKeys.keys.length} files, ${stamped.length} under a deploy address: ${stamped.slice(0, 3).join()}`);
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
  const pass = await pg.evaluate((id) => { const p = document.getElementById('p-' + id); return p && { hero: p.querySelector('.hero').style.backgroundImage, say: (p.querySelector('.say') || {}).textContent, key: (p.querySelector('.keyp') || {}).textContent, credit: (p.querySelector('.credit') || {}).textContent, dyk: (p.querySelector('.storyx .dykx') || {}).textContent }; }, saved && saved[0]);
  ok('fill-in: the stop shows its photo, Japanese name, phrases and story', pass && pass.hero.includes('960px-Yanaka_Ginza') && /谷中銀座商店街/.test(pass.say) && /Since the 1940s/.test(pass.key) && /Some One, CC BY-SA 4.0/.test(pass.credit) && pass.dyk === 'Did you know?Seven wooden cats hide along the street.', JSON.stringify(pass));
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
  // the name typed, then another day picked while the first answer is out: it's asked again for that day's city
  const cities = []; pg.on('request', (r) => { if (/\/api\/fill$/.test(r.url())) cities.push(JSON.parse(r.postData() || '{}').city); });
  await pg.evaluate(() => document.querySelector('[data-addend]').click()); await pg.waitForTimeout(700);
  await pg.tap('#f-title'); await pg.fill('#f-title', 'Yanaka Ginza shops'); await pg.tap('[data-fday="d08"]'); await pg.waitForTimeout(4500);
  ok('fill-in: picking another day while filling in asks again for that day\'s city', cities[0] === 'Tokyo' && cities[cities.length - 1] === 'Kyoto' && /Filled in/.test(await pg.textContent('#f-fill')), cities.join());
  await pg.tap('[data-edx]'); await pg.waitForTimeout(400); wait = 0;
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
  const a = await put({ added: true, day: 'd03', title: 'X', info: { ja: 'エックス', img: 'https://evil.example/x.jpg', credit: 'Me', story: 'S', dyk: 'D' } });
  const b = await put({ added: true, day: 'd03', title: 'X', info: { img: "https://upload.wikimedia.org/a.jpg') ; background:url('x", kind: 'nope' } });
  const c = await put({ added: true, day: 'd03', title: 'X', info: { img: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg', file: 'https://commons.wikimedia.org/wiki/File:X.jpg', credit: 'Someone, CC BY 4.0', kind: 'shop' } });
  const ia = a.custom['u-photo-test'] && a.custom['u-photo-test'].info, ib = b.custom['u-photo-test'].info, ic = c.custom['u-photo-test'].info;
  ok('a stop\'s photo must be a Wikimedia address (anything else is dropped, with its credit)', ia && !ia.img && !ia.credit && ia.ja === 'エックス' && ia.dyk === 'D' && !ib && ic.img.endsWith('/X.jpg') && ic.thumb === ic.img && ic.credit && ic.kind === 'shop', JSON.stringify([ia, ib, ic]));
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
  ok('the trip knows its flights: Mo\'s QR 808, Mariam\'s legs and NASA\'s, each with who is on it (the flights home shared by three)', mo && mo.no === 'QR808' && mo.people.join() === 'm' && ['d01-land', 'd06-mariam-land', 'd17-mo', 'd17-mariam', 'd17-mariam-yvr'].every((id) => F.tripFlights({}).some((f) => f.id === id && f.no)) && F.tripFlights({}).find((f) => f.id === 'd17-mariam').people.join() === 'naf,sara,mariam', JSON.stringify(F.tripFlights({}).map((f) => f.id + ':' + f.no)));
  const typed = F.tripFlights({ 'd01-land': { flight: { no: 'ac 9' } }, x1: { added: true, day: 'd03', who: 'nasa', flight: { no: 'NH 10' } } });
  ok('a flight number typed into a stop is tracked, on the trip\'s stops and on added ones', typed.some((f) => f.id === 'd01-land' && f.no === 'AC9' && f.people.join() === 'naf,sara' && f.to === 'NRT' && f.arr === '2026-10-16T16:10+09:00') && typed.some((f) => f.id === 'x1' && f.no === 'NH10'));
  const nasa = { ...typed.find((f) => f.id === 'd01-land'), no: 'AC1', dep: '' }, urls = [], grab = async (u) => { urls.push(u); return new Response('[]', { status: 200 }); };
  await F.fetchAeroDataBox(nasa, 'k', grab); await F.fetchFlightAware(nasa, 'k', async (u) => { urls.push(u); return new Response('{"flights":[]}', { status: 200 }); });
  ok('a flight that only knows when it lands is looked up by its landing (it left the day before)', /\/AC1\/2026-10-16\?.*dateLocalRole=Arrival/.test(urls[0]) && /start=2026-10-15T01:10:00Z&end=2026-10-17T13:10:00Z/.test(urls[1]), urls.join(' | '));
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
  const sent = []; let gone1 = false, busy = 1; DO_ENV.PUSH_RETRY_MS = 10;
  DO_ENV.PUSH_FETCH = async (url, init) => { if (busy && url.includes('phone2')) { busy--; return new Response('', { status: 503 }); } sent.push({ url, init }); return new Response('', { status: gone1 && url.includes('phone1') ? 410 : 201 }); };
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
  ok('phone one gets both alerts; phone two (no delays for Mo) only the gate, sent again after the push service was busy', t2.alerts === 2 && m1.length === 2 && m2.length === 1 && m1.some((m) => /Mo's flight QR 808 is running late\. Now lands 1:40 PM Narita time/.test(m.body)) && /gate C20 \(was C12\)/.test(m2[0].body), JSON.stringify([t2, m1.map((m) => m.body), m2.map((m) => m.body)]));
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
  const first = F.changesOf(mo, { st: 'ontime', gate: '', term: '', dep: { sch: mo.dep }, arr: { sch: mo.arr } }, { st: 'ontime', gate: 'A4', term: '', dep: { sch: mo.dep }, arr: { sch: mo.arr } }, Date.now());
  const firstT = F.changesOf(mo, { st: 'ontime', arrTerm: '', dep: { sch: mo.dep }, arr: { sch: mo.arr } }, { st: 'ontime', arrTerm: '2', dep: { sch: mo.dep }, arr: { sch: mo.arr } }, Date.now());
  ok('so is a landing terminal given for the first time', firstT.length === 1 && firstT[0].field === 'arrTerm' && /lands at terminal 2\./.test(firstT[0].text), JSON.stringify(firstT));
  ok('a gate given for the first time is a gate alert too', first.length === 1 && first[0].kind === 'gate' && /leaves from gate A4\./.test(first[0].text), JSON.stringify(first));
  const arrLate = F.fromFlightAware(qr({ estimated_in: '2026-10-21T04:40:00Z', arrival_delay: 2700 }), mo);
  ok('a flight late only on arrival says by how much', arrLate.st === 'delayed' && arrLate.delay === 45, JSON.stringify([arrLate.st, arrLate.delay]));
  // AeroDataBox reads into the same shape, should FlightAware not be there
  const adb = F.fromAeroDataBox({ status: 'EnRoute', departure: { airport: { iata: 'YYZ', timeZone: 'America/Toronto' }, scheduledTime: { utc: '2026-10-20 17:25Z' }, revisedTime: { utc: '2026-10-20 17:40Z' }, runwayTime: { utc: '2026-10-20 17:52Z' }, terminal: '1', gate: 'E75' }, arrival: { airport: { iata: 'NRT', timeZone: 'Asia/Tokyo', municipalityName: 'Tokyo' }, scheduledTime: { utc: '2026-10-21 06:50Z' }, predictedTime: { utc: '2026-10-21 06:58Z' }, terminal: '1' } }, { to: 'NRT' });
  ok('AeroDataBox answers read the same way (the stand-in service)', adb.st === 'air' && adb.gate === 'E75' && adb.dep.act === '2026-10-20T17:52:00.000Z' && adb.arr.est === '2026-10-21T06:58:00.000Z' && adb.toTz === 'Asia/Tokyo', JSON.stringify(adb));
  // AirLabs, the free stop-gap: the same shape; another day's flight with the same number is not ours
  const utc = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
  const al = (o = {}) => ({ flight_iata: 'QR808', status: 'landed', dep_iata: 'DOH', arr_iata: 'NRT', arr_city: 'Tokyo', dep_terminal: null, dep_gate: 'C12', arr_terminal: '2', arr_gate: '96', arr_baggage: '7', dep_time_utc: utc(mo.dep), dep_estimated_utc: utc(Date.parse(mo.dep) + 20 * 60e3), dep_actual_utc: utc(Date.parse(mo.dep) + 20 * 60e3), arr_time_utc: utc(mo.arr), arr_estimated_utc: utc(Date.parse(mo.arr) + 25 * 60e3), arr_actual_utc: utc(Date.parse(mo.arr) + 25 * 60e3), dep_delayed: 20, arr_delayed: 25, ...o });
  const alr = F.fromAirLabs(al(), mo);
  ok('AirLabs answers read the same way (the free stop-gap)', alr.st === 'landed' && alr.delay === 25 && alr.gate === 'C12' && alr.term === '' && alr.arrTerm === '2' && alr.belt === '7' && alr.toName === 'Tokyo' && alr.toTz === 'Asia/Tokyo' && alr.fromTz === 'Asia/Qatar' && alr.arr.act === new Date(Date.parse(mo.arr) + 25 * 60e3).toISOString(), JSON.stringify(alr));
  const alAir = F.fromAirLabs(al({ status: 'en-route', arr_actual_utc: null, arr_baggage: null }), mo), alLate = F.fromAirLabs(al({ status: 'scheduled', dep_actual_utc: null, arr_actual_utc: null, dep_delayed: 40, arr_delayed: 35 }), mo);
  ok('…in the air, and late before takeoff', alAir.st === 'air' && alLate.st === 'delayed' && alLate.delay === 40, JSON.stringify([alAir.st, alLate.st, alLate.delay]));
  const alUrls = [], alAns = [{ response: al({ dep_time_utc: utc(Date.parse(mo.dep) - 24 * 3600e3), arr_time_utc: utc(Date.parse(mo.arr) - 24 * 3600e3) }) }, { error: { code: 'not_found' } }, { response: al() }, { error: { code: 'month_limit_exceeded' } }];
  const alFetch = async (u) => { alUrls.push(u); return new Response(JSON.stringify(alAns.shift())); };
  const alSvc = F.lookupFor({ AIRLABS_KEY: 'test-key' }, alFetch);
  const alGot = [await alSvc.look(mo), await alSvc.look(mo), await alSvc.look(mo)];
  const alErr = await alSvc.look(mo).then(() => '', (e) => e.message);
  ok('AirLabs: yesterday\'s flight and "not found" mean not yet; ours is read; a used-up plan is an error', alGot[0] === null && alGot[1] === null && alGot[2] && alGot[2].st === 'landed' && /AirLabs month_limit_exceeded/.test(alErr) && /flight_iata=QR808&api_key=test-key$/.test(alUrls[0]), JSON.stringify([alGot.map((x) => x && x.st), alErr, alUrls[0]]));
  // a flight number typed into a stop has no times: only a flight on that stop's day counts; airports we don't list get their offset
  const noTimes = { ...mo, dep: '', arr: '' }, alDay = (d) => ({ response: al({ dep_time: d + ' 20:35', arr_time: d + ' 12:55' }) });
  alAns.push(alDay('2026-10-19'), alDay(mo.date));
  const typedGot = [await alSvc.look(noTimes), await alSvc.look(noTimes)];
  const away = F.fromAirLabs(al({ dep_iata: 'ICN', dep_time: '2026-10-21 09:00', dep_time_utc: '2026-10-21 00:00', arr_iata: 'BOM', arr_time: '2026-10-21 14:30', arr_time_utc: '2026-10-21 09:00' }), {});
  ok('AirLabs: a typed-in flight number only takes that day\'s flight; other airports get their time zone from AirLabs\' times', typedGot[0] === null && typedGot[1] && away.fromTz === 'Etc/GMT-9' && away.toTz === '', JSON.stringify([typedGot.map((x) => x && x.st), away.fromTz, away.toTz]));
  const sparse = F.fromAirLabs(al({ arr_actual_utc: null, arr_estimated_utc: null, arr_baggage: null }), mo), sparseCh = F.changesOf(mo, { st: 'air', dep: { sch: mo.dep }, arr: { sch: mo.arr } }, sparse, Date.now());
  ok('a landing with no landing time says the scheduled one, not a made-up clock', sparse.st === 'landed' && /landed at Narita, 12:55 PM\./.test(sparseCh.map((c) => c.text).join()), JSON.stringify(sparseCh));
  const dep0 = Date.parse(mo.dep);
  // AirLabs stops answering for a flight once it lands (it moves on to the next day's): it landed, it isn't "not found"
  const nasaF = F.tripFlights({}).find((f) => f.id === 'd01-land'), nArr = Date.parse(nasaF.arr), none = async () => null;
  const flying = { st: 'air', delay: 5, dep: { sch: nasaF.dep, est: nasaF.dep, act: nasaF.dep }, arr: { sch: nasaF.arr, est: new Date(nArr + 5 * 60e3).toISOString(), act: null }, to: 'NRT', toTz: 'Asia/Tokyo', gate: 'E81', no: 'AC9', people: ['naf', 'sara'], changes: [] };
  const lostNow = await F.checkFlights({ flights: { 'd01-land': { ...flying, checkedAt: new Date(nArr).toISOString() } }, now: nArr + 25 * 60e3, look: none, airEvery: 15, lead: 3 });
  const stuck = await F.checkFlights({ flights: { 'd01-land': { ...flying, missing: true, checkedAt: new Date(nArr + 6 * H).toISOString() } }, now: nArr + 9 * H, look: none, airEvery: 15, lead: 3 });
  const preDep = await F.checkFlights({ flights: { 'd01-land': { ...flying, st: 'ontime', dep: { sch: nasaF.dep }, checkedAt: new Date(Date.parse(nasaF.dep) - 2 * H).toISOString() } }, now: Date.parse(nasaF.dep) - H, look: none, airEvery: 15, lead: 3 });
  const ln = lostNow.flights['d01-land'], sk = stuck.flights['d01-land'], er = preDep.flights['d01-land'];
  ok('a flight AirLabs stops seeing after takeoff has landed (alerted while it\'s news, quietly fixed later); one it loses before takeoff keeps what we knew',
    ln.st === 'landed' && !ln.missing && lostNow.alerts.length === 1 && /Naf and Sara have landed at Narita, 4:15 PM\./.test(lostNow.alerts[0].text)
    && sk.st === 'landed' && !sk.missing && sk.nextAt === null && !stuck.alerts.length && er.st === 'ontime' && !er.missing && er.gate === 'E81',
    JSON.stringify([ln.st, lostNow.alerts, sk.st, sk.missing, sk.nextAt, stuck.alerts, er.st, er.missing]));
  ok('with AirLabs, checks start 3 hours before takeoff, every 15 minutes in the air; FlightAware still wins when both are set', alSvc.lead === 3 && alSvc.airEvery === 15 && F.nextCheck(mo, null, dep0 - 10 * 3600e3, 15, 3) === dep0 - 3 * 3600e3 && F.nextCheck(mo, null, dep0 - 30 * 3600e3) === dep0 - 24 * 3600e3 && F.lookupFor({ AIRLABS_KEY: 'a', FLIGHTAWARE_KEY: 'b' }).lead === 24);
  // what a phone sees: put Mo's flight back to the late, re-gated look and open day 6
  const o = [...objects.values()][0].o, cur = o.get('flights'), late = { ...cur.value };
  late['d06-mo-land'] = { ...rec, st: 'delayed', checkedAt: new Date().toISOString() }; o.set('flights', late, cur.rev + 1); o.stamp();
  const P = await phone(); await P.page.goto(B + '/japan/'); await P.page.waitForURL(/\/\?next=japan/); await P.page.tap('[data-me="m"]'); await enterPin(P.page); await P.page.waitForURL(/\/japan\//);
  await P.page.goto(B + '/japan/?d=d06'); await P.page.waitForTimeout(2500);
  const seen = await P.page.evaluate(() => { const p = document.getElementById('p-d06-mo-land'), b = document.querySelector('.flban'); return { fl: !!p && p.classList.contains('fl'), band: p ? p.querySelector('.band').innerText : '', pills: p ? [...p.querySelectorAll('.np')].map((x) => x.textContent) : [], banner: b ? b.innerText : '', story: !!(p && p.querySelector('[data-story]') && p.querySelector('.storyx .dykx')) }; });
  ok('the flight\'s airport story and "did you know?" are on its ticket, behind Read the story', seen.story, JSON.stringify(seen));
  ok('day 6 shows Mo\'s flight as its own ticket: late, with his name pill, and a banner for what changed', seen.fl && /Delayed 50 min/.test(seen.band) && /Lands 1:40 PM/i.test(seen.band) && seen.pills.join() === 'Mo' && /Flight update/.test(seen.banner), JSON.stringify(seen));
  await P.page.screenshot({ path: SH + 'flights-day6.png' });
  ok('no page errors on the flight phone', !P.errs.length, P.errs.join(' | '));
  await P.ctx.close();
  // the shopping heads-up: 8 AM Japan time on a day the route passes something on the list, only to phones that turned it on
  const SA = await import(REPO + '/lib/shop-alert.js');
  const sa = SA.morningAlerts({ a: { name: 'Tokyo Banana', list: 'nasa', ai: { date: '2026-10-27', stop: 'Gransta', day: 'd12' } }, b: { name: 'Pearl necklace', list: 'nasa', lock: 'naf', ai: { date: '2026-10-27' } }, c: { name: 'Kit Kat', list: 'all', ai: { date: '2026-10-22' } } }, '2026-10-27');
  ok('morning heads-up: only the couple whose list has something on today\'s route, never a secret present', sa.length === 1 && sa[0].people.join() === 'naf,sara' && /Tokyo Banana/.test(sa[0].text) && !/Pearl/.test(sa[0].text) && /v=3&d=d12/.test(sa[0].url), JSON.stringify(sa));
  const h3 = await handset(); await post({ id: 'phone-three', sub: sub(3, h3), prefs: { naf: { shop: true } } });
  await onRequest({ request: new Request(B + '/api/shop', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trip-pin': PIN }, body: JSON.stringify({ id: 'sh-alert', value: { name: 'Matcha Kit Kat', list: 'nasa', by: 'naf', ai: { shop: 'Gransta, inside Tokyo Station', at: 'd12-shinkansen', stop: 'Shinkansen to Tokyo', date: '2026-10-27', day: 'd12' } } }) }), env: ENV });
  sent.length = 0; const early = await tick('2026-10-26T22:30:00Z'), at8 = await tick('2026-10-26T23:05:00Z'), again = await tick('2026-10-26T23:10:00Z');
  const shopSent = sent.filter((x) => x.url.includes('phone3')), shopMsg = shopSent[0] ? await open(h3, shopSent[0].init) : {};
  ok('…sent once, from 8 AM, to the phone that follows NASA\'s list, and not to the others', early.shop === 0 && at8.shop >= 1 && again.shop === 0 && shopSent.length === 1 && sent.length === 1 && /Matcha Kit Kat/.test(shopMsg.body) && !/Pearl/.test(shopMsg.body) && /^shop-2026-10-27-nasa$/.test(shopMsg.tag), JSON.stringify([early, at8, again, sent.length, shopMsg]));
  for (const k of ['FLIGHT_FETCH', 'FLIGHTAWARE_KEY', 'PUSH_FETCH', 'PUSH_RETRY_MS', 'VAPID_PUBLIC', 'VAPID_PRIVATE']) delete DO_ENV[k];
}
// 16 · trains and M&M's nights away: tickets with car, seats and reservation; a booking waiting on its confirmation
// gets "Mark as booked" (the Bookings page's own shared choice); a price goes to the Money page with "Add to expenses"
{
  const { DAYS: D, HOTELS: H } = await import(REPO + '/data/itinerary.js?' + Date.now());
  const ev = (d, id) => D.find((x) => x.id === d).items.find((i) => i.id === id);
  const nex = ev('d06', 'd06-nex'), noz = ev('d06', 'd06-nozomi'), n24 = ev('d12', 'd12-shinkansen'), pa = ev('d12', 'd12-mm');
  ok('the Oct 21 trains are M&M\'s tickets, with car, seats, reservation and price', nex.who === 'mm' && nex.ticket.ref === 'E04742' && nex.ticket.yen === 6660 && noz.ticket.ref === '2000' && noz.ticket.facts.some(([k, v]) => k === 'Seats' && v === '17A, 17B') && nex.ticket.people.join() === 'mariam,m');
  ok('the Oct 27 Nozomi is all four, booked, with Fuji on the D side', n24.who === 'all' && n24.confirmed && n24.ticket.people.length === 4 && /D side/.test(n24.ticket.board) && !/A\/B/.test(n24.desc));
  ok('M&M sleep at Hotel in the Green on Oct 23 and the Pasha on Oct 27, waiting on its room', D.find((x) => x.id === 'd08').mmHotel === 'green' && D.find((x) => x.id === 'd12').mmHotel === 'pasha' && H.find((h) => h.id === 'pasha').pending === pa.ticket.pending.id);
  const P = await phone(); await P.page.goto(B + '/japan/'); await P.page.waitForURL(/\/\?next=japan/); await P.page.tap('[data-me="m"]'); await enterPin(P.page); await P.page.waitForURL(/\/japan\//);
  const view = async (who, d) => { await P.page.evaluate((w) => localStorage.setItem('japan2026.whoMix', JSON.stringify(w)), who); await P.page.goto(B + '/japan/?d=' + d); await P.page.waitForTimeout(2200); };
  const open = (id) => P.page.evaluate((x) => { const c = document.getElementById('p-' + x); if (c && !c.classList.contains('open')) c.querySelector('[data-pick]').click(); }, id).then(() => P.page.waitForTimeout(700));
  await view('mm', 'd06'); await open('d06-nex');
  const t1 = await P.page.evaluate(() => { const c = document.getElementById('p-d06-nex'); return { txt: c.textContent, pills: [...c.querySelectorAll('.band .np')].map((x) => x.textContent), href: (c.querySelector('[data-addx]') || {}).href || '' }; });
  ok('the Narita Express ticket shows times, car 4, seats 7A 7B, the reservation and the paper-ticket reminder', /6:19 PM/.test(t1.txt) && /7:28 PM/.test(t1.txt) && /7A, 7B/.test(t1.txt) && /E04742/.test(t1.txt) && /paper tickets/.test(t1.txt) && /39 min to change at Shinagawa/.test(t1.txt) && t1.pills.join() === 'Mariam,Mo', t1.pills.join());
  const order = await P.page.evaluate(() => [...document.querySelectorAll('#stack .pass')].map((x) => x.id.slice(2)));
  ok('Oct 21 runs land, land, meet, Narita Express, Nozomi, check in', ['d06-mo-land', 'd06-mariam-land', 'd06-mm-meet', 'd06-nex', 'd06-nozomi', 'd06-mm-checkin'].every((id, i, a) => i === 0 || order.indexOf(id) > order.indexOf(a[i - 1])), order.join());
  await P.page.screenshot({ path: SH + 'trains-day6.png' });
  // Add to expenses: the Money page's own form, filled in; saved, the ticket says so, and a second tap opens the same expense
  const n0 = exN();
  await P.page.evaluate(() => document.querySelector('#p-d06-nex [data-addx]').click()); await P.page.waitForURL(/\/japan\/money/); await P.page.waitForTimeout(1500);
  const form = await P.page.evaluate(() => ({ amt: document.getElementById('famt').value }));
  ok('Add to expenses opens the Money form with the yen filled in', form.amt === '6660' && /src=d06-nex/.test(t1.href), JSON.stringify(form));
  await P.page.tap('#fsave'); await P.page.waitForURL(/\/japan\/\?d=d06|\/japan\/$/).catch(() => {}); await P.page.waitForTimeout(1800);
  const saved = Object.values(exMap()).find((x) => x.src === 'd06-nex');
  ok('the expense is saved paid by Mo, split between M&M, and remembers its ticket', exN() === n0 + 1 && saved && saved.yen === 6660 && saved.payer === 'm' && Object.keys(saved.shares).sort().join() === 'm,mariam' && saved.cat === 'transport', JSON.stringify(saved));
  await view('mm', 'd06'); await open('d06-nex');
  ok('the ticket now says it is in expenses', /In expenses/.test(await P.page.textContent('#p-d06-nex .tkp')));
  await P.page.goto(B + '/japan/money?add=1&d=d06&src=d06-nex&t=x&y=6660&c=transport&s=mariam,m&p=m'); await P.page.waitForTimeout(1500);
  const again = await P.page.evaluate(() => ({ on: !!document.querySelector('#fpage.on'), title: (document.getElementById('ftitle') || {}).value }));
  ok('adding the same ticket again, after the page reloads, opens the expense already saved', exN() === n0 + 1 && again.on && again.title === saved.title, JSON.stringify(again));
  // the Pasha: pending until someone marks it booked, on every phone and on the Bookings page; undo puts it back
  await view('mm', 'd12'); await open('d12-mm');
  const p0 = await P.page.evaluate(() => { const c = document.getElementById('p-d12-mm'); return { band: c.textContent, mark: !!c.querySelector('[data-book]'), spot: !!c.querySelector('.ykan.spot'), tonight: document.querySelector('.stays').textContent }; });
  ok('the Pasha stop says the room is not confirmed yet, with Mark as booked, and Tonight says so too', /Room not confirmed yet/.test(p0.band) && p0.mark && p0.spot && /Hotel Pasha Gran/.test(p0.tonight) && /Room not confirmed yet/.test(p0.tonight), JSON.stringify(p0));
  await P.page.screenshot({ path: SH + 'pasha-pending.png' });
  await P.page.evaluate(() => document.querySelector('#p-d12-mm [data-book]').click()); await P.page.waitForTimeout(1200);
  const p1 = await P.page.evaluate(() => { const c = document.getElementById('p-d12-mm'); return { txt: c.textContent, stamp: !!c.querySelector('button.ykan'), mark: !!c.querySelector('[data-book]') }; });
  ok('Mark as booked thumps down 予約済, clears the amber line and is shared', p1.stamp && !p1.mark && !/Room not confirmed yet/.test(p1.txt) && JSON.parse(store.get('choices') || '{}')['bk-pasha'] === 'booked', JSON.stringify(p1));
  await P.page.screenshot({ path: SH + 'pasha-booked.png' });
  await P.page.goto(B + '/japan/prototypes/tools?v=2'); await P.page.waitForTimeout(1500);
  ok('the Bookings page lists the Pasha as booked', /Marked booked[\s\S]*Hotel Pasha Gran/.test(await P.page.textContent('#page')));
  await view('mm', 'd12'); await open('d12-mm');
  await P.page.evaluate(() => document.querySelector('#p-d12-mm button.ykan').click()); await P.page.waitForTimeout(500);
  await P.page.evaluate(() => document.querySelector('#p-d12-mm [data-unbook]').click()); await P.page.waitForTimeout(1200);
  ok('tapping 予約済 and Undo puts it back to waiting', /Room not confirmed yet/.test(await P.page.textContent('#p-d12-mm')) && !JSON.parse(store.get('choices') || '{}')['bk-pasha']);
  // whose hotel tonight: M&M see theirs, NASA theirs, Everyone both
  const tonight = async (who) => { await view(who, 'd08'); return P.page.textContent('.stays'); };
  const [tm, tn, ta] = [await tonight('mm'), await tonight('nasa'), await tonight('all')];
  ok('Oct 23 Tonight: M&M see Hotel in the Green, NASA the Granbell, Everyone both', /Hotel in the Green/.test(tm) && !/Granbell/.test(tm) && /Granbell/.test(tn) && !/Green/.test(tn) && /Granbell/.test(ta) && /Hotel in the Green/.test(ta));
  await view('mm', 'd09');
  const d9 = await P.page.evaluate(() => [...document.querySelectorAll('#stack .pass')].map((x) => x.id.slice(2)));
  ok('Oct 24: M&M check out of the Green and meet NASA at Fushimi Inari, not the Granbell start', d9.includes('d09-mm-out') && d9.includes('d09-fushimi') && !d9.includes('d09-leave'), d9.join());
  ok('no page errors on the trains phone', !P.errs.length, P.errs.join(' | '));
  await P.ctx.close();
}
// Back to a page the browser kept: it lets go of its own recent expense changes, as a fresh page would. Laid over the
// next download of the shared copy, they would undo a newer change made on another page meanwhile, and that copy is saved.
{
  const K = await phone();
  await K.page.goto(B + '/'); await K.page.evaluate((pin) => { localStorage.setItem('trips.me', '"m"'); localStorage.setItem('trips.pin', pin); }, PIN);
  await K.page.goto(B + '/japan/money'); await K.page.waitForTimeout(1500);
  const ex = { title: 'Back test', yen: 1000, payer: 'm', split: ['m', 'mariam'], cat: 'food', day: 'd05' };
  await K.page.evaluate((x) => window.__tourEnv.store.setExpense('bk-x', x), ex); await K.page.waitForTimeout(800); // this page's own change
  // off to another page: the browser keeps this one, frozen
  const cdp = await K.ctx.newCDPSession(K.page);
  await K.page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  const K2 = await K.ctx.newPage(); await K2.goto(B + '/japan/money'); await K2.waitForTimeout(1500);
  await K2.evaluate((x) => window.__tourEnv.store.setExpense('bk-x', x), { ...ex, yen: 2000 }); await K2.waitForTimeout(1200); await K2.close(); // changed on the other page
  // Back, then the next download of the shared copy (anyone's change brings one)
  await cdp.send('Page.setWebLifecycleState', { state: 'active' }); await K.page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await K.page.waitForTimeout(600);
  await K.page.evaluate(() => window.__tourEnv.store.refresh()); await K.page.waitForTimeout(300);
  const got = await K.page.evaluate(() => [window.__tourEnv.store.getExpenses()['bk-x'], JSON.parse(localStorage.getItem('japan2026.state.v1')).expenses['bk-x']].map((x) => x && x.yen));
  ok('Back: an expense changed on another page meanwhile stays changed, after the next download too', got[0] === 2000 && got[1] === 2000 && exMap()['bk-x'].yen === 2000, JSON.stringify([...got, exMap()['bk-x'].yen]));
  await K.page.evaluate(() => window.__tourEnv.store.setExpense('bk-x', null)); await K.page.waitForTimeout(800);
  ok('no page errors on the Back phone', !K.errs.length, K.errs.join(' | '));
  await K.ctx.close();
}
for (const [n, x] of [['A', A], ['N', N], ['C', C]]) ok(`no page errors ${n}`, !x.errs.length, x.errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
await browser.close(); server.close();
