// Chapter 15: How much have I spent?
// The switch at the top of the money page: Group, your own page (Mo) and your couple's (M&M). Your page has your
// budget, your cash and IC card wallet, and the day and type filters.
import { seed } from './seed.mjs';

export default {
  name: 'ch15-my-spending',
  path: '/japan/money',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 13, // the practice tour's money step: no done condition, so nothing moves on by itself
  // sample data for this chapter: Mo set a trip budget, and took cash out and loaded his Suica on Day 1
  state: {
    expenses: {
      ...seed.expenses,
      c1: { kind: 'cash', who: 'm', yen: 40000, day: 'd01', by: 'm', at: Date.parse('2026-10-17T03:00:00Z') },
      i1: { kind: 'ic', who: 'm', yen: 5000, day: 'd01', with: 'card', by: 'm', at: Date.parse('2026-10-17T03:10:00Z') },
    },
    money: { 'b:m': 300000, 'bc:mm': 600000 },
  },
  meta: {
    why: 'So you can keep an eye on your own budget.',
    recap: ['Mo', 'Budget', 'Wallet', 'A day', 'A type', 'M&M'],
    next: 'Next: what still needs booking?',
  },
  async script({ tap, point, hold, wait, pg }) {
    await hold(2.1, "The money page opens on the group's spending.");
    await tap('[data-view="mine"]', { step: 1, caption: 'Tap Mo: just your share of everything' });
    await point('.hero', { step: 2, caption: "Budget: what's left, and if you're on pace" });
    await point('.wallet', { step: 3, caption: 'The cash and IC card money you have left' });
    await tap('[data-mday="d05"]', { step: 4, caption: 'Tap a day to see just that day' });
    // bring the chart to the top so the list it filters shows underneath
    await pg.evaluate(() => { const c = document.querySelector('.chart'); scrollTo({ top: scrollY + c.getBoundingClientRect().top - 56, behavior: 'smooth' }); });
    await wait(1);
    await tap('[data-mcat="transport"]', { step: 5, caption: 'Or tap a type, like Transport' });
    await tap('[data-view="us"]', { step: 6, caption: 'Tap M&M for the two of you together' });
    await hold(3.1, 'Mo and Mariam: spent so far, and the budget.');
  },
};
