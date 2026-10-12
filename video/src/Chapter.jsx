// One tutorial chapter in one of three looks: 'paper', 'rail' or 'camera'.
import { AbsoluteFill, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, W, H, fontCss } from './theme.js';
import { buildTimeline, captionAt, focusAt, ease, VIEW } from './timeline.js';
import { Screen, boxOnCanvas } from './Screen.jsx';

export const INTRO = 3.2, OUTRO = 5;
const clampI = (t, a, b, from, to, e = ease) => interpolate(t, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });

export function Chapter({ look = 'paper', chapter, tl }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const T = buildTimeline(tl);
  const g = frame / fps; // global seconds
  const rise = INTRO - 0.75; // the screen starts rising (and playing) here
  const tc = Math.max(0, Math.min(T.duration - 1 / fps, g - rise)); // clip seconds
  const outro = rise + T.duration; // the clip has ended
  const P = { T, g, tc, rise, outro, chapter, clipFrames: Math.round(T.duration * fps), fps };
  return (
    <AbsoluteFill style={{ fontFamily: FONT.body }}>
      <style>{fontCss(staticFile)}</style>
      {look === 'paper' && <Paper {...P} />}
      {look === 'rail' && <Rail {...P} />}
      {look === 'camera' && <Camera {...P} />}
    </AbsoluteFill>
  );
}

// the clip, playing from `rise` and holding its last frame afterwards
function Clip({ P, ...props }) {
  const { rise, fps, clipFrames, g, outro } = P;
  const from = Math.round(rise * fps);
  if (g < rise) return null;
  const screen = <Screen T={P.T} t={P.tc} clip={P.chapter.clip} {...props} />;
  return g < outro ? <Sequence from={from} layout="none">{screen}</Sequence> : <Freeze frame={clipFrames - 2}>{screen}</Freeze>;
}

const Badge = ({ n, size = 64, bg = C.red, fg = '#fff' }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.5, flex: 'none', fontFeatureSettings: '"tnum"' }}>{n}</div>
);

/* ─────────────── 1. Paper: the site's own look ─────────────── */
function Paper(P) {
  const { T, g, tc, rise, outro, chapter } = P;
  const PW = 640, top = 330, left = (W - PW) / 2;
  const intoHeader = clampI(g, rise - 0.15, rise + 0.55, 0, 1);
  const phoneY = clampI(g, rise, rise + 0.8, H, top);
  const outK = clampI(g, outro, outro + 0.7, 0, 1);
  const cap = g >= rise && g < outro ? captionAt(T, tc) : null;
  const capT = cap ? tc - cap.t : 0;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 0%, #fdfcf8 0%, ${C.paper} 60%, #ece8de 100%)` }}>
      {/* header: big and centred in the intro, then settles at the top */}
      <div style={{ position: 'absolute', left: 80, right: 80, top: interpolate(intoHeader, [0, 1], [700, 92]), textAlign: interpolate(intoHeader, [0, 1], [0, 1]) > 0.5 ? 'left' : 'left' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.red, opacity: clampI(g, 0.1, 0.5, 0, 1) }}>
          Chapter {chapter.n} · {chapter.part.replace(/^Part \d · /, '')}
        </div>
        <div style={{ fontFamily: FONT.display, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 14,
          fontSize: interpolate(intoHeader, [0, 1], [124, 82]), opacity: clampI(g, 0.25, 0.75, 0, 1), transform: `translateY(${clampI(g, 0.25, 0.85, 30, 0)}px)` }}>
          {chapter.title}
        </div>
        <div style={{ fontSize: 40, color: C.ink2, marginTop: 26, opacity: clampI(g, 0.7, 1.1, 0, 1) * (1 - intoHeader), height: (1 - intoHeader) * 60, overflow: 'hidden' }}>{chapter.why}</div>
      </div>
      {/* the phone */}
      <div style={{ position: 'absolute', left, top: phoneY + outK * 120, transform: `scale(${1 - outK * 0.12})`, transformOrigin: '50% 0', opacity: 1 - outK }}>
        <Clip P={P} width={PW} radius={54} />
      </div>
      {/* caption */}
      {cap && (
        <div style={{ position: 'absolute', left: 70, right: 70, top: top + PW / VIEW.w * VIEW.h + 34, display: 'flex', alignItems: 'center', gap: 26,
          opacity: clampI(capT, 0, 0.45, 0, 1), transform: `translateY(${clampI(capT, 0, 0.7, 18, 0)}px)` }}>
          {cap.step ? <Badge n={cap.step} size={74} /> : null}
          <div style={{ fontSize: cap.step ? 44 : 40, fontWeight: cap.step ? 700 : 500, color: cap.step ? C.ink : C.ink2, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{cap.text}</div>
        </div>
      )}
      {/* recap */}
      {g >= outro && <Recap P={P} dark={false} />}
    </AbsoluteFill>
  );
}

function Recap({ P, dark }) {
  const { g, outro, chapter } = P; const k = g - outro;
  const ink = dark ? '#fff' : C.ink, sub = dark ? 'rgba(255,255,255,.6)' : C.ink2;
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top: 700 }}>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.red, opacity: clampI(k, 0.2, 0.5, 0, 1) }}>In short</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px 14px', marginTop: 26 }}>
        {chapter.recap.map((w, i) => {
          const a = 0.4 + i * 0.3;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: clampI(k, a, a + 0.25, 0, 1), transform: `translateY(${clampI(k, a, a + 0.4, 18, 0)}px)` }}>
              <span style={{ padding: '14px 26px', borderRadius: 999, background: dark ? 'rgba(255,255,255,.1)' : '#fff', border: dark ? '1px solid rgba(255,255,255,.18)' : '1px solid rgba(20,20,10,.08)',
                boxShadow: dark ? 'none' : '0 8px 20px -12px rgba(20,20,10,.3)', fontSize: 42, fontWeight: 700, color: ink }}>{w}</span>
              {i < chapter.recap.length - 1 && <span style={{ fontSize: 40, color: sub }}>→</span>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 70, fontSize: 36, color: sub, opacity: clampI(k, 2.6, 3.1, 0, 1) }}>{chapter.next}</div>
    </div>
  );
}

