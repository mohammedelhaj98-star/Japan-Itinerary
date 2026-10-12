// "8 things you didn't know the trip site could do": a quick reel instead of a long tutorial.
// A cold open of the best moments cut fast, a title that slams in, then each trick arrives like a train
// (a red "next stop" splash), plays on a still phone with the spotlight and arrow, while one red line down the
// left carries all eight tricks as its stations. Opening and closing holds are trimmed off each clip.
import { AbsoluteFill, Easing, Sequence, Series, interpolate, interpolateColors, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, W, H, fontCss } from './theme.js';
import { buildTimeline, spotAt, ease, VIEW } from './timeline.js';
import { Screen } from './Screen.jsx';

export const TRICKS = [
  { ch: 'ch04', short: 'Couple view', title: "See just your couple's plan" },
  { ch: 'ch07', short: 'Day dial', title: 'Scrub through the day' },
  { ch: 'ch05', short: 'Stamp 済', title: 'Stamp it, and everyone sees' },
  { ch: 'ch06', short: 'Decide', title: 'Decide the day together' },
  { ch: 'ch12', short: 'Scan & split', title: 'Scan a receipt, split by item' },
  { ch: 'ch14', short: 'Settle up', title: 'Settle up in a tap' },
  { ch: 'ch18', short: 'Halal nearby', title: 'Find halal food near you' },
  { ch: 'ch19', short: 'Taxi card', title: 'Show the taxi driver' },
];
// the cold open: [chapter, which tap, seconds after it] for each quick cut
export const MONTAGE = [['ch05', 0, 0.25], ['ch12', 2, 0.6], ['ch07', 1, 0.35], ['ch06', 0, 0.45], ['ch18', 3, 0.35], ['ch04', 1, 0.5]];
export const CUT = 0.62, TITLE = 2.6, PLAY_AT = 0.85, SPLASH = 1.15, CLOSE = 3.2;
export const OPEN = MONTAGE.length * CUT + TITLE;

const k = (t, a, b, from = 0, to = 1, e = ease) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
const snap = Easing.bezier(0.2, 1.5, 0.4, 1); // a slam with a little bounce
const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };

// where each trick's clip starts and ends: from just before its first button to a short beat after its last tap
export function trimOf(tl) {
  const ev = tl.events, first = ev.find((e) => e.kind === 'focus');
  const last = [...ev].reverse().find((e) => e.kind === 'tap' || e.kind === 'typed' || (e.kind === 'focus' && e.step));
  const t0 = Math.max(0, (first ? first.t : 0) - 0.35);
  const t1 = Math.min(tl.duration, (last ? last.t : tl.duration) + 2.1);
  return { t0, t1 };
}

