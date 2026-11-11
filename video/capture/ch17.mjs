// Chapter 17: How do we share ideas?
const ts = (h) => new Date(Date.parse('2026-10-22T03:20:00Z') - h * 3600000).toISOString();
export default {
  name: 'ch17-ideas',
  path: '/japan/prototypes/tools?v=4',
  time: '2026-10-22T03:20:00Z', // Day 7, 12:20 pm in Osaka
  tourStep: 29, // the tour's last card: no hooks, so nothing switches tabs under us
  // a few ideas the others already posted, so there's something to vote on
  state: {
    suggestions: [
      { id: 'sg-sara1', text: 'Kushikatsu Daruma in Shinsekai: the original, and there is a halal-friendly menu', name: 'Sara', day: 'd07', kind: 'food', author: 'dev-sara', votes: ['sara', 'naf'], ts: ts(20) },
      { id: 'sg-mar1', text: 'Kuromon Market for breakfast skewers', name: 'Mariam', day: null, kind: 'food', author: 'dev-mariam', votes: [], ts: ts(40) },
      { id: 'sg-mar2', text: 'Shinsaibashi-suji arcade: Uniqlo and the Pokémon Center', name: 'Mariam', day: null, kind: 'shop', author: 'dev-mariam', votes: ['mariam', 'sara'], ts: ts(26) },
      { id: 'sg-naf2', text: 'Tsutenkaku Tower at sunset', name: 'Naf', day: null, kind: 'place', author: 'dev-naf', votes: ['naf', 'm'], ts: ts(18) },
    ],
  },
  // keep the screencast sending frames on a still screen (it only sends on change, and the clip would end early):
  // a 2 px dot in the corner, all but invisible, that repaints all the time
  meta: {
    why: 'Every idea lands in one place, and the votes settle it.',
    recap: ['Type', 'Post', 'Vote', 'Shops', 'Places'],
    next: 'Next: find halal food nearby',
  },
  async script({ tap, type, hold, wait, pg }) {
    await hold(2.1, 'Ideas: notes for food, shops and places to see.');
    await type('#sg-text', 'Takoyaki at Wanaka, Dotonbori', { step: 1, caption: 'Type a place or a plan' });
    await pg.$eval('#sg-text', (e) => e.blur()).catch(() => {});
    await wait(0.5);
    await tap('[data-sgpost]', { step: 2, caption: 'Tap Post for everyone' });
    await tap('[data-vote="sg-sara1"]', { step: 3, caption: 'Like one? Tap Vote' });
    await tap('[data-fview="shop"]', { step: 4, caption: 'Shops get their own list' });
    await tap('[data-fview="place"]', { step: 5, caption: 'And so do Places to see' });
    await hold(3.0, 'Everyone sees every idea and who voted for it.');
  },
};