/* ─────────────── 2. Rail: night signage, the steps as stations on a line ─────────────── */
function Rail(P) {
  const { T, g, tc, rise, outro, chapter } = P;
  const PW = 560, top = 330, left = W - PW - 56;
  const phoneX = clampI(g, rise, rise + 0.8, W + 40, left);
  const cur = g >= rise ? captionAt(T, tc) : null;
  const curStep = g >= outro ? T.totalSteps + 1 : cur && cur.step ? cur.step : (g >= rise && tc > 1 ? T.totalSteps + 0.5 : 0);
  const stepsList = T.captions.filter((c) => c.step);
  const railTop = 380, gap = 205, railX = 92;
  const fill = clampI(g, 0.4, 1.4, 0, 1);
  return (
    <AbsoluteFill style={{ background: '#121210' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 80% 40%, rgba(226,59,46,.16), transparent 70%)' }} />
      {/* station sign */}
      <div style={{ position: 'absolute', left: 56, top: 86, right: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: clampI(g, 0, 0.35, 0, 1) }}>
          <div style={{ height: 76, padding: '0 26px', borderRadius: 16, background: '#fff', color: C.ink, display: 'flex', alignItems: 'center', gap: 14, fontWeight: 700, fontSize: 40 }}>
            <span style={{ width: 16, height: 46, borderRadius: 4, background: C.red }} />{String(chapter.n).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>{chapter.part}</div>
        </div>
        <div style={{ marginTop: 30, fontSize: 68, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.05,
          clipPath: `inset(0 ${100 - clampI(g, 0.25, 1.0, 0, 100)}% 0 0)` }}>{chapter.title}</div>
      </div>
      {/* the line */}
      <div style={{ position: 'absolute', left: railX - 5, top: railTop, width: 10, height: gap * (stepsList.length) * fill, borderRadius: 5, background: 'rgba(255,255,255,.14)' }} />
      <div style={{ position: 'absolute', left: railX - 5, top: railTop, width: 10, borderRadius: 5, background: C.red,
        height: Math.max(0, Math.min(stepsList.length, curStep - 1 + (curStep > 0 ? 0.0 : 0)) ) * gap }} />
      {stepsList.map((c, i) => {
        const n = i + 1, done = curStep > n, on = Math.floor(curStep) === n && g < outro;
        const y = railTop + i * gap, a = 0.5 + i * 0.12;
        return (
          <div key={i} style={{ position: 'absolute', left: railX - 34, top: y - 34, display: 'flex', gap: 26, width: left - railX - 10, opacity: clampI(g, a, a + 0.3, 0, 1) }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32,
              background: on ? C.red : done ? '#fff' : '#121210', color: on ? '#fff' : done ? C.ink : 'rgba(255,255,255,.6)',
              border: on || done ? 'none' : '4px solid rgba(255,255,255,.3)', transform: `scale(${on ? 1.12 : 1})`, boxShadow: on ? '0 0 0 12px rgba(226,59,46,.25)' : 'none' }}>{done ? '✓' : n}</div>
            <div style={{ fontSize: on ? 38 : 32, fontWeight: on ? 700 : 500, lineHeight: 1.18, color: on ? '#fff' : done ? 'rgba(255,255,255,.62)' : 'rgba(255,255,255,.4)', paddingTop: 10 }}>{c.text}</div>
          </div>
        );
      })}
      {/* last stop: the result / next chapter */}
      {(() => {
        const y = railTop + stepsList.length * gap, k = g - outro;
        const hold = T.captions.filter((c) => !c.step).slice(-1)[0];
        const showHold = g >= rise && hold && tc >= hold.t;
        return (
          <div style={{ position: 'absolute', left: railX - 34, top: y - 34, width: left - railX - 10, display: 'flex', gap: 26, opacity: showHold || k > 0 ? 1 : clampI(g, 1.3, 1.6, 0, 0.35) }}>
            <div style={{ width: 68, height: 68, borderRadius: 14, flex: 'none', background: showHold || k > 0 ? C.green : 'transparent', border: showHold || k > 0 ? 'none' : '4px solid rgba(255,255,255,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 34 }}>済</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.2, paddingTop: 8 }}>{k > 0.4 ? chapter.next : showHold ? hold.text : 'Done'}</div>
          </div>
        );
      })()}
      <div style={{ position: 'absolute', left: phoneX, top }}>
        <Clip P={P} width={PW} radius={50} ring={C.red} touch="dark" camOpts={{ still: true }} dim={0.55} />
      </div>
    </AbsoluteFill>
  );
}

/* ─────────────── 3. Camera: big moves, kinetic words, notes pinned to the button ─────────────── */
function Camera(P) {
  const { T, g, tc, rise, outro, chapter } = P;
  const PW = 720, top = 300, left = (W - PW) / 2, camOpts = { maxZoom: 1.5, minZoom: 1.22, fill: 0.72 };
  const cur = g >= rise && g < outro ? captionAt(T, tc) : null;
  const f = g >= rise && g < outro ? focusAt(T, tc) : null;
  const word = cur && cur.step ? chapter.recap[cur.step - 1] : null;
  const wT = cur ? tc - cur.t : 0;
  const titleWords = chapter.title.split(' ');
  const introOut = clampI(g, rise - 0.2, rise + 0.4, 1, 0);
  const tilt = clampI(g, rise, rise + 1.2, 14, 0);
  const outK = clampI(g, outro, outro + 0.8, 0, 1);
  const drift = Math.sin(g * 0.35) * 40;
  const cb = f ? boxOnCanvas(T, tc, f.box, { left, top, width: PW, camOpts }) : null;
  const above = cb && cb.y > 760;
  return (
    <AbsoluteFill style={{ background: '#f3efe8', overflow: 'hidden' }}>
      {/* soft colour field from the city colours on the trip calendar */}
      <div style={{ position: 'absolute', width: 1200, height: 1200, left: -420 + drift, top: -380, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(44,79,134,.42), transparent)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', width: 1100, height: 1100, right: -460 - drift, top: 520, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(204,90,38,.38), transparent)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', width: 1000, height: 1000, left: -300, bottom: -560 + drift, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(185,75,116,.32), transparent)', filter: 'blur(40px)' }} />
      {/* kinetic step word behind the phone */}
      {word && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center', fontFamily: FONT.display, fontSize: word.length > 8 ? 150 : 200, lineHeight: 1, color: C.ink,
          letterSpacing: '-0.03em', whiteSpace: 'nowrap', opacity: clampI(wT, 0, 0.35, 0, 1), transform: `translateY(${clampI(wT, 0, 0.6, 40, 0)}px)` }}>{word}</div>
      )}
      {/* intro title, word by word */}
      {introOut > 0 && (
        <div style={{ position: 'absolute', left: 80, right: 80, top: 560, opacity: introOut }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: C.ink, opacity: clampI(g, 0, 0.3, 0, 0.7) }}>{chapter.n} · {chapter.part.replace(/^Part \d · /, '')}</div>
          <div style={{ fontFamily: FONT.display, fontSize: 150, lineHeight: 0.98, letterSpacing: '-0.03em', color: C.ink, marginTop: 20 }}>
            {titleWords.map((w, i) => (
              <span key={i} style={{ display: 'inline-block', marginRight: 34, opacity: clampI(g, 0.15 + i * 0.12, 0.45 + i * 0.12, 0, 1), transform: `translateY(${clampI(g, 0.15 + i * 0.12, 0.7 + i * 0.12, 70, 0)}px)`,
                color: i === titleWords.length - 1 ? C.red : C.ink, fontStyle: i === titleWords.length - 1 ? 'italic' : 'normal' }}>{w}</span>
            ))}
          </div>
        </div>
      )}
      {/* phone */}
      <div style={{ position: 'absolute', left, top: clampI(g, rise, rise + 0.9, H + 100, top) + outK * 200, perspective: 2400,
        transform: `scale(${1 - outK * 0.25})`, opacity: 1 - outK }}>
        <div style={{ transform: `rotateX(${tilt}deg) rotateY(${-tilt * 0.6}deg)`, transformOrigin: '50% 100%' }}>
          <Clip P={P} width={PW} radius={64} camOpts={camOpts} ring="#ffffff" touch="light" />
        </div>
      </div>
      {/* the note pinned to the button */}
      {cb && cur && cur.step && (
        <div style={{ position: 'absolute', left: Math.max(40, Math.min(W - 40 - 760, cb.x + cb.w / 2 - 380)), width: 760,
          top: above ? cb.y - 30 : cb.y + cb.h + 30, transform: above ? 'translateY(-100%)' : 'none', display: 'flex', justifyContent: 'center',
          opacity: clampI(wT, 0.15, 0.4, 0, 1) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 30px 18px 18px', borderRadius: 999, background: 'rgba(20,20,18,.92)', color: '#fff',
            boxShadow: '0 24px 50px -20px rgba(0,0,0,.6)', transform: `scale(${clampI(wT, 0.15, 0.5, 0.9, 1)})` }}>
            <Badge n={cur.step} size={58} bg={C.red} />
            <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.15 }}>{cur.text}</span>
          </div>
        </div>
      )}
      {/* hold captions (no button) sit at the bottom */}
      {cur && !cur.step && (
        <div style={{ position: 'absolute', left: 70, right: 70, bottom: 70, textAlign: 'center', fontSize: 42, fontWeight: 700, color: C.ink, opacity: clampI(wT, 0, 0.3, 0, 1) }}>
          <span style={{ background: 'rgba(255,255,255,.85)', padding: '16px 28px', borderRadius: 24, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', lineHeight: 1.6 }}>{cur.text}</span>
        </div>
      )}
      {/* outro: the recap as big words, one after another */}
      {g >= outro && (
        <div style={{ position: 'absolute', left: 80, right: 80, top: 440 }}>
          {chapter.recap.map((w, i) => {
            const a = 0.35 + i * 0.32;
            return (
              <div key={i} style={{ fontFamily: FONT.display, fontSize: 118, lineHeight: 1.04, letterSpacing: '-0.02em', color: i === chapter.recap.length - 1 ? C.red : C.ink,
                opacity: clampI(g - outro, a, a + 0.25, 0, 1), transform: `translateX(${clampI(g - outro, a, a + 0.5, -60, 0)}px)` }}>
                <span style={{ fontFamily: FONT.body, fontSize: 40, fontWeight: 700, color: C.ink3, marginRight: 24, verticalAlign: 'middle' }}>{i + 1}</span>{w}
              </div>
            );
          })}
          <div style={{ marginTop: 50, fontSize: 36, color: C.ink2, opacity: clampI(g - outro, 2.8, 3.3, 0, 1) }}>{chapter.next}</div>
        </div>
      )}
    </AbsoluteFill>
  );
}
