// Trip photos, stored in one person's Google Drive (theirs, their storage) and shown on the site.
// The site uploads into that Drive as them (OAuth). Connected with full Drive access, so it can also pick up photos the
// four add straight into the trip's folders with the Google Drive app (an older drive.file connection only sees the
// site's own files; the page then asks the Drive's owner to reconnect once).
//
// Setup (once): GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets on the Pages project, then one of the four opens
// /api/photos/connect?k=<member PIN> and signs in with the Drive's Google account. The refresh token is kept in KV.
// PHOTO_PIN is the guests' PIN for viewing; PHOTO_SECRET signs the short tokens <img>/<video> use (falls back to other secrets).
//
// Routes (all under /api/photos):
//   GET  status                     → { configured, connected, wide }
//   GET  connect?k=PIN              → Google sign-in → callback → back to /japan/photos
//   POST token        (x-trip-pin)  → { token }        member viewing token
//   POST unlock       { pin }       → { token, role }  guest (photo PIN) or member PIN
//   GET  ?trip=japan  (x-photo-token or ?k=) → { photos, covers }
//   POST session      (x-trip-pin)  { trip, folder, name, mime, size, day, stop, t, by, in? } → { url } (resumable upload) or { dup }
//   POST folder       (x-trip-pin)  { trip, days }     → { url }  the trip folder in Drive (for the Drive app), day folders made
//   POST inbox        (x-trip-pin)  { trip }           → { wide, owner, items }  photos added with the Drive app, not filed yet
//   POST adopt        (x-trip-pin)  { trip, items: [{ id, day, stop, t, by }] }  files them (the phone works out day and stop)
//   POST update       (x-trip-pin)  { ids, set: { day?, stop?, in?, hidden?, sure?, guess?, unguess?, tagsok?, rot? }, heart?: { by, on }, tag?: { who, on } }
//   POST sort         (x-trip-pin)  { trip, items: [{ id, could, img? }] }  Claude says what's in each (lib/sort-claude.js), once
//   GET  prints       (member token) → the four's face prints, learned from tagged photos (js/faces.js, on the phones)
//   POST prints       (x-trip-pin)  { reset?: version, add: [{ who, id, q }], used: [photo ids learned from], drop: [photo ids], reject: [photo ids] }
//   POST looks        (x-trip-pin)  { trip, items: [{ id, rot }] } → { looks: { key: look }, later: [keys] }  what's in each
//                                    photo (faces and people), from the faces server (workers/faces); a few new ones a go
//   POST look         (x-trip-pin)  { img: data URL, rot? } → look   a photo being uploaded, from the phone's small copy
//   POST sweep        (x-faces-key) { trip } → { left }   the faces server's minute: a few photos no one has looked at yet
//   POST cover        (x-trip-pin)  { stop, id|null }   the photo that stands for a stop on the plan
//   GET  thumb/:id?s=600&k=TOKEN    an image rendition (any photo the site made; covers need no token)
//   GET  file/:id?k=TOKEN[&dl=1]    the original (Range supported, for video)
// Nothing is deleted from Drive by the site: "hide" is a flag.
// Who's in a photo is "in"; "ig" marks it as a guess (from the sort) until one of the four changes or confirms it ("ck").

import { sortPhoto, guessWho } from './sort-claude.js';

const PEOPLE = ['naf', 'sara', 'mariam', 'm'];
export const TRIPS = { japan: 'Japan 2026' };
export const ROOT = 'Our Trips';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const isWide = (g) => !!g && String(g.scope || '').split(/\s+/).includes(SCOPE);
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: JSON_H });
export class Err extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const isId = (s) => typeof s === 'string' && /^[a-z0-9_-]{1,80}$/i.test(s);
const isFileId = (s) => typeof s === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(s);
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const base = (env) => ({ api: env.GOOGLE_API || 'https://www.googleapis.com', oauth: env.GOOGLE_OAUTH || 'https://oauth2.googleapis.com', auth: env.GOOGLE_AUTH || 'https://accounts.google.com' });

/* ── short signed tokens: "<role>.<expiry>.<signature>" ── */
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const secretOf = (env) => env.PHOTO_SECRET || `${env.TRIP_PIN || ''}|${env.GOOGLE_CLIENT_SECRET || ''}|${env.PHOTO_PIN || ''}|ourtrips-photos`;
async function sign(env, msg) { const k = await crypto.subtle.importKey('raw', enc.encode(secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg))).slice(0, 32); }
async function mint(env, role, days = 30) { const exp = Math.floor(Date.now() / 1000) + days * 86400; return `${role}.${exp}.${await sign(env, `${role}.${exp}`)}`; }
async function verify(env, tok) {
  const m = /^([mgc])\.(\d{9,11})\.([A-Za-z0-9_-]{32})$/.exec(tok || ''); if (!m) return null;
  if (+m[2] < Date.now() / 1000) return null;
  return (await sign(env, `${m[1]}.${m[2]}`)) === m[3] ? m[1] : null;
}
const memberPinOk = (env, req) => !env.TRIP_PIN || req.headers.get('x-trip-pin') === String(env.TRIP_PIN);

