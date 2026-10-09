// Guided practice tour across the whole app, on Day 7. Started from Settings (/japan/?tour=1).
// Runs in practice mode (see SANDBOX in store.js): everything you tap is real, but nothing is saved.
// Most steps wait for you to do the thing (tap the day bar, add an expense…) and move on by themselves;
// Next is always there in case a gesture doesn't land. Progress lives in sessionStorage so the tour
// carries on from the trip page to the tools page.
//
// Each page sets window.__tourEnv = { page: 'trip' | 'tools', ...hooks } and calls runTour().

const K_ON = 'tour.on', K_STEP = 'tour.step', K_STATE = 'tour.state';
const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }, del: (k) => { try { sessionStorage.removeItem(k); } catch {} } };
const q = (sel) => (typeof sel === 'function' ? sel() : document.querySelector(sel));
const votes = (st) => (st.suggestions || []).reduce((n, x) => n + (x.votes || []).length, 0);
const booked = (st) => Object.entries(st.choices || {}).filter(([k, v]) => k.startsWith('bk-') && v === 'booked').length;
const pick = (n) => `.proto-picker-item:nth-of-type(${n})`; // Expenses 1, Bookings 2, Taxi 3, Food 4, Settings 5
const toolsUrl = (v) => (location.pathname.includes('/prototypes/') ? `tools?v=${v}` : `prototypes/tools?v=${v}`);
const tripUrl = () => (location.pathname.includes('/prototypes/') ? '../' : './');

