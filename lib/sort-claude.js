// Sorting a trip photo with Claude (when the ANTHROPIC_API_KEY secret is set): how many people it's of, whether it's a
// selfie, what kind of photo it is and a few words to search it by. Claude is never asked who anyone is: the names come
// from guessWho below, which puts that count together with who was at the stop and who took it.
// The small, cheap model: one picture of ~640 px is about 500 tokens, so a photo costs a few hundredths of a cent.
import { postClaude } from './scan-claude.js';

export const SORT_MODEL = 'claude-haiku-5-5';
const API = 'https://api.anthropic.com/v1/messages';
export const KINDS = ['us', 'food', 'place', 'shop', 'move', 'other'];

const PROMPT = `This photo is from a family trip to Japan in October 2026: four adults, two couples. Describe what's in it.
- people: how many people the photo is of: posing, or clearly what the photo is about. Don't count passers-by, crowds, staff or people far in the background. 0 for a view, a dish or a thing.
- selfie: true if the person holding the camera is in it (arm's length, front camera, or a phone held up in a mirror).
- kind: us (the people are the point of it), food (a meal, a snack, a drink, a menu), place (a sight, temple, shrine, street, view or nature), shop (a shop, things for sale, things bought), move (a train, station, plane, airport, bus or taxi), other.
- words: up to 6 short lowercase English words someone might search for later, like deer, ramen, torii, night, shinkansen, fuji. Not people's names.
Don't say who anyone is.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['people', 'selfie', 'kind', 'words'],
  properties: { people: { type: 'integer' }, selfie: { type: 'boolean' }, kind: { type: 'string', enum: KINDS }, words: { type: 'array', items: { type: 'string' } } },
};

export function sortRequest(apiKey, photo, { model = SORT_MODEL, url = API } = {}) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(photo || ''); if (!m) return null;
  return {
    url, method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 400, thinking: { type: 'disabled' }, output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }, { type: 'text', text: PROMPT }] }],
    }),
  };
}

// Claude's answer, checked and trimmed (null if it's no good)
export function tidySort(d) {
  if (!d || typeof d !== 'object') return null;
  const people = Math.max(0, Math.min(20, Math.round(+d.people))); if (!Number.isFinite(people)) return null;
  const words = (Array.isArray(d.words) ? d.words : []).map((w) => String(w).toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().slice(0, 18)).filter(Boolean);
  return { people, selfie: !!d.selfie, kind: KINDS.includes(d.kind) ? d.kind : 'other', words: [...new Set(words)].slice(0, 6) };
}

export async function sortPhoto(env, photo, { fetchFn = fetch } = {}) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const req = sortRequest(env.ANTHROPIC_API_KEY, photo, { model: env.SORT_MODEL || SORT_MODEL, url: env.SORT_API || API }); if (!req) return null;
  return tidySort(await postClaude(req, fetchFn, 30000));
}

// Who's in it, from how many people it's of and who could be: the people at that stop (could), and who took it (by).
// Only a guess where the count leaves little doubt; everything it says is shown as a guess until someone confirms it.
const COUPLE = { naf: 'sara', sara: 'naf', mariam: 'm', m: 'mariam' };
export function guessWho({ people, selfie }, could, by) {
  const C = Array.isArray(could) && could.length ? could : Object.keys(COUPLE);
  if (!people) return [];
  if (people >= C.length) return C; // everyone who was there
  const u = C.includes(by) ? by : null; if (!u) return [];
  const partner = C.includes(COUPLE[u]) ? COUPLE[u] : null;
  if (selfie) { const g = [u]; if (people >= 2 && partner) g.push(partner); return C.filter((x) => g.includes(x)); } // them, then their other half
  const rest = C.filter((x) => x !== u); // whoever took it isn't in it
  if (people >= rest.length) return rest;
  if (people === 1 && partner) return [partner]; // one person, photographed by their other half
  return [];
}
