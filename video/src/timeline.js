// Turns a recorded clip's tap log (public/clips/<name>/timeline.json) into what's on screen at time t:
// which caption, which step, where the camera is looking, and where the touch is.
import { Easing, interpolate } from 'remotion';

export const VIEW = { w: 390, h: 844 }; // the phone the clip was recorded on, in CSS px

export function buildTimeline(tl) {
  const ev = tl.events;
  const steps = ev.filter((e) => e.kind === 'focus' && e.step).map((e) => e.step);
  const totalSteps = steps.length ? Math.max(...steps) : 0;
  const captions = ev.filter((e) => (e.kind === 'focus' || e.kind === 'hold') && e.caption).map((e) => ({ t: e.t, text: e.caption, step: e.step || null }));
  // the camera: each focus holds until its tap has landed and settled, or until the next focus
  const focus = [];
  ev.forEach((e, i) => {
    if (e.kind !== 'focus' || !e.box) return;
    const nextFocus = ev.slice(i + 1).find((x) => x.kind === 'focus' || x.kind === 'hold');
    const tap = ev.slice(i + 1).find((x) => x.kind === 'tap' && x.sel === e.sel);
    const typed = ev.slice(i + 1).find((x) => x.kind === 'typed' && x.sel === e.sel);
    const end = Math.min(nextFocus ? nextFocus.t - 0.05 : tl.duration, (typed || tap || e).t + 0.9);
    focus.push({ t0: e.t, t1: end, box: (tap && tap.box) || e.box, sel: e.sel });
  });
  const taps = ev.filter((e) => e.kind === 'tap' && e.box);
  return { duration: tl.duration, captions, focus, taps, totalSteps };
}

export const captionAt = (T, t) => { let c = null; for (const x of T.captions) if (x.t <= t + 1e-6) c = x; return c; };
export const focusAt = (T, t) => T.focus.find((f) => t >= f.t0 && t < f.t1) || null;

// camera state for a box: zoom z and the top-left of the visible region, in clip CSS px
export function cameraFor(box, { maxZoom = 1.75, minZoom = 1.3, fill = 0.55 } = {}) {
  if (!box) return { z: 1, x: 0, y: 0 };
  const z = Math.max(minZoom, Math.min(maxZoom, (VIEW.w * fill) / Math.max(box.w, 40), (VIEW.h * 0.32) / Math.max(box.h, 30)));
  const vw = VIEW.w / z, vh = VIEW.h / z, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return { z, x: Math.max(0, Math.min(VIEW.w - vw, cx - vw / 2)), y: Math.max(0, Math.min(VIEW.h - vh, cy - vh * 0.5)) };
}

const ease = Easing.bezier(0.32, 0.72, 0, 1); // the site's own "out" curve
const mix = (a, b, k) => ({ z: a.z + (b.z - a.z) * k, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

// smooth camera: blends from the previous shot to the current one over `dur` seconds
export function cameraAt(T, t, opts = {}, dur = 0.6) {
  const shots = [{ t: -10, cam: { z: 1, x: 0, y: 0 } }];
  for (const f of T.focus) { shots.push({ t: f.t0, cam: cameraFor(f.box, opts) }); shots.push({ t: f.t1, cam: { z: 1, x: 0, y: 0 } }); }
  shots.sort((a, b) => a.t - b.t);
  let i = 0; while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const cur = shots[i], prev = shots[i - 1];
  if (!prev) return cur.cam;
  // where the previous blend had got to when this one started
  const prevStart = shots[i - 2];
  const from = prevStart ? mix(prevStart.cam, prev.cam, ease(Math.min(1, (cur.t - prev.t) / dur))) : prev.cam;
  const k = ease(Math.min(1, Math.max(0, (t - cur.t) / dur)));
  return mix(from, cur.cam, k);
}

export const tapsAt = (T, t, life = 0.7) => T.taps.filter((x) => t >= x.t && t < x.t + life).map((x) => ({ ...x, age: (t - x.t) / life }));
export const fade = (t, a, b, d = 0.3) => interpolate(t, [a, a + d, b - d, b], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export { ease };
