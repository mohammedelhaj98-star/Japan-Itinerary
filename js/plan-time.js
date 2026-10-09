// Matching a photo to the plan: which trip day, and which stop, from when (and maybe where) it was taken.
// Shared by the photos page (and later the trip page's pass strips).

const JST = 9 * 3600e3;

// "~11:10 AM–12:30 PM", "3:00–4:30 PM", "11:30–1 PM", "7 PM" → [start, end] in minutes after midnight (null if no time).
export function parseRange(t) {
  if (!t) return null;
  const parts = [...String(t).replace(/~/g, '').matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi)].slice(0, 2)
    .map((x) => ({ h: +x[1], mi: +(x[2] || 0), ap: (x[3] || '').toUpperCase() })).filter((p) => p.h <= 12 && p.mi < 60);
  if (!parts.length) return null;
  const tail = parts[parts.length - 1].ap || parts[0].ap;
  const toMin = (p) => { let h = p.h % 12; if ((p.ap || tail) === 'PM') h += 12; return h * 60 + p.mi; };
  let a = toMin(parts[0]); let b = parts[1] ? toMin(parts[1]) : a + 60;
  if (parts[1] && !parts[0].ap && a > b) a -= 12 * 60; // "11:30–1 PM" starts at 11:30 AM
  if (b < a) b += 12 * 60;
  return [a, b];
}

// Every timed or placed stop of a day, in order (events inside choices count too).
export function stopsOf(day) {
  const out = [];
  for (const it of day.items) {
    const evs = it.type === 'event' ? [it] : it.type === 'choice' ? it.options.flatMap((o) => o.items || []).filter((x) => x.type === 'event') : [];
    for (const e of evs) out.push({ id: e.id, title: e.title, time: e.time || '', who: e.who || 'all', place: e.place || null, range: parseRange(e.time) });
  }
  return out.sort((x, y) => (x.range ? x.range[0] : 1e9) - (y.range ? y.range[0] : 1e9));
}

// Japan-time day id and minutes for a moment.
export function jstOf(ms, DAYS) {
  const iso = new Date(ms + JST).toISOString();
  const day = DAYS.find((d) => d.date === iso.slice(0, 10)) || null;
  return { day, date: iso.slice(0, 10), min: +iso.slice(11, 13) * 60 + +iso.slice(14, 16) };
}

const metres = (a, b, c, d) => { const R = 6371e3, r = Math.PI / 180; const x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * R; };

// The stop a photo belongs to: near a stop's place (when the photo has a location), else the stop whose time it falls in,
// else the nearest in time within 90 minutes. Returns { stop, how: 'location' | 'time' | 'near' } or null (an "other moment").
export function matchStop(day, min, lat, lng) {
  const stops = stopsOf(day);
  if (lat != null && lng != null) {
    const near = stops.filter((s) => s.place).map((s) => ({ s, m: metres(lat, lng, s.place.lat, s.place.lng) })).sort((a, b) => a.m - b.m)[0];
    if (near && near.m < 1500) return { stop: near.s, how: 'location' };
  }
  const timed = stops.filter((s) => s.range);
  const inside = timed.filter((s) => min >= s.range[0] && min <= s.range[1]).sort((a, b) => b.range[0] - a.range[0])[0];
  if (inside) return { stop: inside, how: 'time' };
  const close = timed.map((s) => ({ s, gap: Math.min(Math.abs(min - s.range[0]), Math.abs(min - s.range[1])) })).sort((a, b) => a.gap - b.gap)[0];
  if (close && close.gap <= 90) return { stop: close.s, how: 'near' };
  return null;
}

export const fmtMin = (m) => { const h = Math.floor(m / 60) % 24, mi = m % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
