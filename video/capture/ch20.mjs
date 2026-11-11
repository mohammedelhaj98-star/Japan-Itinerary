// Chapter 20: Yen, phrases and emergencies (the ¥ button on the trip page)
// The screencast only sends a frame when something on screen changes, and the clip's last frame isn't held,
// so a still closing screen would cut the closing hold short. A 2px, near-invisible dot that moves every frame keeps frames coming.
export default {
  name: 'ch20-yen-phrases-sos',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 11, // the tour's "Trip tools" step: it only moves on when + is opened, which this chapter never does
  // the converter uses the rates baked into the app (as if fetched today), so it never calls the live rates service
  init: () => {
    try { localStorage.setItem('japan2026.fx', JSON.stringify({ t: Date.now(), r: { CAD: 110.94, QAR: 43.44, USD: 158.1 } })); } catch {}
  },
  meta: {
    why: 'Prices, words and help numbers, all one tap away.',
    recap: ['¥', 'Amount', 'CAD · QAR · USD', 'Phrases', 'Full screen', 'Essentials'],
    next: 'Next: photos, settings and offline',
  },
  async script({ tap, point, hold, wait, pg }) {
    await hold(2, 'The trip page. The ¥ button is at the top.');
    await tap('#kitbtn', { step: 1, caption: 'Tap ¥', opens: true });
    await tap('#kitb [data-k="3"]', { step: 2, caption: 'Type a price on the keypad' });
    for (let i = 0; i < 3; i++) { await pg.tap('#kitb [data-k="0"]'); await wait(0.3); }
    await wait(0.6);
    await point('#kitb .cvbox', { step: 3, caption: 'See it in CAD, QAR and US dollars' });
    await tap('#kitb [data-tab="say"]', { step: 4, caption: 'Tap Phrases' });
    await tap('#kitb [data-phr="1"]', { step: 5, caption: 'Tap one to show it full screen', opens: true });
    await tap('#jpcard .x', { caption: 'Tap ✕ to go back', opens: true });
    await tap('#kitb [data-tab="sos"]', { step: 6, caption: 'Tap Essentials: 110 police, 119 ambulance' });
    await hold(3, 'Plus a 24-hour English hotline, and tips.');
  },
};
