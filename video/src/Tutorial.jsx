// The whole tutorial (or a cut of it) in the Rail look: an opening card, a card at the start of each part
// listing its chapters as stations, then the chapters one after another, and a closing card.
import { AbsoluteFill, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, fontCss } from './theme.js';
import { ease } from './timeline.js';
import { Chapter } from './Chapter.jsx';
import { PARTS } from './chapters.js';
import { HomeScreen, HOME_SECS } from './HomeScreen.jsx';

export const OPEN = 5, PART = 4.6, CLOSE = 4.5;
const k = (t, a, b, from = 0, to = 1) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

// what plays when, in seconds: used both to size the composition and to write chapter markers
export function plan(items, { parts = true } = {}) {
  const out = [{ kind: 'open', dur: OPEN }]; let lastPart = 0;
  for (const it of items) {
    if (parts && it.chapter.partN !== lastPart) {
      out.push({ kind: 'part', part: PARTS[it.chapter.partN - 1], chapters: items.filter((x) => x.chapter.partN === it.chapter.partN).map((x) => x.chapter), dur: PART });
      lastPart = it.chapter.partN;
    }
    out.push({ kind: 'chapter', ...it, dur: it.dur });
    if (it.chapter.n === 21) out.push({ kind: 'home', dur: HOME_SECS }); // Add to Home Screen, drawn (Safari can't be recorded)
  }
  out.push({ kind: 'close', dur: CLOSE });
  let t = 0; for (const x of out) { x.start = t; t += x.dur; }
  return { segments: out, total: t };
}

export function Tutorial({ segments, title = 'How to use the trip site', sub }) {
  const { fps } = useVideoConfig();
  if (!segments) return null;
  return (
    <AbsoluteFill style={{ background: '#121210', fontFamily: FONT.body }}>
      <style>{fontCss(staticFile)}</style>
      <Series>
        {segments.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={Math.round((s.start + s.dur) * fps) - Math.round(s.start * fps)}>
            {s.kind === 'open' && <Open title={title} sub={sub} />}
            {s.kind === 'part' && <PartCard part={s.part} chapters={s.chapters} />}
            {s.kind === 'chapter' && <Chapter look="rail" chapter={s.chapter} tl={s.tl} />}
            {s.kind === 'home' && <HomeScreen />}
            {s.kind === 'close' && <Close />}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

const Glow = () => <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 80% 40%, rgba(226,59,46,.16), transparent 70%)' }} />;
const Plate = ({ children, o = 1 }) => (
  <div style={{ display: 'inline-flex', height: 76, padding: '0 26px', borderRadius: 16, background: '#fff', color: C.ink, alignItems: 'center', gap: 14, fontWeight: 700, fontSize: 40, opacity: o }}>
    <span style={{ width: 16, height: 46, borderRadius: 4, background: C.red }} />{children}
  </div>
);
const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };

function Open({ title, sub }) {
  const t = useT();
  return (
    <AbsoluteFill style={{ opacity: k(t, OPEN - 0.5, OPEN, 1, 0) }}>
      <Glow />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 640 }}>
        <Plate o={k(t, 0.1, 0.5)}>Japan 2026</Plate>
        <div style={{ marginTop: 44, fontSize: 104, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02, clipPath: `inset(0 ${100 - k(t, 0.4, 1.4, 0, 100)}% 0 0)` }}>{title}</div>
        <div style={{ marginTop: 40, fontSize: 40, color: 'rgba(255,255,255,.62)', lineHeight: 1.3, opacity: k(t, 1.5, 2.1) }}>{sub}</div>
        <div style={{ marginTop: 90, height: 10, borderRadius: 5, background: C.red, width: `${k(t, 1.8, 3.6, 0, 100)}%` }} />
      </div>
    </AbsoluteFill>
  );
}

function PartCard({ part, chapters }) {
  const t = useT();
  const railX = 92, top = 640, gap = Math.min(150, 760 / Math.max(1, chapters.length));
  return (
    <AbsoluteFill style={{ opacity: k(t, PART - 0.45, PART, 1, 0) }}>
      <Glow />
      <div style={{ position: 'absolute', left: 56, top: 260, right: 56 }}>
        <Plate o={k(t, 0, 0.35)}>Part {part.n}</Plate>
        <div style={{ marginTop: 34, fontSize: 92, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02, clipPath: `inset(0 ${100 - k(t, 0.2, 1.0, 0, 100)}% 0 0)` }}>{part.name}</div>
      </div>
      <div style={{ position: 'absolute', left: railX - 5, top, width: 10, borderRadius: 5, background: C.red, height: gap * (chapters.length - 1) * k(t, 0.6, 0.6 + chapters.length * 0.22) }} />
      {chapters.map((c, i) => {
        const a = 0.6 + i * 0.22;
        return (
          <div key={c.id} style={{ position: 'absolute', left: railX - 34, top: top + i * gap - 34, right: 56, display: 'flex', gap: 26, alignItems: 'center', opacity: k(t, a, a + 0.3), transform: `translateX(${k(t, a, a + 0.5, 30, 0)}px)` }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 30, background: '#fff', color: C.ink, fontFeatureSettings: '"tnum"' }}>{c.n}</div>
            <div style={{ fontSize: 40, fontWeight: 500, color: 'rgba(255,255,255,.85)', lineHeight: 1.15 }}>{c.title}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Close() {
  const t = useT();
  return (
    <AbsoluteFill>
      <Glow />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 700 }}>
        <div style={{ width: 120, height: 120, borderRadius: 24, background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 700, fontFamily: FONT.jp, opacity: k(t, 0.1, 0.5), transform: `scale(${k(t, 0.1, 0.6, 0.8, 1)})` }}>済</div>
        <div style={{ marginTop: 50, fontSize: 96, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02, clipPath: `inset(0 ${100 - k(t, 0.4, 1.3, 0, 100)}% 0 0)` }}>Have a great trip.</div>
        <div style={{ marginTop: 40, fontSize: 40, color: 'rgba(255,255,255,.62)', lineHeight: 1.35, opacity: k(t, 1.4, 2.0) }}>Stuck on something? The practice tour is in Settings, under Take the tour.</div>
      </div>
    </AbsoluteFill>
  );
}
