// "Letter it": Japanese lettering on the trip's photos, for posting. Brush calligraphy, anime title lettering, an elegant
// mincho or the site's own type; a red name stamp (hanko) and a few stickers; drag, pinch and turn anything; the photo's
// shape (post, story, square, its own) and look. The words come from the plan: the day the photo is filed under, that
// day's places and moments, any place on the trip, or your own (Claude writes the Japanese, and says what a stamp you
// type means). Every Japanese word shows its English. One look can go on many photos, each keeping its own place.
// Loaded by photos.html only when it's opened: openLetter({ photos, start, src, days, stopsOf, places, ai, save }).
//   photos: [{ id, day, stop, takenAt, rot, name, in }]   src(p): a same-origin picture of it (about 2000 px)
//   days: DAYS   stopsOf(dayId) → stops   places() → Promise<PLACES>   ai({ en?, ja?, stamp? }) → Promise<{ en, ja } | { off }>
//   save(items: [{ blob, from }], album: bool)   puts them on the phone (and a copy in the album)

const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Potta+One&family=Dela+Gothic+One&family=Shippori+Mincho+B1:wght@700&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap';
const F = { brush:'"Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif', mincho:'"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif', pop:'"Potta One", "Hiragino Sans", sans-serif', heavy:'"Dela Gothic One", "Hiragino Sans", sans-serif', gothic:'"Zen Kaku Gothic New", "Hiragino Sans", system-ui, sans-serif' };

// Japanese for each day, and for moments on the plan that aren't a place (the rest: Claude writes it when picked)
const DAY_JA = { d01:'東京到着', d02:'原宿と川越まつり', d03:'富士山とおまかせ', d04:'築地・銀座・下北沢・中野', d05:'箱根', d06:'箱根から京都へ', d07:'奈良・大阪', d08:'嵐山と侍', d09:'伏見稲荷と茶道', d10:'東山で着物の日', d11:'ユニバのハロウィン', d12:'京都から東京へ', d13:'浅草とかっぱ橋', d14:'東京ディズニーシー', d15:'明治神宮から新宿へ', d16:'池袋のハロウィン', d17:'さよなら日本' };
const DAY_EN = { d01:'Arrival in Tokyo', d02:'Kawagoe Matsuri', d03:'Fuji + omakase', d04:'Tsukiji to Nakano', d05:'Hakone', d06:'Hakone to Kyoto', d07:'Nara + Osaka', d08:'Arashiyama + samurai', d09:'Fushimi + tea ceremony', d10:'Kimono day', d11:'USJ Halloween', d12:'Kyoto to Tokyo', d13:'Asakusa + Kappabashi', d14:'Tokyo DisneySea', d15:'Meiji to Shinjuku', d16:'Halloween in Ikebukuro', d17:'Goodbye, Japan' };
const MOMENT = {
  'd01-land':['Hello Japan!','こんにちは日本'], 'd01-skyliner':['Skyliner','スカイライナー'], 'd01-dinner':['First dinner','最初の夕食'],
  'd02-bfast':['Konbini breakfast','コンビニ朝ごはん'], 'd02-stalls':['Festival night','祭りの夜'], 'd02-hikkawase':['Hikkawase','曳っかわせ'], 'd02-festzone':['Kawagoe Matsuri','川越まつり'],
  'd05-tozan':['Hakone Tozan Railway','箱根登山鉄道'], 'd05-room':['Yukata time','浴衣でお茶'], 'd05-onsen':['Private onsen','貸切温泉'], 'd05-kaiseki':['Kaiseki dinner','懐石料理'],
  'd06-bfast':['Ryokan breakfast','旅館の朝ごはん'], 'd06-ekiben':['Ekiben','駅弁'], 'd06-shinkansen':['Shinkansen','新幹線'], 'd06-gion':['Gion stroll','祇園さんぽ'], 'd06-nex':['Narita Express','成田エクスプレス'], 'd06-nozomi':['Nozomi','新幹線のぞみ'], 'd06-mm-meet':['Together again','また会えたね'],
  'd07-deer':['Nara deer','奈良の鹿'], 'd07-mochi':['Fresh mochi','つきたて餅'], 'd07-ferris':['Ebisu Tower','えびすタワー'], 'd07-dinner':['Osaka dinner','大阪の夜ごはん'],
  'd08-boat':['River boat','桂川の舟'], 'd08-samurai':['Samurai class','侍体験'], 'd08-dinner':['Dinner in Pontocho','先斗町の夜'], 'd08-osaka':['Dotonbori at night','夜の道頓堀'],
  'd09-fushimi':['Fushimi Inari at dawn','夜明けの伏見稲荷'], 'd09-orizuruya':['Tea ceremony','茶道体験'], 'd09-nishiki':["Kyoto's kitchen",'京の台所'],
  'd10-kiyomizu':['Kiyomizu at dawn','朝の清水寺'], 'd10-kimono':['Kimono day','着物の日'], 'd10-photo':['Kimono photoshoot','着物で撮影'], 'd10-free':['Higashiyama in kimono','着物で東山'], 'd10-kodaiji':['Kodai-ji lights','高台寺ライトアップ'],
  'd11-ollivanders':['Wand ceremony','杖の儀式'], 'd11-butterbeer':['Butterbeer','バタービール'], 'd11-hippogriff':['Flight of the Hippogriff','ヒッポグリフ'], 'd11-snw':['Super Nintendo World','スーパー・ニンテンドー・ワールド'], 'd11-mariokart':['Mario Kart','マリオカート'], 'd11-yoshi':["Yoshi's Adventure",'ヨッシー・アドベンチャー'], 'd11-minecart':['Mine Cart Madness','トロッコ'], 'd11-hhn':['Halloween Horror Nights','ハロウィーン・ホラー・ナイト'],
  'd12-onitsuka':['Onitsuka Tiger','オニツカタイガー'], 'd12-yoroniku':['Yoroniku','よろにく'], 'd12-marunouchi':['Marunouchi','丸の内'],
  'd13-zencraft':['Chopstick workshop','箸づくり体験'], 'd13-okachimachi':['Okachimachi','御徒町'], 'd14-park':['DisneySea day','ディズニーシーの一日'],
  'd16-costume':['Costume time','コスプレタイム'], 'd16-dinner':['Halloween dinner','ハロウィンの夜ごはん'],
  'd17-bfast':['Last konbini breakfast','最後のコンビニ朝ごはん'], 'd17-free':['Last shopping','最後のお買い物'], 'd17-mo':['See you, Japan','またね、日本'], 'd17-mariam':['See you, Japan','またね、日本'],
};
const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// what each stamp means, shown under it
const STAMP_EN = { '旅':'Journey', '思い出':'Memories', '最高':'The best', '日本':'Japan', '一緒':'Together', '感謝':'Thank you' };
const COLS = {
  brush: [{ f:'#ffffff', sub:'rgba(255,255,255,.9)', glow:'rgba(0,0,0,.6)' }, { f:'#141412', sub:'#141412', glow:'rgba(255,255,255,.75)' }, { f:'#d4142f', sub:'#ffffff', glow:'rgba(0,0,0,.4)' }, { f:'#efc15a', sub:'#ffffff', glow:'rgba(0,0,0,.6)' }],
  anime: [{ f:'#ffffff', s1:'#e23b2e', s2:'#141412', tag:'#ffd400', tagInk:'#141412' }, { f:'#ffd400', s1:'#141412', s2:'#ffffff', tag:'#e23b2e', tagInk:'#ffffff' }, { f:'#ff7eb6', s1:'#ffffff', s2:'#141412', tag:'#5ce1ff', tagInk:'#141412' }, { f:'#5ce1ff', s1:'#1b2a6b', s2:'#ffffff', tag:'#ffffff', tagInk:'#1b2a6b' }],
  mincho: [{ f:'#ffffff', sub:'rgba(255,255,255,.88)', glow:'rgba(0,0,0,.5)' }, { f:'#141412', sub:'#141412', glow:'rgba(255,255,255,.7)' }, { f:'#d4142f', sub:'#ffffff', glow:'rgba(0,0,0,.4)' }, { f:'#efc15a', sub:'#ffffff', glow:'rgba(0,0,0,.55)' }],
  simple: [{ f:'#ffffff', sub:'rgba(255,255,255,.88)', glow:'rgba(0,0,0,.5)' }, { f:'#141412', sub:'#141412', glow:'rgba(255,255,255,.7)' }, { f:'#ffd400', sub:'#ffffff', glow:'rgba(0,0,0,.5)' }, { f:'#ff7eb6', sub:'#ffffff', glow:'rgba(0,0,0,.5)' }],
};
const STAMP_COLS = [{ bg:'#c8102e', ink:'#ffffff' }, { bg:'#141412', ink:'#ffffff' }, { bg:'#c9a227', ink:'#141412' }];
const STICKERS = [['sakura', 'Sakura'], ['momiji', 'Maple leaf'], ['torii', 'Torii gate'], ['fuji', 'Fuji'], ['lantern', 'Lantern · 旅 = journey'], ['burst', '最高! = the best!']];
const SHAPES = { post:[1080, 1350], story:[1080, 1920], square:[1080, 1080] };

const clean = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/^[⭐\s]+/, '').replace(/\s+[—–-]\s.*$/, '').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const isLatin = (s) => !/[　-鿿＀-￯]/.test(s);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let O = null, S = null, PLACES = {}, root = null, uid = 1, fontsP = null;
const $ = (s) => root.querySelector(s);

