// The trip's shared state, kept by one Durable Object (SQLite-backed): a small key → JSON store with a revision number
// per key, so the Pages Function can read a map, change it and write it back only if nobody else wrote in between
// (compare-and-swap). Workers KV, which held this before, is eventually consistent: two phones writing within the same
// minute from different Cloudflare locations could silently lose one change. Here every request runs one at a time.
//
// One route, POST / with { op, … }:
//   { op: 'get', key }                        → { value, rev, seeded }
//   { op: 'getMany', keys }                   → { items: { key: { value, rev } }, updatedAt, seeded }
//   { op: 'put', key, value, rev? }           → { ok, rev, updatedAt }, or 409 { value, rev } when rev is stale
//   { op: 'seed', items: { key: value }, updatedAt }  → copies KV's data in, once (keys already present are kept)
//   { op: 'version' }                         → { updatedAt, seeded }
// A GET with Upgrade: websocket is a phone asking to be told of changes: it gets { updatedAt } the moment any write
// lands (hibernating sockets: no cost while quiet; 'ping' is answered 'pong' without waking the object).
// Values are kept as JSON text in one SQLite row each (a row holds up to 2 MB; the biggest map, expenses, stays well
// under that). lib/state-store.js in the Pages Function is the only caller; tests/e2e.mjs runs this class on a fake sql.

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class TripState {
  constructor(ctx) {
    this.ctx = ctx; this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1)');
    if (ctx.setWebSocketAutoResponse && typeof WebSocketRequestResponsePair !== 'undefined') ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  // every phone holding a socket hears that something changed; it then fetches the state as usual
  tell(updatedAt) { for (const ws of this.ctx.getWebSockets ? this.ctx.getWebSockets() : []) { try { ws.send(JSON.stringify({ updatedAt })); } catch { /* gone */ } } }
  webSocketMessage() { /* only pings come in, answered by the auto-response */ }
  webSocketClose(ws) { try { ws.close(); } catch { /* already closed */ } }
  webSocketError(ws) { try { ws.close(); } catch { /* already closed */ } }
  row(k) { return this.sql.exec('SELECT v, rev FROM kv WHERE k = ?', k).toArray()[0] || null; }
  get(k) { const r = this.row(k); return r ? { value: JSON.parse(r.v), rev: r.rev } : { value: null, rev: 0 }; }
  set(k, value, rev) { this.sql.exec('INSERT INTO kv (k, v, rev) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = excluded.rev', k, JSON.stringify(value), rev); }
  meta(k) { const r = this.row('_' + k); return r ? JSON.parse(r.v) : null; }
  stamp() { const at = new Date().toISOString(); this.set('_updatedAt', at, 1); return at; }

  async fetch(request) {
    if (request.headers.get('upgrade') === 'websocket') {
      const pair = new WebSocketPair(); this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    let b; try { b = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
    const seeded = !!this.meta('seeded'), updatedAt = this.meta('updatedAt');
    if (b.op === 'version') return json({ updatedAt, seeded });
    if (b.op === 'get') return json({ ...this.get(String(b.key)), seeded });
    if (b.op === 'getMany') {
      const items = {}; for (const k of Array.isArray(b.keys) ? b.keys : []) items[k] = this.get(String(k));
      return json({ items, updatedAt, seeded });
    }
    if (b.op === 'put') {
      const key = String(b.key), cur = this.get(key);
      if (b.rev != null && b.rev !== cur.rev) return json({ value: cur.value, rev: cur.rev }, 409);
      this.set(key, b.value, cur.rev + 1);
      const at = this.stamp(); this.tell(at);
      return json({ ok: true, rev: cur.rev + 1, updatedAt: at });
    }
    if (b.op === 'seed') {
      // KV's data comes in once, the first time the Pages Function finds this object empty; a key that already has a
      // value (a write that landed first) is kept
      let n = 0; for (const [k, v] of Object.entries(b.items || {})) if (v != null && !this.row(k)) { this.set(k, v, 1); n++; }
      if (b.updatedAt && !this.row('_updatedAt')) this.set('_updatedAt', b.updatedAt, 1);
      this.set('_seeded', true, 1); if (n) this.tell(this.meta('updatedAt'));
      return json({ ok: true, seeded: n });
    }
    return json({ error: 'unknown op' }, 400);
  }
}

// The Worker itself has nothing to serve; the Pages Function reaches the object through its binding.
export default { fetch: () => new Response('japan2026 state: the trip\'s shared state lives in a Durable Object here, reached only by the site\'s API.', { status: 200 }) };
