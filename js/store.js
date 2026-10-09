// Shared state store: checks, choices, suggestions.
// Talks to /api (Cloudflare Pages Function + KV). Falls back to localStorage-only
// when the API is unreachable, and always mirrors to localStorage for offline use.

const LS_KEY = 'japan2026.state.v1';
const LS_DEVICE = 'japan2026.device';
const LS_NAME = 'japan2026.name';
const POLL_MS = 20000;

// Practice mode (the guided tour): changes live only in this tab's sessionStorage, nothing is sent to the
// server or written to localStorage, and syncing pauses. Ending the tour drops it all.
export const SANDBOX = (() => { try { return sessionStorage.getItem('tour.on') === '1'; } catch { return false; } })();
const SB_KEY = 'tour.state';
const sbGet = () => { try { return JSON.parse(sessionStorage.getItem(SB_KEY)); } catch { return null; } };

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
  state: Object.assign({ checks: {}, choices: {}, suggestions: [], custom: {}, expenses: {}, profiles: {}, updatedAt: null }, (SANDBOX && sbGet()) || lsGet(LS_KEY, {})),
  mode: SANDBOX ? 'sandbox' : 'connecting', // connecting | online | local | sandbox
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
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  },

  async start() {
    if (SANDBOX) {
      // Start the practice from a read-only copy of the real trip (once per tour), then stay offline.
      if (!sbGet()) { try { const remote = await this.api('state'); this.state = { ...this.state, ...remote }; } catch { /* practice from the local copy */ } this.persist(); }
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
    try {
      const v = await this.api('version');
      if (v.updatedAt && v.updatedAt === this.state.updatedAt && this.mode === 'online') return;
      await this.refresh();
    } catch (err) {
      this.setMode('local', err.message);
    }
  },

  async refresh() {
    if (SANDBOX) return;
    try {
      const remote = await this.api('state');
      this.state = { checks: remote.checks || {}, choices: remote.choices || {}, suggestions: remote.suggestions || [], custom: remote.custom || {}, expenses: this._overlayExpenses(remote.expenses), profiles: { ...(remote.profiles || {}), ...this._pfRecent() }, updatedAt: remote.updatedAt || null };
      this.persist();
      this.setMode('online');
      this.emit();
    } catch (err) {
      this.setMode('local', err.message);
    }
  },

  // Optimistic update then sync. On API failure, keep the local change (local mode).
  async _mutate(localFn, path, body, applyRemote) {
    if (SANDBOX) { localFn(this.state); this.persist(); this.emit(); return; }
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
      this.setMode('local', err.message);
    }
  },

  isChecked(id) { return !!this.state.checks[id]; },
  toggleCheck(id) {
    const value = !this.state.checks[id];
    return this._mutate(
      (s) => { if (value) s.checks[id] = true; else delete s.checks[id]; },
      'checks', { id, value },
      (d, s) => { if (d.checks) s.checks = d.checks; },
    );
  },

  getChoice(id, fallback) { return this.state.choices[id] || fallback; },
  setChoice(id, value) {
    return this._mutate(
      (s) => { s.choices[id] = value; },
      'choices', { id, value },
      (d, s) => { if (d.choices) s.choices = d.choices; },
    );
  },

  // Edits, hidden stops and added stops, keyed by stop id. value null removes the record (reset / delete).
  getCustom(id) { return (this.state.custom || {})[id] || null; },
  setCustom(id, value) {
    return this._mutate(
      (s) => { s.custom = s.custom || {}; if (value) s.custom[id] = { ...value, ts: new Date().toISOString() }; else delete s.custom[id]; },
      'custom', { id, value: value || null },
      (d, s) => { if (d.custom) s.custom = d.custom; },
    );
  },

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
  setExpense(id, value) {
    this._exRecent.set(id, { v: value || null, t: Date.now() });
    return this._mutate(
      (s) => { s.expenses = this._overlayExpenses(s.expenses); },
      'expenses', { id, value: value || null },
      (d, s) => { if (d.expenses) s.expenses = this._overlayExpenses(d.expenses); },
    );
  },

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
    return this._mutate(
      (s) => { s.profiles = { ...(s.profiles || {}), [id]: cur }; },
      'profile', { id, ...patch },
      (d, s) => { if (d.profiles) { const keep = d.profiles[id] && cur.local && d.profiles[id].photo ? { ...d.profiles[id], local: cur.local } : d.profiles[id]; s.profiles = { ...d.profiles, [id]: keep }; this._pf.set(id, { v: keep, t: Date.now() }); } },
    );
  },

  addSuggestion({ text, name, day }) {
    const author = deviceId();
    const temp = { id: 'tmp-' + Date.now(), text, name: name || 'Anonymous', day: day || null, author, votes: [], ts: new Date().toISOString(), pending: !SANDBOX };
    return this._mutate(
      (s) => { s.suggestions.unshift(temp); },
      'suggestions', { text, name, day, author },
      (d, s) => { if (d.suggestions) s.suggestions = d.suggestions; },
    );
  },
  toggleVote(id, who) {
    const voter = who || deviceId();
    return this._mutate(
      (s) => { const it = s.suggestions.find((x) => x.id === id); if (!it) return; const v = new Set(it.votes || []); if (v.has(voter)) v.delete(voter); else v.add(voter); it.votes = [...v]; },
      'suggestions/' + id + '/vote', { voter },
      (d, s) => { if (d.suggestions) s.suggestions = d.suggestions; },
    );
  },
  deleteSuggestion(id) {
    const author = deviceId();
    return this._mutate(
      (s) => { s.suggestions = s.suggestions.filter((x) => x.id !== id); },
      'suggestions/' + id + '/delete', { author },
      (d, s) => { if (d.suggestions) s.suggestions = d.suggestions; },
    );
  },
};
