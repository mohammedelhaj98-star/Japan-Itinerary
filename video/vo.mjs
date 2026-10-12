// node vo.mjs  → public/audio/vo.wav + public/audio/vo.json
// Tightens Mo's voiceover (public/audio/vo-raw.mp3): each script line is cut out at its pauses, long gaps inside a
// line are shortened, the lines are laid end to end, then the whole thing is sped up a touch (pitch kept) and its
// loudness evened out for phone speakers. vo.json says where every line sits, so the video can place each one
// exactly where its picture needs it.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG || ['compositor-win32-x64-msvc/ffmpeg.exe', 'compositor-linux-x64-gnu/ffmpeg', 'compositor-darwin-arm64/ffmpeg'].map((p) => path.join(HERE, 'node_modules/@remotion', p)).find((p) => fs.existsSync(p)) || 'ffmpeg';
const RAW = path.join(HERE, 'public/audio/vo-raw.mp3'), OUT = path.join(HERE, 'public/audio');
const SR = 48000, TEMPO = 1.05, MAX_GAP = 0.2, SPACER = 0.5;

// each script line in the raw recording [start, end] seconds, found from its pauses (silencedetect at -38 dB)
export const LINES = [
  { id: 'open', scene: 0, at: [0.95, 8.89], text: "Japan, four of us, seventeen days. Here are four things on our trip site that'll save us a lot of hassle." },
  { id: 'dial-1', scene: 1, at: [10.23, 15.31], text: "Day seven, Osaka. Lunch ran long and someone asks: what's next, and how long have we got?" },
  { id: 'dial-2', scene: 1, at: [17.97, 23.68], text: 'Open the day panel and the whole day is a clock. The red tick is right now.' },
  { id: 'dial-3', scene: 1, at: [24.64, 28.95], text: "Drag the sun forward and it shows you what's on at any time, and when it starts." },
  { id: 'rcpt-1', scene: 2, at: [30.46, 33.72], text: "Ramen at Ichiran. Mo paid, and the bill's in Japanese. Easy." },
  { id: 'rcpt-2', scene: 2, at: [34.16, 40.69], text: 'Tap yen-plus, then Scan, and snap the receipt. The total and the shop fill themselves in.' },
  { id: 'rcpt-3', scene: 2, at: [41.52, 47.52], text: 'Naf had the extra noodles and the egg? Split by item, tap his name on those, and the rest is shared.' },
  { id: 'rcpt-4', scene: 2, at: [49.19, 52.06], text: 'Add it, and nobody has to do the maths.' },
  { id: 'settle-1', scene: 3, at: [54.18, 57.90], text: 'Last night of the trip. The big question: who owes who?' },
  { id: 'settle-2', scene: 3, at: [59.17, 64.74], text: 'Settle up works it out for everyone, between the couples or person to person.' },
  { id: 'settle-3', scene: 3, at: [64.97, 70.02], text: "Naf pays Mo back? Tap Paid, and you're square on all four phones." },
  { id: 'photo-1', scene: 4, at: [74.96, 77.13], text: "And the thousand photos we'll all take?" },
  { id: 'photo-2', scene: 4, at: [77.70, 81.90], text: 'Upload them, and each one is filed under the right day and stop by itself.' },
  { id: 'photo-3', scene: 4, at: [82.44, 86.59], text: 'Then tap Relive to play the whole day back, stop by stop.' },
  { id: 'outro', scene: 5, at: [90.04, 96.22], text: "That's it. All on ourtrips.date. Have a great trip." },
];

{
  // this ffmpeg has no raw-float output, so go through 16-bit WAV both ways
  const wav = execFileSync(FF, ['-loglevel', 'error', '-i', RAW, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', '-f', 'wav', '-'], { maxBuffer: 1 << 30 });
  let d = 12; while (wav.toString('latin1', d, d + 4) !== 'data') d += 8 + wav.readUInt32LE(d + 4);
  const n16 = Math.floor((wav.length - d - 8) / 2), x = new Float32Array(n16);
  for (let i = 0; i < n16; i++) x[i] = wav.readInt16LE(d + 8 + i * 2) / 32768;
  const win = Math.round(0.02 * SR), quiet = Math.pow(10, -40 / 20);
  const chunks = [], lines = []; let pos = 0;
  for (const L of LINES) {
    const a = Math.max(0, Math.round((L.at[0] - 0.08) * SR)), b = Math.min(x.length, Math.round((L.at[1] + 0.14) * SR));
    // walk the line in 20 ms windows and drop the middle of any quiet stretch longer than MAX_GAP
    const keep = []; let run = 0;
    for (let i = a; i < b; i += win) {
      const seg = x.subarray(i, Math.min(b, i + win)); let s = 0; for (const v of seg) s += v * v;
      const isQuiet = Math.sqrt(s / seg.length) < quiet;
      run = isQuiet ? run + 1 : 0;
      if (!isQuiet || run * 0.02 <= MAX_GAP) keep.push(seg);
    }
    const len = keep.reduce((n, s) => n + s.length, 0), buf = new Float32Array(len); let o = 0;
    for (const s of keep) { buf.set(s, o); o += s.length; }
    // 10 ms fades at the cut points, so nothing clicks
    const f = Math.round(0.01 * SR); for (let i = 0; i < f && i < len; i++) { buf[i] *= i / f; buf[len - 1 - i] *= i / f; }
    lines.push({ id: L.id, scene: L.scene, text: L.text, start: pos / SR, end: (pos + len) / SR });
    chunks.push(buf, new Float32Array(Math.round(SPACER * SR))); pos += len + Math.round(SPACER * SR);
  }
  const all = new Float32Array(pos); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const tmp = path.join(OUT, 'vo-tight.wav'), body = Buffer.alloc(all.length * 2);
  for (let i = 0; i < all.length; i++) body.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(all[i] * 32767))), i * 2);
  const hd = Buffer.alloc(44); hd.write('RIFF', 0); hd.writeUInt32LE(36 + body.length, 4); hd.write('WAVEfmt ', 8); hd.writeUInt32LE(16, 16); hd.writeUInt16LE(1, 20); hd.writeUInt16LE(1, 22); hd.writeUInt32LE(SR, 24); hd.writeUInt32LE(SR * 2, 28); hd.writeUInt16LE(2, 32); hd.writeUInt16LE(16, 34); hd.write('data', 36); hd.writeUInt32LE(body.length, 40);
  fs.writeFileSync(tmp, Buffer.concat([hd, body]));
  execFileSync(FF, ['-loglevel', 'error', '-y', '-i', tmp, '-af', `atempo=${TEMPO},loudnorm=I=-15:TP=-1.5:LRA=9`, '-ar', String(SR), '-c:a', 'pcm_s16le', path.join(OUT, 'vo.wav')]);
  fs.rmSync(tmp);
  const out = lines.map((l) => ({ ...l, start: +(l.start / TEMPO).toFixed(3), end: +(l.end / TEMPO).toFixed(3) }));
  fs.writeFileSync(path.join(OUT, 'vo.json'), JSON.stringify(out, null, 2));
  for (const l of out) console.log(l.id.padEnd(9), (l.end - l.start).toFixed(2) + ' s');
  console.log('raw speech', LINES.reduce((n, l) => n + l.at[1] - l.at[0], 0).toFixed(1), 's → tight', out.reduce((n, l) => n + l.end - l.start, 0).toFixed(1), 's');
}
