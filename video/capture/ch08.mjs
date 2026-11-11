// Chapter 8: How do I make the map bigger?
export default {
  name: 'ch08-bigger-map',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 9, // the practice tour's "bigger map" steps (9 and 10), then 11, the + button, which waits for a tap we never make
  // the weather and exchange-rate lookups would go to outside services as the page loads: answer them here instead
  init: () => {
    const real = window.fetch;
    window.fetch = (u, o) => {
      const s = String((u && u.url) || u);
      if (/api\.open-meteo\.com/.test(s)) return Promise.resolve(new Response(JSON.stringify({ daily: { temperature_2m_max: [21.4], temperature_2m_min: [13.6], precipitation_probability_max: [10], weather_code: [1] } }), { headers: { 'content-type': 'application/json' } }));
      if (/open\.er-api\.com/.test(s)) return Promise.resolve(new Response('{"result":"error"}', { headers: { 'content-type': 'application/json' } }));
      return real(u, o);
    };
  },
  meta: {
    why: 'So you can see the whole route, and where everything is.',
    recap: ['Tap handle', 'Tap again', 'Swipe down', 'Swipe up'],
    next: 'Next: add or change a stop',
  },
  async script({ tap, drag, hold }) {
    await hold(2, 'The trip page: the map on top, the stops below.');
    await tap('#grab', { step: 1, caption: 'Tap the handle for a full-screen map', opens: true });
    await tap('#grab', { step: 2, caption: 'Tap it again to bring the stops back', opens: true });
    await drag('#grab', { step: 3, caption: 'Or swipe the stops down', dy: 420, dur: 0.9, opens: true });
    await drag('.mapmax-hint', { step: 4, caption: 'Swipe up to bring them back', dy: -420, dur: 0.9, opens: true });
    await hold(3, 'The stops are back, right where you left them.');
  },
};
