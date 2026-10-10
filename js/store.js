// Shared state store: checks, choices, suggestions.
// Talks to /api (Cloudflare Pages Function + KV). Falls back to localStorage-only
// when the API is unreachable, and always mirrors to localStorage for offline use.

const LS_KEY = 'japan2026.state.v1';
const LS_DEVICE = 'japan2026.device';
const LS_NAME = 'japan2026.name';
const LS_OUTBOX = 'japan2026.outbox.v1';
const POLL_MS = 20000;

// Practice mode (the guided tour): changes live only in this tab's sessionStorage, nothing is sent to the
// server or written to localStorage, and syncing pauses. Ending the tour drops it all.
export const SANDBOX = (() => { try { return sessionStorage.getItem('tour.on') === '1'; } catch { return false; } })();
const SB_KEY = 'tour.state';
const sbGet = () => { try { return JSON.parse(sessionStorage.getItem(SB_KEY)); } catch { return null; } };

// Guests (picked on the trips page) can look at everything but change nothing. The four of us unlock changes once
// per phone with the group's PIN, kept in localStorage and sent with every change; the server checks it.
export const GUEST = (() => { try { return JSON.parse(localStorage.getItem('trips.me')) === 'guest'; } catch { return false; } })();
const pinOf = () => { try { return localStorage.getItem('trips.pin') || ''; } catch { return ''; } };

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function deviceId() {
  let id = lsGet(LS_DEVICE, null);
  // practice mode: a phone without an id gets a temporary one that is forgotten with the practice
  if (!id && SANDBOX) { try { id = sessionStorage.getItem('tour.device'); if (!id) { id = 'dv-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('tour.device', id); } } catch {} return id; }
  if (!id) {
    id = 'dv-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    lsSet(LS_DEVICE, id);
  }
  return id;
}

export function getDisplayName() { return lsGet(LS_NAME, ''); }
export function setDisplayName(name) { lsSet(LS_NAME, String(name || '').slice(0, 40)); }

export const store = {
  state: Object.assign({ checks: {}, choices: {}, suggestions: [], custom: {}, expenses: {}, profiles: {}, covers: {}, updatedAt: null }, (SANDBOX && sbGet()) || lsGet(LS_KEY, {})),
  mode: SANDBOX ? 'sandbox' : 'connecting', // connecting | online | local | sandbox | locked (the PIN was refused)
  lastError: null,
  listeners: new Set(),
  _timer: null,

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) { try { fn(this.state, this); } catch (e) { console.error(e); } } },
  persist() { if (SANDBOX) { try { sessionStorage.setItem(SB_KEY, JSON.stringify(this.state)); } catch { /* ignore */ } return; } lsSet(LS_KEY, this.state); },

  setMode(mode, err) {
    const changed = this.mode !== mode || (err && err !== this.lastError);
    this.mode = mode; this.lastError = err || null;
    if (changed) this.emit();
  },

  async api(path, body) {
    const res = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json', 'x-trip-pin': pinOf() } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || ('HTTP ' + res.status)); err.pin = !!data.pin; err.status = res.status; throw err; }
    return data;
  },

  // Changes not yet saved on the server, oldest first, kept in localStorage so they survive no signal, a 429 or the app
  // being closed. Each is sent once the server is reachable again, before this phone takes the shared copy, and until
  // then it is laid back over every copy this phone downloads, so nothing made offline is lost or flickers back.
  _outbox: SANDBOX ? [] : lsGet(LS_OUTBOX, []),
  _saveOutbox() { lsSet(LS_OUTBOX, this._outbox); },
  pending() { return this._outbox.length; },
  _replay(s) { for (const op of this._outbox) applyOp(s, op); },
  _flushing: null,
  flush() {
    if (!this._flushing) this._flushing = this._flush().finally(() => { this._flushing = null; });
    return this._flushing;
  },
  async _flush() {
    while (this._outbox.length) {
      const op = this._outbox[0];
      let data;
      try { data = await this.api(op.path, op.body); } catch (err) {
        if (err.pin) { await this._locked(); return false; }
        // The server refused this change for good (it was malformed, or a vote on an idea someone deleted): drop it
        // rather than hold up everything queued behind it. Anything else (offline, 429, 5xx) is tried again later.
        if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) { this._outbox.shift(); this._saveOutbox(); continue; }
        this.setMode('local', err.message); return false;
      }
      this._outbox.shift(); this._saveOutbox();
      if (op.path === 'expenses') this._exRecent.set(op.body.id, { v: op.body.value, t: Date.now() });
      this.setMode('online');
      // Take the server's copy of what this change touched, then lay the rest of the queue for it back on top
      // (only for that part: the others already carry their queued changes, and a vote applied twice undoes itself).
      const k = keyOf(op);
      if (data[k]) {
        this.state[k] = k === 'expenses' ? this._overlayExpenses(data[k]) : data[k];
        for (const o of this._outbox) if (keyOf(o) === k) applyOp(this.state, o);
      }
      this.persist(); this.emit();
    }
    return true;
  },

  async start() {
    if (SANDBOX) {
      // Start the practice from a read-only copy of the real trip (once per tour), then stay offline.
      if (!sbGet()) {
        try { const remote = await this.api('state'); this.state = { ...this.state, ...remote }; } catch { /* practice from the local copy */ }
        if (GUEST) this.state.expenses = {}; // a guest practises on an empty expense list: the real one stays private
        this.persist();
      }
      this.mode = 'sandbox'; this.emit(); return;
    }
    await this.refresh();
    if (this._timer) clearInterval(this._timer);
    // Cheap check every 20s while the app is on screen: one KV read for the version stamp. The full state
    // (which costs KV list operations, limited on the free plan) is fetched only when something changed.
    this._timer = setInterval(() => { if (document.visibilityState !== 'hidden') this.check(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.check(); });
    window.addEventListener('online', () => this.refresh());
  },

  async check() {
    if (SANDBOX) return;
    if (this._outbox.length) return this.refresh();
    try {
      const v = await this.api('version');
      if (v.updatedAt && v.updatedAt === this.state.updatedAt && (this.mode === 'online' || this.mode === 'locked')) return;
      await this.refresh();
    } catch (err) {
      this.setMode('local', err.message);
    }
  },

  async refresh() {
    if (SANDBOX) return;
    // Send what this phone changed offline first; while that still fails, keep showing the local copy.
    if (this._outbox.length && !(await this.flush())) return;
    try {
      const remote = await this.api('state');
      this.state = { checks: remote.checks || {}, choices: remote.choices || {}, suggestions: remote.suggestions || [], custom: remote.custom || {}, expenses: this._overlayExpenses(remote.expenses), profiles: { ...(remote.profiles || {}), ...this._pfRecent() }, covers: remote.covers || {}, updatedAt: remote.updatedAt || null };
      this._replay(this.state); // anything changed while the copy was downloading
      this.persist();
      this.setMode(this.mode === 'locked' && !pinOf() ? 'locked' : 'online');
      this.emit();
    } catch (err) {
      this.setMode('local', err.message);
    }
  },

  // Show the change at once, queue it, and send the queue. It stays queued (local mode) until the server has it.
  _mutate(path, body, meta) {
    const op = meta ? { path, body, meta } : { path, body };
    if (SANDBOX) { applyOp(this.state, op); this.persist(); this.emit(); return Promise.resolve(); }
    if (GUEST) return Promise.resolve(); // view only (the pages hide every way to change things; this is the backstop)
    applyOp(this.state, op);
    this._outbox.push(op); this._saveOutbox();
    this.persist();
    this.emit();
    return this.flush();
  },
  // Profiles (a colour, a photo) are sent straight away and not queued: a photo is too big to keep in localStorage.
  async _send(localFn, path, body, applyRemote) {
    if (SANDBOX) { localFn(this.state); this.persist(); this.emit(); return; }
    if (GUEST) return; // view only (the pages hide every way to change things; this is the backstop)
    localFn(this.state);
    this.persist();
    this.emit();
    try {
      const data = await this.api(path, body);
      applyRemote(data, this.state);
      this.persist();
      this.setMode('online');
      this.emit();
    } catch (err) {
      if (err.pin) return this._locked();
      this.setMode('local', err.message);
    }
  },
  // The server refused the PIN (none saved on this phone, or it changed): forget it, drop the change that didn't save,
  // and show "locked" until the PIN is entered again on the trips page.
  async _locked() {
    try { localStorage.removeItem('trips.pin'); } catch { /* ignore */ }
    this._exRecent.clear(); this._pf.clear(); this._outbox = []; this._saveOutbox();
    await this.refresh();
    this.setMode('locked', 'Enter the PIN to save changes');
  },

  isChecked(id) { return !!this.state.checks[id]; },
  toggleCheck(id) {
    return this._mutate('checks', { id, value: !this.state.checks[id] });
  },

  getChoice(id, fallback) { return this.state.choices[id] || fallback; },
  setChoice(id, value) { return this._mutate('choices', { id, value }); },

  // Edits, hidden stops and added stops, keyed by stop id. value null removes the record (reset / delete).
  getCustom(id) { return (this.state.custom || {})[id] || null; },
  setCustom(id, value) { return this._mutate('custom', { id, value: value || null }, { ts: new Date().toISOString() }); },

  // Shared expenses, keyed by id. value null deletes.
  // The server lists expenses with up to ~60s lag after a write, so this phone's recent changes are laid over what it returns.
  _exRecent: new Map(),
  _overlayExpenses(remote) {
    const out = { ...(remote || {}) };
    const now = Date.now();
    for (const [id, r] of this._exRecent) {
      if (now - r.t > 90000) { this._exRecent.delete(id); continue; }
      if (r.v) out[id] = { ...(out[id] || {}), ...r.v }; else delete out[id];
    }
    return out;
  },
  getExpenses() { return this.state.expenses || {}; },
  setExpense(id, value) { return this._mutate('expenses', { id, value: value || null }); },

  // Profiles: colour and photo per person. The photo itself is served by /api/photo/<id>?v=<photo stamp>.
  _pf: new Map(),
  _pfRecent() { const out = {}; const now = Date.now(); for (const [id, r] of this._pf) { if (now - r.t > 90000) this._pf.delete(id); else out[id] = r.v; } return out; },
  getProfiles() { return this.state.profiles || {}; },
  photoUrl(id) { const p = (this.state.profiles || {})[id]; if (!p || !p.photo) return ''; return p.local || `/api/photo/${id}?v=${p.photo}`; },
  setProfile(id, patch, localPhoto) {
    const cur = { ...((this.state.profiles || {})[id] || {}) };
    if (patch.color !== undefined) cur.color = patch.color;
    if (patch.photo === null) { delete cur.photo; delete cur.local; } else if (patch.photo) { cur.photo = Date.now(); cur.local = localPhoto || patch.photo; }
    this._pf.set(id, { v: cur, t: Date.now() });
    return this._send(
      (s) => { s.profiles = { ...(s.profiles || {}), [id]: cur }; },
      'profile', { id, ...patch },
      (d, s) => { if (d.profiles) { const keep = d.profiles[id] && cur.local && d.profiles[id].photo ? { ...d.profiles[id], local: cur.local } : d.profiles[id]; s.profiles = { ...d.profiles, [id]: keep }; this._pf.set(id, { v: keep, t: Date.now() }); } },
    );
  },

  addSuggestion({ text, name, day, kind = 'food' }) {
    const author = deviceId();
    const temp = { id: 'tmp-' + Date.now(), text, name: name || 'Anonymous', day: day || null, kind, author, votes: [], ts: new Date().toISOString(), pending: !SANDBOX };
    return this._mutate('suggestions', { text, name, day, kind, author }, { temp });
  },
  toggleVote(id, who) { return this._mutate('suggestions/' + id + '/vote', { voter: who || deviceId() }); },
  deleteSuggestion(id) { return this._mutate('suggestions/' + id + '/delete', { author: deviceId() }); },
};

const keyOf = (op) => op.path.split('/')[0];

// What a queued change does to this phone's copy: the same thing the server will do with it.
function applyOp(s, { path, body, meta }) {
  const { id, value } = body;
  if (path === 'checks') { if (value) s.checks[id] = true; else delete s.checks[id]; return; }
  if (path === 'choices') { if (value) s.choices[id] = value; else delete s.choices[id]; return; }
  if (path === 'custom') { s.custom = s.custom || {}; if (value) s.custom[id] = { ...value, ts: meta.ts }; else delete s.custom[id]; return; }
  if (path === 'expenses') { s.expenses = { ...(s.expenses || {}) }; if (value) s.expenses[id] = { ...(s.expenses[id] || {}), ...value }; else delete s.expenses[id]; return; }
  if (path === 'suggestions') { if (!s.suggestions.some((x) => x.id === meta.temp.id)) s.suggestions.unshift({ ...meta.temp }); return; }
  const m = path.match(/^suggestions\/(.+)\/(vote|delete)$/);
  if (!m) return;
  if (m[2] === 'delete') { s.suggestions = s.suggestions.filter((x) => x.id !== m[1]); return; }
  const it = s.suggestions.find((x) => x.id === m[1]); if (!it) return;
  const v = new Set(it.votes || []); if (v.has(body.voter)) v.delete(body.voter); else v.add(body.voter); it.votes = [...v];
}
