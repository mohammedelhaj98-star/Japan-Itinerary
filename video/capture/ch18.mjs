// Chapter 18: How do I find halal food nearby?
// The finder asks OpenStreetMap (Overpass) for places around a spot. That's an outside service, so it's stubbed here:
// a handful of believable places laid out around whatever centre the page asks about.
const PLACES = [
  // [east m, north m, tags]
  [120, 110, { name: '松りハラルラーメン', 'name:en': 'Matsuri Halal Ramen', cuisine: 'ramen', 'diet:halal': 'yes', opening_hours: '11:00-22:00' }],
  [-190, 170, { name: 'Kebab Palace Namba', cuisine: 'turkish;kebab', 'diet:halal': 'yes', opening_hours: '11:00-23:00' }],
  [260, -220, { name: 'Ganesh Indian Kitchen', cuisine: 'indian', opening_hours: '11:30-22:30' }],
  [-330, -260, { name: 'Green Earth Vegan Café', cuisine: 'cafe', 'diet:vegan': 'yes', opening_hours: '10:00-20:00' }],
  [-90, -80, { name: '海鮮丼 いちば', 'name:en': 'Kaisen Don Ichiba', cuisine: 'seafood', opening_hours: '11:00-21:00' }],
  [210, 230, { name: 'うどん 今井', 'name:en': 'Udon Imai', cuisine: 'udon', opening_hours: '11:00-21:30' }],
  [430, 310, { name: 'Bismillah Curry House', cuisine: 'pakistani', 'diet:halal': 'only', opening_hours: '11:00-22:00' }],
  [-480, 420, { name: 'Okonomiyaki Hanami', cuisine: 'okonomiyaki', 'diet:halal': 'yes', opening_hours: '12:00-22:00' }],
];
const overpass = async (route) => {
  const body = decodeURIComponent((route.request().postData() || '').replace(/^data=/, '').replace(/\+/g, ' '));
  const m = body.match(/around:(\d+),([\d.-]+),([\d.-]+)/); const R = m ? +m[1] : 800, lat = m ? +m[2] : 34.6687, lng = m ? +m[3] : 135.5012;
  const k = Math.min(1, R / 800);
  const elements = PLACES.map(([e, n, tags], i) => ({ type: 'node', id: 9100 + i, lat: lat + (n * k) / 111320, lon: lng + (e * k) / (111320 * Math.cos((lat * Math.PI) / 180)), tags: { amenity: 'restaurant', ...tags } }));
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 0.6, elements }) });
};
export default {
  name: 'ch18-halal',
  path: '/japan/prototypes/tools?v=4',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 29, // the tour's last card: no hooks, so nothing switches tabs under us
  async prepare(pg) {
    await pg.route(/overpass-api\.de|overpass\.kumi\.systems/, overpass);
    // "Near me": a phone standing in Namba, Osaka
    await pg.context().grantPermissions(['geolocation'], { origin: new URL(pg.url()).origin });
    await pg.context().setGeolocation({ latitude: 34.6627, longitude: 135.5019, accuracy: 20 });
  },
  // keep the screencast sending frames on a still screen (it only sends on change, and the clip would end early):
  // a 2 px dot in the corner, all but invisible, that repaints all the time
  meta: {
    why: 'Halal and pork-free food near you, wherever the day takes you.',
    recap: ['Halal', 'A stop', 'Near me', 'Filters', 'Go', 'Pork card'],
    next: 'Next: tell a taxi driver where to go',
  },
  async script({ tap, point, hold, wait, pg }) {
    await hold(2.1, 'The Ideas page has a halal finder too.');
    await tap('[data-fview="nearby"]', { step: 1, caption: 'Tap Halal' });
    await point('#f-where', { step: 2, caption: 'It searches around any stop on the trip' });
    await tap('[data-here]', { step: 3, caption: 'Or tap Near me' });
    await tap('[data-show="fish"]', { step: 4, caption: 'Filter: tap Fish or seafood' });
    // bring the nearest place to the middle of the screen, clear of the home button, before ringing its Go
    await pg.$eval('[data-food]', (e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await wait(0.9);
    await point('[data-food] .go', { step: 5, caption: 'Go opens walking directions' });
    await tap('[data-pork]', { step: 6, caption: 'Tap the pork card to show staff', opens: true });
    await hold(3.0, 'It asks, in Japanese, whether a dish has pork.');
  },
};
