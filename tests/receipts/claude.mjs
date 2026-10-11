// Checks /api/scan with Claude reading the receipts (the real API route, run here, not on the site).
// Each receipt's total must be right, and its priced lines must match: the same prices, in any order
// (a small bag fee or a printed discount line may be extra; a receipt with no itemised lines can have none).
//   ANTHROPIC_API_KEY=… node tests/receipts/claude.mjs [model …]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { onRequest } = await import(path.join(HERE, '../../functions/api/[[path]].js'));
const truth = JSON.parse(fs.readFileSync(path.join(HERE, 'truth.json'), 'utf8'));
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['claude-opus-5-5'];
const kv = new Map(); const KV = { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); }, async list() { return { keys: [] }; } };
const linesOk = (got, want) => {
  const g = (got || []).map((l) => l.price).filter((p) => p > 10).sort((a, b) => a - b), w = [...want].sort((a, b) => a - b);
  return want.length ? JSON.stringify(g) === JSON.stringify(w) : g.length <= 1;
};
for (const model of models) {
  const env = { TRIP_KV: KV, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, SCAN_MODEL: model };
  const one = async (k) => {
    const t = truth[k], f = path.join(HERE, t.file), mime = f.endsWith('png') ? 'image/png' : 'image/jpeg';
    const photo = `data:${mime};base64,` + fs.readFileSync(f).toString('base64');
    const r = await (await onRequest({ request: new Request('http://x/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photo }) }), env })).json();
    return [k, r];
  };
  const res = await Promise.all(Object.keys(truth).map(one));
  let tot = 0, lin = 0, ms = 0; console.log(`\n${model}`);
  for (const [k, r] of res) {
    const t = truth[k], a = r.total === t.total, b = linesOk(r.lines, t.lines || []); tot += a; lin += b; ms += r.ms || 0;
    console.log(`${k.padEnd(10)} total ${a ? '✓' : '✗'} ${r.total} (want ${t.total})  lines ${b ? '✓' : '✗'} ${(r.lines || []).map((l) => l.price).join(' ')}  ${r.model}  ${((r.ms || 0) / 1000).toFixed(1)}s ${r.error || ''}`);
  }
  console.log(`totals ${tot}/${res.length} · lines ${lin}/${res.length} · average ${(ms / res.length / 1000).toFixed(1)}s`);
}
