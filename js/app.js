import { TRIP, HOTELS, DAYS } from '../data/itinerary.js';
import { BOOKINGS, FOOD, TIPS, SUGGESTIONS } from '../data/guide.js';
import { store, getDisplayName, setDisplayName, deviceId } from './store.js';
import { createMap, gmapsDir, gmapsPlace, modeStyle } from './map.js';

// ───────────────────────── helpers ─────────────────────────
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmtDate = (iso) => { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
const hotelOf = (id) => HOTELS.find((x) => x.id === id);
const dayById = (id) => DAYS.find((d) => d.id === id);

// ───────────────────────── state ─────────────────────────
const ui = {
  tab: 'days',
  dayId: null,
  who: 'all',
  mapScope: 'day',
  expanded: new Set(),
};
try { ui.who = localStorage.getItem('japan2026.who') || 'all'; } catch { /* ignore */ }

function todayId() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const d = DAYS.find((x) => x.date === iso);
  return d ? d.id : null;
}

// Resolve the items that are actually in play for a day: expand chosen options, apply who filter.
function visibleItems(day) {
  const out = [];
  const push = (it) => {
    const who = it.who || 'all';
    if (ui.who !== 'all' && who !== 'all' && who !== ui.who) return;
    out.push(it);
  };
  for (const it of day.items) {
    if (it.type === 'choice') {
      const who = it.who || 'all';
      if (ui.who !== 'all' && who !== 'all' && who !== ui.who) continue;
      out.push(it);
      const chosen = store.getChoice(it.id, it.default);
      const opt = it.options.find((o) => o.id === chosen) || it.options[0];
      for (const sub of opt.items) push({ ...sub, _fromChoice: it.id });
    } else push(it);
  }
  return out;
}

function dayStops(day) {
  const items = visibleItems(day).filter((i) => i.type === 'event' && i.place);
  // merge consecutive stops at the same coordinates (e.g. hotel → hotel)
  const stops = [];
  items.forEach((it) => {
    const prev = stops[stops.length - 1];
    if (prev && prev.place.lat === it.place.lat && prev.place.lng === it.place.lng) { prev.ids.push(it.id); return; }
    stops.push({ id: it.id, ids: [it.id], n: stops.length + 1, place: it.place, subplaces: it.subplaces, title: it.title, time: it.time, travel: it.travel, optional: !!it.optional, who: it.who || 'all', done: store.isChecked(it.id) });
  });
  return stops;
}

function dayProgress(day) {
  const evs = visibleItems(day).filter((i) => i.type === 'event');
  const done = evs.filter((e) => store.isChecked(e.id)).length;
  return { done, total: evs.length };
}

// ───────────────────────── map (single instance, re-parented) ─────────────────────────
const mapEl = document.createElement('div');
mapEl.className = 'map'; mapEl.id = 'map';
$('#map-side').replaceWith(mapEl);
const theMap = createMap(mapEl);

function placeMap() {
  const desktop = window.matchMedia('(min-width: 960px)').matches;
  const target = (ui.tab === 'map') ? $('#panel-map') : (desktop && ui.tab === 'days' ? $('#sidemap') : null);
  if (!target) return;
  if (ui.tab === 'map') {
    const toolbar = $('.map-toolbar'); if (mapEl.parentElement !== target) target.insertBefore(mapEl, toolbar.nextSibling);
  } else if (mapEl.parentElement !== target) target.appendChild(mapEl);
  theMap.map.invalidateSize();
}

function refreshMap() {
  const day = dayById(ui.dayId);
  if (ui.tab !== 'map') { ui.mapScope = 'day'; }
  $$('.seg [data-scope]').forEach((b) => b.classList.toggle('on', b.dataset.scope === ui.mapScope));
  if (ui.mapScope === 'trip') {
    const pts = HOTELS.map((hh, i) => ({ ...hh, label: `H${i + 1}`, sub: `${hh.city} · ${hh.dates}` }));
    theMap.showOverview(pts);
    renderStops(pts.map((p) => ({ n: p.label, title: p.name, time: p.sub, id: null })));
  } else if (ui.mapScope === 'food') {
    const pts = [];
    FOOD.forEach((c) => [...c.items, ...c.cafes].forEach((f) => f.lat && pts.push({ name: f.name, lat: f.lat, lng: f.lng, sub: f.meta || c.city, q: f.name.split(' — ').pop().split(' · ')[0] })));
    theMap.showPoints(pts);
    renderStops([]);
  } else {
    const stops = dayStops(day);
    theMap.showDay(stops, { onSelect: (id) => highlightEvent(id) });
    renderStops(stops);
  }
}