/* ═══ the labels a photo can carry ═══ */
function dayInfo(id) {
  const d = O.days.find((x) => x.id === id) || O.days[0], dt = new Date(d.date + 'T12:00:00Z');
  const nice = `${d.dow || ''} ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`.trim();
  return { ...d, nice, tag:`Day ${d.n} · ${nice}`, seal:KANJI[d.n] + '日目' };
}
// words picked or typed before, with the Japanese Claude wrote for them: kept on the phone
const WORDS_KEY = 'letter.words';
const wordsMem = (() => { try { return JSON.parse(lsGet(WORDS_KEY)) || {}; } catch { return {}; } })();
const remember = (en, ja) => { if (!en || !ja) return; wordsMem[en] = ja; lsSet(WORDS_KEY, JSON.stringify(wordsMem)); };
function dayOptions(id) {
  const di = dayInfo(id), out = [{ en:DAY_EN[id] || clean(di.title), ja:DAY_JA[id] || '', why:'The whole day', key:'day' }], seen = new Set([out[0].en]);
  for (const s of O.stopsOf(id)) {
    const add = (en, ja, why) => { if (!en || seen.has(en)) return; seen.add(en); out.push({ en, ja:ja || wordsMem[en] || '', why, key:s.id }); };
    const pl = s.place && PLACES[s.place.name];
    if (MOMENT[s.id]) add(MOMENT[s.id][0], MOMENT[s.id][1], clean(s.title));
    if (pl && pl.ja) add(clean(s.place.name), pl.ja, clean(s.title));
    else if (!MOMENT[s.id]) add(clean(s.title), '', s.place ? clean(s.place.name) : '');
  }
  return out;
}
function photoLabel(p) { const opts = dayOptions(p.day); return (p.stop && opts.find((o) => o.key === p.stop && o.ja)) || (p.stop && opts.find((o) => o.key === p.stop)) || opts[0]; }
function stampMeaning(t, p, L) {
  const di = dayInfo(p.day), lab = photoLabel(p);
  if (t === di.seal) return `Day ${di.n}`;
  if (STAMP_EN[t]) return STAMP_EN[t];
  const day = /^([一二三四五六七八九十]+)日目$/.exec(t); if (day && KANJI.includes(day[1])) return `Day ${KANJI.indexOf(day[1])}`;
  if (lab.ja && lab.ja.includes(t)) return lab.en;
  return (L && L.text === t && L.mean) || '';
}

/* ═══ each photo's edit, kept while you hop between photos ═══ */
const P = () => O.photos[S.cur];
const E = () => S.ed[P().id] || (S.ed[P().id] = freshEdit(P()));
const selL = () => E().layers.find((l) => l.id === S.sel) || null;
function freshEdit(p) { return { shape:'post', tone:'natural', shade:true, crop:{ z:1, cx:.5, cy:.5 }, layers:preset(S.look || 'brush', p), touched:false }; }
function textLayer(p, style, o = {}) {
  const lab = photoLabel(p), di = dayInfo(p.day);
  return { id:uid++, kind:'text', style, col:0, vert:false, show:'both', tagOn:false, en:lab.en, ja:lab.ja, tag:di.tag, auto:true, x:.5, y:.8, s:1, r:0, ...o };
}
function preset(look, p) {
  const di = dayInfo(p.day);
  if (look === 'brush') return [textLayer(p, 'brush', { vert:!!photoLabel(p).ja, downWhenJa:!photoLabel(p).ja, place:['right', 'top'] }), { id:uid++, kind:'stamp', text:di.seal, col:0, auto:true, x:.1, y:.86, s:1, r:-0.05, place:['left', 'bottom'] }];
  if (look === 'anime') return [textLayer(p, 'anime', { tagOn:true, r:-0.05, place:['center', 'bottom'] })];
  if (look === 'mincho') return [textLayer(p, 'mincho', { tagOn:true, place:['center', 'bottom'] })];
  return [textLayer(p, 'simple', { tagOn:true, place:['left', 'bottom'] })];
}

