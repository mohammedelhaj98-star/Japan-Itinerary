// Practice-tour test: does the whole tour the way a person would, on several phones, and checks that
//  - every step spotlights its target and the target really receives the tap (not the overlay),
//  - doing the action moves the tour on by itself,
//  - it starts on Day 7, crosses from the trip page to the tools page, and ends back on the real trip,
//  - NOTHING is saved: zero writes reach the API and the phone's localStorage is unchanged.
//   npm run test:tour           (CHROMIUM=/path/to/chrome to pick a browser; screenshots in tests/shots/tour/)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = REPO + '/dist';
execSync('BUILD_ONLY=1 bash scripts/deploy.sh', { cwd: REPO });
const { onRequest } = await import(REPO + '/functions/api/[[path]].js?' + Date.now());
const kv = new Map(); let writes = 0;
const KV = { async get(k, t) { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { writes++; kv.set(k, v); }, async delete(k) { writes++; kv.delete(k); }, async list({ prefix = '' } = {}) { return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:8795');
  if (u.pathname.startsWith('/api/')) { const ch = []; for await (const c of req) ch.push(c); const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(ch) : undefined }), env: { TRIP_KV: KV } }); res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text()); }
  let p = decodeURIComponent(u.pathname); let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(8795, r));
const B = 'http://localhost:8795';
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
const OUT = REPO + '/tests/shots/tour/'; fs.mkdirSync(OUT, { recursive: true });
let problems = 0; const bad = (m) => { problems++; console.log('  ✗ ' + m); };

