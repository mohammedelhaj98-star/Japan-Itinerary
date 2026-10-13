// Flight tracking: which flights the trip has, when each is due a check, what the flight-status service says about it,
// and which changes are worth a phone alert. Used by the shared-state Durable Object (workers/state), which runs a check
// every 5 minutes (a cron trigger) and keeps the results under the 'flights' key, where every phone reads them.
//
// A flight is a stop with `flight` in data/itinerary.js, or any stop someone gave a flight number in its editor (custom
// edit or added stop: `flight: { no }`). Checks, per flight (Mo's choice, Oct 2026):
//   until a day before takeoff        none (a flight with no known times is looked up once a day, to learn them)
//   from a day before                 every hour
//   from 3 hours before takeoff       every 5 minutes, until it lands and the baggage belt is known (or 90 min after landing)
// FlightAware AeroAPI answers (FLIGHTAWARE_KEY, a secret on the Worker; about $0.005 a check). AeroDataBox through
// RapidAPI (AERODATABOX_KEY) is the stand-in: it has a smaller allowance, so in the air it checks every 15 minutes.
// AirLabs (AIRLABS_KEY, the free plan Mo set up while FlightAware reviews his signup) is the stop-gap: it only knows the
// next or latest flight with a number, and the free plan has 1,000 calls in all, so it starts 3 hours before takeoff
// (no hourly checks the day before) and checks every 15 minutes in the air. Its baggage belt is often missing.
//
// What the phones get, per stop id:
//   { no, people, st, dep: { sch, est, act }, arr: { sch, est, act }, from, to, toName, fromTz, toTz, gate, term,
//     arrGate, arrTerm, belt, delay, checkedAt, nextAt, changes: [{ at, kind, text, field?, from?, to? }] }
// st is ontime | delayed | air | landed | cancelled | diverted; times are ISO (UTC); changes keep the last 12, newest first.

import { DAYS } from '../data/itinerary.js';

const MIN = 60e3, HOUR = 60 * MIN;
export const NAMES = { naf: 'Naf', sara: 'Sara', mariam: 'Mariam', m: 'Mo' };
export const ALERT_KINDS = ['delay', 'gate', 'cancel', 'landed'];
const DELAY_ALERT_MIN = 15;

const cleanNo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const iso = (t) => (t ? new Date(t).toISOString() : null);
const ms = (t) => (t ? Date.parse(t) : NaN);

// "Naf and Sara", "Naf, Sara and Mariam"
export function names(people) {
  const n = (people || []).map((p) => NAMES[p] || p);
  return n.length < 2 ? n[0] || 'Someone' : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}

// Every flight in the trip, with any flight number typed in on a stop.
export function tripFlights(custom = {}) {
  const out = [];
  for (const d of DAYS) {
    const items = d.items.flatMap((it) => (it.type === 'choice' ? it.options.flatMap((o) => o.items || []) : [it]));
    for (const it of items) {
      const c = custom[it.id] || {};
      if (c.hidden) continue;
      const f = { ...(it.flight || {}), ...(c.flight || {}) };
      if (!it.flight && !c.flight) continue;
      const no = cleanNo(f.no), was = it.flight && cleanNo(it.flight.no), own = it.flight && (!was || was === no); // a number replacing another: the trip's times are for the old one (filling a blank keeps them)
      if (no) out.push({ id: it.id, day: d.id, date: d.date, no, people: f.people || peopleOf(it.who), from: own ? f.from || '' : '', to: own ? f.to || '' : '', dep: own ? f.dep || '' : '', arr: own ? f.arr || '' : '' });
    }
  }
  for (const [id, c] of Object.entries(custom)) {
    if (!c || !c.added || c.hidden || !c.flight || !cleanNo(c.flight.no)) continue;
    const d = DAYS.find((x) => x.id === c.day); if (!d) continue;
    out.push({ id, day: d.id, date: d.date, no: cleanNo(c.flight.no), people: c.flight.people || peopleOf(c.who), from: '', to: '', dep: '', arr: '' });
  }
  return out;
}
const peopleOf = (who) => (who === 'nasa' ? ['naf', 'sara'] : who === 'mm' ? ['mariam', 'm'] : ['naf', 'sara', 'mariam', 'm']);

