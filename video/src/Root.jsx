import { Composition, staticFile } from 'remotion';
import { Chapter, INTRO, OUTRO } from './Chapter.jsx';
import { CHAPTERS } from './chapters.js';
import { FPS, W, H } from './theme.js';

const LOOKS = ['paper', 'rail', 'camera'];
export const Root = () => (
  <>
    {CHAPTERS.flatMap((ch) => LOOKS.map((look) => (
      <Composition key={ch.id + look} id={`${ch.id}-${look}`} component={Chapter} fps={FPS} width={W} height={H} durationInFrames={60}
        defaultProps={{ look, chapter: ch, tl: null }}
        calculateMetadata={async ({ props }) => {
          const tl = await fetch(staticFile(`clips/${ch.clip}/timeline.json`)).then((r) => r.json());
          return { durationInFrames: Math.ceil((INTRO - 0.75 + tl.duration + OUTRO) * FPS), props: { ...props, tl } };
        }} />
    )))}
  </>
);
