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
    const ringEnd = Math.min(next ? next.t : tl.duration, typed ? typed.t + 0.4 : tap ? tap.t + 0.35 : e.t + 1.2);
    focus.push({ t0: e.t, t1: ringEnd, box: (tap && tap.box) || e.box, sel: e.sel });
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
  let cam = WIDE, from = WIDE, start = -10;
  for (const s of T.shots) {
    if (s.t > t) break;
    const k = glide(Math.min(1, Math.max(0, (s.t - start) / dur)));
    from = mix(from, cam, k); // where the previous move was when this one began
    cam = s.wide ? WIDE : cameraFor(s.box, opts); start = s.t;
  }
  return mix(from, cam, glide(Math.min(1, Math.max(0, (t - start) / dur))));
}

export const tapsAt = (T, t, life = 0.7) => T.taps.filter((x) => t >= x.t && t < x.t + life).map((x) => ({ ...x, age: (t - x.t) / life }));
export const fade = (t, a, b, d = 0.3) => interpolate(t, [a, a + d, b - d, b], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export { ease };
