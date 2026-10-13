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
//   { op: 'tick', now? }                      → checks the flights that are due (lib/flights.js) and sends alerts;
//                                               run every 5 minutes by the cron trigger below → { checked, alerts }
//   { op: 'pushkey' }                         → { key, tracking }: the public key phones subscribe to alerts with
// Flight results live under 'flights' (phones read them with the rest of the state); the phones' alert subscriptions
// under 'push' (written by the Pages Function, never sent to phones). FLIGHTAWARE_KEY (or AERODATABOX_KEY, or AIRLABS_KEY) and
// VAPID_PRIVATE are secrets on this Worker, VAPID_PUBLIC a plain variable; without a flight key the tick does nothing.
// A GET with Upgrade: websocket is a phone asking to be told of changes: it gets { updatedAt } the moment any write
// lands (hibernating sockets: no cost while quiet; 'ping' is answered 'pong' without waking the object).
// Values are kept as JSON text in one SQLite row each (a row holds up to 2 MB; the biggest map, expenses, stays well
// under that). lib/state-store.js in the Pages Function is the only caller; tests/e2e.mjs runs this class on a fake sql.

import { checkFlights, lookupFor, ALERT_KINDS } from '../../../lib/flights.js';
import { sendPush } from '../../../lib/webpush.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class TripState {
  constructor(ctx, env = {}) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
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
    if (b.op === 'pushkey') return json({ key: this.env.VAPID_PUBLIC || null, tracking: !!(this.env.FLIGHTAWARE_KEY || this.env.AERODATABOX_KEY || this.env.AIRLABS_KEY) });
    if (b.op === 'tick') return json(await this.tick(b.now ? Date.parse(b.now) : Date.now()));
    return json({ error: 'unknown op' }, 400);
  }

  // One round of flight checks. Only flights that are due cost a call (see lib/flights.js for the timetable).
  async tick(now) {
    const env = this.env, svc = lookupFor(env, env.FLIGHT_FETCH || fetch); if (!svc) return { checked: 0, alerts: 0, off: true };
    let checked = 0; const cur = this.get('flights');
    const r = await checkFlights({ custom: this.get('custom').value || {}, flights: cur.value || {}, now, airEvery: svc.airEvery, lead: svc.lead, look: (f) => { checked++; return svc.look(f); } });
    if (r.changed) { this.set('flights', r.flights, cur.rev + 1); this.tell(this.stamp()); }
    if (r.alerts.length) await this.alert(r.alerts);
    return { checked, alerts: r.alerts.length };
  }

  // Each phone gets an alert when anyone on the flight is someone it follows for that kind of change (Settings).
  // One alert per flight change, however many of its people the phone follows. Phones that unsubscribed are forgotten.
  async alert(alerts) {
    const env = this.env; if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) return;
    const vapid = { publicKey: env.VAPID_PUBLIC, privateJwk: JSON.parse(env.VAPID_PRIVATE), subject: 'https://ourtrips.date/japan/' };
    const subs = this.get('push').value || {}, gone = [];
    for (const [id, s] of Object.entries(subs)) {
      for (const a of alerts) {
        if (!ALERT_KINDS.includes(a.kind) || !a.people.some((p) => s.prefs && s.prefs[p] && s.prefs[p][a.kind] !== false)) continue;
        // a busy or failing push service (429, 5xx, no answer) gets one more try a second later
        const send = () => sendPush(s.sub, { title: 'Japan 2026', body: a.text, tag: 'fl-' + a.id, url: `/japan/?d=${a.day}` }, vapid, env.PUSH_FETCH || fetch).catch(() => 0);
        let st = await send();
        if (st === 0 || st === 429 || st >= 500) { await new Promise((r) => setTimeout(r, env.PUSH_RETRY_MS ?? 1000)); st = await send(); }
        if (st === 404 || st === 410) { gone.push(id); break; } // anything else still failing: this phone misses it, the stop still shows it
      }
    }
    // read again: a phone may have turned alerts on while these were going out
    if (gone.length) { const now = this.get('push'), left = { ...(now.value || {}) }; for (const id of gone) delete left[id]; this.set('push', left, now.rev + 1); }
  }
}

// The Worker itself has nothing to serve; the Pages Function reaches the object through its binding.
// Every 5 minutes (the cron in wrangler.toml) the object checks the flights that are due.
export default {
  fetch: () => new Response('japan2026 state: the trip\'s shared state lives in a Durable Object here, reached only by the site\'s API.', { status: 200 }),
  async scheduled(event, env, ctx) {
    const stub = env.TRIP_STATE.get(env.TRIP_STATE.idFromName('trip'));
    ctx.waitUntil(stub.fetch('https://state/', { method: 'POST', body: JSON.stringify({ op: 'tick' }) }));
  },
};
