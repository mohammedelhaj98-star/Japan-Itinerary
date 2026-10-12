// Chapter 2: How do I find a day?
export default {
  name: 'ch02-find-a-day',
  path: '/japan/',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka, so Today means Day 7
  tourStep: 0, // the practice tour's welcome step: no done condition, so opening the calendar isn't undone
  meta: {
    why: 'Jump to any day of the trip in two taps.',
    recap: ['Arrows', 'Day bar', 'Colours', 'Pick a day', 'Today'],
    next: "Next: what's next, and how to get there",
  },
  async script({ tap, point, hold }) {
    await hold(2.0, 'The day bar at the top shows which day you are on.');
    await tap('#next', { step: 1, caption: 'Tap › for the next day, ‹ to go back' });
    await tap('#dayp', { step: 2, caption: 'Tap the day bar for the calendar', opens: true });
    await point('#cal .cal-l', { step: 3, caption: 'Colours show the city; a dot, a booking' });
    await tap('#cal [data-cal="d03"]', { step: 4, caption: 'Tap any day to jump to it', opens: true });
    await tap('#dayp', { step: 5, caption: 'Lost? Open the calendar and tap Today', opens: true });
    await tap('#cal [data-cal-today]', { step: 5, caption: 'Lost? Open the calendar and tap Today', opens: true });
    await hold(3.0, "Back on today's plan: Day 7, Nara and Osaka.");
  },
};
