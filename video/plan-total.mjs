// prints the 4-feature video's timing (and its length), from the same plan the video uses
import fs from 'fs'; import { planFeature, SCENES } from './src/featurePlan.js';
const vo = JSON.parse(fs.readFileSync('public/audio/vo.json', 'utf8'));
const tls = Object.fromEntries(SCENES.map((s) => [s.key, JSON.parse(fs.readFileSync(`public/clips/${s.key}/timeline.json`, 'utf8'))]));
const p = planFeature(vo, tls);
console.log('total', p.total.toFixed(2), '| title at', p.open.titleAt, '| open ends', p.open.end);
for (const s of p.scenes) console.log(s.key.padEnd(11), 'splash', s.S.toFixed(2), 'plays', s.P.toFixed(2), 'ends', s.end.toFixed(2), '| beats', s.beats.map((b) => `${b.label} clip ${b.seg.toFixed(1)} / shown ${b.D.toFixed(1)}`).join(', '));
console.log('outro', p.outro.start, '→', p.outro.end);
