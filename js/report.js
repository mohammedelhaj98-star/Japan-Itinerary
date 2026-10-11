// Problem reports: an error on any phone is recorded on the server (/api/log), so a fix can start from what actually
// broke. Batched: at most one request per page load, a few seconds after the first error; the same error isn't sent
// twice in an hour; with no signal they wait on the phone and go with the next page load.
(function () {
  if (location.protocol === 'file:' || window.__report) return;
  window.__report = true;
  var KEY = 'trips.errlog', sent = {}, queue = [], timer = 0;
  try { sent = JSON.parse(localStorage.getItem(KEY + '.sent') || '{}'); queue = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { /* private mode */ }
  function who() { try { return JSON.parse(localStorage.getItem('trips.me')) || ''; } catch (e) { return ''; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(queue.slice(-10))); localStorage.setItem(KEY + '.sent', JSON.stringify(sent)); } catch (e) { /* full */ } }
  function flush() {
    timer = 0; if (!queue.length || navigator.onLine === false) return;
    var batch = queue.splice(0, 10); save();
    fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ errors: batch }), keepalive: true })
      .catch(function () { queue = batch.concat(queue); save(); });
  }
  function add(msg, stack) {
    msg = String(msg || 'Unknown error').slice(0, 300);
    if (/ResizeObserver loop|Script error\.?$|Load failed|NetworkError|Failed to fetch|AbortError/.test(msg)) return; // noise, or just no signal
    var k = location.pathname + '|' + msg, now = Date.now();
    if (sent[k] && now - sent[k] < 3600e3) return;
    for (var x in sent) if (now - sent[x] > 3600e3) delete sent[x];
    sent[k] = now;
    queue.push({ msg: msg, stack: String(stack || '').slice(0, 600), page: location.pathname + location.search.slice(0, 40), who: who(), ua: navigator.userAgent.slice(0, 160), at: now, v: (document.documentElement.dataset.v || '') });
    save(); if (!timer) timer = setTimeout(flush, 3000);
  }
  window.addEventListener('error', function (e) { add(e.message, e.error && e.error.stack ? e.error.stack : (e.filename || '') + ':' + (e.lineno || '')); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; add(r && r.message ? r.message : r, r && r.stack); });
  if (queue.length) timer = setTimeout(flush, 3000); // ones that waited for signal
})();
