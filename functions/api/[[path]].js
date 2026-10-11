// Cloudflare Pages Function — shared trip state in Workers KV.
// Bind a KV namespace named TRIP_KV in the Pages project (Settings → Bindings).
//
// Routes:
//   GET  /api/health                  → { ok, kv }
//   GET  /api/version                 → { updatedAt }  (one read: phones poll this, and fetch /api/state only when it changes)
//   GET  /api/state                   → { checks, choices, suggestions, custom, expenses, money, profiles, covers, updatedAt }
//                                       (expenses and money only with the PIN in x-trip-pin)
//   POST /api/checks                  { id, value:boolean }
//   POST /api/choices                 { id, value:string }
//   POST /api/custom                  { id, value:object|null }  (edit, hide or add a stop; null resets/removes)
//   POST /api/expenses                { id, value:object|null }  (a money record: an expense, or kind pay | cash | ic; null deletes)
//   POST /api/money                   { id, value:string|number|boolean|null }  (money settings: who sends/receives, budgets, last seen)
//   POST /api/receipt                 { id, photo:dataURL|null }  (an expense's receipt photo)
//   GET  /api/receipt/:id             → the receipt photo (with the PIN)
//   POST /api/scan                    { photo:dataURL, model? }  → what a receipt says: total, shop, date, type (Workers AI)
//   POST /api/profile                 { id, color?, photo?:dataURL|null }  (a person's colour and photo)
//   GET  /api/photo/:id               → the person's photo (image bytes)
//   POST /api/unlock                  { pin }  → { ok } when the PIN is right (the hub asks for it once per phone)
//   POST /api/suggestions             { text, name, day, author, kind? }  (kind: food | shop | place)
//   POST /api/suggestions/:id/vote    { voter }           (toggles)
//   POST /api/suggestions/:id/delete  { author }          (author only)
//   GET  /api/backup                  → when the money was last backed up to Google Drive (with the PIN)
//   POST /api/backup                  back the money up now (see lib/backup.js; it also runs after the first money change of each day)
//   /api/photos/…                                          trip photos in Google Drive (see lib/photos.js)

// Changes need the group's PIN (the TRIP_PIN secret on the Pages project), sent by the app as an x-trip-pin header.
// Reading is open, so a guest can look around without being able to change anything, except the expenses, which need
// the PIN to read too. With no TRIP_PIN set, everything is open.
//
import { handlePhotos } from '../../lib/photos.js';
import { autoBackup, backupMoney, backupStatus } from '../../lib/backup.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

const KEYS = ['checks', 'choices', 'suggestions'];
const MAX_TEXT = 1200;
const MAX_NAME = 40;
const MAX_SUGGESTIONS = 500;
const MAX_CUSTOM = 800;
const MAX_EXPENSES = 1500;
const PEOPLE = ['naf', 'sara', 'mariam', 'm'];
const MAX_PHOTO = 400000; // a data URL; the app sends ~256px JPEGs, far smaller than this
const IDEA_KINDS = ['food', 'shop', 'place'];
const EX_CATS = ['food', 'transport', 'tickets', 'shopping', 'hotel', 'other', 'settle'];
const MAX_MONEY = 3000;
const MAX_RECEIPT = 700000; // a data URL; the app sends ~1200px JPEGs
const CCYS = ['CAD', 'QAR', 'USD'];

async function readKey(kv, key, fallback) {
  const v = await kv.get(key, 'json');
  return v == null ? fallback : v;
}

async function readState(kv) {
  const [checks, choices, suggestions, custom, expenses, money, profiles, covers] = await Promise.all([
    readKey(kv, 'checks', {}), readKey(kv, 'choices', {}), readKey(kv, 'suggestions', []), readKey(kv, 'custom', {}), readExpenses(kv), readKey(kv, 'money', {}), readProfiles(kv), readKey(kv, 'covers', {}),
  ]);
  const updatedAt = await kv.get('updatedAt');
  return { checks, choices, suggestions, custom, expenses, money, profiles, covers, updatedAt: updatedAt || null };
}

