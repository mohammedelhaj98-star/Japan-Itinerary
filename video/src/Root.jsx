import { Composition, staticFile } from 'remotion';
import { Chapter, INTRO, OUTRO } from './Chapter.jsx';
import { Tutorial, plan } from './Tutorial.jsx';
import { HomeScreen, HOME_SECS } from './HomeScreen.jsx';
import { Feature } from './Feature.jsx';
import { SCENES, planFeature, planWithTrack } from './featurePlan.js';
import { Reel, TRICKS, MONTAGE, OPEN as REEL_OPEN, CLOSE as REEL_CLOSE, PLAY_AT, trimOf } from './Reel.jsx';
import { CHAPTERS, MUST_KNOW, withMeta } from './chapters.js';
import { FPS, W, H } from './theme.js';

const loadTl = (ch) => fetch(staticFile(`clips/${ch.clip}/timeline.json`)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const chapterSecs = (tl) => INTRO - 0.75 + tl.duration + OUTRO;
// every recorded chapter, in order, with its timeline (chapters not recorded yet are left out)
async function recorded(only) {
  const list = CHAPTERS.filter((c) => !only || only.includes(c.n));
  const tls = await Promise.all(list.map(loadTl));
  return list.map((c, i) => tls[i] && { chapter: withMeta(c, tls[i]), tl: tls[i], dur: chapterSecs(tls[i]) }).filter(Boolean);
}
const tutorialMeta = (only, parts) => async ({ props }) => {
  const fps = props.fps || FPS; const p = plan(await recorded(only), { parts });
  // render.mjs reads these back to put chapter marks in the mp4 and write a list to paste in the group chat
  const markers = p.segments.filter((s) => s.kind === 'chapter').map((s) => ({ t: s.start, n: s.chapter.n, title: s.chapter.title }));
  return { fps, durationInFrames: Math.ceil(p.total * fps), props: { ...props, segments: p.segments, markers } };
};

// the "8 things" reel: each trick's clip trimmed to its taps, and the cold open's quick cuts
const reelMeta = async ({ props }) => {
  const fps = props.fps || FPS; const byId = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
  const load = async (id) => { const c = byId[id]; const tl = await loadTl(c); if (!tl) throw new Error(id + " isn't recorded yet"); return { c, tl }; };
  const items = await Promise.all(TRICKS.map(async (x) => { const { c, tl } = await load(x.ch); return { ...x, clip: c.clip, tl, ...trimOf(tl) }; }));
  const montage = await Promise.all(MONTAGE.map(async ([id, tap, off]) => { const { c, tl } = await load(id); const taps = tl.events.filter((e) => e.kind === 'tap'); return { clip: c.clip, tl, at: Math.max(0, (taps[tap] || taps[0]).t + off - 0.2) }; }));
  const total = REEL_OPEN + items.reduce((a, x) => a + PLAY_AT + x.t1 - x.t0, 0) + REEL_CLOSE;
  return { fps, durationInFrames: Math.ceil(total * fps) + 2, props: { ...props, items, montage } };
};

// the 4-feature video, timed to Mo's voiceover (public/audio/vo.json, made by vo.mjs)
const featureMeta = async ({ props }) => {
  const fps = props.fps || FPS;
  const vo = await fetch(staticFile('audio/vo.json')).then((r) => r.json());
  const tls = Object.fromEntries(await Promise.all(SCENES.map(async (sc) => [sc.key, await fetch(staticFile(`clips/${sc.key}/timeline.json`)).then((r) => r.json())])));
  // with a bought track (track.json from track.mjs), time the video to its beat and its ending
  // without the bought track (track.mjs not run), fall back to the stand-in from music.mjs
  const track = props.music === 'audio/track.wav' ? await fetch(staticFile('audio/track.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  const music = props.music === 'audio/track.wav' && !track ? 'audio/music.wav' : props.music;
  const plan = track ? planWithTrack(vo, tls, track) : planFeature(vo, tls);
  return { fps, durationInFrames: Math.ceil(plan.total * fps), props: { ...props, music, plan } };
};

const LOOKS = { ch11: ['rail', 'paper', 'camera'] }; // the other two looks are kept for chapter 11 only, for comparison
export const Root = () => (
  <>
    <Composition id="tutorial" component={Tutorial} fps={FPS} width={W} height={H} durationInFrames={60}
      defaultProps={{ segments: null, sub: '21 short answers in 4 parts. Skip to the one you need.' }} calculateMetadata={tutorialMeta(null, true)} />
    <Composition id="must-know" component={Tutorial} fps={FPS} width={W} height={H} durationInFrames={60}
      defaultProps={{ segments: null, title: 'The trip site in 2 minutes', sub: 'The six things everyone needs.' }} calculateMetadata={tutorialMeta(MUST_KNOW, false)} />
    <Composition id="feature" component={Feature} fps={FPS} width={W} height={H} durationInFrames={60} defaultProps={{ plan: null, music: 'audio/track.wav' }} calculateMetadata={featureMeta} />
    <Composition id="tricks" component={Reel} fps={FPS} width={W} height={H} durationInFrames={60} defaultProps={{ items: null, montage: null }} calculateMetadata={reelMeta} />
    <Composition id="ch21-home" component={HomeScreen} fps={FPS} width={W} height={H} durationInFrames={Math.round(HOME_SECS * FPS)}
      calculateMetadata={async ({ props }) => ({ fps: props.fps || FPS, durationInFrames: Math.round(HOME_SECS * (props.fps || FPS)) })} />
    {CHAPTERS.flatMap((ch) => (LOOKS[ch.id] || ['rail']).map((look) => (
      <Composition key={ch.id + look} id={`${ch.id}-${look}`} component={Chapter} fps={FPS} width={W} height={H} durationInFrames={60}
        defaultProps={{ look, chapter: ch, tl: null }}
        calculateMetadata={async ({ props }) => {
          const tl = await loadTl(ch); if (!tl) throw new Error(`${ch.id} isn't recorded yet: node video/capture/run.mjs ${ch.id}`);
          const fps = props.fps || FPS; // previews render at 30, the final at 60
          return { fps, durationInFrames: Math.ceil(chapterSecs(tl) * fps), props: { ...props, chapter: withMeta(ch, tl), tl } };
        }} />
    )))}
  </>
);
