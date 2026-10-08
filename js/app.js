import { TRIP, HOTELS, DAYS } from '../data/itinerary.js';
import { BOOKINGS, FOOD, TIPS, SUGGESTIONS } from '../data/guide.js';
import { store, getDisplayName, setDisplayName, deviceId } from './store.js';
import { createMap, gmapsDir, gmapsPlace, modeStyle } from './map.js';

// ───────────────────────── helpers ─────────────────────────
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const meta = (s) => esc(String(s ?? '').replace(/\s·\s/g, ', '));
const icon = (id, size = 18) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const longDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const hotelOf = (id) => HOTELS.find((x) => x.id === id);
const dayById = (id) => DAYS.find((d) => d.id === id);
const dayLabel = (id) => { const d = dayById(id); return d ? `Day ${d.n}` : 'Any day'; };
const CITY = { Tokyo: 'var(--rail)', Hakone: 'var(--water)', Kyoto: 'var(--kyoto)', Osaka: 'var(--taxi)' };
const MODE_ICON = { walk: 'walk', drive: 'drive', taxi: 'taxi', transit: 'train', train: 'train', boat: 'boat', ropeway: 'ropeway', flight: 'flight' };
const MODE_VAR = { walk: 'var(--walk)', drive: 'var(--taxi)', taxi: 'var(--taxi)', transit: 'var(--rail)', train: 'var(--rail)', boat: 'var(--water)', ropeway: 'var(--water)', flight: 'var(--flight)' };
const legMinutes = (label) => { const m = /(\d+)\s*(?:-|–)?\s*(\d+)?\s*min/.exec(label || ''); if (!m) { const hr = /(\d+)\s*(?:h|hr)/.exec(label || ''); return hr ? `${hr[1]} h` : ''; } return `${m[1]} min`; };

// ───────────────────────── state ─────────────────────────
const ui = { tab: 'days', dayId: null, who: 'all', mapScope: 'day', expanded: new Set(), ideasDay: null };
try { ui.who = localStorage.getItem('japan2026.who') || 'all'; } catch { /* ignore */ }

function todayId() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const d = DAYS.find((x) => x.date === iso);
  return d ? d.id : null;
}

// Items in play for a day: expand the chosen option of each choice, apply the who filter.
function visibleItems(day) {
  const out = [];
  const allowed = (it) => { const who = it.who || 'all'; return ui.who === 'all' || who === 'all' || who === ui.who; };
  for (const it of day.items) {
    if (!allowed(it)) continue;
    if (it.type === 'choice') {
      out.push(it);
      const chosen = store.getChoice(it.id, it.default);
      const opt = it.options.find((o) => o.id === chosen) || it.options[0];
      for (const sub of opt.items) if (allowed(sub)) out.push({ ...sub, _fromChoice: it.id });
    } else out.push(it);
  }
  return out;
}

function dayStops(day) {
  const items = visibleItems(day).filter((i) => i.type === 'event' && i.place);
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
  return { done: evs.filter((e) => store.isChecked(e.id)).length, total: evs.length };
}

// The next stop: first un-done event with a place (or any event), in timeline order.
function nextEvent(day) {
  const evs = visibleItems(day).filter((i) => i.type === 'event');
  return evs.find((e) => !store.isChecked(e.id) && !e.optional) || evs.find((e) => !store.isChecked(e.id)) || null;
}

// ───────────────────────── map (one instance, re-parented) ─────────────────────────
const mapEl = document.createElement('div');
mapEl.className = 'map'; mapEl.id = 'map';
$('#map-side').replaceWith(mapEl);
const theMap = createMap(mapEl);

function placeMap() {
  const desktop = window.matchMedia('(min-width: 960px)').matches;
  const target = (ui.tab === 'map') ? $('#panel-map') : (desktop && ui.tab === 'days' ? $('#sidemap') : null);
  if (!target) return;
  if (ui.tab === 'map') { const toolbar = $('.map-toolbar'); if (mapEl.parentElement !== target) target.insertBefore(mapEl, toolbar.nextSibling); }
  else if (mapEl.parentElement !== target) target.appendChild(mapEl);
  theMap.map.invalidateSize();
}

