// Cloudflare Pages Function — shared trip state in Workers KV.
// Bind a KV namespace named TRIP_KV in the Pages project (Settings → Bindings).
//
// Routes:
//   GET  /api/health                  → { ok, kv }
//   GET  /api/version                 → { updatedAt }  (one read: phones poll this, and fetch /api/state only when it changes)
//   GET  /api/state                   → { checks, choices, suggestions, custom, expenses, profiles, covers, updatedAt }
//                                       (expenses only with the PIN in x-trip-pin)
//   POST /api/checks                  { id, value:boolean }
//   POST /api/choices                 { id, value:string }
//   POST /api/custom                  { id, value:object|null }  (edit, hide or add a stop; null resets/removes)
//   POST /api/expenses                { id, value:object|null }  (add or edit a shared expense; null deletes)
//   POST /api/profile                 { id, color?, photo?:dataURL|null }  (a person's colour and photo)
//   GET  /api/photo/:id               → the person's photo (image bytes)
//   POST /api/unlock                  { pin }  → { ok } when the PIN is right (the hub asks for it once per phone)
//   POST /api/suggestions             { text, name, day, author, kind? }  (kind: food | shop | place)
//   POST /api/suggestions/:id/vote    { voter }           (toggles)
//   POST /api/suggestions/:id/delete  { author }          (author only)
//   /api/photos/…                                          trip photos in Google Drive (see lib/photos.js)

// Changes need the group's PIN (the TRIP_PIN secret on the Pages project), sent by the app as an x-trip-pin header.
// Reading is open, so a guest can look around without being able to change anything, except the expenses, which need
// the PIN to read too. With no TRIP_PIN set, everything is open.
//
import { handlePhotos } from '../../lib/photos.js';

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

async function readKey(kv, key, fallback) {
  const v = await kv.get(key, 'json');
  return v == null ? fallback : v;
}

async function readState(kv) {
  const [checks, choices, suggestions, custom, expenses, profiles, covers] = await Promise.all([
    readKey(kv, 'checks', {}), readKey(kv, 'choices', {}), readKey(kv, 'suggestions', []), readKey(kv, 'custom', {}), readExpenses(kv), readProfiles(kv), readKey(kv, 'covers', {}),
  ]);
  const updatedAt = await kv.get('updatedAt');
  return { checks, choices, suggestions, custom, expenses, profiles, covers, updatedAt: updatedAt || null };
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

// A shared expense. Amounts are whole yen; split lists who it was for.
function cleanExpense(v) {
  if (!v || typeof v !== 'object') return null;
  const yen = num(v.yen, 0, 100000000);
  const split = Array.isArray(v.split) ? PEOPLE.filter((p) => v.split.includes(p)) : [];
  if (yen == null || !PEOPLE.includes(v.payer) || !split.length || !EX_CATS.includes(v.cat)) return null;
  const out = { title: clean(v.title, 90) || 'Expense', yen: Math.round(yen), payer: v.payer, split, cat: v.cat, day: isId(v.day || '') ? v.day : null };
  if (PEOPLE.includes(v.by)) out.by = v.by;
  // "Just me": the payer's own spending, on their money page only and never in who-owes-whom
  if (v.own === true && split.length === 1 && split[0] === v.payer) out.own = true;
  return out;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const kv = env.TRIP_KV;

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
      if (!member) st.expenses = {};
      return json(st);
    }

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    let body = {};
    try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

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
      return json({ ok: true, expenses: map });
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
