// The 4-feature video: Mo's voiceover, cut snappy, with music. A soft open where the title fades up, then each
// feature arrives like a train ("next stop" splash), opens on its real-trip moment as a big quote, and plays on a
// still phone with the spotlight and arrow while one red line down the left carries the four features.
import { AbsoluteFill, Audio, Easing, Freeze, Sequence, interpolate, interpolateColors, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, W, H, fontCss } from './theme.js';
import { buildTimeline, spotAt, ease, VIEW } from './timeline.js';
import { Screen } from './Screen.jsx';
import { SCENES, SPLASH, musicVolume } from './featurePlan.js';

const k = (t, a, b, from = 0, to = 1, e = ease) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
const snapIn = Easing.bezier(0.2, 1.5, 0.4, 1);
const wipe = Easing.bezier(0.7, 0, 0.3, 1);
const SPLASH_IN = 0.26; // how long the red splash takes to cover the frame
const PW = 560, PTOP = 440, PLEFT = W - PW - 56, S_ = PW / VIEW.w;
const RAIL = { x: 92, top: 640, gap: 190 };
const Glow = ({ o = 1 }) => <AbsoluteFill style={{ background: 'radial-gradient(80% 55% at 70% 45%, rgba(226,59,46,.2), transparent 70%)', opacity: o }} />;

export function Feature({ plan, music = 'audio/music.wav' }) {
  const { fps } = useVideoConfig();
  if (!plan) return null;
  const F = (s) => Math.round(s * fps);
  const nextStart = (i) => (i + 1 < plan.scenes.length ? plan.scenes[i + 1].S : plan.outro.start);
  return (
    <AbsoluteFill style={{ background: '#0f0f0d', fontFamily: FONT.body }}>
      <style>{fontCss(staticFile)}</style>
      {/* soft open */}
      <Sequence from={0} durationInFrames={F(plan.open.end + 0.3)}><SoftOpen end={plan.open.end} /></Sequence>
      {/* the four scenes, each staying up until the next splash has covered it */}
      {plan.scenes.map((sc, i) => (
        <Sequence key={sc.key} from={F(sc.S)} durationInFrames={F(nextStart(i) + 0.32 - sc.S)}><Scene sc={sc} i={i} n={plan.scenes.length} /></Sequence>
      ))}
      <Sequence from={F(plan.outro.start)} durationInFrames={F(plan.outro.end - plan.outro.start)}><Outro n={plan.scenes.length} /></Sequence>
      {/* sound: the voice line by line, the music tucked under it, a tick for each tap and a whoosh for each splash */}
      <Audio src={staticFile(music)} startFrom={F(plan.musicFrom || 0)} volume={(f) => musicVolume(plan, f / fps)} />
      {plan.voPlace.map((p) => (
        <Sequence key={p.id} from={F(p.at)} durationInFrames={F(p.to - p.from) + 2}><Audio src={staticFile('audio/vo.wav')} startFrom={F(p.from)} endAt={F(p.to)} /></Sequence>
      ))}
      {plan.taps.map((t, i) => <Sequence key={'t' + i} from={F(t)} durationInFrames={F(0.2)}><Audio src={staticFile('audio/tick.wav')} volume={0.28} /></Sequence>)}
      {plan.whooshes.map((t, i) => <Sequence key={'w' + i} from={F(Math.max(0, t - 0.05))} durationInFrames={F(0.6)}><Audio src={staticFile('audio/whoosh.wav')} volume={0.32} /></Sequence>)}
    </AbsoluteFill>
  );
}

