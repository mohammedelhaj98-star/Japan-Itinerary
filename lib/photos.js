// Trip photos, stored in one person's Google Drive (theirs, their storage) and shown on the site.
// The site uploads into that Drive as them (OAuth, scope drive.file: it only ever sees files it made itself).
//
// Setup (once): GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets on the Pages project, then one of the four opens
// /api/photos/connect?k=<member PIN> and signs in with the Drive's Google account. The refresh token is kept in KV.
// PHOTO_PIN is the guests' PIN for viewing; PHOTO_SECRET signs the short tokens <img>/<video> use (falls back to other secrets).
//
// Routes (all under /api/photos):
//   GET  status                     → { configured, connected }
//   GET  connect?k=PIN              → Google sign-in → callback → back to /japan/photos
//   POST token        (x-trip-pin)  → { token }        member viewing token
//   POST unlock       { pin }       → { token, role }  guest (photo PIN) or member PIN
//   GET  ?trip=japan  (x-photo-token or ?k=) → { photos, covers }
//   POST session      (x-trip-pin)  { trip, folder, name, mime, size, day, stop, t, by } → { url } (resumable upload) or { dup }
//   POST update       (x-trip-pin)  { ids, set: { day?, stop?, in?, hidden? }, heart?: { by, on }, tag?: { who, on } }
//   POST cover        (x-trip-pin)  { stop, id|null }   the photo that stands for a stop on the plan
//   GET  thumb/:id?s=600&k=TOKEN    an image rendition (any photo the site made; covers need no token)
//   GET  file/:id?k=TOKEN[&dl=1]    the original (Range supported, for video)
// Nothing is deleted from Drive by the site: "hide" is a flag.

const PEOPLE = ['naf', 'sara', 'mariam', 'm'];
const TRIPS = { japan: 'Japan 2026' };
const ROOT = 'Our Trips';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: JSON_H });
class Err extends Error { constructor(status, msg) { super(msg); this.status = status; } }
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
async function drive(env, kv, path, opts = {}) {
  const tok = await accessToken(env, kv);
  return fetch(base(env).api + path, { ...opts, headers: { authorization: 'Bearer ' + tok, ...(opts.headers || {}) } });
}
async function dj(env, kv, path, opts) {
  const r = await drive(env, kv, path, opts);
  if (!r.ok) throw new Err(502, `Google Drive said ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

/* ── folders: Our Trips / Japan 2026 / Day 05 · Kyoto (ids remembered in KV, ~20 writes ever) ── */
const qs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function folder(env, kv, name, parent) {
  const map = (await kv.get('gfolders', 'json')) || {}; const key = `${parent}/${name}`;
  if (map[key]) return map[key];
  const q = `name='${qs(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parent}' in parents`;
  const found = await dj(env, kv, '/drive/v3/files?' + new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' }));
  let id = found.files && found.files[0] && found.files[0].id;
  if (!id) id = (await dj(env, kv, '/drive/v3/files?fields=id', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) })).id;
  map[key] = id; await kv.put('gfolders', JSON.stringify(map));
  return id;
}
const dayFolder = async (env, kv, trip, label) => folder(env, kv, label, await folder(env, kv, TRIPS[trip], await folder(env, kv, ROOT, 'root')));

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

export async function handlePhotos({ request, env, url, path, kv }) {
  try {
    const sub = path.replace(/^photos\/?/, '');
    const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

    if (sub === 'status') return json({ configured, connected: !!(await kv.get('gdrive')) });

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
      await kv.put('gdrive', JSON.stringify({ refresh: j.refresh_token, at: new Date().toISOString() }));
      mem = null;
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
      const id = tm[1]; const covers = (await kv.get('covers', 'json')) || {};
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
      return json({ photos, covers: (await kv.get('covers', 'json')) || {}, role });
    }

    if (request.method !== 'POST') return json({ error: 'not found' }, 404);
    if (!memberPinOk(env, request)) return json({ error: 'pin required', pin: true }, 403);
    const b = await request.json().catch(() => null); if (!b) return json({ error: 'invalid JSON' }, 400);

    // ── start an upload: the phone then sends the bytes straight to Google ──
    if (sub === 'session') {
      const trip = TRIPS[b.trip] ? b.trip : null, name = clean(b.name, 200), mime = clean(b.mime, 100), size = +b.size, folderLabel = clean(b.folder, 80);
      if (!trip || !name || !/^(image|video)\//.test(mime) || !(size > 0) || !folderLabel || !isId(b.day || '') || !PEOPLE.includes(b.by) || !(+b.t > 0)) return json({ error: 'bad upload' }, 400);
      const parent = await dayFolder(env, kv, trip, folderLabel);
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

    // ── tags, hearts, moving to another stop, hiding ──
    if (sub === 'update') {
      const ids = Array.isArray(b.ids) ? b.ids.filter(isFileId).slice(0, 200) : []; if (!ids.length) return json({ error: 'no photos' }, 400);
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
      const covers = (await kv.get('covers', 'json')) || {};
      if (b.id) covers[b.stop] = b.id; else delete covers[b.stop];
      await kv.put('covers', JSON.stringify(covers)); await kv.put('updatedAt', new Date().toISOString());
      return json({ ok: true, covers });
    }
    return json({ error: 'not found' }, 404);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, (err && err.status) || 500);
  }
}
