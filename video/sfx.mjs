// node sfx.mjs  → public/audio/tick.wav, whoosh.wav
// The two sound effects the 4-feature video uses whatever its music is: a soft wooden tick for taps and an airy whoosh
// for the "next stop" splash. music.mjs and track.mjs both make them too, so either music workflow is complete.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'public/audio');
const SR = 48000;

function wav(file, x) {
  let peak = 1e-9; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = 0.89 / peak, body = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) body.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i] * g)) * 32767), i * 2);
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + body.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(body.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, body]));
}

export function makeSfx() {
  fs.mkdirSync(OUT, { recursive: true });
  const tick = new Float32Array(Math.round(0.08 * SR));
  for (let i = 0; i < tick.length; i++) { const s = i / SR; tick[i] = (Math.sin(2 * Math.PI * 1800 * s) * 0.6 + Math.sin(2 * Math.PI * 3100 * s) * 0.25) * Math.exp(-s * 90); }
  wav(path.join(OUT, 'tick.wav'), tick);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const wl = Math.round(0.55 * SR), whoosh = new Float32Array(wl); let y = 0;
  for (let i = 0; i < wl; i++) { const s = i / wl; const k = 0.02 + 0.5 * Math.sin(Math.PI * s) ** 2; y += k * (rnd() - y); whoosh[i] = y * Math.sin(Math.PI * s) ** 1.5; }
  wav(path.join(OUT, 'whoosh.wav'), whoosh);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { makeSfx(); console.log('tick.wav, whoosh.wav'); }