function renderStops(stops) {
  const el = $('#stops');
  el.innerHTML = '';
  stops.forEach((s) => {
    const b = h(`<button type="button" class="stop"><span class="n">${esc(s.n)}</span><b>${esc(s.title)}</b><small>${esc(s.time || '')}</small></button>`);
    b.addEventListener('click', () => { if (s.id) theMap.focus(s.id); });
    el.appendChild(b);
  });
  $('#legend').innerHTML = ['walk', 'taxi', 'drive', 'transit', 'boat'].map((m) => { const st = modeStyle(m); return `<span><i class="${st.dash ? 'dash' : ''}" style="border-color:${st.color}"></i>${m}</span>`; }).join('');
}

function highlightEvent(id) {
  if (ui.tab !== 'days') switchTab('days');
  const el = document.getElementById('ev-' + id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
}

// ───────────────────────── day strip ─────────────────────────
function renderStrip() {
  const el = $('#daystrip');
  el.innerHTML = '';
  const tid = todayId();
  DAYS.forEach((d) => {
    const p = dayProgress(d);
    const b = h(`<button type="button" class="daybtn ${d.id === ui.dayId ? 'on' : ''} ${d.id === tid ? 'today' : ''}"><b>D${String(d.n).padStart(2, '0')}</b><small>${d.dow} ${fmtDate(d.date).split(', ')[1]}</small><em>${esc(d.city)}</em><span class="prog"><i style="width:${p.total ? Math.round(100 * p.done / p.total) : 0}%"></i></span></button>`);
    b.addEventListener('click', () => selectDay(d.id));
    el.appendChild(b);
  });
  const on = $('.daybtn.on', el);
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

function selectDay(id, { silent } = {}) {
  ui.dayId = id;
  if (!silent) location.hash = '#' + id;
  renderStrip();
  renderDay();
  refreshMap();
}

// ───────────────────────── day timeline ─────────────────────────
function renderDay() {
  const day = dayById(ui.dayId);
  const el = $('#timeline');
  el.innerHTML = '';
  if (!day) return;
  const hotel = hotelOf(day.hotel);
  const p = dayProgress(day);
  const prev = DAYS[day.n - 2], next = DAYS[day.n];
  el.appendChild(h(`
    <div class="dayhead">
      <div class="kicker">Day ${day.n} of 17 · ${fmtDate(day.date)} · ${esc(day.city)}</div>
      <h2>${esc(day.title)}</h2>
      <div class="tag">✦ ${esc(day.tagline)}</div>
      <div class="meta">
        <span>Energy <b class="energy-${esc(day.energy.split(' ')[0])}">${esc(day.energy)}</b></span>
        <span>🍽 ${esc(day.dinner)}</span>
        <span>🏨 <a href="${gmapsPlace(hotel)}" target="_blank" rel="noopener">${esc(hotel.name)}</a></span>
        <span>✅ ${p.done}/${p.total} done</span>
      </div>
      <div class="actions">
        ${prev ? `<button type="button" class="btn small" data-go="${prev.id}">← D${String(prev.n).padStart(2, '0')}</button>` : ''}
        ${next ? `<button type="button" class="btn small" data-go="${next.id}">D${String(next.n).padStart(2, '0')} →</button>` : ''}
        <button type="button" class="btn small" data-act="map">🗺 Map this day</button>
        <button type="button" class="btn small" data-act="ideas">💡 Ideas for this day</button>
      </div>
    </div>`));
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => selectDay(b.dataset.go)));
  $('[data-act="map"]', el).addEventListener('click', () => switchTab('map'));
  $('[data-act="ideas"]', el).addEventListener('click', () => { ui.ideasDay = day.id; switchTab('ideas'); });

  const stops = dayStops(day);
  const numOf = (id) => { const s = stops.find((x) => x.ids.includes(id)); return s ? s.n : null; };
  const items = visibleItems(day);
  let lastPinned = null;

  for (const it of items) {
    if (it.type === 'section') { el.appendChild(h(`<div class="section-h">${esc(it.title)}</div>`)); continue; }
    if (it.type === 'note') { el.appendChild(renderNote(it)); continue; }
    if (it.type === 'choice') { el.appendChild(renderChoice(it)); continue; }
    // event
    const n = it.place ? numOf(it.id) : null;
    const wrap = h(`<div class="ev ${it.who && it.who !== 'all' ? it.who : ''} ${it.optional ? 'optional' : ''} ${it.tbd ? 'tbd' : ''} ${store.isChecked(it.id) ? 'done' : ''}" id="ev-${esc(it.id)}"></div>`);
    if (it.place && it.travel && lastPinned && n && numOf(lastPinned.id) !== n) {
      const st = modeStyle(it.travel.mode);
      wrap.appendChild(h(`<div class="travel"><span class="mode">${st.icon}</span><span>${esc(it.travel.label || it.travel.mode)}</span><a href="${gmapsDir(lastPinned.place, it.place, it.travel.mode)}" target="_blank" rel="noopener">Directions ↗</a></div>`));
    }
    const numBtn = h(`<button type="button" class="num ${n ? '' : 'none'}" ${n ? `title="Show on map"` : 'tabindex="-1"'}>${n || '·'}</button>`);
    if (n) numBtn.addEventListener('click', () => { if (!window.matchMedia('(min-width: 960px)').matches) switchTab('map'); setTimeout(() => theMap.focus(it.id), 80); });
    wrap.appendChild(numBtn);

    const long = (it.desc || '').length > 220 || (it.desc || '').includes('\n');
    const expanded = ui.expanded.has(it.id);
    const chips = [];
    if (it.confirmed) chips.push('<span class="chip confirmed">✓ Confirmed</span>');
    if (it.tbd) chips.push('<span class="chip tbd">TBD — decide</span>');
    if (it.optional) chips.push('<span class="chip optional">Optional</span>');
    if (it.who && it.who !== 'all') chips.push(`<span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span>`);
    if (it.cost) chips.push(`<span class="chip cost">💴 ${esc(it.cost)}</span>`);
    (it.tags || []).filter((t) => !['transit', 'logistics'].includes(t)).forEach((t) => chips.push(`<span class="chip">${esc(t)}</span>`));
    const card = h(`
      <div class="card">
        <div class="row">
          <div style="flex:1;min-width:0">
            <div class="time">${esc(it.time)}</div>
            <div class="title">${esc(it.title)}</div>
            ${it.desc ? `<div class="desc ${long && !expanded ? 'clamp' : ''}">${esc(it.desc)}</div>` : ''}
            ${long ? `<button type="button" class="more">${expanded ? 'Show less' : 'Read more'}</button>` : ''}
          </div>
          <button type="button" class="check ${store.isChecked(it.id) ? 'on' : ''}" aria-label="Mark done">✓</button>
        </div>
        ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
        ${it.place ? `<div class="links"><a class="btn small" href="${gmapsPlace(it.place)}" target="_blank" rel="noopener">📍 ${esc(it.place.name)}</a>${(it.subplaces || []).map((sp) => `<a class="btn small" href="${gmapsPlace(sp)}" target="_blank" rel="noopener">📍 ${esc(sp.name)}</a>`).join('')}</div>` : ''}
      </div>`);
    const more = $('.more', card);
    if (more) more.addEventListener('click', () => { if (ui.expanded.has(it.id)) ui.expanded.delete(it.id); else ui.expanded.add(it.id); renderDay(); });
    $('.check', card).addEventListener('click', () => store.toggleCheck(it.id));
    wrap.appendChild(card);
    el.appendChild(wrap);
    if (it.place) lastPinned = it;
  }
  if (!items.some((i) => i.type === 'event')) el.appendChild(h(`<div class="empty">Nothing scheduled for ${TRIP.travelers[ui.who].short} on this day.</div>`));
}

