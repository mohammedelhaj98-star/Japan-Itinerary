// Chapter 3: What's next, and how do I get there?
// Nara is done (stamped); it's 12:20 pm at Kuromon market. Swipe to the next stop, the map follows,
// and the pass says how to get there. Directions (Google Maps, a new tab) is only ringed, never tapped.
const done = ['d01-land', 'd07-kintetsu', 'd07-bus', 'd07-todaiji', 'd07-deer', 'd07-to-osaka'];
const TIME = '2026-10-22T03:20:00Z';
export default {
  name: 'ch03-whats-next',
  path: '/japan/',
  time: TIME, // Day 7, 12:20 pm in Osaka
  tourStep: 13, // a money-page step: on the trip page the tour just waits, so none of its hooks run here
  state: { checks: Object.fromEntries(done.map((id) => [id, true])) }, // this morning's Nara stops are already stamped
  meta: {
    why: 'So you always know where you are going next, and how.',
    recap: ['Swipe', 'Map', 'How to get there', 'Directions'],
    next: "Next: see just your couple's plan",
  },
  async prepare(pg) {
    // the recording never leaves the local site: any Google Maps link is blocked
    await pg.context().route(/google\.[a-z.]+\/maps/, (r) => r.abort());
    await pg.waitForTimeout(1500); // map tiles
    // prepare runs on the page clock in real time, and the recorder pauses it at time + 5 s: wind it back so a slow prepare fits
    await pg.clock.setSystemTime(new Date(Date.parse(TIME) + 3000));
  },
  async script({ drag, point, hold }) {
    await hold(2, 'Day 7: the open pass is where you are now.');
    await drag('.pass.open .hero', { from: [300, 500], dx: -200, dur: 0.6, step: 1, caption: "Swipe the pass, or tap ›, for what's next" });
    await point('.pin.sel', { step: 2, caption: 'The map flies to the stop' });
    await point('.pass.open .chips .chip:has(svg)', { step: 3, caption: 'How you get there, and how long it takes' });
    await point('.pass.open .a-dir', { step: 4, caption: 'Directions opens the route in Google Maps' });
    await hold(3, 'It opens set to walk, train or taxi, as planned.');
  },
};