// When this flight should next be checked (ms), or null when we're done with it.
// lead: how many hours before takeoff the hourly checks start (a service that can't see that far ahead uses 3).
export function nextCheck(f, rec, now, airEvery = 5, lead = 24) {
  const dep = ms((rec && (rec.dep.est || rec.dep.sch)) || f.dep), arr = ms((rec && (rec.arr.act || rec.arr.est || rec.arr.sch)) || f.arr);
  if (rec && (rec.st === 'landed' || rec.st === 'diverted') && (rec.belt || now > arr + 90 * MIN)) return null;
  if (rec && rec.st === 'cancelled' && now > (Number.isFinite(dep) ? dep : 0) + 6 * HOUR) return null;
  if (!Number.isFinite(dep)) {
    // no times yet: look it up once a day from 3 days before its day (and keep going hourly on the day itself)
    const day = Date.parse(f.date + 'T00:00:00+09:00');
    if (now < day - 3 * 24 * HOUR) return day - 3 * 24 * HOUR;
    if (now > day + 2 * 24 * HOUR) return null;
    return (rec && rec.checkedAt ? ms(rec.checkedAt) : now - 25 * HOUR) + (now > day - 24 * HOUR ? HOUR : 24 * HOUR);
  }
  const last = rec && rec.checkedAt ? ms(rec.checkedAt) : 0;
  if (now < dep - lead * HOUR) return dep - lead * HOUR;
  if (now < dep - 3 * HOUR) return Math.min(last + HOUR, dep - 3 * HOUR);
  if (Number.isFinite(arr) && now > arr + 6 * HOUR) return null; // something is stuck: stop paying for it
  // in the air, far from landing, a slower service checks less often
  const every = rec && rec.st === 'air' && Number.isFinite(arr) && arr - now > 45 * MIN ? airEvery : 5;
  return last + every * MIN - 20e3; // a little early, so a 5-minute timer never skips one
}

