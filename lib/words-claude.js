// "Letter it" on the Photos page: the other language for words going on a photo. English in → short natural Japanese
// for a caption (as a sign or a manga title would put it); Japanese in → what it means in English. A stamp (hanko) of
// up to four characters gets its meaning in a word or two. The small, cheap model: a few words cost next to nothing.
import { postClaude } from './scan-claude.js';

export const WORDS_MODEL = 'claude-haiku-5-5';
const API = 'https://api.anthropic.com/v1/messages';
const SCHEMA = { type: 'object', additionalProperties: false, required: ['en', 'ja'], properties: { en: { type: 'string' }, ja: { type: 'string' } } };

const clip = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function prompt({ en, ja, stamp }) {
  const base = 'These words are going on a photo from a family trip to Japan (October 2026), in big Japanese lettering, for posting on Instagram.';
  if (stamp) return `${base} This is a red name stamp (hanko) on the photo: "${ja}". In en, say what it means in English in one to four words, like "Day 7", "Journey" or "Thank you". In ja, give the stamp back exactly as written.`;
  if (ja) return `${base} The Japanese: "${ja}". In en, say what it means in short, natural English (a few words, title case for a place's name). In ja, give it back exactly as written.`;
  return `${base} The English: "${en}". In ja, write it as short, natural Japanese, the way a sign, a travel magazine or a manga title would put it: a place by its usual Japanese name, a feeling or moment in a few warm words (kanji and kana, no romaji, no full stop, under 14 characters). In en, give the English back exactly as written.`;
}
export function wordsRequest(apiKey, input, { model = WORDS_MODEL, url = API } = {}) {
  return {
    url, method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 200, thinking: { type: 'disabled' }, output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } }, messages: [{ role: 'user', content: prompt(input) }] }),
  };
}
// the words to ask about, checked: English up to 60 characters, Japanese up to 20 (a stamp, 4)
export function wordsInput(b) {
  const en = clip(b && b.en, 60), ja = clip(b && b.ja, b && b.stamp ? 4 : 20);
  if (!en && !ja) return null;
  return ja ? { ja, stamp: !!(b && b.stamp) } : { en };
}
export function tidyWords(d, input) {
  if (!d || typeof d !== 'object') return null;
  const en = input.en || clip(d.en, 60), ja = input.ja || clip(d.ja, 20);
  if (!en || !ja) return null;
  return { en, ja };
}
export async function letterWords(env, b, { fetchFn = fetch } = {}) {
  const input = wordsInput(b); if (!input) return null;
  const req = wordsRequest(env.ANTHROPIC_API_KEY, input, { model: env.WORDS_MODEL || WORDS_MODEL, url: env.WORDS_API || env.SORT_API || API });
  return tidyWords(await postClaude(req, fetchFn, 20000), input);
}
