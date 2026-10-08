// Cloudflare Pages Function — shared trip state in Workers KV.
// Bind a KV namespace named TRIP_KV in the Pages project (Settings → Bindings).
//
// Routes:
//   GET  /api/health                  → { ok, kv }
//   GET  /api/state                   → { checks, choices, suggestions, updatedAt }
//   POST /api/checks                  { id, value:boolean }
//   POST /api/choices                 { id, value:string }
//   POST /api/suggestions             { text, name, day, author }
//   POST /api/suggestions/:id/vote    { voter }           (toggles)
//   POST /api/suggestions/:id/delete  { author }          (author only)

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

const KEYS = ['checks', 'choices', 'suggestions'];
const MAX_TEXT = 1200;
const MAX_NAME = 40;
const MAX_SUGGESTIONS = 500;

async function readKey(kv, key, fallback) {
  const v = await kv.get(key, 'json');
  return v == null ? fallback : v;
}

async function readState(kv) {
  const [checks, choices, suggestions] = await Promise.all([
    readKey(kv, 'checks', {}), readKey(kv, 'choices', {}), readKey(kv, 'suggestions', []),
  ]);
  const updatedAt = await kv.get('updatedAt');
  return { checks, choices, suggestions, updatedAt: updatedAt || null };
}

async function writeKey(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
  await kv.put('updatedAt', new Date().toISOString());
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const isId = (s) => typeof s === 'string' && /^[a-z0-9_-]{1,80}$/i.test(s);

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
