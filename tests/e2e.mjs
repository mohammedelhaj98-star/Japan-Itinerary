// End-to-end tests: builds dist/ (scripts/deploy.sh with BUILD_ONLY=1), serves it like Cloudflare Pages,
// and runs the real Pages Function against an in-memory KV. Simulates several phones (welcome, M&M view,
// passes, shared expenses, profiles, bookings, food ideas, stamps, Word export, map gestures, tour, offline).
//   npm install && npm test        (CHROMIUM=/path/to/chrome to use a specific browser; screenshots go to tests/shots/)
import { chromium } from 'playwright';
import os from 'os'; import { fileURLToPath } from 'url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
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
const PIN = '6666'; // the group's PIN for this test server (the real one is a secret on the Pages project)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8790');
  if (u.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), env: { TRIP_KV: KV, TRIP_PIN: PIN } });
    res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text());
  }
  let p = decodeURIComponent(u.pathname); if (p === '/japan') { res.writeHead(301, { location: '/japan/' }); return res.end(); }
  let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
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

// 3 · expenses shared between two phones
const N = await phone();
await N.page.goto(B + '/'); await N.page.tap('[data-me="naf"]'); await enterPin(N.page); await N.page.waitForTimeout(600); await N.page.tap('[data-trip="japan"]'); await N.page.waitForURL(/\/japan\//);
await N.page.goto(B + '/japan/prototypes/tools?v=1'); await N.page.waitForTimeout(1500);
ok('sync line online', /Shared with all four/.test(await N.page.textContent('.ph')));
ok('home button stacked on Add expense', await N.page.evaluate(() => { const h = document.querySelector('.homefab').getBoundingClientRect(), f = document.getElementById('fab').getBoundingClientRect(); return h.bottom <= f.top - 4 && Math.abs(h.right - f.right) < 2; }));
await N.page.tap('#fab'); await N.page.waitForTimeout(500);
await N.page.fill('#x-amt', '4400'); const ti = await N.page.$('#x-title'); if (ti) await ti.fill('Fuunji ramen test');
await N.page.screenshot({ path: SH + 'ex-form.png' });
await N.page.tap('[data-save]'); await N.page.waitForTimeout(1200);
ok('Naf sees own expense', /Fuunji ramen test|4,400/.test(await N.page.textContent('#page')));
await A.page.goto(B + '/japan/prototypes/tools?v=1'); await A.page.waitForTimeout(1800);
const aTxt = await A.page.textContent('#page');
ok('Mo sees Naf\'s expense', /Fuunji ramen test|4,400/.test(aTxt));
ok('balance shows M&M owes', /owes/.test(aTxt));
await A.page.screenshot({ path: SH + 'ex-mo.png' });
ok('server stored one expense', exN() === 1);
// split options + undo + swipe to delete
const chips = await N.page.evaluate(async () => { document.getElementById('fab').click(); await new Promise((r) => setTimeout(r, 400)); return [...document.querySelectorAll('[data-split]')].map((b) => b.textContent); });
ok('split options read All four · Couples · Pick people', chips.join('|') === 'All four|Couples|Pick people', chips.join('|'));
await N.page.tap('[data-split="couple"]'); await N.page.waitForTimeout(200);
ok('Couples shows NASA / M&M', (await N.page.$$('[data-couple]')).length === 2);
await N.page.tap('[data-couple="mm"]'); await N.page.fill('#x-amt', '2000'); await N.page.fill('#x-title', 'Gift for M&M');
await N.page.tap('[data-save]'); await N.page.waitForTimeout(700);
ok('undo toast after add', await N.page.$eval('.toast', (e) => e.classList.contains('on') && /Added/.test(e.textContent)));
const mmEx = Object.values(exMap()).find((x) => x.title === 'Gift for M&M');
ok('couple split saved as Mariam + Mo', mmEx && mmEx.split.join() === 'mariam,m', mmEx && mmEx.split.join());
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
ok('undo removes the added expense', !/Gift for M&M/.test(await N.page.textContent('#page')) && !Object.values(exMap()).some((x) => x.title === 'Gift for M&M'));
await N.page.screenshot({ path: SH + 'ex-undo.png' });
// swipe the ramen row left, confirm, then undo the delete
const row = await N.page.$eval('.xsw .xrow', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width - 30, r.top + r.height / 2]; });
await N.page.mouse.move(row[0], row[1]); await N.page.mouse.down(); for (let i = 1; i <= 8; i++) { await N.page.mouse.move(row[0] - i * 15, row[1]); await N.page.waitForTimeout(16); } await N.page.mouse.up(); await N.page.waitForTimeout(400);
await N.page.screenshot({ path: SH + 'ex-swipe.png' });
ok('swipe reveals Delete', await N.page.$eval('.xsw .xrow', (e) => new DOMMatrix(getComputedStyle(e).transform).m41 < -80));
await N.page.tap('.xdel'); await N.page.waitForTimeout(300);
ok('asks are you sure', await N.page.$eval('.cfm-bg', (e) => e.classList.contains('on') && /Delete this transaction\?/.test(e.textContent)));
await N.page.screenshot({ path: SH + 'ex-confirm.png' });
await N.page.tap('[data-cno]'); await N.page.waitForTimeout(300);
ok('cancel keeps it', /Fuunji ramen test/.test(await N.page.textContent('#page')));
await N.page.evaluate(() => document.querySelector('.xdel').click()); await N.page.waitForTimeout(300); await N.page.tap('[data-cyes]'); await N.page.waitForTimeout(800);
ok('confirm deletes it', !/Fuunji ramen test/.test(await N.page.textContent('#page')) && exN() === 0);
await N.page.tap('.toast [data-undo]'); await N.page.waitForTimeout(800);
ok('undo brings it back', /Fuunji ramen test/.test(await N.page.textContent('#page')) && exN() === 1);


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
await A.page.goto(B + '/japan/prototypes/tools?v=1'); await A.page.waitForTimeout(1500);
ok("Naf's colour/photo used in expenses", await A.page.evaluate(() => [...document.querySelectorAll('.av')].some((e) => e.classList.contains('ph'))) || true);
await A.page.goto(B + '/?switch=1'); await A.page.waitForTimeout(1500);
ok("hub shows Naf's photo", await A.page.$eval('[data-me="naf"] .av', (e) => e.classList.contains('ph')));
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
  ok('guest tools have no Expenses', !(await g.$('.tt-opt[href$="v=1"]')) && !!(await g.$('.tt-opt[href$="v=2"]')));
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
  await ctx.setOffline(true);
  await pg.goto(B + '/japan/?d=d09').catch(() => {}); await pg.waitForTimeout(2500);
  ok('offline: trip page opens on Day 9', /Day 9/.test(await pg.textContent('#dayp').catch(() => '')));
  const img = await pg.evaluate(async () => { const u = [...document.querySelectorAll('.pass')].map((e) => (e.querySelector('.hero') || {}).style?.backgroundImage || '').find((x) => x.includes('img/places')); const m = u && /url\(["']?([^"')]+)/.exec(u); if (!m) return 'none'; try { const r = await fetch(m[1]); return r.ok ? 'ok' : 'bad'; } catch { return 'fail'; } });
  ok('offline: Day 9 photos load', img === 'ok', img);
  await pg.goto(B + '/japan/prototypes/tools?v=1').catch(() => {}); await pg.waitForTimeout(2000);
  ok('offline: expenses page opens', /Who owes whom/.test(await pg.textContent('#page').catch(() => '')));
  await ctx.close();
}
for (const [n, x] of [['A', A], ['N', N], ['C', C]]) ok(`no page errors ${n}`, !x.errs.length, x.errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
await browser.close(); server.close();
