// Records one chapter of the tutorial in slow motion, then speeds it back up, so the clip is smooth.
//
// Why slow motion: the browser can only hand over ~16 screenshots a second. So the page's clock (timers,
// requestAnimationFrame) and its CSS animations are run SLOW times slower while we grab frames, and the frames
// are stamped back onto real time afterwards. The result plays at full speed with SLOW × as many frames.
//
// Every tap is logged with where the button was, so the video project can zoom to it and draw the touch.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
import { createRequire } from 'module';

export async function record(REPO, { name, url, out, slow = 5, viewport = { width: 390, height: 844 }, scale = 3, time, me = 'm', who = 'all', practice = true, tourStep = 0, sandboxState = null, script }) {
  const require = createRequire(REPO + '/package.json');
  const { chromium } = require('playwright');
  const executablePath = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'] });
  const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: scale, serviceWorkers: 'block', locale: 'en-CA', timezoneId: 'Asia/Tokyo' });
  const pg = await ctx.newPage();
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  await pg.clock.install({ time: new Date(time) });
  await pg.addInitScript(([me, who, practice, tourStep, sandboxState]) => {
    try {
      // start the practice from the sample trip data (normally the trip page loads it before you reach other pages)
      if (practice && sandboxState && !sessionStorage.getItem('tour.state')) sessionStorage.setItem('tour.state', JSON.stringify(sandboxState));
      if (!localStorage.getItem('trips.me')) { localStorage.setItem('trips.me', JSON.stringify(me)); localStorage.setItem('trips.pin', '6666'); localStorage.setItem('japan2026.whoMix', JSON.stringify(who)); }
      if (practice) { sessionStorage.setItem('tour.on', '1'); if (!sessionStorage.getItem('tour.step')) sessionStorage.setItem('tour.step', String(tourStep)); }
    } catch {}
    // the practice tour's coaching cards and banner stay out of the shot
    const css = '.tour,.tour-bar{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    // and so do the "Practice: nothing is saved" notes: the tutorial shows the app as it normally looks
    const hidePractice = () => { for (const el of document.querySelectorAll('.syncl, .draft, .sync, p, span, div')) { if (el.children.length < 2 && /^\s*Practice:/.test(el.textContent || '')) el.style.display = 'none'; } };
    new MutationObserver(hidePractice).observe(document, { childList: true, subtree: true });
  }, [me, who, practice, tourStep, sandboxState]);

  const dir = path.join(out, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir + '/frames', { recursive: true });
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Animation.enable');
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    const n = frames.length; fs.writeFileSync(`${dir}/frames/${String(n).padStart(6, '0')}.jpg`, Buffer.from(f.data, 'base64'));
    frames.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });

  // slow time: the page clock advances 1/slow of real time, CSS/Web animations play at 1/slow
  let running = false, ticker = null;
  const slowDown = async () => {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / slow });
    await pg.clock.pauseAt(new Date(new Date(time).getTime() + 5000));
    running = true; let last = Date.now();
    ticker = (async () => { while (running) { const now = Date.now(); const d = (now - last) / slow; last = now; await pg.clock.runFor(Math.max(1, Math.round(d))).catch(() => {}); await new Promise((r) => setTimeout(r, 8)); } })();
  };

  const events = []; let t0 = null;
  const nowT = () => (t0 == null ? 0 : (Date.now() / 1000 - t0) / slow); // seconds of finished video
  const box = async (sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }).catch(() => null);
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * slow)); // s = seconds in the finished video
  const api = {
    pg, wait,
    mark: (label, extra = {}) => events.push({ t: nowT(), kind: 'mark', label, ...extra }),
    // show the button (caption + zoom happen in the video project), give viewers a beat, then tap it
    tap: async (sel, { caption, lead = 1.7, after = 2.0, step, opens = false } = {}) => {
      await pg.waitForSelector(sel, { state: 'visible', timeout: 15000 });
      const b = await box(sel); events.push({ t: nowT(), kind: 'focus', sel, box: b, caption, step });
      await wait(lead);
      const b2 = (await box(sel)) || b; events.push({ t: nowT(), kind: 'tap', sel, box: b2, opens });
      await pg.tap(sel, { timeout: 15000 }); await wait(after);
    },
    type: async (sel, text, { caption, step, lead = 1.5, after = 1.4, perChar = 0.13 } = {}) => {
      await pg.waitForSelector(sel, { state: 'visible', timeout: 15000 });
      const b = await box(sel); events.push({ t: nowT(), kind: 'focus', sel, box: b, caption, step });
      await wait(lead); events.push({ t: nowT(), kind: 'tap', sel, box: b });
      await pg.tap(sel); await wait(0.25);
      for (const ch of text) { await pg.keyboard.type(ch); await wait(perChar); }
      events.push({ t: nowT(), kind: 'typed', sel, box: await box(sel) }); await wait(after);
    },
    hold: async (s, caption, extra = {}) => { events.push({ t: nowT(), kind: 'hold', caption, ...extra }); await wait(s); },
    box,
  };

  await pg.goto(url, { waitUntil: 'load' }); await pg.waitForTimeout(2500); // let fonts, data and tiles settle at full speed
  await slowDown();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: viewport.width * scale, maxHeight: viewport.height * scale });
  await new Promise((r) => setTimeout(r, 400)); t0 = Date.now() / 1000;
  await script(api);
  const tEnd = nowT();
  await cdp.send('Page.stopScreencast'); running = false; await ticker;
  await browser.close();

  // stamp frames onto finished-video time and encode at 60 fps
  const startTs = frames.find((t) => t >= t0) ?? frames[0];
  let list = ''; const kept = frames.map((t, i) => [t, i]).filter(([t]) => t >= startTs - 0.2);
  kept.forEach(([t, i], k) => { const next = k + 1 < kept.length ? kept[k + 1][0] : t0 + tEnd * slow; list += `file 'frames/${String(i).padStart(6, '0')}.jpg'\nduration ${Math.max((next - t) / slow, 0.001).toFixed(5)}\n`; });
  fs.writeFileSync(dir + '/frames.txt', list);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-vf', `fps=60,scale=${viewport.width * scale}:${viewport.height * scale},format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', 'clip.mp4'], { cwd: dir });
  const meta = { name, duration: tEnd, viewport, scale, events, errors, frames: kept.length, fpsCaptured: kept.length / tEnd };
  fs.writeFileSync(dir + '/timeline.json', JSON.stringify(meta, null, 2));
  fs.rmSync(dir + '/frames', { recursive: true, force: true }); fs.rmSync(dir + '/frames.txt');
  return meta;
}
