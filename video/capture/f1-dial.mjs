// Feature video, scene 1: the day dial. Paced to Mo's voiceover lines (mark() = where each spoken line starts).
import base from './ch07.mjs';
export default {
  ...base, name: 'f1-dial', meta: null,
  async script({ tap, point, drag, hold, mark }) {
    mark('dial-1'); await hold(4.9, "What's next, and how long have we got?");
    mark('dial-2');
    await tap('#ddtab', { step: 1, caption: 'Open the day panel', lead: 0.6, after: 1.0, opens: true });
    await point('#arc', { step: 2, caption: 'The whole day as a clock', s: 1.7 });
    await point('#nowmk', { step: 3, caption: 'Red tick: right now', s: 1.9 });
    mark('dial-3');
    await drag('#knob', { step: 4, caption: 'Drag the sun', dx: 144, dy: 26, dur: 1.6, lead: 0.5, after: 2.6 });
  },
};
