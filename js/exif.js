// When (and where) a photo or video was taken, read on the phone before upload.
// Photos: EXIF DateTimeOriginal (+ OffsetTimeOriginal) and GPS from a JPEG. Videos: the QuickTime/MP4 `mvhd` creation time.
// Falls back to the file's own date. Camera times have no time zone, so without an offset they're taken as Japan time.
// Returns { takenAt: ms since epoch, lat, lng, source: 'exif' | 'video' | 'file' }.

const JST = 9 * 3600e3;

export async function readTaken(file) {
  try {
    if (/^video\//.test(file.type) || /\.(mov|mp4|m4v)$/i.test(file.name)) {
      const t = await videoTime(file);
      if (t) return { takenAt: t, lat: null, lng: null, source: 'video' };
    } else {
      const x = exifOf(await file.slice(0, 256 * 1024).arrayBuffer());
      if (x && x.takenAt) return { ...x, source: 'exif' };
    }
  } catch { /* unreadable: use the file date */ }
  return { takenAt: file.lastModified || Date.now(), lat: null, lng: null, source: 'file' };
}

// ── JPEG EXIF ──
export function exifOf(buf) {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let p = 2;
  while (p + 4 < v.byteLength) {
    const marker = v.getUint16(p), len = v.getUint16(p + 2);
    if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return tiff(v, p + 10); // "Exif"
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    p += 2 + len;
  }
  return null;
}
function tiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (o) => v.getUint16(t + o, le), u32 = (o) => v.getUint32(t + o, le);
  const ifd = (o) => { const out = {}; const n = u16(o); for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 }; } return out; };
  const str = (en) => { const off = en.count > 4 ? u32(en.at) : en.at; let s = ''; for (let i = 0; i < en.count - 1; i++) s += String.fromCharCode(v.getUint8(t + off + i)); return s; };
  const rats = (en) => { const off = u32(en.at); const r = []; for (let i = 0; i < en.count; i++) r.push(u32(off + i * 8) / (u32(off + i * 8 + 4) || 1)); return r; };
  const ifd0 = ifd(u32(4)); const out = { takenAt: null, lat: null, lng: null };
  if (ifd0[0x8769]) {
    const ex = ifd(u32(ifd0[0x8769].at));
    const d = (ex[0x9003] || ex[0x9004]) && str(ex[0x9003] || ex[0x9004]); // "2026:10:22 15:42:07"
    const m = d && /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(d);
    if (m) {
      const off = ex[0x9011] && /^([+-])(\d\d):(\d\d)$/.exec(str(ex[0x9011]));
      const offMs = off ? (off[1] === '-' ? -1 : 1) * (+off[2] * 60 + +off[3]) * 60e3 : JST;
      out.takenAt = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - offMs;
    }
  }
  if (ifd0[0x8825]) {
    const g = ifd(u32(ifd0[0x8825].at));
    if (g[2] && g[4]) {
      const dms = (a) => a[0] + a[1] / 60 + a[2] / 3600;
      out.lat = dms(rats(g[2])) * (g[1] && str(g[1]) === 'S' ? -1 : 1);
      out.lng = dms(rats(g[4])) * (g[3] && str(g[3]) === 'W' ? -1 : 1);
    }
  }
  return out;
}

// ── QuickTime / MP4: walk the top-level boxes to moov → mvhd (seconds since 1904, UTC) ──
async function videoTime(file) {
  const read = async (at, n) => new DataView(await file.slice(at, at + n).arrayBuffer());
  const find = async (start, end, type) => {
    let p = start;
    while (p + 8 <= end) {
      const h = await read(p, 16); let size = h.getUint32(0); const t = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      let head = 8; if (size === 1) { size = Number(h.getBigUint64(8)); head = 16; } else if (size === 0) size = end - p;
      if (size < 8) return null;
      if (t === type) return { at: p + head, end: p + size };
      p += size;
    }
    return null;
  };
  const moov = await find(0, file.size, 'moov'); if (!moov) return null;
  const mvhd = await find(moov.at, moov.end, 'mvhd'); if (!mvhd) return null;
  const d = await read(mvhd.at, 20);
  const secs = d.getUint8(0) === 1 ? Number(d.getBigUint64(4)) : d.getUint32(4);
  if (!secs) return null;
  return (secs - 2082844800) * 1000; // 1904 → 1970
}
