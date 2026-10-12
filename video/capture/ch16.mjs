// Chapter 16: What still needs booking?
export default {
  name: 'ch16-bookings',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 11, // the tour's "Trip tools" step: opening + moves it on to the Expenses step, which only acts on the trip page
  // keep the screencast sending frames on a still screen (it only sends on change, and the clip would end early):
  // a 2 px dot in the corner, all but invisible, that repaints all the time
  meta: {
    why: 'So nothing gets booked twice, or not at all.',
    recap: ['+', 'Bookings', 'Book now', 'Mark as booked', 'Booked'],
    next: 'Next: share ideas for food, shops and places',
  },
  async script({ tap, point, hold }) {
    await hold(2.1, 'The trip page. Bookings live under the round + button.');
    await tap('#ttBtn', { step: 1, caption: 'Tap +', opens: true });
    await tap('.tt-opt[href$="v=2"]', { step: 2, caption: 'Tap Bookings', opens: true, after: 1.8 });
    await point('.bk.todo', { step: 3, caption: 'Red Book now: sort these out first' });
    await tap('.bk.todo [data-bkmark]', { step: 4, caption: 'Booked it? Tap Mark as booked' });
    await point('.bk.marked', { step: 5, caption: 'It moves to Booked, on all four phones' });
    await hold(3.0, 'Got it wrong? Tap Not booked yet to move it back.');
  },
};
