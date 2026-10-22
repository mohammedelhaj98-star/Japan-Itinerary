// Who's who in a photo, worked out on Mo's phone (and only there; nobody else's phone downloads any of this).
// face-api (vendor/face-api, MIT) finds the faces in a picture and turns each into 128 numbers, a face print: two photos
// of the same person give prints close together (a distance of about 0.3), two people far apart (about 0.8). The four
// of us are learned from photos of one person that someone tagged; the prints are kept by the server (/api/photos/prints in lib/photos.js),
// a few numbers a face and never the photos. A new face close enough to one person's prints is guessed as them, shown
// dotted until someone confirms it, like the other guesses. The model (~8 MB) downloads once, when it's switched on.
export const VERSION = 2; // how it learns; a newer one starts learning again (v2: one-person photos only, surer matches)
const MATCH = 0.42;  // a face this close to someone's prints (the mean of the nearest three) is them
const MARGIN = 0.08; // ...and clearly closer to them than to anyone else
const BIG = 0.04;    // a face narrower than this share of the photo is someone in the background: left out
const TEACH = 0.07;  // a face it learns from is at least this wide: the photo is of them
const K = 200;      // prints are stored as whole numbers: value × K, in -127…127 (values stay within ±0.6)

let fa = null, body = null;
export function ready() {
  if (!fa) fa = (async () => {
    const m = await import('../vendor/face-api/face-api.esm.js');
    if (!(await m.tf.setBackend('webgl').catch(() => false))) await m.tf.setBackend('cpu'); // (the phone's graphics chip; a computer without one manages on its own)
    await m.tf.ready();
    const at = new URL('../vendor/face-api/model/', import.meta.url).href;
    await Promise.all([m.nets.tinyFaceDetector.loadFromUri(at), m.nets.faceLandmark68Net.loadFromUri(at), m.nets.faceRecognitionNet.loadFromUri(at)]);
    // and a model that finds whole people (vendor/person, ~18 MB), for someone whose face doesn't show; faces work without it
    body = await m.tf.loadGraphModel(new URL('../vendor/person/model.json', import.meta.url).href).catch(() => null);
    return m;
  })().catch((e) => { fa = null; throw e; });
  return fa;
}