const STEPS = [
  // ── trip page, Day 7 ──
  { page: 'trip', el: null, t: 'Practice on Day 7', x: 'A quick hands-on tour of the whole app, on Day 7 · Nara + Osaka. Tap and try things for real: stamps, expenses, ideas, anything. <b>Nothing you do in this practice is saved.</b>', pre: (e) => e.reset() },
  { page: 'trip', el: '#dayp', t: 'Day bar', x: '<b>Tap the day bar.</b>', done: (e) => e.calOpen() },
  { page: 'trip', el: '#cal', t: 'Mini calendar', x: 'Every day of the trip, coloured by city; a dot means something is booked. <b>Tap 22 (D7) to close it.</b>', done: (e) => !e.calOpen(), post: (e) => e.toDay7() },
  { page: 'trip', el: '#ddtab', t: 'The day tab', x: 'The day\'s details live in a panel on the left. <b>Tap the tab to open it.</b>', done: (e) => e.drawer.isOpen() },
  { page: 'trip', el: ['#dial', '.dd-list'], t: 'The dial', x: 'The day as a clock: booked stops show their start time, the red tick is now. <b>Drag the sun along the dial.</b>', pre: (e) => e.drawer.open(), snap: (e) => e.ui.sel, done: (e, s0) => e.ui.sel !== s0 },
  { page: 'trip', el: '#who', t: 'One couple\'s plan', x: '<b>Tap M&amp;M</b> to see just Mariam and Mo\'s day.', pre: (e) => e.drawer.open(), done: (e) => e.ui.who === 'mm' },
  { page: 'trip', el: '#who', t: 'Back to everyone', x: '<b>Now tap All.</b>', pre: (e) => e.drawer.open(), done: (e) => e.ui.who === 'all' },
  { page: 'trip', el: '.pass.open .pnav [data-step="1"]', t: 'Passes', x: 'Each stop is a pass. <b>Tap the arrow</b> to go to the next stop; you can also swipe sideways.', pre: (e) => e.drawer.close(), snap: (e) => e.ui.sel, done: (e, s0) => e.ui.sel !== s0 },
  { page: 'trip', el: '.pass.open [data-stamp]', t: 'Stamp it', x: 'When you\'ve done a stop, stamp it so everyone can see. <b>Tap Stamp.</b>', pre: (e) => e.drawer.close(), done: (e) => e.store.isChecked(e.ui.sel) },
  { page: 'trip', el: '#grab', noscroll: true, t: 'Bigger map', x: '<b>Swipe the stops down from here, or tap the handle,</b> to give the map the whole screen.', pre: (e) => { e.drawer.close(); window.scrollTo(0, 0); }, done: (e) => e.mapMax.isOn() },
  { page: 'trip', el: '#grab', noscroll: true, t: 'Bring them back', x: '<b>Tap the handle again</b> (or swipe up).', done: (e) => !e.mapMax.isOn() },
  { page: 'trip', el: '#ttBtn', t: 'Trip tools', x: 'Expenses, bookings, food, taxi cards and Settings. <b>Tap +.</b>', pre: (e) => e.drawer.close(), done: () => !!document.querySelector('#tt.open') },
  { page: 'trip', el: '.tt-opt[href$="v=1"]', t: 'Expenses', x: '<b>Tap Expenses.</b>', nav: toolsUrl(1), pre: () => { const tt = document.getElementById('tt'); if (tt && !tt.classList.contains('open')) document.getElementById('ttBtn').click(); } },
  // ── tools page ──
  { page: 'tools', el: '.card.tot', t: 'Shared expenses', x: 'What the group has spent, in yen and your currency. Below it: who owes whom, settled by couple or person.', pre: (e) => e.setTab(0) },
  { page: 'tools', el: '#fab', t: 'Add an expense', x: '<b>Tap Add expense.</b>', pre: (e) => e.setTab(0), done: (e) => e.sheetOpen() },
  { page: 'tools', el: '#sheet', t: 'Log it', x: '<b>Type an amount</b> (like 3000), check who paid, <b>then tap Add expense.</b>', snap: (e) => e.exCount(), done: (e, s0) => e.exCount() > s0 && !e.sheetOpen(), skip: (e) => e.closeSheet() },
  { page: 'tools', el: '.xsw', t: 'Swipe to delete', x: 'Made a mistake? <b>Swipe an expense left, tap Delete and confirm.</b> There\'s an Undo too.', allow: '.cfm-bg.on', snap: (e) => e.exCount(), done: (e, s0) => e.exCount() < s0 },
  { page: 'tools', el: pick(2), t: 'Bookings', x: '<b>Tap Bookings.</b>', done: (e) => e.getTab() === 1 },
  { page: 'tools', el: '.bk.todo [data-bkmark]', t: 'Booked something?', x: 'Everything booked and still to book. <b>Tap Mark as booked</b> and it moves to Booked for everyone.', pre: (e) => e.setTab(1), snap: (e) => booked(e.store.state), done: (e, s0) => booked(e.store.state) > s0 },
  { page: 'tools', el: pick(4), t: 'Food', x: '<b>Tap Food.</b>', done: (e) => e.getTab() === 3, post: (e) => e.setFoodView('ideas') },
  { page: 'tools', el: () => document.getElementById('sg-text')?.closest('.card'), t: 'Suggest a place', x: 'Ideas go to all four phones. <b>Type one and tap Post for everyone.</b>', pre: (e) => { e.setTab(3); e.setFoodView('ideas'); }, snap: (e) => (e.store.state.suggestions || []).length, done: (e, s0) => (e.store.state.suggestions || []).length > s0 },
  { page: 'tools', el: '[data-vote]', t: 'Vote', x: '<b>Tap Vote</b> on an idea you like. Everyone sees who voted.', snap: (e) => votes(e.store.state), done: (e, s0) => votes(e.store.state) !== s0 },
  { page: 'tools', el: '[data-fview="nearby"]', t: 'Halal & pork-free nearby', x: '<b>Tap Nearby</b> to search around you or any stop on the trip.', done: (e) => e.getFoodView() === 'nearby' },
  { page: 'tools', el: pick(3), t: 'Taxi cards', x: '<b>Tap Taxi.</b>', done: (e) => e.getTab() === 2 },
  { page: 'tools', el: '.hcard', t: 'Show the driver', x: 'Each card says, in Japanese, "please take me to this hotel". <b>Tap a hotel.</b>', pre: (e) => e.setTab(2), done: (e) => e.driverOpen() },
  { page: 'tools', el: pick(5), t: 'Settings', x: 'Close the card with ✕ when you\'re done showing it. <b>Then tap Settings.</b>', allow: '#driver.on', done: (e) => e.getTab() === 4 },
  { page: 'tools', el: () => document.querySelector('.me')?.closest('.card'), t: 'Your profile', x: 'Pick a colour or add a photo: it shows on all four phones. (In this practice it isn\'t saved.)', pre: (e) => e.setTab(4) },
  { page: 'tools', el: '[data-sub="stamps"]', t: 'Stamps, export and the tour', x: 'Undo stamps here, export the whole trip to Word further down, and start this practice again from <b>Take the tour</b>.', pre: (e) => e.setTab(4) },
  { page: 'tools', el: null, t: 'That\'s everything', x: 'You\'ve seen the whole app. <b>Nothing from this practice was saved.</b> Ending it brings back the real trip.', last: true },
];

