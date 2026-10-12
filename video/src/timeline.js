// Turns a recorded clip's tap log (public/clips/<name>/timeline.json) into what's on screen at time t:
// which caption, which step, where the camera is looking, and where the touch is.
import { Easing, interpolate } from 'remotion';

export const VIEW = { w: 390, h: 844 }; // the phone the clip was recorded on, in CSS px

export function buildTimeline(tl) {
  const ev = tl.events;
  const steps = ev.filter((e) => e.kind === 'focus' && e.step).map((e) => e.step);
  const totalSteps = steps.length ? Math.max(...steps) : 0;
  const captions = ev.filter((e) => (e.kind === 'focus' || e.kind === 'hold') && e.caption).map((e) => ({ t: e.t, text: e.caption, step: e.step || null }));
  // the camera: it settles on each button in turn and glides straight to the next one on the same screen.
  // It only pulls back to the whole screen when a tap opens something new, or for a moment with no button.
  const focus = [], shots = [{ t: -10, wide: true }];
  ev.forEach((e, i) => {
    if (e.kind !== 'focus' || !e.box) return;
    const rest = ev.slice(i + 1);
    const tap = rest.find((x) => x.kind === 'tap' && x.sel === e.sel);
    const typed = rest.find((x) => x.kind === 'typed' && x.sel === e.sel);
    const next = rest.find((x) => x.kind === 'focus' || x.kind === 'hold');
    const ringEnd = Math.min(next ? next.t : tl.duration, typed ? typed.t + 0.4 : tap ? tap.t + (tap.opens ? 0 : 0.35) : next ? next.t : e.t + 2.4); // a tap that opens a new screen: the ring leaves as it's pressed
    focus.push({ t0: e.t, t1: ringEnd, box: (tap && tap.box) || e.box, sel: e.sel, step: e.step || null, opens: !!(tap && tap.opens), tap: tap ? tap.t : null });
    shots.push({ t: e.t, box: (tap && tap.box) || e.box });
    if (tap && tap.opens) shots.push({ t: tap.t + 0.15, wide: true });
    else if (!next || next.kind === 'hold') shots.push({ t: next ? next.t : ringEnd + 0.4, wide: true });
  });
  shots.sort((a, b) => a.t - b.t);
  const taps = ev.filter((e) => e.kind === 'tap' && e.box);
  return { duration: tl.duration, captions, focus, shots, taps, totalSteps };
}

export const captionAt = (T, t) => { let c = null; for (const x of T.captions) if (x.t <= t + 1e-6) c = x; return c; };
export const focusAt = (T, t) => T.focus.find((f) => t >= f.t0 && t < f.t1) || null;

// camera state for a box: zoom z and the top-left of the visible region, in clip CSS px. A gentle push-in,
// never a dive: the viewer should always see enough of the screen to know where they are.
export function cameraFor(box, { maxZoom = 1.32, minZoom = 1.12, fill = 0.7 } = {}) {
  if (!box) return { z: 1, x: 0, y: 0 };
  const z = Math.max(minZoom, Math.min(maxZoom, (VIEW.w * fill) / Math.max(box.w, 40)));
  const vw = VIEW.w / z, vh = VIEW.h / z, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return { z, x: Math.max(0, Math.min(VIEW.w - vw, cx - vw / 2)), y: Math.max(0, Math.min(VIEW.h - vh, cy - vh * 0.5)) };
}

const ease = Easing.bezier(0.32, 0.72, 0, 1); // the site's own "out" curve, for things arriving
const glide = Easing.bezier(0.45, 0, 0.2, 1); // slow in, slow out: for the camera
const mix = (a, b, k) => ({ z: a.z + (b.z - a.z) * k, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const WIDE = { z: 1, x: 0, y: 0 };

// the camera at time t: each move takes `dur` seconds and starts from wherever the last move had got to
export function cameraAt(T, t, opts = {}, dur = 1.3) {
  if (opts.still) return WIDE; // the whole screen stays put; the spotlight does the pointing
  let cam = WIDE, from = WIDE, start = -10;
  for (const s of T.shots) {
    if (s.t > t) break;
    const k = glide(Math.min(1, Math.max(0, (s.t - start) / dur)));
    from = mix(from, cam, k); // where the previous move was when this one began
    cam = s.wide ? WIDE : cameraFor(s.box, opts); start = s.t;
  }
  return mix(from, cam, glide(Math.min(1, Math.max(0, (t - start) / dur))));
}

// The still look's spotlight at time t: which box is lit, how strongly, and how it got there. Between two
// buttons on the same screen it glides across; when a tap opens a new screen it fades out and pops in again.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpBox = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
export const glideEase = Easing.bezier(0.65, 0, 0.25, 1);
export function spotAt(T, t, { glide = 0.6, fadeIn = 0.4, fadeOut = 0.35, bridge = 1.9 } = {}) {
  const F = T.focus; let i = -1;
  for (let j = 0; j < F.length; j++) if (F[j].t0 <= t) i = j;
  if (i < 0) return null;
  const f = F[i], prev = F[i - 1], next = F[i + 1];
  const linkedPrev = !!(prev && !prev.opens && f.t0 - prev.t1 < bridge);
  const linkedNext = !!(next && !f.opens && next.t0 - f.t1 < bridge);
  const gk = linkedPrev ? glideEase(clamp01((t - f.t0) / glide)) : 1;
  const box = linkedPrev ? lerpBox(prev.box, f.box, gk) : f.box;
  let o = t < f.t1 ? (linkedPrev ? 1 : clamp01((t - f.t0) / fadeIn)) : linkedNext ? 1 : 1 - clamp01((t - f.t1) / (f.opens ? 0.1 : fadeOut));
  o = ease(o);
  if (o <= 0.001) return null;
  return { box, o, age: t - f.t0, step: f.step, prevStep: linkedPrev ? prev.step : null, glide: gk, linkedPrev };
}

// a tap that opens a new screen keeps its touch mark short, so it doesn't sit on top of the new screen
export const tapsAt = (T, t, life = 0.7) => T.taps.map((x) => [x, x.opens ? life * 0.45 : life]).filter(([x, L]) => t >= x.t && t < x.t + L).map(([x, L]) => ({ ...x, age: (t - x.t) / L }));
export const fade = (t, a, b, d = 0.3) => interpolate(t, [a, a + d, b - d, b], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export { ease };
