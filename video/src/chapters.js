// One entry per tutorial chapter. `clip` is the folder video/capture writes into public/clips/ (the name in capture/chNN.mjs).
// `why`, `recap` and `next` can also come from the chapter script's `meta` (stored in the clip's timeline.json),
// which wins over what's here, so a chapter's words live next to the taps they describe.
export const PARTS = [
  { n: 1, name: 'Getting started', jp: 'はじめに' },
  { n: 2, name: 'Out and about each day', jp: 'まいにち' },
  { n: 3, name: 'Money', jp: 'おかね' },
  { n: 4, name: 'Tools and extras', jp: 'どうぐ' },
];
const C = (n, part, slug, title, why = '', recap = [], next = '') => ({ id: 'ch' + String(n).padStart(2, '0'), n, part: `Part ${part} · ${PARTS[part - 1].name}`, partN: part, clip: `ch${String(n).padStart(2, '0')}-${slug}`, title, why, recap, next });
export const CHAPTERS = [
  C(1, 1, 'get-in', 'How do I get in?'),
  C(2, 1, 'find-a-day', 'How do I find a day?'),
  C(3, 2, 'whats-next', "What's next, and how do I get there?"),
  C(4, 2, 'couple-plan', "How do I see just our couple's plan?"),
  C(5, 2, 'stamp', 'How do I mark a stop as done?'),
  C(6, 2, 'decide', 'How do we decide on the day?'),
  C(7, 2, 'day-dial', 'How do I read the day at a glance?'),
  C(8, 2, 'bigger-map', 'How do I make the map bigger?'),
  C(9, 2, 'edit-stop', 'How do I add or change a stop?'),
  C(10, 2, 'pass-extras', "What's on a pass besides the stop?"),
  { ...C(11, 3, 'log-expense', 'How do I log an expense?', 'So nobody has to keep the bill in their head.', ['¥+', 'Amount', 'What for', 'Paid by', "Who's in", 'Add expense'], 'Next: scan a receipt and split it by item'), clip: 'ch11-log-expense' },
  C(12, 3, 'scan-receipt', 'How do I scan a receipt and split it by item?'),
  C(13, 3, 'cash-ic', 'How do I log cash or an IC card top-up?'),
  C(14, 3, 'settle-up', 'Who owes whom, and how do we settle up?'),
  C(15, 3, 'my-spending', 'How much have I spent?'),
  C(16, 4, 'bookings', 'What still needs booking?'),
  C(17, 4, 'ideas', 'How do we share ideas?'),
  C(18, 4, 'halal', 'How do I find halal food nearby?'),
  C(19, 4, 'taxi', 'How do I tell a taxi driver where to go?'),
  C(20, 4, 'yen-phrases-sos', 'Yen, phrases and emergencies'),
  C(21, 4, 'photos-settings', 'Photos, settings and offline'),
];
// the 2-minute cut for anyone who won't watch the whole thing
export const MUST_KNOW = [1, 2, 3, 5, 11, 14];
// a chapter with its script's own words (from timeline.json) laid over the defaults above
export const withMeta = (ch, tl) => ({ ...ch, ...Object.fromEntries(Object.entries(tl?.chapter || {}).filter(([, v]) => v != null && v !== '')) });