const CSS = `
.tour { position:fixed; inset:0; z-index:1200; pointer-events:none; }
.tour .tour-block { position:fixed; background:rgba(14,12,8,.58); pointer-events:auto; }
.tour .ring { position:fixed; border-radius:16px; box-shadow:0 0 0 3px #fff, 0 0 0 7px rgba(255,197,61,.55); pointer-events:none; }
.tour.nohole .ring { display:none; }
.tour.paused .tour-block, .tour.paused .tour-card, .tour.paused .ring { display:none; }
.tour-card { position:fixed; left:50%; width:min(calc(100vw - 28px), 360px); transform:translateX(-50%); padding:15px 16px 12px; border-radius:20px; background:#fbf9f5; color:#141412; box-shadow:0 20px 50px -18px rgba(0,0,0,.55); pointer-events:auto; font-family:inherit; }
.tour-card small { font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#e23b2e; }
.tour-card h3 { margin:4px 0 6px; font-size:18px; letter-spacing:-.01em; }
.tour-card p { margin:0; font-size:14.5px; line-height:1.45; color:#4b4a45; }
.tour-card p b { color:#141412; }
.tour-card .row { display:flex; align-items:center; gap:8px; margin-top:13px; }
.tour-card .row .sp { flex:1; }
/* a target too tall for the card beside it (a full sheet): the card shrinks to its instruction and Skip */
.tour-card.mini { display:flex; align-items:center; gap:10px; padding:10px 10px 10px 14px; border-radius:16px; }
.tour-card.mini .tour-h, .tour-card.mini h3, .tour-card.mini .end, .tour-card.mini [data-tback], .tour-card.mini .row .sp { display:none; }
.tour-card.mini p { flex:1; font-size:13.5px; line-height:1.35; }
.tour-card.mini .row { margin:0; }
.tour-card button { height:40px; padding:0 16px; border-radius:12px; border:0; font:inherit; font-weight:700; font-size:14.5px; background:rgba(0,0,0,.06); color:#141412; cursor:pointer; }
.tour-card button.go { background:#141412; color:#fff; }
.tour-card button.end { background:none; color:#86847c; padding:0 4px; }
.tour-card .ok { display:none; color:#2f9e57; font-weight:700; font-size:14px; }
.tour-card.done .ok { display:inline; }
.tour-h { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.tour-h .pr { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#86847c; white-space:nowrap; }
.tour-h .pr i { width:6px; height:6px; border-radius:50%; background:#ffc53d; }
.tour-bar { position:fixed; left:50%; top:calc(env(safe-area-inset-top) + 4px); transform:translateX(-50%); z-index:1250; display:flex; align-items:center; gap:8px; padding:5px 6px 5px 12px; border-radius:999px; background:#141412; color:#fff; font-size:12.5px; font-weight:700; box-shadow:0 6px 18px -6px rgba(0,0,0,.5); white-space:nowrap; }
.tour-bar i { width:7px; height:7px; border-radius:50%; background:#ffc53d; }
.tour-bar button { height:26px; padding:0 10px; border-radius:999px; border:0; background:rgba(255,255,255,.16); color:#fff; font:inherit; font-weight:700; cursor:pointer; }
`;