function renderNote(it) {
  const kind = it.kind || 'note';
  const icon = { note: 'ℹ️', warn: '⚠️', book: '🎫', decide: '⚑', tip: '💡' }[kind] || 'ℹ️';
  const who = it.who && it.who !== 'all' ? `<span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span> ` : '';
  return h(`<div class="note ${kind}"><h4>${icon} ${who}${esc(it.title)}</h4><p>${esc(it.text)}</p>${it.link ? `<a class="btn small" href="${esc(it.link.url)}" target="_blank" rel="noopener">${esc(it.link.label)} ↗</a>` : ''}</div>`);
}

function renderChoice(it) {
  const chosen = store.getChoice(it.id, it.default);
  const box = h(`<div class="choice"><h4>${esc(it.title)}${it.who && it.who !== 'all' ? ` <span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span>` : ''}</h4>${it.text ? `<p>${esc(it.text)}</p>` : ''}<div class="opts"></div><div class="picked">Shared pick — everyone sees the same choice. Tap to change.</div></div>`);
  const opts = $('.opts', box);
  it.options.forEach((o) => {
    const b = h(`<button type="button" class="opt ${o.id === chosen ? 'on' : ''}"><span class="radio"></span><span><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span></button>`);
    b.addEventListener('click', () => store.setChoice(it.id, o.id));
    opts.appendChild(b);
  });
  return box;
}