const r3 = (v) => +v.toFixed(3);
// what's in a picture (a file or a downloaded one), turned the way someone turned it (rot, clockwise):
// f: the faces, each where it is (shares of the width and height) and its print
// b: the people, each where they are, what they're wearing (o, the colours of their top half) and their face (fi, or -1)
export async function look(blob, rot = 0) {
  const m = await ready();
  const bm = await createImageBitmap(blob);
  const k = Math.min(1, 800 / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
  const w = Math.round(bm.width * k), h = Math.round(bm.height * k), q = rot % 180 !== 0; c.width = q ? h : w; c.height = q ? w : h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.translate(c.width / 2, c.height / 2); g.rotate((rot * Math.PI) / 180); g.drawImage(bm, -w / 2, -h / 2, w, h); g.setTransform(1, 0, 0, 1, 0, 0); if (bm.close) bm.close();
  const size = Math.max(160, Math.min(800, Math.ceil(Math.max(c.width, c.height) / 32) * 32)); // (the detector's own size, a multiple of 32)
  const found = await m.detectAllFaces(c, new m.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.35 })).withFaceLandmarks().withFaceDescriptors();
  const f = found.map((x) => { const b = x.detection.box; return { x: r3(b.x / c.width), y: r3(b.y / c.height), w: r3(b.width / c.width), h: r3(b.height / c.height), q: pack(x.descriptor) }; });
  const b = (await people(m.tf, c).catch(() => [])).map((p) => {
    // their face: one whose middle is in the top part of them (the smallest such person, when people overlap)
    const fi = f.findIndex((x) => { const cx = x.x + x.w / 2, cy = x.y + x.h / 2; return cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h * 0.45; });
    return { ...p, o: outfit(g, c, p, fi >= 0 ? f[fi] : null), fi };
  });
  return { f, b };
}
// the people in a picture (COCO's class 1), as boxes of shares of the width and height. As tfjs-models' coco-ssd does it.
async function people(tf, c) {
  if (!body) return [];
  const x = tf.tidy(() => tf.expandDims(tf.browser.fromPixels(c)));
  const out = await body.executeAsync(x); x.dispose();
  const sc = await out[0].data(), bx = await out[1].data(), n = out[0].shape[1], nc = out[0].shape[2]; tf.dispose(out);
  const idx = [], score = []; for (let i = 0; i < n; i++) { const s = sc[i * nc]; if (s >= 0.5) { idx.push(i); score.push(s); } } // class 0 here is "person"
  if (!idx.length) return [];
  const boxes = tf.tensor2d(idx.flatMap((i) => [bx[i * 4], bx[i * 4 + 1], bx[i * 4 + 2], bx[i * 4 + 3]]), [idx.length, 4]);
  const keep = await tf.image.nonMaxSuppressionAsync(boxes, score, 12, 0.5, 0.5); const kept = await keep.data(); boxes.dispose(); keep.dispose();
  return [...kept].map((j) => { const i = idx[j], y0 = Math.max(0, bx[i * 4]), x0 = Math.max(0, bx[i * 4 + 1]), y1 = Math.min(1, bx[i * 4 + 2]), x1 = Math.min(1, bx[i * 4 + 3]); return { x: r3(x0), y: r3(y0), w: r3(x1 - x0), h: r3(y1 - y0), s: r3(score[j]) }; });
}
// what someone's wearing: the colours of their top half, below the face (or the head), as 28 shares:
// 12 hues × 2 strengths for colours, and 4 shades of grey for black, grey and white
const BINS = 28;
function outfit(g, c, p, face) {
  const top = face ? Math.min(p.y + p.h, face.y + face.h * 1.3) : p.y + p.h * 0.22, bot = Math.min(p.y + p.h, top + p.h * 0.35);
  const x0 = p.x + p.w * 0.2, x1 = p.x + p.w * 0.8; if (bot - top < 0.02 || x1 - x0 < 0.02) return null;
  const sw = Math.max(1, Math.round((x1 - x0) * c.width)), sh = Math.max(1, Math.round((bot - top) * c.height));
  const d = g.getImageData(Math.round(x0 * c.width), Math.round(top * c.height), sw, sh).data, hist = new Float32Array(BINS);
  const step = Math.max(1, Math.floor((sw * sh) / 2500)) * 4; // (a few thousand pixels are plenty)
  for (let i = 0; i < d.length; i += step) {
    const r = d[i] / 255, gg = d[i + 1] / 255, bb = d[i + 2] / 255, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), v = mx, sat = mx ? (mx - mn) / mx : 0;
    if (sat < 0.22 || v < 0.18) { hist[24 + Math.min(3, Math.floor(v * 4))]++; continue; }
    let hue = mx === r ? (gg - bb) / (mx - mn) : mx === gg ? 2 + (bb - r) / (mx - mn) : 4 + (r - gg) / (mx - mn); hue = ((hue * 60) + 360) % 360;
    hist[Math.floor(hue / 30) * 2 + (sat > 0.55 ? 1 : 0)]++;
  }
  const tot = hist.reduce((a, x) => a + x, 0) || 1;
  return btoa(String.fromCharCode(...Array.from(hist, (x) => Math.round((x / tot) * 255))));
}
// how alike two outfits are: 1 the same colours, 0 nothing in common (Bhattacharyya)
export function alike(a, b) {
  if (!a || !b) return 0; const x = atob(a), y = atob(b); let s = 0;
  for (let i = 0; i < BINS; i++) s += Math.sqrt((x.charCodeAt(i) / 255) * (y.charCodeAt(i) / 255));
  return s;
}
// (just the faces, as before)
export async function facesIn(blob, rot = 0) { return (await look(blob, rot)).f; }

