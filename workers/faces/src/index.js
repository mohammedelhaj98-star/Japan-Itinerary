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
import { Container, getRandom } from '@cloudflare/containers';
import { DurableObject } from 'cloudflare:workers';

export class FaceBox extends Container {
  defaultPort = 8080;
  sleepAfter = '5m'; // (asleep costs nothing; waking takes a few seconds)
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
      const box = await getRandom(env.BOX, +env.BOXES || 2); // (two boxes, so a phone and the minute's sweep don't queue)
      return box.fetch(new Request('http://box/look' + url.search, { method: 'POST', body: req.body, headers: { 'content-type': 'application/octet-stream' } }));
    }
    return looks(env).fetch(new Request('http://looks' + url.pathname, { method: 'POST', body: req.body, headers: { 'content-type': 'application/json' } }));
  },
  async scheduled(ev, env, ctx) {
    if (!env.FACES_KEY || !env.SITE) return;
    ctx.waitUntil(fetch(env.SITE + '/api/photos/sweep', { method: 'POST', headers: { 'content-type': 'application/json', 'x-faces-key': env.FACES_KEY }, body: '{"trip":"japan"}' }).catch(() => {}));
  },
};