/* ═══ drawing ═══ */
const scratch = document.createElement('canvas').getContext('2d');
function frameSize(e, p) {
  if (e.shape !== 'orig') return SHAPES[e.shape];
  const im = S.imgs[p.id]; return im && im.width ? [1080, Math.round(1080 * im.height / im.width)] : [1080, 1350];
}
// the photo, turned the way it's shown on the site
function loadImg(p) {
  return new Promise((res) => {
    const im = new Image(); let tried = false;
    im.onload = () => {
      const q = ((p.rot || 0) % 360 + 360) % 360; if (!q) return res(im);
      const c = document.createElement('canvas'), sw = q % 180 !== 0; c.width = sw ? im.naturalHeight : im.naturalWidth; c.height = sw ? im.naturalWidth : im.naturalHeight;
      const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(q * Math.PI / 180); g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2); res(c);
    };
    im.onerror = () => { if (!tried && O.srcFallback) { tried = true; im.src = O.srcFallback(p); } else res(null); };
    im.src = O.src(p);
  });
}
// photo looks, done on the pixels so they look the same on every phone
function toned(p, tone) {
  const key = p.id + tone; if (S.toned[key]) return S.toned[key];
  const im = S.imgs[p.id]; if (tone === 'natural' || !im) return im;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    let r = a[i], gr = a[i + 1], b = a[i + 2]; const l = 0.299 * r + 0.587 * gr + 0.114 * b;
    if (tone === 'bw') { const v = (l - 128) * 1.18 + 128; r = gr = b = v; }
    else if (tone === 'vivid') { r = (l + (r - l) * 1.3 - 128) * 1.06 + 128; gr = (l + (gr - l) * 1.3 - 128) * 1.06 + 128; b = (l + (b - l) * 1.3 - 128) * 1.06 + 128; }
    else if (tone === 'warm') { r = r * 1.07 + 10; gr = gr * 1.02 + 4; b = b * 0.88; r = l + (r - l) * 1.1; gr = l + (gr - l) * 1.1; }
    else if (tone === 'film') { r = 22 + (l + (r - l) * 0.8) * 0.86; gr = 18 + (l + (gr - l) * 0.8) * 0.88; b = 26 + (l + (b - l) * 0.8) * 0.82; }
    a[i] = r; a[i + 1] = gr; a[i + 2] = b;
  }
  g.putImageData(d, 0, 0); return (S.toned[key] = c);
}
function coverRect(e, im, W, H) {
  const s = Math.max(W / im.width, H / im.height) * e.crop.z, w = im.width * s, h = im.height * s;
  let x = W / 2 - e.crop.cx * w, y = H / 2 - e.crop.cy * h; x = Math.min(0, Math.max(W - w, x)); y = Math.min(0, Math.max(H - h, y));
  return { x, y, w, h };
}
// the whole picture, in a W×H frame (k: the canvas's pixels per frame unit, smaller for the preview)
function render(c, e, p, W, H, k = 1) {
  c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const im = S.imgs[p.id]; if (!im) return;
  const r = coverRect(e, im, W, H); c.drawImage(toned(p, e.tone), r.x, r.y, r.w, r.h);
  if (e.tone === 'film') { const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (e.shade) shadeFor(c, e, W, H);
  for (const L of e.layers) { c.save(); c.translate(L.x * W, L.y * H); c.rotate(L.r); c.scale(L.s * W / 1080, L.s * W / 1080); L._box = drawLayer(c, L); c.restore(); }
  shadowReset(c);
}
// a soft shade at the edge each set of words sits near (not behind dark words)
function shadeFor(c, e, W, H) {
  const done = new Set();
  for (const L of e.layers) {
    if (L.kind !== 'text' || COLS[L.style][L.col].f === '#141412') continue;
    const edge = L.vert ? (L.x > .5 ? 'right' : 'left') : (L.y > .5 ? 'bottom' : 'top'); if (done.has(edge)) continue; done.add(edge);
    const g = edge === 'bottom' ? c.createLinearGradient(0, H * .55, 0, H) : edge === 'top' ? c.createLinearGradient(0, H * .4, 0, 0) : edge === 'right' ? c.createLinearGradient(W * .5, 0, W, 0) : c.createLinearGradient(W * .5, 0, 0, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}
const shadowReset = (c) => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
function font(c, f, ls = 0) { c.font = f; if ('letterSpacing' in c) c.letterSpacing = ls + 'px'; }

// one layer, centred on 0,0 in a 1080-wide frame; returns its box
function drawLayer(c, L) { return L.kind === 'text' ? drawText(c, L) : L.kind === 'stamp' ? drawStamp(c, L) : drawSticker(c, L.what); }
function parts(L) {
  const hasJa = !!(L.ja && L.ja.trim()), ja = hasJa && L.show !== 'en' ? L.ja.trim() : '', en = (L.show !== 'ja' || !hasJa) ? (L.en || '').trim() : '';
  if (L.style === 'simple') return { main:en || ja, sub:en ? ja : '', tag:L.tagOn ? L.tag : '' }; // Simple leads with the English
  return { main:ja || en, sub:ja ? en : '', tag:L.tagOn ? L.tag : '' };
}
function painterFor(L) {
  const col = COLS[L.style][L.col];
  if (L.style === 'anime') return (c, t, x, y, z, role) => {
    c.lineJoin = 'round'; shadowReset(c);
    if (role === 'main') { c.lineWidth = z * 0.26; c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeText(t, x + z * .05, y + z * .06); c.lineWidth = z * 0.24; c.strokeStyle = col.s2; c.strokeText(t, x, y); c.lineWidth = z * 0.12; c.strokeStyle = col.s1; c.strokeText(t, x, y); c.fillStyle = col.f; c.fillText(t, x, y); }
    else { c.lineWidth = z * 0.24; c.strokeStyle = '#141412'; c.strokeText(t, x, y); c.fillStyle = '#ffffff'; c.fillText(t, x, y); }
  };
  return (c, t, x, y, z, role) => { c.shadowColor = col.glow; c.shadowBlur = role === 'main' ? z * .28 : z * .4; c.fillStyle = role === 'main' ? col.f : col.sub; c.fillText(t, x, y); shadowReset(c); };
}
function drawText(c, L) {
  const { main, sub, tag } = parts(L), col = COLS[L.style][L.col], paint = painterFor(L), latin = isLatin(main);
  if (!main) return { x0:-60, y0:-30, x1:60, y1:30 };
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const st = {
    brush: { mf:(z) => `${z}px ${F.brush}`, Z:latin ? 104 : 124, sf:`700 40px ${F.mincho}`, sz:40, tf:`700 28px ${F.mincho}`, tz:28, tls:3, sls:1 },
    anime: { mf:(z) => `${z}px ${F.pop}`, Z:latin ? 104 : 128, sf:`44px ${F.heavy}`, sz:44, tf:`32px ${F.heavy}`, tz:32, tls:1, sls:0 },
    mincho: { mf:(z) => `700 ${z}px ${F.mincho}`, Z:latin ? 84 : 96, sf:`700 34px ${F.mincho}`, sz:34, tf:`700 26px ${F.mincho}`, tz:26, tls:8, sls:6, mls:latin ? 2 : 14 },
    simple: { mf:(z) => `900 ${z}px ${F.gothic}`, Z:latin ? 84 : 92, sf:`700 44px ${F.gothic}`, sz:44, tf:`700 28px ${F.gothic}`, tz:28, tls:3, sls:0 },
  }[L.style];
  const subT = L.style === 'mincho' || L.style === 'anime' ? sub.toUpperCase() : sub, tagT = L.style === 'brush' ? tag : tag.toUpperCase();
  if (L.vert && !latin) return drawColumn(c, L, main, [subT, tagT].filter(Boolean).join('  ·  '), st, paint);
  // across: the day line, the name, then the other language, stacked and centred
  const lines = [];
  if (tagT) lines.push({ t:tagT, f:st.tf, z:st.tz, h:st.tz * (L.style === 'anime' ? 1.7 : 1.3), ls:st.tls, role:'tag' });
  lines.push({ t:main, f:st.mf(st.Z), z:st.Z, h:st.Z * 1.18, ls:st.mls || 0, role:'main' });
  if (L.style === 'mincho' && subT) lines.push({ rule:true, h:26 });
  if (subT) lines.push({ t:subT, f:st.sf, z:st.sz, h:st.sz * 1.35, ls:st.sls, role:'sub' });
  let w = 0, h = 0; for (const l of lines) { if (!l.rule) { font(c, l.f, l.ls); l.w = c.measureText(l.t).width; w = Math.max(w, l.w); } h += l.h; }
  let y = -h / 2;
  for (const l of lines) {
    const cy = y + l.h / 2;
    if (l.rule) { c.fillStyle = col.f; c.globalAlpha *= .8; c.fillRect(-60, cy - 1.5, 120, 3); c.globalAlpha /= .8; }
    else if (l.role === 'tag' && L.style === 'anime') { font(c, l.f, l.ls); c.fillStyle = col.tag; c.fillRect(-l.w / 2 - 16, cy - l.h / 2 + 4, l.w + 32, l.h - 8); c.fillStyle = col.tagInk; c.fillText(l.t, 0, cy + 1); }
    else { font(c, l.f, l.ls); paint(c, l.t, 0, cy, l.z, l.role === 'main' ? 'main' : 'sub'); }
    y += l.h;
  }
  font(c, '10px sans-serif', 0);
  const pad = L.style === 'anime' ? 22 : 10; return { x0:-w / 2 - pad, y0:-h / 2 - pad, x1:w / 2 + pad, y1:h / 2 + pad };
}
// down: the Japanese a character at a time, the English on its side next to it
function drawColumn(c, L, main, side, st, paint) {
  const chars = [...main].filter((ch) => ch !== ' '), Z = st.Z, step = Z * 1.04, colH = chars.length * step;
  font(c, st.sf, st.sls); const sw = side ? c.measureText(side).width : 0;
  const H = Math.max(colH, sw), colX = side ? st.sz * 0.75 : 0, sideX = colX - Z / 2 - st.sz * 0.9;
  font(c, st.mf(Z));
  chars.forEach((ch, i) => {
    const y = -H / 2 + step * i + step / 2;
    if ('ー〜～－-'.includes(ch)) { c.save(); c.translate(colX, y); c.rotate(Math.PI / 2); paint(c, ch, 0, 0, Z, 'main'); c.restore(); }
    else if ('、。'.includes(ch)) paint(c, ch, colX + Z * .3, y - Z * .3, Z, 'main');
    else paint(c, ch, colX, y, Z, 'main');
  });
  if (side) { c.save(); c.translate(sideX, -H / 2 + sw / 2); c.rotate(Math.PI / 2); font(c, st.sf, st.sls); paint(c, side, 0, 0, st.sz, 'sub'); c.restore(); }
  font(c, '10px sans-serif', 0);
  const x0 = side ? sideX - st.sz * .8 : colX - Z / 2, pad = L.style === 'anime' ? 24 : 10;
  return { x0:x0 - pad, y0:-H / 2 - pad, x1:colX + Z / 2 + pad, y1:H / 2 + pad };
}
// the name stamp (hanko): up to four characters, stacked
function drawStamp(c, L) {
  const chars = [...(L.text || '旅')].slice(0, 4), z = 46, col = STAMP_COLS[L.col] || STAMP_COLS[0], w = z * 1.3, h = chars.length * z * 1.04 + z * .42;
  c.fillStyle = col.bg; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, z * .16); c.fill();
  c.strokeStyle = col.ink; c.globalAlpha *= .9; c.lineWidth = 3; c.beginPath(); c.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, z * .1); c.stroke(); c.globalAlpha /= .9;
  c.fillStyle = col.ink; font(c, `${z}px ${F.brush}`); c.textAlign = 'center'; c.textBaseline = 'middle';
  chars.forEach((ch, i) => c.fillText(ch, 0, -h / 2 + z * .21 + z * 1.04 * i + z * .52));
  return { x0:-w / 2 - 6, y0:-h / 2 - 6, x1:w / 2 + 6, y1:h / 2 + 6 };
}
function drawSticker(c, what) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
  if (what === 'sakura') {
    for (let i = 0; i < 5; i++) { c.save(); c.rotate(i * Math.PI * 2 / 5); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-70, -30, -62, -100, -18, -112); c.lineTo(0, -96); c.lineTo(18, -112); c.bezierCurveTo(62, -100, 70, -30, 0, 0); c.fillStyle = '#fbc4d8'; c.fill(); shadowReset(c); c.strokeStyle = '#ee8bb0'; c.lineWidth = 4; c.stroke(); c.restore(); }
    shadowReset(c); c.strokeStyle = '#e35d8f'; c.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + .3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); c.stroke(); c.beginPath(); c.arc(Math.cos(a) * 36, Math.sin(a) * 36, 5, 0, 7); c.fillStyle = '#f5c443'; c.fill(); }
    c.beginPath(); c.arc(0, 0, 14, 0, 7); c.fillStyle = '#e35d8f'; c.fill();
    return { x0:-118, y0:-118, x1:118, y1:118 };
  }
  if (what === 'momiji') {
    const R = [62, 100, 118, 124, 118, 100, 62], pt = (r, ang) => [Math.cos(ang) * r, Math.sin(ang) * r], deg = Math.PI / 180; c.beginPath();
    for (let k = 0; k < 7; k++) { const a = (-90 + (k - 3) * 42) * deg; if (!k) c.moveTo(...pt(30, a - 21 * deg)); c.lineTo(...pt(R[k] * .62, a - .14)); c.lineTo(...pt(R[k], a)); c.lineTo(...pt(R[k] * .62, a + .14)); c.lineTo(...pt(k === 6 ? 30 : 40, a + 21 * deg)); }
    c.closePath(); const g = c.createLinearGradient(0, -120, 0, 60); g.addColorStop(0, '#f2a03a'); g.addColorStop(1, '#d7362a'); c.fillStyle = g; c.fill();
    shadowReset(c); c.strokeStyle = '#9b2318'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 30); c.lineTo(0, 110); c.stroke();
    c.lineWidth = 2.5; c.strokeStyle = 'rgba(120,20,10,.5)'; for (let k = 0; k < 7; k++) { const a = (-90 + (k - 3) * 42) * deg; c.beginPath(); c.moveTo(0, 10); c.lineTo(Math.cos(a) * R[k] * .8, Math.sin(a) * R[k] * .8 + 10); c.stroke(); }
    return { x0:-125, y0:-125, x1:125, y1:115 };
  }
  if (what === 'torii') {
    c.fillStyle = '#d93a26'; c.fillRect(-76, -60, 22, 170); c.fillRect(54, -60, 22, 170); shadowReset(c);
    c.fillRect(-104, -38, 208, 18); c.fillRect(-12, -62, 24, 26);
    c.beginPath(); c.moveTo(-132, -92); c.quadraticCurveTo(0, -70, 132, -92); c.lineTo(126, -64); c.quadraticCurveTo(0, -50, -126, -64); c.closePath(); c.fill();
    c.fillStyle = '#141412'; c.beginPath(); c.moveTo(-138, -104); c.quadraticCurveTo(0, -80, 138, -104); c.lineTo(132, -88); c.quadraticCurveTo(0, -68, -132, -88); c.closePath(); c.fill();
    c.fillRect(-80, 96, 30, 14); c.fillRect(50, 96, 30, 14);
    return { x0:-140, y0:-108, x1:140, y1:112 };
  }
  if (what === 'fuji') {
    c.beginPath(); c.arc(64, -66, 42, 0, 7); c.fillStyle = '#e2482f'; c.fill(); shadowReset(c);
    c.beginPath(); c.moveTo(-140, 84); c.lineTo(-34, -52); c.quadraticCurveTo(0, -62, 34, -52); c.lineTo(140, 84); c.closePath(); c.fillStyle = '#3f6aa3'; c.fill();
    c.beginPath(); c.moveTo(-34, -52); c.quadraticCurveTo(0, -62, 34, -52); c.lineTo(66, -10); c.lineTo(42, -20); c.lineTo(24, 0); c.lineTo(4, -22); c.lineTo(-16, 2); c.lineTo(-36, -20); c.lineTo(-66, -10); c.closePath(); c.fillStyle = '#ffffff'; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.beginPath(); c.moveTo(-150, 96); c.quadraticCurveTo(-100, 80, -50, 96); c.quadraticCurveTo(0, 112, 50, 96); c.quadraticCurveTo(100, 80, 150, 96); c.stroke();
    return { x0:-152, y0:-110, x1:152, y1:104 };
  }
  if (what === 'lantern') {
    c.strokeStyle = '#141412'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -150); c.lineTo(0, -112); c.stroke();
    c.fillStyle = '#141412'; c.fillRect(-46, -116, 92, 22); c.fillRect(-46, 96, 92, 22);
    c.beginPath(); c.ellipse(0, 0, 84, 100, 0, 0, 7); c.fillStyle = '#d93a26'; c.fill(); shadowReset(c);
    c.strokeStyle = 'rgba(80,10,0,.35)'; c.lineWidth = 3; for (let y = -80; y <= 80; y += 20) { const w = 84 * Math.sqrt(1 - (y / 100) ** 2); c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y + 6, w, y); c.stroke(); }
    c.fillStyle = '#ffffff'; font(c, `92px ${F.brush}`); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('旅', 0, 4);
    c.strokeStyle = '#141412'; c.lineWidth = 4; for (const x of [-12, 0, 12]) { c.beginPath(); c.moveTo(x, 118); c.lineTo(x * 1.4, 150); c.stroke(); }
    return { x0:-90, y0:-152, x1:90, y1:152 };
  }
  // 最高! in a manga burst
  c.beginPath(); for (let i = 0; i < 28; i++) { const a = i * Math.PI * 2 / 28, r = i % 2 ? 92 : 136; if (i) c.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * .82); else c.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * .82); } c.closePath();
  c.fillStyle = '#ffd400'; c.fill(); shadowReset(c); c.strokeStyle = '#141412'; c.lineWidth = 7; c.stroke();
  font(c, `78px ${F.pop}`); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 16; c.strokeStyle = '#141412'; c.strokeText('最高!', 0, 4); c.fillStyle = '#e23b2e'; c.fillText('最高!', 0, 4);
  return { x0:-158, y0:-114, x1:158, y1:114 };
}

