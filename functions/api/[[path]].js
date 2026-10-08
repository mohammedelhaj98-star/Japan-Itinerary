// Cloudflare Pages Function — shared trip state in Workers KV.
// Bind a KV namespace named TRIP_KV in the Pages project (Settings → Bindings).
//
// Routes:
//   GET  /api/health                  → { ok, kv }
//   GET  /api/state                   → { checks, choices, suggestions, custom, updatedAt }
//   POST /api/checks                  { id, value:boolean }
//   POST /api/choices                 { id, value:string }
//   POST /api/custom                  { id, value:object|null }  (edit, hide or add a stop; null resets/removes)
//   POST /api/suggestions             { text, name, day, author }
//   POST /api/suggestions/:id/vote    { voter }           (toggles)
//   POST /api/suggestions/:id/delete  { author }          (author only)

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

const KEYS = ['checks', 'choices', 'suggestions'];
const MAX_TEXT = 1200;
const MAX_NAME = 40;
const MAX_SUGGESTIONS = 500;
const MAX_CUSTOM = 800;

async function readKey(kv, key, fallback) {
  const v = await kv.get(key, 'json');
  return v == null ? fallback : v;
}

async function readState(kv) {
  const [checks, choices, suggestions, custom] = await Promise.all([
    readKey(kv, 'checks', {}), readKey(kv, 'choices', {}), readKey(kv, 'suggestions', []), readKey(kv, 'custom', {}),
  ]);
  const updatedAt = await kv.get('updatedAt');
  return { checks, choices, suggestions, custom, updatedAt: updatedAt || null };
}

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

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const kv = env.TRIP_KV;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' } });
  }

  if (path === 'health') return json({ ok: true, kv: !!kv });
  if (!kv) return json({ error: 'KV namespace TRIP_KV is not bound. See README.' }, 503);

  try {
    if (request.method === 'GET' && path === 'state') {
      return json(await readState(kv));
    }

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
    let body = {};
    try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

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

    if (path === 'suggestions') {
      const text = clean(body.text, MAX_TEXT);
      if (!text) return json({ error: 'text required' }, 400);
      const list = await readKey(kv, 'suggestions', []);
      if (list.length >= MAX_SUGGESTIONS) return json({ error: 'too many suggestions' }, 429);
      const item = {
        id: 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        text, name: clean(body.name, MAX_NAME) || 'Anonymous',
        day: isId(body.day || '') ? body.day : null,
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
