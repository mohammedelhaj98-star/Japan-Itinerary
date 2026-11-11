// Feature video, scene 3: settle up on the last night. Paced to Mo's voiceover lines.
import base from './ch14.mjs';
export default {
  ...base, name: 'f3-settle', meta: null,
  time: '2026-11-01T11:00:00Z', // the last night: Day 17, 8 pm in Tokyo
  async script({ tap, point, hold, mark }) {
    mark('settle-1'); await hold(3.8, 'Last night. Who owes who?');
    mark('settle-2');
    await point('.settle .tr', { step: 1, caption: 'Worked out between the couples', s: 2.5 });
    await tap('[data-mode="each"]', { step: 2, caption: 'Or person to person', lead: 0.6, after: 2.2 });
    mark('settle-3');
    await tap('.settle [data-pay="1"]', { step: 3, caption: 'Tap Paid', lead: 0.7, after: 0.9, opens: true });
    await tap('[data-payok]', { step: 3, caption: 'Tap Paid', lead: 0.8, after: 2.4, opens: true });
  },
};
