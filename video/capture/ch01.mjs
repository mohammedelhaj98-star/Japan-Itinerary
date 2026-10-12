// Chapter 1: How do I get in?
// Starts signed out on the trips page (/). The local recording server has no TRIP_PIN set, so /api/unlock accepts
// any PIN: we tap a made-up one (1357). The screen only ever shows dots, never the digits.
const DUMMY_PIN = '1357';
export default {
  name: 'ch01-get-in',
  path: '/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  me: null, // signed out: the trips page asks who you are
  tourStep: 0, // the practice tour's welcome step (no done condition), so the trip page stays put when it opens
  meta: {
    why: 'Pick your name and enter the PIN once; your phone remembers you.',
    recap: ['Just looking', 'Your name', 'PIN', 'Switch', 'Japan 2026'],
    next: 'Next: find a day',
  },
  async script({ tap, point, hold, wait, pg }) {
    await hold(2.0, "This is the trips page. First, it asks who you are.");
    await point('[data-guest]', { step: 1, caption: "Guests tap Just looking: see, don't change" });
    await tap('[data-me="m"]', { step: 2, caption: 'One of the four? Tap your name', opens: true });
    await point('#pad', { step: 3, caption: 'Enter the 4-digit PIN, just once', s: 1.2 });
    for (const k of DUMMY_PIN) { await pg.tap(`#pad [data-k="${k}"]`); await wait(0.4); }
    await wait(1.2);
    await point('#switch', { step: 4, caption: 'Not Mo? Tap Switch to change person' });
    await tap('[data-trip="japan"]', { step: 5, caption: 'Tap Japan 2026 to open the trip', opens: true, after: 2.2 }); // the trip page needs a moment to load
    await hold(3.0, "You're in. This phone remembers you from now on.");
  },
};
