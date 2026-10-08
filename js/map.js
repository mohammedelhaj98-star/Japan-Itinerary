// Map module — Leaflet + OpenStreetMap tiles, numbered pins per day,
// street-routed walking/driving legs via OSRM, straight dashed lines for transit.

const OSRM = 'https://router.project-osrm.org/route/v1';
const ROUTE_CACHE_KEY = 'japan2026.routes.v1';

const MODE_STYLE = {
  walk: { color: '#008a3e', dash: null, osrm: 'foot', gmaps: 'walking', label: 'Walk' },
  drive: { color: '#d35f00', dash: null, osrm: 'driving', gmaps: 'driving', label: 'Drive' },
  taxi: { color: '#d35f00', dash: null, osrm: 'driving', gmaps: 'driving', label: 'Taxi' },
  transit: { color: '#0063b5', dash: '6 8', osrm: null, gmaps: 'transit', label: 'Transit' },
  train: { color: '#0063b5', dash: '6 8', osrm: null, gmaps: 'transit', label: 'Train' },
  boat: { color: '#0083a3', dash: '2 8', osrm: null, gmaps: 'transit', label: 'Boat' },
  ropeway: { color: '#0083a3', dash: '2 8', osrm: null, gmaps: 'transit', label: 'Ropeway' },
  flight: { color: '#6f6f6f', dash: '1 10', osrm: null, gmaps: 'transit', label: 'Flight' },
};
export const modeStyle = (mode) => MODE_STYLE[mode] || MODE_STYLE.transit;

let routeCache = {};
try { routeCache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}'); } catch { routeCache = {}; }
function saveCache() { try { localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(routeCache)); } catch { /* ignore */ } }

export function gmapsDir(from, to, mode) {
  const tm = modeStyle(mode).gmaps;
  const o = from ? `&origin=${encodeURIComponent(from.q || from.name)}` : '';
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${encodeURIComponent(to.q || to.name)}&travelmode=${tm}`;
}
export function gmapsPlace(p) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.q || p.name)}`;
}

const haversine = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

async function fetchRoute(from, to, profile) {
  const key = `${profile}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  if (routeCache[key]) return routeCache[key];
  const url = `${OSRM}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM ' + res.status);
  const data = await res.json();
  const r = data.routes && data.routes[0];
  if (!r) throw new Error('no route');
  const out = { coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: r.distance / 1000, min: r.duration / 60 };
  routeCache[key] = out; saveCache();
  return out;
}

export function createMap(el) {
  const map = L.map(el, { zoomControl: true, attributionControl: true, tap: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.setView([35.0, 137.5], 6);

  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  let aborted = false;

  function numberIcon(n, opts = {}) {
    const cls = ['pin', opts.optional ? 'pin-optional' : '', opts.who && opts.who !== 'all' ? 'pin-' + opts.who : '', opts.done ? 'pin-done' : ''].join(' ');
    return L.divIcon({ className: '', html: `<div class="${cls}">${n}</div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] });
  }
  function dotIcon(label) {
    return L.divIcon({ className: '', html: `<div class="pin pin-dot" title="${label}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
  }

  return {
    map,
    clear() { aborted = true; layer.clearLayers(); markers.clear(); },

    // stops: [{ id, n, place, title, time, travel, optional, who, done }]
    async showDay(stops, { onSelect } = {}) {
      this.clear();
      aborted = false;
      const token = {}; this._token = token;
      if (!stops.length) return;

      const bounds = [];
      stops.forEach((s) => {
        const m = L.marker([s.place.lat, s.place.lng], { icon: numberIcon(s.n, s) }).addTo(layer);
        m.bindPopup(`<div class="pop"><div class="pop-n">${s.n}</div><div class="pop-body"><div class="pop-t">${esc(s.title)}</div><div class="pop-time">${esc(s.time || '')}</div><div class="pop-links"><a href="${gmapsPlace(s.place)}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div>`);
        m.on('click', () => onSelect && onSelect(s.id));
        markers.set(s.id, m);
        bounds.push([s.place.lat, s.place.lng]);
        (s.subplaces || []).forEach((sp) => {
          L.marker([sp.lat, sp.lng], { icon: dotIcon(sp.name) }).addTo(layer).bindPopup(`<div class="pop"><div class="pop-body"><div class="pop-t">${esc(sp.name)}</div><div class="pop-links"><a href="${gmapsPlace(sp)}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div>`);
        });
      });
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      setTimeout(() => { if (this._token === token) { map.invalidateSize(); map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } }, 120);

      // Legs
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1], b = stops[i];
        const mode = (b.travel && b.travel.mode) || 'transit';
        const st = modeStyle(mode);
        const straight = [[a.place.lat, a.place.lng], [b.place.lat, b.place.lng]];
        const line = L.polyline(straight, { color: st.color, weight: 4, opacity: 0.8, dashArray: st.dash || null }).addTo(layer);
        line.bindPopup(`<div class="pop"><div class="pop-body"><div class="pop-t">${st.label}: ${esc(a.title)} to ${esc(b.title)}</div><div class="pop-time">${esc((b.travel && b.travel.label) || mode)}</div><div class="pop-links"><a href="${gmapsDir(a.place, b.place, mode)}" target="_blank" rel="noopener">Directions in Google Maps</a></div></div></div>`);
        if (st.osrm && haversine(a.place, b.place) < 120) {
          fetchRoute(a.place, b.place, st.osrm).then((r) => {
            if (aborted || this._token !== token) return;
            line.setLatLngs(r.coords);
          }).catch(() => { /* keep straight line */ });
        }
      }
    },

    focus(id) {
      const m = markers.get(id);
      if (!m) return false;
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.6 });
      m.openPopup();
      return true;
    },

    showOverview(points, { onSelect } = {}) {
      this.clear();
      aborted = false;
      const bounds = [];
      points.forEach((p) => {
        const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="pin pin-hotel">${p.label}</div>`, iconSize: [34, 28], iconAnchor: [17, 28], popupAnchor: [0, -26] }) }).addTo(layer);
        m.bindPopup(`<div class="pop"><div class="pop-body"><div class="pop-t">${esc(p.name)}</div><div class="pop-time">${esc(p.sub || '')}</div><div class="pop-links"><a href="${gmapsPlace(p)}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div>`);
        m.on('click', () => onSelect && onSelect(p));
        bounds.push([p.lat, p.lng]);
      });
      if (points.length > 1) {
        L.polyline(points.map((p) => [p.lat, p.lng]), { color: '#1565c0', weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(layer);
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    },

    showPoints(points) {
      this.clear();
      aborted = false;
      const bounds = [];
      points.forEach((p) => {
        const m = L.marker([p.lat, p.lng], { icon: dotIcon(p.name) }).addTo(layer);
        m.bindPopup(`<div class="pop"><div class="pop-body"><div class="pop-t">${esc(p.name)}</div><div class="pop-time">${esc(p.sub || '')}</div><div class="pop-links"><a href="${gmapsPlace(p)}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div>`);
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length) { map.invalidateSize(); map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 }); }
    },

    invalidate() { setTimeout(() => map.invalidateSize(), 50); },
  };
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
