// Export the whole trip, as it stands right now (everyone's edits, choices, bookings and expenses),
// as a Word file laid out like the original itinerary document: navy section bars, day header blocks,
// blue times, yellow callouts. Written as raw WordprocessingML and zipped here, so no library is needed.

/* ── tiny zip writer (stored, no compression; Word is happy with that) ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ── WordprocessingML helpers, styled after the original document ── */
const NAVY = '1F3864', BLUE = '2E75B6', INK = '1A1A1A', GREY = '595959', GOLD = 'BF8F00', RED = 'C00000', GREEN = '2F7D32';
const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
// r(text, opts): one run. Newlines become line breaks.
const r = (t, o = {}) => {
  if (t == null || t === '') return '';
  const pr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.caps ? '<w:caps/>' : ''}<w:color w:val="${o.c || INK}"/><w:sz w:val="${o.sz || 18}"/></w:rPr>`;
  return String(t).split('\n').map((line, k) => `<w:r>${pr}${k ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
};
const p = (runs, o = {}) => `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 60}" w:line="${o.line || 252}" w:lineRule="auto"/>${o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang || 0}"/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
const cell = (inner, fill, o = {}) => `<w:tc><w:tcPr>${o.w ? `<w:tcW w:w="${o.w}" w:type="dxa"/>` : '<w:tcW w:w="0" w:type="auto"/>'}${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="${o.pad ?? 80}" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="${o.pad ?? 80}" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>${inner}</w:tc>`;
const table = (rows, grid) => `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((c) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${c}</w:tr>`).join('')}</w:tbl>`;
const FULL = 9792; // text width in twips (Letter, 0.85" sides)
const gap = (n = 120) => p('', { after: n, line: 200 });
const box = (inner, fill) => table([cell(inner, fill)], [FULL]) + gap(100);
const bar = (text, fill = NAVY, color = 'FFFFFF', sz = 24) => gap(160) + box(p(r(text, { b: true, c: color, sz, caps: true }), { after: 0 }), fill);
const subbar = (text, fill, color = INK) => box(p(r(text, { b: true, c: color, sz: 16 }), { after: 0 }), fill);

/* ── the plan with everyone's edits applied (mirrors the trip page) ── */
function parseTime(t, mer) { const m = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM|noon)?/i.exec(t || ''); if (!m) return null; const hr = +m[1]; let ap = m[3] ? m[3].toUpperCase() : mer || (hr >= 1 && hr <= 6 ? 'PM' : 'AM'); if (ap === 'NOON') ap = 'PM'; let h = hr % 12; if (ap === 'PM') h += 12; return h * 60 + +(m[2] || 0); }
function startMin(e) { const parts = (e.time || '').replace(/~/g, '').split(/[–-]/).map((s) => s.trim()).filter(Boolean); if (!parts.length) return null; const mer2 = parts[1] && (/(AM|PM)/i.exec(parts[1]) || [])[1]; return parseTime(parts[0], mer2); }
export function planItems(d, st) {
  const C = st.custom || {}, CH = st.choices || {};
  const patch = (it) => { const c = C[it.id]; if (it.type !== 'event' || !c || c.added) return it; const o = { ...it, _edited: Object.keys(c).some((k) => k !== 'hidden' && k !== 'ts') };
    for (const k of ['title', 'time', 'desc', 'cost', 'who']) if (c[k] != null) o[k] = c[k];
    if ('place' in c) o.place = c.place; if (c.hidden) o.hidden = true; return o; };
  const items = [];
  for (const raw of d.items) {
    if (raw.type === 'choice') { const id = CH[raw.id] || raw.default; const o = raw.options.find((y) => y.id === id) || raw.options[0]; items.push({ ...raw, _chosen: o }); (o.items || []).map(patch).forEach((y) => items.push(y)); }
    else items.push(patch(raw));
  }
  const added = Object.entries(C).filter(([, c]) => c.added && c.day === d.id).sort((a, b) => String(a[1].ts).localeCompare(String(b[1].ts)))
    .map(([id, c]) => ({ type: 'event', id, title: c.title || 'New stop', time: c.time || '', desc: c.desc || '', cost: c.cost || '', who: c.who || 'all', place: c.place || null, hidden: !!c.hidden, _added: true, _after: c.after }));
  for (const a of added) {
    const s0 = startMin(a);
    let at = s0 == null && a._after ? items.findIndex((y) => y.id === a._after) : -1;
    if (at >= 0) { items.splice(at + 1, 0, a); continue; }
    const k = s0 != null ? items.findIndex((y) => y.type === 'event' && startMin(y) != null && startMin(y) > s0) : -1;
    if (k >= 0) items.splice(k, 0, a); else items.push(a);
  }
  return items.filter((y) => !y.hidden);
}

/* ── the document ── */
export function buildTripDocx({ TRIP, DAYS, HOTELS, BOOKINGS, FOOD, TIPS, state, people, me }) {
  const st = state || {}; const P = Object.fromEntries(people.map((q) => [q.id, q]));
  const whoTag = (w) => (w === 'nasa' ? 'NASA only' : w === 'mm' ? 'M&M only' : '');
  const hotelOf = (id) => HOTELS.find((h) => h.id === id) || {};
  const fmtDate = (iso, o) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', o);
  const now = new Date();
  let b = '';

  // title page block
  b += gap(400);
  b += p(r(TRIP.title.toUpperCase(), { b: true, c: NAVY, sz: 56 }), { jc: 'center', after: 120 });
  b += p(r('FULL ITINERARY + PLANNING GUIDE', { b: true, c: BLUE, sz: 26 }), { jc: 'center', after: 80 });
  b += p(r(`${fmtDate(TRIP.start, { month: 'long', day: 'numeric' })} – ${fmtDate(TRIP.end, { month: 'long', day: 'numeric', year: 'numeric' })}  ·  ${DAYS.length} Days`, { c: GREY, sz: 18 }), { jc: 'center', after: 60 });
  b += p(r(`Exported from ourtrips.date on ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${me ? ` by ${me}` : ''}. Includes every edit, choice, booking and expense made in the app.`, { i: true, c: GREY, sz: 15 }), { jc: 'center', after: 240 });
  b += box(p(r('HOTELS  ', { b: true, c: GREEN, sz: 16 }) + r(HOTELS.map((h) => `${h.name} ${h.dates} (${h.nights} night${h.nights > 1 ? 's' : ''})`).join('  ·  '), { i: true, sz: 16 }), { after: 0 }), 'E2EFDA');

  // booking guide
  const marked = (bk) => (st.choices || {})['bk-' + bk.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)] === 'booked';
  const bline = (bk, tag) => p(r('▸ ', { c: RED }) + r(bk.title, { b: true }) + (bk.who ? r(`  (${whoTag(bk.who)})`, { b: true, c: bk.who === 'nasa' ? NAVY : RED, sz: 16 }) : '') + r(`  —  ${bk.when}. ${bk.detail}`) + r(`  [${tag}]`, { i: true, c: BLUE, sz: 16 }), { ind: 160, after: 80 });
  b += bar('Pre-trip booking guide');
  b += subbar('CONFIRMED — Completed  (no further action needed)', 'E2EFDA');
  for (const bk of BOOKINGS.confirmed) b += bline(bk, 'Confirmed');
  for (const bk of BOOKINGS.closer.filter(marked)) b += bline(bk, 'Marked as booked in the app');
  b += gap(80) + subbar('BOOK CLOSER / DAY-OF', 'F0F0F0');
  for (const bk of BOOKINGS.closer.filter((y) => !marked(y))) b += bline(bk, bk.urgent ? 'BOOK NOW' : bk.tel ? `Call ${bk.tel}` : 'To book');

  // food guide
  b += bar('Must-eat food & experience guide');
  for (const city of FOOD) {
    b += box(p(r(city.city.toUpperCase(), { b: true, c: 'FFFFFF', sz: 17 }), { after: 0 }), BLUE);
    for (const it of city.items) {
      b += p(r(it.star ? '●  ' : '·  ', { c: GOLD, b: true }) + r(it.name, { b: true }) + (it.meta ? r(`  ${it.meta}`, { c: GREY, sz: 16 }) : ''), { after: 20, ind: 200, hang: 200, keep: true });
      if (it.text) b += p(r(it.text, { i: true, c: GREY, sz: 16 }), { ind: 400, after: 80 });
    }
    if (city.cafes && city.cafes.length) {
      b += p(r('CAFÉS & QUICK BITES', { b: true, c: BLUE, sz: 16 }), { before: 120, after: 40, keep: true });
      for (const c of city.cafes) b += p(r('·  ', { c: BLUE }) + r(c.name, { b: true, sz: 16 }) + r(`: ${c.text}`, { sz: 16 }), { ind: 200, hang: 200, after: 40 });
    }
    b += gap(60);
  }

  // tips
  b += bar('Japan trip tips — logistics + daily life');
  for (const t of TIPS) {
    b += p(r(t.title.toUpperCase(), { b: true, c: BLUE, sz: 17 }), { before: 140, after: 60, keep: true });
    for (const it of t.items) b += p(r('·  ', { c: BLUE }) + r(it, { sz: 17 }), { ind: 200, hang: 200, after: 40 });
  }

  // day by day
  b += bar('Day-by-day itinerary');
  const NOTE = { warn: ['FFF2CC', GOLD, 'Heads up'], decide: ['FFF2CC', GOLD, 'Decide'], book: ['FFF2CC', RED, 'Book ahead'], tip: ['E2EFDA', GREEN, 'Tip'], note: ['F0F0F0', GREY, 'Note'] };
  for (const d of DAYS) {
    const h = hotelOf(d.hotel);
    const items = planItems(d, st); const evWho = [...new Set(items.filter((y) => y.type === 'event').map((y) => y.who || 'all'))];
    const dayWho = evWho.length === 1 && evWho[0] !== 'all' ? evWho[0] : null; // a day that belongs to one couple says so once, in the header
    const dateHead = `${fmtDate(d.date, { weekday: 'short' }).toUpperCase()} ${fmtDate(d.date, { month: 'short', day: 'numeric' }).toUpperCase()}  —  ${d.title.toUpperCase()}`;
    const head = table([
      cell(p(r(`D${String(d.n).padStart(2, '0')}`, { b: true, c: 'F2C14E', sz: 30 }), { after: 0 }), NAVY, { w: 1600, pad: 140 }) +
      cell(p(r(dateHead, { b: true, c: 'FFFFFF', sz: 22 }), { after: 30 }) + (d.tagline ? p(r(`✦  ${d.tagline}`, { i: true, c: 'C8D3EA', sz: 16 }), { after: 0 }) : ''), NAVY, { w: FULL - 1600, pad: 140 }),
      cell(p(r('Energy: ', { c: GREY, sz: 15 }) + r(d.energy || '', { b: true, c: RED, sz: 15 }) + r('   ·   Dinner: ', { c: GREY, sz: 15 }) + r(d.dinner || '', { sz: 15 }) + r('   ·   Hotel: ', { c: GREY, sz: 15 }) + r(h.name || '', { sz: 15 }) + (dayWho ? r(`   ·   ${whoTag(dayWho)}`, { b: true, c: dayWho === 'nasa' ? NAVY : RED, sz: 15 }) : ''), { after: 0 }), 'D9E2F3', { span: 2, pad: 60 }),
    ], [1600, FULL - 1600]);
    b += gap(240) + head + gap(80);
    for (const it of items) {
      if (it.type === 'section') { b += gap(60) + subbar(it.title.toUpperCase(), 'EBF0FA', BLUE); continue; }
      if (it.type === 'note' && dayWho && it.who && it.who !== dayWho) continue; // e.g. the app's "M&M arrive Oct 21" placeholder on NASA-only days
      if (it.type === 'note') { const [fill, col, label] = NOTE[it.kind] || NOTE.note; const w = whoTag(it.who);
        b += box(p(r(`${(it.title || label).toUpperCase()}${w ? `  (${w})` : ''}  `, { b: true, c: col, sz: 16 }) + r(it.text || '', { i: true, sz: 16 }), { after: 0 }), fill); continue; }
      if (it.type === 'choice') { const o = it._chosen; const others = it.options.filter((y) => y !== o).map((y) => y.label);
        b += box(p(r(`${it.title.toUpperCase()}  `, { b: true, c: GOLD, sz: 16 }) + r(`Chosen: ${o.label}.`, { b: true, sz: 16 }) + (o.desc ? r(` ${o.desc}`, { i: true, sz: 16 }) : '') + (others.length ? r(`\nOther options: ${others.join(' · ')}`, { i: true, c: GREY, sz: 15 }) : ''), { after: 0 }), 'FFF8E1'); continue; }
      if (it.type !== 'event') continue;
      const w = it.who === dayWho ? '' : whoTag(it.who);
      const flags = [it.confirmed ? r('  CONFIRMED', { b: true, c: GREEN, sz: 15 }) : '', it.tbd ? r('  TBD', { b: true, c: GOLD, sz: 15 }) : '', it.optional ? r('  (optional)', { i: true, c: GREY, sz: 15 }) : '', w ? r(`  [${w}]`, { b: true, c: it.who === 'nasa' ? NAVY : RED, sz: 15 }) : '',
        it._added ? r('  (added in the app)', { i: true, c: BLUE, sz: 15 }) : it._edited ? r('  (edited in the app)', { i: true, c: BLUE, sz: 15 }) : '', (st.checks || {})[it.id] ? r('  ✓ done', { b: true, c: GREEN, sz: 15 }) : ''].join('');
      const desc = [it.desc, it.cost ? `Cost: ${it.cost}.` : '', it.travel && it.travel.label ? `Getting there: ${it.travel.label}.` : ''].filter(Boolean).join(' ');
      b += p(r(it.time || '', { b: true, c: BLUE }) + r(it.time ? '   ' : '') + r(it.title, { b: true }) + (desc ? r(`  —  ${desc}`) : '') + flags, { ind: 1300, hang: 1300, after: 70 });
    }
  }

  // expenses
  const ex = Object.entries(st.expenses || {}).map(([id, e]) => ({ id, ...e })).filter((e) => P[e.payer] && Array.isArray(e.split) && e.split.length);
  b += bar('Shared expenses');
  if (!ex.length) b += p(r('No expenses logged yet.', { i: true, c: GREY }));
  else {
    const bal = Object.fromEntries(people.map((q) => [q.id, 0]));
    for (const e of ex) { bal[e.payer] += e.yen; for (const id of e.split) if (id in bal) bal[id] -= e.yen / e.split.length; }
    const yen = (n) => '¥' + Math.round(n).toLocaleString('en-US');
    const spend = ex.filter((e) => e.cat !== 'settle').reduce((s, e) => s + e.yen, 0);
    const nasa = (bal.naf || 0) + (bal.sara || 0), mm = (bal.mariam || 0) + (bal.m || 0);
    b += p(r('Trip spend so far: ', { b: true }) + r(yen(spend)), { after: 40 });
    b += p(r('Settle up (couples): ', { b: true }) + r(Math.abs(nasa) < 1 ? 'Everyone is square.' : nasa > 0 ? `M&M pay NASA ${yen(nasa)}.` : `NASA pay M&M ${yen(-nasa)}.`), { after: 40 });
    b += p(r('By person: ', { b: true }) + r(people.map((q) => `${q.name} ${bal[q.id] >= 0 ? 'gets back' : 'owes'} ${yen(Math.abs(bal[q.id]))}`).join('  ·  ')), { after: 120 });
    const dayNum = (id) => { const d = DAYS.find((y) => y.id === id); return d ? d.n : 99; };
    const splitName = (s) => (s.length === 4 ? 'all four' : s.join() === 'naf,sara' ? 'NASA' : s.join() === 'mariam,m' ? 'M&M' : s.map((id) => (P[id] || {}).name).join(', '));
    const rows = [cell(p(r('Day', { b: true, c: 'FFFFFF', sz: 16 }), { after: 0 }), NAVY, { w: 900 }) + cell(p(r('What', { b: true, c: 'FFFFFF', sz: 16 }), { after: 0 }), NAVY, { w: 4400 }) + cell(p(r('Paid by', { b: true, c: 'FFFFFF', sz: 16 }), { after: 0 }), NAVY, { w: 1400 }) + cell(p(r('For', { b: true, c: 'FFFFFF', sz: 16 }), { after: 0 }), NAVY, { w: 1592 }) + cell(p(r('Amount', { b: true, c: 'FFFFFF', sz: 16 }), { after: 0, jc: 'right' }), NAVY, { w: 1500 })];
    ex.sort((a, z) => dayNum(a.day) - dayNum(z.day) || String(a.ts).localeCompare(String(z.ts))).forEach((e, i) => {
      const f = i % 2 ? 'FFFFFF' : 'F5F7FB';
      rows.push(cell(p(r(dayNum(e.day) < 99 ? `D${dayNum(e.day)}` : '—', { sz: 16 }), { after: 0 }), f, { w: 900, pad: 50 }) + cell(p(r(e.title, { sz: 16, c: e.cat === 'settle' ? GREEN : INK }), { after: 0 }), f, { w: 4400, pad: 50 }) + cell(p(r(P[e.payer].name, { sz: 16 }), { after: 0 }), f, { w: 1400, pad: 50 }) + cell(p(r(e.cat === 'settle' ? `→ ${(P[e.split[0]] || {}).name}` : splitName(e.split), { sz: 16 }), { after: 0 }), f, { w: 1592, pad: 50 }) + cell(p(r(yen(e.yen), { sz: 16, b: true }), { after: 0, jc: 'right' }), f, { w: 1500, pad: 50 }));
    });
    b += table(rows, [900, 4400, 1400, 1592, 1500]);
  }

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${b}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1224" w:bottom="1080" w:left="1224" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Yu Gothic" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="${INK}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/document.xml', doc],
    ['word/styles.xml', styles],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(TRIP.title)} itinerary</dc:title><dc:creator>${x(me || 'ourtrips.date')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
  ]);
}