export const pack = (d) => btoa(String.fromCharCode(...Array.from(d, (v) => (Math.max(-127, Math.min(127, Math.round(v * K))) + 256) & 255)));
export const unpack = (q) => { const s = atob(q), d = new Float32Array(s.length); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); d[i] = (b > 127 ? b - 256 : b) / K; } return d; };
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
// the server's prints { by: { who: [{ id, q }] } } as numbers, ready to compare
export const vectors = (fp) => Object.fromEntries(Object.entries((fp && fp.by) || {}).map(([who, l]) => [who, l.map((x) => unpack(x.q))]));
const big = (f) => f.w >= BIG;
export const hasFaces = (faces) => !!faces && faces.some(big);
// how like someone a face is: the mean distance to their nearest three prints (one odd print can't sway it)
const score = (v, ps) => { const d = ps.map((x) => dist(v, x)).sort((a, b) => a - b).slice(0, 3); return d.reduce((a, b) => a + b, 0) / d.length; };

// each face given to at most one person (of who), closest first: [{ i (the face), who, d }]
export function assign(faces, prints, who, max = MATCH) {
  const pairs = [];
  faces.forEach((f, i) => {
    const v = unpack(f.q);
    const ds = who.filter((p) => prints[p] && prints[p].length).map((p) => ({ i, who: p, d: score(v, prints[p]) })).sort((a, b) => a.d - b.d);
    if (ds[0] && ds[0].d < max && (!ds[1] || ds[1].d - ds[0].d >= MARGIN)) pairs.push(ds[0]);
  });
  pairs.sort((a, b) => a.d - b.d); const fi = new Set(), pi = new Set(), out = [];
  for (const x of pairs) { if (fi.has(x.i) || pi.has(x.who)) continue; fi.add(x.i); pi.add(x.who); out.push(x); }
  return out;
}

// what a tagged photo teaches: only a photo of one person, with one face big enough to be theirs, and not a face that
// looks more like someone else we know (a stranger in front, or the wrong person tagged)
export function learnFrom(faces, tagged, prints) {
  if (tagged.length !== 1) return [];
  const F = faces.filter(big); if (F.length !== 1 || F[0].w < TEACH) return [];
  const who = tagged[0], v = unpack(F[0].q);
  const own = (prints[who] || []).length >= 2 ? score(v, prints[who]) : null;
  const other = Math.min(Infinity, ...Object.entries(prints).filter(([p, ps]) => p !== who && ps.length).map(([, ps]) => score(v, ps)));
  if (other < MATCH && (own === null || other < own)) return [];
  return [{ who, q: F[0].q }];
}

