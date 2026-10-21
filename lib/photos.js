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
//   POST session      (x-trip-pin)  { trip, folder, name, mime, size, day, stop, t, by } → { url } (resumable upload) or { dup }
//   POST folder       (x-trip-pin)  { trip, days }     → { url }  the trip folder in Drive (for the Drive app), day folders made
//   POST inbox        (x-trip-pin)  { trip }           → { wide, owner, items }  photos added with the Drive app, not filed yet
//   POST adopt        (x-trip-pin)  { trip, items: [{ id, day, stop, t, by }] }  files them (the phone works out day and stop)
//   POST update       (x-trip-pin)  { ids, set: { day?, stop?, in?, hidden? }, heart?: { by, on }, tag?: { who, on } }
//   POST cover        (x-trip-pin)  { stop, id|null }   the photo that stands for a stop on the plan
//   GET  thumb/:id?s=600&k=TOKEN    an image rendition (any photo the site made; covers need no token)
//   GET  file/:id?k=TOKEN[&dl=1]    the original (Range supported, for video)
// Nothing is deleted from Drive by the site: "hide" is a flag.

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
export async function folder(env, kv, name, parent) {
  const map = (await kv.get('gfolders', 'json')) || {}; const key = `${parent}/${name}`;
  if (map[key]) return map[key];
  const q = `name='${qs(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`;
  const found = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' }));
  let id = found.files && found.files[0] && found.files[0].id;
  if (!id) id = (await dj(env, kv, '/drive/v3/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) })).id;
  map[key] = id; await kv.put('gfolders', JSON.stringify(map));
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
        in: (a.in || '').split(',').filter((x) => PEOPLE.includes(x)), hearts: (a.hearts || '').split(',').filter((x) => PEOPLE.includes(x)), hidden: a.hidden === '1',
        w: w || null, h: h || null, dur: vm.durationMillis ? Math.round(+vm.durationMillis / 1000) : null, thumb: f.thumbnailLink || null });
    }
    pageToken = p.nextPageToken || '';
  } while (pageToken);
  if (cache) await cache.put(listKey(trip), new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=20' } }));
  return out;
}
const dropList = async (trip) => { if (typeof caches !== 'undefined') await caches.default.delete(listKey(trip)); };

/* ── stream a Drive file or thumbnail back to the phone ── */
const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
function streamed(r, extra = {}) { const h = new Headers(); for (const k of passHeaders) { const v = r.headers.get(k); if (v) h.set(k, v); } for (const [k, v] of Object.entries(extra)) h.set(k, v); return new Response(r.body, { status: r.status, headers: h }); }

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

    // ── the list ──
    if (sub === '' && request.method === 'GET') {
      if (!role) return json({ error: 'photos are private', photoPin: true }, 403);
      const trip = url.searchParams.get('trip') || 'japan'; if (!TRIPS[trip]) return json({ error: 'unknown trip' }, 400);
      let photos = await listPhotos(env, kv, trip);
      if (role !== 'm') photos = photos.filter((p) => !p.hidden);
      return json({ photos, covers: await store.read('covers', {}), role });
    }

    if (request.method !== 'POST') return json({ error: 'not found' }, 404);
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
      const meta = { name, parents: [parent], mimeType: mime, appProperties: { trip, day: b.day, stop: isId(b.stop || '') ? b.stop : '', t: String(Math.round(+b.t)), by: b.by, in: '', hearts: '' } };
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
      const set = b.set || {}; const patch = {};
      if (set.day !== undefined) { if (!isId(set.day)) return json({ error: 'bad day' }, 400); patch.day = set.day; }
      if (set.stop !== undefined) { if (set.stop !== null && set.stop !== '' && !isId(set.stop)) return json({ error: 'bad stop' }, 400); patch.stop = set.stop || ''; }
      if (set.in !== undefined) { if (!Array.isArray(set.in)) return json({ error: 'bad tags' }, 400); patch.in = PEOPLE.filter((p) => set.in.includes(p)).join(','); }
      if (set.hidden !== undefined) patch.hidden = set.hidden ? '1' : '';
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
        if (Object.keys(props).length) await dj(env, kv, `/drive/v3/files/${id}?fields=id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appProperties: props }) });
      }
      await dropList(TRIPS[b.trip] ? b.trip : trip);
      return json({ ok: true });
    }

    // ── the photo that stands for a stop on the plan ──
    if (sub === 'cover') {
      if (!isId(b.stop || '')) return json({ error: 'bad stop' }, 400);
      if (b.id !== null && !isFileId(b.id)) return json({ error: 'bad photo' }, 400);
      const r = await store.update('covers', {}, (covers) => { if (b.id) covers[b.stop] = b.id; else delete covers[b.stop]; return { value: covers }; });
      return json({ ok: true, covers: r.value });
    }
    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, (err && err.status) || 500);
  }
}
