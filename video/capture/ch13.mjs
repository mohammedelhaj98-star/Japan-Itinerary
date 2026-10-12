// Chapter 13: How do I log cash or an IC card top-up?
// Both live in the wallet on your own page (the Mo tab), and each + opens the same form as ¥+ on its Cash or IC top-up tab.
export default {
  name: 'ch13-cash-ic',
  path: '/japan/money',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 13, // the practice tour's money step: no done condition, so nothing moves on by itself
  // open on Mo's own page, where the wallet is (the page remembers the tab you were last on)
  init: () => { try { localStorage.setItem('money.view', JSON.stringify('mine')); } catch {} },
  meta: {
    why: 'So you know what is left in your wallet and on your Suica.',
    recap: ['Cash +', 'Amount', 'Add cash', 'IC card +', 'Card or cash', 'Add top-up'],
    next: 'Next: who owes whom, and settling up',
  },
  async script({ tap, type, hold, wait, pg }) {
    await hold(2.1, "Mo's own page: his cash and IC card wallet.");
    await tap('.cash-wallet [data-gotcash]', { step: 1, caption: 'Got cash from an ATM? Tap + on Cash', opens: true });
    await type('#fmove', '30000', { step: 2, caption: 'From the ATM (or a person): type how much' });
    await pg.$eval('#fmove', (e) => e.blur()).catch(() => {});
    await wait(0.4);
    await tap('#fsave', { step: 3, caption: 'Tap Add cash', opens: true });
    await tap('.iccard [data-ictop]', { step: 4, caption: 'Topped up a Suica? Tap + on IC card', opens: true });
    await type('#fmove', '3000', { step: 5, caption: 'Type the top-up amount' });
    await pg.$eval('#fmove', (e) => e.blur()).catch(() => {});
    await tap('[data-ficwith="cash"]', { step: 5, caption: 'Paid with: card, or cash from the wallet' });
    await tap('#fsave', { step: 6, caption: 'Tap Add top-up', opens: true });
    await hold(3.1, 'The top-up came out of the cash: ¥27,000 left.');
  },
};
