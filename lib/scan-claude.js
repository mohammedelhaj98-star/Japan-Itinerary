// Reading a receipt photo with Claude (when the ANTHROPIC_API_KEY secret is set). One request to the Messages API, asked
// for JSON matching a schema; the API route then checks and trims the answer the same way as the Workers AI answer.
// A plain fetch rather than the SDK: the SDK was 800 KB of the Pages Function's 860 KB, parsed on every cold start of
// every API request for this one call. tests/receipts/claude.mjs runs the real thing; tests/e2e.mjs checks the request.
export const CLAUDE_MODEL = 'claude-opus-5-5';
const API = 'https://api.anthropic.com/v1/messages?beta=true';
const TIMEOUT = 45000;

const PROMPT = `This is a photo of a receipt from Japan, from a family trip in October 2026. Read it carefully.
- total: what was paid in yen (合計, お会計, ご請求額, 金…円也). Not cash handed over (お預り), change (お釣り), a subtotal (小計) or a tax line.
- cash_given and change: the cash handed over and the change, if printed.
- tax: the consumption tax (all rates added together), if printed. pretax: the amount before tax, if printed.
- shop: the name as printed; shop_en: the same in English or romaji.
- date: as printed; a short year like 26年 or 26/10 means 2026.
- type: what kind of spending it was.
- taxfree: true only if the receipt says the purchase was tax-free (免税, Tax-free).
- lines: every item bought, in order, with a short English name (like "Tonkotsu ramen"), the price printed for that line (the line's total, after its quantity) and the quantity. A discount printed on its own line is a line with a negative price. Not subtotals, tax, points, payment or change lines. Some receipts print each price slightly above or below its item: match them by order, and check that the lines add up to the subtotal when one is printed. A receipt with no itemised lines has no lines.
- items: up to 5 short English names of what was bought.`;

const n = { type: ['number', 'null'] };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['total', 'cash_given', 'change', 'tax', 'pretax', 'shop', 'shop_en', 'date', 'type', 'taxfree', 'lines', 'items'],
  properties: {
    total: { type: 'number' }, cash_given: n, change: n, tax: n, pretax: n,
    shop: { type: 'string' }, shop_en: { type: 'string' }, date: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['food', 'transport', 'tickets', 'shopping', 'hotel', 'other'] }, taxfree: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'price', 'qty'], properties: { name: { type: 'string' }, price: { type: 'number' }, qty: { type: 'number' } } } },
    items: { type: 'array', items: { type: 'string' } },
  },
};

// The request as the SDK sent it (captured): the beta endpoint, these headers, this body.
export function receiptRequest(apiKey, photo, { model = CLAUDE_MODEL, effort = 'low' } = {}) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo); if (!m) return null;
  return {
    url: API, method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    body: JSON.stringify({
      model, max_tokens: 4000, output_config: { effort, format: { type: 'json_schema', schema: SCHEMA } },
      // if this model declines, the API answers with another one instead of failing
      fallbacks: 'default',
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }, { type: 'text', text: PROMPT }] }],
    }),
  };
}

// → the parsed answer, or null if Claude declined or the answer was cut off (the caller falls back to Workers AI).
// Tried twice at most, like the SDK's maxRetries: 1: once more after a dropped connection, a timeout, a 429 or a 5xx.
export async function readReceiptClaude(apiKey, photo, { model = CLAUDE_MODEL, effort = 'low', fetchFn = fetch } = {}) {
  const req = receiptRequest(apiKey, photo, { model, effort }); if (!req) return null;
  let res;
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), TIMEOUT);
    try { res = await fetchFn(req.url, { method: req.method, headers: req.headers, body: req.body, signal: ac.signal }); }
    catch (err) { if (attempt) throw err; continue; }
    finally { clearTimeout(timer); }
    if (attempt || !(res.status === 429 || res.status === 408 || res.status === 409 || res.status >= 500)) break;
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
  }
  if (!res.ok) throw new Error(`Claude answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const out = await res.json();
  if (out.stop_reason === 'refusal' || out.stop_reason === 'max_tokens') return null;
  const text = (out.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { return null; }
}
