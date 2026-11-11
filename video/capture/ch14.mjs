// Chapter 14: Who owes whom, and how do we settle up?
// The first week's sample spending (capture/seed.mjs) leaves Sara's couple owing Mo's; person to person, Naf owes Mo.
export default {
  name: 'ch14-settle-up',
  path: '/japan/money',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 13, // the practice tour's money step: no done condition, so nothing moves on by itself
  meta: {
    why: 'One number per person, so paying back takes a minute.',
    recap: ['By couple', 'Person to person', 'Paid', 'Amount', 'Cash', 'Paid'],
    next: 'Next: how much have I spent?',
  },
  async script({ tap, point, hold, pg }) {
    await hold(2.1, 'The money page. Settle up is under the total.');
    await point('.settle .tr', { step: 1, caption: 'By couple: one payment between the couples' });
    await tap('[data-mode="each"]', { step: 2, caption: 'Or tap Person to person' });
    await tap('.settle [data-pay="1"]', { step: 3, caption: 'Naf paid Mo back? Tap Paid', opens: true });
    await point('#payamt', { step: 4, caption: 'Only part paid? Change the amount' });
    await tap('[data-paycash]', { step: 5, caption: 'Handed over in cash? Switch it on' });
    await tap('[data-payok]', { step: 6, caption: 'Tap Paid', opens: true });
    await hold(3.1, "Naf and Mo are square, on all four phones.");
  },
};