// FlightAware AeroAPI: the flights with this number around its date; the one closest to our scheduled time wins.
export async function fetchFlightAware(f, key, fetchFn = fetch) {
  // the trip's takeoff time when we have it, else its landing time (a stop that only knows when they land)
  const byArr = !ms(f.dep) && !!ms(f.arr), around = ms(f.dep) || ms(f.arr) || Date.parse(f.date + 'T12:00:00+09:00');
  const start = new Date(around - 30 * HOUR).toISOString().slice(0, 19) + 'Z', end = new Date(around + 30 * HOUR).toISOString().slice(0, 19) + 'Z';
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(f.no)}?ident_type=designator&start=${start}&end=${end}`;
  const r = await fetchFn(url, { headers: { 'x-apikey': key, accept: 'application/json' } });
  if (!r.ok) throw new Error('FlightAware ' + r.status);
  const list = ((await r.json()).flights || []).filter((x) => x.scheduled_out || x.scheduled_off);
  if (!list.length) return null;
  const when = (x) => (byArr ? ms(x.scheduled_in || x.scheduled_on) : ms(x.scheduled_out || x.scheduled_off));
  const pick = list.sort((a, b) => Math.abs(when(a) - around) - Math.abs(when(b) - around))[0];
  return fromFlightAware(pick, f);
}
export function fromFlightAware(x, f) {
  const code = (a) => (a && (a.code_iata || a.code)) || '';
  const depEst = x.estimated_out || x.estimated_off, arrEst = x.estimated_in || x.estimated_on;
  const depAct = x.actual_out || x.actual_off, arrAct = x.actual_in || x.actual_on;
  const delay = Math.round((x.departure_delay || 0) / 60), arrDelay = Math.round((x.arrival_delay || 0) / 60);
  const to = code(x.destination);
  const diverted = !!x.diverted || (f.to && to && to !== f.to);
  let st = 'ontime';
  if (x.cancelled) st = 'cancelled';
  else if (diverted) st = 'diverted';
  else if (arrAct || /arrived|landed/i.test(x.status || '')) st = 'landed';
  else if (depAct && (x.actual_off || x.progress_percent > 0)) st = 'air';
  else if (Math.max(delay, arrDelay) >= DELAY_ALERT_MIN) st = 'delayed';
  return {
    st, delay: Math.max(delay, arrDelay, 0), // the larger of the two, as the status uses
    dep: { sch: iso(x.scheduled_out || x.scheduled_off), est: iso(depEst), act: iso(depAct) },
    arr: { sch: iso(x.scheduled_in || x.scheduled_on), est: iso(arrEst), act: iso(arrAct) },
    from: code(x.origin), to, toName: (x.destination && (x.destination.city || x.destination.name)) || '',
    fromTz: (x.origin && x.origin.timezone) || '', toTz: (x.destination && x.destination.timezone) || '',
    gate: x.gate_origin || '', term: x.terminal_origin || '', arrGate: x.gate_destination || '', arrTerm: x.terminal_destination || '',
    belt: x.baggage_claim || '',
  };
}

// AeroDataBox (RapidAPI): the flights with this number departing on its local date.
export async function fetchAeroDataBox(f, key, fetchFn = fetch) {
  // the local date of takeoff, or of landing when that's all the stop knows (a long flight leaves the day before)
  const byArr = !f.dep && /^\d{4}-\d\d-\d\d/.test(f.arr || ''), local = f.dep ? f.dep.slice(0, 10) : byArr ? f.arr.slice(0, 10) : f.date;
  const host = 'aerodatabox.p.rapidapi.com';
  const r = await fetchFn(`https://${host}/flights/number/${encodeURIComponent(f.no)}/${local}?withAircraftImage=false&withLocation=false&dateLocalRole=${byArr ? 'Arrival' : 'Departure'}`, { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host, accept: 'application/json' } });
  if (r.status === 204 || r.status === 404) return null;
  if (!r.ok) throw new Error('AeroDataBox ' + r.status);
  const list = await r.json(); if (!Array.isArray(list) || !list.length) return null;
  const want = (x) => !f.to || (x.arrival && x.arrival.airport && x.arrival.airport.iata === f.to) || (x.departure && x.departure.airport && x.departure.airport.iata === f.from);
  return fromAeroDataBox(list.find(want) || list[0], f);
}
export function fromAeroDataBox(x, f) {
  const t = (o) => (o && o.utc ? iso(o.utc.replace(' ', 'T')) : null);
  const d = x.departure || {}, a = x.arrival || {}, s0 = String(x.status || '');
  const flying = /Departed|EnRoute|Approaching/i.test(s0), down = /Landed|Arrived/i.test(s0);
  const depSch = t(d.scheduledTime), depRev = t(d.revisedTime), arrSch = t(a.scheduledTime), arrRev = t(a.revisedTime) || t(a.predictedTime);
  const delay = depSch && depRev ? Math.round((ms(depRev) - ms(depSch)) / MIN) : 0, arrDelay = arrSch && arrRev ? Math.round((ms(arrRev) - ms(arrSch)) / MIN) : 0;
  const to = (a.airport && a.airport.iata) || '';
  let st = 'ontime';
  if (/Cancel/i.test(s0)) st = 'cancelled';
  else if (/Diverted/i.test(s0) || (f.to && to && to !== f.to)) st = 'diverted';
  else if (down) st = 'landed';
  else if (flying) st = 'air';
  else if (Math.max(delay, arrDelay) >= DELAY_ALERT_MIN) st = 'delayed';
  return {
    st, delay: Math.max(delay, arrDelay, 0),
    dep: { sch: depSch, est: depRev, act: flying || down ? t(d.runwayTime) || depRev : null },
    arr: { sch: arrSch, est: arrRev, act: down ? t(a.runwayTime) || arrRev : null },
    from: (d.airport && d.airport.iata) || '', to, toName: (a.airport && (a.airport.municipalityName || a.airport.name)) || '',
    fromTz: (d.airport && d.airport.timeZone) || '', toTz: (a.airport && a.airport.timeZone) || '',
    gate: d.gate || '', term: d.terminal || '', arrGate: a.gate || '', arrTerm: a.terminal || '', belt: a.baggageBelt || '',
  };
}
// AirLabs: the one flight with this number that's next or just happened. When that's another day's flight (more than
// 8 hours from ours), we don't have ours yet.
export async function fetchAirLabs(f, key, fetchFn = fetch) {
  const r = await fetchFn(`https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(f.no)}&api_key=${encodeURIComponent(key)}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('AirLabs ' + r.status);
  const body = await r.json();
  if (body.error) { if (body.error.code === 'not_found') return null; throw new Error('AirLabs ' + String(body.error.code || body.error.message || 'error')); }
  const x = body.response; if (!x || !x.flight_iata) return null;
  const off = (a, b) => (ms(a) && ms(b) ? Math.abs(ms(a) - ms(b)) : 0);
  if (off(alUtc(x.dep_time_utc), f.dep) > 8 * HOUR || off(alUtc(x.arr_time_utc), f.arr) > 8 * HOUR) return null;
  // a stop with no times yet: it must at least take off or land on the stop's day (local time)
  if (!ms(f.dep) && !ms(f.arr) && String(x.dep_time || '').slice(0, 10) !== f.date && String(x.arr_time || '').slice(0, 10) !== f.date) return null;
  return fromAirLabs(x, f);
}
const ZONES = { NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', DOH: 'Asia/Qatar', YVR: 'America/Vancouver', YYZ: 'America/Toronto' };
// an airport we don't list: its offset from the local and UTC times AirLabs gives (whole hours only)
const alZone = (code, local, utc) => {
  if (ZONES[code]) return ZONES[code];
  const h = (Date.parse(String(local).replace(' ', 'T') + ':00Z') - Date.parse(String(utc).replace(' ', 'T') + ':00Z')) / HOUR;
  return Number.isInteger(h) && Math.abs(h) <= 14 ? (h ? `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}` : 'Etc/UTC') : '';
};
const alUtc = (s) => (s ? iso(String(s).replace(' ', 'T') + ':00Z') : null); // "2026-10-20 17:35" is UTC
export function fromAirLabs(x, f) {
  const s0 = String(x.status || ''), to = x.arr_iata || '';
  const depAct = alUtc(x.dep_actual_utc), arrAct = alUtc(x.arr_actual_utc);
  const delay = Math.round(x.dep_delayed || 0), arrDelay = Math.round(x.arr_delayed || 0);
  let st = 'ontime';
  if (/cancel/i.test(s0)) st = 'cancelled';
  else if (/divert/i.test(s0) || (f.to && to && to !== f.to)) st = 'diverted';
  else if (/landed/i.test(s0) || arrAct) st = 'landed';
  else if (/en-route|active/i.test(s0) || depAct) st = 'air';
  else if (Math.max(delay, arrDelay) >= DELAY_ALERT_MIN) st = 'delayed';
  return {
    st, delay: Math.max(delay, arrDelay, 0),
    dep: { sch: alUtc(x.dep_time_utc), est: alUtc(x.dep_estimated_utc), act: depAct },
    arr: { sch: alUtc(x.arr_time_utc), est: alUtc(x.arr_estimated_utc), act: arrAct },
    from: x.dep_iata || '', to, toName: x.arr_city || x.arr_name || '', fromTz: alZone(x.dep_iata, x.dep_time, x.dep_time_utc), toTz: alZone(to, x.arr_time, x.arr_time_utc), // AirLabs has no zones
    gate: x.dep_gate || '', term: x.dep_terminal || '', arrGate: x.arr_gate || '', arrTerm: x.arr_terminal || '', belt: x.arr_baggage || '',
  };
}

// Whichever service has a key: FlightAware first, AirLabs last.
export function lookupFor(env, fetchFn = fetch) {
  if (env.FLIGHTAWARE_KEY) return { look: (f) => fetchFlightAware(f, env.FLIGHTAWARE_KEY, fetchFn), airEvery: 5, lead: 24 };
  if (env.AERODATABOX_KEY) return { look: (f) => fetchAeroDataBox(f, env.AERODATABOX_KEY, fetchFn), airEvery: 15, lead: 24 };
  if (env.AIRLABS_KEY) return { look: (f) => fetchAirLabs(f, env.AIRLABS_KEY, fetchFn), airEvery: 15, lead: 3 };
  return null;
}

// What changed between two checks, each with its alert kind (or none) and words for the phones.
const hm = (t, tz) => { try { return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz || 'Asia/Tokyo' }); } catch { return new Date(t).toISOString().slice(11, 16); } };
const place = (code) => ({ NRT: 'Narita', HND: 'Haneda', KIX: 'Kansai', DOH: 'Doha', YVR: 'Vancouver', YYZ: 'Toronto' }[code] || code);
export function changesOf(f, prev, next, now) {
  const at = new Date(now).toISOString(), who = names(f.people), no = f.no.replace(/^([A-Z0-9]{2})(\d)/, '$1 $2'), out = [];
  const add = (kind, text, extra = {}) => out.push({ at, kind, text, ...extra });
  if (next.st === 'cancelled' && (!prev || prev.st !== 'cancelled')) add('cancel', `${who}'s flight ${no} has been cancelled.`);
  if (next.st === 'diverted' && (!prev || prev.st !== 'diverted')) add('cancel', `${who}'s flight ${no} is diverting to ${place(next.to) || 'another airport'}.`);
  if (!prev) return out; // the first look sets the baseline: nothing has "changed" yet
  if (next.st === 'landed' && prev.st !== 'landed') add('landed', `${who} ${f.people.length > 1 ? 'have' : 'has'} landed at ${place(next.to)}, ${hm(next.arr.act || next.arr.est || next.arr.sch, next.toTz)}.${next.belt ? ` Bags on belt ${next.belt}.` : ''}`);
  else if (next.belt && next.belt !== prev.belt) add('landed', `${who}'s bags from ${no} are on belt ${next.belt}.`, { field: 'belt', from: prev.belt, to: next.belt });
  if (next.st !== 'cancelled' && next.st !== 'landed') {
    // a delay counts once it moves 15+ minutes from the last time anyone was told (alertDep/alertArr), so small wobbles stay quiet
    const base = prev.alertArr || prev.arr.est || prev.arr.sch, now2 = next.arr.est || next.arr.sch;
    if (base && now2 && Math.abs(ms(now2) - ms(base)) >= DELAY_ALERT_MIN * MIN) {
      const later = ms(now2) > ms(base);
      add('delay', `${who}'s flight ${no} ${later ? 'is running late' : 'is early'}. Now lands ${hm(now2, next.toTz)} ${place(next.to) ? place(next.to) + ' time' : ''}.`.replace(/ \./, '.'), { field: 'arr', from: base, to: now2 });
      next.alertArr = now2;
    } else next.alertArr = base;
    const db = prev.alertDep || prev.dep.est || prev.dep.sch, dn = next.dep.est || next.dep.sch;
    if (!next.dep.act && db && dn && Math.abs(ms(dn) - ms(db)) >= DELAY_ALERT_MIN * MIN) { out.push({ at, kind: out.some((c) => c.kind === 'delay') ? null : 'delay', text: `${who}'s flight ${no} now leaves at ${hm(dn, next.fromTz)}.`, field: 'dep', from: db, to: dn }); next.alertDep = dn; }
    else next.alertDep = db;
  }
  // a gate (or terminal) given for the first time counts too: it's usually blank a day before
  if (next.gate && next.gate !== prev.gate) add('gate', prev.gate ? `${who}'s flight ${no} now leaves from gate ${next.gate} (was ${prev.gate}).` : `${who}'s flight ${no} leaves from gate ${next.gate}.`, { field: 'gate', from: prev.gate || '', to: next.gate });
  if (next.term && next.term !== prev.term) add('gate', prev.term ? `${who}'s flight ${no} now leaves from terminal ${next.term} (was ${prev.term}).` : `${who}'s flight ${no} leaves from terminal ${next.term}.`, { field: 'term', from: prev.term || '', to: next.term });
  if (next.arrTerm && next.arrTerm !== prev.arrTerm) add('gate', prev.arrTerm ? `${who}'s flight ${no} now lands at terminal ${next.arrTerm} (was ${prev.arrTerm}).` : `${who}'s flight ${no} lands at terminal ${next.arrTerm}.`, { field: 'arrTerm', from: prev.arrTerm || '', to: next.arrTerm });
  return out;
}

