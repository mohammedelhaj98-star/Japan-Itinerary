// node track.mjs public/audio/track-raw.wav  → public/audio/track.wav + track.json (+ tick.wav, whoosh.wav via sfx.mjs)
// Prepares a bought music track for the 4-feature video: evens its loudness out to sit under the voice like the
// stand-in does, and finds its tempo and where its beats fall (from the rhythm of its loudness), so the video can
// start it on a bar line and land its natural ending on the last word.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url'; import { makeSfx } from './sfx.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'public/audio');
const FF = process.env.FFMPEG || ['compositor-win32-x64-msvc/ffmpeg.exe', 'compositor-linux-x64-gnu/ffmpeg', 'compositor-darwin-arm64/ffmpeg'].map((p) => path.join(HERE, 'node_modules/@remotion', p)).find((p) => fs.existsSync(p)) || 'ffmpeg';
const src = process.argv[2] || path.join(OUT, 'track-raw.wav');

// 1. loudness to match the stand-in (-17 LUFS), 48 kHz stereo
execFileSync(FF, ['-loglevel', 'error', '-y', '-i', src, '-af', 'loudnorm=I=-17:TP=-1.5:LRA=9', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(OUT, 'track.wav')]);

// 2. tempo and beat positions from an onset envelope (rises in loudness, every ~11.6 ms)
const SR = 22050, HOP = 128;
const wav = execFileSync(FF, ['-loglevel', 'error', '-i', src, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', '-f', 'wav', '-'], { maxBuffer: 1 << 30 });
let d = 12; while (wav.toString('latin1', d, d + 4) !== 'data') d += 8 + wav.readUInt32LE(d + 4);
const n = Math.floor((wav.length - d - 8) / 2), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = wav.readInt16LE(d + 8 + i * 2) / 32768;
const frames = Math.floor(n / HOP), env = new Float32Array(frames);
for (let f = 0; f < frames; f++) { let s = 0; for (let i = f * HOP; i < (f + 1) * HOP; i++) s += x[i] * x[i]; env[f] = Math.log(1e-6 + s); }
const on = new Float32Array(frames); for (let f = 1; f < frames; f++) on[f] = Math.max(0, env[f] - env[f - 1]);
const fps = SR / HOP;
// score a tempo by how much onset energy lands on its best-aligned grid: coarse sweep, then fine around the winner
const fit = (bpm) => { const lag = (60 / bpm) * fps; let best = { s: -1, off: 0 }; for (let p = 0; p < lag; p += 0.5) { let s = 0; for (let f = p; f < frames; f += lag) s += Math.max(on[Math.round(f)] || 0, on[Math.round(f) + 1] || 0); if (s > best.s) best = { s, off: p / fps }; } return best; };
let best = { bpm: 120, s: -1, off: 0 };
for (let bpm = 80; bpm <= 160; bpm += 0.25) { const r = fit(bpm); if (r.s > best.s) best = { bpm, ...r }; }
for (let bpm = best.bpm - 0.3; bpm <= best.bpm + 0.3; bpm += 0.01) { const r = fit(bpm); if (r.s > best.s) best = { bpm, ...r }; }
const beat = 60 / best.bpm, phase = { off: best.off };
// which of the four beats starts the bar: the loudest of the four, on average
const bar = [0, 0, 0, 0]; for (let k = 0; phase.off + k * beat < n / SR; k++) { const f = Math.round((phase.off + k * beat) * fps); bar[k % 4] += Math.max(on[f] || 0, on[f + 1] || 0); }
const down = bar.indexOf(Math.max(...bar));
const ends = n / SR; let last = frames - 1; while (last > 0 && env[last] < Math.log(1e-6 + HOP * 1e-6)) last--;
const info = { bpm: +best.bpm.toFixed(2), beat: +beat.toFixed(5), firstDownbeat: +(phase.off + down * beat).toFixed(4), duration: +ends.toFixed(3), soundEnds: +((last * HOP) / SR).toFixed(3) };
fs.writeFileSync(path.join(OUT, 'track.json'), JSON.stringify(info, null, 2));
makeSfx(); // the tick and whoosh the video also needs
console.log(info, '+ tick.wav, whoosh.wav');
