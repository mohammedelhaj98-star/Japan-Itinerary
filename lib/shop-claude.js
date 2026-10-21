// The shopping list's helper: for a thing someone wants to buy, the easiest kind of shop for it and the branch nearest a
// stop already on our route, so the list can say "Tokyo Banana: Gransta, inside Tokyo Station, Day 12" and that stop's
// card can say "1 to buy here". The phone sends the stops still ahead for whoever the list is for; the answer has to name
// one of them (or none). A thing can come as a photo (a screenshot, a TikTok): then the helper also says what it is.
// It also says what kind of thing it is (cat: a key of SHOP_CATS), so the list can be filtered by category; sortShop
// does only that, for things that were on the list before there were categories.
// Claude answers when the ANTHROPIC_API_KEY secret is set; Workers AI otherwise, or if Claude can't.
import { CLAUDE_MODEL, CLAUDE_API, claudeHeaders, postClaude } from './scan-claude.js';
import { SHOP_CATS } from '../data/shop-ideas.js';

const SHOP_AI_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const s = { type: 'string' };
export const CATS = Object.keys(SHOP_CATS);
const cat = { type: 'string', enum: CATS };
const n = { type: 'number' };
const ALT = { type: 'object', additionalProperties: false, required: ['shop', 'why', 'at', 'lat', 'lng'], properties: { shop: s, why: s, at: s, lat: n, lng: n } };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'shop', 'why', 'at', 'lat', 'lng', 'search', 'ja', 'halal', 'cat', 'alts'],
  properties: { name: s, shop: s, why: s, at: s, lat: n, lng: n, search: s, ja: s, halal: s, cat, alts: { type: 'array', items: ALT } },
};
const CAT_LINES = Object.entries(SHOP_CATS).map(([k, [n]]) => `${k} (${n})`).join(', ');
const clip = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isId = (v) => typeof v === 'string' && /^[a-z0-9_-]{1,80}$/i.test(v);

function prompt({ name, note, who, today, stops, photo }) {
  const list = stops.map((x) => `${x.id} | ${x.date} | ${x.city} | ${x.title}${x.place && x.place !== x.title ? ` (${x.place})` : ''}`).join('\n');
  return `Four people on a family trip to Japan (two couples, Oct 16 – Nov 1, 2026) keep a shared shopping list. Today is ${today}.
${photo ? `${who} want to buy the thing in this photo (often a screenshot from TikTok or Instagram)${name ? `, which they call "${name}"` : ''}` : `${who} want to buy: "${name}"`}${note ? ` (note: "${note}")` : ''}

These are the stops still ahead of them, one per line: id | date | city | stop:
${list || '(none)'}

Find where on this route it is easiest to buy, and answer in JSON:
- name: ${photo ? 'what the thing in the photo is, in a few words of English, as specific as the photo shows (brand and product, like "Tokyo Banana" or "Biore UV Aqua Rich sunscreen")' : 'the thing they typed, tidied up (spelling, capitals)'}.
- shop: the specific shop or branch, short (at most 5 words), as it's called on Google Maps, for example "Gransta, inside Tokyo Station", "Don Quijote Dotonbori", "Kama-Asa, Kappabashi". A chain is fine when any branch does ("Any Daiso", "Any drugstore").
- why: one short practical sentence on why there, at most 12 words (range, tax-free, what to ask for). No opening hours or prices unless you're sure.
- at: the id of the stop above that the shop is in or a short walk from, the earliest good one; "" if none of them is near a good place to buy it.
- lat, lng: where that shop is, as closely as you know (0, 0 if you don't).
- alts: up to 2 other good places to buy it, each on a different day from the first and from each other, in a different city where the route allows (they may want it in Osaka rather than Tokyo): { shop, why, at, lat, lng } as above. [] if there is no other good place on the route.
- search: what to type into Google Maps to find the nearest shop that sells it, for when they want it right now (like "Don Quijote", "drugstore", "Daiso", "Uniqlo").
- ja: the thing's name in Japanese, as a shop assistant would understand it, so they can show it on the phone.
- halal: if it's food or drink and some versions contain pork, gelatin, alcohol or mirin, a short warning (they eat halal and don't drink); otherwise "".
- cat: what kind of thing it is, one of: ${CAT_LINES}.
Write plain English with no markdown.`;
}

const imageBlock = (photo) => { const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo); return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }; };
const isPhoto = (v) => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v);

export function shopRequest(apiKey, input, { model = CLAUDE_MODEL, effort = 'low' } = {}) {
  return {
    url: CLAUDE_API, method: 'POST', headers: claudeHeaders(apiKey),
    body: JSON.stringify({
      model, max_tokens: 2000, output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
      fallbacks: 'default',
      messages: [{ role: 'user', content: input.photo ? [imageBlock(input.photo), { type: 'text', text: prompt(input) }] : prompt(input) }],
    }),
  };
}