// ───────────────────────── bookings ─────────────────────────
function renderBookings() {
  const el = $('#bookings');
  const card = (b, cls) => `<div class="bk ${cls} ${b.urgent ? 'urgent' : ''}"><div class="when">${esc(b.when)}${b.who ? ` · <span class="chip ${b.who}">${TRIP.travelers[b.who].short}</span>` : ''}</div><div class="t">${b.urgent ? '🔴 ' : ''}${esc(b.title)}</div><p>${esc(b.detail)}</p><div class="links">${b.day ? `<button type="button" class="btn small" data-go="${b.day}">Open day</button>` : ''}${b.tel ? `<a class="btn small" href="tel:${b.tel}">📞 Call</a>` : ''}</div></div>`;
  el.innerHTML = `
    <h2 class="h2">Still to do</h2>
    <div class="sub">Book closer to the date or on the day. Red = book now.</div>
    ${BOOKINGS.closer.map((b) => card(b, 'closer')).join('')}
    <h2 class="h2">Confirmed</h2>
    <div class="sub">Completed — no further action needed.</div>
    ${BOOKINGS.confirmed.map((b) => card(b, '')).join('')}
    <h2 class="h2">Hotels</h2>
    ${HOTELS.map((hh) => `<div class="bk"><div class="when">${esc(hh.dates)} · ${hh.nights} night${hh.nights > 1 ? 's' : ''}</div><div class="t">${esc(hh.name)}</div><p>${esc(hh.city)}</p><div class="links"><a class="btn small" href="${gmapsPlace(hh)}" target="_blank" rel="noopener">📍 Google Maps</a></div></div>`).join('')}`;
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => { selectDay(b.dataset.go); switchTab('days'); }));
}

