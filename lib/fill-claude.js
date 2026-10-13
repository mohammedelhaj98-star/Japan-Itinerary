// Filling in a new stop from its name: what kind of place it is, its Japanese name, a short note for the group, the
// usual cost and time there, a few lines of background and a "did you know?", and where to find it (a map search, the English Wikipedia article
// the phone takes the photo from, and a rough position). Claude answers when the ANTHROPIC_API_KEY secret is set;
// Workers AI otherwise, or if Claude can't. The phone does the map search and the photo itself (see index.html,
// fillPhoto), so Wikimedia and OpenStreetMap see four phones rather than one server asking for everyone.
import { CLAUDE_MODEL, CLAUDE_API, claudeHeaders, postClaude } from './scan-claude.js';

const CATS = ['sight', 'food', 'shop', 'transit', 'plan'];
const KINDS = ['temple', 'shrine', 'station', 'food', 'shop', 'park', 'sight', 'attraction', 'hotel'];
const FILL_AI_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const s = { type: 'string' };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['known', 'name', 'ja', 'ro', 'cat', 'kind', 'notes', 'cost', 'minutes', 'key', 'story', 'dyk', 'wikipedia', 'search', 'lat', 'lng'],
  properties: {
    known: { type: 'boolean' }, name: s, ja: s, ro: s,
    cat: { type: 'string', enum: CATS }, kind: { type: 'string', enum: KINDS },
    notes: s, cost: s, minutes: { type: 'number' }, key: s, story: s, dyk: s, wikipedia: s, search: s,
    lat: { type: ['number', 'null'] }, lng: { type: ['number', 'null'] },
  },
};

const clip = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function prompt({ name, city, date, near }) {
  return `Four people on a family trip to Japan (two couples, Oct 16 – Nov 1, 2026) are adding a stop to their plan for ${date || 'a day of the trip'}${city ? ` in or around ${city}` : ''}.${near ? ` Their stop before this one is ${near}.` : ''}
They typed this as the stop's name: "${name}"

Fill in the rest of the stop. If the name is a real place you know (a restaurant, shop, temple, shrine, museum, park, station, street, café, onsen…), answer for the branch or site nearest the stop before. If it's an activity rather than a place ("Laundry", "Pack for the flight"), set known to false and leave the place fields empty.
- known: true only if you know this exact place.
- name: the place's usual English name, as on Google Maps ("Ichiran Shibuya", "Fushimi Inari Taisha"), or the name as typed.
- ja: the name in Japanese as on its sign (一蘭 渋谷店), or "". ro: the same in romaji with macrons (Ichiran Shibuya-ten), or "".
- cat: sight, food, shop, transit, or plan (anything that isn't a place to visit). kind: the closest of temple, shrine, station, food, shop, park, sight, attraction, hotel.
- notes: one or two short, practical sentences for the group: what it is and what to do, see or order there, and anything worth knowing before going (booking, queues, cash only, closed days). The group eats no pork and drinks no alcohol: for food, say plainly whether the usual dishes contain pork, lard, pork broth or mirin/sake, and what to order instead. Don't give exact opening hours or prices unless you're sure they still hold.
- cost: the usual cost per person in yen, like "¥1,200–1,800 per person", "¥500 entry" or "Free", or "" if you don't know.
- minutes: the usual time spent there.
- key: two very short facts joined by " · ", like "Founded 1960 · 60 shops" or "Built 1603 · UNESCO site", or "".
- story: two or three lively sentences of background that make the visit more interesting: real history or why the place matters, told with a light touch, or "".
- dyk: a "did you know?": one or two sentences (under 30 words) with one surprising, specific, true fact that isn't in the story, told with a wink, the bit you'd read out to the others. Only facts you're sure of; "" if you have none.
- wikipedia: the title of the English Wikipedia article about this exact place (not its town or company), or "" if there isn't one.
- search: a short search that finds this branch on OpenStreetMap (its name and area).
- lat, lng: your best estimate of where it is, or null.
Write plain English with no markdown.`;
}

export function fillRequest(apiKey, input, { model = CLAUDE_MODEL, effort = 'low' } = {}) {
  return {
    url: CLAUDE_API, method: 'POST', headers: claudeHeaders(apiKey),
    body: JSON.stringify({
      model, max_tokens: 4000, output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt(input) }],
    }),
  };
}

// whatever model answered: check and trim it
export function tidyFill(d, model) {
  if (!d || typeof d !== 'object') return null;
  const n = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  // Japan, roughly: a position outside it is a guess gone wrong
  let lat = n(d.lat, 24, 46), lng = n(d.lng, 122, 154); if (lat == null || lng == null) lat = lng = null;
  const known = d.known === true;
  return {
    model, known,
    name: clip(d.name, 90), ja: known ? clip(d.ja, 40) : '', ro: known ? clip(d.ro, 60) : '',
    cat: CATS.includes(d.cat) ? d.cat : known ? 'sight' : 'plan', kind: KINDS.includes(d.kind) ? d.kind : 'sight',
    notes: clip(d.notes, 400), cost: clip(d.cost, 60), minutes: Math.round(n(d.minutes, 5, 600) || 0) || null,
    key: known ? clip(d.key, 50) : '', story: known ? clip(d.story, 400) : '', dyk: known ? clip(d.dyk, 200) : '', wikipedia: known ? clip(d.wikipedia, 120) : '', search: known ? clip(d.search, 90) : '',
    lat: known ? lat : null, lng: known ? lng : null,
  };
}

// { name, city?, date?, near? } → the filled-in stop, or { error }
export async function fillStop(env, input, { fetchFn = fetch } = {}) {
  const inp = { name: clip(input.name, 90), city: clip(input.city, 40), date: clip(input.date, 20), near: clip(input.near, 90) };
  if (!inp.name) return { error: 'name required' };
  if (env.ANTHROPIC_API_KEY) {
    const model = env.FILL_MODEL || CLAUDE_MODEL;
    let d = null; try { d = await postClaude(fillRequest(env.ANTHROPIC_API_KEY, inp, { model }), fetchFn, 30000); } catch { d = null; }
    const out = tidyFill(d, model); if (out) return out;
  }
  if (!env.AI) return { error: 'AI is not set up on this site' };
  const messages = [{ role: 'user', content: prompt(inp) + '\nAnswer with JSON only.' }];
  let out; try { out = await env.AI.run(FILL_AI_MODEL, { messages, max_tokens: 700, temperature: 0, response_format: { type: 'json_schema', json_schema: SCHEMA } }); } catch { out = null; }
  const text = typeof out === 'string' ? out : out && (out.response ?? out.result);
  let d = text && typeof text === 'object' ? text : null;
  if (!d) { const j = String(text || '').match(/\{[\s\S]*\}/); try { d = j ? JSON.parse(j[0]) : null; } catch { d = null; } }
  return tidyFill(d, FILL_AI_MODEL) || { error: 'unreadable' };
}
