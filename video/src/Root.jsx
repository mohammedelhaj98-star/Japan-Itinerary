import { Composition, staticFile } from 'remotion';
import { Chapter, INTRO, OUTRO } from './Chapter.jsx';
import { Tutorial, plan } from './Tutorial.jsx';
import { HomeScreen, HOME_SECS } from './HomeScreen.jsx';
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

const LOOKS = { ch11: ['rail', 'paper', 'camera'] }; // the other two looks are kept for chapter 11 only, for comparison
export const Root = () => (
  <>
    <Composition id="tutorial" component={Tutorial} fps={FPS} width={W} height={H} durationInFrames={60}
      defaultProps={{ segments: null, sub: '21 short answers in 4 parts. Skip to the one you need.' }} calculateMetadata={tutorialMeta(null, true)} />
    <Composition id="must-know" component={Tutorial} fps={FPS} width={W} height={H} durationInFrames={60}
      defaultProps={{ segments: null, title: 'The trip site in 2 minutes', sub: 'The six things everyone needs.' }} calculateMetadata={tutorialMeta(MUST_KNOW, false)} />
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