// One round of checks: returns the new flights map and the alerts to send. `look(f)` asks the flight service.
export async function checkFlights({ custom, flights = {}, now = Date.now(), look, airEvery = 5, lead = 24 }) {
  const list = tripFlights(custom), out = {}, alerts = [];
  for (const f of list) {
    let rec = flights[f.id] && flights[f.id].no === f.no ? flights[f.id] : null;
    const due = nextCheck(f, rec, now, airEvery, lead);
    if (due != null && due <= now) {
      try {
        const got = await look(f);
        if (got) {
          const next = { ...got, alertArr: rec && rec.alertArr, alertDep: rec && rec.alertDep };
          const ch = changesOf(f, rec && rec.st !== 'unknown' ? rec : null, next, now); // not found until now: this is the first look
          rec = { ...next, no: f.no, people: f.people, checkedAt: new Date(now).toISOString(), changes: [...ch, ...((rec && rec.changes) || [])].slice(0, 12) };
          for (const c of ch) if (c.kind) alerts.push({ id: f.id, day: f.day, people: f.people, kind: c.kind, text: c.text });
        } else rec = { ...(rec || { st: 'unknown', dep: { sch: f.dep || null }, arr: { sch: f.arr || null }, changes: [] }), no: f.no, people: f.people, checkedAt: new Date(now).toISOString(), missing: true };
      } catch (err) {
        rec = rec ? { ...rec, error: String(err.message || err).slice(0, 80) } : null;
      }
    }
    if (rec) { const n = nextCheck(f, rec, now + 1, airEvery, lead); out[f.id] = { ...rec, nextAt: n == null ? null : new Date(Math.max(n, now)).toISOString() }; }
  }
  return { flights: out, alerts, changed: JSON.stringify(out) !== JSON.stringify(flights) };
}