// whatever model answered: check and trim it; a stop that wasn't offered is dropped
export function tidyShop(d, stops, model) {
  if (!d || typeof d !== 'object' || !clip(d.shop, 90)) return null;
  const at = stops.some((x) => x.id === d.at) ? d.at : '';
  const ll = (x) => (typeof x.lat === 'number' && typeof x.lng === 'number' && x.lat > 24 && x.lat < 46 && x.lng > 122 && x.lng < 154 ? { lat: +x.lat.toFixed(5), lng: +x.lng.toFixed(5) } : {});
  const dateOf = (id) => (stops.find((x) => x.id === id) || {}).date;
  const alts = (Array.isArray(d.alts) ? d.alts : []).filter((x) => x && clip(x.shop, 90) && stops.some((y) => y.id === x.at) && dateOf(x.at) !== dateOf(at))
    .filter((x, i, all) => all.findIndex((y) => dateOf(y.at) === dateOf(x.at)) === i).slice(0, 2)
    .map((x) => ({ shop: clip(x.shop, 90), why: clip(x.why, 160), at: x.at, ...ll(x) }));
  return { model, name: clip(d.name, 90), shop: clip(d.shop, 90), why: clip(d.why, 200), at, ...ll(d), alts, search: clip(d.search, 60) || clip(d.shop, 60), ja: clip(d.ja, 40), halal: clip(d.halal, 120), cat: CATS.includes(d.cat) ? d.cat : 'other' };
}

// { name, note?, who?, today?, photo?, stops:[{ id, date, city, title, place? }] } → { name, shop, why, at, lat?, lng?, alts, search, ja, halal, cat },
// alts: up to 2 other places on other days ({ shop, why, at, lat?, lng? }), so the list can offer a choice
// or { error }
export async function pickShop(env, input, { fetchFn = fetch } = {}) {
  const stops = (Array.isArray(input.stops) ? input.stops : []).slice(0, 150).filter((x) => x && isId(x.id))
    .map((x) => ({ id: x.id, date: clip(x.date, 10), city: clip(x.city, 30), title: clip(x.title, 90), place: clip(x.place, 90) }));
  const inp = { name: clip(input.name, 90), note: clip(input.note, 200), who: clip(input.who, 30) || 'They', today: clip(input.today, 10), stops, photo: isPhoto(input.photo) ? input.photo : '' };
  if (!inp.name && !inp.photo) return { error: 'name required' };
  if (env.ANTHROPIC_API_KEY) {
    const model = env.SHOP_MODEL || CLAUDE_MODEL;
    let d = null; try { d = await postClaude(shopRequest(env.ANTHROPIC_API_KEY, inp, { model }), fetchFn, 30000); } catch { d = null; }
    const out = tidyShop(d, stops, model); if (out) return out;
  }
  if (!env.AI) return { error: 'AI is not set up on this site' };
  const text0 = prompt(inp) + '\nAnswer with JSON only.';
  const messages = [{ role: 'user', content: inp.photo ? [{ type: 'text', text: text0 }, { type: 'image_url', image_url: { url: inp.photo } }] : text0 }];
  let out; try { out = await env.AI.run(SHOP_AI_MODEL, { messages, max_tokens: 500, temperature: 0, response_format: { type: 'json_schema', json_schema: SCHEMA } }); } catch { out = null; }
  const text = typeof out === 'string' ? out : out && (out.response ?? out.result);
  let d = text && typeof text === 'object' ? text : null;
  if (!d) { const j = String(text || '').match(/\{[\s\S]*\}/); try { d = j ? JSON.parse(j[0]) : null; } catch { d = null; } }
  return tidyShop(d, stops, SHOP_AI_MODEL) || { error: 'unreadable' };
}

// Sorting things into categories by name alone: { items:[{ id, name }] } (up to 40) → { cats: { id: cat } }, or { error }
const SORT_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'cat'], properties: { id: s, cat } } } } };
const sortPrompt = (items) => `Sort each thing on a shopping list for a trip to Japan into one category: ${CAT_LINES}.
One per line, id | thing:
${items.map((x) => `${x.id} | ${x.name}`).join('\n')}
Answer in JSON: { "items": [{ "id": ..., "cat": ... }] }, one entry for every id.`;
function tidySort(d, items) {
  const cats = {}; for (const x of (d && Array.isArray(d.items) ? d.items : [])) if (x && items.some((y) => y.id === x.id) && CATS.includes(x.cat)) cats[x.id] = x.cat;
  return Object.keys(cats).length ? { cats } : null;
}
export async function sortShop(env, input, { fetchFn = fetch } = {}) {
  const items = (Array.isArray(input.items) ? input.items : []).filter((x) => x && isId(x.id) && clip(x.name, 90)).slice(0, 40).map((x) => ({ id: x.id, name: clip(x.name, 90) }));
  if (!items.length) return { error: 'items required' };
  if (env.ANTHROPIC_API_KEY) {
    const model = env.SHOP_MODEL || CLAUDE_MODEL;
    const req = { url: CLAUDE_API, method: 'POST', headers: claudeHeaders(env.ANTHROPIC_API_KEY),
      body: JSON.stringify({ model, max_tokens: 3000, output_config: { effort: 'low', format: { type: 'json_schema', schema: SORT_SCHEMA } }, fallbacks: 'default', messages: [{ role: 'user', content: sortPrompt(items) }] }) };
    let d = null; try { d = await postClaude(req, fetchFn, 30000); } catch { d = null; }
    const out = tidySort(d, items); if (out) return out;
  }
  if (!env.AI) return { error: 'AI is not set up on this site' };
  let out; try { out = await env.AI.run(SHOP_AI_MODEL, { messages: [{ role: 'user', content: sortPrompt(items) + '\nAnswer with JSON only.' }], max_tokens: 1500, temperature: 0, response_format: { type: 'json_schema', json_schema: SORT_SCHEMA } }); } catch { out = null; }
  const text = typeof out === 'string' ? out : out && (out.response ?? out.result);
  let d = text && typeof text === 'object' ? text : null;
  if (!d) { const j = String(text || '').match(/\{[\s\S]*\}/); try { d = j ? JSON.parse(j[0]) : null; } catch { d = null; } }
  return tidySort(d, items) || { error: 'unreadable' };
}
