// Chapter 7: How do I read the day at a glance?
// The day panel's dial: weather and sun times on top, the stops round a clock, the red tick for now, the sun to scrub.
export default {
  name: 'ch07-day-dial',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 3, // the practice tour's "day tab" step: opening the panel moves it on to the dial step, which keeps the panel open
  // the weather and exchange-rate lookups would go to outside services as the page loads: answer them here instead
  init: () => {
    // keep one invisible pixel changing so the screencast always has a fresh frame: otherwise a still screen at the
    // end sends no frames, and the encoder drops the last frame's time (the closing hold came out ~4 s short)
    const real = window.fetch;
    window.fetch = (u, o) => {
      const s = String((u && u.url) || u);
      if (/api\.open-meteo\.com/.test(s)) return Promise.resolve(new Response(JSON.stringify({ daily: { temperature_2m_max: [21.4], temperature_2m_min: [13.6], precipitation_probability_max: [10], weather_code: [1] } }), { headers: { 'content-type': 'application/json' } }));
      if (/open\.er-api\.com/.test(s)) return Promise.resolve(new Response('{"result":"error"}', { headers: { 'content-type': 'application/json' } })); // falls back to the rates built into the app
      return real(u, o);
    };
  },
  meta: {
    why: 'So you can see the whole day, and where you are in it, in one look.',
    recap: ['Day tab', 'Weather', 'Stops', 'Now', 'Drag the sun'],
    next: 'Next: make the map bigger',
  },
  async script({ tap, point, drag, hold }) {
    await hold(2, 'The trip page for Day 7: Nara + Osaka.');
    await tap('#ddtab', { step: 1, caption: 'Tap the tab on the left', opens: true });
    await point('.facts', { step: 2, caption: 'Weather, sunrise, sunset and dinner' });
    await point('#arc', { step: 3, caption: 'Each colour is a stop, with its start time' });
    await point('#nowmk', { step: 4, caption: "Red tick = now. The middle says what's on" });
    // from the sun (12:20) along the top of the dial into the afternoon
    await drag('#knob', { step: 5, caption: 'Drag the sun to scrub through the day', dx: 144, dy: 26, dur: 1.4 });
    await hold(3, 'The dial shows that stop and when it starts.');
  },
};
