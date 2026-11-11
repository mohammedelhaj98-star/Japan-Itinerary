// Chapter 12: How do I scan a receipt and split it by item?
// Receipt reading normally goes to the AI service behind /api/scan. Here that route is stubbed with the answer for the
// sample receipt in tests/receipts/photo_ramen.jpg (Ichiran Dotonbori, Day 7), and that photo is what gets picked.
import path from 'path'; import { fileURLToPath } from 'url';
const RECEIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests/receipts/photo_ramen.jpg');
// what the scan reads from that photo (tests/receipts/truth.json: total 2380, lines 1960 / 210 / 210)
const READ = {
  total: 2380, cash_given: 3000, change: 620, tax: 216, pretax: null,
  shop: '一蘭 道頓堀店本館', shop_en: 'Ichiran Dotonbori', date: '2026-10-22', type: 'food', taxfree: false,
  lines: [{ name: 'Tonkotsu ramen', price: 1960, qty: 2 }, { name: 'Extra noodles', price: 210, qty: 1 }, { name: 'Soft-boiled egg', price: 210, qty: 1 }],
  items: ['Tonkotsu ramen', 'Extra noodles', 'Soft-boiled egg'], model: 'sample', ms: 1800,
};

export default {
  name: 'ch12-scan-receipt',
  path: '/japan/money',
  time: '2026-10-22T12:15:00Z', // Day 7, 9:15 pm in Osaka, just after the 21:07 ramen receipt
  tourStep: 13, // the practice tour's money step: no done condition, so nothing moves on by itself
  // Naf and Mo went for ramen: the last expense Mo logged was with Naf, so the form starts with the two of them in
  init: () => { try { localStorage.setItem('money.last', JSON.stringify({ set: ['naf', 'm'], with: 'cash' })); } catch {} },
  async prepare(pg) {
    // no camera in the recording browser: Scan falls back to the phone's photo picker, which gets the sample receipt
    await pg.evaluate(() => { try { navigator.mediaDevices.getUserMedia = undefined; } catch {} });
    pg.on('filechooser', (fc) => fc.setFiles(RECEIPT).catch(() => {}));
    await pg.route('**/api/scan', async (route) => {
      await new Promise((r) => setTimeout(r, 6000)); // a moment of "Reading" (about a second once the clip is sped back up)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(READ) });
    });
  },
  meta: {
    why: 'One person pays, and everyone pays for what they had.',
    recap: ['¥+', 'Scan', 'Split by item', 'Who had what', 'Use these shares', 'Add expense'],
    next: 'Next: log cash or an IC card top-up',
  },
  async script({ tap, hold, wait, pg }) {
    await hold(2.1, 'The money page. Mo just paid for ramen with Naf.');
    await tap('#addfab', { step: 1, caption: 'Tap ¥+', opens: true });
    await tap('[data-scan]', { step: 2, caption: 'Tap Scan, then snap or pick the receipt', opens: true });
    await pg.waitForSelector('[data-iopen]', { state: 'visible', timeout: 30000 });
    await wait(1.2);
    await tap('[data-iopen]', { step: 3, caption: 'Amount and shop fill in. Tap Split by item', opens: true });
    await tap('[data-iwho="1:naf"]', { step: 4, caption: 'Tap who had each item' });
    await tap('[data-iwho="2:naf"]', { step: 4, caption: 'Tap who had each item' });
    await tap('#fsave', { step: 5, caption: 'Untapped lines are shared. Use these shares', opens: true });
    await tap('#fsave', { step: 6, caption: 'Tap Add expense', opens: true });
    await hold(3.1, 'Logged with the receipt: Naf owes Mo ¥1,400.');
  },
};