// ───────────────────────── guide ─────────────────────────
function renderGuide() {
  const el = $('#guide');
  const food = (f) => `<div class="food"><div class="t">${f.star ? '<span class="star">●</span>' : ''}${esc(f.name)}</div>${f.meta ? `<div class="m">${esc(f.meta)}</div>` : ''}<p>${esc(f.text)}</p>${f.lat ? `<div class="links"><a class="btn small" href="${gmapsPlace({ q: f.name.split(' — ').pop().split(' · ')[0] })}" target="_blank" rel="noopener">📍 Google Maps</a></div>` : ''}</div>`;
  el.innerHTML = `
    <h2 class="h2">Must-eat food &amp; experiences</h2>
    <div class="sub">● = top priority. All pork-free friendly or easy to order that way.</div>
    ${FOOD.map((c) => `<details class="acc" open><summary>${esc(c.city)}</summary><div style="padding:0 10px 10px">${c.items.map(food).join('')}<div class="section-h">Cafés &amp; quick bites</div>${c.cafes.map(food).join('')}</div></details>`).join('')}
    <h2 class="h2">Trip tips — logistics + daily life</h2>
    ${TIPS.map((t) => `<details class="acc"><summary>${esc(t.title)}</summary><ul>${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>`).join('')}`;
}

// ───────────────────────── ideas / suggestions ─────────────────────────
function renderIdeas() {
  const el = $('#ideas');
  const dayFilter = ui.ideasDay || 'all';
  const name = getDisplayName();
  const curated = SUGGESTIONS.filter((s) => (dayFilter === 'all' || s.day === dayFilter || s.day === null) && (ui.who === 'all' || !s.who || s.who === ui.who));
  const mine = deviceId();
  const list = store.state.suggestions.filter((s) => dayFilter === 'all' || s.day === dayFilter || !s.day);
  const dayLabel = (id) => { const d = dayById(id); return d ? `D${String(d.n).padStart(2, '0')} ${d.dow}` : 'Any day'; };
  el.innerHTML = `
    <div class="filter">
      <button type="button" data-f="all" class="${dayFilter === 'all' ? 'on' : ''}">All days</button>
      ${DAYS.map((d) => `<button type="button" data-f="${d.id}" class="${dayFilter === d.id ? 'on' : ''}">D${String(d.n).padStart(2, '0')}</button>`).join('')}
    </div>
    <h2 class="h2">Add a suggestion</h2>
    <div class="sub">Shared with everyone on the trip. Vote on the ones you like.</div>
    <form class="form" id="sg-form">
      <textarea name="text" placeholder="A restaurant, a detour, a must-buy, a change to the plan…" required maxlength="1200"></textarea>
      <div class="row2">
        <input name="name" placeholder="Your name" value="${esc(name)}" maxlength="40">
        <select name="day"><option value="">Any day</option>${DAYS.map((d) => `<option value="${d.id}" ${dayFilter === d.id ? 'selected' : ''}>D${String(d.n).padStart(2, '0')} · ${esc(d.city)} · ${fmtDate(d.date)}</option>`).join('')}</select>
      </div>
      <button type="submit" class="btn primary">Post suggestion</button>
    </form>
    <h2 class="h2">Group suggestions ${list.length ? `(${list.length})` : ''}</h2>
    ${list.length ? list.map((s) => `<div class="sg ${s.pending ? 'pending' : ''}" data-id="${esc(s.id)}"><button type="button" class="vote ${(s.votes || []).includes(mine) ? 'on' : ''}">▲ ${(s.votes || []).length}<small>vote</small></button><div><div class="txt">${esc(s.text)}</div><div class="by">${esc(s.name || 'Anonymous')} · ${dayLabel(s.day)} · ${new Date(s.ts).toLocaleDateString()}${s.author === mine ? ' · <button type="button" class="del">delete</button>' : ''}</div></div></div>`).join('') : '<div class="empty">No suggestions yet — be the first.</div>'}
    <h2 class="h2">Curated ideas for open slots</h2>
    <div class="sub">Picks for the TBD dinners, free evenings and optional windows in the plan.</div>
    ${curated.map((s) => `<div class="idea"><div class="slot">${s.day ? dayLabel(s.day) + ' · ' : ''}${esc(s.slot)}${s.who ? ` · ${TRIP.travelers[s.who].short}` : ''}</div><div class="t">${esc(s.title)}</div>${s.picks.map((p) => `<div class="pick"><div><b>${esc(p.name)}</b><p>${esc(p.why)}</p></div>${p.lat ? `<a href="${gmapsPlace({ q: p.name.replace(/\(.*\)/, '').trim() })}" target="_blank" rel="noopener">📍 Map</a>` : ''}</div>`).join('')}${s.day ? `<div class="links" style="margin-top:8px"><button type="button" class="btn small" data-go="${s.day}">Open ${dayLabel(s.day)}</button></div>` : ''}</div>`).join('')}`;
  $$('[data-f]', el).forEach((b) => b.addEventListener('click', () => { ui.ideasDay = b.dataset.f === 'all' ? null : b.dataset.f; renderIdeas(); }));
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => { selectDay(b.dataset.go); switchTab('days'); }));
  $('#sg-form', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const text = String(fd.get('text') || '').trim();
    if (!text) return;
    setDisplayName(String(fd.get('name') || ''));
    store.addSuggestion({ text, name: String(fd.get('name') || '').trim(), day: String(fd.get('day') || '') || null });
    e.target.reset();
  });
  $$('.sg', el).forEach((card) => {
    const id = card.dataset.id;
    $('.vote', card).addEventListener('click', () => store.toggleVote(id));
    const del = $('.del', card); if (del) del.addEventListener('click', () => { if (confirm('Delete this suggestion?')) store.deleteSuggestion(id); });
  });
}