/* ═══ fitting a layer into the frame, keeping it on the photo ═══ */
function boxOf(L) { scratch.save(); const b = drawLayer(scratch, L); shadowReset(scratch); scratch.restore(); return b; }
function fitLayer(L, W, H) {
  const b = boxOf(L), bw = b.x1 - b.x0, bh = b.y1 - b.y0, k = W / 1080;
  const maxW = W * (L.kind === 'text' ? .86 : .3), maxH = H * (L.kind === 'text' ? (L.vert ? .66 : .3) : .22);
  L.s = Math.min(L.kind === 'sticker' ? .9 : L.kind === 'text' ? 1.25 : 1, maxW / (bw * k), maxH / (bh * k));
  if (L.place) {
    const m = .05, w = bw * k * L.s / W, h = bh * k * L.s / H, [ax, ay] = L.place;
    L.x = ax === 'left' ? m + w / 2 : ax === 'right' ? 1 - m - w / 2 : .5;
    L.y = ay === 'top' ? m * W / H + h / 2 : 1 - m * W / H - h / 2;
    delete L.place;
  }
}
// a changed layer keeps its spot and its size, unless it no longer fits
function refit(L) { const x = L.x, y = L.y, s0 = L.s; fitLayer(L, S.W, S.H); L.s = Math.min(L.s, Math.max(s0, .2)); L.x = x; L.y = y; keepOn(L); }
const keepOn = (L) => { L.x = Math.min(.97, Math.max(.03, L.x)); L.y = Math.min(.97, Math.max(.03, L.y)); };

/* ═══ the editor ═══ */
const CSS = `
.lt { position:fixed; inset:0; z-index:200; background:var(--paper, #f6f4ef); color:var(--ink, #141412); overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; font-family:var(--font, "Zen Kaku Gothic New", system-ui, sans-serif); }
.lt * { box-sizing:border-box; }
:where(.lt) button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; padding:0; touch-action:manipulation; }
.lt button:focus-visible, .lt input:focus-visible { outline:2px solid #1e6bff; outline-offset:2px; }
:where(.lt) input { font:inherit; color:inherit; }
.lt-top { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:10px; padding:calc(10px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left)); background:rgba(246,244,239,.94); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); box-shadow:0 1px 0 rgba(20,20,10,.08); }
.lt-top h2 { margin:0; font-size:18px; flex:1; letter-spacing:-.01em; }
.lt-top .x { width:38px; height:38px; border-radius:50%; background:rgba(20,20,10,.06); display:grid; place-items:center; flex:none; }
.lt-top .sv { height:38px; padding:0 16px; border-radius:999px; background:#141412; color:#fff; font-weight:700; font-size:14.5px; }
.lt-wrap { max-width:520px; margin:0 auto; padding:12px max(16px, env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); display:flex; flex-direction:column; gap:12px; }
.lt-strip { display:flex; gap:6px; overflow-x:auto; padding:2px 2px 4px; scrollbar-width:none; }
.lt-strip::-webkit-scrollbar { display:none; }
.lt-th { position:relative; flex:none; width:52px; height:68px; border-radius:10px; overflow:hidden; background:#ddd8cc; }
.lt-th img { width:100%; height:100%; object-fit:cover; display:block; }
.lt-th.on { box-shadow:0 0 0 3px #1e6bff; }
.lt-th .e { position:absolute; right:4px; top:4px; width:9px; height:9px; border-radius:50%; background:#c8102e; box-shadow:0 0 0 2px #fff; }
.lt-stage { position:relative; align-self:center; max-width:100%; border-radius:14px; overflow:hidden; background:#000; box-shadow:0 22px 50px -24px rgba(0,0,0,.55); }
.lt-stage canvas { display:block; width:100%; height:100%; }
.lt-stage .ov { position:absolute; inset:0; touch-action:none; }
.lt-stage .wait { position:absolute; inset:0; background:#000; display:grid; place-items:center; color:#fff; font-size:14px; font-weight:700; }
.lt-hint { font-size:12.5px; color:#86847c; line-height:1.45; margin:-2px 2px 0; text-align:center; text-wrap:balance; }
.lt-lbl { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#86847c; margin:6px 2px -4px; }
.lt-seg { display:flex; padding:4px; border-radius:14px; background:rgba(20,20,10,.06); gap:2px; }
.lt-seg button { flex:1; padding:8px 4px; border-radius:10px; font-size:13.5px; font-weight:700; color:#4b4a45; white-space:nowrap; }
.lt-seg button.on { background:#fffdf9; color:#141412; box-shadow:0 1px 3px rgba(0,0,0,.12); }
.lt-looks { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; }
.lt-looks button { padding:9px 2px 8px; border-radius:14px; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); display:flex; flex-direction:column; align-items:center; gap:1px; }
.lt-looks b { font-size:22px; line-height:1.15; font-weight:400; }
.lt-looks small { font-size:11.5px; font-weight:700; color:#4b4a45; }
.lt-looks i { font-style:normal; font-size:10.5px; color:#86847c; white-space:nowrap; }
.lt-layers { display:flex; flex-wrap:wrap; gap:6px; }
.lt-chip { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); font-size:13.5px; font-weight:700; max-width:100%; }
.lt-chip.on { background:#141412; color:#fff; box-shadow:none; }
.lt-chip.add { color:#1e6bff; background:transparent; box-shadow:0 0 0 1px rgba(30,107,255,.35); }
.lt-chip span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:190px; }
.lt-panel { display:flex; flex-direction:column; gap:10px; padding:14px; border-radius:18px; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); }
.lt-says { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:14px; background:rgba(20,20,10,.06); text-align:left; }
.lt-says div { flex:1; min-width:0; }
.lt-says b { display:block; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lt-says small { display:block; font-family:"Yuji Syuku", serif; font-size:15px; color:#4b4a45; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lt-says em { font-style:normal; color:#1e6bff; font-weight:700; font-size:13.5px; }
.lt-sws { display:flex; gap:10px; align-items:center; }
.lt-swatch { width:38px; height:38px; border-radius:50%; position:relative; }
.lt-swatch.on::after { content:""; position:absolute; inset:-5px; border-radius:50%; box-shadow:0 0 0 2px #1e6bff; }
.lt-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.lt-row span { font-size:14.5px; } .lt-row small { display:block; color:#86847c; font-size:12.5px; margin-top:2px; }
.lt-sw { width:46px; height:28px; border-radius:14px; background:rgba(20,20,10,.15); position:relative; flex:none; transition:background 160ms; }
.lt-sw::after { content:""; position:absolute; left:3px; top:3px; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform 200ms cubic-bezier(.23,1,.32,1); }
.lt-sw[aria-checked="true"] { background:#1e6bff; } .lt-sw[aria-checked="true"]::after { transform:translateX(18px); }
.lt-btns { display:flex; gap:8px; }
.lt-btns button { flex:1; padding:10px 6px; border-radius:12px; background:rgba(20,20,10,.06); font-weight:700; font-size:13.5px; }
.lt-btns button.del { color:#c8102e; }
.lt-grid { display:flex; flex-wrap:wrap; gap:6px; }
.lt-grid button { padding:8px 12px; border-radius:12px; background:rgba(20,20,10,.06); font-weight:700; font-size:14px; }
.lt-grid button.on { background:#141412; color:#fff; }
.lt-grid .k { font-family:"Yuji Syuku", serif; font-weight:400; font-size:18px; padding:5px 12px 6px; display:flex; flex-direction:column; align-items:center; line-height:1.25; }
.lt-grid .k small { font-family:"Zen Kaku Gothic New", system-ui, sans-serif; font-size:11px; font-weight:700; opacity:.7; }
.lt-means { margin:0; font-size:13.5px; color:#4b4a45; } .lt-means b { font-family:"Yuji Syuku", serif; font-weight:400; font-size:17px; color:#141412; }
.lt-own { display:flex; gap:6px; } .lt-own input { flex:1; min-width:0; padding:9px 12px; border-radius:12px; border:0; background:rgba(20,20,10,.06); }
.lt-go { display:flex; align-items:center; justify-content:center; gap:8px; padding:15px; border-radius:16px; background:#141412; color:#fff !important; font-weight:700; font-size:16px; }
.lt-go2 { padding:13px; border-radius:16px; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); font-weight:700; font-size:14.5px; }
.lt-note { font-size:12.5px; color:#86847c; line-height:1.45; margin:0 2px; }
.lt-toast { position:fixed; left:50%; bottom:calc(20px + env(safe-area-inset-bottom)); transform:translate(-50%, 20px); opacity:0; pointer-events:none; padding:11px 16px; border-radius:14px; background:#141412; color:#fff; font-size:14px; font-weight:700; transition:opacity 180ms, transform 220ms cubic-bezier(.23,1,.32,1); max-width:calc(100% - 32px); text-align:center; z-index:230; }
.lt-toast.on { opacity:1; transform:translate(-50%, 0); }
.lt-scrim { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:220; display:flex; align-items:flex-end; justify-content:center; }
.lt-sheet { width:min(100%, 520px); max-height:86%; overflow:auto; overscroll-behavior:contain; background:#f6f4ef; border-radius:22px 22px 0 0; padding:16px max(16px, env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); display:flex; flex-direction:column; gap:10px; }
.lt-sheet > * { flex-shrink:0; } /* (the lists keep their full height; the sheet scrolls) */
.lt-sheet h3 { margin:0; font-size:19px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
.lt-sheet h3 button { font-size:14.5px; color:#1e6bff; font-weight:700; }
.lt-sheet input.in { width:100%; padding:11px 14px; border-radius:14px; border:0; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); font-size:16px; }
.lt-opts { display:flex; flex-direction:column; border-radius:16px; background:#fffdf9; box-shadow:0 0 0 1px rgba(20,20,10,.08); overflow:hidden; }
.lt-opt { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 14px; text-align:left; border-top:1px solid rgba(20,20,10,.08) !important; }
.lt-opt:first-child { border-top:0 !important; }
.lt-opt div { min-width:0; } .lt-opt b { display:block; font-size:15px; } .lt-opt small { display:block; font-size:12.5px; color:#86847c; }
.lt-opt .ja { font-family:"Yuji Syuku", serif; font-size:19px; flex:none; color:#4b4a45; max-width:50%; text-align:right; }
.lt-opt.on { background:rgba(30,107,255,.08); }
@media (prefers-reduced-motion: reduce) { .lt-sw::after, .lt-toast { transition:none; } }
`;

