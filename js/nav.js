// One way around the site, the same on every page: the + bubble bottom right opens the trip's pages (and, away from the
// trip, the trip itself), with the page you're on marked. Hopping between the side pages replaces the page instead of
// stacking it, so going back (‹ Trip, the bubble's Trip or the phone's own Back) lands on the trip, on the day you left.
const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const svg = (d) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// [key, label, address from /japan/, icon, members only]; top to bottom, the ones used most nearest the thumb
const PAGES = [
  ['settings', 'Settings', 'prototypes/tools?v=5', svg('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/>')],
  ['sos', 'Help · 110 / 119', './', svg('<path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z"/><path d="M12 8.5v6M9 11.5h6"/>'), true],
  ['say', 'Phrases', './', svg('<path d="M5 5h14a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0119 16h-7l-4.5 3.5V16H5a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 015 5z"/><path d="M8 10.5h8"/>'), true],
  ['shopping', 'Shopping', 'prototypes/tools?v=3', svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>'), true],
  ['bookings', 'Bookings', 'prototypes/tools?v=2', svg('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>'), true],
  ['ideas', 'Ideas', 'prototypes/tools?v=4', svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0012 3z"/>'), true],
  ['photos', 'Photos', 'photos', svg('<path d="M4 8.5A2.5 2.5 0 016.5 6h1.7l1.5-2h4.6l1.5 2h1.7A2.5 2.5 0 0120 8.5v8a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>'), true],
  ['money', 'Expenses', 'money', svg('<path d="M7 4l5 7 5-7M12 11v9M7 12h10M7 16h10"/>'), true],
  ['trip', 'Trip', './', svg('<path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>')],
];
const CSS = `
.tt { transition:transform 320ms var(--ease); position:fixed; right:var(--nav-r, max(16px, calc(50% - 214px))); bottom:calc(18px + env(safe-area-inset-bottom, 0px)); z-index:var(--nav-z, 890); display:flex; flex-direction:column; align-items:flex-end; gap:8px; pointer-events:none; }
.tt-btn { pointer-events:auto; width:54px; height:54px; border-radius:50%; display:grid; place-items:center; color:#fff; background:rgba(20,20,18,.86); -webkit-backdrop-filter:blur(14px) saturate(1.5); backdrop-filter:blur(14px) saturate(1.5); box-shadow:0 0 0 1px rgba(255,255,255,.1) inset, 0 10px 26px -8px rgba(0,0,0,.5); transition:transform 220ms var(--ease); -webkit-tap-highlight-color:transparent; }
.tt-btn:active { transform:scale(.92); }
.tt-btn svg { transition:transform 260ms var(--ease); }
.tt.open .tt-btn svg { transform:rotate(135deg); }
.tt-opt { pointer-events:none; display:flex; align-items:center; gap:10px; height:44px; padding:0 18px 0 7px; border-radius:999px; background:rgba(252,250,246,.96); -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px); color:var(--ink); font-size:15px; font-weight:700; line-height:1; text-decoration:none; white-space:nowrap; box-shadow:0 10px 30px -10px rgba(0,0,0,.35), 0 0 0 1px var(--line); opacity:0; transform:translate3d(0,14px,0) scale(.9); transform-origin:right center; transition:opacity 160ms ease, transform 260ms var(--ease); -webkit-tap-highlight-color:transparent; }
.tt-opt i { width:31px; height:31px; border-radius:50%; display:grid; place-items:center; background:var(--ink); color:#fff; font-style:normal; }
.tt-opt.tt-here { background:var(--ink); color:#fff; }
.tt-opt.tt-here i { background:rgba(255,255,255,.16); }
.tt-opt.tt-here::after { content:'You\\'re here'; margin-left:2px; font-size:11.5px; font-weight:700; color:rgba(255,255,255,.6); }
.tt-opt.trip { background:#fff; }
.tt.open .tt-opt { pointer-events:auto; opacity:1; transform:none; }
.tt-opt:active { transform:scale(.96); }
.tt-veil { position:fixed; inset:0; z-index:calc(var(--nav-z, 890) - 5); background:rgba(20,16,10,.18); opacity:0; pointer-events:none; transition:opacity 200ms ease; }
.tt-veil.on { opacity:1; pointer-events:auto; }
@media (prefers-reduced-motion: reduce) { .tt-opt, .tt-btn svg { transition:opacity 120ms ease; transform:none !important; } }
`;

const IN = location.pathname.includes('/prototypes/') ? '../' : ''; // the way from this page to /japan/
const isTrip = (p) => /\/japan\/(index\.html)?$/.test(p);
const fromTrip = () => { try { const r = new URL(document.referrer); return r.origin === location.origin && isTrip(r.pathname); } catch { return false; } };
let leaving = false;

// Is the trip the page right behind this one? It is when the trip opened this page, or a side page did that the trip
// opened (side pages replace each other).
const tripBehind = () => ss.get('nav.behind') === '1' || fromTrip();
// The trip as you left it (the day on screen), if that was in the last few hours; otherwise the trip opens on today.
const tripUrl = () => { const u = ss.get('nav.trip'), t = +ss.get('nav.tripAt') || 0; return u && Date.now() - t < 3 * 3600e3 ? u : IN + './'; };
export function backToTrip(steps = 1) {
  leaving = true;
  if (tripBehind() && history.length > steps) history.go(-steps); else location.href = tripUrl();
}

export function mountNav({ here, guest = false, onGo, onKit, steps } = {}) {
  if (!document.getElementById('tt-css')) { const st = document.createElement('style'); st.id = 'tt-css'; st.textContent = CSS; document.head.append(st); }
  const veil = document.createElement('div'); veil.className = 'tt-veil'; veil.id = 'ttVeil';
  const nav = document.createElement('nav'); nav.className = 'tt'; nav.id = 'tt'; nav.setAttribute('aria-label', 'Trip pages');
  const list = PAGES.filter(([k, , , , members]) => !(guest && members) && !(k === 'trip' && here === 'trip'));
  nav.innerHTML = list.map(([k, label, href, icon]) => `<a class="tt-opt${k === 'trip' ? ' trip' : ''}" data-k="${k}" href="${k === 'say' || k === 'sos' ? (here === 'trip' ? '#' : IN + './') : IN + href}"><i>${icon}</i><span>${label}</span></a>`).join('')
    + '<button class="tt-btn" id="ttBtn" aria-expanded="false" aria-label="Trip pages"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>';
  document.body.append(veil, nav);
  const btn = nav.querySelector('#ttBtn');
  const set = (on) => { nav.classList.toggle('open', on); veil.classList.toggle('on', on); btn.setAttribute('aria-expanded', String(on)); };
  const mark = (k) => { here = k; nav.querySelectorAll('.tt-opt').forEach((o) => { const on = o.dataset.k === k; o.classList.toggle('tt-here', on); if (on) o.setAttribute('aria-current', 'page'); else o.removeAttribute('aria-current'); }); };
  mark(here);
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  veil.addEventListener('click', () => set(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  addEventListener('pageshow', () => { set(false); leaving = false; });
  nav.addEventListener('click', (e) => {
    const o = e.target.closest('.tt-opt'); if (!o) return;
    const k = o.dataset.k;
    if (k === here) { e.preventDefault(); set(false); return; }
    if (onGo && onGo(k)) { e.preventDefault(); set(false); return; } // the page shows it itself (the tools page's tabs)
    if (k === 'say' || k === 'sos') {
      e.preventDefault(); set(false);
      if (here === 'trip') { if (onKit) onKit(k); } else { ss.set('nav.kit', k); backToTrip(steps ? steps() : 1); }
      return;
    }
    if (here === 'trip') return; // an ordinary link: the trip stays behind it
    e.preventDefault();
    if (k === 'trip') { backToTrip(steps ? steps() : 1); return; }
    leaving = true; location.replace(o.href); // side page to side page: swap, don't stack
  });
  // ‹ Trip (and anything else marked data-home) goes back the same way
  document.querySelectorAll('[data-home]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); backToTrip(steps ? steps() : 1); }));
  addEventListener('pagehide', () => {
    if (here === 'trip') { ss.set('nav.behind', '1'); ss.set('nav.trip', location.pathname + location.search); ss.set('nav.tripAt', String(Date.now())); }
    else if (!leaving) ss.set('nav.behind', '0'); // gone on by some other link: whatever comes next has this page behind it
  });
  // the trip page: a Phrases or Help asked for from another page opens once the trip shows
  if (here === 'trip' && onKit) {
    const kit = () => { const k = ss.get('nav.kit'); if (!k) return; ss.set('nav.kit', ''); onKit(k); };
    addEventListener('pageshow', () => setTimeout(kit, 60)); setTimeout(kit, 60);
  }
  return { set, mark, el: nav, btn };
}
