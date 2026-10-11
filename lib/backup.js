// Money backups, into the Google Drive connected for the photos (lib/photos.js): Our Trips / Japan 2026 / Backups.
// Each Japan day gets "Money <date>.json" (every money record and setting, enough to put it all back), the expenses as
// "Expenses <date>.csv" and the same as a Google Sheet; backing up again the same day updates that day's files.
// Receipt photos are copied once each into Backups / Receipts (again only if a receipt is replaced).
//
// It runs by itself after the first money change of each Japan day (Pages has no schedule of its own), and from
// Settings → Expenses → Back up now. The state is kept in KV under "backup"; receipts copied under "backup-rc".
//   GET  /api/backup  (x-trip-pin)  → status
//   POST /api/backup  (x-trip-pin)  → back up now, then the status
import { dj, drive, folder, ROOT, TRIPS } from './photos.js';

const NAMES = { naf: 'Naf', sara: 'Sara', mariam: 'Mariam', m: 'Mo' };
const PEOPLE = Object.keys(NAMES);
const CATS = { food: 'Food', transport: 'Transport', tickets: 'Tickets', shopping: 'Shopping', hotel: 'Hotel', other: 'Other', settle: 'Settle up' };
const RECEIPTS_PER_RUN = 25; // Pages allows 50 outside calls per request; the rest go next time
const RETRY_AFTER = 3600e3;  // a failed daily backup is tried again on a money change an hour later

