// node music.mjs [seconds]  → public/audio/music.wav (and tick.wav, whoosh.wav via sfx.mjs)
// A stand-in backing track made from scratch (so there are no licence questions): a light, bouncy 120 BPM groove
// in G (G–D–Em–C) with kick, clap, shaker, plucked bass, offbeat chord stabs and a bell melody, plus a soft tick
// for taps and a whoosh for the station splashes. Swap music.wav for a real track any time.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url'; import { makeSfx } from './sfx.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'public/audio');
const FF = process.env.FFMPEG || ['compositor-win32-x64-msvc/ffmpeg.exe', 'compositor-linux-x64-gnu/ffmpeg', 'compositor-darwin-arm64/ffmpeg'].map((p) => path.join(HERE, 'node_modules/@remotion', p)).find((p) => fs.existsSync(p)) || 'ffmpeg';
const SR = 48000, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;
const secs = Number(process.argv[2]) || 96;
const N = Math.ceil(secs * SR), L = new Float32Array(N), R = new Float32Array(N);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (t, len, fn, gain = 1, pan = 0) => {
  const a = Math.round(t * SR), n = Math.round(len * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < n && a + i < N; i++) { const v = fn(i / SR); L[a + i] += v * gl; R[a + i] += v * gr; }
};
// a one-pole low-pass, for softening noise
const lp = (k) => { let y = 0; return (x) => (y += k * (x - y)); };

// instruments
const kick = (t) => add(t, 0.32, (s) => Math.sin(2 * Math.PI * (45 * s + (75 / 18) * (1 - Math.exp(-18 * s)))) * Math.exp(-9 * s), 0.9);
const clap = (t) => { const f = lp(0.35); add(t, 0.22, (s) => { const e = s < 0.03 ? Math.exp(-((s % 0.01) * 300)) : Math.exp(-(s - 0.03) * 22); const n = rnd(); return (n - f(n)) * e; }, 0.42, 0.05); };
const shaker = (t, g) => { const f = lp(0.6); add(t, 0.07, (s) => { const n = rnd(); return (n - f(n)) * Math.exp(-s * 70); }, g, 0.25); };
const bass = (t, m, len) => add(t, len, (s) => { const p = 2 * Math.PI * hz(m) * s; const env = Math.min(1, s * 200) * Math.exp(-s * 3.2); return (Math.sin(p) + 0.35 * Math.sin(2 * p) + 0.12 * Math.sin(3 * p)) * env; }, 0.42);
const stab = (t, notes) => notes.forEach((m, i) => add(t, 0.22, (s) => { const p = 2 * Math.PI * hz(m) * s; const env = Math.min(1, s * 300) * Math.exp(-s * 14); return (Math.sin(p) + 0.3 * Math.sin(3 * p) + 0.15 * Math.sin(5 * p)) * env; }, 0.09, i % 2 ? 0.35 : -0.35));
const bell = (t, m, g = 0.13) => add(t, 0.9, (s) => { const p = 2 * Math.PI * hz(m) * s; return (Math.sin(p) + 0.4 * Math.sin(2.01 * p) * Math.exp(-s * 6) + 0.2 * Math.sin(4.2 * p) * Math.exp(-s * 12)) * Math.min(1, s * 400) * Math.exp(-s * 4); }, g, 0.15);

// the song: 4-bar loop G D Em C, sections build up and drop for the ending
const CHORDS = [[55, [67, 71, 74]], [50, [66, 69, 74]], [52, [67, 71, 76]], [48, [67, 72, 76]]];
const MELODY = [79, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 74, 71, 0, 74, 0, 76, 0, 79, 76, 74, 0, 71, 74, 72, 0, 74, 76, 79, 0, 0, 0];
const bars = Math.ceil(secs / BAR);
for (let b = 0; b < bars; b++) {
  const t0 = b * BAR, [root, notes] = CHORDS[b % 4], last = b >= bars - 1;
  const full = b >= 2 && !last, lead = b >= 6 && b % 16 < 12 && !last;
  for (let q = 0; q < 4; q++) {
    const t = t0 + q * BEAT;
    if (full || q === 0) { if (q === 0 || q === 2 || (full && q === 3 && b % 2 === 1)) kick(q === 3 ? t + BEAT / 2 : t); }
    if (full && (q === 1 || q === 3)) clap(t);
    if (!last) stab(t + BEAT / 2, notes);
    for (let e = 0; e < 4; e++) if (b >= 1 && !last) shaker(t + e * BEAT / 4, e === 2 ? 0.16 : 0.08);
    if (b >= 1 && !last) { bass(t, root - 12, BEAT * 0.45); bass(t + BEAT / 2, (q % 2 ? root : root - 12), BEAT * 0.4); }
  }
  if (lead) for (let i = 0; i < 8; i++) { const m = MELODY[((b % 4) * 8 + i) % MELODY.length]; if (m) bell(t0 + i * BEAT / 2, m); }
  if (last) { kick(t0); stab(t0, notes); bell(t0, 79, 0.18); bass(t0, root - 12, 1.2); }
}
// a little pump on everything from the kick, for energy
for (let i = 0; i < N; i++) { const ph = ((i / SR) % BEAT) / BEAT; const pump = 0.78 + 0.22 * Math.min(1, ph * 5); L[i] *= pump; R[i] *= pump; }

function wav(file, chans) {
  const n = chans[0].length, c = chans.length, body = Buffer.alloc(n * c * 2);
  let peak = 1e-9; for (const ch of chans) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const g = 0.89 / peak;
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) body.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chans[k][i] * g)) * 32767), (i * c + k) * 2);
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + body.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(c, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * c * 2, 28); h.writeUInt16LE(c * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(body.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, body]));
}
fs.mkdirSync(OUT, { recursive: true });
const raw = path.join(OUT, 'music-raw.wav'); wav(raw, [L, R]);
execFileSync(FF, ['-loglevel', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-17:TP=-1.5:LRA=7', '-ar', String(SR), '-c:a', 'pcm_s16le', path.join(OUT, 'music.wav')]); fs.rmSync(raw);

makeSfx(); // the tick and whoosh (sfx.mjs)
console.log('music.wav', secs, 's at', BPM, 'BPM; tick.wav, whoosh.wav');
