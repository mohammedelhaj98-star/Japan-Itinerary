// Who's who in a photo, worked out on the phones from what the faces server found in it (no model on the phone).
// The server (workers/faces: InsightFace, open source) finds the faces in a picture and turns each into 512 numbers, a
// face print: two photos of the same person give prints close together (a distance of about 1 or less), two people
// far apart (about 1.4). It also finds the people in it, and what each is wearing (the colours of their top half).
// The four of us are learned from photos someone tagged (photos of one of us, and group photos); the prints are kept by the server
// (/api/photos/prints in lib/photos.js), a few numbers a face and never the photos. A new face close enough to one
// person's prints is guessed as them, shown dotted until someone confirms it, like the other guesses.
export const VERSION = 3; // how it learns; a newer one starts learning again (v3: the server's model, 512-number prints)
const MATCH = 1.22;  // a face this close to someone's prints (the mean of the nearest three) is them (a likeness of 0.26)
const MARGIN = 0.06; // ...and clearly closer to them than to anyone else
const BIG = 0.03;    // a face narrower than this share of the photo is someone in the background: left out
const TEACH = 0.07;  // a face it learns from is at least this wide: the photo is of them
const LAST = 0.05;   // ...and in a group photo, the last face left (everyone else known) at least this wide
const K = 400;       // prints come as whole numbers: value × K, in -127…127 (values stay within ±0.3)
const BINS = 28;     // an outfit: 12 hues × 2 strengths for colours, and 4 shades of grey (workers/faces/server/look.py)

// how alike two outfits are: 1 the same colours, 0 nothing in common (Bhattacharyya)
export function alike(a, b) {
  if (!a || !b) return 0; const x = atob(a), y = atob(b); let s = 0;
  for (let i = 0; i < BINS; i++) s += Math.sqrt((x.charCodeAt(i) / 255) * (y.charCodeAt(i) / 255));
  return s;
}
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

// what a tagged photo teaches. A photo of one person: its one face big enough to be theirs, if it doesn't look more like
// someone else we know (a stranger in front, or the wrong person tagged). A photo of a few of us: each face that's
// clearly one of the people tagged (and no one else we know), and then, when just one person and one face are left,
// that face is them. So it learns each of us from the group photos too, more with each pass as it knows us better.
export function learnFrom(faces, tagged, prints) {
  if (tagged.length > 1) return learnGroup(faces, tagged, prints);
  if (tagged.length !== 1) return [];
  const F = faces.filter(big); if (F.length !== 1 || F[0].w < TEACH) return [];
  const who = tagged[0], v = unpack(F[0].q);
  const own = (prints[who] || []).length >= 2 ? score(v, prints[who]) : null;
  const other = Math.min(Infinity, ...Object.entries(prints).filter(([p, ps]) => p !== who && ps.length).map(([, ps]) => score(v, ps)));
  if (other < MATCH && (own === null || other < own)) return [];
  return [{ who, q: F[0].q }];
}

function learnGroup(faces, tagged, prints) {
  const F = faces.filter(big); if (!F.length) return [];
  const got = assign(F, prints, Object.keys(prints).filter((p) => prints[p].length)).filter((x) => tagged.includes(x.who)); // (faces like someone not tagged teach nothing)
  const out = got.map((x) => ({ who: x.who, q: F[x.i].q }));
  const left = tagged.filter((p) => !got.some((x) => x.who === p)), free = F.filter((_, i) => !got.some((x) => x.i === i));
  if (left.length === 1 && free.length === 1 && free[0].w >= LAST) {
    const v = unpack(free[0].q), other = Math.min(Infinity, ...Object.entries(prints).filter(([p, ps]) => p !== left[0] && ps.length).map(([, ps]) => score(v, ps)));
    if (other >= MATCH) out.push({ who: left[0], q: free[0].q });
  }
  return out;
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
  const F = L.f.filter(big), B = front(L.b.filter(tall));
  return assign(F, prints, who).map((x) => ({ x, p: B.find((b) => b.fi === L.f.indexOf(F[x.i])) })).filter((y) => y.p).map((y) => ({ who: y.x.who, o: y.p.o }));
}
// someone half hidden behind another shows partly the other's clothes: of two people in a photo dressed alike, the one
// further back (whose feet are higher up) is left out
const front = (B) => B.filter((p) => !B.some((q) => q !== p && q.y + q.h > p.y + p.h && alike(p.o, q.o) >= DRESS));
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