export function tourActive() { return ss.get(K_ON) === '1'; }

export function endTour(goHome = true) {
  ss.del(K_ON); ss.del(K_STEP); ss.del(K_STATE); ss.del('tour.device');
  if (goHome) location.href = tripUrl();
}

export function runTour() {
  if (!tourActive() || document.querySelector('.tour')) return;
  const env = window.__tourEnv; if (!env) return;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const wrap = document.createElement('div'); wrap.className = 'tour';
  wrap.innerHTML = '<div class="tour-block"></div><div class="tour-block"></div><div class="tour-block"></div><div class="tour-block"></div><div class="ring"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(wrap);
  const [bt, bb, bl, br] = wrap.querySelectorAll('.tour-block'), ring = wrap.querySelector('.ring'), card = wrap.querySelector('.tour-card');
  let i = Math.min(STEPS.length - 1, Math.max(0, +(ss.get(K_STEP) || 0))), s0 = null, last = '', raf = 0, poll = 0, moving = false;

  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
  const target = () => { const st = STEPS[i]; if (!st.el) return null; for (const s of [].concat(st.el)) { const el = q(s); if (visible(el)) return el; } return null; };
  const inFixed = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  const setBox = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });

  const flag = (c, on) => { if (wrap.classList.contains(c) !== on) wrap.classList.toggle(c, on); }; // only touch the DOM on a real change

  // Dim everything except the target (which stays tappable) and keep the card beside it. Returns whether anything moved.
  const place = () => {
    const st = STEPS[i];
    const paused = !!st.allow && [].concat(st.allow).some((s) => visible(document.querySelector(s)));
    flag('paused', paused); if (paused) { const was = last; last = 'paused'; return was !== 'paused'; }
    const el = st.page === env.page ? target() : null; const W = innerWidth, H = innerHeight;
    if (!el) {
      flag('nohole', true);
      if (last === 'none') return false;
      last = 'none'; setBox(bt, 0, 0, W, H); setBox(bb, 0, 0, 0, 0); setBox(bl, 0, 0, 0, 0); setBox(br, 0, 0, 0, 0); card.style.top = Math.max(60, (H - card.offsetHeight) / 2) + 'px';
      return true;
    }
    flag('nohole', false);
    const r = el.getBoundingClientRect(), pad = 6;
    // the hole is the whole target as far as it's on screen, so every part of it (a sheet's button too) can be tapped
    const top = Math.max(0, r.top - pad), bot = Math.min(H, r.bottom + pad);
    const x = Math.round(r.left - pad), y = Math.round(top), w = Math.round(r.width + pad * 2), h = Math.round(Math.max(0, bot - top));
    const key = [x, y, w, h, W, H].join(); if (key === last) return false; last = key;
    setBox(bt, 0, 0, W, y); setBox(bb, 0, y + h, W, H - y - h); setBox(bl, 0, y, x, h); setBox(br, x + w, y, W - x - w, h);
    setBox(ring, x, y, w, h);
    let ch = card.offsetHeight, below = y + h + 12, above = y - 12 - ch;
    if (below + ch > H - 10 && above < 44 && !card.classList.contains('mini')) { card.classList.add('mini'); ch = card.offsetHeight; above = y - 10 - ch; }
    if (card.classList.contains('mini') && above >= 8) { card.style.top = above + 'px'; return true; }
    // beside the target if it fits; otherwise over the side of it with more room (a tall sheet: its header, not its button)
    card.style.top = (below + ch <= H - 10 ? below : above >= 44 ? above : y > H - y - h ? 10 : Math.max(10, H - ch - 10)) + 'px';
    return true;
  };
  // Follow the target frame by frame only while something is moving (a scroll, a swipe, a panel sliding);
  // once it has sat still for a moment, sleep until the next touch, scroll or resize. Measuring the page
  // every frame for the whole tour halved the frame rate on phones.
  let still = 0;
  const frame = () => { raf = 0; still = place() ? 0 : still + 1; if (still < 24) raf = requestAnimationFrame(frame); };
  const kick = () => { still = 0; if (!raf) raf = requestAnimationFrame(frame); };
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'wheel', 'scroll', 'resize', 'keydown', 'input', 'transitionrun', 'animationstart']) addEventListener(ev, kick, { capture: true, passive: true });

  // Did the person just do the step? Checked right after each tap or keystroke, plus a slow poll as a fallback.
  let checkT = 0, ready = false; // ready: the step's card is up and its before-snapshot taken
  const check = () => {
    const st = STEPS[i]; if (!ready || !st.done || moving || st.page !== env.page) return;
    let ok = false; try { ok = st.done(env, s0); } catch { ok = false; }
    if (!ok) return; clearInterval(poll); card.classList.add('done'); moving = true;
    setTimeout(() => { moving = false; if (STEPS[i] === st) go(1); }, 300);
  };
  const soon = () => { clearTimeout(checkT); checkT = setTimeout(check, 60); };
  for (const ev of ['pointerup', 'touchend', 'click', 'input', 'change', 'keyup']) addEventListener(ev, soon, { capture: true, passive: true });

  const save = () => ss.set(K_STEP, String(i));
  const go = (d) => {
    if (moving) return; const st = STEPS[i];
    if (d > 0 && st.last) return endTour(true);
    if (d > 0 && st.skip) st.skip(env);
    if (d > 0 && st.post) st.post(env);
    if (d > 0 && st.nav) { i++; save(); location.href = st.nav; return; }
    const j = i + d; if (j < 0 || j >= STEPS.length) return;
    i = j; save(); show();
  };
  const show = () => {
    clearInterval(poll); ready = false; const st = STEPS[i];
    if (st.page !== env.page) {
      // the practice continues on the other page
      card.className = 'tour-card'; last = '';
      card.innerHTML = `<small>${i + 1} of ${STEPS.length}</small><h3>Carry on</h3><p>The practice continues on the ${st.page === 'tools' ? 'tools' : 'trip'} page.</p><div class="row"><button class="end" data-tend>End practice</button><span class="sp"></span><button class="go" data-tcont>Continue</button></div>`;
      return;
    }
    st.pre && st.pre(env);
    requestAnimationFrame(() => {
      const el = target();
      // bring an in-page target into view; fixed controls and the day panel are always on screen
      if (el && !st.noscroll && !inFixed(el)) {
        const r = el.getBoundingClientRect(); if (r.top < 80 || r.top + Math.min(r.height, innerHeight * 0.5) > innerHeight - 240) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      s0 = st.snap ? st.snap(env) : null; last = ''; ready = true;
      card.className = 'tour-card';
      card.innerHTML = `<div class="tour-h"><small>${i + 1} of ${STEPS.length}</small><span class="pr"><i></i>Practice · nothing is saved</span></div><h3>${st.t}</h3><p>${st.x}</p><div class="row">${st.last ? '' : '<button class="end" data-tend>End</button>'}<span class="sp"></span><span class="ok">✓ Nice</span>${i && !st.last ? '<button data-tback>Back</button>' : ''}<button class="go" data-tnext>${st.last ? 'Back to the trip' : st.done ? 'Skip' : 'Next'}</button></div>`;
      if (st.nav) { const a = target(); if (a) a.addEventListener('click', () => { i++; save(); }, { once: true }); }
      // the slow poll catches what no event announces (a store update, a panel opening by itself) and a target that moved
      poll = setInterval(() => { check(); if (!raf && place()) kick(); }, 250);
      kick();
    });
  };

  const onClick = (e) => {
    if (e.target.closest('[data-tend]')) { e.preventDefault(); return endTour(true); }
    if (e.target.closest('[data-tcont]')) { location.href = STEPS[i].page === 'tools' ? toolsUrl(1) : tripUrl(); return; }
    if (e.target.closest('[data-tnext]')) return go(1);
    if (e.target.closest('[data-tback]')) return go(-1);
  };
  wrap.addEventListener('click', onClick);
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (e.key === 'Escape') endTour(true); });
  show(); kick();
}
