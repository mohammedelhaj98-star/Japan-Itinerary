// Japan 2026 — itinerary data model.
// Every day is an ordered list of items. Item types:
//   section  — a heading inside the day
//   event    — a timed stop. `place` gives it a map pin; `travel` says how you got here from the previous pin.
//   note     — a callout box (kind: note | warn | book | decide | tip)
//   choice   — a "choose on the day" group. Picking an option is shared across all devices.
// `who` is 'all' | 'nasa' | 'mm'. `optional: true` marks skippable extras.
// Travel modes: walk, drive, taxi, transit, train, boat, ropeway, flight. walk/drive/taxi are street-routed on the map.

export const TRIP = {
  title: 'Japan 2026',
  subtitle: 'Full itinerary + planning guide',
  start: '2026-10-16',
  end: '2026-11-01',
  travelers: {
    all: { label: 'Everyone', short: 'All' },
    nasa: { label: 'NASA — Naf + Sara', short: 'NASA' },
    mm: { label: 'M&M — Mariam + Mo', short: 'M&M' },
  },
};

export const HOTELS = [
  { id: 'sotetsu', name: 'Sotetsu Grand Fresa Takadanobaba', city: 'Tokyo', dates: 'Oct 16–20', nights: 4, lat: 35.7127, lng: 139.7040, q: 'Sotetsu Grand Fresa Takadanobaba' },
  { id: 'mizunoto', name: 'Mizunoto Hakone', city: 'Hakone', dates: 'Oct 20–21', nights: 1, lat: 35.2405, lng: 139.0528, q: '箱根小涌谷温泉 水の音' },
  { id: 'granbell', name: 'Kyoto Granbell', city: 'Kyoto', dates: 'Oct 21–27', nights: 6, lat: 35.0036, lng: 135.7711, q: 'Kyoto Granbell Hotel' },
  { id: 'washington', name: 'Akihabara Washington Hotel', city: 'Tokyo', dates: 'Oct 27–Nov 1', nights: 5, lat: 35.6975, lng: 139.7745, q: 'Akihabara Washington Hotel' },
];

// Small helpers to keep the day definitions readable.
const P = (name, lat, lng, q) => ({ name, lat, lng, q: q || name });
const E = (time, title, desc, extra = {}) => ({ type: 'event', time, title, desc, who: 'all', ...extra });
const S = (title) => ({ type: 'section', title });
const N = (title, text, kind = 'note', extra = {}) => ({ type: 'note', title, text, kind, ...extra });
const C = (id, title, text, options, extra = {}) => ({ type: 'choice', id, title, text, options, ...extra });

