// Where the shared trip state lives, behind one small interface, so the API routes don't care which:
//   read(key, fallback)        → the value
//   readMany(keys)             → { key: value }   (missing keys are left out; 'updatedAt' may be asked for too)
//   version()                  → updatedAt, or null
//   update(key, fallback, fn)  → fn(current) returns { value } to store or { error, status } to refuse; the result is
//                                returned, with the stored value. The change is never lost to a write that landed in
//                                between: with the Durable Object it is retried on a stale revision.
//   write(key, value)          → store it as is (covers)
//   kind                       → 'durable-object' | 'kv'
//
// With TRIP_DO bound (a Durable Object in workers/state, see README), the object is the truth: every read and write goes
// there, and the first visit copies KV's data in. KV keeps a mirror of each write, so a rollback that drops the binding
// still finds the data, and the photos, logs and backup records stay in KV as before. Without the binding, KV alone,
// as it always was (the e2e tests run both).
const STATE_KEYS = ['checks', 'choices', 'suggestions', 'custom', 'expenses', 'money', 'profiles', 'covers'];
const RETRIES = 25; // every retry is one more writer ahead of us; four phones never need more than a handful

export function stateStore(env, ctx) {
  const kv = kvStore(env.TRIP_KV);
  return env.TRIP_DO ? doStore(env.TRIP_DO, kv, env.TRIP_KV, ctx) : kv;
}

function kvStore(kv) {
  const readKey = async (key, fallback) => { const v = await kv.get(key, 'json'); return v == null ? fallback : v; };
  // Expenses and profiles were once one KV key per record (ex:<id>, pf:<id>); the first read after that switch
  // gathers them into one map (a KV list, which normal reads never need: list operations are capped on the free plan).
  const readMap = async (key, prefix) => {
    const v = await kv.get(key, 'json'); if (v) return v;
    const out = {}; const page = await kv.list({ prefix });
    for (const k of page.keys) out[k.name.slice(prefix.length)] = k.metadata || (await kv.get(k.name, 'json'));
    await kv.put(key, JSON.stringify(out)); // so the next read needs no list, even when the map is still empty
    return out;
  };
  const read = (key, fallback) => (key === 'expenses' ? readMap('expenses', 'ex:') : key === 'profiles' ? readMap('profiles', 'pf:') : key === 'updatedAt' ? kv.get('updatedAt').then((v) => v || fallback) : readKey(key, fallback));
  // The value and the stamp go out together (KV has no ordering between keys anyway; a phone that sees the stamp a
  // moment early just reads the state once more).
  const write = async (key, value, at = new Date().toISOString()) => { await Promise.all([kv.put(key, JSON.stringify(value)), kv.put('updatedAt', at)]); return at; };
  return {
    kind: 'kv', read, write,
    async readMany(keys) { const out = {}; await Promise.all(keys.map(async (k) => { const v = await read(k, undefined); if (v !== undefined) out[k] = v; })); return out; },
    async version() { return (await kv.get('updatedAt')) || null; },
    async update(key, fallback, fn) { const r = fn(await read(key, fallback)); if (r.error) return r; await write(key, r.value); return r; },
  };
}

function doStore(ns, kvs, kv, ctx) {
  const stub = () => ns.get(ns.idFromName('trip'));
  const call = async (body) => { const r = await stub().fetch('https://state/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
  // First contact: the object is empty, so KV's data (the state as it was) is copied in before anything is answered.
  let seeding = null;
  const seeded = async (r) => {
    if (r.seeded) return r;
    seeding ||= (async () => { const items = await kvs.readMany(STATE_KEYS); await call({ op: 'seed', items, updatedAt: await kvs.version() }); })();
    await seeding; return null;
  };
  const get = async (key) => { let r = await call({ op: 'get', key }); if (!(await seeded(r))) r = await call({ op: 'get', key }); return r; };
  // KV keeps a copy of every write; the answer doesn't wait for it when the platform lets it run afterwards
  const mirror = async (key, value, at) => { const p = kvs.write(key, value, at).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p; };
  return {
    kind: 'durable-object',
    async read(key, fallback) { const v = (await get(key)).value; return v == null ? fallback : v; },
    async readMany(keys) {
      let r = await call({ op: 'getMany', keys }); if (!(await seeded(r))) r = await call({ op: 'getMany', keys });
      const out = {}; for (const k of keys) if (r.items[k] && r.items[k].value != null) out[k] = r.items[k].value;
      if (keys.includes('updatedAt') && r.updatedAt) out.updatedAt = r.updatedAt; // the stamp rides along, so /api/state is one call
      return out;
    },
    async version() { let r = await call({ op: 'version' }); if (!(await seeded(r))) r = await call({ op: 'version' }); return r.updatedAt || null; },
    async update(key, fallback, fn) {
      let cur = await get(key);
      for (let i = 0; i < RETRIES; i++) {
        const r = fn(cur.value == null ? fallback : cur.value); if (r.error) return r;
        const w = await call({ op: 'put', key, value: r.value, rev: cur.rev });
        if (w.status === 409) { cur = { value: w.value, rev: w.rev }; await new Promise((r) => setTimeout(r, Math.random() * 20)); continue; } // someone wrote in between: redo on theirs
        if (!w.ok) throw new Error('state store: ' + (w.error || w.status));
        await mirror(key, r.value, w.updatedAt); return r;
      }
      throw new Error('state store: too busy, try again');
    },
    async write(key, value) { const w = await call({ op: 'put', key, value }); if (!w.ok) throw new Error('state store: ' + (w.error || w.status)); await mirror(key, value, w.updatedAt); return w.updatedAt; },
  };
}
