// The shopping list's morning heads-up: at 8 AM Japan time, each couple whose route today passes somewhere to buy
// something on their list (theirs, or All of us) gets one alert naming the things and where. Run from the state
// Worker's 5-minute tick (workers/state); nothing is sent on a day with nothing to buy. Secret presents (lock) are
// never named: an alert can't tell whose phone it lands on.
export const SHOP_HOUR = 8; // Japan time
const COUPLES = { nasa: ['naf', 'sara'], mm: ['mariam', 'm'] };
const JST = 9 * 3600e3;

// the date in Japan (YYYY-MM-DD) and the hour there, for a moment
export function jstNow(now) { const d = new Date(now + JST); return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() }; }

// shop: the list as stored; date: today in Japan → [{ id, kind: 'shop', people, text, tag, url }]
export function morningAlerts(shop, date) {
  const out = [];
  for (const [couple, people] of Object.entries(COUPLES)) {
    const items = Object.values(shop || {}).filter((x) => x && !x.done && !x.lock && x.ai && x.ai.date === date && (x.list === 'all' || x.list === couple));
    if (!items.length) continue;
    const names = items.map((x) => x.name), places = [...new Set(items.map((x) => x.ai.stop || x.ai.shop))];
    const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
    const day = (items.find((x) => x.ai.day) || {}).ai;
    out.push({
      id: `${date}-${couple}`, kind: 'shop', people,
      text: `${items.length} thing${items.length > 1 ? 's' : ''} to buy on today's route: ${list}. ${places.length > 2 ? `${places.slice(0, 2).join(', ')} and more` : places.join(' and ')}.`,
      tag: `shop-${date}-${couple}`, url: `/japan/prototypes/tools?v=3${day && day.day ? `&d=${day.day}` : ''}`,
    });
  }
  return out;
}