const scenarios = [
  { name: 'trip-day-naf', time: '2026-10-22T07:00:00Z', me: 'naf', who: 'nasa', vw: 390, vh: 844 },
  { name: 'before-trip-mo', time: '2026-10-09T03:00:00Z', me: 'm', who: 'mm', vw: 390, vh: 844 },
  { name: 'small-phone-sara', time: '2026-10-25T01:00:00Z', me: 'sara', who: 'all', vw: 375, vh: 667 },
];
for (const sc of scenarios) {
  console.log(`\n${sc.name}`);
  // real data on the server before the tour: one stamp, one expense
  kv.clear(); kv.set('checks', JSON.stringify({ 'd01-land': true })); kv.set('expenses', JSON.stringify({ real1: { title: 'Real expense', yen: 1000, payer: 'naf', split: ['naf', 'sara', 'mariam', 'm'], cat: 'food', day: 'd01', ts: '1' } })); kv.set('updatedAt', 'real');
  const ctx = await browser.newContext({ viewport: { width: sc.vw, height: sc.vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date(sc.time) });
  await pg.addInitScript(([me, who]) => { if (!localStorage.getItem('trips.me')) { localStorage.setItem('trips.me', JSON.stringify(me)); localStorage.setItem('japan2026.whoMix', JSON.stringify(who)); } }, [sc.me, sc.who]);
  // a normal visit first, so the phone has its own saved copy of the real trip
  await pg.goto(B + '/japan/'); await pg.waitForTimeout(1500);
  const lsBefore = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter((k) => !k.startsWith('wx:')).sort().map((k) => [k, localStorage.getItem(k)]))));
  writes = 0;
  // start from Settings, like a person would
  await pg.goto(B + '/japan/prototypes/tools?v=5'); await pg.waitForTimeout(1000);
  await pg.tap('a[href="../?tour=1"]'); await pg.waitForTimeout(1600);
  const stepNo = () => pg.evaluate(() => +(/^(\d+) of/.exec(document.querySelector('.tour-card .tour-h small')?.textContent || '') || [])[1] || 0);
  const total = await pg.evaluate(() => +(/of (\d+)/.exec(document.querySelector('.tour-card .tour-h small')?.textContent || '') || [])[1] || 0);
  if (!total) { bad('tour did not start'); await ctx.close(); continue; }
  if (!/Day 7/.test(await pg.textContent('#dayp'))) bad('tour is not on Day 7: ' + (await pg.textContent('#dayp')));
  // check the spotlight is on the target and the target is really tappable
  const spot = async (sel) => pg.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return 'missing ' + sel; const r = el.getBoundingClientRect();
    const ring = document.querySelector('.tour .ring').getBoundingClientRect();
    if (Math.abs(ring.left - (r.left - 6)) > 3 || Math.abs(ring.top - (r.top - 6)) > 3) return `ring off target ring=${Math.round(ring.left)},${Math.round(ring.top)} target=${Math.round(r.left)},${Math.round(r.top)}`;
    const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height, innerHeight * 0.5) / 2; const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el === hit || el.contains(hit))) return 'target not tappable (covered by ' + (hit ? hit.className || hit.tagName : 'nothing') + ')';
    const card = document.querySelector('.tour-card').getBoundingClientRect(); if (card.top < r.top + Math.min(r.height, innerHeight * 0.5) && card.bottom > r.top) return 'card covers the target';
    return 'ok';
  }, sel);
  const advance = async (n, how) => { // wait for the tour to move to step n+1 by itself
    const ok = await pg.waitForFunction((n) => { const m = /^(\d+) of/.exec(document.querySelector('.tour-card .tour-h small')?.textContent || ''); return m && +m[1] > n; }, n, { timeout: 6000 }).then(() => true).catch(() => false);
    if (!ok) { bad(`step ${n}: did not move on after ${how}`); await pg.tap('[data-tnext]').catch(() => {}); await pg.waitForTimeout(600); }
  };
  const step = async (n, sel, act, how) => {
    await pg.waitForFunction((n) => (/^(\d+) of/.exec(document.querySelector('.tour-card .tour-h small')?.textContent || '') || [])[1] == n, n, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(450);
    const title = await pg.textContent('.tour-card h3').catch(() => '?');
    if (sel) { const s = await spot(sel); if (s !== 'ok') bad(`step ${n} (${title}): ${s}`); }
    await pg.screenshot({ path: `${OUT}${sc.name}-${String(n).padStart(2, '0')}.png` });
    if (act) { await act(); await advance(n, how); } else { await pg.tap('[data-tnext]'); await pg.waitForTimeout(500); }
    console.log(`  ${n} ${title}`);
  };
  const drag = async (sel, dx, dy, steps = 10) => { const b = await pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + Math.min(r.height, 120) / 2]; }); await pg.mouse.move(b[0], b[1]); await pg.mouse.down(); for (let k = 1; k <= steps; k++) { await pg.mouse.move(b[0] + (dx * k) / steps, b[1] + (dy * k) / steps); await pg.waitForTimeout(16); } await pg.mouse.up(); };

  await step(1, null);
  await step(2, '#dayp', () => pg.tap('#dayp'), 'tapping the day bar');
  await step(3, '#cal', () => pg.tap('[data-cal="d07"]'), 'tapping Day 7');
  await step(4, '#ddtab', () => pg.tap('#ddtab'), 'tapping the tab');
  await step(5, '#dial', async () => { const a = await pg.$eval('#arc', (e) => { const r = e.getBoundingClientRect(); const s = r.width / 360; return [r.left + 180 * s, r.top + 180 * s, 150 * s]; }); await pg.mouse.move(a[0] - a[2] * 0.9, a[1] - a[2] * 0.35); await pg.mouse.down(); for (let k = 0; k <= 20; k++) { const t = Math.PI * (0.85 - k * 0.03); await pg.mouse.move(a[0] + Math.cos(t) * a[2], a[1] - Math.sin(t) * a[2]); await pg.waitForTimeout(20); } await pg.mouse.up(); }, 'dragging the sun');
  await step(6, '#who', () => pg.tap('[data-who="mm"]'), 'tapping M&M');
  await step(7, '#who', () => pg.tap('[data-who="all"]'), 'tapping All');
  await step(8, '.pass.open .pnav [data-step="1"]', () => pg.tap('.pass.open .pnav [data-step="1"]'), 'tapping the arrow');
  await step(9, '.pass.open [data-stamp]', () => pg.tap('.pass.open [data-stamp]'), 'tapping Stamp');
  await step(10, '#grab', () => pg.tap('#grab'), 'tapping the handle');
  await step(11, '#grab', () => pg.tap('#grab'), 'tapping the handle again');
  await step(12, '#ttBtn', () => pg.tap('#ttBtn'), 'tapping +');
  await step(13, '.tt-opt[href$="v=1"]', async () => { await pg.tap('.tt-opt[href$="v=1"]'); await pg.waitForURL(/tools/); await pg.waitForTimeout(900); }, 'tapping Expenses');
  if (!/prototypes\/tools/.test(pg.url())) bad('did not reach the tools page');
  await step(14, '.card.tot');
  await step(15, '#fab', () => pg.tap('#fab'), 'tapping Add expense');
  // the sheet is taller than the room beside it, so the card sits over its top; what you fill in and tap must stay reachable
  await pg.waitForFunction(() => /^16 of/.test(document.querySelector('.tour-card .tour-h small')?.textContent || ''), null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(450);
  for (const s of ['#x-amt', '#x-title', '[data-save]', '#sheet [data-x]']) { const ok = await pg.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'missing'; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && (h === el || el.contains(h)) ? 'ok' : 'covered by ' + (h ? h.className || h.tagName : 'nothing'); }, s); if (ok !== 'ok') bad(`step 16: ${s} ${ok}`); }
  await step(16, null, async () => { await pg.fill('#x-amt', '3000'); await pg.fill('#x-title', 'Practice dinner'); await pg.tap('[data-save]'); }, 'adding the expense');
  await step(17, '.xsw', async () => { await drag('.xsw .xrow', -150, 0); await pg.waitForTimeout(400); await pg.tap('.xdel'); await pg.waitForTimeout(400); await pg.tap('[data-cyes]'); }, 'swiping and deleting');
  await step(18, '.proto-picker-item:nth-of-type(2)', () => pg.tap('.proto-picker-item:nth-of-type(2)'), 'tapping Bookings');
  await step(19, '.bk.todo [data-bkmark]', () => pg.tap('.bk.todo [data-bkmark]'), 'marking as booked');
  await step(20, '.proto-picker-item:nth-of-type(4)', () => pg.tap('.proto-picker-item:nth-of-type(4)'), 'tapping Food');
  await step(21, '.card:has(#sg-text)', async () => { await pg.fill('#sg-text', 'Practice idea'); await pg.tap('[data-sgpost]'); }, 'posting an idea');
  await step(22, '[data-vote]', () => pg.tap('[data-vote]'), 'voting');
  await step(23, '[data-fview="nearby"]', () => pg.tap('[data-fview="nearby"]'), 'tapping Nearby');
  await step(24, '.proto-picker-item:nth-of-type(3)', () => pg.tap('.proto-picker-item:nth-of-type(3)'), 'tapping Taxi');
  await step(25, '.hcard', () => pg.tap('.hcard'), 'tapping a hotel');
  // the driver card fills the screen; the tour steps aside until it's closed
  await pg.waitForFunction(() => document.querySelector('.tour.paused'), null, { timeout: 4000 }).catch(() => bad('step 26: tour did not step aside for the driver card'));
  await pg.tap('#driver [data-dx]'); await pg.waitForTimeout(400);
  await step(26, '.proto-picker-item:nth-of-type(5)', () => pg.tap('.proto-picker-item:nth-of-type(5)'), 'tapping Settings');
  await step(27, '.card:has(.me)');
  await step(28, '[data-sub="stamps"]');
  // last step: back to the real trip
  await pg.waitForTimeout(500); if (!/everything/i.test(await pg.textContent('.tour-card h3'))) bad('last step is not the wrap-up');
  await pg.screenshot({ path: `${OUT}${sc.name}-29.png` });
  await pg.tap('[data-tnext]'); await pg.waitForURL((u) => !/tools/.test(u.toString()), { timeout: 8000 }).catch(() => bad('Back to the trip did not leave the tools page'));
  await pg.waitForTimeout(1800);
  // nothing saved
  if (writes) bad(`${writes} writes reached the server during the practice`);
  const lsAfter = await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter((k) => !k.startsWith('wx:')).sort().map((k) => [k, localStorage.getItem(k)]))));
  if (lsAfter !== lsBefore) { const a = JSON.parse(lsBefore), b = JSON.parse(lsAfter); bad('the phone\'s saved data changed: ' + [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).map((k) => `${k}: ${String(a[k]).slice(0, 80)} → ${String(b[k]).slice(0, 80)}`).join(' | ')); }
  const after = await pg.evaluate(() => ({ tour: !!document.querySelector('.tour'), session: sessionStorage.getItem('tour.on') }));
  if (after.tour || after.session) bad('practice mode still on after ending: ' + JSON.stringify(after));
  const real = await (await fetch(B + '/api/state')).json();
  if (Object.keys(real.checks).join() !== 'd01-land' || Object.keys(real.expenses).join() !== 'real1' || real.suggestions.length) bad('real trip data changed: ' + JSON.stringify({ c: real.checks, e: Object.keys(real.expenses), s: real.suggestions.length }));
  if (errs.length) bad('page errors: ' + errs.join(' | '));
  console.log(`  → ${total} steps, writes to server: ${writes}, phone data unchanged: ${lsAfter === lsBefore}`);
  await ctx.close();
}
console.log(problems ? `\n${problems} problems` : '\nall good: every step works and nothing was saved');
await browser.close(); server.close();
process.exitCode = problems ? 1 : 0;
