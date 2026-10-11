// Daily check of the live site (GitHub Actions, every morning in Japan; or by hand: node tests/live-check.mjs).
// Opens the pages like a phone, checks the API, and fails (GitHub then emails) if anything is wrong:
// a page that doesn't load or throws, problem reports from the phones in the last day, or a money backup that failed.
// To see the problem reports themselves: GET https://ourtrips.date/api/log with the x-trip-pin header.
import { chromium } from 'playwright';
const SITE = process.env.SITE || 'https://ourtrips.date', UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const problems = [], notes = [];
const get = (p) => fetch(SITE + p, { headers: { 'user-agent': UA }, redirect: 'follow' });

for (const p of ['/', '/japan/', '/japan/money', '/japan/prototypes/tools?v=5', '/japan/photos', '/japan/js/store.js', '/japan/sw.js']) {
  try { const r = await get(p); if (!r.ok) problems.push(`${p} answered ${r.status}`); } catch (e) { problems.push(`${p} didn't load: ${e.message}`); }
}
try {
  const h = await (await get('/api/health')).json();
  if (!h.ok || !h.kv) problems.push('The shared storage (KV) is not answering');
  if (h.errors24h) problems.push(`${h.errors24h} problem report${h.errors24h === 1 ? '' : 's'} from the phones in the last day`);
  if (h.backup && h.backup.failing) problems.push('The last money backup to Google Drive failed');
  if (h.backup && h.backup.at) notes.push(`Last money backup: ${new Date(h.backup.at).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
} catch (e) { problems.push(`/api/health didn't answer: ${e.message}`); }

// the trip and the tools as a phone sees them (as a guest: nothing is changed)
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('trips.me', '"guest"'); } catch {} });
for (const [p, sel] of [['/japan/', '#dayp'], ['/japan/prototypes/tools?v=2', '.ph h1']]) {
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  try { await pg.goto(SITE + p, { waitUntil: 'load', timeout: 45000 }); await pg.waitForSelector(sel, { timeout: 20000 }); }
  catch (e) { problems.push(`${p} didn't show its content: ${e.message.split('\n')[0]}`); }
  await pg.waitForTimeout(2500);
  if (errs.length) problems.push(`${p} threw: ${errs.slice(0, 3).join(' | ')}`);
  await pg.close();
}
await browser.close();

const out = problems.length ? `✗ ${problems.length} problem${problems.length === 1 ? '' : 's'} on ${SITE}:\n- ${problems.join('\n- ')}` : `✓ ${SITE} looks fine`;
console.log([out, ...notes].join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) { const fs = await import('fs'); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [out, ...notes].join('\n\n') + '\n'); }
process.exitCode = problems.length ? 1 : 0;