/* ── Google access token from the stored refresh token (kept in memory / the edge cache, not KV) ── */
let mem = null;
async function accessToken(env, kv) {
  const now = Date.now();
  if (mem && mem.exp > now + 60e3) return mem.tok;
  const cache = typeof caches !== 'undefined' ? caches.default : null; const ck = new Request('https://cache.ourtrips.local/gtoken');
  if (cache) { const hit = await cache.match(ck); if (hit) { const j = await hit.json(); if (j.exp > now + 60e3) { mem = j; return j.tok; } } }
  const g = await kv.get('gdrive', 'json'); if (!g || !g.refresh) throw new Err(409, 'Google Drive is not connected yet');
  const r = await fetch(base(env).oauth + '/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: g.refresh, grant_type: 'refresh_token' }) });
  if (!r.ok) throw new Err(502, 'Google sign-in expired or was removed. Connect Google Drive again.');
  const j = await r.json(); mem = { tok: j.access_token, exp: now + (j.expires_in || 3600) * 1000 };
  if (cache) await cache.put(ck, new Response(JSON.stringify(mem), { headers: { 'cache-control': 'max-age=3000' } }));
  return mem.tok;
}
export async function drive(env, kv, path, opts = {}) {
  const tok = await accessToken(env, kv);
  return fetch(base(env).api + path, { ...opts, headers: { authorization: 'Bearer ' + tok, ...(opts.headers || {}) } });
}
export async function dj(env, kv, path, opts) {
  const r = await drive(env, kv, path, opts);
  if (!r.ok) throw new Err(502, `Google Drive said ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

/* ── folders: Our Trips / Japan 2026 / Day 05 · Kyoto (ids remembered in KV, ~20 writes ever) ── */
const qs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const checked = new Map(); // folder id → when we last saw it wasn't in the bin
export async function folder(env, kv, name, parent) {
  const map = (await kv.get('gfolders', 'json')) || {}; const key = `${parent}/${name}`;
  if (map[key]) {
    const id = map[key]; if (Date.now() - (checked.get(id) || 0) < (env.FOLDER_CHECK_MS ?? 600e3)) return id;
    // someone may have binned it in Drive: then make a fresh one (if Google doesn't answer, keep using it)
    const r = await drive(env, kv, `/drive/v3/files/${id}?fields=trashed`).catch(() => null);
    const gone = r && (r.status === 404 || (r.ok && (await r.json()).trashed));
    if (!gone) { checked.set(id, Date.now()); return id; }
    delete map[key];
  }
  const q = `name='${qs(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`;
  const found = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' }));
  let id = found.files && found.files[0] && found.files[0].id;
  if (!id) id = (await dj(env, kv, '/drive/v3/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) })).id;
  map[key] = id; await kv.put('gfolders', JSON.stringify(map)); checked.set(id, Date.now());
  return id;
}
const tripFolder = async (env, kv, trip) => folder(env, kv, TRIPS[trip], await folder(env, kv, ROOT, 'root'));
async function tripFolders(env, kv, trip) { // the trip folder and the day folders in it (not Backups)
  const top = await tripFolder(env, kv, trip);
  const subs = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q: `'${top}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`, fields: 'files(id,name)', pageSize: '100' }));
  return [{ id: top, name: '' }, ...(subs.files || []).filter((f) => /^Day \d+/.test(f.name))];
}
// a camera's "2026:10:22 15:42:07" (local time, which in Japan is JST) → ms
const cameraTime = (s) => { const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 9 * 3600e3 : null; };
const patchFile = (env, kv, id, qs, body = {}) => dj(env, kv, `/drive/v3/files/${id}?fields=id${qs ? '&' + qs : ''}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const forget = async (kv, ids) => { const map = (await kv.get('gfolders', 'json')) || {}; for (const k of Object.keys(map)) if (ids.includes(map[k])) delete map[k]; await kv.put('gfolders', JSON.stringify(map)); };

// The money backups live next to the trip folder (Our Trips / Japan 2026 backups), so the trip folder holds only
// photos. They used to be Japan 2026 / Backups: that folder is moved and renamed the first time.
export async function backupsFolder(env, kv) {
  const root = await folder(env, kv, ROOT, 'root'), top = await tripFolder(env, kv, 'japan'), name = `${TRIPS.japan} backups`;
  const map = (await kv.get('gfolders', 'json')) || {}; const old = map[`${top}/Backups`];
  if (old) {
    await patchFile(env, kv, old, `addParents=${root}&removeParents=${top}`, { name });
    delete map[`${top}/Backups`]; map[`${root}/${name}`] = old; await kv.put('gfolders', JSON.stringify(map));
    return old;
  }
  return folder(env, kv, name, root);
}

// Photos used to go into a folder per day. Everything now sits straight in the trip folder: move what's in the old day
// folders up (a filed photo, or anything that isn't a photo; an unfiled one waits a round so its folder can still say
// which day it is), then bin a day folder once it's empty (the bin keeps it 30 days). A few at a time, every check.
async function tidyDays(env, kv, top, days, budget = 30) { // budget: Drive calls this round (a request may make only so many)
  let moved = 0; const gone = [];
  for (const d of days) {
    if (--budget < 1) break;
    const p = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q: `'${d.id}' in parents and trashed=false`, fields: 'files(id,mimeType,appProperties)', pageSize: '100' }));
    const kids = p.files || [];
    const ready = kids.filter((f) => !/^(image|video)\//.test(f.mimeType || '') || (f.appProperties && f.appProperties.trip));
    let stuck = false; // a file Google won't let us move keeps its folder (and the rest carry on)
    for (const f of ready) { if (budget < 2) break; budget--; if (await patchFile(env, kv, f.id, `addParents=${top}&removeParents=${d.id}`).then(() => true, () => false)) moved++; else stuck = true; }
    if (budget < 2) break;
    if (!stuck && kids.length < 100 && ready.length === kids.length) { budget--; await patchFile(env, kv, d.id, '', { trashed: true }); gone.push(d.id); }
  }
  if (gone.length) await forget(kv, gone);
  return moved;
}

/* ── the list, cached briefly at the edge so a gallery full of phones doesn't hammer Drive ── */
const listKey = (trip) => new Request(`https://cache.ourtrips.local/photos/${trip}`);
async function listPhotos(env, kv, trip) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(listKey(trip)); if (hit) return hit.json(); }
  const out = []; let pageToken = '';
  const q = `appProperties has { key='trip' and value='${qs(trip)}' } and trashed=false`;
  const fields = 'nextPageToken,files(id,name,mimeType,size,appProperties,thumbnailLink,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis))';
  do {
    const p = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q, fields, pageSize: '1000', ...(pageToken ? { pageToken } : {}) }));
    for (const f of p.files || []) {
      const a = f.appProperties || {}; const im = f.imageMediaMetadata || {}, vm = f.videoMediaMetadata || {};
      const rot = im.rotation === 1 || im.rotation === 3; const w = rot ? im.height : im.width || vm.width, h = rot ? im.width : im.height || vm.height;
      out.push({ id: f.id, name: f.name, mime: f.mimeType, size: +f.size || 0, day: a.day || null, stop: a.stop || null, t: +a.t || 0, by: a.by || null,
        in: (a.in || '').split(',').filter((x) => PEOPLE.includes(x)), hearts: (a.hearts || '').split(',').filter((x) => PEOPLE.includes(x)), hidden: a.hidden === '1', guess: a.ig === '1' && !!a.in, checked: a.ck === '1', faced: a.gf === '1' && a.ig === '1', tagsOk: a.dk || '',
        kind: a.ai || null, np: a.ai ? +a.np || 0 : null, words: a.aw || '', rot: [90, 180, 270].includes(+a.rot) ? +a.rot : 0,
        w: w || null, h: h || null, dur: vm.durationMillis ? Math.round(+vm.durationMillis / 1000) : null, thumb: f.thumbnailLink || null });
    }
    pageToken = p.nextPageToken || '';
  } while (pageToken);
  if (cache) await cache.put(listKey(trip), new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=20' } }));
  return out;
}
// The plan's photos that someone turned: covers['~rot'] = { id: 90|180|270 }, so the trip page draws them turned too
const isCoverOf = (c, id) => Object.entries(c).some(([k, v]) => k !== '~rot' && v === id);
function withTurns(c, turns) {
  const t = { ...(c['~rot'] || {}) }; for (const [id, r] of Object.entries(turns)) { if (r) t[id] = r; else delete t[id]; }
  for (const id of Object.keys(t)) if (!isCoverOf(c, id)) delete t[id];
  return { ...c, '~rot': t };
}
const dropList = async (trip) => { if (typeof caches !== 'undefined') await caches.default.delete(listKey(trip)); };