/* ── soft open: everything fades up slowly, nothing snaps ── */
function SoftOpen({ end }) {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps;
  const soft = Easing.bezier(0.25, 0.1, 0.25, 1);
  const up = (a, d = 1.1) => ({ opacity: k(t, a, a + d, 0, 1, soft), transform: `translateY(${k(t, a, a + d * 1.2, 18, 0, soft)}px)` });
  return (
    <AbsoluteFill style={{ background: '#0f0f0d', opacity: k(t, 0, 1.2, 0, 1, soft) }}>
      <AbsoluteFill style={{ background: 'radial-gradient(80% 55% at 70% 45%, rgba(226,59,46,.2), transparent 70%)', opacity: k(t, 0.2, 3, 0.3, 1, soft) }} />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 600, transform: `scale(${k(t, 0, end, 1, 1.035, Easing.linear)})`, transformOrigin: '0% 50%' }}>
        <div style={{ ...up(0.5), display: 'inline-flex', alignItems: 'center', gap: 14, height: 72, padding: '0 24px', borderRadius: 16, background: '#fff', color: C.ink, fontSize: 38, fontWeight: 700 }}>
          <span style={{ width: 14, height: 42, borderRadius: 4, background: C.red }} />Japan 2026
        </div>
        <div style={{ ...up(1.3, 1.4), marginTop: 46, display: 'flex', alignItems: 'baseline', gap: 26 }}>
          <span style={{ fontSize: 300, lineHeight: 0.8, fontWeight: 700, color: C.red, letterSpacing: '-0.05em' }}>4</span>
          <span style={{ fontSize: 92, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em' }}>things</span>
        </div>
        <div style={{ ...up(2.3, 1.4), marginTop: 26, fontSize: 70, fontWeight: 500, color: 'rgba(255,255,255,.8)', letterSpacing: '-0.025em', lineHeight: 1.12 }}>
          on our trip site that save<br />a lot of hassle
        </div>
        <div style={{ marginTop: 60, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${C.red}, #ff6a4d)`, width: `${k(t, 2.8, end, 0, 100, soft)}%`, boxShadow: '0 0 14px rgba(226,59,46,.4)' }} />
      </div>
    </AbsoluteFill>
  );
}

// where the clip is at scene time u (seconds since the scene's splash began): each spoken line plays its piece of
// the recording, then holds on that piece's last frame until the line has been said
function clipAt(sc, u, fps) {
  const abs = sc.S + u;
  let j = 0; for (let x = 0; x < sc.beats.length; x++) if (abs >= sc.beats[x].b - 1e-6) j = x;
  const bt = sc.beats[j];
  if (abs < sc.P) return { tc: sc.beats[0].m, j: 0 };
  return { tc: bt.m + Math.min(abs - bt.b, bt.seg - 1 / fps), j };
}

/* ── one feature ── */
function Scene({ sc, i, n }) {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const u = f / fps;
  const T = buildTimeline(sc.tl);
  const { tc } = clipAt(sc, u, fps);
  const playing = sc.S + u >= sc.P;
  const sp = playing ? spotAt(T, tc) : null;
  const cap = playing ? [...T.captions].reverse().find((c) => c.t <= tc + 1e-6) : null;
  const capAge = cap ? tc - cap.t : 0;
  const labelW = PLEFT - RAIL.x - 96;
  let arrow = null;
  if (sp && sp.step) {
    const sy = RAIL.top + i * RAIL.gap, sx = RAIL.x + 60 + labelW + 12;
    const ex = PLEFT + sp.box.x * S_ - 20, ey = PTOP + (sp.box.y + sp.box.h / 2) * S_;
    const d = Math.min(170, Math.max(8, (ex - sx) * 0.5));
    arrow = { path: `M ${sx} ${sy} C ${sx + d} ${sy}, ${ex - d} ${ey}, ${ex} ${ey}`, ex, ey, draw: sp.linkedPrev ? 1 : k(sp.age, 0.08, 0.45), o: sp.o };
  }
  const F = (s) => Math.round(s * fps);
  // this scene starts on top of the previous one, so keep it out of sight until the red splash has fully covered the
  // frame (its wipe-in takes 0.26 s); only the splash shows before that
  const covered = u >= SPLASH_IN;
  return (
    <AbsoluteFill>
     <AbsoluteFill style={{ opacity: covered ? 1 : 0 }}>
      <Glow o={0.8} />
      {/* header */}
      <div style={{ position: 'absolute', left: 56, right: 56, top: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ height: 70, padding: '0 22px', borderRadius: 14, background: '#fff', color: C.ink, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: 38 }}>
            <span style={{ width: 14, height: 42, borderRadius: 4, background: C.red }} />{String(i + 1).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{i + 1} of {n}</div>
        </div>
        <div style={{ marginTop: 22, fontSize: 76, fontWeight: 700, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02 }}>{sc.title}</div>
      </div>
      {/* the caption: the trip moment as a big quote, then each step with its number */}
      {cap && (cap.step ? (
        <div key={cap.t} style={{ position: 'absolute', left: 56, right: PW + 90, top: 318, display: 'flex', gap: 14, alignItems: 'flex-start',
          opacity: k(capAge, 0, 0.22), transform: `translateY(${k(capAge, 0, 0.35, 22, 0)}px)`, filter: `blur(${k(capAge, 0, 0.22, 6, 0)}px)` }}>
          <span style={{ flex: 'none', width: 46, height: 46, borderRadius: '50%', background: C.red, color: '#fff', fontSize: 25, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{cap.step}</span>
          <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.12, color: '#fff' }}>{cap.text}</span>
        </div>
      ) : (
        <div key={cap.t} style={{ position: 'absolute', left: 56, right: 56, top: 270, fontFamily: FONT.display, fontStyle: 'italic', fontSize: 66, lineHeight: 1.05, color: '#fff', letterSpacing: '-0.01em',
          opacity: k(capAge, 0, 0.3) * (sp ? 1 - k(capAge, 0, 0.2) : 1), transform: `translateY(${k(capAge, 0, 0.45, 26, 0)}px)` }}>
          <span style={{ color: C.red }}>“</span>{cap.text}<span style={{ color: C.red }}>”</span>
        </div>
      ))}
      {/* the line: the four features as stations */}
      <div style={{ position: 'absolute', left: RAIL.x - 4, top: RAIL.top, width: 8, height: RAIL.gap * (n - 1), borderRadius: 4, background: 'rgba(255,255,255,.12)' }} />
      <div style={{ position: 'absolute', left: RAIL.x - 4, top: RAIL.top, width: 8, height: Math.max(0, i - 1 + k(u, 0.15, 0.85)) * RAIL.gap * (i > 0 ? 1 : 0), borderRadius: 4, background: `linear-gradient(${C.red}, #ff6a4d)`, boxShadow: '0 0 16px rgba(226,59,46,.45)' }} />
      {SCENES.map((x, j) => {
        const lit = j === i ? k(u, 0.5, 0.85) : 0, done = j < i;
        return (
          <div key={j} style={{ position: 'absolute', left: RAIL.x - 30, top: RAIL.top + j * RAIL.gap - 30, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, fontWeight: 700, boxSizing: 'border-box',
              background: interpolateColors(lit, [0, 1], [done ? '#ffffff' : '#0f0f0d', C.red]), color: lit > 0.5 ? '#fff' : done ? C.ink : 'rgba(255,255,255,.5)',
              border: `3px solid rgba(255,255,255,${done || lit > 0.5 ? 0 : 0.28})`, transform: `scale(${1 + 0.18 * lit})`, boxShadow: `0 0 0 ${11 * lit}px rgba(226,59,46,.25), 0 0 ${28 * lit}px rgba(226,59,46,${0.45 * lit})` }}>{done ? '✓' : j + 1}</div>
            <div style={{ width: labelW, fontSize: 30 + 6 * lit, fontWeight: lit > 0.5 ? 700 : 500, color: `rgba(255,255,255,${j === i ? 0.45 + 0.55 * lit : done ? 0.6 : 0.35})` }}>{x.short}</div>
          </div>
        );
      })}
      {/* the phone: the first frame under the splash, then each line's piece of the recording */}
      <div style={{ position: 'absolute', left: PLEFT, top: PTOP, filter: 'drop-shadow(0 40px 60px rgba(0,0,0,.6))' }}>
        <Sequence from={0} durationInFrames={F(sc.P - sc.S)} layout="none">
          <Freeze frame={0}><Screen T={T} t={sc.beats[0].m} clip={sc.key} width={PW} radius={50} camOpts={{ still: true }} dim={0.68} ring={C.red} startFrom={F(sc.beats[0].m)} shadow={false} /></Freeze>
        </Sequence>
        {sc.beats.map((bt, j) => {
          const playF = Math.min(F(bt.seg), F(bt.D)), holdF = F(bt.D) - playF, from = F(bt.b - sc.S);
          const last = j === sc.beats.length - 1, tail = last ? F(0.6) : 0;
          return (
            <span key={j}>
              <Sequence from={from} durationInFrames={playF} layout="none">
                <Screen T={T} t={tc} clip={sc.key} width={PW} radius={50} camOpts={{ still: true }} dim={0.68} ring={C.red} startFrom={F(bt.m)} shadow={false} />
              </Sequence>
              {holdF + tail > 0 && (
                <Sequence from={from + playF} durationInFrames={holdF + tail} layout="none">
                  <Freeze frame={Math.max(0, playF - 1)}><Screen T={T} t={tc} clip={sc.key} width={PW} radius={50} camOpts={{ still: true }} dim={0.68} ring={C.red} startFrom={F(bt.m)} shadow={false} /></Freeze>
                </Sequence>
              )}
            </span>
          );
        })}
      </div>
      {arrow && (
        <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: arrow.o }}>
          <defs><filter id="fglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter></defs>
          <path d={arrow.path} pathLength={1} fill="none" stroke={C.red} strokeOpacity={0.5} strokeWidth={14} strokeLinecap="round" filter="url(#fglow)" strokeDasharray="1 1" strokeDashoffset={1 - arrow.draw} />
          <path d={arrow.path} pathLength={1} fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - arrow.draw} />
          <g transform={`translate(${arrow.ex} ${arrow.ey}) scale(${k(arrow.draw, 0.8, 1)})`}><path d="M -20 -13 L 2 0 L -20 13" fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /></g>
        </svg>
      )}
     </AbsoluteFill>
      <Splash n={i + 1} title={sc.title} u={u} />
    </AbsoluteFill>
  );
}

