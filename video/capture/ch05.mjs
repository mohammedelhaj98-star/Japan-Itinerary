// Chapter 5: How do I mark a stop as done?
// 4:40 pm on Day 7, at Amerika-mura; everything before it is stamped. The page is scrolled a little and the map
// re-centred before recording, so the Stamp button and the stop's map pin are both on screen when it's tapped.
const done = ['d01-land', 'd07-kintetsu', 'd07-bus', 'd07-todaiji', 'd07-deer', 'd07-to-osaka', 'd07-kuromon', 'd07-shinsekai', 'd07-subway', 'd07-shinsaibashi'];
const TIME = '2026-10-22T07:40:00Z';
export default {
  name: 'ch05-stamp',
  path: '/japan/',
  time: TIME, // Day 7, 4:40 pm in Osaka
  tourStep: 13, // a money-page step: on the trip page the tour just waits (the stamp step would scroll away after the stamp)
  state: { checks: Object.fromEntries(done.map((id) => [id, true])) },
  meta: {
    why: 'So all four phones know what is done and what is next.',
    recap: ['Stamp 済', 'Faded', 'Next stop', 'Pin'],
    next: 'Next: decide on the day together',
  },
  async prepare(pg) {
    await pg.evaluate(() => window.scrollTo(0, 165)); await pg.waitForTimeout(500);
    // step away and back, so the map flies to the open stop above the raised stops
    await pg.tap('.pass.open .pnav [data-step="1"]'); await pg.waitForTimeout(900);
    await pg.tap('.pass.open .pnav [data-step="-1"]'); await pg.waitForTimeout(3000); // flight + map tiles
    // prepare runs on the page clock in real time, and the recorder pauses it at time + 5 s: wind it back so a slow prepare fits
    await pg.clock.setSystemTime(new Date(Date.parse(TIME) + 3000));
  },
  async script({ tap, point, hold }) {
    await hold(2, "You're at Amerika-mura. Done here?");
    await tap('.pass.open [data-stamp]', { step: 1, caption: 'Tap Stamp 済' });
    await point('.pass.open .hanko', { step: 2, caption: 'The pass fades and gets a 済 stamp' });
    await tap('.pass.open .pnav [data-step="1"]', { step: 3, caption: 'Tap › to move on to the next stop' });
    await point('.pin[data-pin="8"]', { step: 4, caption: 'Its pin on the map is filled in' });
    await hold(3, "Stamped 済, and it's on everyone's phone.");
  },
};