/* ── stream a Drive file or thumbnail back to the phone ── */
const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
function streamed(r, extra = {}) { const h = new Headers(); for (const k of passHeaders) { const v = r.headers.get(k); if (v) h.set(k, v); } for (const [k, v] of Object.entries(extra)) h.set(k, v); return new Response(r.body, { status: r.status, headers: h }); }

/* ── what's in a photo: the faces server (workers/faces, the FACES service binding) looks once, and keeps what it found ── */
const lookKeyOf = (id, rot) => id + ([90, 180, 270].includes(+rot) ? '@' + +rot : '');
async function faces(env, path, body, type = 'application/json') {
  if (!env.FACES) throw new Err(503, 'face recognition is not set up');
  const r = await env.FACES.fetch('https://faces' + path, { method: 'POST', headers: { 'content-type': type }, body: type === 'application/json' ? JSON.stringify(body) : body });
  if (r.status === 422) return null; // a picture it can't read
  if (!r.ok) throw new Err(502, 'face recognition server said ' + r.status);
  return r.json();
}
// look at one trip photo (Google's 800-pixel picture of it), and keep what's in it. null: no picture yet (try later)
async function lookAt(env, kv, id, rot) {
  const f = await dj(env, kv, `/drive/v3/files/${id}?fields=mimeType,size,thumbnailLink,appProperties`).catch(() => null);
  if (!f) return null; // (Google didn't answer: next time)
  if (!(f.appProperties || {}).trip || !/^image\//.test(f.mimeType || '') || !+f.size) return { f: [], b: [] }; // (not ours, a video, or an upload that never finished: nothing to look for)
  // Google's 800-pixel picture; for a photo Google made none of (some big camera JPEGs), the photo itself, if it's not huge
  if (!f.thumbnailLink && (+f.size > 19e6 || /heic|heif/i.test(f.mimeType))) return null;
  const r = await (f.thumbnailLink ? fetch(f.thumbnailLink.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s800') : drive(env, kv, `/drive/v3/files/${id}?alt=media`)).catch(() => null);
  if (!r || !r.ok) return null;
  const L = (await faces(env, '/look?rot=' + (+rot || 0), await r.arrayBuffer(), 'application/octet-stream')) || { f: [], b: [] };
  await faces(env, '/put', { key: lookKeyOf(id, rot), look: L });
  return L;
}
// a few of them at a time, two at once (the server has two boxes), within a time budget
async function lookAtSome(env, kv, items, ms) {
  const t0 = Date.now(), got = {}, q = items.slice();
  const one = async () => { for (let it; (it = q.shift());) { if (Date.now() - t0 > ms) { q.unshift(it); return; } const L = await lookAt(env, kv, it.id, it.rot).catch((e) => { if (e.status === 503) throw e; return null; }); if (L) got[lookKeyOf(it.id, it.rot)] = L; } };
  await Promise.all([one(), one()]);
  return got;
}

export async function handlePhotos({ request, env, url, path, kv, store }) {
  try {
    const sub = path.replace(/^photos\/?/, '');
    const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

    if (sub === 'status') { const g = await kv.get('gdrive', 'json'); return json({ configured, connected: !!g, wide: isWide(g) }); }

    // ── connect the Drive (one of the four, once) ──
    if (sub === 'connect' && request.method === 'GET') {
      if (!configured) return new Response('Google is not set up for this site yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).', { status: 503 });
      if (env.TRIP_PIN && url.searchParams.get('k') !== String(env.TRIP_PIN)) return new Response('Wrong PIN.', { status: 403 });
      const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + '/api/photos/callback', response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: await mint(env, 'c', 0.01) });
      return Response.redirect(base(env).auth + '/o/oauth2/v2/auth?' + q, 302);
    }
    if (sub === 'callback' && request.method === 'GET') {
      if ((await verify(env, url.searchParams.get('state'))) !== 'c') return new Response('That sign-in link expired. Start again from the photos page.', { status: 400 });
      const code = url.searchParams.get('code'); if (!code) return Response.redirect(url.origin + '/japan/photos?connect=cancelled', 302);
      const r = await fetch(base(env).oauth + '/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + '/api/photos/callback', grant_type: 'authorization_code' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) return new Response('Google did not hand over long-term access. In your Google account, remove "Our Trips" under Third-party access, then connect again.', { status: 502 });
      const who = async (tok) => { const a = await fetch(base(env).api + '/drive/v3/about?fields=user(displayName,emailAddress)', { headers: { authorization: 'Bearer ' + tok } }); return a.ok ? ((await a.json()).user || {}) : {}; };
      const me = await who(j.access_token).catch(() => ({}));
      const old = await kv.get('gdrive', 'json');
      if (old) { // reconnecting: it must be the same Google account, or the photos would start going to someone else's Drive
        // (if the old access is dead and never told us its account, there's nothing to compare: the new one is let in)
        let was = old.email || null;
        if (!was) was = (await who(await accessToken(env, kv)).catch(() => ({}))).emailAddress || null;
        if (!me.emailAddress) return new Response('Google didn\'t say which account that is. Go back to the photos page and try Reconnect again.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        if (was && me.emailAddress && was.toLowerCase() !== me.emailAddress.toLowerCase())
          return new Response(`That's a different Google account. The trip photos are in ${was}'s Drive: sign in with that one.`, { status: 409, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      await kv.put('gdrive', JSON.stringify({ refresh: j.refresh_token, scope: j.scope || '', email: me.emailAddress || (old && old.email) || null, name: me.displayName || (old && old.name) || null, at: new Date().toISOString() }));
      mem = null; if (typeof caches !== 'undefined') await caches.default.delete(new Request('https://cache.ourtrips.local/gtoken'));
      return Response.redirect(url.origin + '/japan/photos?connect=ok', 302);
    }

    // ── viewing tokens ──
    if (sub === 'token' && request.method === 'POST') {
      if (!memberPinOk(env, request)) return json({ error: 'pin required', pin: true }, 403);
      return json({ token: await mint(env, 'm'), role: 'm' });
    }
    if (sub === 'unlock' && request.method === 'POST') {
      const b = await request.json().catch(() => ({})); const pin = String(b.pin ?? '');
      if (env.TRIP_PIN && pin === String(env.TRIP_PIN)) return json({ token: await mint(env, 'm'), role: 'm' });
      if (!env.PHOTO_PIN || pin === String(env.PHOTO_PIN)) return json({ token: await mint(env, 'g'), role: 'g' });
      return json({ error: 'wrong pin' }, 403);
    }

    // a viewing token: member ("m") or guest ("g"); the short sign-in token ("c") can't view anything
    const t0 = await verify(env, request.headers.get('x-photo-token') || url.searchParams.get('k'));
    const role = t0 === 'm' || t0 === 'g' ? t0 : null;

    // ── media: thumbnails (covers are public, they show on the plan) and originals ──
    const tm = /^thumb\/([a-zA-Z0-9_-]{10,128})$/.exec(sub);
    if (tm && request.method === 'GET') {
      const id = tm[1]; const covers = await store.read('covers', {});
      if (!role && !Object.values(covers).includes(id)) return json({ error: 'photos are private' }, 403);
      const s = Math.max(64, Math.min(2000, parseInt(url.searchParams.get('s'), 10) || 600));
      const cache = typeof caches !== 'undefined' ? caches.default : null; const ck = new Request(`https://cache.ourtrips.local/thumb/${id}/${s}`);
      if (cache) { const hit = await cache.match(ck); if (hit) return hit; }
      const f = await dj(env, kv, `/drive/v3/files/${id}?fields=thumbnailLink,appProperties`);
      if (!f.appProperties || !f.appProperties.trip || !f.thumbnailLink) return json({ error: 'no picture yet' }, 404);
      const r = await fetch(f.thumbnailLink.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s' + s);
      if (!r.ok) return json({ error: 'no picture yet' }, 404);
      const out = streamed(r, { 'cache-control': 'private, max-age=86400' });
      if (cache) await cache.put(ck, out.clone());
      return out;
    }
    const fm = /^file\/([a-zA-Z0-9_-]{10,128})$/.exec(sub);
    if (fm && request.method === 'GET') {
      if (!role) return json({ error: 'photos are private' }, 403);
      const range = request.headers.get('range');
      const meta = await dj(env, kv, `/drive/v3/files/${fm[1]}?fields=name,appProperties`);
      if (!meta.appProperties || !meta.appProperties.trip) return json({ error: 'not a trip photo' }, 404);
      const r = await drive(env, kv, `/drive/v3/files/${fm[1]}?alt=media`, { headers: range ? { range } : {} });
      if (!r.ok && r.status !== 206) return json({ error: 'could not fetch the file' }, 502);
      const dl = url.searchParams.get('dl') === '1';
      return streamed(r, { 'cache-control': 'private, max-age=86400', 'accept-ranges': 'bytes', ...(dl ? { 'content-disposition': `attachment; filename="${clean(meta.name, 120).replace(/["\\]/g, '')}"` } : {}) });
    }

    // ── face prints: a few numbers per face, learned from photos one of us tagged (never the photos themselves) ──
    if (sub === 'prints' && request.method === 'GET') {
      if (role !== 'm') return json({ error: 'photos are private' }, 403);
      return json((await kv.get('faceprints', 'json')) || { by: {}, used: [] });
    }

    // ── the list ──
    if (sub === '' && request.method === 'GET') {
      if (!role) return json({ error: 'photos are private', photoPin: true }, 403);
      const trip = url.searchParams.get('trip') || 'japan'; if (!TRIPS[trip]) return json({ error: 'unknown trip' }, 400);
      let photos = await listPhotos(env, kv, trip);
      if (role !== 'm') photos = photos.filter((p) => !p.hidden);
      return json({ photos, covers: await store.read('covers', {}), role });
    }

    if (request.method !== 'POST') return json({ error: 'not found' }, 404);
    // ── the faces server's minute: look at a few photos no one has looked at yet (newest first) ──
    if (sub === 'sweep') {
      if (!env.FACES_KEY || request.headers.get('x-faces-key') !== String(env.FACES_KEY)) return json({ error: 'not allowed' }, 403);
      const all = (await listPhotos(env, kv, 'japan')).filter((p) => /^image\//.test(p.mime || '') && !p.hidden).sort((a, b) => b.t - a.t);
      const { keys } = await faces(env, '/missing', { keys: all.map((p) => lookKeyOf(p.id, p.rot)) });
      const todo = new Set(keys), items = all.filter((p) => todo.has(lookKeyOf(p.id, p.rot))).slice(0, 12).map((p) => ({ id: p.id, rot: p.rot }));
      const got = await lookAtSome(env, kv, items, 20e3);
      return json({ looked: Object.keys(got).length, left: keys.length - Object.keys(got).length });
    }
    if (!memberPinOk(env, request)) return json({ error: 'pin required', pin: true }, 403);
    const b = await request.json().catch(() => null); if (!b) return json({ error: 'invalid JSON' }, 400);

    // ── start an upload: the phone then sends the bytes straight to Google ──
    if (sub === 'session') {
      const trip = TRIPS[b.trip] ? b.trip : null, name = clean(b.name, 200), mime = clean(b.mime, 100), size = +b.size;
      if (!trip || !name || !/^(image|video)\//.test(mime) || !(size > 0) || !isId(b.day || '') || !PEOPLE.includes(b.by) || !(+b.t > 0)) return json({ error: 'bad upload' }, 400);
      const parent = await tripFolder(env, kv, trip); // one folder for the whole trip: the site sorts by day and stop
      // the same photo twice (same name, same moment) is skipped
      const dup = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q: `'${parent}' in parents and name='${qs(name)}' and trashed=false and appProperties has { key='t' and value='${String(+b.t)}' }`, fields: 'files(id)', pageSize: '1' }));
      if (dup.files && dup.files.length) return json({ dup: true, id: dup.files[0].id });
      const tagged = Array.isArray(b.in) ? PEOPLE.filter((p) => b.in.includes(p)).join(',') : ''; // who's in it, said while choosing
      const meta = { name, parents: [parent], mimeType: mime, appProperties: { trip, day: b.day, stop: isId(b.stop || '') ? b.stop : '', t: String(Math.round(+b.t)), by: b.by, in: tagged, hearts: '', ...(tagged ? { ck: '1' } : {}) } };
      const r = await drive(env, kv, '/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': mime, 'x-upload-content-length': String(size), origin: request.headers.get('origin') || url.origin },
        body: JSON.stringify(meta) });
      const loc = r.headers.get('location');
      if (!r.ok || !loc) return json({ error: `Google Drive refused the upload (${r.status})` }, 502);
      await dropList(trip);
      return json({ url: loc });
    }

    // ── the trip's folder in Drive, for adding photos with the Google Drive app (it uploads in the background) ──
    if (sub === 'folder') {
      const trip = TRIPS[b.trip] ? b.trip : 'japan';
      const id = await tripFolder(env, kv, trip);
      return json({ url: `https://drive.google.com/drive/folders/${id}` });
    }

    // ── photos added with the Drive app: listed for a phone to file (it knows the plan), then marked as trip photos ──
    if (sub === 'inbox') {
      const trip = TRIPS[b.trip] ? b.trip : 'japan'; const g = await kv.get('gdrive', 'json');
      if (g && !g.email) { // an older connection: learn whose Drive it is (for the reconnect banner, and to refuse another account)
        const a = await drive(env, kv, '/drive/v3/about?fields=user(displayName,emailAddress)').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
        if (a.user && a.user.emailAddress) { g.email = a.user.emailAddress; g.name = a.user.displayName || null; await kv.put('gdrive', JSON.stringify(g)); }
      }
      const owner = g && g.name ? String(g.name).split(/\s+/)[0] : null;
      await backupsFolder(env, kv).catch(() => {}); // (moves the old Backups folder out of the trip folder, once)
      if (!isWide(g)) return json({ wide: false, owner, items: [] });
      const dirs = await tripFolders(env, kv, trip); const nameOf = Object.fromEntries(dirs.map((d) => [d.id, d.name]));
      const q = `(${dirs.map((d) => `'${d.id}' in parents`).join(' or ')}) and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/') and not appProperties has { key='trip' and value='${qs(trip)}' }`;
      const fields = 'nextPageToken,files(id,name,mimeType,parents,createdTime,appProperties,owners(displayName),imageMediaMetadata(time,location))';
      const items = []; let pageToken = '';
      do {
        const ask = (qq) => dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q: qq, fields, pageSize: '200', ...(pageToken ? { pageToken } : {}) }));
        // if Google ever refuses the "not … has" part, ask without it (filed ones are skipped below anyway)
        const p = await ask(q).catch(() => ask(q.replace(/ and not appProperties has \{[^}]*\}$/, '')));
        for (const f of p.files || []) {
          if (f.appProperties && f.appProperties.trip) continue;
          const im = f.imageMediaMetadata || {}, loc = im.location || {}; const dir = (f.parents || []).find((x) => x in nameOf);
          items.push({ id: f.id, name: f.name, mime: f.mimeType, folder: dir ? nameOf[dir] : '', t: cameraTime(im.time), created: Date.parse(f.createdTime) || null,
            lat: loc.latitude ?? null, lng: loc.longitude ?? null, owner: ((f.owners || [])[0] || {}).displayName || null });
        }
        pageToken = p.nextPageToken || '';
      } while (pageToken && items.length < 1000);
      // the old day folders: only with full access, when the site can see everything in them before binning one
      if (dirs.length > 1) await tidyDays(env, kv, dirs[0].id, dirs.slice(1)).catch(() => {});
      return json({ wide: true, owner, items });
    }
    if (sub === 'adopt') {
      const trip = TRIPS[b.trip] ? b.trip : null; const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [];
      if (!trip || !isWide(await kv.get('gdrive', 'json'))) return json({ error: 'bad adopt' }, 400);
      const inTrip = new Set((await tripFolders(env, kv, trip)).map((d) => d.id)); let n = 0;
      for (const it of items) {
        if (!it || !isFileId(it.id) || !isId(it.day || '') || !(+it.t > 0)) continue;
        // only photos and videos inside the trip's folders, and not ones already filed
        const f = await dj(env, kv, `/drive/v3/files/${it.id}?fields=parents,mimeType,appProperties`);
        if (!/^(image|video)\//.test(f.mimeType || '') || !(f.parents || []).some((x) => inTrip.has(x)) || (f.appProperties && f.appProperties.trip)) continue;
        const props = { trip, day: it.day, stop: isId(it.stop || '') ? it.stop : '', t: String(Math.round(+it.t)), by: PEOPLE.includes(it.by) ? it.by : '', in: '', hearts: '', via: 'drive' };
        await dj(env, kv, `/drive/v3/files/${it.id}?fields=id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: props }) });
        n++;
      }
      if (n) await dropList(trip);
      return json({ ok: true, filed: n });
    }

    // ── tags, hearts, moving to another stop, hiding ──
    if (sub === 'update') {
      let ids = Array.isArray(b.ids) ? b.ids.filter(isFileId).slice(0, 200) : []; if (!ids.length) return json({ error: 'no photos' }, 400);
      // only trip photos: the site can reach the whole Drive, so an id from anywhere else is dropped (the list is cached;
      // one too new for it is checked on its own)
      const known = new Set((await listPhotos(env, kv, TRIPS[b.trip] ? b.trip : 'japan')).map((p) => p.id));
      const isTrip = async (id) => known.has(id) || !!((await dj(env, kv, `/drive/v3/files/${id}?fields=appProperties`)).appProperties || {}).trip;
      ids = (await Promise.all(ids.map(async (id) => ((await isTrip(id).catch(() => false)) ? id : null)))).filter(Boolean);
      if (!ids.length) return json({ error: 'not trip photos' }, 400);
      const covers0 = b.set && b.set.rot !== undefined ? await store.read('covers', {}) : null;
      const set = b.set || {}; const patch = {};
      if (set.day !== undefined) { if (!isId(set.day)) return json({ error: 'bad day' }, 400); patch.day = set.day; }
      if (set.stop !== undefined) { if (set.stop !== null && set.stop !== '' && !isId(set.stop)) return json({ error: 'bad stop' }, 400); patch.stop = set.stop || ''; }
      if (set.in !== undefined) { if (!Array.isArray(set.in)) return json({ error: 'bad tags' }, 400); patch.in = PEOPLE.filter((p) => set.in.includes(p)).join(','); }
      if (set.hidden !== undefined) patch.hidden = set.hidden ? '1' : '';
      const rot = set.rot === undefined ? null : ((Math.round(+set.rot / 90) * 90) % 360 + 360) % 360; // a turn someone gave it, clockwise
      if (rot !== null) { if (!Number.isFinite(rot)) return json({ error: 'bad turn' }, 400); patch.rot = rot ? String(rot) : ''; }
      if (set.in !== undefined || b.tag || set.sure) { patch.ig = ''; patch.gf = ''; patch.ck = '1'; } // changed or confirmed by one of us: no longer a guess
      const heart = b.heart && PEOPLE.includes(b.heart.by) ? b.heart : null;
      const tag = b.tag && PEOPLE.includes(b.tag.who) ? b.tag : null; // add or take one person off, keeping the others
      let trip = 'japan';
      for (const id of ids) {
        const props = { ...patch };
        if (heart || tag) {
          const cur = (await dj(env, kv, `/drive/v3/files/${id}?fields=appProperties`)).appProperties || {}; trip = cur.trip || trip;
          const flip = (list, who, on) => { const s = new Set((list || '').split(',').filter(Boolean)); if (on) s.add(who); else s.delete(who); return PEOPLE.filter((p) => s.has(p)).join(','); };
          if (heart) props.hearts = flip(cur.hearts, heart.by, heart.on);
          if (tag) props.in = flip(cur.in, tag.who, tag.on);
        }
        if (Array.isArray(set.guess)) { // a guess from the faces: never over what one of us said
          const cur = (await dj(env, kv, `/drive/v3/files/${id}?fields=appProperties`)).appProperties || {};
          if (cur.ck === '1') continue;
          const g = PEOPLE.filter((p) => set.guess.includes(p)); if (!g.length) continue;
          props.in = g.join(','); props.ig = '1'; props.gf = '1';
        }
        if (set.tagsok) { // the faces questioned these tags and one of us said they're right: not asked again while they stay
          const cur = (await dj(env, kv, `/drive/v3/files/${id}?fields=appProperties`)).appProperties || {};
          props.dk = cur.in || '-';
        }
        if (set.unguess) { // a guess taken back (the faces were wrong): never what one of us said
          const cur = (await dj(env, kv, `/drive/v3/files/${id}?fields=appProperties`)).appProperties || {};
          if (cur.ck === '1' || cur.ig !== '1') continue;
          props.in = ''; props.ig = ''; props.gf = '';
        }
        if (Object.keys(props).length) await dj(env, kv, `/drive/v3/files/${id}?fields=id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: props }) });
      }
      await dropList(TRIPS[b.trip] ? b.trip : trip);
      if (rot !== null && ids.some((id) => isCoverOf(covers0 || {}, id))) await store.update('covers', {}, (c) => ({ value: withTurns(c, Object.fromEntries(ids.map((id) => [id, rot]))) }));
      return json({ ok: true });
    }

    if (sub === 'prints') {
      let fp = (await kv.get('faceprints', 'json')) || { by: {}, used: [] };
      if (+b.reset > 0) fp = { by: {}, used: [], v: +b.reset }; // a new way of learning: start again
      for (const a of (Array.isArray(b.add) ? b.add : []).slice(0, 200)) {
        if (!a || !PEOPLE.includes(a.who) || !isFileId(a.id) || typeof a.q !== 'string' || !/^[A-Za-z0-9+/=]{100,700}$/.test(a.q)) continue;
        const list = (fp.by[a.who] = (fp.by[a.who] || []).filter((x) => !(x.id === a.id && x.q === a.q)));
        list.push({ id: a.id, q: a.q }); if (list.length > 150) list.splice(0, list.length - 150); // the newest 150 a person
      }
      const d = new Set(Array.isArray(b.drop) ? b.drop.filter(isFileId) : []); // a photo whose tags changed: its prints go, and it can be learned from again
      for (const k of Object.keys(fp.by)) fp.by[k] = fp.by[k].filter((x) => !d.has(x.id));
      const bad = new Set(Array.isArray(b.reject) ? b.reject.filter(isFileId) : []); // prints that look like someone else: forgotten, and not learned from again
      for (const k of Object.keys(fp.by)) fp.by[k] = fp.by[k].filter((x) => !bad.has(x.id));
      fp.used = [...new Set([...(fp.used || []), ...(Array.isArray(b.used) ? b.used.filter(isFileId) : []), ...bad])].filter((id) => !d.has(id)).slice(-5000);
      await kv.put('faceprints', JSON.stringify(fp));
      return json(fp);
    }

    // ── what's in each photo: faces (and their prints) and people (and what they're wearing), for js/faces.js ──
    if (sub === 'looks') {
      const items = (Array.isArray(b.items) ? b.items : []).filter((it) => it && isFileId(it.id)).slice(0, 2000).map((it) => ({ id: it.id, rot: [90, 180, 270].includes(+it.rot) ? +it.rot : 0 }));
      const { looks } = await faces(env, '/get', { keys: items.map((it) => lookKeyOf(it.id, it.rot)) });
      const todo = items.filter((it) => !looks[lookKeyOf(it.id, it.rot)]);
      Object.assign(looks, await lookAtSome(env, kv, todo.slice(0, 6), 15e3)); // (new ones: a few a go, the phone asks again)
      return json({ looks, later: todo.map((it) => lookKeyOf(it.id, it.rot)).filter((k) => !looks[k]) });
    }
    if (sub === 'look') {
      const m = typeof b.img === 'string' && b.img.length < 4e6 && /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(b.img);
      if (!m) return json({ error: 'bad picture' }, 400);
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return json((await faces(env, '/look?rot=' + ([90, 180, 270].includes(+b.rot) ? +b.rot : 0), bytes, 'application/octet-stream')) || { f: [], b: [] });
    }

    // ── what's in each photo, from Claude: kind, how many people, search words, and a guess at who (if no one's tagged) ──
    if (sub === 'sort') {
      const trip = TRIPS[b.trip] ? b.trip : 'japan'; const items = Array.isArray(b.items) ? b.items.slice(0, 6) : [];
      if (!env.ANTHROPIC_API_KEY) return json({ ok: false, off: true, done: [] });
      const done = (await Promise.all(items.map(async (it) => {
        if (!it || !isFileId(it.id)) return null;
        const f = await dj(env, kv, `/drive/v3/files/${it.id}?fields=appProperties,thumbnailLink`).catch(() => null);
        const a = (f && f.appProperties) || {}; if (a.trip !== trip) return null;
        if (a.ai) return { id: it.id, kind: a.ai, np: +a.np || 0, words: a.aw || '' }; // sorted already (another phone got there first)
        // the phone's own small copy of a photo it just uploaded; otherwise Google's picture of it (which can take a moment)
        let img = typeof it.img === 'string' && it.img.length < 2e6 && /^data:image\/(jpeg|png|webp);base64,/.test(it.img) ? it.img : null;
        if (!img) {
          if (!f.thumbnailLink) return { id: it.id, later: true };
          const r = await fetch(f.thumbnailLink.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s640').catch(() => null);
          if (!r || !r.ok) return { id: it.id, later: true };
          const bytes = new Uint8Array(await r.arrayBuffer()); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          img = `data:${/png|webp/.exec(r.headers.get('content-type') || '') ? r.headers.get('content-type').split(';')[0] : 'image/jpeg'};base64,${btoa(bin)}`;
        }
        const s = await sortPhoto(env, img).catch(() => null); if (!s) return { id: it.id, later: true };
        const could = Array.isArray(it.could) ? PEOPLE.filter((p) => it.could.includes(p)) : [];
        let g = a.in ? [] : guessWho(s, could, PEOPLE.includes(a.by) ? a.by : null);
        if (g.length) { const now = await dj(env, kv, `/drive/v3/files/${it.id}?fields=appProperties`).catch(() => null); if (now && now.appProperties && now.appProperties.in) g = []; } // named meanwhile (the faces, or one of us)
        const props = { ai: s.kind, np: String(s.people), aw: s.words.join(' ').slice(0, 100), ...(g.length ? { in: g.join(','), ig: '1' } : {}) };
        await dj(env, kv, `/drive/v3/files/${it.id}?fields=id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: props }) });
        return { id: it.id, kind: s.kind, np: s.people, words: props.aw, ...(g.length ? { in: g, guess: true } : {}) };
      }))).filter(Boolean);
      if (done.some((d) => !d.later)) await dropList(trip);
      return json({ ok: true, done });
    }

    // ── the photo that stands for a stop on the plan ──
    if (sub === 'cover') {
      if (!isId(b.stop || '')) return json({ error: 'bad stop' }, 400);
      if (b.id !== null && !isFileId(b.id)) return json({ error: 'bad photo' }, 400);
      const turn = b.id ? +(((await dj(env, kv, `/drive/v3/files/${b.id}?fields=appProperties`).catch(() => null)) || {}).appProperties || {}).rot || 0 : 0;
      const r = await store.update('covers', {}, (covers) => { if (b.id) covers[b.stop] = b.id; else delete covers[b.stop]; return { value: withTurns(covers, b.id ? { [b.id]: turn } : {}) }; });
      return json({ ok: true, covers: r.value });
    }
    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, (err && err.status) || 500);
  }
}
