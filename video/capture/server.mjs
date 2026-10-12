// Serves the built site (dist/) with the real API on an in-memory store, like tests/tour.mjs does.
// Recordings run against this, never against ourtrips.date.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { pathToFileURL } from 'url';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

// PORT picks the port (so several recordings can run side by side); SKIP_BUILD=1 reuses an existing dist/
export async function startServer(REPO, { port = Number(process.env.PORT) || 8797, seed = {} } = {}) {
  if (process.env.SKIP_BUILD !== '1' || !fs.existsSync(REPO + '/dist/japan/index.html')) execSync('bash scripts/deploy.sh', { cwd: REPO, stdio: 'ignore', env: { ...process.env, BUILD_ONLY: '1' } });
  const DIST = REPO + '/dist';
  const { onRequest } = await import(pathToFileURL(REPO + '/functions/api/[[path]].js').href + '?' + Date.now());
  const kv = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const KV = {
    async get(k, t) { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); },
    async list({ prefix = '' } = {}) { return { keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${port}`);
    if (u.pathname.startsWith('/api/')) {
      const ch = []; for await (const c of req) ch.push(c);
      const r = await onRequest({ request: new Request(u, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(ch) : undefined }), env: { TRIP_KV: KV } });
      res.writeHead(r.status, { 'content-type': 'application/json' }); return res.end(await r.text());
    }
    const p = decodeURIComponent(u.pathname); let f = path.join(DIST, p);
    if (p.endsWith('/')) f = path.join(f, 'index.html'); else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(port, r));
  return { url: `http://localhost:${port}`, kv, close: () => server.close() };
}
