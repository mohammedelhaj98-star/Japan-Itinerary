// Tour check: walks the guided tour step by step in several situations (trip day, before the trip on M&M's view,
// a small phone, starting from the full-screen map) and checks every spotlight sits on its target, the target is on
// screen, the card never covers it, and Done closes the tour.
//   npm run test:tour                      (local build)
//   BASE=https://ourtrips.date npm run test:tour   (the live site)
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST = REPO + '/dist';
const LIVE = process.env.BASE; if (!LIVE) execSync('BUILD_ONLY=1 bash scripts/deploy.sh', { cwd: REPO });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); if (u.pathname === '/api/version') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"updatedAt":"x"}'); } if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"checks":{},"choices":{},"suggestions":[],"custom":{},"expenses":{},"profiles":{},"updatedAt":"x"}'); } let p = decodeURIComponent(u.pathname); let f = path.join(DIST, p); if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html'; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); });
if (!LIVE) await new Promise((r) => server.listen(8794, r));
const B = LIVE || 'http://localhost:8794';
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
const OUT = REPO + '/tests/shots/tour/'; fs.mkdirSync(OUT, { recursive: true });
let problems = 0;
const scenarios = [
  { name: 'trip-day-nasa', time: '2026-10-22T07:00:00Z', me: 'naf', who: 'nasa', vw: 390, vh: 844 },
  { name: 'before-trip-mm', time: '2026-10-09T03:00:00Z', me: 'm', who: 'mm', vw: 390, vh: 844 },
  { name: 'small-phone-all', time: '2026-10-25T01:00:00Z', me: 'sara', who: 'all', vw: 375, vh: 667 },
  { name: 'mapmax-and-scrolled', time: '2026-10-22T07:00:00Z', me: 'naf', who: 'all', vw: 390, vh: 844, pre: 'mapmax' },
];
for (const sc of scenarios) {
  const ctx = await browser.newContext({ viewport: { width: sc.vw, height: sc.vh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: new Date(sc.time) });
  await pg.addInitScript(([me, who]) => { localStorage.setItem('trips.me', JSON.stringify(me)); localStorage.setItem('japan2026.whoMix', JSON.stringify(who)); }, [sc.me, sc.who]);
  if (sc.pre === 'mapmax') {
    await pg.goto(B + '/japan/'); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('grab').click()); await pg.waitForTimeout(800);
  }
  await pg.goto(B + '/japan/?tour=1'); await pg.waitForTimeout(1800);
  const total = await pg.evaluate(() => +(/of (\d+)/.exec(document.querySelector('.tour-card')?.textContent || '') || [])[1] || 0);
  if (!total) { console.log(sc.name, 'TOUR DID NOT START', errs); problems++; await ctx.close(); continue; }
  for (let k = 1; k <= total; k++) {
    await pg.waitForTimeout(1100);
    const r = await pg.evaluate(() => {
      const hole = document.querySelector('.tour-hole').getBoundingClientRect(), card = document.querySelector('.tour-card').getBoundingClientRect();
      const sel = document.querySelector('.tour-card').dataset.sel; const el = sel && document.querySelector(sel); const t = el ? el.getBoundingClientRect() : null;
      const title = document.querySelector('.tour-card h3')?.textContent;
      return { title, sel, hole: [hole.left, hole.top, hole.width, hole.height].map(Math.round), t: t && [t.left, t.top, t.width, t.height].map(Math.round), card: [card.top, card.bottom].map(Math.round), vh: innerHeight, vw: innerWidth, centered: document.querySelector('.tour').classList.contains('nohole') };
    });
    const issues = [];
    if (!r.centered) {
      if (!r.t || r.t[2] < 2) issues.push('target missing');
      else {
        if (Math.abs(r.hole[0] - (r.t[0] - 6)) > 4 || Math.abs(r.hole[1] - (r.t[1] - 6)) > 4) issues.push(`hole off target hole=${r.hole} target=${r.t}`);
        if (r.t[1] < 0 || r.t[1] + Math.min(r.t[3], r.vh * 0.42) > r.vh) issues.push('target off screen');
        const hb = r.hole[1] + r.hole[3]; if (r.card[0] < hb - 2 && r.card[1] > r.hole[1] + 2) issues.push(`card covers hole card=${r.card} hole=${r.hole[1]}-${hb}`);
      }
    }
    if (r.card[0] < 0 || r.card[1] > r.vh) issues.push(`card off screen ${r.card}`);
    await pg.screenshot({ path: `${OUT}${sc.name}-${k}.png` });
    console.log(`${sc.name} ${k}/${total} ${r.title}${r.centered ? ' (no target, centred)' : ''}${issues.length ? '  ✗ ' + issues.join('; ') : '  ✓'}`);
    problems += issues.length;
    if (k < total) await pg.tap('[data-tnext]', { timeout: 5000 }).catch((e) => { console.log('  ✗ could not tap Next', e.message.split('\n')[0]); problems++; });
  }
  await pg.tap('[data-tnext]').catch(() => {}); await pg.waitForTimeout(500);
  const left = await pg.evaluate(() => ({ tour: !!document.querySelector('.tour'), url: location.search, scrim: document.getElementById('ddscrim').classList.contains('on') }));
  if (left.tour || /tour=1/.test(left.url)) { console.log(sc.name, '✗ tour did not close', JSON.stringify(left)); problems++; }
  if (errs.length) { console.log(sc.name, '✗ page errors', errs); problems += errs.length; }
  await ctx.close();
}
console.log(problems ? `\n${problems} problems` : '\nall steps OK');
await browser.close(); if (!LIVE) server.close();
process.exitCode = problems ? 1 : 0;