// "next stop": a red board wipes across, the number lands big, and it wipes off to reveal the feature
function Splash({ n, title, u }) {
  if (u > SPLASH + 0.05) return null;
  const x = (1 - k(u, 0, SPLASH_IN, 0, 1, wipe)) * W - k(u, SPLASH - 0.3, SPLASH, 0, 1, wipe) * W;
  return (
    <div style={{ position: 'absolute', left: x, top: 0, width: W, height: H, background: C.red, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 80, top: 640, color: '#fff' }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.85 }}>Next stop</div>
        <div style={{ fontSize: 380, fontWeight: 700, lineHeight: 0.9, letterSpacing: '-0.05em', transform: `translateX(${k(u, 0.08, 0.45, 70, 0)}px)` }}>{String(n).padStart(2, '0')}</div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 16, transform: `translateX(${k(u, 0.14, 0.55, 100, 0)}px)`, opacity: k(u, 0.14, 0.35) }}>{title}</div>
      </div>
    </div>
  );
}

/* ── outro: the line completes, the stamp lands ── */
function Outro({ n }) {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const u = f / fps;
  const x = (1 - k(u, 0, 0.3, 0, 1, wipe)) * W;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: x, top: 0, width: W, height: H, background: '#0f0f0d' }}>
        <Glow />
        {/* all four stations, ticked, on a full red line */}
        <div style={{ position: 'absolute', left: 92 - 4, top: 330, width: 8, height: 120 * (n - 1) * k(u, 0.3, 1.0), borderRadius: 4, background: `linear-gradient(${C.red}, #ff6a4d)`, boxShadow: '0 0 16px rgba(226,59,46,.45)' }} />
        {SCENES.map((s, j) => (
          <div key={j} style={{ position: 'absolute', left: 62, top: 330 + j * 120 - 30, display: 'flex', alignItems: 'center', gap: 22, opacity: k(u, 0.35 + j * 0.12, 0.55 + j * 0.12) }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>✓</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{s.title}</div>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 80, right: 80, top: 900 }}>
          <div style={{ width: 150, height: 150, borderRadius: 30, background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 84, fontWeight: 700, fontFamily: FONT.jp,
            transform: `scale(${k(u, 1.0, 1.4, 2.2, 1, snapIn)}) rotate(${k(u, 1.0, 1.4, -12, -4)}deg)`, opacity: k(u, 1.0, 1.08), boxShadow: '0 0 40px rgba(47,158,87,.5)' }}>済</div>
          <div style={{ marginTop: 56, fontSize: 108, fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, paddingBottom: '0.18em', clipPath: `inset(0 ${100 - k(u, 1.3, 2.0, 0, 100)}% 0 0)` }}>Have a great trip.</div>
          <div style={{ marginTop: 34, display: 'inline-flex', alignItems: 'center', gap: 14, height: 70, padding: '0 26px', borderRadius: 16, background: '#fff', color: C.ink, fontSize: 40, fontWeight: 700, opacity: k(u, 1.9, 2.3) }}>
            <span style={{ width: 14, height: 40, borderRadius: 4, background: C.red }} />ourtrips.date/japan
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