// Expenses and profiles are single records (like checks and custom), so a normal read never needs a KV list
// (list operations are capped on the free plan). The first read after the switch migrates any per-item keys.
async function readMap(kv, key, prefix) {
  const v = await kv.get(key, 'json');
  if (v) return v;
  const out = {};
  const page = await kv.list({ prefix });
  for (const k of page.keys) out[k.name.slice(prefix.length)] = k.metadata || (await kv.get(k.name, 'json'));
  await kv.put(key, JSON.stringify(out));
  return out;
}
const readExpenses = (kv) => readMap(kv, 'expenses', 'ex:');
const readProfiles = (kv) => readMap(kv, 'profiles', 'pf:');

async function writeKey(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
  await kv.put('updatedAt', new Date().toISOString());
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const isId = (s) => typeof s === 'string' && /^[a-z0-9_-]{1,80}$/i.test(s);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

// Only known fields survive, each trimmed to size. An edit to an original stop stores just the changed fields.
function cleanCustom(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  const str = { title: 90, time: 40, desc: MAX_TEXT, cost: 90, note: 300 };
  for (const [k, max] of Object.entries(str)) if (typeof v[k] === 'string') out[k] = clean(v[k], max);
  if (['all', 'nasa', 'mm'].includes(v.who)) out.who = v.who;
  if (typeof v.hidden === 'boolean') out.hidden = v.hidden;
  if (v.added === true) out.added = true;
  if (isId(v.day || '')) out.day = v.day;
  if (v.after === null || isId(v.after || '')) out.after = v.after ?? null;
  if (['food', 'sight', 'shop', 'transit', 'hotel', 'plan'].includes(v.cat)) out.cat = v.cat;
  if (v.place === null) out.place = null;
  else if (v.place && typeof v.place === 'object') {
    const lat = num(v.place.lat, -90, 90), lng = num(v.place.lng, -180, 180), name = clean(v.place.name, 90);
    if (name && lat != null && lng != null) out.place = { name, lat, lng };
  }
  if (typeof v.ts === 'string') out.ts = clean(v.ts, 40);
  return Object.keys(out).length ? out : null;
}

// A money record. Amounts are whole yen. Without a kind it's an expense: shares says what each person's part is
// (negative for a refund); the payer's own share is theirs. Older expenses with just a split list are shared evenly.
const isP = (v) => PEOPLE.includes(v);
const int = (v, lo, hi) => { const n = num(v, lo, hi); return n == null ? null : Math.round(n); };
const stamp = (v) => num(v, 0, 1e13);
function cleanExpense(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.kind === 'pay' || v.kind === 'cash' || v.kind === 'ic') return cleanMove(v);
  const yen = int(v.yen, -100000000, 100000000);
  if (yen == null || !isP(v.payer) || !EX_CATS.includes(v.cat)) return null;
  const shares = {};
  if (v.shares && typeof v.shares === 'object') { for (const p of PEOPLE) { const s = int(v.shares[p], -100000000, 100000000); if (s != null) shares[p] = s; } }
  else if (Array.isArray(v.split)) {
    const ids = PEOPLE.filter((p) => v.split.includes(p)), each = Math.trunc(yen / (ids.length || 1));
    ids.forEach((p) => { shares[p] = each; });
    if (ids.length) shares[ids.includes(v.payer) ? v.payer : ids[0]] += yen - each * ids.length;
  }
  const split = Object.keys(shares);
  if (!split.length) return null;
  const out = { title: clean(v.title, 90) || 'Expense', yen, payer: v.payer, shares, split, cat: v.cat, day: isId(v.day || '') ? v.day : null };
  const owes = {}; if (v.owes && typeof v.owes === 'object') for (const p of split) if (v.owes[p] === true) owes[p] = true;
  out.owes = owes;
  if (['cash', 'card', 'ic'].includes(v.with)) out.with = v.with;
  if (v.refund === true) out.refund = true;
  if (v.taxfree === true) out.taxfree = true; // bought tax-free (免税) with a passport
  if (v.orig && CCYS.includes(v.orig.ccy) && num(v.orig.amt, -10000000, 10000000) != null) out.orig = { ccy: v.orig.ccy, amt: v.orig.amt };
  const nights = int(v.nights, 1, 30); if (nights > 1) out.nights = nights;
  if (isP(v.by)) out.by = v.by;
  if (isP(v.editedBy)) out.editedBy = v.editedBy;
  if (stamp(v.at) != null) out.at = v.at;
  if (stamp(v.receipt) != null) out.receipt = v.receipt;
  // "Just me": the payer's own spending, on their money page only and never in who-owes-whom
  if (split.length === 1 && split[0] === v.payer) out.own = true;
  return out;
}
// Reading a receipt photo with Workers AI. The model is asked for JSON; whatever comes back is checked and trimmed.
// Llama 4 Scout read every receipt right in a comparison with Mistral Small 3.1, Gemma 3 and Llama 3.2 Vision
const SCAN_MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct'];
const SCAN_PROMPT = `This is a photo of a receipt from Japan. Read it and answer with JSON only, no other text:
{"total": number, "cash_given": number or null, "change": number or null, "tax": number or null, "pretax": number or null, "shop": string, "shop_en": string, "date": "YYYY-MM-DD" or null, "type": one of "food","transport","tickets","shopping","hotel","other", "taxfree": boolean, "items": [string]}
- total: the final amount paid in yen as a plain number. It is the line marked 合計, 合計金額, お会計, ご請求額, 現金計 or 金…円也. Never お預り/お預かり (cash handed over), お釣り/釣銭 (change), 小計 (subtotal) or a tax line.
- cash_given: the cash handed over (お預り, お預かり, 現金 when it is followed by change), or null. change: the change given back (お釣り, 釣銭), or null.
- tax: the consumption tax in yen (消費税, 内税, 外税, 内消費税等; add the 8% and 10% lines together), or null if none is printed.
- pretax: the amount before consumption tax (税抜 / 小計 before tax), or null if not printed.
- shop: the shop or restaurant name as printed; shop_en: the same name in English or romaji.
- date: the date printed on the receipt. The receipts are from a trip to Japan in October 2026: a short year like 26年 or 26/10 means 2026.
- taxfree: true if the receipt shows the purchase was tax-free (免税, 免税販売, Tax-free, Tax Free), otherwise false.
- items: up to 5 item names in English, short.`;
const num_ = { type: ['number', 'null'] };
const SCAN_SCHEMA = { type: 'object', properties: { total: { type: 'number' }, cash_given: num_, change: num_, tax: num_, pretax: num_, shop: { type: 'string' }, shop_en: { type: 'string' }, date: { type: ['string', 'null'] },
  type: { type: 'string', enum: ['food', 'transport', 'tickets', 'shopping', 'hotel', 'other'] }, taxfree: { type: 'boolean' }, items: { type: 'array', items: { type: 'string' } } }, required: ['total', 'cash_given', 'change', 'tax', 'pretax', 'shop', 'shop_en', 'date', 'type', 'taxfree', 'items'] };
