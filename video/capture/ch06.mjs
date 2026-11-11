// Chapter 6: How do we decide on the day?
// Day 7 has a Decide card for the evening: Osaka Castle at night, or head home early (the default).
// Picking the castle adds its stop to the day for all four.
const done = ['d01-land', 'd07-kintetsu', 'd07-bus', 'd07-todaiji', 'd07-deer', 'd07-to-osaka'];
export default {
  name: 'ch06-decide',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 13, // a money-page step: on the trip page the tour just waits, so none of its hooks run here
  state: { checks: Object.fromEntries(done.map((id) => [id, true])) },
  meta: {
    why: 'So a plan B is one tap, and nobody is left out of the loop.',
    recap: ['Notes & decisions', 'Current pick', 'Tap yours', 'New stop'],
    next: 'Next: read the day at a glance',
  },
  async script({ tap, point, hold }) {
    await hold(2, 'Some days have a choice to make together.');
    await point('.card:has([data-choice="d07-castle"])', { step: 1, caption: 'Scroll down to Notes & decisions' });
    await point('[data-choice="d07-castle"][data-opt="home"]', { step: 2, caption: "Right now it's set to Head home early" });
    await tap('[data-choice="d07-castle"][data-opt="castle"]', { step: 3, caption: 'Tap your pick: Osaka Castle at night' });
    await point('#p-d07-castle-ev', { step: 4, caption: "It's added to the day's stops" });
    await hold(3, "It's on all four phones straight away.");
  },
};
