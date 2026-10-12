// Sample shared data for the recordings: a believable first week of spending, so the money pages aren't empty.
// It lives only in the recording server's memory.
const all = ['naf', 'sara', 'mariam', 'm'];
const x = (id, title, yen, payer, split, cat, day, extra = {}) => [id, { title, yen, payer, split, cat, day, ts: String(Date.parse('2026-10-16T00:00:00Z') + Number(day.slice(1)) * 86400000), ...extra }];
export const seed = {
  checks: { 'd01-land': true },
  expenses: Object.fromEntries([
    x('s1', 'Narita Express tickets', 12280, 'naf', all, 'transport', 'd01'),
    x('s2', 'Dinner at Ichiran', 7840, 'm', all, 'food', 'd01'),
    x('s3', 'Kawagoe sweet potato snacks', 2600, 'mariam', ['mariam', 'm'], 'food', 'd02'),
    x('s4', 'Harajuku crêpes', 3200, 'sara', all, 'food', 'd02'),
    x('s5', 'Omakase dinner', 88000, 'm', all, 'food', 'd03'),
    x('s6', 'Shimokitazawa vintage jacket', 9800, 'sara', ['sara'], 'shopping', 'd04'),
    x('s7', 'Hakone Free Pass ×4', 24400, 'naf', all, 'transport', 'd05'),
    x('s8', 'Open-Air Museum tickets', 8000, 'mariam', all, 'tickets', 'd05'),
    x('s9', 'Shinkansen to Kyoto', 56960, 'm', all, 'transport', 'd06'),
    x('s10', 'Taxi to the hotel', 2300, 'naf', ['naf', 'sara'], 'transport', 'd06'),
  ]),
  updatedAt: 'seed',
};