function html() {
  return `<div class="lt-top"><button class="x" data-ltx aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button><h2>Letter it</h2><button class="sv" data-ltsave>Save</button></div>
  <div class="lt-wrap">
    <div class="lt-strip" data-strip></div>
    <div class="lt-stage" data-stage><canvas data-cv aria-label="The lettered photo"></canvas><canvas class="ov" data-ov></canvas><div class="wait" data-wait>Getting the photo…</div></div>
    <p class="lt-hint">Drag the words, stamp or stickers to move them. Pinch, or drag the round corner, to resize and turn. Tap the words again to change what they say. Drag the photo to move it in the frame.</p>
    <p class="lt-lbl">Start from a look</p>
    <div class="lt-looks" data-looks>
      <button data-preset="brush"><b style="font-family:'Yuji Syuku',serif">筆</b><small>Brush</small><i>筆 = brush</i></button>
      <button data-preset="anime"><b style="font-family:'Potta One',sans-serif;color:#e23b2e;-webkit-text-stroke:1px #141412">話</b><small>Anime</small><i>話 = story</i></button>
      <button data-preset="mincho"><b style="font-family:'Shippori Mincho B1',serif;font-weight:700">雅</b><small>Elegant</small><i>雅 = grace</i></button>
      <button data-preset="simple"><b style="font-weight:900">Aa</b><small>Simple</small><i>English first</i></button>
    </div>
    <p class="lt-lbl">On this photo</p>
    <div class="lt-layers" data-layers></div>
    <div class="lt-panel" data-panel></div>
    <p class="lt-lbl">The photo</p>
    <div class="lt-seg" data-shape><button data-v="post">Post 4:5</button><button data-v="story">Story 9:16</button><button data-v="square">Square</button><button data-v="orig">Original</button></div>
    <div class="lt-seg" data-tone><button data-v="natural">Natural</button><button data-v="vivid">Vivid</button><button data-v="film">Film</button><button data-v="warm">Warm</button><button data-v="bw">B&amp;W</button></div>
    <div class="lt-panel">
      <div class="lt-row"><span>Soft shade behind the words<small>Darkens the photo's edge a little so the words stand out</small></span><button class="lt-sw" data-shade role="switch" aria-label="Soft shade"></button></div>
      <div class="lt-row"><span>Also add to the album<small>A lettered copy goes next to the photo. The original stays as it was.</small></span><button class="lt-sw" data-album role="switch" aria-label="Also add to the album"></button></div>
    </div>
    <button class="lt-go" data-ltsave><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Save to phone</button>
    <button class="lt-go2" data-all hidden></button>
  </div>
  <div class="lt-toast" data-toast role="status"></div><div data-sheet></div>`;
}

let tt = null;
function toast(t) { const el = $('[data-toast]'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2800); }
function ensureFonts() {
  if (!fontsP) fontsP = new Promise((ok) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.onload = l.onerror = ok; document.head.appendChild(l); setTimeout(ok, 4000); });
  return fontsP;
}
// Japanese fonts come in pieces by character: ask for the characters before drawing them
async function fontsFor(t) {
  await ensureFonts();
  try { await Promise.race([Promise.all(['60px "Yuji Syuku"', '60px "Potta One"', '30px "Dela Gothic One"', '700 30px "Shippori Mincho B1"', '900 30px "Zen Kaku Gothic New"'].map((f) => document.fonts.load(f, t))), new Promise((r) => setTimeout(r, 5000))]); } catch {}
}

