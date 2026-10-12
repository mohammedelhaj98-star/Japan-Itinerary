// Feature video, scene 2: scan a receipt and split it by item. Paced to Mo's voiceover lines.
import base from './ch12.mjs';
export default {
  ...base, name: 'f2-receipt', meta: null,
  async script({ tap, point, hold, wait, pg, mark }) {
    mark('rcpt-1'); await hold(3.4, "Ramen at Ichiran. The bill's in Japanese.");
    mark('rcpt-2');
    await tap('#addfab', { step: 1, caption: 'Tap ¥+', lead: 0.5, after: 0.7, opens: true });
    await tap('[data-scan]', { step: 2, caption: 'Scan the receipt', lead: 0.6, after: 0.4, opens: true });
    await pg.waitForSelector('[data-iopen]', { state: 'visible', timeout: 30000 });
    await wait(0.4);
    await point('#famt', { step: 3, caption: 'Total and shop fill in', s: 1.6 });
    mark('rcpt-3');
    await tap('[data-iopen]', { step: 4, caption: 'Split by item', lead: 0.6, after: 0.9, opens: true });
    await tap('[data-iwho="1:naf"]', { step: 5, caption: "Tap who had what", lead: 0.8, after: 0.5 });
    await tap('[data-iwho="2:naf"]', { step: 5, caption: "Tap who had what", lead: 0.5, after: 1.6 });
    mark('rcpt-4');
    await tap('#fsave', { step: 6, caption: 'Use these shares', lead: 0.4, after: 0.5, opens: true });
    await tap('#fsave', { step: 6, caption: 'Add expense', lead: 0.4, after: 1.7, opens: true });
  },
};