// ───────────────────────── search ─────────────────────────
function buildIndex() {
  const idx = [];
  DAYS.forEach((d) => {
    const walk = (items, ctx) => items.forEach((it) => {
      if (it.type === 'event') idx.push({ day: d, id: it.id, title: it.title, text: `${it.time} ${it.desc || ''} ${(it.place && it.place.name) || ''} ${ctx}`, kind: 'event' });
      else if (it.type === 'note') idx.push({ day: d, id: null, title: it.title, text: it.text, kind: 'note' });
      else if (it.type === 'choice') { idx.push({ day: d, id: null, title: it.title, text: it.text + ' ' + it.options.map((o) => o.label + ' ' + o.desc).join(' '), kind: 'choice' }); it.options.forEach((o) => walk(o.items, o.label)); }
    });
    walk(d.items, '');
  });
  FOOD.forEach((c) => [...c.items, ...c.cafes].forEach((f) => idx.push({ day: null, tab: 'guide', title: f.name, text: `${f.meta || ''} ${f.text} ${c.city}`, kind: 'food' })));
  [...BOOKINGS.confirmed, ...BOOKINGS.closer].forEach((b) => idx.push({ day: b.day ? dayById(b.day) : null, tab: 'bookings', title: b.title, text: `${b.when} ${b.detail}`, kind: 'booking' }));
  TIPS.forEach((t) => t.items.forEach((i) => idx.push({ day: null, tab: 'guide', title: t.title, text: i, kind: 'tip' })));
  SUGGESTIONS.forEach((s) => s.picks.forEach((p) => idx.push({ day: s.day ? dayById(s.day) : null, tab: 'ideas', title: p.name, text: `${s.slot} ${p.why}`, kind: 'idea' })));
  return idx;
}
let INDEX = null;
function runSearch(q) {
  const el = $('#search-results');
  q = q.trim().toLowerCase();
  if (q.length < 2) { el.innerHTML = '<div class="empty">Type at least 2 characters.</div>'; return; }
  INDEX = INDEX || buildIndex();
  const terms = q.split(/\s+/);
  const hits = INDEX.map((r) => { const hay = (r.title + ' ' + r.text).toLowerCase(); const score = terms.reduce((s, t) => s + (r.title.toLowerCase().includes(t) ? 3 : 0) + (hay.includes(t) ? 1 : 0), 0); return { r, score, ok: terms.every((t) => hay.includes(t)) }; }).filter((x) => x.ok).sort((a, b) => b.score - a.score).slice(0, 40);
  const mark = (s) => { let out = esc(s); terms.forEach((t) => { out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`); }); return out; };
  el.innerHTML = hits.length ? hits.map(({ r }, i) => `<button type="button" class="sr" data-i="${i}"><b>${mark(r.title)}</b><small>${r.day ? `D${String(r.day.n).padStart(2, '0')} ${r.day.dow} · ` : ''}${r.kind} · ${mark(r.text.slice(0, 140))}…</small></button>`).join('') : '<div class="empty">No matches.</div>';
  $$('.sr', el).forEach((b) => b.addEventListener('click', () => {
    const { r } = hits[+b.dataset.i];
    closeSearch();
    if (r.tab) { if (r.tab === 'ideas' && r.day) ui.ideasDay = r.day.id; switchTab(r.tab); return; }
    selectDay(r.day.id); switchTab('days');
    if (r.id) setTimeout(() => highlightEvent(r.id), 100);
  }));
}
function openSearch() { $('#search').hidden = false; $('#search-input').value = ''; runSearch(''); setTimeout(() => $('#search-input').focus(), 50); }
function closeSearch() { $('#search').hidden = true; }

// ───────────────────────── tabs / who / sync ─────────────────────────
function switchTab(tab) {
  ui.tab = tab;
  $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.panel').forEach((p) => p.classList.toggle('on', p.id === 'panel-' + tab));
  if (tab === 'bookings') renderBookings();
  if (tab === 'guide') renderGuide();
  if (tab === 'ideas') renderIdeas();
  if (tab === 'map' || tab === 'days') { placeMap(); refreshMap(); }
  window.scrollTo({ top: 0 });
}

function setWho(who) {
  ui.who = who;
  try { localStorage.setItem('japan2026.who', who); } catch { /* ignore */ }
  $$('.who [data-who]').forEach((b) => b.classList.toggle('on', b.dataset.who === who));
  renderStrip(); renderDay(); refreshMap();
  if (ui.tab === 'ideas') renderIdeas();
}

function renderSync() {
  const el = $('#sync');
  el.className = 'sync ' + store.mode;
  el.title = store.mode === 'online' ? 'Synced with the group' : store.mode === 'local' ? 'Offline / local only — changes stay on this device until reconnected' : 'Connecting…';
  const banner = $('#banner');
  if (store.mode === 'local') {
    banner.hidden = false; banner.className = 'banner';
    banner.textContent = location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.host)
      ? 'Local preview — shared sync is off (checkmarks and ideas stay on this device).'
      : 'Not synced — showing this device\'s copy. ' + (store.lastError && /TRIP_KV/.test(store.lastError) ? 'KV binding missing on Cloudflare (see README).' : 'Reconnecting…');
  } else banner.hidden = true;
}

// ───────────────────────── boot ─────────────────────────
function boot() {
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('.who [data-who]').forEach((b) => b.addEventListener('click', () => setWho(b.dataset.who)));
  $$('.seg [data-scope]').forEach((b) => b.addEventListener('click', () => { ui.mapScope = b.dataset.scope; refreshMap(); }));
  $('#search-btn').addEventListener('click', openSearch);
  $('#search-close').addEventListener('click', closeSearch);
  $('#search-input').addEventListener('input', (e) => runSearch(e.target.value));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearch(); if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); } if (!$('#search').hidden || e.target.matches('input,textarea')) return; if (e.key === 'ArrowRight') { const d = dayById(ui.dayId); if (DAYS[d.n]) selectDay(DAYS[d.n].id); } if (e.key === 'ArrowLeft') { const d = dayById(ui.dayId); if (DAYS[d.n - 2]) selectDay(DAYS[d.n - 2].id); } });
  $('#brand').addEventListener('click', () => { const t = todayId(); selectDay(t || DAYS[0].id); switchTab('days'); });
  $('#sync').addEventListener('click', () => store.refresh());
  window.addEventListener('resize', () => { placeMap(); });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1).split('/')[0]; if (dayById(id) && id !== ui.dayId) selectDay(id, { silent: true }); });

  $$('.who [data-who]').forEach((b) => b.classList.toggle('on', b.dataset.who === ui.who));
  const fromHash = location.hash.slice(1).split('/')[0];
  ui.dayId = dayById(fromHash) ? fromHash : (todayId() || DAYS[0].id);
  const tid = todayId();
  if (tid) { const b = $('#banner'); b.hidden = false; b.className = 'banner info'; const d = dayById(tid); b.textContent = `Today is Day ${d.n} — ${d.title}`; setTimeout(() => { if (b.classList.contains('info')) b.hidden = true; }, 6000); }

  store.subscribe(() => { renderSync(); renderStrip(); renderDay(); if (ui.tab === 'ideas') renderIdeas(); if (ui.tab === 'map' || window.matchMedia('(min-width: 960px)').matches) refreshMap(); });
  renderStrip(); renderDay(); switchTab('days');
  store.start();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  }
}
boot();
