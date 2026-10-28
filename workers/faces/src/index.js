// Face recognition's server, for the Photos page: a small Linux box (Cloudflare Containers) running open-source models
// (server/: InsightFace finds and prints faces, YOLOX finds people), and what it found in each photo, kept in one place
// (FaceLooks, a Durable Object), so no phone downloads a model and no photo is looked at twice.
// The site (lib/photos.js, through its FACES service binding) asks it:
//   POST /look?rot=90   a photo's bytes       → { f, b }  what's in it (the shape js/faces.js reads)
//   POST /get     { keys }                    → { looks: { key: look } }  the ones looked at already
//   POST /put     { key, look }               → { ok }
//   POST /missing { keys }                    → { keys }  the ones not looked at yet
// A key is a photo id, or id@90 for a photo someone turned. Every minute it asks the site to look at a few photos no one
// has looked at yet (POST /api/photos/sweep with FACES_KEY, a secret both sides have), so the older ones get done too.
// Deploy with scripts/deploy-faces.sh.
import { DurableObject } from 'cloudflare:workers';

// One box: its container is started when a photo comes, and stopped after 5 quiet minutes (a stopped box costs nothing;
// starting takes a few seconds, the models load in about two)
const QUIET = 5 * 60e3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export class FaceBox extends DurableObject {
  async fetch(req) {
    const c = this.ctx.container, u = new URL(req.url), body = req.method === 'POST' ? await req.arrayBuffer() : undefined;
    await this.ctx.storage.setAlarm(Date.now() + QUIET);
    const port = () => c.getTcpPort(8080);
    for (let i = 0; i < 40; i++) { // (about a minute: the box starts, then its models load)
      if (i === 1 && this.gone === undefined) this.gone = true; // (a box from before this object woke, not answering: start it again)
      if (!c.running || this.gone) { // (a box that stopped can still say it's running: monitor() tells)
        if (c.running) await Promise.race([c.destroy().catch(() => {}), wait(5000)]);
        try { c.start({ image: c.images.box, instance: 'standard-1', enableInternet: false }); } catch (e) { console.log('the face box would not start', String(e)); await wait(1500); continue; }
        this.gone = false;
        c.monitor().catch((e) => console.log('the face box stopped', String(e))).finally(() => { this.gone = true; });
      }
      try { if ((await port().fetch('http://box/', { signal: AbortSignal.timeout(4000) })).ok) break; } catch {} // (not up yet)
      if (i === 39) { console.log('the face box did not start'); return Response.json({ error: 'the face box did not start' }, { status: 503 }); }
      await wait(1500);
    }
    try { return await port().fetch('http://box' + u.pathname + u.search, { method: req.method, body, signal: AbortSignal.timeout(60e3) }); }
    catch (e) { console.log('the face box did not answer', String(e)); return Response.json({ error: 'the face box did not answer' }, { status: 503 }); }
  }
  async alarm() { if (this.ctx.container.running) await this.ctx.container.destroy(); }
}

export class FaceLooks extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS looks (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  }
  async fetch(req) {
    const p = new URL(req.url).pathname, b = await req.json().catch(() => ({}));
    const keys = Array.isArray(b.keys) ? b.keys.filter(isKey).slice(0, 5000) : [];
    if (p === '/get') {
      const looks = {};
      for (let i = 0; i < keys.length; i += 90) { // (a query takes at most 100 values)
        const part = keys.slice(i, i + 90);
        for (const r of this.sql.exec(`SELECT k, v FROM looks WHERE k IN (${part.map(() => '?').join(',')})`, ...part)) looks[r.k] = JSON.parse(r.v);
      }
      return Response.json({ looks });
    }
    if (p === '/missing') {
      const have = new Set([...this.sql.exec('SELECT k FROM looks')].map((r) => r.k));
      return Response.json({ keys: keys.filter((k) => !have.has(k)) });
    }
    if (p === '/put' && isKey(b.key) && b.look && Array.isArray(b.look.f)) {
      this.sql.exec('INSERT OR REPLACE INTO looks (k, v) VALUES (?, ?)', b.key, JSON.stringify(b.look));
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'not here' }, { status: 404 });
  }
}
const isKey = (k) => typeof k === 'string' && /^[a-zA-Z0-9_-]{10,128}(@(90|180|270))?$/.test(k);
const looks = (env) => env.LOOKS.get(env.LOOKS.idFromName('japan'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method !== 'POST') return Response.json({ ok: true });
    if (url.pathname === '/look') {
      const box = env.BOX.get(env.BOX.idFromName('face' + Math.floor(Math.random() * (+env.BOXES || 2)))); // (two boxes, so a phone and the minute's sweep don't queue)
      return box.fetch(new Request('http://box/look' + url.search, { method: 'POST', body: req.body, headers: { 'content-type': 'application/octet-stream' } }));
    }
    return looks(env).fetch(new Request('http://looks' + url.pathname, { method: 'POST', body: req.body, headers: { 'content-type': 'application/json' } }));
  },
  async scheduled(ev, env, ctx) {
    if (!env.FACES_KEY || !env.SITE) return;
    ctx.waitUntil(fetch(env.SITE + '/api/photos/sweep', { method: 'POST', headers: { 'content-type': 'application/json', 'x-faces-key': env.FACES_KEY }, body: '{"trip":"japan"}' }).catch(() => {}));
  },
};
