// What a guest sees of the plan. M&M's two nights away (Hotel in the Green on Oct 23, Hotel Pasha Gran on Oct 27) show
// only as a romantic dinner: no hotel name, map pin, booking or tonight's-hotel card. Call once, before the first draw.
const ROMANTIC = 'Romantic dinner';
const SWAP = {
  'd08-mm': { title: 'M&M head off for a romantic dinner', desc: '' },
  'd08-mm-green': { title: ROMANTIC, desc: '', tags: ['food'] },
  'd09-mm-out': { title: 'M&M head to Fushimi Inari', desc: '' },
  'd12-checkin': { desc: '5 min. Drop bags, freshen up.' },
  'd12-split': { desc: 'M&M off for a romantic dinner. NASA toward Marunouchi before Yoroniku.' },
  'd12-mm': { title: ROMANTIC, desc: '', tags: ['food'] },
  'd13-mm-pasha': { title: 'M&M head to Senso-ji', desc: 'Meet NASA at Kaminarimon Gate at 8:30.' },
};
const DROP = ['place', 'ticket', 'confirmed', 'travel'];
export function forGuests(DAYS) {
  for (const d of DAYS) {
    if (d.mmHotel) { delete d.mmHotel; d.away = true; } // "Tonight" and the night card then name only the shared hotel
    if (d.dinner) d.dinner = d.dinner.replace(/night at Hotel (in the Green|Pasha Gran)/g, 'romantic dinner');
    d.items = d.items.map((x) => {
      if (x.type === 'section' && /Pasha|in the Green/.test(x.title)) return { ...x, title: 'M&M — a romantic evening' };
      const s = SWAP[x.id]; if (!s) return x;
      const y = { ...x, ...s }; DROP.forEach((k) => delete y[k]); return y;
    });
  }
}
