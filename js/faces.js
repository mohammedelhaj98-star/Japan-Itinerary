// Who's who in a photo, worked out on Mo's phone (and only there; nobody else's phone downloads any of this).
// face-api (vendor/face-api, MIT) finds the faces in a picture and turns each into 128 numbers, a face print: two photos
// of the same person give prints close together (a distance of about 0.3), two people far apart (about 0.8). The four
// of us are learned from photos someone tagged; the prints are kept by the server (/api/photos/prints in lib/photos.js),
// a few numbers a face and never the photos. A new face close enough to one person's prints is guessed as them, shown
// dotted until someone confirms it, like the other guesses. The model (~8 MB) downloads once, when it's switched on.
const MATCH = 0.5;  // a face this close to someone's prints is them
const LEARN = 0.45; // stricter when it's used to tell faces apart in a photo of several people we're learning from
const MARGIN = 0.04; // ...and clearly closer to them than to anyone else
const BIG = 0.04;   // a face narrower than this share of the photo is someone in the background: left out
const K = 200;      // prints are stored as whole numbers: value × K, in -127…127 (values stay within ±0.6)

let fa = null;
export function ready() {
  if (!fa) fa = (async () => {
    const m = await import('../vendor/face-api/face-api.esm.js');
    if (!(await m.tf.setBackend('webgl').catch(() => false))) await m.tf.setBackend('cpu'); // (the phone's graphics chip; a computer without one manages on its own)
    await m.tf.ready();
    const at = new URL('../vendor/face-api/model/', import.meta.url).href;
    await Promise.all([m.nets.tinyFaceDetector.loadFromUri(at), m.nets.faceLandmark68Net.loadFromUri(at), m.nets.faceRecognitionNet.loadFromUri(at)]);
    return m;
  })().catch((e) => { fa = null; throw e; });
  return fa;
}

// the faces in a picture (a file or a downloaded one), turned the way someone turned it (rot, clockwise): where each is,
// as shares of the width and height, and its print
export async function facesIn(blob, rot = 0) {
  const m = await ready();
  const bm = await createImageBitmap(blob);
  const k = Math.min(1, 800 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
  const w = Math.round(bm.width * k), h = Math.round(bm.height * k), q = rot % 180 !== 0; c.width = q ? h : w; c.height = q ? w : h;
  const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 180); g.drawImage(bm, -w / 2, -h / 2, w, h); if (bm.close) bm.close();
  const size = Math.max(160, Math.min(800, Math.ceil(Math.max(c.width, c.height) / 32) * 32)); // (the detector's own size, a multiple of 32)
  const found = await m.detectAllFaces(c, new m.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.35 })).withFaceLandmarks().withFaceDescriptors();
  return found.map((f) => { const b = f.detection.box; return { x: +(b.x / c.width).toFixed(3), y: +(b.y / c.height).toFixed(3), w: +(b.width / c.width).toFixed(3), h: +(b.height / c.height).toFixed(3), q: pack(f.descriptor) }; });
}

export const pack = (d) => btoa(String.fromCharCode(...Array.from(d, (v) => (Math.max(-127, Math.min(127, Math.round(v * K))) + 256) & 255)));
export const unpack = (q) => { const s = atob(q), d = new Float32Array(s.length); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); d[i] = (b > 127 ? b - 256 : b) / K; } return d; };
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
// the server's prints { by: { who: [{ id, q }] } } as numbers, ready to compare
export const vectors = (fp) => Object.fromEntries(Object.entries((fp && fp.by) || {}).map(([who, l]) => [who, l.map((x) => unpack(x.q))]));
const big = (f) => f.w >= BIG;

// each face given to at most one person (of who), closest first: [{ i (the face), who, d }]
export function assign(faces, prints, who, max = MATCH) {
  const pairs = [];
  faces.forEach((f, i) => {
    const v = unpack(f.q);
    const ds = who.filter((p) => prints[p] && prints[p].length).map((p) => ({ i, who: p, d: Math.min(...prints[p].map((x) => dist(v, x))) })).sort((a, b) => a.d - b.d);
    if (ds[0] && ds[0].d < max && (!ds[1] || ds[1].d - ds[0].d >= MARGIN)) pairs.push(ds[0]);
  });
  pairs.sort((a, b) => a.d - b.d); const fi = new Set(), pi = new Set(), out = [];
  for (const x of pairs) { if (fi.has(x.i) || pi.has(x.who)) continue; fi.add(x.i); pi.add(x.who); out.push(x); }
  return out;
}

// what a tagged photo teaches: whose face is whose, when that's certain. The one face when one person's tagged; with
// several, only when there are as many faces as people tagged and everyone but one at most is recognised already.
export function learnFrom(faces, tagged, prints) {
  const F = faces.filter(big); if (!F.length || F.length !== tagged.length) return [];
  if (F.length === 1) return [{ who: tagged[0], q: F[0].q }];
  const got = assign(F, prints, tagged, LEARN);
  if (got.length < F.length - 1) return [];
  const out = got.map((x) => ({ who: x.who, q: F[x.i].q }));
  if (got.length === F.length - 1) out.push({ who: tagged.find((p) => !got.some((x) => x.who === p)), q: F.find((_, i) => !got.some((x) => x.i === i)).q });
  return out;
}

// who's in a photo no one has checked, from its faces and who could be in it (who was at that stop). null: nothing to say.
// Everyone recognised: just them. Some faces unknown: the ones recognised, plus an earlier guess if it still fits.
export function nameFaces(faces, prints, could, cur = []) {
  const F = faces.filter(big); if (!F.length) return null;
  const got = assign(F, prints, could); if (!got.length) return null;
  const names = could.filter((p) => got.some((x) => x.who === p));
  if (got.length === F.length) return names;
  const u = could.filter((p) => names.includes(p) || cur.includes(p));
  return u.length <= F.length ? u : names;
}

/* what this phone already found in each photo, so a new face learned needs no photo looked at again (IndexedDB) */
const mem = new Map(); let db = null;
const open = () => (db = db || new Promise((ok, no) => { const r = indexedDB.open('faces', 1); r.onupgradeneeded = () => r.result.createObjectStore('seen'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }).catch(() => null));
const tx = async (mode, fn) => { const d = await open(); if (!d) return undefined; return new Promise((ok) => { const r = fn(d.transaction('seen', mode).objectStore('seen')); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); }); };
export async function seen(id) { if (mem.has(id)) return mem.get(id); const v = await tx('readonly', (s) => s.get(id)).catch(() => undefined); if (v) mem.set(id, v); return v || null; }
export async function remember(id, faces) { mem.set(id, faces); await tx('readwrite', (s) => s.put(faces, id)).catch(() => {}); }
