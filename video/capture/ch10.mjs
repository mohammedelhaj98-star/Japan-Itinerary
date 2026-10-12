// Chapter 10: What's on a pass besides the stop?
export default {
  name: 'ch10-pass-extras',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka: the open pass is Kuromon Ichiba Market
  tourStep: 11, // the practice tour's + button step: it waits for a tap we never make, so nothing moves under us
  // the weather and exchange-rate lookups would go to outside services as the page loads: answer them here instead
  // (prices then use the rates built into the app)
  init: () => {
    // keep one invisible pixel changing so the screencast always has a fresh frame: otherwise a still screen at the
    // end sends no frames, and the encoder drops the last frame's time (the closing hold came out ~4 s short)
    const real = window.fetch;
    window.fetch = (u, o) => {
      const s = String((u && u.url) || u);
      if (/api\.open-meteo\.com/.test(s)) return Promise.resolve(new Response(JSON.stringify({ daily: { temperature_2m_max: [21.4], temperature_2m_min: [13.6], precipitation_probability_max: [10], weather_code: [1] } }), { headers: { 'content-type': 'application/json' } }));
      if (/open\.er-api\.com/.test(s)) return Promise.resolve(new Response('{"result":"error"}', { headers: { 'content-type': 'application/json' } }));
      return real(u, o);
    };
  },
  meta: {
    why: 'So prices, phrases and the backstory are there when you need them.',
    recap: ['≈ price', 'Story', 'Phrases', 'Swipe', 'Close', 'Hotel'],
    next: 'Next: log an expense',
  },
  async script({ tap, drag, point, hold }) {
    await hold(2, 'Each pass carries more than the stop itself.');
    await tap('.pass.open .cv-in', { step: 1, caption: 'Tap ≈C$ to switch to QAR or USD' });
    await tap('.pass.open .cv-in');
    await tap('.pass.open .keyp', { step: 2, caption: 'Tap Read the story', after: 2.6 }); // a beat to read it
    await tap('.pass.open .say', { step: 3, caption: 'Tap Phrases for here', opens: true });
    await drag('#cars .pcd', { step: 4, caption: 'Swipe for more, and show staff the screen', dx: -260, dur: 0.7 });
    await tap('#jpcard [data-jpx]', { step: 5, caption: 'Tap ✕ to close', opens: true });
    await point('.stay', { step: 6, caption: "At the bottom: tonight's hotel" });
    await hold(3, 'Tap the hotel card for directions to it.');
  },
};
