// Chapter 11: How do I log an expense?
export default {
  name: 'ch11-log-expense',
  path: '/japan/money',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 13, // the practice tour's money step, so the tour keeps us on this page
  async script({ tap, type, hold, wait, pg }) {
    await hold(2.6, 'This is the money page: what the group has spent, and who owes whom.');
    await tap('#addfab', { step: 1, caption: 'Tap ¥+', opens: true });
    await type('#famt', '2400', { step: 2, caption: 'Type the amount' });
    await type('#ftitle', 'Takoyaki in Dotonbori', { step: 3, caption: 'Say what it was for' });
    await pg.$eval('#ftitle', (e) => e.blur()).catch(() => {});
    await wait(0.6);
    await tap('[data-with="card"]', { step: 4, caption: 'Who paid, and how: cash, card or IC card' });
    await tap('[data-preset="all"]', { step: 5, caption: "Who's in: just you, you two, or all four" });
    await tap('#fsave', { step: 6, caption: 'Tap Add expense', opens: true, after: 2.2 });
    await hold(3.6, "It's on everyone's phone, and Settle up updates by itself.");
  },
};