export function Reel({ items, montage }) {
  const { fps } = useVideoConfig();
  if (!items) return null;
  const seg = (secs) => Math.round(secs * fps);
  return (
    <AbsoluteFill style={{ background: '#0f0f0d', fontFamily: FONT.body }}>
      <style>{fontCss(staticFile)}</style>
      <Series>
        {montage.map((m, i) => (
          <Series.Sequence key={'m' + i} durationInFrames={seg(CUT)}><Cut m={m} i={i} /></Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={seg(TITLE)}><Title n={items.length} /></Series.Sequence>
        {items.map((it, i) => (
          <Series.Sequence key={it.ch} durationInFrames={seg(PLAY_AT + it.t1 - it.t0)}><Trick it={it} i={i} items={items} /></Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={seg(CLOSE)}><Close n={items.length} /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}

const Glow = ({ o = 1 }) => <AbsoluteFill style={{ background: 'radial-gradient(80% 55% at 70% 45%, rgba(226,59,46,.22), transparent 70%)', opacity: o }} />;

/* ── cold open: one quick cut ── */
function Cut({ m, i }) {
  const t = useT(); const { fps } = useVideoConfig();
  const PW = 760, ph = VIEW.h * (PW / VIEW.w), T = buildTimeline(m.tl);
  const tc = m.at + t;
  const tilt = i % 2 ? -2.2 : 2.2;
  return (
    <AbsoluteFill>
      <Glow />
      <div style={{ position: 'absolute', left: (W - PW) / 2, top: (H - ph) / 2, transform: `scale(${k(t, 0, 0.32, 1.1, 1)}) rotate(${k(t, 0, 0.4, tilt, 0)}deg)` }}>
        <Sequence from={0} layout="none">
          <Screen T={T} t={tc} clip={m.clip} width={PW} radius={64} camOpts={{ still: true }} dim={0} ring="transparent" startFrom={Math.round(m.at * fps)} shadow={false} />
        </Sequence>
      </div>
      {/* a white flash on each cut */}
      <AbsoluteFill style={{ background: '#fff', opacity: k(t, 0, 0.12, 0.55, 0) }} />
      {/* the counter in the corner ticks up with each cut */}
      <div style={{ position: 'absolute', right: 60, top: 70, fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,.6)', letterSpacing: '.12em' }}>{String(i + 1).padStart(2, '0')}</div>
    </AbsoluteFill>
  );
}

/* ── the title slams in ── */
function Title({ n }) {
  const t = useT();
  const words = ["things", "you", "didn't", "know", "the", "trip", "site", "could", "do"];
  return (
    <AbsoluteFill>
      <Glow />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 520 }}>
        <div style={{ fontSize: 420, lineHeight: 0.8, fontWeight: 700, color: C.red, letterSpacing: '-0.05em', transform: `scale(${k(t, 0, 0.42, 1.9, 1, snap)})`, transformOrigin: '0% 100%', opacity: k(t, 0, 0.1) }}>{n}</div>
        <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: '6px 22px', fontSize: 96, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02 }}>
          {words.map((w, i) => {
            const a = 0.3 + i * 0.07;
            return <span key={i} style={{ display: 'inline-block', opacity: k(t, a, a + 0.18), transform: `translateY(${k(t, a, a + 0.32, 40, 0)}px)` }}>{w}</span>;
          })}
        </div>
      </div>
      <AbsoluteFill style={{ background: '#0f0f0d', opacity: k(t, TITLE - 0.25, TITLE, 0, 1) }} />
    </AbsoluteFill>
  );
}

/* ── one trick ── */
function Trick({ it, i, items }) {
  const t = useT(); const { fps } = useVideoConfig();
  const T = buildTimeline(it.tl);
  const local = t - PLAY_AT, playing = local >= 0;
  const tc = Math.min(it.t1 - 1 / fps, it.t0 + Math.max(0, local));
  const PW = 560, top = 430, left = W - PW - 56, s = PW / VIEW.w;
  const railTop = 560, gap = 138, railX = 92, labelW = left - railX - 96;
  const sp = playing ? spotAt(T, tc) : null;
  // the step being explained, as one big caption that swaps as you go
  const caps = T.captions.filter((c) => c.step && c.t <= tc + 1e-6);
  const cap = playing ? caps[caps.length - 1] : null;
  const capAge = cap ? tc - cap.t : 0;
  // the arrow from this trick's station to the lit button
  let arrow = null;
  if (sp) {
    const sy = railTop + i * gap, sx = railX + 60 + labelW + 12;
    const ex = left + sp.box.x * s - 20, ey = top + (sp.box.y + sp.box.h / 2) * s;
    const d = Math.min(170, Math.max(8, (ex - sx) * 0.5));
    arrow = { path: `M ${sx} ${sy} C ${sx + d} ${sy}, ${ex - d} ${ey}, ${ex} ${ey}`, ex, ey, draw: sp.linkedPrev ? 1 : k(sp.age, 0.1, 0.55), o: sp.o };
  }
  const fill = i + k(t, 0.15, 0.75); // the red runs down to this station as the trick arrives
  return (
    <AbsoluteFill>
      <Glow o={0.8} />
      {/* header: the station sign for this trick */}
      <div style={{ position: 'absolute', left: 56, right: 56, top: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ height: 70, padding: '0 22px', borderRadius: 14, background: '#fff', color: C.ink, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 38 }}>
            <span style={{ width: 14, height: 42, borderRadius: 4, background: C.red }} />{String(i + 1).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{i + 1} of {items.length}</div>
        </div>
        <div style={{ marginTop: 24, fontSize: 70, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.04 }}>{it.title}</div>
      </div>
      {/* the one big caption */}
      {cap && (
        <div key={cap.t} style={{ position: 'absolute', left: 56, right: PW + 90, top: 318, display: 'flex', gap: 14, alignItems: 'flex-start',
          opacity: k(capAge, 0, 0.25), transform: `translateY(${k(capAge, 0, 0.4, 24, 0)}px)`, filter: `blur(${k(capAge, 0, 0.25, 6, 0)}px)` }}>
          <span style={{ flex: 'none', width: 44, height: 44, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{cap.step}</span>
          <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15, color: '#fff' }}>{cap.text}</span>
        </div>
      )}
      {/* the line: all the tricks as stations */}
      <div style={{ position: 'absolute', left: railX - 4, top: railTop, width: 8, height: gap * (items.length - 1), borderRadius: 4, background: 'rgba(255,255,255,.12)' }} />
      <div style={{ position: 'absolute', left: railX - 4, top: railTop, width: 8, height: Math.max(0, fill - 1) * gap + (i > 0 ? 0 : 0), borderRadius: 4, background: `linear-gradient(${C.red}, #ff6a4d)`, boxShadow: '0 0 16px rgba(226,59,46,.45)' }} />
      {items.map((x, j) => {
        const lit = j === i ? k(t, 0.45, 0.8) : 0, done = j < i;
        return (
          <div key={j} style={{ position: 'absolute', left: railX - 26, top: railTop + j * gap - 26, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, boxSizing: 'border-box',
              background: interpolateColors(lit, [0, 1], [done ? '#ffffff' : '#0f0f0d', C.red]), color: lit > 0.5 ? '#fff' : done ? C.ink : 'rgba(255,255,255,.5)',
              border: `3px solid rgba(255,255,255,${done || lit > 0.5 ? 0 : 0.28})`, transform: `scale(${1 + 0.18 * lit})`, boxShadow: `0 0 0 ${10 * lit}px rgba(226,59,46,.25)` }}>{done ? '✓' : j + 1}</div>
            <div style={{ width: labelW, fontSize: 28 + 4 * lit, fontWeight: lit > 0.5 ? 700 : 500, color: `rgba(255,255,255,${j === i ? 0.45 + 0.55 * lit : done ? 0.6 : 0.35})` }}>{x.short}</div>
          </div>
        );
      })}
      {/* the phone */}
      <div style={{ position: 'absolute', left, top, filter: 'drop-shadow(0 40px 60px rgba(0,0,0,.6))' }}>
        {playing
          ? <Sequence from={Math.round(PLAY_AT * fps)} layout="none"><Screen T={T} t={tc} clip={it.clip} width={PW} radius={50} camOpts={{ still: true }} dim={0.68} ring={C.red} startFrom={Math.round(it.t0 * fps)} shadow={false} /></Sequence>
          : <Screen T={T} t={it.t0} clip={it.clip} width={PW} radius={50} camOpts={{ still: true }} dim={0.68} ring={C.red} startFrom={Math.round(it.t0 * fps)} shadow={false} />}
      </div>
      {arrow && (
        <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: arrow.o }}>
          <defs><filter id="rglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter></defs>
          <path d={arrow.path} pathLength={1} fill="none" stroke={C.red} strokeOpacity={0.5} strokeWidth={14} strokeLinecap="round" filter="url(#rglow)" strokeDasharray="1 1" strokeDashoffset={1 - arrow.draw} />
          <path d={arrow.path} pathLength={1} fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - arrow.draw} />
          <g transform={`translate(${arrow.ex} ${arrow.ey}) scale(${k(arrow.draw, 0.8, 1)})`}><path d="M -20 -13 L 2 0 L -20 13" fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /></g>
        </svg>
      )}
      <Splash n={i + 1} title={it.title} t={t} />
    </AbsoluteFill>
  );
}

// "next stop": a red board wipes across, shows the number big, and wipes off to reveal the trick
function Splash({ n, title, t }) {
  if (t > SPLASH) return null;
  const inK = k(t, 0, 0.28, 0, 1, Easing.bezier(0.7, 0, 0.3, 1)), outK = k(t, SPLASH - 0.32, SPLASH, 0, 1, Easing.bezier(0.7, 0, 0.3, 1));
  const x = (1 - inK) * W - outK * W;
  return (
    <div style={{ position: 'absolute', left: x, top: 0, width: W, height: H, background: C.red, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 80, top: 640, color: '#fff' }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.8 }}>Next stop</div>
        <div style={{ fontSize: 360, fontWeight: 700, lineHeight: 0.9, letterSpacing: '-0.05em', transform: `translateX(${k(t, 0.1, 0.5, 60, 0)}px)` }}>{String(n).padStart(2, '0')}</div>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 20, maxWidth: W - 160, transform: `translateX(${k(t, 0.16, 0.6, 90, 0)}px)`, opacity: k(t, 0.16, 0.4) }}>{title}</div>
      </div>
    </div>
  );
}

function Close({ n }) {
  const t = useT();
  return (
    <AbsoluteFill>
      <Glow />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 640 }}>
        <div style={{ width: 130, height: 130, borderRadius: 26, background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 700, fontFamily: FONT.jp,
          transform: `scale(${k(t, 0, 0.45, 1.8, 1, snap)})`, opacity: k(t, 0, 0.12) }}>済</div>
        <div style={{ marginTop: 50, fontSize: 100, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02, clipPath: `inset(0 ${100 - k(t, 0.3, 1.1, 0, 100)}% 0 0)` }}>That's all {n}.</div>
        <div style={{ marginTop: 36, fontSize: 40, color: 'rgba(255,255,255,.62)', lineHeight: 1.35, opacity: k(t, 1.1, 1.6) }}>Have a great trip. Stuck? Settings has a practice tour.</div>
      </div>
    </AbsoluteFill>
  );
}
