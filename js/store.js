// Shared state store: checks, choices, suggestions.
// Talks to /api (Cloudflare Pages Function + KV). Falls back to localStorage-only
// when the API is unreachable, and always mirrors to localStorage for offline use.

const LS_KEY = 'japan2026.state.v1';
const LS_DEVICE = 'japan2026.device';
const LS_NAME = 'japan2026.name';
const POLL_MS = 20000;

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function deviceId() {
  let id = lsGet(LS_DEVICE, null);
  if (!id) {
    id = 'dv-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    lsSet(LS_DEVICE, id);
  }
  return id;
}

export function getDisplayName() { return lsGet(LS_NAME, ''); }
export function setDisplayName(name) { lsSet(LS_NAME, String(name || '').slice(0, 40)); }

export const store = {
  state: Object.assign({ checks: {}, choices: {}, suggestions: [], custom: {}, updatedAt: null }, lsGet(LS_KEY, {})),
  mode: 'connecting', // connecting | online | local
  lastError: null,
  listeners: new Set(),
  _timer: null,

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) { try { fn(this.state, this); } catch (e) { console.error(e); } } },
  persist() { lsSet(LS_KEY, this.state); },

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
    await this.refresh();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.refresh(), POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.refresh(); });
    window.addEventListener('online', () => this.refresh());
  },

  async refresh() {
    try {
      const remote = await this.api('state');
      this.state = { checks: remote.checks || {}, choices: remote.choices || {}, suggestions: remote.suggestions || [], custom: remote.custom || {}, updatedAt: remote.updatedAt || null };
      this.persist();
      this.setMode('online');
      this.emit();
    } catch (err) {
      this.setMode('local', err.message);
    }
  },

  // Optimistic update then sync. On API failure, keep the local change (local mode).
  async _mutate(localFn, path, body, applyRemote) {
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

  addSuggestion({ text, name, day }) {
    const author = deviceId();
    const temp = { id: 'tmp-' + Date.now(), text, name: name || 'Anonymous', day: day || null, author, votes: [], ts: new Date().toISOString(), pending: true };
    return this._mutate(
      (s) => { s.suggestions.unshift(temp); },
      'suggestions', { text, name, day, author },
      (d, s) => { if (d.suggestions) s.suggestions = d.suggestions; },
    );
  },
  toggleVote(id) {
    const voter = deviceId();
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
