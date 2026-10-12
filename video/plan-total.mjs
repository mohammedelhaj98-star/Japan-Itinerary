// prints the 4-feature video's timing (and its length), from the same plan the video uses
import fs from 'fs'; import { planFeature, planWithTrack, SCENES } from './src/featurePlan.js';
const vo = JSON.parse(fs.readFileSync('public/audio/vo.json', 'utf8'));
const tls = Object.fromEntries(SCENES.map((s) => [s.key, JSON.parse(fs.readFileSync(`public/clips/${s.key}/timeline.json`, 'utf8'))]));
const track = fs.existsSync('public/audio/track.json') ? JSON.parse(fs.readFileSync('public/audio/track.json', 'utf8')) : null;
const p = track ? planWithTrack(vo, tls, track) : planFeature(vo, tls);
console.log('total', p.total.toFixed(2), '| music from', (p.musicFrom || 0).toFixed(2), '| voice ends', p.voEnd.toFixed(2), '| title at', p.open.titleAt.toFixed(2));
for (const s of p.scenes) console.log(s.key.padEnd(11), 'splash', s.S.toFixed(2), 'ends', s.end.toFixed(2));
console.log('outro', p.outro.start.toFixed(2), '→', p.outro.end.toFixed(2));