// prints that look more like someone else than the person they were learned as: the photo ids, to forget
export function suspects(fp) {
  const V = Object.fromEntries(Object.entries((fp && fp.by) || {}).map(([who, l]) => [who, l.map((x) => ({ id: x.id, v: unpack(x.q) }))])), out = new Set();
  for (const [who, l] of Object.entries(V)) for (const x of l) {
    const rest = l.filter((y) => y !== x).map((y) => y.v); const own = rest.length ? score(x.v, rest) : Infinity;
    const other = Math.min(Infinity, ...Object.entries(V).filter(([p, m]) => p !== who && m.length).map(([, m]) => score(x.v, m.map((y) => y.v))));
    if (other < MATCH && other < own) out.add(x.id);
  }
  return [...out];
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

// a photo one of us tagged where a face is surely someone not tagged: { seen: [them], instead: the one tagged person no face
// was theirs, if there's just one } (so "looks like Mo, not Mariam"); null when the faces agree. Faces only: a tagged person
// who can't be seen (turned away, cut off, blurry) is never questioned.
export function doubts(L, prints, tagged, everyone) {
  const F = L.f.filter(big); if (!F.length) return null;
  const got = assign(F, prints, everyone), seen = got.filter((x) => !tagged.includes(x.who)).map((x) => x.who);
  if (!seen.length) return null;
  const missing = tagged.filter((p) => !got.some((x) => x.who === p));
  return { seen: everyone.filter((p) => seen.includes(p)), instead: seen.length === 1 && missing.length === 1 && F.length <= tagged.length ? missing[0] : null };
}

/* ── what someone's wearing, for whoever's face doesn't settle it (blurry, side-on, turned away) ── */
const DRESS = 0.88;     // a top half this alike (see alike) is the same outfit
const DRESS_GAP = 0.08; // ...and clearly more like one person's outfit than anyone else's that day
const tall = (p) => p.h >= 0.25 && !!p.o; // someone the photo is of, not a passer-by
// who's wearing what, from one photo: people whose face was recognised (among who), or, in a photo one of us tagged with
// one person and showing one person, them
export function outfitsIn(L, prints, who, tagged) {
  if (!L || !L.b) return [];
  if (tagged && who.length === 1) { const B = L.b.filter(tall); return B.length === 1 ? [{ who: who[0], o: B[0].o }] : []; }
  const F = L.f.filter(big);
  return assign(F, prints, who).map((x) => ({ x, p: L.b.find((b) => tall(b) && b.fi === L.f.indexOf(F[x.i])) })).filter((y) => y.p).map((y) => ({ who: y.x.who, o: y.p.o })); // (someone half hidden behind another: their colours are partly the other's)
}
// who's in a photo no one has checked, from its faces, then what the people whose face didn't settle it are wearing,
// against what each of us wore that day (worn: { who: [outfits] }). Among who could be in it. null: nothing to say.
// Everyone accounted for: just them. Some not: the ones named, plus an earlier guess if it still fits.
export function nameAll(L, prints, could, cur = [], worn = {}) {
  const F = L.f.filter(big), got = assign(F, prints, could), named = new Set(got.map((x) => x.who));
  const known = new Set(got.map((x) => L.f.indexOf(F[x.i])));
  const B = (L.b || []).filter((p) => tall(p) && !(p.fi >= 0 && known.has(p.fi)));
  const opts = could.filter((w) => (worn[w] || []).length), picks = [];
  for (const p of B) {
    const ss = opts.map((w) => ({ who: w, s: Math.max(...worn[w].map((o) => alike(p.o, o))) })).sort((a, b) => b.s - a.s);
    if (ss[0] && ss[0].s >= DRESS && (!ss[1] || ss[0].s - ss[1].s >= DRESS_GAP)) picks.push(ss[0]); // (two outfits alike: no name)
  }
  picks.sort((a, b) => b.s - a.s); for (const x of picks) named.add(x.who); // (the best match for someone already named adds no one)
  if (!named.size) return null;
  const names = could.filter((p) => named.has(p)), n = Math.max(F.length, (L.b || []).filter(tall).length);
  if (names.length >= n) return names;
  const u = could.filter((p) => named.has(p) || cur.includes(p));
  return u.length <= n ? u : names;
}

/* what this phone already found in each photo, so a new face learned needs no photo looked at again (IndexedDB) */
const mem = new Map(); let db = null;
const open = () => (db = db || new Promise((ok, no) => { const r = indexedDB.open('faces', 1); r.onupgradeneeded = () => r.result.createObjectStore('seen'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }).catch(() => null));
const tx = async (mode, fn) => { const d = await open(); if (!d) return undefined; return new Promise((ok) => { const r = fn(d.transaction('seen', mode).objectStore('seen')); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); }); };
export async function seen(id) { if (mem.has(id)) return mem.get(id); const v = await tx('readonly', (s) => s.get(id)).catch(() => undefined); if (v) mem.set(id, v); return v || null; }
export async function remember(id, faces) { mem.set(id, faces); await tx('readwrite', (s) => s.put(faces, id)).catch(() => {}); }