export const japanDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
// d05 → 2026-10-20 (the trip starts on 16 October)
const dateOf = (day) => { const m = /^d(\d\d)$/.exec(day || ''); return m ? new Date(Date.UTC(2026, 9, 15 + +m[1])).toISOString().slice(0, 10) : ''; };
const dayLabel = (day) => (/^d(\d\d)$/.test(day || '') ? `Day ${+day.slice(1)}` : day === 'pre' ? 'Before the trip' : '');
const when = (t) => (t ? new Date(t + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');

/* ── the spreadsheet: one row per expense, then the money that moved between people ── */
// a title starting with = + - @ would be read as a formula by a spreadsheet
const cell = (v) => { let s = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = ' ' + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(expenses) {
  const head = ['Date', 'Day', 'What', 'Type', 'Yen', 'Paid by', 'Paid with', ...PEOPLE.map((p) => NAMES[p]), 'Tax-free', 'Refund', 'Not shared', 'Original amount', 'Added by', 'Added (Japan time)', 'Id'];
  const rows = [], moves = [];
  for (const [id, x] of Object.entries(expenses || {})) {
    const base = { date: dateOf(x.day), day: dayLabel(x.day), at: when(x.at || (x.ts && Date.parse(x.ts))), by: NAMES[x.by] || '' };
    if (!x.kind) {
      rows.push([base.date, base.day, x.title, CATS[x.cat] || x.cat, x.yen, NAMES[x.payer], { cash: 'Cash', card: 'Card', ic: 'IC card' }[x.with] || '',
        ...PEOPLE.map((p) => (x.shares && x.shares[p] != null ? x.shares[p] : '')), x.taxfree ? 'Yes' : '', x.refund ? 'Yes' : '', x.own ? 'Yes' : '',
        x.orig ? `${x.orig.amt} ${x.orig.ccy}` : '', base.by, base.at, id]);
      continue;
    }
    const what = x.kind === 'pay' ? `${NAMES[x.from]} paid ${NAMES[x.to]}${x.cash ? ' in cash' : ''}`
      : x.kind === 'ic' ? `${NAMES[x.who]} topped up an IC card${x.with === 'card' ? ' by card' : x.with === 'cash' ? ' from cash' : ''}`
      : x.from ? `${NAMES[x.from]} gave ${NAMES[x.who]} cash` : `${NAMES[x.who]} took out cash`;
    const type = { pay: 'Payment', ic: 'IC top-up', cash: 'Cash' }[x.kind];
    moves.push([base.date, base.day, what, type, x.yen, NAMES[x.kind === 'pay' ? x.from : x.from || x.who], '', ...PEOPLE.map(() => ''), '', '', '', x.ccyAmt || '', base.by, base.at, id]);
  }
  const order = (a, b) => (a[0] || '0').localeCompare(b[0] || '0') || String(a[16]).localeCompare(String(b[16]));
  rows.sort(order); moves.sort(order);
  return [head, ...rows, ...(moves.length ? [[], ...moves] : [])].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/* ── files in Drive: update the same file, or make it (a file deleted by hand is made again) ── */
async function put(env, kv, id, meta, type, data) {
  if (id) {
    const r = await drive(env, kv, `/upload/drive/v3/files/${id}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'content-type': type }, body: data });
    if (r.ok) return id;
    if (r.status !== 404) throw new Error(`Google Drive said ${r.status}`);
  }
  const b = 'trip' + Math.random().toString(36).slice(2);
  const body = new Blob([`--${b}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\ncontent-type: ${type}\r\n\r\n`, data, `\r\n--${b}--`]);
  return (await dj(env, kv, '/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body })).id;
}
const dataUrlBytes = (s) => { const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(s || ''); if (!m) return null; const bin = atob(m[2]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { type: m[1], bytes: u }; };
const fileName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

// load() → { expenses, money } (the API's own readers)
export async function backupMoney(env, kv, load) {
  const st = (await kv.get('backup', 'json')) || {};
  const now = Date.now(), today = japanDay(now);
  try {
    if (!(await kv.get('gdrive'))) throw new Error('Google Drive is not connected');
    const { expenses, money } = await load();
    const dir = await folder(env, kv, 'Backups', await folder(env, kv, TRIPS.japan, await folder(env, kv, ROOT, 'root')));
    const f = { ...((st.files || {})[today] || {}) };
    const all = JSON.stringify({ trip: 'japan', savedAt: new Date(now).toISOString(), expenses, money }, null, 1), csv = toCsv(expenses);
    f.json = await put(env, kv, f.json, { name: `Money ${today}.json`, parents: [dir], mimeType: 'application/json' }, 'application/json', all);
    f.csv = await put(env, kv, f.csv, { name: `Expenses ${today}.csv`, parents: [dir], mimeType: 'text/csv' }, 'text/csv', '\ufeff' + csv); // the mark tells Excel it's UTF-8 (Japanese names)
    f.sheet = await put(env, kv, f.sheet, { name: `Expenses ${today}`, parents: [dir], mimeType: 'application/vnd.google-apps.spreadsheet' }, 'text/csv', csv);

    // receipt photos, once each: { expense id: [receipt stamp, Drive file id] }
    const done = (await kv.get('backup-rc', 'json')) || {};
    const todo = Object.entries(expenses).filter(([id, x]) => typeof x.receipt === 'number' && !(done[id] && done[id][0] === x.receipt));
    let copied = 0, rdir = null;
    for (const [id, x] of todo.slice(0, RECEIPTS_PER_RUN)) {
      const img = dataUrlBytes(await kv.get('rc:' + id)); if (!img) continue;
      rdir = rdir || (await folder(env, kv, 'Receipts', dir));
      const name = `${dateOf(x.day) || today} ${fileName(x.title) || 'Receipt'} ${id}.${img.type.split('/')[1].replace('jpeg', 'jpg')}`;
      done[id] = [x.receipt, await put(env, kv, done[id] && done[id][1], { name, parents: [rdir], mimeType: img.type }, img.type, img.bytes)];
      copied++;
    }
    if (copied) await kv.put('backup-rc', JSON.stringify(done));
    const list = Object.values(expenses);
    const out = { day: today, at: now, error: null, errAt: null, tried: st.tried || null, files: { ...(st.files || {}), [today]: f },
      counts: { expenses: list.filter((x) => !x.kind).length, moves: list.filter((x) => x.kind).length, receipts: Object.keys(done).length }, receiptsLeft: Math.max(0, todo.length - RECEIPTS_PER_RUN) };
    await kv.put('backup', JSON.stringify(out));
    return out;
  } catch (err) {
    const raw = String((err && err.message) || err).slice(0, 300);
    // sign-in problems say what to do; anything else is Google (or the line to it) having a moment
    const out = { ...st, error: /sign-in|not connected/.test(raw) ? raw : "Google Drive didn't answer", detail: raw, errAt: now };
    await kv.put('backup', JSON.stringify(out));
    return out;
  }
}

// After a money change: back up if today (in Japan) hasn't been and Drive is connected.
// Remembered in memory too, so most money changes cost no extra KV read.
let doneDay = '';
export async function autoBackup(env, kv, load) {
  const now = Date.now(), today = japanDay(now);
  if (doneDay === today) return null;
  const st = (await kv.get('backup', 'json')) || {};
  if (st.day === today) { doneDay = today; return null; }
  // a try earlier today that didn't finish waits an hour (and two phones saving at once don't both run it)
  if ((st.tried && now - st.tried < RETRY_AFTER && japanDay(st.tried) === today) || !(await kv.get('gdrive'))) return null;
  await kv.put('backup', JSON.stringify({ ...st, tried: now }));
  const out = await backupMoney(env, kv, load);
  if (out.day === today) doneDay = today;
  return out;
}

export async function backupStatus(kv) {
  const st = (await kv.get('backup', 'json')) || {};
  return { connected: !!(await kv.get('gdrive')), day: st.day || null, at: st.at || null, error: st.error || null, errAt: st.errAt || null, counts: st.counts || null, receiptsLeft: st.receiptsLeft || 0 };
}
export const resetBackupMemory = () => { doneDay = ''; };