async function scanReceipt(env, photo, model) {
  if (!env.AI) return { error: 'AI is not set up on this site' };
  const m = SCAN_MODELS.includes(model) ? model : SCAN_MODELS[0];
  let out;
  const messages = [{ role: 'user', content: [{ type: 'text', text: SCAN_PROMPT }, { type: 'image_url', image_url: { url: photo } }] }];
  // a strict JSON answer and no randomness: the same photo reads the same way every time
  try { out = await env.AI.run(m, { messages, max_tokens: 500, temperature: 0, response_format: { type: 'json_schema', json_schema: SCAN_SCHEMA } }); }
  catch { out = await env.AI.run(m, { messages, max_tokens: 500, temperature: 0 }); }
  const text = typeof out === 'string' ? out : out && (out.response ?? out.result ?? (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
  let data = text && typeof text === 'object' ? text : null;
  if (!data) { const j = String(text || '').match(/\{[\s\S]*\}/); try { data = j ? JSON.parse(j[0]) : null; } catch { data = null; } }
  if (!data) return { model: m, error: 'unreadable', raw: String(text || '').slice(0, 400) };
  const yen = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[^\d.]/g, ''))); return n > 0 && n < 10000000 ? n : null; };
  let total = yen(data.total); const tax = yen(data.tax), given = yen(data.cash_given), change = Number(String(data.change ?? '').replace(/[^\d.]/g, ''));
  // a cash receipt checks itself: what was paid is the cash handed over less the change. This catches the model
  // picking お預り (the cash given) as the total.
  if (given && Number.isFinite(change) && change > 0 && given - change > 0 && total !== given - change && (!total || total === given || total > given - change)) total = given - change;
  // before tax: the total less the tax printed on it, or the model's own reading of 税抜, if it's sensible
  let pretax = total && tax && tax < total * 0.2 ? total - tax : yen(data.pretax);
  if (!total || !pretax || pretax >= total || pretax < total * 0.85) pretax = null;
  const types = ['food', 'transport', 'tickets', 'shopping', 'hotel', 'other'];
  return { model: m, total, pretax, shop: clean(data.shop, 60), shop_en: clean(data.shop_en, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : null,
    type: types.includes(data.type) ? data.type : null, taxfree: data.taxfree === true, items: Array.isArray(data.items) ? data.items.slice(0, 5).map((x) => clean(x, 40)) : [],
    // each line with its price, for splitting a receipt by item: { name, price, qty }
    lines: Array.isArray(data.lines) ? data.lines.slice(0, 40).map((l) => l && typeof l === 'object' && { name: clean(l.name, 50), price: yen(l.price), qty: Math.max(1, Math.min(99, Math.round(+l.qty) || 1)) }).filter((l) => l && l.name && l.price) : [] };
}

