// The recorded phone screen with the tutorial camera: zooms to the button being explained, rings it, shows the touch.
import { OffthreadVideo, staticFile } from 'remotion';
import { VIEW, cameraAt, focusAt, spotAt, tapsAt, fade } from './timeline.js';
import { Easing } from 'remotion';
const pop = Easing.bezier(0.34, 1.4, 0.64, 1); // a soft overshoot as the spotlight lands

export function Screen({ T, t, clip, width, radius = 56, camOpts, ring = '#e23b2e', touch = 'dark', shadow = true, extraZoom = 1, dim = 0.18 }) {
  const s = width / VIEW.w, height = VIEW.h * s;
  const cam = cameraAt(T, t, camOpts);
  const z = cam.z * extraZoom;
  const f = camOpts?.still ? null : focusAt(T, t);
  const sp = camOpts?.still ? spotAt(T, t) : null;
  const px = (v) => v * s;
  return (
    <div style={{ width, height, borderRadius: radius, overflow: 'hidden', position: 'relative', background: '#fff',
      boxShadow: shadow ? '0 50px 90px -40px rgba(20,20,10,.45), 0 0 0 1px rgba(20,20,10,.06)' : 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, transformOrigin: '0 0',
        transform: `translate(${-px(cam.x) * z}px, ${-px(cam.y) * z}px) scale(${z})` }}>
        <OffthreadVideo src={staticFile(`clips/${clip}/clip.mp4`)} style={{ width, height, display: 'block' }} muted />
        {f && (
          <div style={{ position: 'absolute', left: px(f.box.x) - 7 / z * 1.5, top: px(f.box.y) - 7 / z * 1.5,
            width: px(f.box.w) + 14 / z * 1.5, height: px(f.box.h) + 14 / z * 1.5, borderRadius: 18 / z * 1.5,
            border: `${4 / z}px solid ${ring}`, boxShadow: `0 0 0 ${8 / z}px ${ring}33, 0 0 0 4000px rgba(20,20,18,${dim})`, opacity: fade(t, f.t0, f.t1, 0.45) }} />
        )}
        {sp && (() => {
          // the still look: a lit hole that glides between buttons, a gentle pop when it lands, a slow breathing glow
          const landed = sp.linkedPrev ? 1 : pop(Math.min(1, sp.age / 0.45)), sc = 1 + (1 - landed) * 0.14;
          const breathe = 0.5 - 0.5 * Math.cos((sp.age / 1.6) * Math.PI * 2), pad = 7;
          const x = px(sp.box.x) - pad, y = px(sp.box.y) - pad, w = px(sp.box.w) + pad * 2, h = px(sp.box.h) + pad * 2;
          return (
            <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: Math.min(20, h / 2), opacity: sp.o,
              transform: `scale(${sc})`, transformOrigin: '50% 50%',
              border: `4px solid ${ring}`, boxShadow: `0 0 0 ${6 + breathe * 7}px ${ring}2e, 0 0 26px 4px ${ring}55, 0 0 0 4000px rgba(12,12,10,${dim})` }} />
          );
        })()}
        {tapsAt(T, t).map((x, i) => {
          const cx = px(x.box.x + x.box.w / 2), cy = px(x.box.y + x.box.h / 2), d = 92 / z, k = x.age;
          const press = k < 0.25 ? 1 - k * 0.6 : 0.85 + (k - 0.25) * 0.2;
          return (
            <div key={i}>
              <div style={{ position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%',
                background: touch === 'dark' ? 'rgba(20,20,18,.28)' : 'rgba(255,255,255,.55)', border: `${3 / z}px solid ${touch === 'dark' ? 'rgba(20,20,18,.55)' : 'rgba(255,255,255,.95)'}`,
                transform: `scale(${press})`, opacity: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4 }} />
              <div style={{ position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%',
                border: `${3 / z}px solid ${touch === 'dark' ? 'rgba(20,20,18,.35)' : 'rgba(255,255,255,.8)'}`, transform: `scale(${1 + k * 1.3})`, opacity: 1 - k }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// where a box in the clip lands on the canvas, given where the screen is drawn
export function boxOnCanvas(T, t, box, { left, top, width, camOpts, extraZoom = 1 }) {
  const s = width / VIEW.w, cam = cameraAt(T, t, camOpts), z = cam.z * extraZoom;
  return { x: left + (box.x - cam.x) * s * z, y: top + (box.y - cam.y) * s * z, w: box.w * s * z, h: box.h * s * z };
}
