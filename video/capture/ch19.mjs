// Chapter 19: How do I tell a taxi driver where to go?
// The screencast only sends a frame when something on screen changes, and the clip's last frame isn't held,
// so a still closing screen would cut the closing hold short. A 2px, near-invisible dot that moves every frame keeps frames coming.
export default {
  name: 'ch19-taxi',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka; tonight's hotel is the Kyoto Granbell
  tourStep: 11, // the tour's "Trip tools" step: opening + moves it on to the Expenses step, which only acts on the trip page
  meta: {
    why: 'So you can get back to the hotel without speaking Japanese.',
    recap: ['+', 'Taxi cards', 'Tonight', 'Show the driver', 'Maps or call', '✕'],
    next: 'Next: yen, phrases and emergencies',
  },
  async script({ tap, point, hold, pg }) {
    await hold(2, 'The trip page. Taxi cards are under the round + button.');
    await tap('#ttBtn', { step: 1, caption: 'Tap +', opens: true });
    await tap('.tt-opt[href$="v=3"]', { step: 2, caption: 'Tap Taxi cards', opens: true });
    await tap('.hcard[data-hotel="granbell"]', { step: 3, caption: "Tap tonight's hotel", opens: true });
    await point('#driver .name', { step: 4, caption: 'Show this screen to the driver', s: 2.8 });
    await point('#driver .acts', { step: 5, caption: 'Or open it in Maps, or call the hotel' });
    await tap('#driver .x', { step: 6, caption: "Tap ✕ when you're done", opens: true });
    await hold(3, 'Every hotel on the trip has its own card.');
  },
};