// Money moving between people: a settle-up payment (pay), cash handed over or taken out (cash), an IC card top-up (ic).
function cleanMove(v) {
  const yen = int(v.yen, 0, 100000000), day = isId(v.day || '') ? v.day : null;
  if (yen == null) return null;
  const out = { kind: v.kind, yen, day };
  if (isP(v.by)) out.by = v.by;
  if (stamp(v.at) != null) out.at = v.at;
  if (v.kind === 'pay') {
    if (!isP(v.from) || !isP(v.to) || v.from === v.to) return null;
    Object.assign(out, { from: v.from, to: v.to, cash: v.cash === true });
    // the debts this payment clears: [who owed, who was owed, yen]
    if (Array.isArray(v.flows)) out.flows = v.flows.slice(0, 40).filter((f) => Array.isArray(f) && isP(f[0]) && isP(f[1]) && num(f[2], 0, 100000000) != null).map((f) => [f[0], f[1], f[2]]);
    if (v.netted === true) out.netted = true;
    if (isId(v.pair || '')) out.pair = v.pair;
    if (typeof v.ccyAmt === 'string') out.ccyAmt = clean(v.ccyAmt, 24);
    return out;
  }
  if (!isP(v.who)) return null;
  out.who = v.who;
  if (v.kind === 'cash' && isP(v.from) && v.from !== v.who) out.from = v.from;
  if (v.kind === 'ic' && (v.with === 'card' || v.with === 'cash')) out.with = v.with; // a top-up paid by card (Apple Wallet Suica) doesn't come out of the cash
  return out;
}
// A money setting: who sends or receives a payment (s:<key> / r:<key>), who set it (by:s:<key>), payments shown
// separately (u:<a~b>), budgets (b:<person> / bc:<couple>) and when each person last looked (seen:<person>).
const isKey = (s) => typeof s === 'string' && /^[a-z0-9_:>|,~.-]{1,160}$/i.test(s);
function cleanSetting(v) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1e13 ? v : undefined;
  if (typeof v === 'string') return clean(v, 40);
  return undefined;
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const kv = env.TRIP_KV;

  const rc = path.match(/^receipt\/([a-z0-9_-]{1,80})$/i);
  if (request.method === 'GET' && rc && kv) {
    const pin = env.TRIP_PIN ? String(env.TRIP_PIN) : '';
    if (pin && request.headers.get('x-trip-pin') !== pin) return new Response('pin required', { status: 403 });
    const data = await kv.get('rc:' + rc[1]);
    const m = data && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data);
    if (!m) return new Response('not found', { status: 404 });
    const bin = atob(m[2]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, { headers: { 'content-type': m[1], 'cache-control': 'private, max-age=31536000, immutable' } });
  }

  const ph = path.match(/^photo\/([a-z]+)$/);
  if (request.method === 'GET' && ph && kv) {
    const data = await kv.get('ph:' + ph[1]);
    const m = data && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data);
    if (!m) return new Response('not found', { status: 404 });
    const bin = atob(m[2]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // the app asks for /api/photo/<id>?v=<when it changed>, so each version can be cached for good
    return new Response(bytes, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable' } });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type, x-trip-pin, x-photo-token' } });
  }

  if (path === 'health') return json({ ok: true, kv: !!kv });
  if (!kv) return json({ error: 'KV namespace TRIP_KV is not bound. See README.' }, 503);
  if (path === 'photos' || path.startsWith('photos/')) return handlePhotos({ request, env, url, path, kv });

  const pin = env.TRIP_PIN ? String(env.TRIP_PIN) : '';
  const member = !pin || request.headers.get('x-trip-pin') === pin;
  try {
    if (request.method === 'GET' && path === 'version') {
      return json({ updatedAt: (await kv.get('updatedAt')) || null });
    }

    // The money stays between the four of us: without the PIN the state comes back with no expenses.
    if (request.method === 'GET' && path === 'state') {
      const st = await readState(kv);
      if (!member) { st.expenses = {}; st.money = {}; }
      return json(st);
    }

    const loadMoney = async () => ({ expenses: await readExpenses(kv), money: await readKey(kv, 'money', {}) });
    if (path === 'backup') {
      if (!member) return json({ error: 'pin required', pin: true }, 403);
      if (request.method === 'POST') await backupMoney(env, kv, loadMoney);
      return json(await backupStatus(kv));
    }
    // after a money change, the day's backup (if it hasn't run yet) carries on once the answer has gone back
    const afterMoney = () => { const p = autoBackup(env, kv, loadMoney).catch(() => {}); if (ctx.waitUntil) ctx.waitUntil(p); };

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    let body = {};
    try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

    // reading a receipt (the four of us only)
    if (path === 'scan') {
      if (!member) return json({ error: 'pin required', pin: true }, 403);
      if (typeof body.photo !== 'string' || body.photo.length > MAX_RECEIPT * 2 || !/^data:image\/(jpeg|png|webp);base64,/.test(body.photo)) return json({ error: 'bad photo' }, 400);
      const t0 = Date.now();
      try { return json({ ...(await scanReceipt(env, body.photo)), ms: Date.now() - t0 }); } catch (err) { return json({ error: String(err && err.message || err), ms: Date.now() - t0 }, 502); }
    }

    if (path === 'unlock') return pin && String(body.pin ?? '') !== pin ? json({ error: 'wrong pin' }, 403) : json({ ok: true });
    if (!member) return json({ error: 'pin required', pin: true }, 403);

    if (path === 'checks' || path === 'choices') {
      if (!isId(body.id)) return json({ error: 'bad id' }, 400);
      const map = await readKey(kv, path, {});
      if (path === 'checks') {
        if (body.value) map[body.id] = true; else delete map[body.id];
      } else {
        const v = clean(body.value, 60);
        if (v) map[body.id] = v; else delete map[body.id];
      }
      await writeKey(kv, path, map);
      return json({ ok: true, [path]: map });
    }

    if (path === 'custom') {
      if (!isId(body.id)) return json({ error: 'bad id' }, 400);
      const map = await readKey(kv, 'custom', {});
      const value = body.value === null ? null : cleanCustom(body.value);
      if (value) {
        if (!map[body.id] && Object.keys(map).length >= MAX_CUSTOM) return json({ error: 'too many changes' }, 429);
        map[body.id] = { ...value, ts: new Date().toISOString() };
      } else delete map[body.id];
      await writeKey(kv, 'custom', map);
      return json({ ok: true, custom: map });
    }

    if (path === 'expenses') {
      if (!isId(body.id)) return json({ error: 'bad id' }, 400);
      const map = await readExpenses(kv);
      if (body.value === null) delete map[body.id];
      else {
        const value = cleanExpense(body.value);
        if (!value) return json({ error: 'bad expense' }, 400);
        if (!map[body.id] && Object.keys(map).length >= MAX_EXPENSES) return json({ error: 'too many expenses' }, 429);
        map[body.id] = { ...value, ts: (map[body.id] && map[body.id].ts) || new Date().toISOString() };
      }
      await writeKey(kv, 'expenses', map);
      afterMoney();
      return json({ ok: true, expenses: map });
    }

    if (path === 'money') {
      if (!isKey(body.id)) return json({ error: 'bad id' }, 400);
      const value = cleanSetting(body.value);
      if (value === undefined) return json({ error: 'bad value' }, 400);
      const map = await readKey(kv, 'money', {});
      if (value === null || value === '') delete map[body.id];
      else {
        if (!(body.id in map) && Object.keys(map).length >= MAX_MONEY) return json({ error: 'too many settings' }, 429);
        map[body.id] = value;
      }
      await writeKey(kv, 'money', map);
      afterMoney();
      return json({ ok: true, money: map });
    }

    if (path === 'receipt') {
      if (!isId(body.id)) return json({ error: 'bad id' }, 400);
      if (body.photo === null) { await kv.delete('rc:' + body.id); return json({ ok: true }); }
      if (typeof body.photo !== 'string' || body.photo.length > MAX_RECEIPT || !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(body.photo)) return json({ error: 'bad photo' }, 400);
      await kv.put('rc:' + body.id, body.photo);
      return json({ ok: true });
    }

    if (path === 'profile') {
      if (!PEOPLE.includes(body.id)) return json({ error: 'bad person' }, 400);
      const map = await readProfiles(kv);
      const rec = { ...(map[body.id] || {}) };
      if (body.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(body.color || '')) return json({ error: 'bad colour' }, 400); rec.color = body.color.toLowerCase(); }
      if (body.photo === null) { await kv.delete('ph:' + body.id); delete rec.photo; }
      else if (body.photo !== undefined) {
        if (typeof body.photo !== 'string' || body.photo.length > MAX_PHOTO || !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(body.photo)) return json({ error: 'bad photo' }, 400);
        await kv.put('ph:' + body.id, body.photo);
        rec.photo = Date.now();
      }
      rec.ts = new Date().toISOString();
      map[body.id] = rec;
      await writeKey(kv, 'profiles', map);
      return json({ ok: true, profiles: map });
    }

    if (path === 'suggestions') {
      const text = clean(body.text, MAX_TEXT);
      if (!text) return json({ error: 'text required' }, 400);
      const list = await readKey(kv, 'suggestions', []);
      if (list.length >= MAX_SUGGESTIONS) return json({ error: 'too many suggestions' }, 429);
      const item = {
        id: 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        text, name: clean(body.name, MAX_NAME) || 'Anonymous',
        day: isId(body.day || '') ? body.day : null,
        kind: IDEA_KINDS.includes(body.kind) ? body.kind : 'food',
        author: isId(body.author || '') ? body.author : null,
        votes: [], ts: new Date().toISOString(),
      };
      list.unshift(item);
      await writeKey(kv, 'suggestions', list);
      return json({ ok: true, suggestions: list });
    }

    const m = path.match(/^suggestions\/([a-z0-9_-]+)\/(vote|delete)$/i);
    if (m) {
      const [, id, action] = m;
      const list = await readKey(kv, 'suggestions', []);
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return json({ error: 'not found' }, 404);
      if (action === 'vote') {
        if (!isId(body.voter)) return json({ error: 'bad voter' }, 400);
        const votes = new Set(list[idx].votes || []);
        if (votes.has(body.voter)) votes.delete(body.voter); else votes.add(body.voter);
        list[idx].votes = [...votes];
      } else {
        if (!body.author || list[idx].author !== body.author) return json({ error: 'only the author can delete' }, 403);
        list.splice(idx, 1);
      }
      await writeKey(kv, 'suggestions', list);
      return json({ ok: true, suggestions: list });
    }

    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
}