export const DAYS = [
  // ───────────────────────────── D01 ─────────────────────────────
  {
    id: 'd01', n: 1, date: '2026-10-16', dow: 'Fri', city: 'Tokyo',
    title: 'Arrival in Tokyo', tagline: 'Tokyo first steps',
    energy: 'LOW', dinner: 'Easy near hotel', hotel: 'sotetsu',
    items: [
      E('4:10 PM', 'Land at Narita', 'Welcome to Japan.', {
        id: 'd01-land', place: P('Narita Airport Terminal 1', 35.7654, 140.3860, 'Narita Airport Terminal 1'), tags: ['flight'],
      }),
      E('4:10–5:45 PM', 'Immigration, luggage, essentials', 'Suica top-up ¥5,000 at 7-Bank ATM, eSIM, cash. Friday immigration 60–90 min — if long, 6:30 or 7:00 PM Skyliner works. Hotel by 8:30 PM.', { id: 'd01-arrive', tags: ['logistics'] }),
      E('6:00–7:45 PM', 'Skyliner → Nippori → Yamanote', 'Skyliner to Nippori (36 min, ¥2,520), then JR Yamanote toward Shinjuku / Takadanobaba.', {
        id: 'd01-skyliner', place: P('Nippori Station', 35.7281, 139.7709), travel: { mode: 'train', label: 'Keisei Skyliner, 36 min, ¥2,520' }, tags: ['transit'],
      }),
      E('8:00–9:00 PM', 'Check in and refresh', 'Sotetsu Grand Fresa Takadanobaba — first 4 nights.', {
        id: 'd01-checkin', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'train', label: 'JR Yamanote, ~15 min' }, tags: ['hotel'],
      }),
      E('9:00–10:15 PM', 'Easy dinner beside hotel', 'Ramen, conveyor sushi, or the nearest izakaya.', { id: 'd01-dinner', tags: ['food'] }),
      N('First evening', 'Low-key. Waseda-dori ramen (Ichiran on the main street). Shinjuku 10 min: Omoide Yokocho chicken/seafood skewers, Kabukicho. Kawagoe starts early tomorrow.'),
    ],
  },

  // ───────────────────────────── D02 ─────────────────────────────
  {
    id: 'd02', n: 2, date: '2026-10-17', dow: 'Sat', city: 'Tokyo',
    title: 'Harajuku + Kawagoe Matsuri', tagline: 'Little Edo — Kawagoe Matsuri',
    energy: 'MEDIUM', dinner: 'Festival street food + Kawagoe izakaya', hotel: 'sotetsu',
    items: [
      S('Takadanobaba hotel — morning'),
      E('8:30–9:00 AM', 'Konbini breakfast', 'Grab on the way out.', { id: 'd02-bfast', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['food'] }),
      C('d02-morning', 'Morning — choose on the day', 'Decide by energy.', [
        { id: 'calm', label: 'Calm — Shinjuku Gyoen', desc: 'JR to Shinjuku 5 min + 10-min walk. Garden 9:15–10:45 AM, Harajuku ~11:05 AM. Opens 9 AM, closed Mon, ¥500.',
          items: [E('9:15–10:45 AM', 'Shinjuku Gyoen', 'Calm garden start. ¥500, opens 9 AM.', { id: 'd02-gyoen', place: P('Shinjuku Gyoen (Shinjuku Gate)', 35.6877, 139.7101, 'Shinjuku Gyoen National Garden'), travel: { mode: 'train', label: 'JR Yamanote to Shinjuku + 10-min walk' }, tags: ['sight'] })] },
        { id: 'sleep', label: 'Sleep in — straight to Harajuku', desc: 'Leave hotel 9:30–10:00 AM, JR to Harajuku, arrive 10:00–10:30 AM. Some Takeshita shops open 10 AM, most by 11 AM.', items: [] },
        { id: 'energized', label: 'Energized — quick Gyoen then Harajuku', desc: 'Gyoen 45–60 min (arrive 9:15, leave 10:15), Harajuku 10:30–10:40 AM as shops open.',
          items: [E('9:15–10:15 AM', 'Shinjuku Gyoen (quick loop)', '45–60 min in the garden. ¥500.', { id: 'd02-gyoen-quick', place: P('Shinjuku Gyoen (Shinjuku Gate)', 35.6877, 139.7101, 'Shinjuku Gyoen National Garden'), travel: { mode: 'train', label: 'JR Yamanote to Shinjuku + 10-min walk' }, tags: ['sight'] })] },
      ], { default: 'calm' }),
      E('10:30–11:05 AM', 'Travel to Harajuku', 'JR Yamanote from Shinjuku, 2 stops south (5 min). Timing depends on morning option.', { id: 'd02-to-harajuku', tags: ['transit'] }),
      E('10:30 AM–12:50 PM', 'Harajuku scout', 'Crepes, streetwear, costume culture; then Omotesando for coffee. Preview run — back with friends on D15, so buy now. Leave by 12:50 PM.', {
        id: 'd02-harajuku', place: P('Takeshita Street, Harajuku', 35.6716, 139.7045, 'Takeshita Street Harajuku'), travel: { mode: 'train', label: 'JR Yamanote, 5 min' }, tags: ['shop'],
      }),
      E('Spare 20 min', 'Tokyo Toilet — Yoyogi-Fukamachi', 'Shigeru Ban transparent toilet, 10-min walk south of Harajuku Station. Glass frosts when locked; glows at night. Most photographed of the 17 Olympic designer toilets. Free.', {
        id: 'd02-toilet', optional: true, place: P('Yoyogi-Fukamachi Mini Park', 35.6690, 139.6937, 'Yoyogi Fukamachi Mini Park toilet'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('~1:00 PM', 'Yamanote to Takadanobaba + bag drop', '~12 min, ¥170. Bell desk bag drop 1:20–1:25 PM, then straight to the Seibu platform.', {
        id: 'd02-bagdrop', place: P('Takadanobaba Station', 35.7127, 139.7040), travel: { mode: 'train', label: 'JR Yamanote, 12 min, ¥170' }, tags: ['transit'],
      }),
      E('~1:25–2:15 PM', 'Seibu Shinjuku Line → Hon-Kawagoe', '~50 min, ¥530. Hotel is on this line.', {
        id: 'd02-seibu', place: P('Hon-Kawagoe Station', 35.9151, 139.4821), travel: { mode: 'train', label: 'Seibu Shinjuku Line, 50 min, ¥530' }, tags: ['transit'],
      }),
      S('Kawagoe — afternoon sights'),
      E('2:25–3:00 PM', 'Kashiya Yokocho (Candy Alley)', 'First stop north of the station. Edo-period candy shops — stock up for the afternoon.', {
        id: 'd02-candy', place: P('Kashiya Yokocho (Candy Alley)', 35.9218, 139.4821, 'Kashiya Yokocho Kawagoe'), travel: { mode: 'walk', label: '10-min walk via festival approach' }, tags: ['food', 'sight'],
      }),
      E('3:00–3:15 PM', 'Kurazukuri Street + Toki no Kane', '15-min walk north past the warehouse district and bell tower. Quiet first look — floats fill this street in 2 hours.', {
        id: 'd02-kurazukuri', place: P('Toki no Kane (Kurazukuri Street)', 35.9237, 139.4855, 'Toki no Kane Kawagoe'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['sight'],
      }),
      E('3:15–4:30 PM', 'Kawagoe Hikawa Shrine', '200m lantern corridor, 1,500-year-old grounds, enmusubi boards, windchimes. Closes 4:30 PM — arrive by 3:15 PM.', {
        id: 'd02-hikawa', place: P('Kawagoe Hikawa Shrine', 35.9295, 139.4870), travel: { mode: 'walk', label: '10-min walk north' }, tags: ['sight'],
      }),
      E('4:30 PM', 'To the festival zone', '10-min walk Hikawa → Renjakucho/Kurazukuri. Arrive ~4:45 PM; find a spot, early stall snack.', {
        id: 'd02-festzone', place: P('Kurazukuri festival zone', 35.9240, 139.4850, 'Kurazukuri Street Kawagoe'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      S('Kawagoe Matsuri — evening festival'),
      E('5:10–7:00 PM', 'Food stalls, illuminated floats', 'Floats building in energy as the light goes.', { id: 'd02-stalls', tags: ['food', 'sight'] }),
      E('7:00–8:30 PM', 'Hikkawase — main event', 'Two yamatai floats face off at an intersection, musicians battling below. At every major intersection — a 10-min loop catches 3–4. Peak 8–9 PM; leave 8:30.', { id: 'd02-hikkawase', tags: ['sight'] }),
      E('~8:30 PM', 'Return to Tokyo', 'Seibu Shinjuku Line Hon-Kawagoe → Takadanobaba (~50 min, ¥530). Frequent trains; same station you arrived at.', {
        id: 'd02-return', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'train', label: 'Seibu Shinjuku Line, 50 min, ¥530' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D03 ─────────────────────────────
  {
    id: 'd03', n: 3, date: '2026-10-18', dow: 'Sun', city: 'Tokyo',
    title: 'Fuji or Nikko + omakase', tagline: 'Fuji chase with Nehla & Ghalib · 8:30 PM omakase',
    energy: 'HIGH', dinner: 'CONFIRMED: Sushi Yoshikawa Kaido Shinjuku 8:30 PM', hotel: 'sotetsu',
    items: [
      N('Night-before: Fuji vs Nikko', 'Oct 17 by 10 PM: check fujisan-webcam.net. Summit visible → A (Fuji). Socked in → B (Nikko).\nHARD: back in Shinjuku by 7:30 PM for the 8:30 PM omakase. Target 6:30–7:00 PM → leave by ~4:30 PM (Fuji) / ~4:00 PM (Nikko).\nNehla & Ghalib book + drive the rental car — confirm departure time + Shinjuku meetup the night before. Both ~2–2.5 hrs by car.', 'decide', { link: { label: 'Fuji live webcams', url: 'https://fujisan-webcam.net' } }),
      N('Book ahead — Omakase', 'Oct 18, 8:30 PM: CONFIRMED. Sushi Yoshikawa Kaido Shinjuku, 7-19-7 Nishi-Shinjuku. 19 courses, ¥14,300/person. Arrive by 8:20 PM. No action needed.', 'book'),
      C('d03-trip', 'Fuji or Nikko?', 'Pick the night before based on the Fuji webcams.', [
        { id: 'fuji', label: 'A — Fuji visible: Kawaguchiko + Chureito + 5th Station', desc: 'Summit clearly visible on the webcams.',
          items: [
            E('~6:30 AM', 'Meet cousins in Shinjuku — depart', 'To Kawaguchiko, ~2 hrs via Chuo Expressway, Fujiyoshida IC.', { id: 'd03a-depart', place: P('Shinjuku Station (meetup)', 35.6896, 139.7005, 'Shinjuku Station'), tags: ['transit'] }),
            E('9:00–10:00 AM', 'Chureito Pagoda', 'Short drive to Fujiyoshida, 398 stone steps through cedar forest. Fuji framed by pagoda, best in morning light.', { id: 'd03a-chureito', place: P('Chureito Pagoda', 35.5016, 138.8011), travel: { mode: 'drive', label: '~2 hrs via Chuo Expressway' }, tags: ['sight'] }),
            E('10:15 AM–12:00 PM', 'Kawaguchiko — Oishi Park', 'North shore, best Fuji-over-water reflections. Drive the lakeside road, stop freely. Kachi Kachi Ropeway optional (¥900).', { id: 'd03a-oishi', place: P('Oishi Park, Kawaguchiko', 35.5252, 138.7420, 'Oishi Park Kawaguchiko'), travel: { mode: 'drive', label: '~20 min' }, tags: ['sight'] }),
            E('12:00–1:00 PM', 'Hoto noodle lunch, Kawaguchiko', 'Flat-noodle hot pot, ¥1,200; pork-free versions available. Spots near the lake and station.', { id: 'd03a-lunch', place: P('Kawaguchiko Station area', 35.4986, 138.7686, 'Kawaguchiko Station'), travel: { mode: 'drive', label: '~15 min' }, tags: ['food'] }),
            E('~1:15 PM', 'Fuji 5th Station', 'Fuji Subaru Line, ~40 min to 2,300m. Ochudo trail (flat 20-min loop), Komitake Shrine, Fuji gifts.', { id: 'd03a-5th', place: P('Fuji Subaru Line 5th Station', 35.3954, 138.7332, 'Fuji Subaru Line 5th Station'), travel: { mode: 'drive', label: '~40 min via Fuji Subaru Line' }, tags: ['sight'] }),
            E('2:30–4:15 PM', 'Extra lake / 5th Station time', 'Kachi Kachi Ropeway (¥900) if skipped earlier, another lakeside loop, or sit with Fuji.', { id: 'd03a-extra', optional: true, place: P('Kachi Kachi Ropeway', 35.5089, 138.7649, 'Mt. Fuji Panoramic Ropeway Kawaguchiko'), travel: { mode: 'drive', label: '~40 min back down' }, tags: ['sight'] }),
            E('~4:30 PM', 'Drive back to Shinjuku', '~2 hrs via Chuo Expressway. Arrive Shinjuku 6:30–7:00 PM.', { id: 'd03a-back', place: P('Shinjuku Station', 35.6896, 139.7005), travel: { mode: 'drive', label: '~2 hrs via Chuo Expressway' }, tags: ['transit'] }),
          ] },
        { id: 'nikko', label: 'B — Fuji cloudy: Nikko by car', desc: 'Summit socked in on the webcams.',
          items: [
            E('~6:30 AM', 'Meet cousins — depart for Nikko', '~2.5 hrs via Tohoku Expressway, Nikko IC exit.', { id: 'd03b-depart', place: P('Shinjuku Station (meetup)', 35.6896, 139.7005, 'Shinjuku Station'), tags: ['transit'] }),
            E('9:30 AM–12:00 PM', 'Toshogu Shrine complex', 'Tokugawa Ieyasu\'s mausoleum — gilded, densely carved. Yomeimon Gate (20 min), three wise monkeys, sleeping cat, inner cedar forest. ¥1,300.', { id: 'd03b-toshogu', place: P('Nikko Toshogu', 36.7580, 139.5988), travel: { mode: 'drive', label: '~2.5 hrs via Tohoku Expressway' }, tags: ['sight'] }),
            E('12:00–12:45 PM', 'Lunch near Nikko town', 'Yuba (tofu skin, local speciality) in most set meals — pork-free.', { id: 'd03b-lunch', tags: ['food'] }),
            E('~1:00 PM', 'Irohazaka up to Lake Chuzenji', '~20 min, 28 hairpin turns.', { id: 'd03b-iroha', tags: ['transit'] }),
            E('1:30–3:30 PM', 'Kegon Falls + Lake Chuzenji', '97m falls, elevator to base (¥570). Lakeside walk at 1,269m — early autumn colour possible. Extra time: boat (~30 min, ¥1,200).', { id: 'd03b-kegon', place: P('Kegon Falls', 36.7390, 139.5020, 'Kegon Falls Nikko'), travel: { mode: 'drive', label: '~20 min, Irohazaka switchbacks' }, tags: ['sight'] }),
            E('~4:00 PM', 'Drive back to Shinjuku', '~2.5 hrs via Nikko IC → Tohoku Expressway. Arrive 6:30–7:00 PM.', { id: 'd03b-back', place: P('Shinjuku Station', 35.6896, 139.7005), travel: { mode: 'drive', label: '~2.5 hrs' }, tags: ['transit'] }),
          ] },
      ], { default: 'fuji' }),
      S('Both options — evening'),
      E('6:30–7:00 PM', 'Arrive back in Shinjuku', 'Cousins drop you near the hotel.', { id: 'd03-arrive', tags: ['transit'] }),
      E('7:00–7:45 PM', 'Hotel — shower, change', 'Smart casual for the counter. 45 min.', { id: 'd03-hotel', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'drive', label: 'Drop-off near hotel' }, tags: ['hotel'] }),
      E('8:00 PM', 'Depart for restaurant', 'JR Yamanote 2 stops to Shinjuku (5 min) + 10-min walk to Nishi-Shinjuku; or taxi (~¥700, 5 min). Arrive by 8:20 PM.', { id: 'd03-depart-dinner', tags: ['transit'] }),
      E('8:30–10:30 PM', 'Sushi Yoshikawa Kaido — omakase', 'CONFIRMED 8:30 PM. 19-course Edomae omakase, 16 counter seats, ~2 hrs. 7-19-7 Nishi-Shinjuku, Sun Rose Shinjuku 101; 10-min walk from Shinjuku West Exit. Confirm no pork, no alcohol at check-in.', {
        id: 'd03-omakase', confirmed: true, place: P('Sushi Yoshikawa Kaido Shinjuku', 35.6957, 139.6978, 'Sushi Yoshikawa Kaido Shinjuku 7-19-7 Nishi-Shinjuku'), travel: { mode: 'taxi', label: 'Taxi ~¥700, 5 min (or JR + 10-min walk)' }, tags: ['food', 'booking'], cost: '¥14,300/person',
      }),
    ],
  },

  // ───────────────────────────── D04 ─────────────────────────────
  {
    id: 'd04', n: 4, date: '2026-10-19', dow: 'Mon', city: 'Tokyo',
    title: 'Tsukiji + Ginza + Shimokitazawa', tagline: 'Market morning · Ginza shopping · vintage evening',
    energy: 'MEDIUM', dinner: 'Shinjuku dinner · early night · ship luggage to Kyoto', hotel: 'sotetsu',
    items: [
      E('8:30 AM', 'Depart hotel', 'JR Yamanote to Shinjuku (5 min) → Marunouchi Line to Ginza (12 min) → 10-min walk to Tsukiji. Arrive ~9:00 AM.', { id: 'd04-depart', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['transit'] }),
      E('9:00–10:30 AM', 'Tsukiji Outer Market', 'Marutake tamagoyaki (¥400), Tsukiji Tama Sushi nigiri, fresh oysters, tuna don. Go hungry.', {
        id: 'd04-tsukiji', place: P('Tsukiji Outer Market', 35.6654, 139.7707), travel: { mode: 'transit', label: 'JR + Marunouchi Line + 10-min walk, ~30 min' }, tags: ['food'], cost: '¥3,000–4,000/person',
      }),
      E('10:30 AM', 'Walk to Ginza', '12-min walk north from Tsukiji, or 1 stop Hibiya Line. Arrive ~10:45 AM.', { id: 'd04-to-ginza', tags: ['transit'] }),
      S('Ginza — full shopping block'),
      E('10:45 AM–2:30 PM', 'Ginza shopping block (3.5 hrs)', 'Onitsuka Tiger Ginza — Japan-exclusive colourways, best sizes, opens 11 AM.\nUniqlo Ginza — 12 floors, opens 11 AM.\nItoya Ginza — 12-floor stationery: washi tape, calligraphy notebooks, 15 min.\nBrand Off Ginza — 3F all Hermès (Birkin, Kelly, Constance).\nKomehyo Ginza — ~4,000 items; Chanel/LV/Goyard bags + Rolex/Patek/AP/Cartier watch floor.\nCasanova Vintage Ginza — LV, Goyard totes, Chanel Flaps; 5 min from Komehyo.\nAll in Ginza 6–7 chome. Lunch: Ginza Six B2.', {
        id: 'd04-ginza', place: P('Ginza Six', 35.6697, 139.7640, 'Ginza Six'), travel: { mode: 'walk', label: '12-min walk north' }, tags: ['shop', 'food'],
        subplaces: [
          P('Onitsuka Tiger Ginza', 35.6716, 139.7645), P('Uniqlo Ginza', 35.6718, 139.7654, 'UNIQLO Ginza'), P('Itoya Ginza', 35.6725, 139.7671, 'Itoya Ginza'),
          P('Brand Off Ginza', 35.6703, 139.7636, 'Brand Off Ginza'), P('Komehyo Ginza', 35.6700, 139.7632, 'KOMEHYO Ginza'), P('Casanova Vintage Ginza', 35.6708, 139.7625, 'Casanova Vintage Ginza'),
        ],
      }),
      E('~2:45 PM', 'Ginza → Shimokitazawa', 'Ginza Line to Shibuya (12 min) → Keio Inokashira Line to Shimokitazawa (10 min). Arrive ~3:10 PM.', { id: 'd04-to-shimokita', tags: ['transit'] }),
      S('Shimokitazawa — streetwear'),
      E('3:15–5:30 PM', 'Shimokitazawa streetwear', '~2 hrs, jackets and tops. Flamingo Shimokitazawa (vintage outerwear, denim, bombers), New York Joe Exchange (tops, knitwear), Merlot (eclectic). Most open until 8 PM. Bear Pond Espresso: cash only, no phones, queue before opening.', {
        id: 'd04-shimokita', place: P('Shimokitazawa Station', 35.6613, 139.6680), travel: { mode: 'transit', label: 'Ginza Line + Keio Inokashira, ~25 min' }, tags: ['shop'],
      }),
      E('~5:45 PM', 'Shimokitazawa → Shinjuku', 'Keio Inokashira Line back to Shinjuku (15 min). Arrive ~6:00 PM.', { id: 'd04-to-shinjuku', tags: ['transit'] }),
      S('Shinjuku — dinner + optional watches'),
      E('Before dinner', 'Shinjuku watches — optional', 'Komehyo Ginza covered Rolex, Patek, AP, Cartier. Rolex price check: Jackroad Shinjuku (closes 7:30–8 PM), Daikokuya Shinjuku — 5 min from Shinjuku Station. Skip if done.', {
        id: 'd04-watches', optional: true, place: P('Jackroad Shinjuku', 35.6946, 139.7004, 'Jackroad Shinjuku'), travel: { mode: 'transit', label: 'Keio Inokashira, 15 min' }, tags: ['shop'],
      }),
      E('6:00–7:30 PM', 'Dinner in Shinjuku', 'Takashimaya Times Square area or ramen/izakaya streets at the East Exit. 2 stops JR back to Takadanobaba. Hakone early start tomorrow.', {
        id: 'd04-dinner', place: P('Takashimaya Times Square', 35.6876, 139.7024, 'Takashimaya Times Square Shinjuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Luggage shipping tonight', 'TONIGHT (Oct 19): takuhaibin main luggage to Kyoto Granbell — front desk arranges pickup; arrives Oct 21. Hakone with carry-ons only. Overnight bag: 1–2 nights clothes, toiletries, cameras.', 'warn'),
      N('Pack for Hakone', 'Last Tokyo night. Dinner in Shinjuku (Takashimaya Times Square area) or ramen near hotel.'),
    ],
  },

  // ───────────────────────────── D05 ─────────────────────────────
  {
    id: 'd05', n: 5, date: '2026-10-20', dow: 'Tue', city: 'Hakone',
    title: 'Hakone — Open Air + Owakudani + Mizunoto', tagline: 'Ryokan day — volcanic valley + onsen',
    energy: 'MEDIUM', dinner: 'Kaiseki at Mizunoto (included)', hotel: 'mizunoto',
    items: [
      N('Traveling light', 'Luggage shipped Oct 19 — carry-ons only. No large bags on Romancecar or mountain trains.', 'tip'),
      S('Takadanobaba → Hakone — route'),
      E('~6:50 AM', 'Check out', 'Carry-ons only.', { id: 'd05-checkout', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['hotel'] }),
      E('~7:00 AM', 'Shinjuku — buy Hakone Free Pass', 'Walk or 1 stop JR (~8 min). Odakyu counter (opens 7 AM): Hakone Free Pass ¥6,100/person, covers fare + all Hakone transport today.', {
        id: 'd05-freepass', place: P('Odakyu Shinjuku Station', 35.6900, 139.7000, 'Odakyu Shinjuku Station'), travel: { mode: 'train', label: 'JR Yamanote, 1 stop' }, tags: ['transit'], cost: '¥6,100/person',
      }),
      E('7:37 AM', 'Romancecar Hakone 41 → Hakone-Yumoto', 'CONFIRMED. Dep 7:37, arr 9:22 AM. Car 1, right-side seats (C/D) — Fuji may show on the right.', {
        id: 'd05-romancecar', confirmed: true, place: P('Hakone-Yumoto Station', 35.2322, 139.1057), travel: { mode: 'train', label: 'Romancecar Hakone 41, 1h45' }, tags: ['transit', 'booking'],
      }),
      E('9:22 AM', 'Hakone Tozan railway', 'Up to Chokoku-no-Mori.', { id: 'd05-tozan', tags: ['transit'] }),
      E('9:45–10:45 AM', 'Hakone Open Air Museum', 'Outdoor sculpture park, Picasso pavilion. ¥1,600 — not covered by pass. Open 9 AM–5 PM. Chokoku-no-Mori station.', {
        id: 'd05-openair', place: P('Hakone Open-Air Museum', 35.2447, 139.0510, 'Hakone Open-Air Museum'), travel: { mode: 'train', label: 'Hakone Tozan Railway, ~35 min' }, tags: ['sight'], cost: '¥1,600',
      }),
      E('10:45 AM', 'Tozan → Gora → cable car → Sounzan → Ropeway', 'Continue up.', { id: 'd05-cablecar', tags: ['transit'] }),
      E('11:30 AM–12:15 PM', 'Owakudani volcanic valley', 'Sulphur vents, kuro tamago black eggs (¥150 each — grab a couple, eat here or on the ropeway). Fuji on clear days. Ropeway 9 AM–4:45 PM.', {
        id: 'd05-owakudani', place: P('Owakudani', 35.2435, 139.0195, 'Owakudani Hakone'), travel: { mode: 'ropeway', label: 'Tozan + cable car + ropeway' }, tags: ['sight', 'food'],
      }),
      E('12:15 PM', 'Ropeway down to Togendai', '~25 min. Kombini onigiri/snacks at Togendai pier to eat on the ferry.', {
        id: 'd05-togendai', place: P('Togendai Pier', 35.2376, 138.9946, 'Togendai Port Hakone'), travel: { mode: 'ropeway', label: 'Hakone Ropeway, 25 min' }, tags: ['transit'],
      }),
      E('~12:45 PM', 'Sightseeing Cruise → Hakone-machi', '~35 min, ~¥1,200 (Free Pass). Fuji views from the water. Pier ~1:20 PM.', {
        id: 'd05-cruise', place: P('Hakone-machi Pier', 35.1900, 139.0245, 'Hakonemachi-ko Port'), travel: { mode: 'boat', label: 'Sightseeing cruise, 35 min' }, tags: ['transit', 'sight'],
      }),
      E('~1:25–2:00 PM', 'Hakone Shrine + lakeside torii', '5-min walk from pier. Red torii in the lake, cedar approach. Grounds 24 hrs; inner shrine 8:30 AM–5 PM. Free. 35 min.', {
        id: 'd05-shrine', place: P('Hakone Shrine', 35.2047, 139.0254, 'Hakone Shrine'), travel: { mode: 'walk', label: '~20-min lakeside walk (or 1 more stop to Moto-Hakone pier, 5 min from shrine)' }, tags: ['sight'],
      }),
      E('~2:05 PM', 'To Mizunoto', 'The hotel is up in Kowakidani, not by the lake: taxi about 15–20 min from Moto-Hakone, or the Hakone Tozan bus. Check in ~2:30 PM.', {
        id: 'd05-mizunoto', place: P('Mizunoto Hakone', 35.2405, 139.0528, '箱根小涌谷温泉 水の音'), travel: { mode: 'taxi', label: 'Taxi ~15–20 min to Kowakidani' }, tags: ['hotel'],
      }),
      N('Note', 'Owakudani ropeway may close briefly for volcanic monitoring — Hakone Tozan Bus bypass exists. Open Air Museum only practical on the Romancecar/Tozan route.', 'warn'),
      S('Mizunoto — afternoon + evening'),
      E('2:30–3:30 PM', 'Room, tea, change into yukata', '', { id: 'd05-room', tags: ['hotel'] }),
      E('4:00–6:00 PM', 'Private onsen', 'October is perfect onsen season.', { id: 'd05-onsen', tags: ['hotel'] }),
      E('6:30–8:30 PM', 'Kaiseki dinner', 'Multi-course seasonal cuisine. Eat slowly.', { id: 'd05-kaiseki', tags: ['food'] }),
      E('8:30–10:00 PM', 'Second bath, quiet room time', '', { id: 'd05-bath2', tags: ['hotel'] }),
    ],
  },

  // ───────────────────────────── D06 ─────────────────────────────
  {
    id: 'd06', n: 6, date: '2026-10-21', dow: 'Wed', city: 'Kyoto',
    title: 'Hakone → Kyoto', tagline: 'Shinkansen day — Hakone to Gion',
    energy: 'LOW', dinner: 'NASA: Gion + date dinner (TBD) · M&M arrive evening', hotel: 'granbell',
    items: [
      E('7:30–9:00 AM', 'Ryokan breakfast', '', { id: 'd06-bfast', place: P('Mizunoto Hakone', 35.2405, 139.0528, '箱根小涌谷温泉 水の音'), tags: ['food'] }),
      E('9:00–10:45 AM', 'Final onsen, packing', '', { id: 'd06-onsen', tags: ['hotel'] }),
      E('11:00 AM', 'Check out — taxi to Odawara', 'Ask front desk to call a taxi to Odawara Station (book the night before). Carry-ons only.', { id: 'd06-checkout', tags: ['hotel'] }),
      N('Hakone → Odawara taxi', 'No Shinkansen at Hakone; Odawara is nearest, ~12 km. Taxi ~19 min door-to-door, ¥5,000–7,000 (~¥2,500–3,500/person for 2).\nNozomi does NOT stop at Odawara — Hikari only.', 'tip'),
      E('11:00–11:20 AM', 'Taxi → Odawara Station', '~19 min, ¥5,000–7,000 for two.', {
        id: 'd06-taxi', place: P('Odawara Station', 35.2563, 139.1553), travel: { mode: 'taxi', label: 'Taxi, ~19 min, ¥5,000–7,000' }, tags: ['transit'],
      }),
      E('11:20–11:50 AM', 'Odawara — buy ekiben', 'Bento for the Shinkansen; good selection.', { id: 'd06-ekiben', tags: ['food'] }),
      E('12:07 PM', 'Hikari Shinkansen → Kyoto', 'CONFIRMED (Klook). Arr ~2:10 PM. Right-side seats (D/E) — Fuji in the first 10 min. Hikari only; Nozomi skips Odawara.', {
        id: 'd06-shinkansen', confirmed: true, place: P('Kyoto Station', 34.9858, 135.7588), travel: { mode: 'train', label: 'Hikari Shinkansen, ~2 hrs' }, tags: ['transit', 'booking'],
      }),
      E('~2:00 PM', 'Kyoto Station → Gion-Shijo', 'Keihan Line to Gion-Shijo (or taxi, ~12 min, ¥700–800).', { id: 'd06-to-gion', tags: ['transit'] }),
      E('2:15–3:00 PM', 'Check in Kyoto Granbell', 'Luggage already here (shipped Oct 19). Hotel is on Gion-Shijo Station (Keihan). Osaka 52–63 min door-to-door.', {
        id: 'd06-checkin', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'taxi', label: 'Taxi ~12 min ¥700–800, or Keihan Line' }, tags: ['hotel'],
      }),
      S('First Kyoto evening — NASA'),
      E('3:15 PM', 'Gion on foot', 'Hanamikoji Street, Tatsumi Bridge, Gion Shirakawa canal, Yasaka Shrine.', {
        id: 'd06-gion', who: 'nasa', place: P('Hanamikoji Street', 35.0027, 135.7750, 'Hanamikoji Street Gion'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
        subplaces: [P('Tatsumi Bridge', 35.0055, 135.7745, 'Tatsumi Bridge Gion'), P('Yasaka Shrine', 35.0037, 135.7787)],
      }),
      E('5:00–6:30 PM', 'Pontocho + Nishiki Market area', 'Pontocho lantern alley, best at dusk. Nishiki closes ~6 PM — browse what\'s open, grab a snack.', {
        id: 'd06-pontocho', who: 'nasa', place: P('Pontocho Alley', 35.0067, 135.7707, 'Pontocho Kyoto'), travel: { mode: 'walk', label: '~10-min walk' }, tags: ['sight', 'food'], subplaces: [P('Nishiki Market', 35.0050, 135.7646)],
      }),
      E('7:00 PM', 'NASA date dinner — TBD', 'Gion/Pontocho: kaiseki, kappo, or izakaya. Book once decided. See Suggestions tab.', {
        id: 'd06-dinner', who: 'nasa', tbd: true, tags: ['food'],
      }),
      N('M&M arrive tonight (Oct 21)', 'They check in during dinner; meet at hotel after. Gion Pontocho 5-min walk from Granbell. Yasaka Shrine open 24hrs.', 'note', { who: 'mm' }),
    ],
  },

  // ───────────────────────────── D07 ─────────────────────────────
  {
    id: 'd07', n: 7, date: '2026-10-22', dow: 'Thu', city: 'Osaka',
    title: 'Nara + Osaka', tagline: 'Nara deer + Osaka full day',
    energy: 'HIGH', dinner: 'All four — flexible dinner in Namba/Dotonbori', hotel: 'granbell',
    items: [
      N('Why Osaka today', 'Jidai Matsuri (Oct 22) takes over central Kyoto noon–3 PM — being in Osaka avoids it.', 'tip'),
      N('Food strategy', 'Kuromon Ichiba IS lunch — go hungry. Dotonbori: proper sit-down dinner for all four.', 'tip'),
      C('d07-morning', 'Morning — Nara (confirmed) or Katsuoji (backup)', 'Nara confirmed; Katsuoji backup (remote, or if Nara doesn\'t appeal). Both reach Kuromon within 15 min of each other. Katsuoji route passes Umeda; Kuromon is south — temple first, then Kuromon.', [
        { id: 'nara', label: 'Nara — Todai-ji + Deer Park', desc: 'Confirmed morning.',
          items: [
            E('7:30 AM', 'Train to Nara', '~40 min, ¥1,130. Earlier 7:10 AM express gets you into Todai-ji by 8:00 AM, same price. Decide the night before.', { id: 'd07-kintetsu', place: P('Kintetsu-Nara Station', 34.6838, 135.8283), travel: { mode: 'train', label: 'Kintetsu Limited Express, 40 min, ¥1,130' }, tags: ['transit'] }),
            E('8:10 AM', 'Bus to Todai-ji', 'Stop 2 outside Kintetsu Nara Station (~10 min, ¥240 Suica). Drops at Nandaimon gate.', { id: 'd07-bus', tags: ['transit'] }),
            E('8:20–9:15 AM', 'Todai-ji', '15m bronze Great Buddha in Japan\'s largest wooden hall. Open 7:30 AM–5:30 PM (Oct). Deer up to Nandaimon gate.', { id: 'd07-todaiji', place: P('Todai-ji', 34.6890, 135.8398, 'Todai-ji Nara'), travel: { mode: 'transit', label: 'Bus from stop 2, 10 min, ¥240' }, tags: ['sight'], cost: '¥600' }),
            E('9:15–10:15 AM', 'Nara Park deer', 'Shika senbei ¥200 (stalls from ~9 AM; the deer bow). Route to the station runs through the park.', { id: 'd07-deer', place: P('Nara Park', 34.6851, 135.8430, 'Nara Park'), travel: { mode: 'walk', label: 'Walk through the park' }, tags: ['sight'] }),
            E('10:15–10:25 AM', 'Optional: Nakatanidou mochi', 'Higashimuki arcade, 2–3 min from Kintetsu Nara. High-speed mochi pounding; queue 5–10 min. On the way to the train.', { id: 'd07-mochi', optional: true, place: P('Nakatanidou', 34.6826, 135.8290, 'Nakatanidou Nara'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'] }),
            E('10:30 AM', 'Kintetsu Nara → Nippombashi', '~40 min — joins shared Osaka afternoon ~11:10 AM.', { id: 'd07-to-osaka', tags: ['transit'] }),
          ] },
        { id: 'katsuoji', label: 'Katsuoji — backup', desc: 'Hillside temple north of Osaka, thousands of daruma dolls. Temple first (via Umeda), then south to Kuromon.', items: [
          E('Morning', 'Katsuoji Temple', 'Route: Kyoto → Osaka/Umeda → Kita-Senri or Minoh, then bus/taxi. Back south to Kuromon by ~11:15 AM.', { id: 'd07-katsuoji', place: P('Katsuo-ji Temple', 34.8598, 135.4802, 'Katsuoji Temple Minoh'), travel: { mode: 'transit', label: 'Via Osaka/Umeda' }, tags: ['sight'] }),
        ] },
      ], { default: 'nara' }),
      S('Osaka afternoon'),
      E('~11:10 AM–12:30 PM', 'Kuromon Ichiba Market', '170 stalls — this is lunch. Best: giant Nihon scallop skewer, Daiwa wagyu nigiri, Maruhachi uni, Kani Douraku crab tasting.', {
        id: 'd07-kuromon', place: P('Kuromon Ichiba Market', 34.6655, 135.5063, 'Kuromon Ichiba Market'), travel: { mode: 'train', label: 'Kintetsu to Nippombashi, 40 min' }, tags: ['food'], cost: '¥2,500–3,500/person',
      }),
      E('12:45–2:30 PM', 'Shinsekai + Tsutenkaku Tower', 'Retro 1950s district. Observation deck (¥1,100) + Tower Slider (¥1,000, limited slots — buy at counter on arrival). Open 9 AM–9 PM. Kushikatsu outside (Daruma original). Subway: Dobutsuen-mae.', {
        id: 'd07-shinsekai', place: P('Tsutenkaku Tower', 34.6525, 135.5063, 'Tsutenkaku'), travel: { mode: 'walk', label: '~20-min walk south (or subway to Dobutsuen-mae)' }, tags: ['sight', 'food'], cost: '¥1,100 + ¥1,000 slider',
      }),
      N('Tsutenkaku Tower Slider', '60m body slide from 3F, ~10 sec. ¥1,000 on top of entry. Slots sell out daily — buy at the counter on arrival. Check tsutenkaku.co.jp for advance booking.', 'book', { link: { label: 'tsutenkaku.co.jp', url: 'https://www.tsutenkaku.co.jp' } }),
      E('2:30–3:00 PM', 'Subway north to Shinsaibashi', 'Midosuji Line, 1 stop, ¥230.', { id: 'd07-subway', tags: ['transit'] }),
      S('Shinsaibashi — vintage luxury + streetwear'),
      E('3:00–4:30 PM', 'Shinsaibashi vintage luxury block', 'Komehyo Shinsaibashi (Hermès/Chanel/LV bags, Rolex/Cartier), Brand Off Shinsaibashi (2 min, bags), ALLU Shinsaibashi (high-end pre-owned) — all within 5 min on Shinsaibashi-suji. M&M\'s window. NASA: Onitsuka Tiger Shinsaibashi flagship on the arcade.', {
        id: 'd07-shinsaibashi', place: P('Komehyo Shinsaibashi', 34.6730, 135.5010, 'KOMEHYO Shinsaibashi'), travel: { mode: 'transit', label: 'Midosuji Line, 1 stop, ¥230' }, tags: ['shop'],
      }),
      E('4:30–5:15 PM', 'Amerika-mura streetwear', '5 min from Komehyo. Triangle Park: Wego, Flamingo Osaka, Dogs, BRG — vintage jackets and tops. Most open noon–9 PM.', {
        id: 'd07-amemura', place: P('Amerikamura Triangle Park', 34.6724, 135.4982, 'Triangle Park Amerikamura'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['shop'],
      }),
      E('5:15–5:45 PM', 'Walk Dotonbori', '10-min walk. Glico sign photo, canal bridges, neon strip.', {
        id: 'd07-dotonbori', place: P('Dotonbori Glico Sign', 34.6687, 135.5012, 'Glico Sign Dotonbori'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('6:00–7:30 PM', 'Dinner in Dotonbori / Namba — TBD', 'Book for four or decide on the day. Seafood, okonomiyaki, ramen. À la carte over set menus for halal/pork-free. See Suggestions.', {
        id: 'd07-dinner', tbd: true, tags: ['food'],
      }),
      E('7:30–8:00 PM', 'Don Quijote ferris wheel', 'Views over the neon canal. Open until midnight.', {
        id: 'd07-ferris', place: P('Don Quijote Dotonbori', 34.6692, 135.5033, 'Don Quijote Dotonbori'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'], cost: '¥500',
      }),
      E('8:00–8:15 PM', 'Hozenji Yokocho', 'Moss-covered Fudo-myo-o shrine, paper lanterns, tiny alley just off Dotonbori.', {
        id: 'd07-hozenji', place: P('Hozenji Yokocho', 34.6675, 135.5030, 'Hozenji Yokocho'), travel: { mode: 'walk', label: '3-min walk' }, tags: ['sight'],
      }),
      C('d07-castle', 'Osaka Castle — your call', 'Energy left: subway to Temmabashi, lit exterior (park 24hrs, free, moat reflection), +40 min. Otherwise Namba/Yodoyabashi → earlier Keihan (Kyoto ~9 PM).', [
        { id: 'castle', label: 'Osaka Castle at night (+40 min)', desc: 'Illuminated exterior, moat reflection. Park open 24 hrs, free.',
          items: [E('8:30–9:00 PM', 'Osaka Castle exterior', 'Illuminated at night, moat reflection. Park open 24hrs, free.', { id: 'd07-castle-ev', optional: true, place: P('Osaka Castle', 34.6873, 135.5262, 'Osaka Castle'), travel: { mode: 'transit', label: 'Subway to Temmabashi' }, tags: ['sight'] })] },
        { id: 'home', label: 'Head home early', desc: 'Keihan from Yodoyabashi, arrive Kyoto ~9 PM.', items: [] },
      ], { default: 'home' }),
      E('~9:00–10:00 PM', 'Keihan → Gion-Shijo', '~55–60 min from Yodoyabashi.', {
        id: 'd07-home', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'train', label: 'Keihan Line, ~60 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D08 ─────────────────────────────
  {
    id: 'd08', n: 8, date: '2026-10-23', dow: 'Fri', city: 'Kyoto',
    title: 'Arashiyama + samurai', tagline: 'Bamboo grove · river · Gion samurai',
    energy: 'HIGH', dinner: 'M&M: romantic evening · NASA: Osaka OR Kyoto date dinner', hotel: 'granbell',
    items: [
      N('Wagyu sukiyaki (optional, either couple)', 'Mishima-tei (Sanjo, since 1873). Pre-book for 2; confirm pork-free broth, no alcohol. ¥10,000–15,000/person. Book as a couple. Concierge can help.', 'book'),
      N('Taxis — GO app', 'Download GO (go.goinc.jp) before the trip — Kyoto incl. Arashiyama, card billed, no Japanese. Use for bamboo → Otagi, Otagi → boat. Backups: DiDi, Uber Taxi.', 'tip', { link: { label: 'GO app', url: 'https://go.goinc.jp' } }),
      N('Bamboo Grove — go early', 'Busy by 8:30–9:00 AM even on Fridays in October. 7:30 AM start beats tour groups. Taxi from hotel — buses unreliable this early.', 'tip'),
      E('7:00 AM', 'Taxi to Arashiyama', 'Buses not reliable this early. ~25 min, ¥3,000–4,000.', { id: 'd08-taxi', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('7:30–8:30 AM', 'Bamboo Grove + Arashiyama Park', 'Enter south end, walk north; continue into Arashiyama Park — observation deck 5–10 min past the bamboo exit, over the Hozu gorge. Walk back south; ~8:25 AM Nonomiya Shrine\'s black torii on the right (2 min). Open 24 hrs, free.', {
        id: 'd08-bamboo', place: P('Arashiyama Bamboo Grove', 35.0170, 135.6718, 'Arashiyama Bamboo Grove'), travel: { mode: 'taxi', label: 'Taxi ~25 min, ¥3,000–4,000' }, tags: ['sight'],
        subplaces: [P('Arashiyama Park observation deck', 35.0188, 135.6700, 'Arashiyama Park Kameyama Area'), P('Nonomiya Shrine', 35.0165, 135.6735)],
      }),
      E('8:30–9:45 AM', 'Tenryu-ji Temple garden', 'Zen pond garden, raked gravel, mountains as borrowed scenery. Open 8:30 AM–5:30 PM.', {
        id: 'd08-tenryuji', place: P('Tenryu-ji', 35.0157, 135.6737, 'Tenryu-ji Temple'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['sight'], cost: '¥1,500',
      }),
      E('10:00–11:00 AM', 'Otagi Nenbutsuji', 'Taxi ~12–15 min, ¥1,000–1,200. 1,200 stone rakan statues on a hillside, almost no crowds. Open 9 AM–5 PM.', {
        id: 'd08-otagi', place: P('Otagi Nenbutsu-ji', 35.0301, 135.6619, 'Otagi Nenbutsuji Temple'), travel: { mode: 'taxi', label: 'Taxi 12–15 min, ¥1,000–1,200' }, tags: ['sight'], cost: '¥300',
      }),
      S('Katsura River boat'),
      E('11:15 AM–12:05 PM', 'Katsura River sightseeing boat', 'Taxi to Togetsukyo (~12–15 min). Walk-up, no reservation; departures every 20–40 min. ~30 min on the water. Board south bank by Togetsukyo Bridge.', {
        id: 'd08-boat', place: P('Togetsukyo Bridge (boat pier, south bank)', 35.0124, 135.6780, 'Togetsukyo Bridge'), travel: { mode: 'taxi', label: 'Taxi 12–15 min' }, tags: ['sight'], cost: '¥1,500–2,000/person',
      }),
      E('12:05–12:30 PM', 'Free time at Togetsukyo', 'Riverside lane, matcha ice cream.', { id: 'd08-bridge', tags: ['sight', 'food'] }),
      E('12:30–1:30 PM', 'Itsukichaya Arashiyama Honten — lunch', 'CONFIRMED 12:30 PM. Kyoto set meal, riverside. CASH ONLY — bring yen. Backup: Yoshimura (soba + yudofu, riverfront).', {
        id: 'd08-lunch', confirmed: true, place: P('Itsukichaya Arashiyama Honten', 35.0120, 135.6790, 'Itsukichaya Arashiyama Honten'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food', 'booking'],
      }),
      S('Gion — samurai'),
      E('1:30 PM', 'Head to Gion', 'Taxi (~19 min, ¥2,000–2,500) arrives ~1:49 PM, 26 min buffer. Bus (~36 min, ¥230) arrives ~2:06 PM, 9 min buffer — not recommended.', { id: 'd08-to-gion', tags: ['transit'] }),
      E('2:15–4:15 PM', 'Samurai class — Samurai Kenbu Theater', 'CONFIRMED 2:15 PM. Sword fundamentals, Iaido, hakama dressing, full-gear photo. 2 hrs.', {
        id: 'd08-samurai', confirmed: true, place: P('Samurai Kenbu Theater', 35.0083, 135.7762, 'Samurai Kenbu Theater Kyoto'), travel: { mode: 'taxi', label: 'Taxi ~19 min, ¥2,000–2,500' }, tags: ['booking', 'sight'],
      }),
      E('4:15 PM', 'Walk back to hotel', '~10 min on foot, both in Gion.', {
        id: 'd08-hotel', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'walk', label: '10-min walk' }, tags: ['hotel'],
      }),
      S('Evening — NASA + M&M split'),
      E('4:15 PM onward', 'M&M romantic evening', 'M&M head off for their own evening.', { id: 'd08-mm', who: 'mm', tags: ['food'] }),
      C('d08-night', 'NASA — dinner night: D8 or D9?', 'One night gets a booked dinner; the other stays open. D9 starts 6:30 AM — a late Osaka night on D8 will hurt at Fushimi.', [
        { id: 'dinner', label: 'A — dinner tonight (D9 open)', desc: 'Pontocho or Gion sit-down from ~7 PM. Book ahead.',
          items: [E('~7:00 PM', 'Booked dinner — Pontocho or Gion', 'Mishima-tei sukiyaki, Kikunoi Roan kaiseki, or a Pontocho pick. See Suggestions.', { id: 'd08-dinner', who: 'nasa', tbd: true, place: P('Pontocho Alley', 35.0067, 135.7707, 'Pontocho Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'] })] },
        { id: 'osaka', label: 'B — Osaka tonight (dinner on D9)', desc: 'Keihan Gion-Shijo → Yodoyabashi (~55 min). Dotonbori evening. Last train back ~11:40 PM, home ~12:45 AM.',
          items: [E('Evening', 'Dotonbori evening', 'Canal walk, neon, street food. Last Keihan back ~11:40 PM.', { id: 'd08-osaka', who: 'nasa', place: P('Dotonbori', 34.6687, 135.5012, 'Dotonbori Osaka'), travel: { mode: 'train', label: 'Keihan Line, ~55 min' }, tags: ['sight', 'food'] })] },
      ], { default: 'dinner', who: 'nasa' }),
      N('Free evening in Gion', 'Jidai Matsuri week: Yasaka-jinja events, Hanamikoji lively. Pontocho dinner (walk in or book). Kamo River south bank from Shijo Bridge, lit at night.'),
    ],
  },

  // ───────────────────────────── D09 ─────────────────────────────
  {
    id: 'd09', n: 9, date: '2026-10-24', dow: 'Sat', city: 'Kyoto',
    title: 'Fushimi dawn + temples + tea ceremony', tagline: 'Fushimi dawn · temples · tea + calligraphy',
    energy: 'HIGH', dinner: 'M&M: GEAR show · NASA: Kyoto dinner OR Osaka — whichever you didn\'t do on D8', hotel: 'granbell',
    items: [
      N('Route logic', 'Fushimi dawn (south) → walk 2 km to Sanjusangen-do → taxi to Nanzen-ji (default) or Nijo → taxi to Nishiki for lunch → Orizuruya 1:30 PM → free from 3:30 PM.', 'tip'),
      E('6:00 AM', 'Leave hotel', 'Bring a layer — cold at dawn.', { id: 'd09-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['hotel'] }),
      E('6:10–6:25 AM', 'Keihan Gion-Shijo → Fushimi-Inari', '3 stops, ~12 min.', { id: 'd09-keihan', tags: ['transit'] }),
      E('6:30–8:30 AM', 'Fushimi Inari', 'Go higher than you would at midday — emptier paths, city views. Base stalls sell coffee and bites from early. Open 24 hrs, free.', {
        id: 'd09-fushimi', place: P('Fushimi Inari Taisha', 34.9675, 135.7797), travel: { mode: 'train', label: 'Keihan Line, 3 stops, 12 min' }, tags: ['sight'],
      }),
      E('8:30–9:00 AM', 'Walk to Sanjusangen-do', '2 km flat, ~25 min. Breakfast from a stall or konbini on the way.', { id: 'd09-walk', tags: ['transit'] }),
      E('9:00–9:45 AM', 'Sanjusangen-do', '120m hall, 1,001 life-size golden Kannon in rows. Opens 8 AM.', {
        id: 'd09-sanjusangendo', place: P('Sanjusangen-do', 34.9876, 135.7718, 'Sanjusangendo Temple'), travel: { mode: 'walk', label: '2 km, ~25 min' }, tags: ['sight'], cost: '¥600',
      }),
      C('d09-pick', 'Nanzen-ji OR Nijo Castle (not both)', 'Nanzen-ji is the default: keeps the day in eastern Kyoto, cleaner routing, best Zen complex in the city.', [
        { id: 'nanzenji', label: 'Nanzen-ji (recommended)', desc: 'Taxi north ~15 min, ¥1,000.',
          items: [E('10:30–11:30 AM', 'Nanzen-ji', 'Sanmon gate, brick aqueduct, sub-temple rock gardens. Open 8:40 AM–5 PM. Outer grounds free, main hall ¥600. Taxi at 10:15.', { id: 'd09-nanzenji', place: P('Nanzen-ji', 35.0113, 135.7932, 'Nanzen-ji Temple'), travel: { mode: 'taxi', label: 'Taxi ~15 min, ¥1,000' }, tags: ['sight'], cost: '¥600' })] },
        { id: 'nijo', label: 'Nijo Castle', desc: 'Nightingale floors, gold-leaf screens, Ninomaru garden. 8:45 AM–5 PM (last entry 4 PM). ¥1,300. Taxi west, 10:30–12:00, then taxi to Nishiki for 12:15 lunch.',
          items: [E('10:30 AM–12:00 PM', 'Nijo Castle', 'Nightingale floors, gold-leaf screen rooms, Ninomaru garden. ¥1,300.', { id: 'd09-nijo', place: P('Nijo Castle', 35.0142, 135.7481, 'Nijo Castle'), travel: { mode: 'taxi', label: 'Taxi west' }, tags: ['sight'], cost: '¥1,300' })] },
      ], { default: 'nanzenji' }),
      E('11:55 AM–12:45 PM', 'Nishiki Market', 'Taxi ~20–25 min, ¥1,500–2,000. 400m covered arcade. Buy: tsukemono, tamagoyaki, matcha items. Lunch from stalls. Most close 5:30–6 PM.', {
        id: 'd09-nishiki', place: P('Nishiki Market', 35.0050, 135.7646), travel: { mode: 'taxi', label: 'Taxi 20–25 min, ¥1,500–2,000' }, tags: ['food', 'shop'],
      }),
      E('12:45–1:30 PM', 'Wrap up Nishiki', 'Finish the arcade, then coffee or a quiet sit before the ceremony.', { id: 'd09-wrap', tags: ['food'] }),
      E('1:30–3:30 PM', 'Orizuruya — tea ceremony + calligraphy', 'CONFIRMED 1:30 PM. 2 hrs. You keep your calligraphy.', {
        id: 'd09-orizuruya', confirmed: true, place: P('Nishiki Orizuruya', 35.0053, 135.7620, 'Orizuruya Nishiki Kyoto tea ceremony'), travel: { mode: 'walk', label: 'Short walk' }, tags: ['booking', 'sight'],
      }),
      E('3:30 PM onward', 'M&M — GEAR show', '70-min non-verbal comedy in Gion. M&M done ~9:30–10 PM; Gion Pontocho nearby to meet after.', {
        id: 'd09-gear', who: 'mm', place: P('GEAR Theatre (Art Complex 1928)', 35.0088, 135.7681, 'GEAR non-verbal theatre Kyoto'), tags: ['sight'],
      }),
      N('NASA — evening', 'Free from ~3:30 PM.\nIF D8 was Osaka → Kyoto dinner tonight, Pontocho or Gion, 10–15 min from Nishiki.\nIF D8 was dinner → looser: Osaka (mind the early start), or Kamo River at dusk, Gion backstreets, counter ramen, early night.', 'decide', { who: 'nasa' }),
    ],
  },

  // ───────────────────────────── D10 ─────────────────────────────
  {
    id: 'd10', n: 10, date: '2026-10-25', dow: 'Sun', city: 'Kyoto',
    title: 'Kimono day in Higashiyama', tagline: 'Dawn Kiyomizu · kimono circuit · Kodai-ji illumination',
    energy: 'HIGH', dinner: 'Casual Gion dinner · early night before USJ', hotel: 'granbell',
    items: [
      E('6:45 AM', 'Taxi to Kiyomizu', '~15 min.', { id: 'd10-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('7:00–8:40 AM', 'Kiyomizu-dera at dawn', 'Empty at this hour. Cliffside stage, Otowa waterfall, valley views. Easy pace for Mariam. Open 6 AM.', {
        id: 'd10-kiyomizu', place: P('Kiyomizu-dera', 34.9949, 135.7850, 'Kiyomizu-dera Temple'), travel: { mode: 'taxi', label: 'Taxi ~15 min' }, tags: ['sight'], cost: '¥500',
      }),
      E('8:40–9:20 AM', 'Down Ninenzaka + Sannenzaka', 'Buffer before the 9:30 AM appointment. Stone lanes, matcha or taiyaki. ~20–25 min with stops.', {
        id: 'd10-ninenzaka', place: P('Ninenzaka', 34.9980, 135.7810, 'Ninenzaka Kyoto'), travel: { mode: 'walk', label: 'Walk down the slope' }, tags: ['sight'],
      }),
      E('9:30–10:30 AM', 'Kimono dressing + hair — Momo Kimono', 'CONFIRMED 9:30 AM, 1 hr. Women\'s kimono + hair is the main time; men\'s hakama ~20 min. Ready by 10:30 AM. Return 4:30 PM or later.', {
        id: 'd10-kimono', confirmed: true, place: P('Momo Kimono', 35.0039, 135.7745, 'Momo Kimono Kyoto'), travel: { mode: 'walk', label: '~20-min walk' }, tags: ['booking'],
      }),
      E('10:30–10:45 AM', 'Walk to photographer meetup', '15 min; arrive 10:45 AM.', { id: 'd10-walk', tags: ['transit'] }),
      E('10:45 AM–12:45 PM', 'Photoshoot with street photographer', 'CONFIRMED, 2 hrs. Yasaka Pagoda → Nen-no-michi lane → Maruyama Park → Gion Shirakawa canal. All within 15 min of Kodai-ji.', {
        id: 'd10-photo', confirmed: true, place: P('Yasaka Pagoda (Hokan-ji)', 34.9985, 135.7795, 'Yasaka Pagoda'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['booking', 'sight'],
        subplaces: [P('Maruyama Park', 35.0040, 135.7810, 'Maruyama Park Kyoto'), P('Gion Shirakawa', 35.0053, 135.7745, 'Gion Shirakawa')],
      }),
      E('12:45–1:30 PM', 'Walk to Hikiniku in kimono', '~10–15 min from Gion Shirakawa.\nCHANGE OPTION: if time before 1:30, change at Momo Kimono first (~15 min walk; return by 4:30 PM). If tight, go in kimono — apron provided.', { id: 'd10-walk2', tags: ['transit'] }),
      E('1:30–2:15 PM', 'Hikiniku to Come 挽肉と米', 'CONFIRMED 1:30 PM — arrive within 10 min. Coarse-minced beef patty grilled tableside, rice, miso soup. Apron provided. Cash or card.', {
        id: 'd10-hikiniku', confirmed: true, place: P('Hikiniku to Come Kyoto', 35.0040, 135.7730, '挽肉と米 京都'), travel: { mode: 'walk', label: '10–15 min walk' }, tags: ['food', 'booking'], cost: '¥1,800 + ¥1,000',
      }),
      E('2:15–4:00 PM', 'Free Higashiyama afternoon in kimono', 'Ninenzaka/Sannenzaka lighter by 2–3 PM. Also: Hanamikoji, Yasaka Shrine, Kennin-ji (10 min, ¥600, twin dragon ceiling), % Arabica below Yasaka Pagoda, Gion Kinana soft serve.', {
        id: 'd10-free', place: P('Sannenzaka', 34.9968, 135.7820, 'Sannenzaka Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('4:00–4:30 PM', 'Return kimono to Momo Kimono', '', { id: 'd10-return', place: P('Momo Kimono', 35.0039, 135.7745, 'Momo Kimono Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['booking'] }),
      E('5:00–7:00 PM', 'Kodai-ji illumination', '10-min walk. Sand garden, moss, pond, bamboo, teahouses lit at dusk. 5 PM–9:30 PM; make the 5 PM start.', {
        id: 'd10-kodaiji', place: P('Kodai-ji', 34.9995, 135.7815, 'Kodaiji Temple'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'], cost: '¥600',
      }),
      E('7:00–8:00 PM', 'Casual dinner in Gion', 'Early night. USJ tomorrow: gates open 8:00 AM.', {
        id: 'd10-dinner', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Luggage shipping tonight', 'Oct 25: bags to Granbell front desk by 8 PM after Kodai-ji → Akihabara Washington, 2-day delivery, arrives Oct 27. NOT Oct 26 (USJ, 6 AM–11 PM). ¥1,500–2,500/bag.', 'warn'),
    ],
  },

  // ───────────────────────────── D11 ─────────────────────────────
  {
    id: 'd11', n: 11, date: '2026-10-26', dow: 'Mon', city: 'Osaka',
    title: 'USJ — Halloween', tagline: 'USJ — Harry Potter + Mario + Horror Night',
    energy: 'HIGH', dinner: 'In-park themed restaurants', hotel: 'granbell',
    items: [
      N('Confirmed — Express Pass 7', 'EP7 Minecart & Selection for all. Hippogriff 12:00–12:30 PM. Super Nintendo World entry 19:10–20:10: Mario Kart 19:10–19:40, Yoshi\'s Adventure 19:40–20:10, Mine Cart Madness 20:10–20:40. Other EP7 rides open on the day.', 'book'),
      E('6:00 AM', 'Granbell → USJ', 'Walk/taxi to Kyoto Station (~15 min). JR Shinkaisoku → Osaka (~28 min, ¥580) → Osaka Loop Line → Nishikujo (~10 min) → Sakurajima Line → Universal City (~8 min). ~65 min.', { id: 'd11-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('~7:20–7:40 AM', 'Arrive USJ gates', '', { id: 'd11-gates', place: P('Universal Studios Japan', 34.6655, 135.4323, 'Universal Studios Japan'), travel: { mode: 'train', label: 'JR via Osaka + Nishikujo, ~65 min' }, tags: ['sight'] }),
      E('8:00–8:30 AM', 'ROPE DROP', 'Confirm gate time on USJ app night before. SPLIT: husbands → The Flying Dinosaur standby (~5–10 min queue, ~25 min); wives → Villain-Con Minion Blast standby (~15 min). Regroup at Minion Mayhem (express, all four), then Harry Potter.', { id: 'd11-ropedrop', tags: ['sight'] }),
      S('Harry Potter area'),
      E('9:00–9:45 AM', 'Ollivanders wand ceremony + Forbidden Journey', 'First or second show; one person chosen for the wand demo. ~15 min, every 20–30 min. Then Forbidden Journey (express).', { id: 'd11-ollivanders', tags: ['sight'] }),
      E('9:45–10:15 AM', 'Butterbeer', 'Cart or Three Broomsticks — original, frozen, or hot. Sit in Hogsmeade.', { id: 'd11-butterbeer', tags: ['food'] }),
      E('10:15–11:55 AM', 'HP area: shows + photos + browse', 'USJ app night before for free Hogsmeade show times. Photos: Hogwarts entrance, Hogsmeade rooftops, Hogwarts Express, Knight Bus. Dervish & Banges, Ollivanders shop (interactive wand zones).', { id: 'd11-hp', tags: ['sight', 'shop'] }),
      S('Midday'),
      E('12:00–12:30 PM', '⭐ EXPRESS SLOT: Flight of the Hippogriff', 'Outdoor coaster. At ride entrance by 11:55 AM.', { id: 'd11-hippogriff', confirmed: true, tags: ['sight', 'booking'] }),
      E('12:30–1:30 PM', 'Lunch in park', 'Three Broomsticks — safest pork-free (rotisserie chicken, salad, soup; good for M&M). Or Louie\'s NY Pizza near the entrance.', { id: 'd11-lunch', tags: ['food'] }),
      S('Afternoon'),
      E('1:30–5:00 PM', 'Free afternoon', 'JAWS express (flexible — use now); Frieren + Wicked experiences (USJ app for times); One Piece Mugiwara Store, anime merch; Horror Nights décor from mid-afternoon. Power-Up bands at Nintendo World entrance (extra purchase).', { id: 'd11-afternoon', tags: ['sight', 'shop'] }),
      E('5:30–7:00 PM', 'Dinner inside park', 'Before 7 PM. Kinopio\'s Cafe inside Nintendo World, or eat before entry. M&M: check menus in advance.', { id: 'd11-dinner', tags: ['food'] }),
      S('Super Nintendo World — evening'),
      E('7:10 PM', '⭐ Super Nintendo World timed entry opens', 'Head to the gate.', { id: 'd11-snw', confirmed: true, tags: ['sight', 'booking'] }),
      E('7:10–7:40 PM', '⭐ EXPRESS: Mario Kart: Koopa\'s Challenge', '', { id: 'd11-mariokart', confirmed: true, tags: ['sight', 'booking'] }),
      E('7:40–8:10 PM', '⭐ EXPRESS: Yoshi\'s Adventure', '', { id: 'd11-yoshi', confirmed: true, tags: ['sight', 'booking'] }),
      E('8:10–8:40 PM', '⭐ EXPRESS: Mine Cart Madness (Donkey Kong Country)', '', { id: 'd11-minecart', confirmed: true, tags: ['sight', 'booking'] }),
      E('8:40–9:00 PM', 'Browse Nintendo World', 'Donkey Kong Country, Nintendo store, Power-Up band challenges if you have them.', { id: 'd11-browse', tags: ['shop'] }),
      S('Final hour'),
      E('9:00–10:00 PM', 'Horror Nights scare zones + Hollywood Dream', 'Free walk-through, anime crossover theming. Hollywood Dream standby ~15–20 min in the last hour. Last merch: One Piece and Nintendo stores close 10 PM.', { id: 'd11-hhn', tags: ['sight'] }),
      E('10:00 PM', 'Park closes', '', { id: 'd11-close', tags: ['sight'] }),
      E('~10:15 PM', 'Return to Granbell', 'Reverse: Universal City → Nishikujo → Osaka Loop → Osaka Station → Shinkaisoku → Kyoto (~28 min) → taxi/walk. ~75 min; hotel ~11:30 PM.', {
        id: 'd11-return', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'train', label: 'JR, ~75 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D12 ─────────────────────────────
  {
    id: 'd12', n: 12, date: '2026-10-27', dow: 'Tue', city: 'Tokyo',
    title: 'Kyoto → Tokyo + Ginza', tagline: 'Squad reunites — Ginza · NASA Yoroniku · M&M evening',
    energy: 'MEDIUM', dinner: 'Ginza together · NASA: Yoroniku Ebisu 9:30 PM · M&M romantic evening', hotel: 'washington',
    items: [
      S('Flexible Kyoto morning'),
      E('9:00 AM–12:00 PM', 'Flexible morning', 'Sleep in, slow breakfast, wander Gion. Bags already shipped — check out at noon.', { id: 'd12-morning', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['hotel'] }),
      C('d12-optional', 'Optional Kyoto morning picks', 'One last Kyoto thing before the train. None required.', [
        { id: 'none', label: 'Nothing — slow morning', desc: '', items: [] },
        { id: 'kenninji', label: 'Kennin-ji', desc: 'Kyoto\'s oldest Zen temple, 10-min walk from hotel (opens 10 AM, ¥600). Twin dragon ceiling + gravel garden.',
          items: [E('10:00–11:15 AM', 'Kennin-ji', 'Twin dragon ceiling + gravel garden. ¥600.', { id: 'd12-kenninji', optional: true, place: P('Kennin-ji', 35.0005, 135.7735, 'Kenninji Temple'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'] })] },
        { id: 'onitsuka', label: 'Onitsuka Tiger Kyoto', desc: '8-min walk from hotel, 11 AM–9 PM. Full range; sizes run small — try first.',
          items: [E('11:00–11:45 AM', 'Onitsuka Tiger Kyoto', 'Full range in-store.', { id: 'd12-onitsuka', optional: true, place: P('Onitsuka Tiger Kyoto', 35.0040, 135.7690, 'Onitsuka Tiger Kyoto'), travel: { mode: 'walk', label: '8-min walk' }, tags: ['shop'] })] },
        { id: 'railway', label: 'Kyoto Railway Museum', desc: 'Near Kyoto Station (~20 min taxi; 10 AM–5:30 PM, closed Wed, ¥1,200). 53 locomotives, steam loco rides, Shinkansen yard view.',
          items: [E('10:00–11:45 AM', 'Kyoto Railway Museum', '53 locomotives, steam rides. ¥1,200.', { id: 'd12-railway', optional: true, place: P('Kyoto Railway Museum', 34.9870, 135.7420, 'Kyoto Railway Museum'), travel: { mode: 'taxi', label: 'Taxi ~20 min' }, tags: ['sight'] })] },
      ], { default: 'none' }),
      E('12:00 PM', 'Check out · taxi to Kyoto Station', '~12 min, ¥700–1,000; or Karasuma subway from Shijo-Karasuma (~20 min). Allow 15–20 min.', {
        id: 'd12-checkout', place: P('Kyoto Station', 34.9858, 135.7588), travel: { mode: 'taxi', label: 'Taxi ~12 min, ¥700–1,000' }, tags: ['transit', 'hotel'],
      }),
      E('12:15–1:45 PM', 'Kyoto Station run', 'Porta mall, Isetan basement food hall, platform souvenir strip (10 AM–8 PM). Bento by ~1:30 PM — Kyoto makunouchi box, ~¥1,200–1,800 each.', { id: 'd12-station', tags: ['food', 'shop'] }),
      E('2:01 PM', 'Shinkansen Kyoto → Tokyo', 'CONFIRMED 2:01 PM, arr Tokyo 4:15 PM. Left-side seats (A/B) for Fuji. Rear row, large-baggage car.', {
        id: 'd12-shinkansen', confirmed: true, place: P('Tokyo Station', 35.6812, 139.7671), travel: { mode: 'train', label: 'Shinkansen, 2h14' }, tags: ['transit', 'booking'],
      }),
      S('Tokyo arrival'),
      E('4:20 PM', 'Keihin-Tohoku → Akihabara · check in', '5 min. Drop bags, freshen up.', {
        id: 'd12-checkin', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'JR Keihin-Tohoku, 5 min' }, tags: ['hotel'],
      }),
      E('5:00 PM', 'JR Akihabara → Yurakucho', '~10 min — into Ginza.', { id: 'd12-to-ginza', tags: ['transit'] }),
      E('5:15–7:00 PM', 'Ginza — all four', 'Chuo-dori, Itoya (closes 8 PM), Uniqlo Ginza flagship. Coffee break.', {
        id: 'd12-ginza', place: P('Ginza Chuo-dori', 35.6717, 139.7649, 'Ginza Chuo-dori'), travel: { mode: 'train', label: 'JR to Yurakucho, 10 min' }, tags: ['shop'],
      }),
      S('All four — Ginza vintage luxury'),
      E('7:00–8:00 PM', 'Brand Off + Komehyo + Casanova Vintage', 'Brand Off Ginza (Birkin/Kelly floor), Komehyo Ginza (bags + watches, closes ~8:30 PM), Casanova Vintage Ginza — Ginza 6–7 chome. Second pass after D4; stock rotates daily.', {
        id: 'd12-vintage', place: P('Komehyo Ginza', 35.6700, 139.7632, 'KOMEHYO Ginza'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'],
      }),
      E('~8:00 PM', 'Split', 'NASA heads toward Yoroniku; M&M into their own evening.', { id: 'd12-split', tags: ['logistics'] }),
      S('NASA — evening after Ginza'),
      E('8:00–9:10 PM', 'Marunouchi wander', '10-min walk east. Imperial Palace moat, Naka-dori brick arcades, Tokyo Station red-brick facade lit.', {
        id: 'd12-marunouchi', who: 'nasa', place: P('Marunouchi Naka-dori', 35.6800, 139.7640, 'Marunouchi Naka-dori'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('9:30–11:30 PM', 'Yoroniku よろにく Ebisu', 'CONFIRMED 9:30 PM. Taxi ~15 min, ~¥2,000. A5 wagyu yakiniku, charcoal-grilled tableside. No pork, no alcohol needed.', {
        id: 'd12-yoroniku', who: 'nasa', confirmed: true, place: P('Yoroniku Ebisu', 35.6475, 139.7100, 'Yoroniku Ebisu'), travel: { mode: 'taxi', label: 'Taxi ~15 min, ~¥2,000' }, tags: ['food', 'booking'],
      }),
      E('~11:30 PM', 'Taxi back to Akihabara', '~25 min, ~¥2,500.', {
        id: 'd12-home', who: 'nasa', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'taxi', label: 'Taxi ~25 min, ~¥2,500' }, tags: ['hotel'],
      }),
      S('M&M — romantic evening'),
      E('After 8 PM', 'M&M private evening', 'Dinner and the night at your own pace. Back to Akihabara whenever.', { id: 'd12-mm', who: 'mm', tags: ['food'] }),
    ],
  },

  // ───────────────────────────── D13 ─────────────────────────────
  {
    id: 'd13', n: 13, date: '2026-10-28', dow: 'Wed', city: 'Tokyo',
    title: 'Asakusa + Kappabashi + Okachimachi', tagline: 'Old Tokyo — temples, knives, chopsticks, gold',
    energy: 'HIGH', dinner: 'Nakamise + Ameyoko stalls + Akihabara night', hotel: 'washington',
    items: [
      E('8:20 AM', 'Tsukuba Express → Asakusa', '8 min, ¥210. Walk 5 min southeast to Senso-ji. Pelikan Bakery (since 1942, opens 9 AM, sells out late morning) 5 min from Senso-ji.', { id: 'd13-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('8:30–10:00 AM', 'Senso-ji before crowds', 'Kaminarimon Gate, incense cauldron, main hall, omikuji ¥100. Asakusa Shrine next door — quieter. Tour groups from 10:30.', {
        id: 'd13-sensoji', place: P('Senso-ji', 35.7148, 139.7967, 'Sensoji Temple'), travel: { mode: 'train', label: 'Tsukuba Express, 8 min, ¥210' }, tags: ['sight'], subplaces: [P('Asakusa Shrine', 35.7153, 139.7975)],
      }),
      E('10:00–11:00 AM', 'Nakamise-dori', 'Fans, lacquerware, ningyo-yaki (red-bean cakes), tenugui cloth. Also Denpoin Street (Edo facades), Shin-Nakamise arcade. Stalls 10 AM–6:30 PM.', {
        id: 'd13-nakamise', place: P('Nakamise-dori', 35.7117, 139.7966, 'Nakamise Shopping Street'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop', 'food'],
      }),
      E('11:00 AM–12:20 PM', 'Asakusa backstreets', 'Hoppy Street standing bars, Hanayashiki exterior (Japan\'s oldest amusement park), quiet lanes behind the temple.', {
        id: 'd13-backstreets', place: P('Hoppy Street', 35.7152, 139.7935, 'Hoppy Street Asakusa'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('12:20 PM', 'Quick lunch snack in Asakusa', 'Stalls around Nakamise before the workshop.', { id: 'd13-snack', tags: ['food'] }),
      S('Zen Craft — chopstick workshop'),
      E('1:00–2:00 PM', '⭐ Zen Craft Chopsticks Workshop', 'CONFIRMED 1:00 PM. ~8-min walk; arrive a few minutes early. Hand-carve hinoki cypress chopsticks, ~1 hr. You keep them.', {
        id: 'd13-zencraft', confirmed: true, place: P('Zen Craft Chopsticks Workshop', 35.7116, 139.7920, 'Zen Craft chopsticks workshop Asakusa'), travel: { mode: 'walk', label: '~8-min walk' }, tags: ['booking'],
      }),
      S('Kappabashi — knife district'),
      E('2:15–4:15 PM', 'Kappabashi kitchenware district', '~10–15 min walk west. Chef knives (Masamoto, Tojiro, Sakai Takayuki), ceramics, lacquerware, food models. ¥8,000–25,000 for a quality gyuto/santoku; test weight and sharpness. Most open 9 AM–5 PM.', {
        id: 'd13-kappabashi', place: P('Kappabashi Kitchen Town', 35.7130, 139.7890, 'Kappabashi Dougu Street'), travel: { mode: 'walk', label: '10–15 min walk' }, tags: ['shop'],
      }),
      S('Okachimachi — gold + jewelry district'),
      E('4:30–5:15 PM', 'Okachimachi jewelry district', '~15-min walk south (or 5-min taxi). Sango (Coral) Street + Ruby Street, east of JR Okachimachi. Gold/diamond wholesalers. Negotiable (open 10–15% below asking); tax-free with passports. Compare 3–4 shops; check karat stamp (18K/750, 24K/999). GALA OKACHIMACHI largest. Open until 6–7 PM. Ask 「金のアクセサリー」 (kin no akusesarī).', {
        id: 'd13-okachimachi', place: P('Okachimachi Jewelry Town', 35.7083, 139.7745, 'Okachimachi jewelry town'), travel: { mode: 'walk', label: '~15-min walk south' }, tags: ['shop'], cost: '¥20,000–100,000+',
      }),
      C('d13-ueno', 'Ueno — pond or straight to market', 'Depends on energy.', [
        { id: 'market', label: 'Hungry/tired → straight to Ameyoko', desc: 'Busy from 5 PM, stalls until 8–9 PM. Akihabara by 7–7:30 PM — early night before DisneySea.', items: [] },
        { id: 'pond', label: 'Energy → Shinobazu Pond loop first', desc: '20-min walk, free. Lotus pond, Benten shrine island, golden hour (sunset ~5:15 PM). Then Ameyoko.',
          items: [E('5:15–5:40 PM', 'Shinobazu Pond loop', 'Lotus pond, Benten shrine on an island, golden hour.', { id: 'd13-pond', optional: true, place: P('Shinobazu Pond', 35.7125, 139.7700, 'Shinobazu Pond Ueno'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'] })] },
      ], { default: 'market' }),
      E('~5:30–6:30 PM', 'Ameyoko — dinner on foot', '5-min walk north. Sashimi, yakitori, oysters, haemul pajeon, dried fruit and nuts. Stalls until 8–9 PM. 500m — graze and loop back.', {
        id: 'd13-ameyoko', place: P('Ameyoko Market', 35.7110, 139.7745, 'Ameyoko Shopping Street'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['food'],
      }),
      S('Akihabara — all four'),
      E('6:30 PM+', 'Akihabara night', 'JR 5 min from Ueno or 20-min walk. Figure shops, Yodobashi Camera gaming floors, maid cafés on Chuo-dori, retro arcades. Kanda Yabu Soba (1880) nearby for a sit-down.', {
        id: 'd13-akiba', place: P('Akihabara Electric Town', 35.6984, 139.7731, 'Akihabara Electric Town'), travel: { mode: 'walk', label: '20-min walk (or JR 5 min)' }, tags: ['shop', 'sight'],
      }),
    ],
  },

  // ───────────────────────────── D14 ─────────────────────────────
  {
    id: 'd14', n: 14, date: '2026-10-29', dow: 'Thu', city: 'Tokyo',
    title: 'Tokyo DisneySea', tagline: 'DisneySea — Fantasy Springs + the harbour',
    energy: 'HIGH', dinner: 'In-park (Mediterranean Harbor at sunset)', hotel: 'washington',
    items: [
      N('Disney Premier Access (DPA)', 'Buy on TDR app the MOMENT you enter (not before). Order: 1 Frozen: A Frozen Journey (sells out fastest) · 2 Peter Pan\'s Never Land Adventure · 3 Rapunzel\'s Lantern Festival · 4 Journey to the Center of the Earth · then Toy Story Mania. Save card in app beforehand. Fantasy Springs standby 120 min+ without DPA. Check app for lottery/premium Halloween shows.', 'book'),
      E('6:30 AM', 'Depart Akihabara → DisneySea', 'JR to Tokyo (4 min) → JR Keiyo Line → Maihama (~18 min) → Disney Resort Line monorail → Tokyo DisneySea Station (~15 min). Gates ~7:10 AM.', { id: 'd14-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('7:30–9:00 AM', 'Queue at gates', '7:30 AM is the sweet spot. Security opens 30–45 min before opening (~8:15–8:30 AM). Plan DPA order on TDR app, payment ready. Park hours Oct 29: 9:00 AM–9:00 PM.', {
        id: 'd14-gates', place: P('Tokyo DisneySea', 35.6267, 139.8851, 'Tokyo DisneySea'), travel: { mode: 'train', label: 'JR Keiyo + Disney Resort Line, ~40 min' }, tags: ['sight'],
      }),
      E('9:00 AM', 'ROPE DROP — buy DPAs', 'Buy DPAs in priority order on TDR app. No photos until Frozen DPA is secured.', { id: 'd14-ropedrop', tags: ['sight'] }),
      S('Fantasy Springs — priority area'),
      N('Rides + priorities', 'FANTASY SPRINGS first: Frozen: A Frozen Journey (DPA first) · Peter Pan\'s Never Land Adventure (DPA/early standby) · Rapunzel\'s Lantern Festival (DPA/standby).\nELSEWHERE: Journey to the Center of the Earth · Toy Story Mania (afternoon) · Soaring: Fantastic Flight · 20,000 Leagues Under the Sea · Big Band Beat (reserve via TDR app at rope drop).\nSUNSET: Mediterranean Harbor 5–6 PM.\nNIGHT: re-rides, Fantasy Springs lit.', 'tip'),
      E('9:00 AM–6:00 PM', 'Full park day', 'Fantasy Springs first, then by DPA times and queues. Lunch in-park (Mediterranean area seafood for M&M). Harbor sunset 5–6 PM.', { id: 'd14-park', tags: ['sight', 'food'] }),
      E('6:00–9:00 PM', 'Evening in park', 'Halloween atmosphere. Re-rides, shows, final wanders.', { id: 'd14-evening', tags: ['sight'] }),
      E('~9:30 PM', 'Park → Akihabara', 'Monorail → Maihama (~10 min) → JR Keiyo Line → Tokyo Station (~18 min) → JR Keihin-Tohoku → Akihabara (5 min). ~35 min; hotel ~10:15 PM.', {
        id: 'd14-return', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'Monorail + JR, ~35 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D15 ─────────────────────────────
  {
    id: 'd15', n: 15, date: '2026-10-30', dow: 'Fri', city: 'Tokyo',
    title: 'Meiji + Harajuku + Shibuya + Shinjuku', tagline: 'West-side sweep — shrine to scramble to Omoide Yokocho',
    energy: 'HIGH', dinner: 'Omoide Yokocho + dinner TBD — Shinjuku group night', hotel: 'washington',
    items: [
      E('9:00 AM', 'Depart hotel → Harajuku', 'JR Chuo-Sobu Akihabara → Shinjuku (~12 min) → JR Yamanote 2 stops → Harajuku (~5 min). ~20 min, ¥210 Suica. One-way sweep: Harajuku → Shibuya → Shinjuku.', { id: 'd15-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('9:15–10:15 AM', 'Meiji Jingu Shrine', 'All four. Cedar forest path (700m each way), inner courtyard, sake barrels. Sunrise to sunset (~5:15 PM Oct). Free.', {
        id: 'd15-meiji', place: P('Meiji Jingu', 35.6764, 139.6993, 'Meiji Jingu Shrine'), travel: { mode: 'train', label: 'JR Chuo-Sobu + Yamanote, ~20 min, ¥210' }, tags: ['sight'],
      }),
      N('Tokyo Toilet — Meiji + Shibuya', 'Jingu-dori, Harajuku Station → Meiji: Jingu-Dori Park on the right — Toyo Ito stainless-steel mushroom toilet, free, 2 min. Shibuya: Nanago Mori Park by Miyashita Park (Marc Newson), same block as Shibuya Parco.', 'tip'),
      E('10:30 AM–1:00 PM', 'Harajuku — Takeshita-dori + Cat Street', 'Takeshita-dori 10:30–11:15 AM: crepes, gachapon, photo booths, 3-floor Daiso (from 10 AM). Cat Street / Ura-Harajuku 11:15 AM–1:00 PM: vintage, indie designers, BAPE, Supreme, sneaker drops. Coffee: Streamer Coffee (Harajuku) or Fuglen (Tomigaya).', {
        id: 'd15-harajuku', place: P('Takeshita Street', 35.6716, 139.7045, 'Takeshita Street Harajuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Cat Street', 35.6670, 139.7060, 'Cat Street Harajuku')],
      }),
      E('1:00 PM', 'Transit to Shibuya', 'JR from Harajuku Station → Shibuya (2 min, ¥160 Suica).', { id: 'd15-to-shibuya', tags: ['transit'] }),
      E('1:05–1:35 PM', 'Quick bite', 'Parco B1 food hall, ramen on Dogenzaka, or near the station. 30 min. About Life Coffee Brewers (Dogenzaka) for espresso.', { id: 'd15-bite', place: P('Shibuya Station', 35.6580, 139.7016), travel: { mode: 'train', label: 'JR, 2 min, ¥160' }, tags: ['food'] }),
      E('1:35–5:00 PM', 'Shibuya explore + shop', '3.5 hrs, no order. Shibuya Parco: Nintendo Tokyo (B1), Pokémon Center (6F), Jump Shop (6F); 11 AM–9 PM, Nintendo/Pokémon close 8 PM. One Piece Mugiwara Store: Shanks straw hat photo (not in Parco — confirm address). Loft / Tokyu Hands: stationery, gifts. Tokyu Food Show (Hikarie basement): wagashi, bento, omiyage.', {
        id: 'd15-shibuya', place: P('Shibuya Parco', 35.6620, 139.6990, 'Shibuya PARCO'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Shibuya Hikarie', 35.6590, 139.7036, 'Shibuya Hikarie')],
      }),
      E('5:00–5:30 PM', 'Hachiko + Shibuya Crossing at dusk', 'Sunset 5:15 PM — screens ignite as it darkens. Cross at the first light change.', {
        id: 'd15-scramble', place: P('Shibuya Scramble Crossing', 35.6595, 139.7005, 'Shibuya Scramble Crossing'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('5:45 PM', 'JR Yamanote Shibuya → Shinjuku', '2 stops, 7 min.', { id: 'd15-to-shinjuku', tags: ['transit'] }),
      E('6:00–6:30 PM', 'Kabukicho neon', 'East Exit: Godzilla head on the TOHO Cinema rooftop, neon towers. Quick loop, photos, then shopping.', {
        id: 'd15-kabukicho', place: P('Kabukicho (Godzilla head)', 35.6950, 139.7021, 'Godzilla Head Shinjuku Toho'), travel: { mode: 'train', label: 'JR Yamanote, 7 min' }, tags: ['sight'],
      }),
      E('6:30–9:00 PM', 'Shinjuku shopping — glasses first', 'JINS at Takashimaya Times Square (2F, same building as GU) or Zoff in Lumine 1. Bring prescription or ~¥3,000 eye exam (~20 min). Single-vision lenses ~45–60 min — order first, then shop. GU: Times Square B2–3F. Lumine 1 + 2 (South Exit, 5 min): Uniqlo, Beams, United Arrows, Ships, DIANA, Odette e Odile. Glasses ready → girls Lumine, guys Animate Shinjuku (East Exit, ~20 min from Lumine). Reconvene 9:00 PM.', {
        id: 'd15-shopping', place: P('Takashimaya Times Square', 35.6876, 139.7024, 'Takashimaya Times Square Shinjuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Lumine 1', 35.6885, 139.6995, 'Lumine Shinjuku 1'), P('Animate Shinjuku', 35.6935, 139.7040, 'Animate Shinjuku')],
      }),
      S('Shinjuku night — Omoide Yokocho + dinner TBD'),
      N('Free Tokyo view', 'Skip Shibuya Sky (¥2,000 + booking). Tokyo Metropolitan Government Building, West Shinjuku: free deck, 202m, Fuji on clear days, open until 10:30 PM (north) / 11 PM (south), no booking.', 'tip'),
      E('Optional', 'Tokyo Metropolitan Government Building deck', 'Free, 202m, no booking. Open until 10:30/11 PM.', {
        id: 'd15-tmg', optional: true, place: P('Tokyo Metropolitan Government Building', 35.6896, 139.6921, 'Tokyo Metropolitan Government Building Observation Deck'), travel: { mode: 'walk', label: '~10-min walk' }, tags: ['sight'],
      }),
      E('9:15 PM', 'Omoide Yokocho (Memory Lane)', '7-min walk, South Exit underground → West Exit. Vibe stop, not dinner: 50+ yakitori stalls under the tracks. 1–2 skewers each (chicken/seafood only). ~30–40 min.', {
        id: 'd15-omoide', place: P('Omoide Yokocho', 35.6930, 139.6996, 'Omoide Yokocho'), travel: { mode: 'walk', label: '7-min walk' }, tags: ['food', 'sight'],
      }),
      E('~10:00 PM', 'Dinner in Shinjuku — TBD', 'All four. East Exit: Gyukatsu Motomura (wagyu cutlet, pork-free), Kabukicho yakiniku, ramen on Shinjuku Higashi-dori. Most need no booking. See Suggestions.', {
        id: 'd15-dinner', tbd: true, place: P('Shinjuku East Exit', 35.6910, 139.7040, 'Shinjuku Station East Exit'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Halloween Eve', 'Costumes out from Oct 30. Shibuya crossing 8–10 PM most atmospheric; Kabukicho for full Halloween energy.'),
    ],
  },

  // ───────────────────────────── D16 ─────────────────────────────
  {
    id: 'd16', n: 16, date: '2026-10-31', dow: 'Sat', city: 'Tokyo',
    title: 'Halloween — Ikebukuro cosplay night', tagline: 'Ikebukuro · Cosplay Festival · halal dinner',
    energy: 'MEDIUM → HIGH', dinner: 'Dinner + Cosplay Festival, Ikebukuro', hotel: 'washington',
    items: [
      N('Morning split', 'Free mornings for both couples — reconvene 5:00–5:30 PM.', 'tip'),
      C('d16-morning', 'Free morning until 3:30 PM', 'No plan. Options:', [
        { id: 'rest', label: 'Sleep in, pack, rest', desc: '', items: [] },
        { id: 'yanaka', label: 'Yanaka Ginza + Nezu Shrine', desc: 'Nippori, 10 min from hotel — old shitamachi, cats, food stalls, machiya backstreets.',
          items: [
            E('Morning', 'Yanaka Ginza', 'Old shitamachi Tokyo, cats, food stalls, machiya backstreets.', { id: 'd16-yanaka', optional: true, place: P('Yanaka Ginza', 35.7277, 139.7653, 'Yanaka Ginza'), travel: { mode: 'train', label: 'JR to Nippori, 10 min' }, tags: ['sight', 'food'] }),
            E('Late morning', 'Nezu Shrine', 'Torii tunnel, one of Tokyo\'s oldest shrines. 15-min walk from Yanaka Ginza.', { id: 'd16-nezu', optional: true, place: P('Nezu Shrine', 35.7196, 139.7645, 'Nezu Shrine'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['sight'] }),
          ] },
        { id: 'omotesando', label: 'Jingumae / Omotesando', desc: 'Revisit Harajuku (D2/D15) or walk the boulevard with coffee.',
          items: [E('Morning', 'Omotesando boulevard + coffee', '', { id: 'd16-omotesando', optional: true, place: P('Omotesando', 35.6652, 139.7120, 'Omotesando Tokyo'), travel: { mode: 'train', label: 'JR + Metro, ~30 min' }, tags: ['shop'] })] },
        { id: 'tsukiji', label: 'Tsukiji Outer Market breakfast / Toyosu Daiwa Sushi', desc: 'Daiwa Sushi at Toyosu tuna omakase (queue from 6:30 AM) or Tsukiji Outer Market stalls.',
          items: [E('Early morning', 'Tsukiji Outer Market', 'Tamagoyaki, oysters, tuna bowl. Or Daiwa Sushi at Toyosu, queue from 6:30 AM.', { id: 'd16-tsukiji', optional: true, place: P('Tsukiji Outer Market', 35.6654, 139.7707), travel: { mode: 'train', label: 'Hibiya Line, ~20 min' }, tags: ['food'] })] },
        { id: 'akiba', label: 'Akihabara — last chance', desc: 'Anything unfinished.', items: [] },
      ], { default: 'rest' }),
      E('3:30 PM', 'Hotel — costumes out', 'Laid out in advance.', { id: 'd16-back', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['hotel'] }),
      E('3:30–5:00 PM', 'Makeup + costumes', '90 min. Local costume detail is high — commit. Done by 5 PM.', { id: 'd16-costume', tags: ['logistics'] }),
      N('Luggage to Narita — tonight by 8 PM', 'Large bags to front desk by 8 PM before going out — Yamato Transport delivers to Narita T1 check-in by morning of Nov 1. ¥1,500–2,000/bag. Skyliner with carry-on only.', 'warn'),
      E('5:00–5:30 PM', 'Regroup with M&M', 'Head out together.', { id: 'd16-meet', tags: ['logistics'] }),
      E('5:30 PM', 'JR Yamanote Akihabara → Ikebukuro', '~20 min, ¥210. First Ikebukuro visit: Sunshine City, Otome Road (female-oriented anime/manga), Animate flagship, big Halloween crowd.', { id: 'd16-train', tags: ['transit'] }),
      E('6:00 PM', 'Ikebukuro — Sunshine 60 Street + Naka-Ikebukuro Park', 'Official stage runs 10 AM–6 PM — tail end. Sunshine 60 Street + Animate Street stay full of cosplayers after close.', {
        id: 'd16-ikebukuro', place: P('Sunshine 60 Street', 35.7300, 139.7150, 'Sunshine 60 Street Ikebukuro'), travel: { mode: 'train', label: 'JR Yamanote, 20 min, ¥210' }, tags: ['sight'], subplaces: [P('Naka-Ikebukuro Park', 35.7300, 139.7170, 'Naka-Ikebukuro Park')],
      }),
      E('7:00–8:30 PM', 'Dinner in Ikebukuro — BOOK NOW', 'Halal Wagyu Shabu Shabu Shoutaian — halal-certified, no pork, no alcohol, tableside wagyu, short walk from Ikebukuro Station. Alternative: Palmyra (Syrian/Lebanese mezze). Book Shoutaian directly: 4 people + halal.', {
        id: 'd16-dinner', tbd: true, place: P('Halal Wagyu Shabu Shabu Shoutaian', 35.7312, 139.7110, 'Halal Wagyu Shabu Shabu Shoutaian Ikebukuro'), travel: { mode: 'walk', label: 'Short walk' }, tags: ['food', 'booking'],
      }),
      E('8:30 PM+', 'Ikebukuro Halloween after dinner', 'Costume streets peak after dark. Otome Road, Don Quijote Ikebukuro (open until 5 AM), Sunshine City exterior, Animate Street.', {
        id: 'd16-night', place: P('Otome Road', 35.7290, 139.7185, 'Otome Road Ikebukuro'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('~11:00 PM', 'JR Yamanote Ikebukuro → Akihabara', '~20 min. Akihabara in costume too on the walk back to the hotel.', {
        id: 'd16-home', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'JR Yamanote, 20 min' }, tags: ['transit', 'hotel'],
      }),
      N('Halloween night alternatives', 'Shibuya street event restricted (public alcohol banned). Alternative: Shibuya crossing 8–10 PM, Kabukicho 10 PM–midnight. Trains to Akihabara until ~1 AM. Club events / bar crawls in Shinjuku, Roppongi.'),
    ],
  },

  // ───────────────────────────── D17 ─────────────────────────────
  {
    id: 'd17', n: 17, date: '2026-11-01', dow: 'Sun', city: 'Tokyo',
    title: 'Final morning + flight', tagline: 'Last bites + Narita farewell',
    energy: 'LOW', dinner: 'Airport', hotel: 'washington',
    items: [
      E('9:00–9:30 AM', 'Konbini breakfast', 'Quick and done.', { id: 'd17-bfast', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['food'] }),
      E('9:30–11:00 AM', 'Free time — last shopping, packing', 'Checkout 11 AM.', { id: 'd17-free', tags: ['shop'] }),
      E('11:00 AM', 'Check out — bags with concierge', 'Lobby until 1:30 PM: last Akihabara wander, coffee, sort purchases into carry-ons.', { id: 'd17-checkout', tags: ['hotel'] }),
      E('~1:30 PM', 'Group assembles in lobby', 'Collect bags, final sort into carry-ons.', { id: 'd17-lobby', tags: ['logistics'] }),
      E('~1:45 PM', 'Leave for Narita', 'JR Akihabara → Ueno (5 min), Keisei Skyliner → Narita T1 (36 min, ¥2,520). 4+ hrs before NASA\'s 6:15 PM flight, ~2.5 hrs before M&M\'s.', {
        id: 'd17-ueno', place: P('Keisei Ueno Station', 35.7126, 139.7741, 'Keisei Ueno Station'), travel: { mode: 'train', label: 'JR, 5 min' }, tags: ['transit'],
      }),
      E('~2:25 PM', 'Arrive Narita Terminal 1', '', {
        id: 'd17-narita', place: P('Narita Airport Terminal 1', 35.7654, 140.3860, 'Narita Airport Terminal 1'), travel: { mode: 'train', label: 'Keisei Skyliner, 36 min, ¥2,520' }, tags: ['flight'],
      }),
      E('2:25–5:15 PM', 'Check in · security · immigration · lounge', 'Eat in the lounge. Duty Free: Royce chocolate, matcha Kit Kats, Japanese whisky. Keep ¥10,000 cash for Duty Free.', { id: 'd17-airport', tags: ['food', 'shop'] }),
      E('~5:15 PM', 'M&M depart', 'Farewell before their gate.', { id: 'd17-mm', who: 'mm', tags: ['flight'] }),
      E('5:30–6:00 PM', 'Gate', 'Boarding call ~30 min before departure.', { id: 'd17-gate', who: 'nasa', tags: ['flight'] }),
      E('6:15 PM', 'NASA depart', 'Sayonara.', { id: 'd17-depart', who: 'nasa', tags: ['flight'] }),
      N('Suica', 'Return at ticket machines for the ¥500 deposit, or keep it — works on your next trip.', 'tip'),
    ],
  },
];