/* ── the preview ── */
const cv = () => $('[data-cv]'), ov = () => $('[data-ov]');
let raf = 0, guide = null, dpr = 1;
function sizeStage() {
  const e = E(), [w, h] = frameSize(e, P()); S.W = w; S.H = h;
  const maxW = $('.lt-wrap').clientWidth - 32, maxH = Math.min(innerHeight * .6, 640);
  const cw = Math.max(120, Math.min(maxW, maxH * w / h)), chh = cw * h / w; const st = $('[data-stage]'); st.style.width = cw + 'px'; st.style.height = chh + 'px';
  dpr = Math.min(2, devicePixelRatio || 1); S.k = Math.min(1, cw * dpr / w);
  cv().width = Math.round(w * S.k); cv().height = Math.round(h * S.k); ov().width = Math.round(cw * dpr); ov().height = Math.round(chh * dpr);
}
function draw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
function paint() {
  if (!root) return; const e = E(), p = P();
  // (a new look's words are placed once the fonts are here: their size depends on them)
  if (S.fontsReady) for (const L of e.layers) if (L.place) fitLayer(L, S.W, S.H);
  $('[data-wait]').hidden = !!S.imgs[p.id] && S.fontsReady;
  render(cv().getContext('2d'), e, p, S.W, S.H, S.k); drawOverlay();
}
function corners(L) {
  const b = L._box || boxOf(L), k = L.s * S.W / 1080, cs = Math.cos(L.r), sn = Math.sin(L.r);
  const T = (x, y) => [L.x * S.W + (x * cs - y * sn) * k, L.y * S.H + (x * sn + y * cs) * k];
  return { tl:T(b.x0, b.y0), tr:T(b.x1, b.y0), br:T(b.x1, b.y1), bl:T(b.x0, b.y1) };
}
function drawOverlay() {
  const o = ov(), x = o.getContext('2d'), q = o.width / S.W; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, o.width, o.height);
  if (guide) { x.strokeStyle = 'rgba(255,212,0,.9)'; x.lineWidth = 1.5 * dpr; x.setLineDash([6 * dpr, 5 * dpr]); x.beginPath(); if (guide.x) { x.moveTo(S.W / 2 * q, 0); x.lineTo(S.W / 2 * q, o.height); } if (guide.y) { x.moveTo(0, S.H / 2 * q); x.lineTo(o.width, S.H / 2 * q); } x.stroke(); x.setLineDash([]); }
  const L = selL(); if (!L) return;
  const c = corners(L), pts = [c.tl, c.tr, c.br, c.bl].map(([a, b]) => [a * q, b * q]);
  x.lineWidth = 3 * dpr; x.strokeStyle = 'rgba(0,0,0,.35)'; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.stroke();
  x.lineWidth = 1.5 * dpr; x.strokeStyle = '#fff'; x.setLineDash([7 * dpr, 5 * dpr]); x.stroke(); x.setLineDash([]);
  const [hx, hy] = pts[2]; x.beginPath(); x.arc(hx, hy, 13 * dpr, 0, 7); x.fillStyle = '#1e6bff'; x.fill(); x.lineWidth = 2.5 * dpr; x.strokeStyle = '#fff'; x.stroke(); // the round corner: resize and turn
  x.beginPath(); x.arc(hx, hy, 5.5 * dpr, -2.6, 1.2); x.stroke();
  const [dx, dy] = pts[0]; x.beginPath(); x.arc(dx, dy, 12 * dpr, 0, 7); x.fillStyle = '#141412'; x.fill(); // the cross: take it off
  x.strokeStyle = '#fff'; x.lineWidth = 2.2 * dpr; x.beginPath(); x.moveTo(dx - 4.5 * dpr, dy - 4.5 * dpr); x.lineTo(dx + 4.5 * dpr, dy + 4.5 * dpr); x.moveTo(dx + 4.5 * dpr, dy - 4.5 * dpr); x.lineTo(dx - 4.5 * dpr, dy + 4.5 * dpr); x.stroke();
}

/* ── touch: move, pinch, the round corner, the photo itself ── */
const pts = new Map(); let g = null;
function at(ev) { const r = ov().getBoundingClientRect(); return [(ev.clientX - r.left) * S.W / r.width, (ev.clientY - r.top) * S.H / r.height]; }
const near = (a, b, rad) => Math.hypot(a[0] - b[0], a[1] - b[1]) < rad;
function hitLayer(p) {
  const e = E();
  for (let i = e.layers.length - 1; i >= 0; i--) {
    const L = e.layers[i], b = L._box || boxOf(L), k = L.s * S.W / 1080, dx = p[0] - L.x * S.W, dy = p[1] - L.y * S.H, cs = Math.cos(-L.r), sn = Math.sin(-L.r);
    const lx = (dx * cs - dy * sn) / k, ly = (dx * sn + dy * cs) / k, pad = 16 / k;
    if (lx > b.x0 - pad && lx < b.x1 + pad && ly > b.y0 - pad && ly < b.y1 + pad) return L;
  }
  return null;
}
function clampCrop(e) {
  const im = S.imgs[P().id]; if (!im) return; const r = coverRect(e, im, S.W, S.H);
  e.crop.cx = Math.min(1 - S.W / 2 / r.w, Math.max(S.W / 2 / r.w, e.crop.cx)); e.crop.cy = Math.min(1 - S.H / 2 / r.h, Math.max(S.H / 2 / r.h, e.crop.cy));
}
function onDown(ev) {
  ov().setPointerCapture(ev.pointerId); const p = at(ev); pts.set(ev.pointerId, p); const e = E(), rad = 26 * S.W / ov().getBoundingClientRect().width;
  if (pts.size === 1) {
    const L = selL();
    if (L && near(p, corners(L).br, rad)) { const c = [L.x * S.W, L.y * S.H]; g = { m:'handle', L, c, d0:Math.hypot(p[0] - c[0], p[1] - c[1]) || 1, a0:Math.atan2(p[1] - c[1], p[0] - c[0]), s0:L.s, r0:L.r }; }
    else if (L && near(p, corners(L).tl, rad)) g = { m:'del', L };
    else { const h = hitLayer(p); if (h) { g = { m:'move', L:h, p0:p, x0:h.x, y0:h.y, wasSel:S.sel === h.id, moved:false }; S.sel = h.id; } else g = { m:'pan', p0:p, c0:{ ...e.crop }, moved:false }; }
    panel(); draw();
  } else if (pts.size === 2) {
    const [a, b] = [...pts.values()], L = selL();
    g = { m:L ? 'pinchL' : 'pinchP', L, d0:Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, a0:Math.atan2(b[1] - a[1], b[0] - a[0]), s0:L ? L.s : e.crop.z, r0:L ? L.r : 0 };
  }
}
function onMove(ev) {
  if (!pts.has(ev.pointerId) || !g) return; const p = at(ev); pts.set(ev.pointerId, p); const e = E();
  if (g.m === 'move') {
    if (!g.moved && !near(p, g.p0, 6)) g.moved = true; if (!g.moved) return;
    let x = g.x0 + (p[0] - g.p0[0]) / S.W, y = g.y0 + (p[1] - g.p0[1]) / S.H; guide = {};
    if (Math.abs(x - .5) < .015) { x = .5; guide.x = 1; } if (Math.abs(y - .5) < .012) { y = .5; guide.y = 1; }
    g.L.x = x; g.L.y = y; keepOn(g.L);
  } else if (g.m === 'handle') {
    const d = Math.hypot(p[0] - g.c[0], p[1] - g.c[1]), a = Math.atan2(p[1] - g.c[1], p[0] - g.c[0]);
    g.L.s = Math.max(.15, Math.min(4, g.s0 * d / g.d0)); let r = g.r0 + a - g.a0; if (Math.abs(r) < .05) r = 0; g.L.r = r;
  } else if (g.m === 'pan') {
    if (!g.moved && !near(p, g.p0, 6)) g.moved = true; if (!g.moved) return;
    const im = S.imgs[P().id]; if (!im) return; const r = coverRect(e, im, S.W, S.H);
    e.crop.cx = g.c0.cx - (p[0] - g.p0[0]) / r.w; e.crop.cy = g.c0.cy - (p[1] - g.p0[1]) / r.h; clampCrop(e);
  } else if (g.m === 'pinchL' || g.m === 'pinchP') {
    if (pts.size < 2) return; const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), an = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (g.m === 'pinchL') { g.L.s = Math.max(.15, Math.min(4, g.s0 * d / g.d0)); let r = g.r0 + an - g.a0; if (Math.abs(r) < .05) r = 0; g.L.r = r; }
    else { e.crop.z = Math.max(1, Math.min(4, g.s0 * d / g.d0)); clampCrop(e); }
  }
  touched(); draw();
}
function onUp(ev) {
  if (!pts.has(ev.pointerId)) return; pts.delete(ev.pointerId);
  if (g && pts.size === 0) {
    if (g.m === 'del') { const e = E(); e.layers = e.layers.filter((l) => l !== g.L); S.sel = null; touched(); panel(); }
    else if (g.m === 'move' && !g.moved && g.wasSel && g.L.kind === 'text') openSays(g.L);
    else if (g.m === 'pan' && !g.moved) { S.sel = null; panel(); }
    g = null; guide = null; draw(); layersUi();
  } else if (g && pts.size === 1 && (g.m === 'pinchL' || g.m === 'pinchP')) g = null;
}
function onWheel(ev) {
  ev.preventDefault(); const e = E(), L = selL(), f = Math.exp(-ev.deltaY * .0015);
  if (L) { if (ev.shiftKey) L.r += ev.deltaY * .002; else L.s = Math.max(.15, Math.min(4, L.s * f)); } else { e.crop.z = Math.max(1, Math.min(4, e.crop.z * f)); clampCrop(e); }
  touched(); draw();
}
function touched() { const e = E(); if (!e.touched) { e.touched = true; strip(); } }

/* ── the controls ── */
function strip() {
  const el = $('[data-strip]'); el.hidden = O.photos.length < 2; if (el.hidden) return;
  el.innerHTML = O.photos.map((p, i) => `<button class="lt-th ${i === S.cur ? 'on' : ''}" data-i="${i}" aria-label="Photo ${i + 1}" aria-pressed="${i === S.cur}"><img src="${esc(O.thumb ? O.thumb(p) : O.src(p))}" alt="" loading="lazy">${S.ed[p.id] && S.ed[p.id].touched ? '<span class="e"></span>' : ''}</button>`).join('');
}
const layerName = (L) => L.kind === 'text' ? ([L.ja, L.en].filter(Boolean).join(' · ') || 'Words')
  : L.kind === 'stamp' ? (() => { const m = stampMeaning(L.text, P(), L); return `Stamp ${L.text}${m ? ' · ' + m : ''}`; })()
  : STICKERS.find((s) => s[0] === L.what)[1];
