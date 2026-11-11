// "Add it to your Home Screen", drawn rather than recorded: Safari's share sheet is the phone's own screen and
// can't be captured from a browser. Same Rail layout as a recorded chapter: steps on the red line on the left,
// a still phone on the right, a red ring on the thing to tap and the rest dimmed.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, W, fontCss } from './theme.js';
import { ease, VIEW } from './timeline.js';

const STEPS = [
  { text: 'In Safari, tap Share', at: 2.2 },
  { text: 'Tap Add to Home Screen', at: 6.0 },
  { text: 'Tap Add', at: 9.8 },
];
const LEAD = 1.7, DONE_AT = 13.4;
export const HOME_SECS = 17.5;
const k = (t, a, b, from = 0, to = 1) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

// what's tapped at each step, in phone CSS px (390 × 844), and which screen shows when
const TARGET = [{ x: 171, y: 790, w: 48, h: 40 }, { x: 16, y: 688, w: 358, h: 52 }, { x: 318, y: 58, w: 60, h: 40 }];

export function HomeScreen({ n = 21 }) {
  const { fps } = useVideoConfig(); const t = useCurrentFrame() / fps;
  const PW = 560, top = 330, left = W - PW - 56, s = PW / VIEW.w, PH = VIEW.h * s;
  const cur = STEPS.reduce((c, st, i) => (t >= st.at ? i + 1 : c), 0); // current step, 0 before the first
  const done = t >= DONE_AT;
  const tapAt = (i) => STEPS[i].at + LEAD;
  const screen = t < tapAt(0) + 0.3 ? 0 : t < tapAt(1) + 0.3 ? 1 : t < tapAt(2) + 0.3 ? 2 : 3;
  const sheetUp = k(t, tapAt(0) + 0.15, tapAt(0) + 0.7);
  const ring = !done && cur > 0 && t < tapAt(cur - 1) + 0.35 ? TARGET[cur - 1] : null;
  const ringO = ring ? Math.min(k(t, STEPS[cur - 1].at, STEPS[cur - 1].at + 0.45), k(t, tapAt(cur - 1), tapAt(cur - 1) + 0.35, 1, 0)) : 0;
  const tapAge = cur > 0 ? (t - tapAt(cur - 1)) / 0.7 : 9;
  const px = (v) => v * s;
  const railTop = 380, gap = 205, railX = 92;
  const curStep = done ? STEPS.length + 1 : cur;
  return (
    <AbsoluteFill style={{ background: '#121210', fontFamily: FONT.body }}>
      <style>{fontCss(staticFile)}</style>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 80% 40%, rgba(226,59,46,.16), transparent 70%)' }} />
      {/* station sign */}
      <div style={{ position: 'absolute', left: 56, top: 86, right: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: k(t, 0, 0.35) }}>
          <div style={{ height: 76, padding: '0 26px', borderRadius: 16, background: '#fff', color: C.ink, display: 'flex', alignItems: 'center', gap: 14, fontWeight: 700, fontSize: 40 }}>
            <span style={{ width: 16, height: 46, borderRadius: 4, background: C.red }} />{String(n).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>On an iPhone</div>
        </div>
        <div style={{ marginTop: 30, fontSize: 68, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05, clipPath: `inset(0 ${100 - k(t, 0.25, 1.0, 0, 100)}% 0 0)` }}>Put it on your Home Screen</div>
      </div>
      {/* the line and its stations */}
      <div style={{ position: 'absolute', left: railX - 5, top: railTop, width: 10, height: gap * STEPS.length * k(t, 0.4, 1.4), borderRadius: 5, background: 'rgba(255,255,255,.14)' }} />
      <div style={{ position: 'absolute', left: railX - 5, top: railTop, width: 10, borderRadius: 5, background: C.red, height: Math.max(0, Math.min(STEPS.length, curStep - 1)) * gap }} />
      {STEPS.map((st, i) => {
        const nn = i + 1, isDone = curStep > nn, on = curStep === nn, a = 0.5 + i * 0.12;
        return (
          <div key={i} style={{ position: 'absolute', left: railX - 34, top: railTop + i * gap - 34, display: 'flex', gap: 26, width: left - railX - 10, opacity: k(t, a, a + 0.3) }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32,
              background: on ? C.red : isDone ? '#fff' : '#121210', color: on ? '#fff' : isDone ? C.ink : 'rgba(255,255,255,.6)',
              border: on || isDone ? 'none' : '4px solid rgba(255,255,255,.3)', transform: `scale(${on ? 1.12 : 1})`, boxShadow: on ? '0 0 0 12px rgba(226,59,46,.25)' : 'none' }}>{isDone ? '✓' : nn}</div>
            <div style={{ fontSize: on ? 38 : 32, fontWeight: on ? 700 : 500, lineHeight: 1.18, color: on ? '#fff' : isDone ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.4)', paddingTop: 10 }}>{st.text}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: railX - 34, top: railTop + STEPS.length * gap - 34, width: left - railX - 10, display: 'flex', gap: 26, opacity: done ? 1 : k(t, 1.3, 1.6, 0, 0.35) }}>
        <div style={{ width: 68, height: 68, borderRadius: 14, flex: 'none', background: done ? C.green : 'transparent', border: done ? 'none' : '4px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 34 }}>済</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.2, paddingTop: 8 }}>{done ? 'It opens like an app, full screen, even offline.' : 'Done'}</div>
      </div>
      {/* the phone */}
      <div style={{ position: 'absolute', left: k(t, 0.6, 1.4, W + 40, left), top, width: PW, height: PH, borderRadius: 50, overflow: 'hidden', background: '#f6f4ef', boxShadow: '0 50px 90px -40px rgba(0,0,0,.6)' }}>
        <div style={{ position: 'absolute', inset: 0, width: VIEW.w, height: VIEW.h, transform: `scale(${s})`, transformOrigin: '0 0', fontSize: 15, color: C.ink }}>
          {screen < 3 ? <Browser sheetUp={screen >= 1 ? sheetUp : 0} dialog={screen >= 2 ? k(t, tapAt(1) + 0.15, tapAt(1) + 0.6) : 0} /> : <Home pop={k(t, tapAt(2) + 0.6, tapAt(2) + 1.3)} />}
          {ring && (
            <div style={{ position: 'absolute', left: ring.x - 5, top: ring.y - 5, width: ring.w + 10, height: ring.h + 10, borderRadius: 13, border: `3px solid ${C.red}`,
              boxShadow: `0 0 0 6px ${C.red}33, 0 0 0 4000px rgba(20,20,18,.55)`, opacity: ringO }} />
          )}
          {cur > 0 && tapAge >= 0 && tapAge < 1 && (() => {
            const b = TARGET[cur - 1], cx = b.x + b.w / 2, cy = b.y + b.h / 2, d = 64;
            return <div style={{ position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%', background: 'rgba(20,20,18,.28)', border: '2px solid rgba(20,20,18,.55)', transform: `scale(${tapAge < 0.25 ? 1 - tapAge * 0.6 : 0.85 + (tapAge - 0.25) * 0.2})`, opacity: tapAge < 0.6 ? 1 : 1 - (tapAge - 0.6) / 0.4 }} />;
          })()}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// a simplified browser showing the trip page, with the share sheet and the "add" dialog on top
function Browser({ sheetUp, dialog }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#f6f4ef' }}>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 70, height: 150, borderRadius: 18, background: '#fff', boxShadow: '0 6px 18px -10px rgba(0,0,0,.25)' }} />
        <div style={{ position: 'absolute', left: 32, top: 92, fontFamily: FONT.display, fontSize: 34 }}>Day 7 · Nara + Osaka</div>
        <div style={{ position: 'absolute', left: 32, top: 146, fontSize: 14, color: C.ink2 }}>Thu 22 Oct · 12:20</div>
        {[0, 1, 2].map((i) => <div key={i} style={{ position: 'absolute', left: 16, right: 16, top: 240 + i * 110, height: 94, borderRadius: 16, background: '#fff', opacity: 0.9 }} />)}
      </div>
      {/* bottom toolbar with the address and the share button */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 104, background: 'rgba(250,249,246,.96)', borderTop: '1px solid rgba(0,0,0,.08)' }}>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 10, height: 36, borderRadius: 12, background: 'rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.ink2 }}>ourtrips.date</div>
        <svg style={{ position: 'absolute', left: 183, top: 54 }} width="24" height="30" viewBox="0 0 24 30" fill="none" stroke="#1e6bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v16M6 8l6-6 6 6" /><path d="M5 12H3v16h18V12h-2" />
        </svg>
      </div>
      {/* share sheet */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.25 * sheetUp})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, borderRadius: '18px 18px 0 0', background: '#f2f1ee', transform: `translateY(${(1 - sheetUp) * 540}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px 10px' }}>
          <Img src={staticFile('home-icon.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
          <div><div style={{ fontWeight: 700 }}>Japan 2026</div><div style={{ fontSize: 13, color: C.ink3 }}>ourtrips.date</div></div>
        </div>
        {['Copy', 'Add to Reading List', 'Add Bookmark', 'Add to Favourites', 'Find on Page', 'Add to Home Screen'].map((r, i) => (
          <div key={r} style={{ position: 'absolute', left: 16, right: 16, top: 84 + i * 56, height: 52, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 16, fontWeight: i === 5 ? 700 : 400 }}>{r}</div>
        ))}
      </div>
      {/* "add to home screen" dialog */}
      {dialog > 0 && (
        <div style={{ position: 'absolute', inset: 0, background: '#f2f1ee', transform: `translateY(${(1 - dialog) * 844}px)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px', height: 56, marginTop: 50, fontSize: 16 }}>
            <span style={{ color: '#1e6bff' }}>Cancel</span><span style={{ fontWeight: 700 }}>Add to Home Screen</span><span style={{ color: '#1e6bff', fontWeight: 700, width: 44, textAlign: 'right' }}>Add</span>
          </div>
          <div style={{ margin: '18px 16px', borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
            <Img src={staticFile('home-icon.png')} style={{ width: 60, height: 60, borderRadius: 14 }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700, borderBottom: '1px solid rgba(0,0,0,.1)', paddingBottom: 8 }}>Japan 2026</div><div style={{ fontSize: 13, color: C.ink3, marginTop: 8 }}>ourtrips.date/japan</div></div>
          </div>
        </div>
      )}
    </>
  );
}

// a simple home screen: the new icon pops into the grid
function Home({ pop }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #2c4f86, #b94b74 60%, #cc5a26)' }}>
      {Array.from({ length: 16 }).map((_, i) => {
        const col = i % 4, row = Math.floor(i / 4), mine = i === 9;
        return (
          <div key={i} style={{ position: 'absolute', left: 28 + col * 88, top: 90 + row * 104, width: 64, textAlign: 'center' }}>
            {mine
              ? <Img src={staticFile('home-icon.png')} style={{ width: 64, height: 64, borderRadius: 15, transform: `scale(${pop})`, boxShadow: '0 6px 14px -6px rgba(0,0,0,.5)' }} />
              : <div style={{ width: 64, height: 64, borderRadius: 15, background: 'rgba(255,255,255,.28)' }} />}
            {mine && <div style={{ marginTop: 6, fontSize: 12, color: '#fff', fontWeight: 500, opacity: pop }}>Japan 2026</div>}
          </div>
        );
      })}
    </div>
  );
}
