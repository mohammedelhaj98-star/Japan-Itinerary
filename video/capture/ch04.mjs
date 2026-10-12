// Chapter 4: How do I see just our couple's plan?
// Day 7 has no split, so this one is on Day 12, when the couples split up after Ginza (NASA: Marunouchi and
// Yoroniku; M&M: date night). The day is picked before the recording starts.
const TIME = '2026-10-22T03:20:00Z';
export default {
  name: 'ch04-couple-plan',
  path: '/japan/',
  time: TIME, // during the trip (Day 7), looking ahead to Day 12
  tourStep: 13, // a money-page step: on the trip page the tour just waits, so none of its hooks run here
  meta: {
    why: 'So on split evenings you only see where you two are going.',
    recap: ['Day panel', 'M&M', 'Your day', 'Close', 'Open', 'All'],
    next: 'Next: mark a stop as done',
  },
  async prepare(pg) {
    for (let i = 0; i < 5; i++) { await pg.tap('#next'); await pg.waitForTimeout(700); } // Day 7 → Day 12
    await pg.waitForTimeout(2000); // map tiles
    // prepare runs on the page clock in real time, and the recorder pauses it at time + 5 s: wind it back so a slow prepare fits
    await pg.clock.setSystemTime(new Date(Date.parse(TIME) + 3000));
  },
  async script({ tap, point, hold }) {
    await hold(2, 'Day 12: the couples split up for the evening.');
    await tap('#ddtab', { step: 1, caption: 'Open the day panel: tap the tab on the left' });
    await tap('[data-who="mm"]', { step: 2, caption: "Tap M&M for just Mariam and Mo's plan" });
    await point('#dial', { step: 3, caption: "NASA's late evening drops off the dial" });
    await tap('#ddtab', { step: 4, caption: 'Close it: only your stops are on the map' });
    await tap('#ddtab', { step: 5, caption: 'Open the panel again' });
    await tap('[data-who="all"]', { step: 6, caption: 'Tap All to bring everyone back' });
    await hold(3, 'All four are back. It only changes your phone.');
  },
};
