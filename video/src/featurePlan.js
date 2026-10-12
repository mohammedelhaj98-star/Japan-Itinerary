// Timing for the 4-feature video, worked out from Mo's voiceover (public/audio/vo.json) and the four scene
// recordings (public/clips/f*/timeline.json). Plain JS with no Remotion imports, so Node scripts (music.mjs) can
// use the same numbers and land the music's final hit on the last word.
//
// Each recorded scene has marks where each spoken line begins. A line starts with its mark; if the voice runs longer
// than the picture for that line, the picture holds on its last frame until the line is said. Scene starts snap to
// the beat (120 BPM), so the "next stop" splash and its whoosh land on the music.
export const SCENES = [
  { key: 'f1-dial', title: 'The day dial', short: 'Day dial' },
  { key: 'f2-receipt', title: 'Scan a receipt', short: 'Receipt' },
  { key: 'f3-settle', title: 'Settle up', short: 'Settle up' },
  { key: 'f4-photos', title: 'Photos', short: 'Photos' },
];
export const BEAT = 0.5, SPLASH = 1.0, LINE_IN = 0.08;

// beat: the music's beat length; video time 0 sits on one of its beats
export function planFeature(vo, tls, { beat = BEAT } = {}) {
  const snap = (t) => Math.ceil(t / beat - 1e-6) * beat;
  const line = Object.fromEntries(vo.map((l) => [l.id, { ...l, len: l.end - l.start }]));
  const voPlace = [], taps = [], whooshes = [];
  const say = (id, at) => voPlace.push({ id, at, from: line[id].start, to: line[id].end });

  // cold open: quick one-beat cuts under the first half of the opening line, then the title slams in
  const open = line.open;
  say('open', 0.3);
  const titleAt = snap(0.3 + open.len * 0.5);
  const openEnd = snap(0.3 + open.len + 0.35);
  const moments = [['f1-dial', 'tap', 0, 0.5], ['f2-receipt', 'focus', 2, 0.3], ['f2-receipt', 'tap', 4, 0.15], ['f3-settle', 'tap', 3, 0.3], ['f4-photos', 'tap', 1, 0.9], ['f4-photos', 'tap', 3, 0.8], ['f1-dial', 'tap', 0, 1.1], ['f2-receipt', 'tap', 6, 0.4]];
  const cuts = [];
  for (let t = 0, i = 0; t < titleAt - 1e-6; t += beat, i++) {
    const [key, kind, n, off] = moments[i % moments.length];
    const ev = tls[key].events.filter((e) => e.kind === kind)[n] || tls[key].events[0];
    cuts.push({ clip: key, at: Math.max(0, Math.min(tls[key].duration - beat - 0.05, ev.t + off)), start: t, dur: Math.min(beat, titleAt - t) });
  }

  // the four scenes
  let t = openEnd; const scenes = [];
  SCENES.forEach((sc, k) => {
    const tl = tls[sc.key], S = snap(t), P = S + SPLASH;
    whooshes.push(S);
    const marks = tl.events.filter((e) => e.kind === 'mark');
    const beats = []; let b = P;
    marks.forEach((m, j) => {
      const next = marks[j + 1], segEnd = next ? next.t : tl.duration;
      const seg = segEnd - m.t, v = line[m.label].len;
      const D = Math.max(seg, v + (next ? 0.22 : 0.6));
      say(m.label, b + LINE_IN);
      beats.push({ label: m.label, m: m.t, seg, b, D });
      for (const e of tl.events) if (e.kind === 'tap' && e.t >= m.t && e.t < segEnd) taps.push(b + (e.t - m.t));
      b += D;
    });
    scenes.push({ ...sc, k, S, P, end: b, beats, tl });
    t = b + 0.1;
  });

  // outro: the line completes and the 済 stamp lands, under the last line
  const O = snap(t); whooshes.push(O);
  say('outro', O + 0.45);
  const total = snap(O + 0.45 + line.outro.len + 1.4);
  const speech = voPlace.map((p) => [p.at, p.at + (p.to - p.from)]);
  return { total, open: { titleAt, end: openEnd, cuts }, scenes, outro: { start: O, end: total }, voPlace, taps, whooshes, speech, musicFrom: 0, voEnd: O + 0.45 + line.outro.len };
}

// fit a real track (track.json from track.mjs): plan on its beat, start it on a bar line chosen so its natural ending
// lands just after the last word, and let the video end when the music does
export function planWithTrack(vo, tls, track, { endPad = 0.25 } = {}) {
  const p = planFeature(vo, tls, { beat: track.beat });
  const bar = track.beat * 4, end = track.musicEnds ?? track.soundEnds;
  let from = end - (p.total - endPad);
  from = track.firstDownbeat + Math.round((from - track.firstDownbeat) / bar) * bar;
  if (from < 0) from += bar * Math.ceil(-from / bar);
  const total = end - from + endPad;
  if (total < p.voEnd + 0.8) return { ...p, musicFrom: Math.max(0, from) }; // the music would end before the voice: keep the plan's own length
  return { ...p, total, outro: { ...p.outro, end: total }, musicFrom: from };
}

// the music's volume at time t: full between lines, tucked under the voice, faded in and out at the ends
export function musicVolume(plan, t, { base = 0.7, under = 0.17, ramp = 0.18 } = {}) {
  let duck = 0;
  for (const [a, b] of plan.speech) {
    if (t > a - ramp && t < b + ramp * 1.5) duck = Math.max(duck, Math.min(1, (t - (a - ramp)) / ramp, (b + ramp * 1.5 - t) / (ramp * 1.5)));
  }
  const fadeIn = Math.min(1, t / 0.25), fadeOut = Math.min(1, Math.max(0, (plan.total - t) / (plan.musicFrom ? 0.3 : 1.2)));
  return (base - (base - under) * duck) * fadeIn * fadeOut;
}