function refreshMap() {
  const day = dayById(ui.dayId);
  if (ui.tab !== 'map') ui.mapScope = 'day';
  $$('.seg [data-scope]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scope === ui.mapScope)));
  if (ui.mapScope === 'trip') {
    const pts = HOTELS.map((hh, i) => ({ ...hh, label: `H${i + 1}`, sub: `${hh.city}, ${hh.dates}` }));
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
    const b = h(`<button type="button" class="stop" role="listitem"><span class="n">${esc(s.n)}</span><b>${esc(s.title)}</b><small>${esc(s.time || '')}</small></button>`);
    b.addEventListener('click', () => { if (s.id) theMap.focus(s.id); });
    el.appendChild(b);
  });
  $('#legend').innerHTML = [['walk', 'Walk'], ['taxi', 'Taxi'], ['transit', 'Train'], ['boat', 'Boat']].map(([m, label]) => `<span style="color:${MODE_VAR[m]}"><i class="${modeStyle(m).dash ? 'dash' : ''}"></i><span style="color:var(--ink-2)">${label}</span></span>`).join('');
}

function highlightEvent(id) {
  if (ui.tab !== 'days') switchTab('days');
  const el = document.getElementById('ev-' + id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

// ───────────────────────── day strip ─────────────────────────
function renderStrip() {
  const el = $('#daystrip');
  el.innerHTML = '';
  const tid = todayId();
  DAYS.forEach((d) => {
    const p = dayProgress(d);
    const b = h(`<button type="button" class="daybtn ${d.id === tid ? 'today' : ''}" aria-current="${d.id === ui.dayId}" style="--city:${CITY[d.city] || 'var(--n3)'}" aria-label="Day ${d.n}, ${longDate(d.date)}, ${esc(d.city)}"><span class="st"><i></i></span><b>${d.n}</b><small>${esc(shortDate(d.date))}</small><span class="prog" aria-hidden="true"><i style="width:${p.total ? Math.round(100 * p.done / p.total) : 0}%"></i></span></button>`);
    b.addEventListener('click', () => selectDay(d.id));
    el.appendChild(b);
  });
  const on = $('.daybtn[aria-current="true"]', el);
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function selectDay(id, { silent } = {}) {
  ui.dayId = id;
  if (!silent) history.replaceState(null, '', '#' + id);
  renderStrip();
  renderDay();
  refreshMap();
}

// ───────────────────────── day: board, route diagram, rail ─────────────────────────
function renderDay() {
  const day = dayById(ui.dayId);
  const el = $('#timeline');
  el.innerHTML = '';
  if (!day) return;
  const hotel = hotelOf(day.hotel);
  const p = dayProgress(day);
  const prev = DAYS[day.n - 2], next = DAYS[day.n];
  const energy = day.energy.split(' ')[0];
  const bars = { LOW: 1, MEDIUM: 2, HIGH: 3 }[energy] || 2;

  el.appendChild(h(`
    <div class="board">
      <h2>${esc(day.title)}</h2>
      <p class="date">Day ${day.n} of 17. ${esc(longDate(day.date))}, ${esc(day.city)}.</p>
      <dl class="facts">
        <dt>Pace</dt><dd><span class="energy" aria-hidden="true"><i class="${bars >= 1 ? 'on' : ''}"></i><i class="${bars >= 2 ? 'on' : ''}"></i><i class="${bars >= 3 ? 'on' : ''}"></i></span>${esc(day.energy.toLowerCase())}, ${p.done} of ${p.total} stops done</dd>
        <dt>Dinner</dt><dd>${esc(day.dinner)}</dd>
        <dt>Hotel</dt><dd><a href="${gmapsPlace(hotel)}" target="_blank" rel="noopener">${esc(hotel.name)}</a></dd>
      </dl>
      <div class="actions">
        ${prev ? `<button type="button" class="btn small round" data-go="${prev.id}" aria-label="Day ${prev.n}" title="Day ${prev.n}">${icon('left', 18)}</button>` : ''}
        ${next ? `<button type="button" class="btn small round" data-go="${next.id}" aria-label="Day ${next.n}" title="Day ${next.n}">${icon('right', 18)}</button>` : ''}
        <button type="button" class="btn small" data-act="map">${icon('map', 16)}Map</button>
        <button type="button" class="btn small" data-act="ideas">${icon('ideas', 16)}Ideas</button>
      </div>
    </div>`));
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => selectDay(b.dataset.go)));
  $('[data-act="map"]', el).addEventListener('click', () => switchTab('map'));
  $('[data-act="ideas"]', el).addEventListener('click', () => { ui.ideasDay = day.id; switchTab('ideas'); });

  const stops = dayStops(day);
  const nxt = nextEvent(day);
  const numOf = (id) => { const s = stops.find((x) => x.ids.includes(id)); return s ? s.n : null; };

  // Route diagram — the signature.
  if (stops.length) {
    const route = h('<div class="route" role="group" aria-label="Route for the day"></div>');
    stops.forEach((s) => {
      const mode = (s.travel && s.travel.mode) || 'transit';
      const st = modeStyle(mode);
      const isNext = nxt && s.ids.includes(nxt.id);
      const b = h(`<button type="button" class="${isNext ? 'next' : ''} ${s.done ? 'done' : ''} ${s.optional ? 'optional' : ''} ${s.who !== 'all' ? s.who : ''}" style="--leg:${MODE_VAR[mode]}" aria-label="Stop ${s.n}, ${esc(s.title)}"><span class="rseg ${st.dash ? 'dashed' : ''}"><span class="leg-min">${esc(legMinutes(s.travel && s.travel.label))}</span><b>${s.n}</b></span><small>${esc(s.title)}</small><em>${esc((s.time || '').split(/[–-]/)[0].trim())}</em></button>`);
      b.addEventListener('click', () => highlightEvent(s.id));
      route.appendChild(b);
    });
    el.appendChild(route);
  }

  // Next stop headline.
  if (nxt) {
    const n = nxt.place ? numOf(nxt.id) : null;
    const leg = nxt.travel ? `${esc(nxt.travel.label || nxt.travel.mode)}` : '';
    el.appendChild(h(`<div class="next"><div class="n" aria-hidden="true">${n ?? ''}</div><div class="time"><span class="jn">次 Next</span>${esc((nxt.time || '').split(/[–-]/)[0].trim())}</div><div class="n" style="visibility:hidden" aria-hidden="true"></div><div><div class="t">${esc(nxt.title)}</div>${leg ? `<div class="w">${leg}</div>` : ''}</div></div>`));
  } else {
    el.appendChild(h(`<div class="next"><div class="n done" aria-hidden="true">${icon('check', 26)}</div><div><div class="t">Day complete. Every stop is ticked off.</div></div></div>`));
  }

  const items = visibleItems(day);
  let lastPinned = null;
  const events = items.filter((i) => i.type === 'event');
  items.forEach((it) => {
    if (it.type === 'section') { el.appendChild(h(`<h3 class="section-h">${esc(it.title)}</h3>`)); return; }
    if (it.type === 'note') { el.appendChild(renderNote(it)); return; }
    if (it.type === 'choice') { el.appendChild(renderChoice(it)); return; }

    const n = it.place ? numOf(it.id) : null;
    const idx = events.indexOf(it);
    const pos = events.length === 1 ? 'alone' : idx === 0 ? 'first' : idx === events.length - 1 ? 'last' : '';
    const mode = it.travel ? it.travel.mode : null;
    const isNext = nxt && nxt.id === it.id;
    const wrap = h(`<div class="ev ${pos} ${it.who && it.who !== 'all' ? it.who : ''} ${it.optional ? 'optional' : ''} ${store.isChecked(it.id) ? 'done' : ''} ${isNext ? 'next' : ''}" id="ev-${esc(it.id)}" style="--leg:${mode ? MODE_VAR[mode] : 'var(--n3)'}"></div>`);
    if (it.place && it.travel && lastPinned && n && numOf(lastPinned.id) !== n) {
      wrap.appendChild(h(`<div class="travel"><span class="mode" aria-hidden="true">${icon(MODE_ICON[mode] || 'train', 16)}</span><span>${esc(it.travel.label || it.travel.mode)}</span><a href="${gmapsDir(lastPinned.place, it.place, it.travel.mode)}" target="_blank" rel="noopener">${icon('dir', 16)}Directions</a></div>`));
    }
    const numBtn = h(`<button type="button" class="num ${n ? '' : 'none'}" ${n ? `aria-label="Show stop ${n} on the map"` : 'tabindex="-1" aria-hidden="true"'}><span>${n || ''}</span></button>`);
    if (n) numBtn.addEventListener('click', () => { if (!window.matchMedia('(min-width: 960px)').matches) switchTab('map'); setTimeout(() => theMap.focus(it.id), 60); });
    wrap.appendChild(numBtn);

    const long = (it.desc || '').length > 220 || (it.desc || '').includes('\n');
    const expanded = ui.expanded.has(it.id);
    const chips = [];
    if (it.confirmed) chips.push(`<span class="chip confirmed">${icon('check', 12)}Confirmed</span>`);
    if (it.tbd) chips.push('<span class="chip tbd">Still to decide</span>');
    if (it.who && it.who !== 'all') chips.push(`<span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span>`);
    if (it.cost) chips.push(`<span class="chip cost">${esc(it.cost)}</span>`);
    const card = h(`
      <div class="card">
        <div class="row">
          <div style="flex:1;min-width:0">
            <div class="time">${esc(it.time)}</div>
            <div class="title">${esc(it.title)}${it.optional ? ' <span class="opt-tag">optional</span>' : ''}</div>
            ${it.desc ? `<div class="desc ${long && !expanded ? 'clamp' : ''}">${esc(it.desc)}</div>` : ''}
            ${long ? `<button type="button" class="more" aria-expanded="${expanded}">${expanded ? 'Show less' : 'Read more'}</button>` : ''}
          </div>
          <button type="button" class="check" aria-pressed="${store.isChecked(it.id)}" aria-label="Mark ${esc(it.title)} as done">${isNext ? '<span class="lbl">Done</span>' : ''}<i>${icon('check', 16)}</i></button>
        </div>
        ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
        ${it.place ? `<div class="links"><a class="btn small" href="${gmapsPlace(it.place)}" target="_blank" rel="noopener">${icon('pin', 15)}${esc(it.place.name)}</a>${(it.subplaces || []).map((sp) => `<a class="btn small" href="${gmapsPlace(sp)}" target="_blank" rel="noopener">${icon('pin', 15)}${esc(sp.name)}</a>`).join('')}</div>` : ''}
      </div>`);
    const more = $('.more', card);
    if (more) more.addEventListener('click', () => { if (ui.expanded.has(it.id)) ui.expanded.delete(it.id); else ui.expanded.add(it.id); renderDay(); });
    $('.check', card).addEventListener('click', () => store.toggleCheck(it.id));
    wrap.appendChild(card);
    el.appendChild(wrap);
    if (it.place) lastPinned = it;
  });
  if (!events.length) el.appendChild(h(`<div class="empty">Nothing is planned for ${TRIP.travelers[ui.who].short} on this day. Switch to All to see the shared plan.</div>`));
}

function renderNote(it) {
  const kind = it.kind || 'note';
  const ic = { note: 'info', warn: 'warn', book: 'book', decide: 'flag', tip: 'info' }[kind] || 'info';
  const who = it.who && it.who !== 'all' ? `<span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span>` : '';
  return h(`<div class="note ${kind}"><h4>${icon(ic, 18)}${who}${esc(it.title)}</h4><p>${esc(it.text)}</p>${it.link ? `<a class="btn small" href="${esc(it.link.url)}" target="_blank" rel="noopener">${esc(it.link.label)}${icon('ext', 14)}</a>` : ''}</div>`);
}

function renderChoice(it) {
  const chosen = store.getChoice(it.id, it.default);
  const box = h(`<div class="choice" role="radiogroup" aria-label="${esc(it.title)}"><h4>${icon('flag', 18)}${esc(it.title)}${it.who && it.who !== 'all' ? ` <span class="chip ${it.who}">${TRIP.travelers[it.who].short}</span>` : ''}</h4>${it.text ? `<p>${esc(it.text)}</p>` : ''}<div class="opts"></div><div class="picked">Shared choice: whoever changes it, all four phones see it.</div></div>`);
  const opts = $('.opts', box);
  it.options.forEach((o) => {
    const b = h(`<button type="button" class="opt" role="radio" aria-checked="${o.id === chosen}"><span class="radio" aria-hidden="true"></span><span><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span></button>`);
    b.addEventListener('click', () => store.setChoice(it.id, o.id));
    opts.appendChild(b);
  });
  return box;
}

// ───────────────────────── bookings ─────────────────────────
function renderBookings() {
  const el = $('#bookings');
  const card = (b, cls) => `<div class="bk ${cls} ${b.urgent ? 'urgent' : ''}"><span class="st" aria-hidden="true">${cls ? (b.urgent ? icon('warn', 14) : '') : icon('check', 16)}</span><div><div class="when">${meta(b.when)}${b.who ? ` <span class="chip ${b.who}">${TRIP.travelers[b.who].short}</span>` : ''}</div><div class="t">${b.urgent ? '<span class="urgent-tag">Book now</span>' : ''}${esc(b.title)}</div><p>${esc(b.detail)}</p><div class="links">${b.day ? `<button type="button" class="btn small" data-go="${b.day}">Open ${dayLabel(b.day)}</button>` : ''}${b.tel ? `<a class="btn small" href="tel:${b.tel}">${icon('phone', 14)}Call</a>` : ''}</div></div></div>`;
  el.innerHTML = `
    <h2 class="h2">Still to book or decide</h2>
    <p class="sub">Book closer to the date or on the day.</p>
    ${BOOKINGS.closer.map((b) => card(b, 'closer')).join('')}
    <h2 class="h2">Confirmed</h2>
    <p class="sub">Done. Nothing more to do.</p>
    ${BOOKINGS.confirmed.map((b) => card(b, '')).join('')}
    <h2 class="h2">Hotels</h2>
    ${HOTELS.map((hh) => `<div class="bk"><span class="st" aria-hidden="true">${icon('hotel', 14)}</span><div><div class="when">${esc(hh.dates)}, ${hh.nights} night${hh.nights > 1 ? 's' : ''}</div><div class="t">${esc(hh.name)}</div><p>${esc(hh.city)}</p><div class="links"><a class="btn small" href="${gmapsPlace(hh)}" target="_blank" rel="noopener">${icon('pin', 15)}Google Maps</a></div></div></div>`).join('')}`;
  $$('[data-go]', el).forEach((b) => b.addEventListener('click', () => { selectDay(b.dataset.go); switchTab('days'); }));
}

// ───────────────────────── guide ─────────────────────────
function renderGuide() {
  const el = $('#guide');
  const food = (f) => `<div class="food"><div class="t">${f.star ? '<span class="star" title="Top pick"></span>' : ''}<span>${esc(f.name)}</span></div>${f.meta ? `<div class="m">${meta(f.meta)}</div>` : ''}<p>${esc(f.text)}</p>${f.lat ? `<div class="links"><a class="btn small" href="${gmapsPlace({ q: f.name.split(' — ').pop().split(' · ')[0] })}" target="_blank" rel="noopener">${icon('pin', 15)}Google Maps</a></div>` : ''}</div>`;
  el.innerHTML = `
    <h2 class="h2">Must-eat food and experiences</h2>
    <p class="sub">A red dot marks the top picks. Everything here is pork-free or easy to order that way.</p>
    ${FOOD.map((c) => `<details class="acc" open><summary>${esc(c.city)}</summary><div class="inner">${c.items.map(food).join('')}<h3 class="section-h" style="margin-left:0">Cafés and quick bites</h3>${c.cafes.map(food).join('')}</div></details>`).join('')}
    <h2 class="h2">Trip tips</h2>
    ${TIPS.map((t) => `<details class="acc"><summary>${esc(t.title)}</summary><ul>${t.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>`).join('')}`;
}

// ───────────────────────── ideas ─────────────────────────
function renderIdeas() {
  const el = $('#ideas');
  const dayFilter = ui.ideasDay || 'all';
  const name = getDisplayName();
  const curated = SUGGESTIONS.filter((s) => (dayFilter === 'all' || s.day === dayFilter || s.day === null) && (ui.who === 'all' || !s.who || s.who === ui.who));
  const mine = deviceId();
  const list = store.state.suggestions.filter((s) => dayFilter === 'all' || s.day === dayFilter || !s.day);
  el.innerHTML = `
    <div class="filter" role="group" aria-label="Filter by day">
      <button type="button" data-f="all" aria-pressed="${dayFilter === 'all'}">All days</button>
      ${DAYS.map((d) => `<button type="button" data-f="${d.id}" aria-pressed="${dayFilter === d.id}">Day ${d.n}</button>`).join('')}
    </div>
    <h2 class="h2">Add a suggestion</h2>
    <p class="sub">Shared with everyone on the trip. Vote for the ones you like.</p>
    <form class="form" id="sg-form">
      <label>Suggestion<textarea name="text" placeholder="A restaurant, a detour, a must-buy, a change to the plan" required maxlength="1200"></textarea></label>
      <div class="row2">
        <label>Your name<input name="name" value="${esc(name)}" maxlength="40" autocomplete="given-name"></label>
        <label>Day<select name="day"><option value="">Any day</option>${DAYS.map((d) => `<option value="${d.id}" ${dayFilter === d.id ? 'selected' : ''}>Day ${d.n}, ${esc(shortDate(d.date))}, ${esc(d.city)}</option>`).join('')}</select></label>
      </div>
      <button type="submit" class="btn primary">Post suggestion</button>
    </form>
    <h2 class="h2">Group suggestions${list.length ? ` (${list.length})` : ''}</h2>
    ${list.length ? list.map((s) => `<div class="sg ${s.pending ? 'pending' : ''}" data-id="${esc(s.id)}"><button type="button" class="vote" aria-pressed="${(s.votes || []).includes(mine)}" aria-label="Vote for this suggestion">${icon('up', 16)}${(s.votes || []).length}<small>${(s.votes || []).length === 1 ? 'vote' : 'votes'}</small></button><div><div class="txt">${esc(s.text)}</div><div class="by">${esc(s.name || 'Anonymous')}, ${dayLabel(s.day)}, ${new Date(s.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${s.author === mine ? ' <button type="button" class="del">Delete</button>' : ''}</div></div></div>`).join('') : '<p class="empty">No suggestions yet. Add the first one above.</p>'}
    <h2 class="h2">Ideas for the open slots</h2>
    <p class="sub">Picks for the dinners still to decide, the free evenings and the optional mornings.</p>
    ${curated.map((s) => `<div class="idea"><div class="slot">${s.day ? dayLabel(s.day) + ', ' : ''}${esc(s.slot)}${s.who ? ` (${TRIP.travelers[s.who].short})` : ''}</div><div class="t">${esc(s.title)}</div>${s.picks.map((p) => `<div class="pick"><div><b>${esc(p.name)}</b><p>${esc(p.why)}</p></div>${p.lat ? `<a href="${gmapsPlace({ q: p.name.replace(/\(.*\)/, '').trim() })}" target="_blank" rel="noopener">${icon('pin', 15)}Map</a>` : ''}</div>`).join('')}${s.day ? `<div class="links" style="margin-top:8px"><button type="button" class="btn small" data-go="${s.day}">Open ${dayLabel(s.day)}</button></div>` : ''}</div>`).join('')}`;
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
      if (it.type === 'event') idx.push({ day: d, id: it.id, title: it.title, text: `${it.time} ${it.desc || ''} ${(it.place && it.place.name) || ''} ${ctx}`, kind: 'stop' });
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
  if (q.length < 2) { el.innerHTML = '<p class="empty">Type at least two letters. Try a place, a food, or a time.</p>'; return; }
  INDEX = INDEX || buildIndex();
  const terms = q.split(/\s+/);
  const hits = INDEX.map((r) => { const hay = (r.title + ' ' + r.text).toLowerCase(); const score = terms.reduce((s, t) => s + (r.title.toLowerCase().includes(t) ? 3 : 0) + (hay.includes(t) ? 1 : 0), 0); return { r, score, ok: terms.every((t) => hay.includes(t)) }; }).filter((x) => x.ok).sort((a, b) => b.score - a.score).slice(0, 40);
  const mark = (s) => { let out = esc(s); terms.forEach((t) => { out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`); }); return out; };
  el.innerHTML = hits.length ? hits.map(({ r }, i) => `<button type="button" class="sr" data-i="${i}"><b>${mark(r.title)}</b><small>${r.day ? `Day ${r.day.n}, ` : ''}${r.kind}. ${mark(r.text.slice(0, 140))}</small></button>`).join('') : '<p class="empty">Nothing matches. Try a shorter word.</p>';
  $$('.sr', el).forEach((b) => b.addEventListener('click', () => {
    const { r } = hits[+b.dataset.i];
    closeSearch();
    if (r.tab) { if (r.tab === 'ideas' && r.day) ui.ideasDay = r.day.id; switchTab(r.tab); return; }
    selectDay(r.day.id); switchTab('days');
    if (r.id) setTimeout(() => highlightEvent(r.id), 100);
  }));
}
let lastFocus = null;
function openSearch() { lastFocus = document.activeElement; const s = $('#search'); s.hidden = false; s.removeAttribute('data-closing'); $('#search-input').value = ''; runSearch(''); setTimeout(() => $('#search-input').focus(), 30); }
function closeSearch() { const s = $('#search'); if (s.hidden) return; s.setAttribute('data-closing', ''); setTimeout(() => { s.hidden = true; s.removeAttribute('data-closing'); }, 200); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

// ───────────────────────── tabs / who / sync ─────────────────────────
function switchTab(tab) {
  ui.tab = tab;
  $$('.tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.panel').forEach((p) => { const on = p.id === 'panel-' + tab; p.classList.toggle('on', on); p.hidden = !on; });
  if (tab === 'bookings') renderBookings();
  if (tab === 'guide') renderGuide();
  if (tab === 'ideas') renderIdeas();
  if (tab === 'map' || tab === 'days') { placeMap(); refreshMap(); }
  window.scrollTo({ top: 0 });
}

function setWho(who) {
  ui.who = who;
  try { localStorage.setItem('japan2026.who', who); } catch { /* ignore */ }
  $$('.who [data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === who)));
  renderStrip(); renderDay(); refreshMap();
  if (ui.tab === 'ideas') renderIdeas();
}

function renderSync() {
  const el = $('#sync');
  el.className = 'sync ' + store.mode;
  const label = store.mode === 'online' ? 'Synced with the group' : store.mode === 'local' ? 'Not synced. Changes stay on this phone until it reconnects.' : 'Connecting';
  el.title = label; $('#sync-label').textContent = label;
  const banner = $('#banner');
  if (store.mode === 'local') {
    banner.hidden = false; banner.className = 'banner';
    banner.textContent = location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.host)
      ? 'Local preview. Ticks and ideas stay on this device.'
      : 'Not synced. Showing this phone\'s copy. ' + (store.lastError && /TRIP_KV/.test(store.lastError) ? 'The KV binding is missing on Cloudflare (see README).' : 'It will reconnect on its own.');
  } else banner.hidden = true;
}

// ───────────────────────── boot ─────────────────────────
function boot() {
  $$('.tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('.who [data-who]').forEach((b) => b.addEventListener('click', () => setWho(b.dataset.who)));
  $$('.seg [data-scope]').forEach((b) => b.addEventListener('click', () => { ui.mapScope = b.dataset.scope; refreshMap(); }));
  $('#search-btn').addEventListener('click', openSearch);
  $('#search-close').addEventListener('click', closeSearch);
  $('#search-input').addEventListener('input', (e) => runSearch(e.target.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (!$('#search').hidden || e.target.matches('input,textarea,select')) return;
    if (e.key === 'ArrowRight') { const d = dayById(ui.dayId); if (DAYS[d.n]) selectDay(DAYS[d.n].id); }
    if (e.key === 'ArrowLeft') { const d = dayById(ui.dayId); if (DAYS[d.n - 2]) selectDay(DAYS[d.n - 2].id); }
  });
  $('#brand').addEventListener('click', () => { const t = todayId(); selectDay(t || DAYS[0].id); switchTab('days'); });
  $('#sync').addEventListener('click', () => store.refresh());
  window.addEventListener('resize', () => placeMap());
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1).split('/')[0]; if (dayById(id) && id !== ui.dayId) selectDay(id, { silent: true }); });

  $$('.who [data-who]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.who === ui.who)));
  const fromHash = location.hash.slice(1).split('/')[0];
  ui.dayId = dayById(fromHash) ? fromHash : (todayId() || DAYS[0].id);
  const tid = todayId();
  if (tid && !dayById(fromHash)) { const b = $('#banner'); b.hidden = false; b.className = 'banner info'; const d = dayById(tid); b.textContent = `Today is day ${d.n}: ${d.title}`; setTimeout(() => { if (b.classList.contains('info')) b.hidden = true; }, 6000); }

  store.subscribe(() => { renderSync(); renderStrip(); renderDay(); if (ui.tab === 'ideas') renderIdeas(); if (ui.tab === 'map' || window.matchMedia('(min-width: 960px)').matches) refreshMap(); });
  renderStrip(); renderDay(); switchTab('days');
  store.start();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
}
boot();