function layersUi() {
  $('[data-layers]').innerHTML = E().layers.map((L) => `<button class="lt-chip ${L.id === S.sel ? 'on' : ''}" data-l="${L.id}"><span>${esc(layerName(L))}</span></button>`).join('')
    + '<button class="lt-chip add" data-add="text">+ Words</button><button class="lt-chip add" data-add="stamp">+ Stamp</button><button class="lt-chip add" data-add="sticker">+ Sticker</button>';
}
const seg = (name, items, cur) => `<div class="lt-seg" data-set="${name}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
function swatches(L) {
  const set = L.kind === 'stamp' ? STAMP_COLS.map((c) => `background:${c.bg};box-shadow:inset 0 0 0 3px ${c.ink}`) : COLS[L.style].map((c) => L.style === 'anime' ? `background:${c.f};box-shadow:inset 0 0 0 4px ${c.s1},0 0 0 2px ${c.s2}` : `background:${c.f};box-shadow:0 0 0 1px rgba(0,0,0,.18)`);
  return `<div class="lt-sws" data-set="col">${set.map((st, i) => `<button class="lt-swatch ${i === L.col ? 'on' : ''}" data-v="${i}" style="${st}" aria-label="Colours ${i + 1}"></button>`).join('')}</div>`;
}
const layerBtns = '<div class="lt-btns"><button data-act="dup">Copy</button><button data-act="front">Bring to front</button><button data-act="del" class="del">Take off</button></div>';
function panel() {
  const L = selL(), el = $('[data-panel]'); layersUi();
  if (!L) { el.innerHTML = '<p class="lt-note" style="margin:0">Tap something on the photo, or one of the chips above, to change it. Add more words, a name stamp or a sticker with the blue chips.</p>'; return; }
  if (L.kind === 'text') {
    el.innerHTML = `<button class="lt-says" data-says><div><b>${esc(L.en || '—')}</b><small>${esc(L.ja || (L.busy ? 'Writing the Japanese…' : 'No Japanese yet'))}</small></div><em>Change</em></button>
      ${seg('style', [['brush', 'Brush 筆'], ['anime', 'Anime'], ['mincho', 'Elegant'], ['simple', 'Simple']], L.style)}
      ${swatches(L)}
      ${seg('show', [['both', 'Both'], ['ja', 'Japanese'], ['en', 'English']], L.show)}
      ${seg('vert', [['false', 'Across'], ['true', 'Down']], L.vert)}
      <div class="lt-row"><span>Day line<small>${esc(L.tag)}</small></span><button class="lt-sw" data-tog="tagOn" role="switch" aria-checked="${L.tagOn}" aria-label="Day line"></button></div>
      ${layerBtns}`;
  } else if (L.kind === 'stamp') {
    const p = P(), di = dayInfo(p.day), opts = [...new Set([di.seal, '旅', '思い出', '最高', '日本', '一緒', '感謝', (photoLabel(p).ja || '').replace(/[^一-鿿]/g, '').slice(0, 4), L.text].filter(Boolean))];
    const mean = stampMeaning(L.text, p, L);
    el.innerHTML = `<p class="lt-means">This stamp says <b>${esc(L.text)}</b>${mean ? `, which means “${esc(mean)}”` : L.busy ? ', finding out what it means…' : ''}</p>
      <div class="lt-grid" data-set="stamptext">${opts.map((t) => `<button class="k ${t === L.text ? 'on' : ''}" data-v="${esc(t)}">${esc(t)}<small>${esc(stampMeaning(t, p, L) || 'your own')}</small></button>`).join('')}</div>
      <div class="lt-own"><input data-stampown maxlength="4" placeholder="Your own, up to 4 characters" aria-label="Your own stamp"><button class="lt-chip add" data-stampgo>Use</button></div>
      ${swatches(L)}${layerBtns}`;
  } else {
    el.innerHTML = `<div class="lt-grid" data-set="what">${STICKERS.map(([k, t]) => `<button class="${k === L.what ? 'on' : ''}" data-v="${k}">${esc(t)}</button>`).join('')}</div>${layerBtns}`;
  }
}
function onPanel(ev) {
  const L = selL(); if (!L) return; const e = E(), b = ev.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-says')) return openSays(L);
  if (b.hasAttribute('data-stampgo')) { const v = $('[data-stampown]').value.trim(); if (v) setStamp(L, [...v].slice(0, 4).join('')); return; }
  const set = b.closest('[data-set]');
  if (set && b.dataset.v != null) {
    const k = set.dataset.set, v = b.dataset.v;
    if (k === 'style') L.style = v;
    else if (k === 'col') L.col = +v;
    else if (k === 'show') L.show = v;
    else if (k === 'vert') { L.vert = v === 'true'; if (L.vert && !(L.ja || '').trim()) toast('Down is for Japanese words'); }
    else if (k === 'stamptext') { L.text = v; L.auto = false; L.mean = ''; }
    else if (k === 'what') L.what = v;
    if (k === 'style' || k === 'vert' || k === 'show') refit(L);
  }
  if (b.dataset.tog) L[b.dataset.tog] = !L[b.dataset.tog];
  if (b.dataset.act === 'del') { e.layers = e.layers.filter((l) => l !== L); S.sel = null; }
  if (b.dataset.act === 'front') e.layers = e.layers.filter((l) => l !== L).concat(L);
  if (b.dataset.act === 'dup') { const c = { ...JSON.parse(JSON.stringify(L)), id:uid++, x:Math.min(.9, L.x + .06), y:Math.min(.9, L.y + .06) }; delete c._box; e.layers.push(c); S.sel = c.id; }
  touched(); panel(); draw();
}
// a stamp you typed: Claude says what it means
async function setStamp(L, v) {
  L.text = v; L.auto = false; L.mean = stampMeaning(v, P(), null); fontsFor(v).then(draw); touched(); panel(); draw();
  if (L.mean) return;
  L.busy = true; panel();
  try { const d = await O.ai({ ja:v, stamp:true }); if (d && d.en) L.mean = d.en; } catch {}
  L.busy = false; if (root) { panel(); layersUi(); }
}
function onLayers(ev) {
  const b = ev.target.closest('button'); if (!b) return; const e = E(), p = P();
  if (b.dataset.l) S.sel = +b.dataset.l === S.sel ? null : +b.dataset.l;
  else if (b.dataset.add === 'text') { const L = textLayer(p, 'brush', { x:.5, y:.5, auto:false }); fitLayer(L, S.W, S.H); L.s *= .8; e.layers.push(L); S.sel = L.id; touched(); panel(); draw(); return openSays(L); }
  else if (b.dataset.add === 'stamp') { const L = { id:uid++, kind:'stamp', text:dayInfo(p.day).seal, col:0, auto:true, x:.5, y:.5, s:1, r:-0.05 }; e.layers.push(L); S.sel = L.id; }
  else if (b.dataset.add === 'sticker') { const L = { id:uid++, kind:'sticker', what:'sakura', x:.78, y:.2, s:.7, r:.12 }; e.layers.push(L); S.sel = L.id; }
  else return;
  touched(); panel(); draw();
}

/* ── what the words say ── */
function openSays(L) {
  const p = P(), di = dayInfo(p.day), dayOpts = dayOptions(p.day), filed = photoLabel(p), host = $('[data-sheet]');
  const opt = (o, i, why, list) => `<button class="lt-opt ${o.en === L.en ? 'on' : ''}" data-o="${i}" data-list="${list}"><div><b>${esc(o.en)}</b>${why ? `<small>${esc(why)}</small>` : ''}</div><span class="ja">${o.ja ? esc(o.ja) : '<small style="font-family:inherit">Japanese written for you</small>'}</span></button>`;
  host.innerHTML = `<div class="lt-scrim" data-scrim><div class="lt-sheet" role="dialog" aria-label="What the words say">
    <h3>What should it say?<button data-sx>Done</button></h3>
    <p class="lt-lbl">Day ${di.n} · ${esc(di.nice)}</p>
    <div class="lt-opts">${dayOpts.map((o, i) => opt(o, i, o === filed ? `${o.why ? o.why + ' · ' : ''}This photo's stop` : o.why, 'day')).join('')}</div>
    <p class="lt-lbl">Any other place on the trip</p>
    <input class="in" type="search" data-q placeholder="Search places, like Fushimi or 道頓堀" autocomplete="off" aria-label="Search places">
    <div class="lt-opts" data-any hidden></div>
    <p class="lt-lbl">Your own words</p>
    <input class="in" data-own-en placeholder="English, like Best day ever" aria-label="Your own words in English" value="${L.auto ? '' : esc(L.en)}">
    <input class="in" data-own-ja placeholder="Japanese (leave empty and it's written for you)" aria-label="Your own words in Japanese" value="${L.auto ? '' : esc(L.ja)}" style="font-family:'Yuji Syuku',serif">
    <button class="lt-go" data-owngo>Use my words</button>
  </div></div>`;
  let anyList = [];
  const close = () => { host.innerHTML = ''; };
  host.querySelector('[data-scrim]').addEventListener('click', (ev) => {
    if (ev.target.hasAttribute('data-scrim') || ev.target.closest('[data-sx]')) return close();
    const b = ev.target.closest('[data-o]');
    if (b) { const o = (b.dataset.list === 'day' ? dayOpts : anyList)[+b.dataset.o]; close(); return setWords(L, o.en, o.ja); }
    if (ev.target.closest('[data-owngo]')) { const en = host.querySelector('[data-own-en]').value.trim(), ja = host.querySelector('[data-own-ja]').value.trim(); if (!en && !ja) return; close(); setWords(L, en, ja); }
  });
  host.querySelector('[data-q]').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase(), box = host.querySelector('[data-any]');
    if (!q) { box.hidden = true; return; }
    anyList = Object.entries(PLACES).filter(([n, v]) => n.toLowerCase().includes(q) || (v.ja || '').includes(q) || (v.ro || '').toLowerCase().includes(q)).slice(0, 12).map(([n, v]) => ({ en:clean(n), ja:v.ja || '' }));
    box.hidden = false; box.innerHTML = anyList.length ? anyList.map((o, i) => opt(o, i, '', 'any')).join('') : '<div class="lt-opt"><div><small>No place by that name. Type it under Your own words.</small></div></div>';
  });
}
// new words: Claude writes the missing language (Japanese for English, the meaning for Japanese)
async function setWords(L, en, ja) {
  L.en = en; L.ja = ja; L.auto = false; await fontsFor(en + ja); refit(L); touched(); panel(); draw();
  if (en && ja) return;
  L.busy = true; panel();
  try {
    const d = await O.ai(en ? { en } : { ja });
    if (d && !d.off && L.en === en && L.ja === ja) { if (!en && d.en) L.en = d.en; if (!ja && d.ja) { L.ja = d.ja; remember(en, d.ja); } await fontsFor(L.en + L.ja); refit(L); }
    else if (d && d.off) toast('Japanese can\'t be written right now. Type it, or keep the English.');
  } catch { toast('No signal: the Japanese comes when you\'re back online. Pick it again then.'); }
  L.busy = false; if (root) { panel(); draw(); }
}

// a photo's own label with no Japanese yet (a stop that isn't a known place): Claude writes it, once per label
const asking = {};
async function autoJa(e) {
  for (const L of e.layers) {
    if (L.kind !== 'text' || !L.auto || !L.en || (L.ja || '').trim()) continue;
    if (wordsMem[L.en]) { L.ja = wordsMem[L.en]; continue; }
    L.busy = true;
    try { const d = await (asking[L.en] || (asking[L.en] = O.ai({ en:L.en }))); if (d && d.ja && L.auto && !L.ja) { L.ja = d.ja; remember(L.en, d.ja); await fontsFor(d.ja); } } catch { delete asking[L.en]; }
    L.busy = false;
    if (L.ja && L.downWhenJa) { L.vert = true; L.place = ['right', 'top']; } // brush: down the side, once it has its Japanese
    delete L.downWhenJa;
    if (L.ja && !L.place) refit(L);
  }
  if (root) { panel(); draw(); }
}

/* ── one look on every photo: each keeps its own place name and day stamp ── */
function copyLook() {
  const src = E(), from = P(); let n = 0;
  for (const p of O.photos) {
    if (p === from) continue;
    const lab = photoLabel(p), di = dayInfo(p.day), e = S.ed[p.id] = { ...freshEdit(p), shape:src.shape, tone:src.tone, shade:src.shade, touched:true };
    e.layers = src.layers.map((L) => {
      const c = { ...JSON.parse(JSON.stringify(L)), id:uid++ }; delete c._box;
      if (c.kind === 'text') { c.tag = di.tag; if (L.auto) { c.en = lab.en; c.ja = lab.ja; } }
      if (c.kind === 'stamp' && L.auto) c.text = di.seal;
      return c;
    });
    const [fw, fh] = frameSize(e, p); for (const L of e.layers) if (L.kind === 'text') { const x = L.x, y = L.y, s0 = L.s; fitLayer(L, fw, fh); L.s = Math.min(L.s, s0); L.x = x; L.y = y; }
    n++; autoJa(e);
  }
  S.copied = true; strip(); allBtn(); toast(`Look copied to ${n} more photo${n > 1 ? 's' : ''}. Each keeps its own place and day.`);
}
function allBtn() {
  const b = $('[data-all]'), n = O.photos.length; b.hidden = n < 2;
  b.textContent = S.copied ? `Save all ${n}` : `Use this look on all ${n} photos`;
}

/* ── saving: the full-size picture, then the phone (and the album) ── */
async function exportOne(p) {
  if (!S.imgs[p.id]) S.imgs[p.id] = await loadImg(p);
  const e = S.ed[p.id] || (S.ed[p.id] = freshEdit(p)), [w, h] = frameSize(e, p), c = document.createElement('canvas'); c.width = w; c.height = h;
  for (const L of e.layers) if (L.place) fitLayer(L, w, h);
  render(c.getContext('2d'), e, p, w, h, 1);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', .92));
}
async function saveSome(list) {
  if (S.saving) return; S.saving = true;
  try {
    await fontsFor(list.map((p) => (S.ed[p.id] || { layers:[] }).layers.map((L) => (L.en || '') + (L.ja || '') + (L.text || '') + (L.tag || '')).join('')).join(''));
    if (list.length > 1) toast(`Making ${list.length} pictures…`);
    const items = []; for (const p of list) { const blob = await exportOne(p); if (blob) items.push({ blob, from:p }); }
    if (!items.length) return toast('Couldn\'t make the picture. Try again.');
    await O.save(items, S.album);
  } finally { S.saving = false; }
}

/* ── open and close ── */
function show() {
  const p = P(); S.sel = null; strip(); sizeStage(); controls(); panel(); draw(); if (S.fontsReady) autoJa(E());
  if (!S.imgs[p.id]) loadImg(p).then((im) => { S.imgs[p.id] = im; if (!im) { $('[data-wait]').textContent = 'Couldn\'t get this photo. Check your signal.'; return; } if (root && P() === p) { sizeStage(); clampCrop(E()); draw(); } });
}
function controls() {
  const e = E();
  root.querySelectorAll('[data-shape] button').forEach((b) => b.classList.toggle('on', b.dataset.v === e.shape));
  root.querySelectorAll('[data-tone] button').forEach((b) => b.classList.toggle('on', b.dataset.v === e.tone));
  $('[data-shade]').setAttribute('aria-checked', e.shade); $('[data-album]').setAttribute('aria-checked', S.album);
}
function onClick(ev) {
  const t = (s) => ev.target.closest(s);
  if (t('[data-ltx]')) return close();
  if (t('[data-ltsave]')) return saveSome(S.copied ? O.photos : [P()]);
  if (t('[data-all]')) return S.copied ? saveSome(O.photos) : copyLook();
  const th = t('[data-strip] [data-i]'); if (th) { S.cur = +th.dataset.i; return show(); }
  const pr = t('[data-preset]'); if (pr) { const e = E(); S.look = pr.dataset.preset; e.layers = preset(S.look, P()).concat(e.layers.filter((l) => l.kind === 'sticker')); S.sel = null; touched(); panel(); return draw(); }
  const sh = t('[data-shape] button'); if (sh) { const e = E(); e.shape = sh.dataset.v; sizeStage(); for (const L of e.layers) keepOn(L); clampCrop(e); touched(); controls(); return draw(); }
  const to = t('[data-tone] button'); if (to) { E().tone = to.dataset.v; touched(); controls(); return draw(); }
  if (t('[data-shade]')) { const e = E(); e.shade = !e.shade; touched(); controls(); return draw(); }
  if (t('[data-album]')) { S.album = !S.album; lsSet('letter.album', S.album ? '1' : '0'); return controls(); }
}
const onResize = () => { if (root) { sizeStage(); draw(); } };
// closing goes back a step, like the phone's Back: the page underneath (the viewer) sees "lettering" still on and stays
function onPop() { if (root) teardown(); }
function close() { if (!root) return; if (history.state && history.state.letter) history.back(); else teardown(); }
function teardown() {
  if (!root) return;
  root.remove(); root = null; document.body.classList.remove('lettering'); document.documentElement.style.overflow = S.overflow || '';
  removeEventListener('resize', onResize); removeEventListener('popstate', onPop);
  if (O.onClose) O.onClose();
}

export async function openLetter(opts) {
  if (root) teardown();
  O = opts; uid = 1;
  S = { cur:Math.max(0, Math.min(opts.start || 0, opts.photos.length - 1)), sel:null, ed:{}, imgs:{}, toned:{}, look:'brush', album:lsGet('letter.album') !== '0', copied:false, W:1080, H:1350, k:.5, overflow:document.documentElement.style.overflow };
  if (!document.getElementById('lt-css')) { const st = document.createElement('style'); st.id = 'lt-css'; st.textContent = CSS; document.head.appendChild(st); }
  root = document.createElement('div'); root.className = 'lt'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Letter it'); root.innerHTML = html();
  document.body.appendChild(root); document.body.classList.add('lettering'); document.documentElement.style.overflow = 'hidden';
  root.addEventListener('click', onClick);
  $('[data-panel]').addEventListener('click', onPanel); $('[data-layers]').addEventListener('click', onLayers);
  const o = ov(); o.addEventListener('pointerdown', onDown); o.addEventListener('pointermove', onMove); o.addEventListener('pointerup', onUp); o.addEventListener('pointercancel', onUp); o.addEventListener('wheel', onWheel, { passive:false });
  addEventListener('resize', onResize);
  history.pushState({ ...(history.state || {}), letter:1 }, ''); addEventListener('popstate', onPop);
  allBtn();
  // the places' Japanese names, and the fonts for every label a photo starts with
  try { PLACES = await opts.places(); } catch { PLACES = {}; }
  if (!root) return;
  const first = O.photos.map((p) => { const l = photoLabel(p), d = dayInfo(p.day); return l.en + l.ja + d.tag + d.seal; }).join('') + Object.values(STAMP_EN).join('') + Object.keys(STAMP_EN).join('') + '最高!旅ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789·+&\'-';
  show(); await fontsFor(first); S.fontsReady = true; if (root) draw();
  if (root) autoJa(E());
}
// for the tests: the drawing on its own
export const _test = { dayOptions:(...a) => dayOptions(...a), stampMeaning:(...a) => stampMeaning(...a), state:() => S };
