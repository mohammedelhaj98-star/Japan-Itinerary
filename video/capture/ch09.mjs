// Chapter 9: How do I add or change a stop?
// Practice mode: the stop added here lives only in the practice sandbox and is never saved.
const GLICO = [{ name: 'Glico Running Man Sign', display_name: 'Glico Running Man Sign, Dotonbori, Chuo Ward, Osaka, 542-0071, Japan', lat: '34.66881', lon: '135.50114' }];
export default {
  name: 'ch09-edit-stop',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 11, // the practice tour's + button step: it waits for a tap we never make, so nothing moves under us
  init: () => {
    // keep one invisible pixel changing so the screencast always has a fresh frame: otherwise a still screen at the
    // end sends no frames, and the encoder drops the last frame's time (the closing hold came out ~4 s short)
    // the weather and exchange-rate lookups would go to outside services as the page loads: answer them here instead
    const real = window.fetch;
    window.fetch = (u, o) => {
      const s = String((u && u.url) || u);
      if (/api\.open-meteo\.com/.test(s)) return Promise.resolve(new Response(JSON.stringify({ daily: { temperature_2m_max: [21.4], temperature_2m_min: [13.6], precipitation_probability_max: [10], weather_code: [1] } }), { headers: { 'content-type': 'application/json' } }));
      if (/open\.er-api\.com/.test(s)) return Promise.resolve(new Response('{"result":"error"}', { headers: { 'content-type': 'application/json' } }));
      return real(u, o);
    };
    // Chrome's scroll anchoring throws the page ~2000 px down when the day re-draws after Add stop;
    // iPhone Safari has none, so switch it off to film what an iPhone shows
    const css = '*{overflow-anchor:none!important}';
    const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  },
  // the place search asks OpenStreetMap: give it a canned answer so nothing leaves the local server
  async prepare(pg) {
    await pg.route(/nominatim\.openstreetmap\.org/, (r) => r.fulfill({ json: GLICO }));
  },
  meta: {
    why: 'So the plan keeps up with what you actually want to do.',
    recap: ['Add a stop', 'Name', 'Time', "Who's going", 'Place', 'Add stop'],
    next: "Next: what's on a pass besides the stop",
  },
  async script({ tap, type, point, hold, wait, pg }) {
    await hold(2, 'Each stop is a pass. You can add your own.');
    await tap('#addgap', { step: 1, caption: 'Tap Add a stop here', opens: true });
    await type('#f-title', 'Photo at the Glico sign', { step: 2, caption: 'Give it a name' });
    await tap('#f-start', { step: 3, caption: 'Pick a start time' });
    await pg.fill('#f-start', '15:15'); await wait(0.8); // a time field can't be typed into on a phone; the picker's result
    await tap('[data-fwho="mm"]', { step: 4, caption: "Who's going: All, NASA or M&M" });
    await type('#f-q', 'Glico', { step: 5, caption: 'Search the place, then pick it' });
    await wait(0.6);
    await tap('[data-fres="0"]');
    await tap('[data-fsave]', { step: 6, caption: 'Tap Add stop', opens: true });
    await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(1);
    await point('.pass.open .a-ed', { caption: 'Tap the pen to edit, hide or reset it' });
    await hold(3, "It's in everyone's plan, marked Added.");
  },
};
