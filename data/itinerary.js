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
    mm: { label: 'M&M — Mariam + M', short: 'M&M' },
  },
};

export const HOTELS = [
  { id: 'sotetsu', name: 'Sotetsu Grand Fresa Takadanobaba', city: 'Tokyo', dates: 'Oct 16–20', nights: 4, lat: 35.7127, lng: 139.7040, q: 'Sotetsu Grand Fresa Takadanobaba' },
  { id: 'mizunoto', name: 'Mizunoto Hakone', city: 'Hakone', dates: 'Oct 20–21', nights: 1, lat: 35.2048, lng: 139.0287, q: 'Hotel Mizunoto Hakone Moto-Hakone' },
  { id: 'granbell', name: 'Kyoto Granbell Hotel (Gion-Shijo)', city: 'Kyoto', dates: 'Oct 21–27', nights: 6, lat: 35.0036, lng: 135.7711, q: 'Kyoto Granbell Hotel' },
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
    title: 'Arrival in Tokyo', tagline: 'Arrival — Tokyo first steps',
    energy: 'LOW', dinner: 'Easy near hotel', hotel: 'sotetsu',
    items: [
      E('4:10 PM', 'Land at Narita', 'Welcome to Japan.', {
        id: 'd01-land', place: P('Narita Airport Terminal 1', 35.7654, 140.3860, 'Narita Airport Terminal 1'), tags: ['flight'],
      }),
      E('4:10–5:45 PM', 'Immigration, luggage, essentials', 'Suica top-up ¥5,000 at 7-Bank ATM, eSIM activation, cash withdrawal. Friday afternoon arrivals can take 60–90 min through immigration — if it runs long, the 6:30 or 7:00 PM Skyliner works fine too. Still at the hotel by 8:30 PM.', { id: 'd01-arrive', tags: ['logistics'] }),
      E('6:00–7:45 PM', 'Keisei Skyliner → Nippori → Yamanote', 'Skyliner to Nippori (36 min, ¥2,520), then JR Yamanote toward Shinjuku / Takadanobaba.', {
        id: 'd01-skyliner', place: P('Nippori Station', 35.7281, 139.7709), travel: { mode: 'train', label: 'Keisei Skyliner, 36 min, ¥2,520' }, tags: ['transit'],
      }),
      E('8:00–9:00 PM', 'Check in and refresh', 'Sotetsu Grand Fresa Takadanobaba — home for the first 4 nights.', {
        id: 'd01-checkin', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'train', label: 'JR Yamanote, ~15 min' }, tags: ['hotel'],
      }),
      E('9:00–10:15 PM', 'Easy dinner beside hotel', 'Ramen, conveyor sushi, or the nearest izakaya.', { id: 'd01-dinner', tags: ['food'] }),
      N('First evening in Tokyo', 'Arrival evening — low-key first night. Walk Waseda-dori for ramen (Ichiran is on the main street). Shinjuku is 10 min if you want a preview of Tokyo\'s neon — Omoide Yokocho for chicken/seafood skewers, Kabukicho wander. No pressure — Kawagoe festival starts early tomorrow.'),
    ],
  },

  // ───────────────────────────── D02 ─────────────────────────────
  {
    id: 'd02', n: 2, date: '2026-10-17', dow: 'Sat', city: 'Tokyo',
    title: 'Tokyo morning + Kawagoe Matsuri', tagline: 'Little Edo — Kawagoe Matsuri',
    energy: 'MEDIUM', dinner: 'Festival street food + Kawagoe izakaya', hotel: 'sotetsu',
    items: [
      S('Takadanobaba hotel — morning'),
      E('8:30–9:00 AM', 'Konbini breakfast', 'Grab on the way out.', { id: 'd02-bfast', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['food'] }),
      C('d02-morning', 'D2 morning — choose on the day', 'Decide on the day based on energy.', [
        { id: 'calm', label: 'Calm start — Shinjuku Gyoen', desc: 'JR to Shinjuku 5 min + 10-min walk to the gate. Garden 9:15–10:45 AM, then Harajuku ~11:05 AM. Opens 9 AM, closed Mon, ¥500.',
          items: [E('9:15–10:45 AM', 'Shinjuku Gyoen', 'Calm garden start. ¥500, opens 9 AM.', { id: 'd02-gyoen', place: P('Shinjuku Gyoen (Shinjuku Gate)', 35.6877, 139.7101, 'Shinjuku Gyoen National Garden'), travel: { mode: 'train', label: 'JR Yamanote to Shinjuku + 10-min walk' }, tags: ['sight'] })] },
        { id: 'sleep', label: 'Sleep in — straight to Harajuku', desc: 'Skip the park, leave hotel 9:30–10:00 AM, JR straight to Harajuku, arrive 10:00–10:30 AM. Some Takeshita shops open from 10 AM, most by 11 AM.', items: [] },
        { id: 'energized', label: 'Energized — quick Gyoen then Harajuku', desc: 'Quick 45–60 min in Shinjuku Gyoen (arrive 9:15, leave 10:15), travel to Harajuku, arrive 10:30–10:40 AM as shops come alive.',
          items: [E('9:15–10:15 AM', 'Shinjuku Gyoen (quick loop)', '45–60 min in the garden. ¥500.', { id: 'd02-gyoen-quick', place: P('Shinjuku Gyoen (Shinjuku Gate)', 35.6877, 139.7101, 'Shinjuku Gyoen National Garden'), travel: { mode: 'train', label: 'JR Yamanote to Shinjuku + 10-min walk' }, tags: ['sight'] })] },
      ], { default: 'calm' }),
      E('10:30–11:05 AM', 'Travel to Harajuku', 'JR Yamanote from Shinjuku 2 stops south (5 min). Timing depends on which morning option you chose.', { id: 'd02-to-harajuku', tags: ['transit'] }),
      E('10:30 AM–12:50 PM', 'Harajuku scout', 'Browse at your own pace: the crepe shops, the streetwear, the costume culture. Then walk down to Omotesando for a coffee — the zelkova-lined boulevard is a completely different energy. You\'re back here with friends on D15, so this is a preview run: find what\'s worth it, make any purchases without slowing anyone down later. Leave by 12:50 PM.', {
        id: 'd02-harajuku', place: P('Takeshita Street, Harajuku', 35.6716, 139.7045, 'Takeshita Street Harajuku'), travel: { mode: 'train', label: 'JR Yamanote, 5 min' }, tags: ['shop'],
      }),
      E('Spare 20 min', 'Tokyo Toilet — Yoyogi-Fukamachi Mini Park', 'The Shigeru Ban transparent toilet is a 10-min walk south from Harajuku Station into the Yoyogi residential streets. Glass walls go completely frosted the moment you lock the door — glows as a coloured cube at night. The most photographed of the 17 designer public toilets built for the 2020 Olympics. Free.', {
        id: 'd02-toilet', optional: true, place: P('Yoyogi-Fukamachi Mini Park', 35.6690, 139.6937, 'Yoyogi Fukamachi Mini Park toilet'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('~1:00 PM', 'JR Yamanote north to Takadanobaba → bag drop', '~12 min, ¥170. Bell desk bag drop (1:20–1:25 PM). Straight to the Seibu platform.', {
        id: 'd02-bagdrop', place: P('Takadanobaba Station', 35.7127, 139.7040), travel: { mode: 'train', label: 'JR Yamanote, 12 min, ¥170' }, tags: ['transit'],
      }),
      E('~1:25–2:15 PM', 'Seibu Shinjuku Line → Hon-Kawagoe', '~50 min, ¥530. The hotel is directly on this line — board right from the doorstep.', {
        id: 'd02-seibu', place: P('Hon-Kawagoe Station', 35.9151, 139.4821), travel: { mode: 'train', label: 'Seibu Shinjuku Line, 50 min, ¥530' }, tags: ['transit'],
      }),
      S('Kawagoe — afternoon sights'),
      E('2:25–3:00 PM', 'Kashiya Yokocho (Candy Alley)', 'First stop heading north from the station; traditional sweet shops selling Edo-period candy. Stock up on snacks for the afternoon.', {
        id: 'd02-candy', place: P('Kashiya Yokocho (Candy Alley)', 35.9218, 139.4821, 'Kashiya Yokocho Kawagoe'), travel: { mode: 'walk', label: '10-min walk through the festival approach' }, tags: ['food', 'sight'],
      }),
      E('3:00–3:15 PM', 'Kurazukuri Street + Toki no Kane', 'Walk north through Kurazukuri Street and past Toki no Kane bell tower — 15 min. The warehouse district and bell tower are right on the route. Kurazukuri will look very different in 2 hours when the festival floats fill the street — this walk gives you a quiet first look.', {
        id: 'd02-kurazukuri', place: P('Toki no Kane (Kurazukuri Street)', 35.9237, 139.4855, 'Toki no Kane Kawagoe'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['sight'],
      }),
      E('3:15–4:30 PM', 'Kawagoe Hikawa Shrine', '200m lantern-lit corridor, 1,500-year-old shrine grounds, enmusubi prayer boards and ritual windchimes. Closes at 4:30 PM — arrive by 3:15 PM for the full experience.', {
        id: 'd02-hikawa', place: P('Kawagoe Hikawa Shrine', 35.9295, 139.4870), travel: { mode: 'walk', label: '10-min walk north' }, tags: ['sight'],
      }),
      E('4:30 PM', 'Head south to the festival zone', '10-min walk from Hikawa to Renjakucho/Kurazukuri. Arrive ~4:45 PM; find a spot, grab an early stall snack, feel the energy building.', {
        id: 'd02-festzone', place: P('Kurazukuri festival zone', 35.9240, 139.4850, 'Kurazukuri Street Kawagoe'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      S('Kawagoe Matsuri — evening festival'),
      E('5:10–7:00 PM', 'Food stalls, illuminated floats', 'Floats building in energy as the light goes.', { id: 'd02-stalls', tags: ['food', 'sight'] }),
      E('7:00–8:30 PM', 'Hikkawase — the main event', 'Two ornate yamatai floats manoeuvre face-to-face at an intersection, musicians battling from the platforms below. This plays out simultaneously at every major intersection across the city — walk a 10-minute loop and catch 3 or 4 different confrontations in quick succession. The energy peaks between 8 and 9 PM. Leave at 8:30 and you\'ve seen the full cycle.', { id: 'd02-hikkawase', tags: ['sight'] }),
      E('~8:30 PM', 'Return to Tokyo', 'Seibu Shinjuku Line from Hon-Kawagoe → Takadanobaba (~50 min, ¥530). Trains run frequently after the festival winds down; board from the same station you arrived at.', {
        id: 'd02-return', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'train', label: 'Seibu Shinjuku Line, 50 min, ¥530' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D03 ─────────────────────────────
  {
    id: 'd03', n: 3, date: '2026-10-18', dow: 'Sun', city: 'Tokyo',
    title: 'Cousin day trip — Mt. Fuji or Nikko (rental car) + omakase', tagline: 'Fuji chase with Nehla & Ghalib · 8:30 PM omakase',
    energy: 'HIGH', dinner: 'CONFIRMED: Sushi Yoshikawa Kaido Shinjuku 8:30 PM', hotel: 'sotetsu',
    items: [
      N('Night-before decision — Fuji vs Nikko', 'Tonight (Oct 17, by 10 PM): check fujisan-webcam.net for live Fuji summit cameras. Summit clearly visible → Option A (Fuji). Completely socked in → Option B (Nikko).\n\nHard constraint: you MUST be back in Shinjuku by 7:30 PM for the 8:30 PM omakase. Target arrival is 6:30–7:00 PM, which means departing the destination by ~4:30 PM (Fuji) or ~4:00 PM (Nikko).\n\nCousins Nehla & Ghalib are booking and driving the rental car — confirm departure time and Shinjuku meetup point with them the night before. Both destinations are ~2–2.5 hrs from Shinjuku by car.', 'decide', { link: { label: 'Fuji live webcams', url: 'https://fujisan-webcam.net' } }),
      N('Book ahead — Omakase', 'Oct 18, 8:30 PM: CONFIRMED at Sushi Yoshikawa Kaido Shinjuku, 7-19-7 Nishi-Shinjuku. 19-course omakase, ¥14,300/person. Arrive by 8:20 PM. No further action needed.', 'book'),
      C('d03-trip', 'Fuji or Nikko?', 'Pick the night before based on the Fuji webcams.', [
        { id: 'fuji', label: 'Option A — Fuji visible: Kawaguchiko + Chureito + 5th Station', desc: 'Summit clearly visible on the webcams.',
          items: [
            E('~6:30 AM', 'Meet cousins in Shinjuku — depart by car', 'Toward Kawaguchiko (~2 hrs via Chuo Expressway, Fujiyoshida IC exit).', { id: 'd03a-depart', place: P('Shinjuku Station (meetup)', 35.6896, 139.7005, 'Shinjuku Station'), tags: ['transit'] }),
            E('9:00–10:00 AM', 'Chureito Pagoda', 'Short drive to Fujiyoshida, then 398 stone steps up through cedar forest. Iconic Fuji-framed-by-pagoda view, best in morning light. Worth every step.', { id: 'd03a-chureito', place: P('Chureito Pagoda', 35.5016, 138.8011), travel: { mode: 'drive', label: '~2 hrs via Chuo Expressway' }, tags: ['sight'] }),
            E('10:15 AM–12:00 PM', 'Kawaguchiko lake — Oishi Park', 'Oishi Park on the north shore gives the best Fuji-over-water reflection shots. Drive the lakeside road, stop freely. Kachi Kachi Ropeway optional (views from above the lake, ¥900).', { id: 'd03a-oishi', place: P('Oishi Park, Kawaguchiko', 35.5252, 138.7420, 'Oishi Park Kawaguchiko'), travel: { mode: 'drive', label: '~20 min' }, tags: ['sight'] }),
            E('12:00–1:00 PM', 'Lunch in Kawaguchiko — hoto noodles', 'Local flat noodle hot pot, ¥1,200; pork-free versions available. Multiple spots near the lake and station.', { id: 'd03a-lunch', place: P('Kawaguchiko Station area', 35.4986, 138.7686, 'Kawaguchiko Station'), travel: { mode: 'drive', label: '~15 min' }, tags: ['food'] }),
            E('~1:15 PM', 'Fuji 5th Station', 'Drive up via Fuji Subaru Line road (~40 min by car to 2,300m). Looking up at the crater rim from this altitude is a completely different experience from the lake views. Walk the Ochudo trail (flat 20-min loop), Komitake Shrine, Fuji gifts.', { id: 'd03a-5th', place: P('Fuji Subaru Line 5th Station', 35.3954, 138.7332, 'Fuji Subaru Line 5th Station'), travel: { mode: 'drive', label: '~40 min via Fuji Subaru Line' }, tags: ['sight'] }),
            E('2:30–4:15 PM', 'More time at the lake or 5th Station', 'Use the extra afternoon. Kachi Kachi Ropeway (¥900) if you skipped it earlier, another lakeside loop, or just sit and take in Fuji. This is the day — milk it.', { id: 'd03a-extra', optional: true, place: P('Kachi Kachi Ropeway', 35.5089, 138.7649, 'Mt. Fuji Panoramic Ropeway Kawaguchiko'), travel: { mode: 'drive', label: '~40 min back down' }, tags: ['sight'] }),
            E('~4:30 PM', 'Drive back to Shinjuku', '~2 hrs via Chuo Expressway. Target arrival Shinjuku 6:30–7:00 PM.', { id: 'd03a-back', place: P('Shinjuku Station', 35.6896, 139.7005), travel: { mode: 'drive', label: '~2 hrs via Chuo Expressway' }, tags: ['transit'] }),
          ] },
        { id: 'nikko', label: 'Option B — Fuji cloudy: Nikko by car', desc: 'Summit socked in on the webcams.',
          items: [
            E('~6:30 AM', 'Meet cousins — depart by car toward Nikko', '~2.5 hrs via Tohoku Expressway, Nikko IC exit.', { id: 'd03b-depart', place: P('Shinjuku Station (meetup)', 35.6896, 139.7005, 'Shinjuku Station'), tags: ['transit'] }),
            E('9:30 AM–12:00 PM', 'Toshogu Shrine complex', 'Tokugawa Ieyasu\'s mausoleum. Architecturally unlike anything in Kyoto: gilded, densely carved, almost baroque in its excess. The Yomeimon Gate alone takes 20 min to absorb. Three wise monkeys carving, the sleeping cat, the inner cedar forest. ¥1,300.', { id: 'd03b-toshogu', place: P('Nikko Toshogu', 36.7580, 139.5988), travel: { mode: 'drive', label: '~2.5 hrs via Tohoku Expressway' }, tags: ['sight'] }),
            E('12:00–12:45 PM', 'Lunch near Nikko town', 'Yuba (tofu skin, the local speciality) appears in most set meals, pork-free by nature.', { id: 'd03b-lunch', tags: ['food'] }),
            E('~1:00 PM', 'Switchback road up to Lake Chuzenji', '~20 min, 28 hairpin turns — dramatic climb (Irohazaka).', { id: 'd03b-iroha', tags: ['transit'] }),
            E('1:30–3:30 PM', 'Kegon Falls + Lake Chuzenji', '97m waterfall, elevator to base (¥570) puts you face-to-face with the full drop. Lakeside walk at 1,269m — mid-October may show early autumn colour. Extra time: boat on Lake Chuzenji (~30 min, ¥1,200) or simply sit by the lake.', { id: 'd03b-kegon', place: P('Kegon Falls', 36.7390, 139.5020, 'Kegon Falls Nikko'), travel: { mode: 'drive', label: '~20 min, Irohazaka switchbacks' }, tags: ['sight'] }),
            E('~4:00 PM', 'Drive back to Shinjuku', '~2.5 hrs via Nikko IC → Tohoku Expressway. Target arrival 6:30–7:00 PM.', { id: 'd03b-back', place: P('Shinjuku Station', 35.6896, 139.7005), travel: { mode: 'drive', label: '~2.5 hrs' }, tags: ['transit'] }),
          ] },
      ], { default: 'fuji' }),
      S('Both options — evening'),
      E('6:30–7:00 PM', 'Arrive back in Shinjuku', 'Cousins drop you near the hotel. Both options land within the same window at this pace.', { id: 'd03-arrive', tags: ['transit'] }),
      E('7:00–7:45 PM', 'Back at hotel — shower, change', 'Smart casual for the omakase counter. 45 min is enough.', { id: 'd03-hotel', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), travel: { mode: 'drive', label: 'Drop-off near hotel' }, tags: ['hotel'] }),
      E('8:00 PM', 'Depart for restaurant', 'JR Yamanote 2 stops south to Shinjuku (5 min), then 10-min walk to Nishi-Shinjuku; or taxi from hotel (~¥700, 5 min direct). Arrive by 8:20 PM.', { id: 'd03-depart-dinner', tags: ['transit'] }),
      E('8:30–10:30 PM', 'Sushi Yoshikawa Kaido Shinjuku — omakase', 'CONFIRMED 8:30 PM seating. 19-course Edomae omakase, ¥14,300/person. 16 counter seats, chef-guided pacing. Budget ~2 hours. Address: 7-19-7 Nishi-Shinjuku, Sun Rose Shinjuku 101. From Shinjuku Station West Exit: 10-min walk. Mention no-pork requirement and no alcohol at check-in if not already noted on the reservation.', {
        id: 'd03-omakase', confirmed: true, place: P('Sushi Yoshikawa Kaido Shinjuku', 35.6957, 139.6978, 'Sushi Yoshikawa Kaido Shinjuku 7-19-7 Nishi-Shinjuku'), travel: { mode: 'taxi', label: 'Taxi ~¥700, 5 min (or JR + 10-min walk)' }, tags: ['food', 'booking'], cost: '¥14,300/person',
      }),
    ],
  },

  // ───────────────────────────── D04 ─────────────────────────────
  {
    id: 'd04', n: 4, date: '2026-10-19', dow: 'Mon', city: 'Tokyo',
    title: 'Tsukiji + Ginza + Shimokitazawa + Shinjuku', tagline: 'Market morning · full Ginza shopping day · vintage evening',
    energy: 'MEDIUM', dinner: 'Dinner in Shinjuku — early night, ship luggage to Kyoto tonight', hotel: 'sotetsu',
    items: [
      E('8:30 AM', 'Depart hotel', 'JR Yamanote south to Shinjuku (5 min) → Marunouchi Line to Ginza (12 min) → 10-min walk to Tsukiji Outer Market. Arrive ~9:00 AM.', { id: 'd04-depart', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['transit'] }),
      E('9:00–10:30 AM', 'Tsukiji Outer Market food crawl', 'Marutake tamagoyaki (¥400, hot off the pan), Tsukiji Tama Sushi nigiri, freshly shucked oysters, tuna don. Budget ¥3,000–4,000/person. Go hungry.', {
        id: 'd04-tsukiji', place: P('Tsukiji Outer Market', 35.6654, 139.7707), travel: { mode: 'transit', label: 'JR + Marunouchi Line + 10-min walk, ~30 min' }, tags: ['food'], cost: '¥3,000–4,000/person',
      }),
      E('10:30 AM', 'Walk to Ginza', '12-min walk north from Tsukiji, or 1 stop Hibiya Line. Arrive ~10:45 AM.', { id: 'd04-to-ginza', tags: ['transit'] }),
      S('Ginza — full shopping block'),
      E('10:45 AM–2:30 PM', 'Ginza shopping block (3.5 hours, no fixed order)', 'Onitsuka Tiger Ginza — Japan-exclusive colourways, full range in-store, opens 11 AM; the Ginza flagship has the best size availability.\nUniqlo Ginza flagship — 12 floors, opens 11 AM.\nItoya Ginza — 12-floor Japanese stationery. Washi tape, calligraphy notebooks — 15 min is enough.\nBrand Off Ginza — 3rd floor dedicated entirely to Hermès: Birkin, Kelly, Constance.\nKomehyo Ginza — flagship, ~4,000 luxury items. Bags (Chanel, LV, Goyard) AND a full watch floor (Rolex, Patek, AP, Cartier).\nCasanova Vintage Ginza — curated LV, Goyard totes, Chanel Flaps. 5-min walk from Komehyo.\n\nAll clustered in the Ginza 6–7 chome area. Grab lunch from Ginza Six basement (B2) mid-block — no need to sit down for a meal.', {
        id: 'd04-ginza', place: P('Ginza Six', 35.6697, 139.7640, 'Ginza Six'), travel: { mode: 'walk', label: '12-min walk north' }, tags: ['shop', 'food'],
        subplaces: [
          P('Onitsuka Tiger Ginza', 35.6716, 139.7645), P('Uniqlo Ginza', 35.6718, 139.7654, 'UNIQLO Ginza'), P('Itoya Ginza', 35.6725, 139.7671, 'Itoya Ginza'),
          P('Brand Off Ginza', 35.6703, 139.7636, 'Brand Off Ginza'), P('Komehyo Ginza', 35.6700, 139.7632, 'KOMEHYO Ginza'), P('Casanova Vintage Ginza', 35.6708, 139.7625, 'Casanova Vintage Ginza'),
        ],
      }),
      E('~2:45 PM', 'Ginza → Shimokitazawa', 'Ginza Line to Shibuya (12 min) → Keio Inokashira Line to Shimokitazawa (10 min). Arrive ~3:10 PM.', { id: 'd04-to-shimokita', tags: ['transit'] }),
      S('Shimokitazawa — streetwear'),
      E('3:15–5:30 PM', 'Shimokitazawa streetwear', '~2 hours, focused on jackets and tops. Flamingo Shimokitazawa (vintage Japanese and American outerwear, strong on denim and bomber jackets), New York Joe Exchange (curated pieces, tops and knitwear), Merlot (eclectic mix). The neighbourhood is genuinely unlike anywhere else in Tokyo — grab a coffee and drift between shops. Most open until 8 PM. Bear Pond Espresso is here too (cash only, no phones, queue before opening).', {
        id: 'd04-shimokita', place: P('Shimokitazawa Station', 35.6613, 139.6680), travel: { mode: 'transit', label: 'Ginza Line + Keio Inokashira, ~25 min' }, tags: ['shop'],
      }),
      E('~5:45 PM', 'Shimokitazawa → Shinjuku', 'Keio Inokashira Line back to Shinjuku (15 min). Arrive ~6:00 PM.', { id: 'd04-to-shinjuku', tags: ['transit'] }),
      S('Shinjuku — dinner + optional watches'),
      E('Before dinner', 'Watches in Shinjuku — optional', 'Komehyo Ginza\'s watch floor covers the main bases (Rolex, Patek, AP, Cartier). If you still want a Rolex price comparison, Jackroad Shinjuku (closes 7:30–8 PM) and Daikokuya Shinjuku are a 5-min walk from Shinjuku Station — squeeze it in before dinner if you have the energy. If you\'re done, skip it entirely.', {
        id: 'd04-watches', optional: true, place: P('Jackroad Shinjuku', 35.6946, 139.7004, 'Jackroad Shinjuku'), travel: { mode: 'transit', label: 'Keio Inokashira, 15 min' }, tags: ['shop'],
      }),
      E('6:00–7:30 PM', 'Dinner in Shinjuku', 'Takashimaya Times Square area or the ramen/izakaya streets around the East Exit. Easy walk from here back to Takadanobaba (2 stops JR). Eat well — Hakone early start tomorrow.', {
        id: 'd04-dinner', place: P('Takashimaya Times Square', 35.6876, 139.7024, 'Takashimaya Times Square Shinjuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Luggage shipping tonight — action required', 'TONIGHT (Oct 19) — ship main luggage to Kyoto Granbell via takuhaibin before you sleep. Ask the hotel front desk to arrange a collection: bags picked up tonight, arrive Kyoto Granbell Oct 21 (the day you check in). You\'ll travel to Hakone tomorrow with carry-ons only. Pack an overnight bag tonight: 1–2 nights of clothes, toiletries, cameras. Everything else goes in the shipped bags.', 'warn'),
      N('Free evening — pack for Hakone', 'Last night in Tokyo before Hakone. Dinner in Shinjuku (Takashimaya Times Square area) or local ramen near hotel.'),
    ],
  },

  // ───────────────────────────── D05 ─────────────────────────────
  {
    id: 'd05', n: 5, date: '2026-10-20', dow: 'Tue', city: 'Hakone',
    title: 'Shinjuku → Hakone Open Air Museum + Owakudani + Mizunoto', tagline: 'Ryokan day — volcanic valley + onsen',
    energy: 'MEDIUM', dinner: 'Kaiseki at Mizunoto (included)', hotel: 'mizunoto',
    items: [
      N('Traveling light today', 'Luggage already shipped last night (Oct 19) — today you\'re traveling with carry-ons only. No large bags on the Romancecar or mountain trains.', 'tip'),
      S('Takadanobaba → Shinjuku → Hakone — recommended route'),
      E('~6:50 AM', 'Check out — Sotetsu Grand Fresa', 'Carry-ons only.', { id: 'd05-checkout', place: P('Sotetsu Grand Fresa Takadanobaba', 35.7127, 139.7040), tags: ['hotel'] }),
      E('~7:00 AM', 'To Shinjuku — buy Hakone Free Pass', 'Walk or 1 stop JR Yamanote to Shinjuku Station (~8 min). Buy Hakone Free Pass at Odakyu counter inside Shinjuku (opens 7 AM) — ¥6,100/person, covers basic fare + all Hakone transport today.', {
        id: 'd05-freepass', place: P('Odakyu Shinjuku Station', 35.6900, 139.7000, 'Odakyu Shinjuku Station'), travel: { mode: 'train', label: 'JR Yamanote, 1 stop' }, tags: ['transit'], cost: '¥6,100/person',
      }),
      E('7:37 AM', 'Odakyu Romancecar Hakone 41 → Hakone-Yumoto', 'CONFIRMED. Departs Shinjuku 7:37, arrives Hakone-Yumoto 9:22 AM. Car 1, right-side seats (C/D). Mt. Fuji may be visible on the right as you clear the city.', {
        id: 'd05-romancecar', confirmed: true, place: P('Hakone-Yumoto Station', 35.2322, 139.1057), travel: { mode: 'train', label: 'Romancecar Hakone 41, 1h45' }, tags: ['transit', 'booking'],
      }),
      E('9:22 AM', 'Switch to Hakone Tozan mountain railway', 'Tozan railway up to Chokoku-no-Mori.', { id: 'd05-tozan', tags: ['transit'] }),
      E('9:45–10:45 AM', 'Hakone Open Air Museum', 'Outdoor sculpture park against mountain scenery, Picasso pavilion. One of Japan\'s best museums. ¥1,600 (covered? no — pay entry). Open 9 AM–5 PM. Chokoku-no-Mori station.', {
        id: 'd05-openair', place: P('Hakone Open-Air Museum', 35.2447, 139.0510, 'Hakone Open-Air Museum'), travel: { mode: 'train', label: 'Hakone Tozan Railway, ~35 min' }, tags: ['sight'], cost: '¥1,600',
      }),
      E('10:45 AM', 'Tozan → Gora → cable car → Sounzan → Hakone Ropeway', 'Continue up the mountain.', { id: 'd05-cablecar', tags: ['transit'] }),
      E('11:30 AM–12:15 PM', 'Owakudani volcanic valley', 'Sulphur vents, dramatic grey landscape, kuro tamago black eggs (¥150 each — grab a couple before you leave, eat them here or on the ropeway). Fuji visible on clear days. Ropeway 9 AM–4:45 PM.', {
        id: 'd05-owakudani', place: P('Owakudani', 35.2435, 139.0195, 'Owakudani Hakone'), travel: { mode: 'ropeway', label: 'Tozan + cable car + ropeway' }, tags: ['sight', 'food'],
      }),
      E('12:15 PM', 'Ropeway down to Togendai', '~25 min. At Togendai pier, grab kombini onigiri or snacks if you want more — eat on the ferry crossing.', {
        id: 'd05-togendai', place: P('Togendai Pier', 35.2376, 138.9946, 'Togendai Port Hakone'), travel: { mode: 'ropeway', label: 'Hakone Ropeway, 25 min' }, tags: ['transit'],
      }),
      E('~12:45 PM', 'Hakone Sightseeing Cruise → Hakone-machi', '~35 min, ~¥1,200 (covered by Free Pass). Lake crossing with Fuji views from the water. Arrive pier ~1:20 PM.', {
        id: 'd05-cruise', place: P('Hakone-machi Pier', 35.1900, 139.0245, 'Hakonemachi-ko Port'), travel: { mode: 'boat', label: 'Sightseeing cruise, 35 min' }, tags: ['transit', 'sight'],
      }),
      E('~1:25–2:00 PM', 'Hakone Shrine + lakeside torii', '5-min walk from the pier. Red torii gate rising from the lake, cedar-lined approach to the inner shrine. Grounds open 24 hrs; inner shrine 8:30 AM–5 PM. Free. 35 min is plenty.', {
        id: 'd05-shrine', place: P('Hakone Shrine', 35.2047, 139.0254, 'Hakone Shrine'), travel: { mode: 'walk', label: '~20-min lakeside walk from Hakone-machi (or ride one more stop to Moto-Hakone pier, 5 min from the shrine)' }, tags: ['sight'],
      }),
      E('~2:05 PM', 'Walk or 5-min taxi to Mizunoto', 'Check in ~2:15–2:30 PM.', {
        id: 'd05-mizunoto', place: P('Mizunoto Hakone', 35.2048, 139.0287, 'Hotel Mizunoto Hakone'), travel: { mode: 'walk', label: 'Walk or 5-min taxi' }, tags: ['hotel'],
      }),
      N('Note', 'Owakudani ropeway occasionally closes briefly for volcanic monitoring. Hakone Tozan Bus bypass exists as an alternative. Open Air Museum is only practical on the Romancecar/Tozan route.', 'warn'),
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
    title: 'Mizunoto checkout → Kyoto arrival', tagline: 'Shinkansen day — Hakone farewell to Gion',
    energy: 'LOW', dinner: 'NASA: explore Gion + date dinner (TBD) · M&M arrive evening', hotel: 'granbell',
    items: [
      E('7:30–9:00 AM', 'Japanese breakfast at ryokan', '', { id: 'd06-bfast', place: P('Mizunoto Hakone', 35.2048, 139.0287, 'Hotel Mizunoto Hakone'), tags: ['food'] }),
      E('9:00–10:45 AM', 'Final onsen, slow room time, packing', '', { id: 'd06-onsen', tags: ['hotel'] }),
      E('11:00 AM', 'Check out — taxi to Odawara', 'Ask the ryokan front desk to call a taxi to Odawara Station (book it the night before). Carry-ons only (main luggage is already in Kyoto).', { id: 'd06-checkout', tags: ['hotel'] }),
      N('Hakone → Odawara — taxi', 'There is no Shinkansen at Hakone — the resort is deep in the mountains and Odawara is the nearest bullet train stop, ~12 km away by road. Taxi is the best option: door-to-door in ~19 min, no transfers, easy with carry-on bags. ¥5,000–7,000 total (~¥2,500–3,500/person for 2).\n\nNozomi Shinkansen does NOT stop at Odawara. Use Hikari only.', 'tip'),
      E('11:00–11:20 AM', 'Taxi Mizunoto → Odawara Station', '~19 min, ¥5,000–7,000 for the two of you.', {
        id: 'd06-taxi', place: P('Odawara Station', 35.2563, 139.1553), travel: { mode: 'taxi', label: 'Taxi, ~19 min, ¥5,000–7,000' }, tags: ['transit'],
      }),
      E('11:20–11:50 AM', 'Odawara Station — buy ekiben', 'Train bento for the Shinkansen. Station has a good selection.', { id: 'd06-ekiben', tags: ['food'] }),
      E('12:07 PM', 'Hikari Shinkansen Odawara → Kyoto', 'CONFIRMED (Klook). Arrives ~2:10 PM. Right-side seats (D/E) — Fuji visible within the first 10 minutes. Hikari only — Nozomi skips Odawara.', {
        id: 'd06-shinkansen', confirmed: true, place: P('Kyoto Station', 34.9858, 135.7588), travel: { mode: 'train', label: 'Hikari Shinkansen, ~2 hrs' }, tags: ['transit', 'booking'],
      }),
      E('~2:00 PM', 'Kyoto Station → Gion-Shijo', 'Keihan Line to Gion-Shijo (or taxi, ~12 min, ¥700–800).', { id: 'd06-to-gion', tags: ['transit'] }),
      E('2:15–3:00 PM', 'Check in Kyoto Granbell', 'Luggage is already there (shipped from Tokyo Oct 19). Unpack and settle in. The Granbell is on Gion-Shijo Station (Keihan Line). Osaka commute is 52–63 min door-to-door.', {
        id: 'd06-checkin', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'taxi', label: 'Taxi ~12 min ¥700–800, or Keihan Line' }, tags: ['hotel'],
      }),
      S('First Kyoto evening — just the two of you'),
      E('3:15 PM', 'Explore Gion on foot', 'The hotel puts you right in the middle of it. Walk Hanamikoji Street, Tatsumi Bridge, Gion Shirakawa canal, and into Yasaka Shrine. No plan needed — just absorb the neighbourhood on arrival.', {
        id: 'd06-gion', who: 'nasa', place: P('Hanamikoji Street', 35.0027, 135.7750, 'Hanamikoji Street Gion'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
        subplaces: [P('Tatsumi Bridge', 35.0055, 135.7745, 'Tatsumi Bridge Gion'), P('Yasaka Shrine', 35.0037, 135.7787)],
      }),
      E('5:00–6:30 PM', 'Pontocho + Nishiki Market area', 'Pontocho is a narrow lantern-lit alley at its best at dusk. Nishiki Market closes ~6 PM but browse what\'s still open and grab a snack. The surrounding streets stay lively well into the evening.', {
        id: 'd06-pontocho', who: 'nasa', place: P('Pontocho Alley', 35.0067, 135.7707, 'Pontocho Kyoto'), travel: { mode: 'walk', label: '~10-min walk' }, tags: ['sight', 'food'], subplaces: [P('Nishiki Market', 35.0050, 135.7646)],
      }),
      E('7:00 PM', 'NASA date dinner — restaurant TBD', 'You\'re researching Gion/Pontocho options. Kaiseki, kappo, or a good izakaya — this is your first sit-down Kyoto evening together. Placeholder: book once you\'ve decided. See the Suggestions tab for picks.', {
        id: 'd06-dinner', who: 'nasa', tbd: true, tags: ['food'],
      }),
      N('M&M arrive tonight — Oct 21', 'They\'ll check in while you\'re at dinner. Meet at the hotel after you\'re done. Gion Pontocho is a 5-min walk from the Granbell. Yasaka Shrine is open 24hrs. Tomorrow is the first full day together.', 'note', { who: 'mm' }),
    ],
  },

  // ───────────────────────────── D07 ─────────────────────────────
  {
    id: 'd07', n: 7, date: '2026-10-22', dow: 'Thu', city: 'Osaka',
    title: 'Nara morning + Kuromon + Shinsekai + Dotonbori', tagline: 'Nara temples + deer + Osaka full day',
    energy: 'HIGH', dinner: 'All four together — flexible dinner in Namba/Dotonbori', hotel: 'granbell',
    items: [
      N('Why Osaka today', 'Osaka on Jidai Matsuri day (Oct 22) is intentional — you\'re completely out of Kyoto while the procession takes over central Kyoto noon–3 PM. No traffic, no crowds, just a full Osaka day.', 'tip'),
      N('Food strategy', 'Kuromon Ichiba IS lunch — go hungry. Dotonbori tonight is atmosphere + a proper sit-down dinner for all four. This is your first Osaka evening together — pick a restaurant that works for the group and eat well.', 'tip'),
      C('d07-morning', 'Morning plan — Nara (confirmed) or Katsuoji (backup)', 'Nara is the confirmed morning. Katsuoji is the backup — use it if you want something more remote or if Nara doesn\'t appeal the morning of. Both arrive at Kuromon for the shared afternoon within 15 min of each other. Route note for Katsuoji: you pass through Osaka Station/Umeda on the way to the temple — Kuromon is south of there, so you cannot stop on the way. Order for Katsuoji is always: temple first (north), then come back south to Kuromon.', [
        { id: 'nara', label: 'Nara — Todai-ji + Deer Park', desc: 'Confirmed morning.',
          items: [
            E('7:30 AM', 'Kintetsu Limited Express Kyoto → Kintetsu-Nara', '~40 min, ¥1,130. Earlier option: the 7:10 AM express gets you into Todai-ji by 8:00 AM — 20 extra minutes before any tour groups. Same price. Decide the night before.', { id: 'd07-kintetsu', place: P('Kintetsu-Nara Station', 34.6838, 135.8283), travel: { mode: 'train', label: 'Kintetsu Limited Express, 40 min, ¥1,130' }, tags: ['transit'] }),
            E('8:10 AM', 'Bus to Todai-ji', 'Take the bus from stop 2 outside Kintetsu Nara Station toward Todai-ji (~10 min, ¥240 Suica). Buses drop off right by the Nandaimon gate.', { id: 'd07-bus', tags: ['transit'] }),
            E('8:20–9:15 AM', 'Todai-ji', 'Start here while crowds are lowest. The 15m bronze Great Buddha in Japan\'s largest wooden hall. Genuinely one of the most striking sights in Japan. ¥600. Open 7:30 AM–5:30 PM (Oct). Deer roam freely right up to the Nandaimon gate.', { id: 'd07-todaiji', place: P('Todai-ji', 34.6890, 135.8398, 'Todai-ji Nara'), travel: { mode: 'transit', label: 'Bus from stop 2, 10 min, ¥240' }, tags: ['sight'], cost: '¥600' }),
            E('9:15–10:15 AM', 'Walk back through Nara Park with the deer', 'The deer are with you the whole way along every path. Shika senbei crackers ¥200 (sold at stalls from ~9 AM; the deer bow for them). The natural walking route from the temple toward the station passes through the heart of the park.', { id: 'd07-deer', place: P('Nara Park', 34.6851, 135.8430, 'Nara Park'), travel: { mode: 'walk', label: 'Walk through the park' }, tags: ['sight'] }),
            E('10:15–10:25 AM', 'Optional: Nakatanidou mochi', 'On the Higashimuki covered arcade, 2–3 min from Kintetsu Nara station. Famous for theatrical high-speed mochi pounding. Queue 5–10 min for fresh mochi. On your natural route to the train.', { id: 'd07-mochi', optional: true, place: P('Nakatanidou', 34.6826, 135.8290, 'Nakatanidou Nara'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'] }),
            E('10:30 AM', 'Kintetsu Nara → Osaka Nippombashi', '~40 min — joins shared Osaka afternoon ~11:10 AM.', { id: 'd07-to-osaka', tags: ['transit'] }),
          ] },
        { id: 'katsuoji', label: 'Katsuoji — backup', desc: 'Remote hillside temple north of Osaka famous for thousands of daruma dolls. Temple first (north via Umeda), then back south to Kuromon.', items: [
          E('Morning', 'Katsuoji Temple', 'Hillside temple with thousands of daruma dolls. Route: Kyoto → Osaka/Umeda → Kita-Senri or Minoh, then bus/taxi. Then back south to Kuromon by ~11:15 AM.', { id: 'd07-katsuoji', place: P('Katsuo-ji Temple', 34.8598, 135.4802, 'Katsuoji Temple Minoh'), travel: { mode: 'transit', label: 'Via Osaka/Umeda' }, tags: ['sight'] }),
        ] },
      ], { default: 'nara' }),
      S('Osaka afternoon'),
      E('~11:10 AM–12:30 PM', 'Kuromon Ichiba Market food crawl', '170 stalls: giant scallop, wagyu, uni, takoyaki, beef skewers. ¥2,500–3,500/person. This is lunch. Best stops: giant Nihon scallop on skewer, Daiwa wagyu nigiri, Maruhachi sea urchin, Kani Douraku crab tasting.', {
        id: 'd07-kuromon', place: P('Kuromon Ichiba Market', 34.6655, 135.5063, 'Kuromon Ichiba Market'), travel: { mode: 'train', label: 'Kintetsu to Nippombashi, 40 min' }, tags: ['food'], cost: '¥2,500–3,500/person',
      }),
      E('12:45–2:30 PM', 'Shinsekai + Tsutenkaku Tower', 'Retro 1950s neighbourhood. Go inside: observation deck (¥1,100) + Tower Slider if you want the body slide (¥1,000 extra, limited daily slots — buy at ticket counter the moment you arrive). Tower open 9 AM–9 PM. Kushikatsu stalls line the street outside (Daruma original branch is here). Subway: Dobutsuen-mae.', {
        id: 'd07-shinsekai', place: P('Tsutenkaku Tower', 34.6525, 135.5063, 'Tsutenkaku'), travel: { mode: 'walk', label: '~20-min walk south (or subway to Dobutsuen-mae)' }, tags: ['sight', 'food'], cost: '¥1,100 + ¥1,000 slider',
      }),
      N('Book ahead — Tsutenkaku Tower Slider', 'A 60m body slide from the 3rd floor — about 10 seconds of pure fun. ¥1,000 on top of observatory entry. Slots are limited and sell out daily — buy at the ticket counter the moment you arrive. Check tsutenkaku.co.jp for any advance booking option closer to the date.', 'book', { link: { label: 'tsutenkaku.co.jp', url: 'https://www.tsutenkaku.co.jp' } }),
      E('2:30–3:00 PM', 'Subway north to Shinsaibashi', 'Midosuji Line, 1 stop, ¥230.', { id: 'd07-subway', tags: ['transit'] }),
      S('Shinsaibashi — vintage luxury + streetwear'),
      E('3:00–4:30 PM', 'Shinsaibashi vintage luxury block', 'Komehyo Shinsaibashi (pre-owned Hermès, Chanel, LV bags + Rolex/Cartier watches), Brand Off Shinsaibashi (2-min walk, strong bag selection), ALLU Shinsaibashi (curated high-end pre-owned). All within 5 min of each other along Shinsaibashi-suji. This is M&M\'s dedicated window — take your time. NASA: Shinsaibashi-suji arcade runs right outside — Onitsuka Tiger Shinsaibashi flagship is here too.', {
        id: 'd07-shinsaibashi', place: P('Komehyo Shinsaibashi', 34.6730, 135.5010, 'KOMEHYO Shinsaibashi'), travel: { mode: 'transit', label: 'Midosuji Line, 1 stop, ¥230' }, tags: ['shop'],
      }),
      E('4:30–5:15 PM', 'Amerika-mura streetwear', '5-min walk from Komehyo. Triangle Park area: Wego, Flamingo Osaka, Dogs, BRG for vintage jackets and tops. Osaka\'s street fashion scene has a slightly different flavour to Tokyo — more bold, more graphic. Most shops open noon–9 PM.', {
        id: 'd07-amemura', place: P('Amerikamura Triangle Park', 34.6724, 135.4982, 'Triangle Park Amerikamura'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['shop'],
      }),
      E('5:15–5:45 PM', 'Walk Dotonbori', '10-min walk. Glico running man photo, canal bridge views, neon strip. All four of you for the first Osaka moment together.', {
        id: 'd07-dotonbori', place: P('Dotonbori Glico Sign', 34.6687, 135.5012, 'Glico Sign Dotonbori'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('6:00–7:30 PM', 'Flexible dinner in Dotonbori / Namba', 'Book something that works for all four closer to the date, or decide on the day. Seafood, okonomiyaki, and ramen options. Avoid set menus — à la carte easier for halal/pork-free needs. See the Suggestions tab.', {
        id: 'd07-dinner', tbd: true, tags: ['food'],
      }),
      E('7:30–8:00 PM', 'Don Quijote Dotonbori rooftop ferris wheel', '¥500/person, views over the neon canal from the iconic Donki building. Open until midnight.', {
        id: 'd07-ferris', place: P('Don Quijote Dotonbori', 34.6692, 135.5033, 'Don Quijote Dotonbori'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'], cost: '¥500',
      }),
      E('8:00–8:15 PM', 'Hozenji Yokocho', 'Moss-covered Fudo-myo-o shrine, paper lanterns, tiny alley just off Dotonbori.', {
        id: 'd07-hozenji', place: P('Hozenji Yokocho', 34.6675, 135.5030, 'Hozenji Yokocho'), travel: { mode: 'walk', label: '3-min walk' }, tags: ['sight'],
      }),
      C('d07-castle', 'Osaka Castle — your call', 'After Hozenji: if you still have energy, take the subway to Temmabashi for Osaka Castle exterior lit up at night (park open 24hrs, free, moat reflection) — adds ~40 min. If you\'re done, head to Namba/Yodoyabashi instead and catch an earlier Keihan home (arrive Kyoto ~9 PM). No wrong answer.', [
        { id: 'castle', label: 'Osaka Castle at night (+40 min)', desc: 'Illuminated exterior, moat reflection. Park open 24 hrs, free.',
          items: [E('8:30–9:00 PM', 'Osaka Castle exterior', 'Illuminated at night, moat reflection. Park open 24hrs, free.', { id: 'd07-castle-ev', optional: true, place: P('Osaka Castle', 34.6873, 135.5262, 'Osaka Castle'), travel: { mode: 'transit', label: 'Subway to Temmabashi' }, tags: ['sight'] })] },
        { id: 'home', label: 'Head home early', desc: 'Keihan from Yodoyabashi, arrive Kyoto ~9 PM.', items: [] },
      ], { default: 'home' }),
      E('~9:00–10:00 PM', 'Keihan Line → Gion-Shijo, Kyoto', '~55–60 min from Yodoyabashi.', {
        id: 'd07-home', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'train', label: 'Keihan Line, ~60 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D08 ─────────────────────────────
  {
    id: 'd08', n: 8, date: '2026-10-23', dow: 'Fri', city: 'Kyoto',
    title: 'Arashiyama — bamboo + Tenryu-ji + Otagi + river boat + samurai', tagline: 'Bamboo grove · river · Gion samurai',
    energy: 'HIGH', dinner: 'M&M: romantic evening · NASA: Osaka OR Kyoto date dinner', hotel: 'granbell',
    items: [
      N('Book ahead — Wagyu sukiyaki (optional, either couple)', 'Mishima-tei (Sanjo, since 1873) is the classic Kyoto wagyu spot. Pre-book for 2 and confirm pork-free broth, no alcohol. ¥10,000–15,000/person. Worth it if you want a special dinner — book as a couple, not a group. Hotel concierge can assist.', 'book'),
      N('Taxis — use GO app', 'Download the GO app (go.goinc.jp) before the trip — Japan\'s dominant taxi-hailing app, works across Kyoto including Arashiyama. Request a taxi from exactly where you are, card billed automatically, no Japanese needed. Use it for the Arashiyama taxi legs: bamboo area → Otagi, Otagi → boat area. DiDi and Uber Taxi are backups.', 'tip', { link: { label: 'GO app', url: 'https://go.goinc.jp' } }),
      N('Bamboo Grove — go early', 'Bamboo Grove gets busy by 8:30–9:00 AM even on Fridays in October. The 7:30 AM start puts you there before the first tour groups. Take a taxi from the hotel — buses are not reliable this early.', 'tip'),
      E('7:00 AM', 'Taxi to Arashiyama', 'Buses not reliable this early. ~25 min, ¥3,000–4,000.', { id: 'd08-taxi', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('7:30–8:30 AM', 'Bamboo Grove + Arashiyama Park circuit', 'Enter from the south end and walk the full bamboo path heading north — near-empty at this hour. At the north end keep walking into Arashiyama Park; the observation deck is a 5–10 min walk from the bamboo exit and overlooks the Hozu River gorge. Then walk back south through the bamboo; around 8:25 AM you\'ll pass Nonomiya Shrine\'s black torii gate on your right — give it a 2-min look. Open 24 hrs, free.', {
        id: 'd08-bamboo', place: P('Arashiyama Bamboo Grove', 35.0170, 135.6718, 'Arashiyama Bamboo Grove'), travel: { mode: 'taxi', label: 'Taxi ~25 min, ¥3,000–4,000' }, tags: ['sight'],
        subplaces: [P('Arashiyama Park observation deck', 35.0188, 135.6700, 'Arashiyama Park Kameyama Area'), P('Nonomiya Shrine', 35.0165, 135.6735)],
      }),
      E('8:30–9:45 AM', 'Tenryu-ji Temple garden', 'Zen garden with pond, raked gravel, and Arashiyama mountains as borrowed scenery. Open 8:30 AM–5:30 PM. ¥1,500.', {
        id: 'd08-tenryuji', place: P('Tenryu-ji', 35.0157, 135.6737, 'Tenryu-ji Temple'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['sight'], cost: '¥1,500',
      }),
      E('10:00–11:00 AM', 'Otagi Nenbutsuji', 'Taxi ~12–15 min, ¥1,000–1,200. 1,200 stone rakan statues each with a unique expression, spread over uneven hillside terrain. Peaceful forest temple, almost no crowds. Open 9 AM–5 PM. ¥300.', {
        id: 'd08-otagi', place: P('Otagi Nenbutsu-ji', 35.0301, 135.6619, 'Otagi Nenbutsuji Temple'), travel: { mode: 'taxi', label: 'Taxi 12–15 min, ¥1,000–1,200' }, tags: ['sight'], cost: '¥300',
      }),
      S('Katsura River boat'),
      E('11:15 AM–12:05 PM', 'Katsura River sightseeing boat', 'Taxi back toward Togetsukyo (~12–15 min). Walk-up, no reservation needed. Boats depart every 20–40 min so expect a short wait. ~30 min on the water with Arashiyama mountains behind you. ¥1,500–2,000/person. Board near Togetsukyo Bridge south bank.', {
        id: 'd08-boat', place: P('Togetsukyo Bridge (boat pier, south bank)', 35.0124, 135.6780, 'Togetsukyo Bridge'), travel: { mode: 'taxi', label: 'Taxi 12–15 min' }, tags: ['sight'], cost: '¥1,500–2,000/person',
      }),
      E('12:05–12:30 PM', 'Free time around Togetsukyo Bridge', 'Browse the riverside lane, pick up matcha ice cream, sit by the water.', { id: 'd08-bridge', tags: ['sight', 'food'] }),
      E('12:30–1:30 PM', 'Itsukichaya Arashiyama Honten — lunch', 'CONFIRMED 12:30 PM. Traditional Kyoto set meal with riverside views. Beautifully presented kaiseki-style lunch. IMPORTANT: cash only — bring yen. Backup if unavailable: Yoshimura (soba + yudofu, riverfront).', {
        id: 'd08-lunch', confirmed: true, place: P('Itsukichaya Arashiyama Honten', 35.0120, 135.6790, 'Itsukichaya Arashiyama Honten'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food', 'booking'],
      }),
      S('Gion — samurai'),
      E('1:30 PM', 'Head to Gion', 'Taxi is the primary option (~19 min, ¥2,000–2,500), arrives ~1:49 PM giving 26 min buffer. Bus (~36 min, ¥230) arrives ~2:06 PM — only 9 min buffer, not recommended.', { id: 'd08-to-gion', tags: ['transit'] }),
      E('2:15–4:15 PM', 'Samurai class — Samurai Kenbu Theater', 'CONFIRMED 2:15 PM slot. Sword fundamentals, Iaido, hakama dressing, full-gear photo. 2 hours.', {
        id: 'd08-samurai', confirmed: true, place: P('Samurai Kenbu Theater', 35.0083, 135.7762, 'Samurai Kenbu Theater Kyoto'), travel: { mode: 'taxi', label: 'Taxi ~19 min, ¥2,000–2,500' }, tags: ['booking', 'sight'],
      }),
      E('4:15 PM', 'Walk back to hotel', 'Samurai Kenbu Theater and Kyoto Granbell both in Gion, ~10 min on foot.', {
        id: 'd08-hotel', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'walk', label: '10-min walk' }, tags: ['hotel'],
      }),
      S('Evening — NASA + M&M split'),
      E('4:15 PM onward', 'M&M romantic evening', 'M&M head off for their own evening.', { id: 'd08-mm', who: 'mm', tags: ['food'] }),
      C('d08-night', 'NASA — which night gets the dinner? (D8 vs D9)', 'One of these two nights (D8 or D9) should have a proper booked dinner. The other stays open. D9 starts at 6:30 AM — if you do Osaka on D8 and stay out late, you\'ll feel it at Fushimi.', [
        { id: 'dinner', label: 'Option A — set dinner tonight (leave D9 open)', desc: 'Pontocho or Gion sit-down dinner from ~7 PM. After an Arashiyama day you\'ll have the energy and the neighbourhood is at its best in the evening. Book ahead.',
          items: [E('~7:00 PM', 'Booked Kyoto dinner — Pontocho or Gion', 'Mishima-tei sukiyaki, Kikunoi Roan kaiseki, or a Pontocho pick. See Suggestions.', { id: 'd08-dinner', who: 'nasa', tbd: true, place: P('Pontocho Alley', 35.0067, 135.7707, 'Pontocho Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'] })] },
        { id: 'osaka', label: 'Option B — Osaka tonight (set dinner on D9)', desc: 'Keihan from Gion-Shijo → Yodoyabashi (~55 min). Dotonbori evening — canal walk, neon, street food. Last train back ~11:40 PM from Osaka, home ~12:45 AM.',
          items: [E('Evening', 'Dotonbori evening', 'Canal walk, neon, street food. Last Keihan back ~11:40 PM.', { id: 'd08-osaka', who: 'nasa', place: P('Dotonbori', 34.6687, 135.5012, 'Dotonbori Osaka'), travel: { mode: 'train', label: 'Keihan Line, ~55 min' }, tags: ['sight', 'food'] })] },
      ], { default: 'dinner', who: 'nasa' }),
      N('Free evening in Gion', 'No evening commitment tonight. Jidai Matsuri week gives the neighbourhood extra energy: Yasaka-jinja runs related festival events, Hanamikoji is more lively than usual. Pontocho for dinner (walk in or book ahead). Kamo River is beautifully lit at night — walk the south bank from Shijo Bridge.'),
    ],
  },

  // ───────────────────────────── D09 ─────────────────────────────
  {
    id: 'd09', n: 9, date: '2026-10-24', dow: 'Sat', city: 'Kyoto',
    title: 'Fushimi Inari at dawn + Sanjusangen-do + Nanzen-ji or Nijo + Nishiki + Orizuruya', tagline: 'Fushimi at dawn + Kyoto temples + tea ceremony + calligraphy',
    energy: 'HIGH', dinner: 'M&M: GEAR show · NASA: Kyoto dinner OR Osaka — whichever you didn\'t do on D8', hotel: 'granbell',
    items: [
      N('Route logic', 'Fushimi at dawn (far south) → walk to Sanjusangen-do (2 km) → taxi to Nanzen-ji (default) or Nijo (alternative pick) → taxi to Nishiki for lunch → Orizuruya 1:30 PM nearby → free evening from 3:30 PM. Clean southward start, central Kyoto finish.', 'tip'),
      E('6:00 AM', 'Leave hotel', 'Bring a layer — the dawn will feel cold.', { id: 'd09-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['hotel'] }),
      E('6:10–6:25 AM', 'Keihan Line Gion-Shijo → Fushimi-Inari', '3 stops, ~12 min.', { id: 'd09-keihan', tags: ['transit'] }),
      E('6:30–8:30 AM', 'Fushimi Inari', 'Go further up the mountain than you normally would at midday. The higher sections have emptier paths and better views back over the city. Stalls at the base sell coffee and light bites from early morning. Open 24 hrs, always free.', {
        id: 'd09-fushimi', place: P('Fushimi Inari Taisha', 34.9675, 135.7797), travel: { mode: 'train', label: 'Keihan Line, 3 stops, 12 min' }, tags: ['sight'],
      }),
      E('8:30–9:00 AM', 'Walk to Sanjusangen-do', '2 km flat, ~25 min. Grab breakfast from a stall or convenience store on the way.', { id: 'd09-walk', tags: ['transit'] }),
      E('9:00–9:45 AM', 'Sanjusangen-do', '120m hall containing 1,001 life-size golden Kannon statues standing in rows. Nothing else in Japan looks like this. Opens 8 AM. ¥600.', {
        id: 'd09-sanjusangendo', place: P('Sanjusangen-do', 34.9876, 135.7718, 'Sanjusangendo Temple'), travel: { mode: 'walk', label: '2 km, ~25 min' }, tags: ['sight'], cost: '¥600',
      }),
      C('d09-pick', 'Day-of pick — Nanzen-ji OR Nijo Castle (not both)', 'Nanzen-ji is the recommended default: keeps the whole day in eastern Kyoto, cleaner routing, and the best Zen complex in the city.', [
        { id: 'nanzenji', label: 'Nanzen-ji (recommended)', desc: 'Taxi north ~15 min, ¥1,000. Kyoto\'s greatest Zen complex.',
          items: [E('10:30–11:30 AM', 'Nanzen-ji', 'Massive sanmon gate, brick aqueduct running through the grounds, sub-temple rock gardens. Open 8:40 AM–5 PM. Free outer grounds, ¥600 main hall. Taxi at 10:15.', { id: 'd09-nanzenji', place: P('Nanzen-ji', 35.0113, 135.7932, 'Nanzen-ji Temple'), travel: { mode: 'taxi', label: 'Taxi ~15 min, ¥1,000' }, tags: ['sight'], cost: '¥600' })] },
        { id: 'nijo', label: 'Nijo Castle', desc: 'The Tokugawa Shogun\'s Kyoto residence. Ninomaru Palace nightingale floors, Edo gold-leaf screen rooms, Ninomaru garden. Open 8:45 AM–5 PM (last entry 4 PM). ¥1,300. Taxi west from Sanjusangen-do, visit 10:30–12:00, then taxi to Nishiki for lunch at 12:15.',
          items: [E('10:30 AM–12:00 PM', 'Nijo Castle', 'Nightingale floors, gold-leaf screen rooms, Ninomaru garden. ¥1,300.', { id: 'd09-nijo', place: P('Nijo Castle', 35.0142, 135.7481, 'Nijo Castle'), travel: { mode: 'taxi', label: 'Taxi west' }, tags: ['sight'], cost: '¥1,300' })] },
      ], { default: 'nanzenji' }),
      E('11:55 AM–12:45 PM', 'Nishiki Market', 'Taxi southwest ~20–25 min, ¥1,500–2,000. 400m covered arcade. Best buys: tsukemono from the old pickle shops, tamagoyaki, matcha items. Grab lunch from the stalls. Most close by 5:30–6 PM.', {
        id: 'd09-nishiki', place: P('Nishiki Market', 35.0050, 135.7646), travel: { mode: 'taxi', label: 'Taxi 20–25 min, ¥1,500–2,000' }, tags: ['food', 'shop'],
      }),
      E('12:45–1:30 PM', 'Wrap up Nishiki', 'Finish the arcade, grab anything you spotted. Grab a coffee or sit somewhere quiet nearby before the ceremony — you\'ve been going since 6 AM.', { id: 'd09-wrap', tags: ['food'] }),
      E('1:30–3:30 PM', 'Nishiki Orizuruya — tea ceremony + calligraphy', 'CONFIRMED 1:30 PM slot. 2 hrs combined. You take home your calligraphy piece.', {
        id: 'd09-orizuruya', confirmed: true, place: P('Nishiki Orizuruya', 35.0053, 135.7620, 'Orizuruya Nishiki Kyoto tea ceremony'), travel: { mode: 'walk', label: 'Short walk' }, tags: ['booking', 'sight'],
      }),
      E('3:30 PM onward', 'M&M — GEAR show', 'GEAR is a 70-min non-verbal comedy performance in Gion — no Japanese required. M&M will be done around 9:30–10 PM. If you want to meet up after, Gion Pontocho is right there.', {
        id: 'd09-gear', who: 'mm', place: P('GEAR Theatre (Art Complex 1928)', 35.0088, 135.7681, 'GEAR non-verbal theatre Kyoto'), tags: ['sight'],
      }),
      N('NASA — evening', 'Free from ~3:30 PM.\n\nIF D8 was Osaka → tonight is your set Kyoto dinner. Pontocho or Gion. You\'ve been going since 6 AM so somewhere nearby is ideal — 10–15 min walk or taxi from Nishiki.\n\nIF D8 was dinner → tonight is looser. Osaka is still an option but factor in the early start. Alternatively: Kamo River walk at dusk, Gion backstreets, ramen at a counter, early night.', 'decide', { who: 'nasa' }),
    ],
  },

  // ───────────────────────────── D10 ─────────────────────────────
  {
    id: 'd10', n: 10, date: '2026-10-25', dow: 'Sun', city: 'Kyoto',
    title: 'Kiyomizu at dawn + kimono photoshoot + Kodai-ji illumination', tagline: 'Kimono day — dawn shrine + Higashiyama circuit + illumination',
    energy: 'HIGH', dinner: 'Casual dinner in Gion after Kodai-ji — early night before USJ', hotel: 'granbell',
    items: [
      E('6:45 AM', 'Leave hotel by taxi', '~15 min to Kiyomizu-dera.', { id: 'd10-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('7:00–8:40 AM', 'Kiyomizu-dera at dawn', '1h40min, no rush. Fully empty at this hour. The wooden cliffside stage, Otowa waterfall, valley views in early morning light. Good pace for the whole group including Mariam. Open 6 AM. ¥500.', {
        id: 'd10-kiyomizu', place: P('Kiyomizu-dera', 34.9949, 135.7850, 'Kiyomizu-dera Temple'), travel: { mode: 'taxi', label: 'Taxi ~15 min' }, tags: ['sight'], cost: '¥500',
      }),
      E('8:40–9:20 AM', 'Walk down through Ninenzaka + Sannenzaka', 'The descent naturally passes through Ninenzaka and Sannenzaka. Real buffer before the 9:30 AM appointment — browse the stone-paved lanes, grab a quick matcha or taiyaki. Early morning, nearly empty. ~20–25 min walk with stops.', {
        id: 'd10-ninenzaka', place: P('Ninenzaka', 34.9980, 135.7810, 'Ninenzaka Kyoto'), travel: { mode: 'walk', label: 'Walk down the slope' }, tags: ['sight'],
      }),
      E('9:30–10:30 AM', 'Kimono dressing + hair — Momo Kimono', 'CONFIRMED 9:30 AM slot. 1 hour. Women\'s kimono + hair is the main time; men\'s hakama ~20 min. Shop confirmed ready by 10:30 AM. Return time 4:30 PM or later.', {
        id: 'd10-kimono', confirmed: true, place: P('Momo Kimono', 35.0039, 135.7745, 'Momo Kimono Kyoto'), travel: { mode: 'walk', label: '~20-min walk' }, tags: ['booking'],
      }),
      E('10:30–10:45 AM', 'Walk to photographer meeting point near Kodai-ji', '15 min. Arrive at 10:45 AM.', { id: 'd10-walk', tags: ['transit'] }),
      E('10:45 AM–12:45 PM', 'Photoshoot circuit with street photographer', 'CONFIRMED. Yasaka Pagoda → Nen-no-michi lane (quiet stone path through Higashiyama) → Maruyama Park → Gion Shirakawa canal. All walkable within 15 min of Kodai-ji. 2 hours.', {
        id: 'd10-photo', confirmed: true, place: P('Yasaka Pagoda (Hokan-ji)', 34.9985, 135.7795, 'Yasaka Pagoda'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['booking', 'sight'],
        subplaces: [P('Maruyama Park', 35.0040, 135.7810, 'Maruyama Park Kyoto'), P('Gion Shirakawa', 35.0053, 135.7745, 'Gion Shirakawa')],
      }),
      E('12:45–1:30 PM', 'Walk toward Hikiniku in kimono', 'Photographer wraps at 12:45 — stay in kimono and walk toward Hikiniku (~10–15 min from Gion Shirakawa).\n\nKIMONO CHANGE OPTION: if you have enough time between 12:45 and 1:30, you can swing by Momo Kimono to change out first (~15 min walk, return time is 4:30 PM). If it feels tight, just go in kimono — the restaurant provides an apron and it makes for a great photo moment.', { id: 'd10-walk2', tags: ['transit'] }),
      E('1:30–2:15 PM', 'Hikiniku to Come 挽肉と米', 'CONFIRMED 1:30 PM. Arrive within 10 min of slot. Thick coarsely-minced beef patty grilled tableside on a hot iron plate, served with perfect rice and miso soup. Apron provided. ¥1,800/person + ¥1,000 priority ticket. Cash or card.', {
        id: 'd10-hikiniku', confirmed: true, place: P('Hikiniku to Come Kyoto', 35.0040, 135.7730, '挽肉と米 京都'), travel: { mode: 'walk', label: '10–15 min walk' }, tags: ['food', 'booking'], cost: '¥1,800 + ¥1,000',
      }),
      E('2:15–4:00 PM', 'Free Higashiyama afternoon in kimono', 'Best window for Ninenzaka and Sannenzaka — crowds are far lighter by 2–3 PM and you\'ll be in full kimono. Other options: Hanamikoji Street in Gion, Yasaka Shrine, Kennin-ji (10-min walk, ¥600, twin dragon ceiling), or a matcha cafe sit-down (% Arabica below Yasaka Pagoda, Gion Kinana soft serve). No agenda — this is the day\'s exhale.', {
        id: 'd10-free', place: P('Sannenzaka', 34.9968, 135.7820, 'Sannenzaka Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('4:00–4:30 PM', 'Return kimono to Momo Kimono', '', { id: 'd10-return', place: P('Momo Kimono', 35.0039, 135.7745, 'Momo Kimono Kyoto'), travel: { mode: 'walk', label: 'Walk' }, tags: ['booking'] }),
      E('5:00–7:00 PM', 'Kodai-ji illumination', '10-min walk from Gion. Zen sand garden, moss garden, pond, bamboo grove and teahouse pavilions lit as dusk falls. Illumination runs 5 PM–9:30 PM. Just make the 5 PM start. ¥600.', {
        id: 'd10-kodaiji', place: P('Kodai-ji', 34.9995, 135.7815, 'Kodaiji Temple'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'], cost: '¥600',
      }),
      E('7:00–8:00 PM', 'Casual dinner near hotel in Gion', 'Early night. USJ tomorrow: gates open 8:00 AM.', {
        id: 'd10-dinner', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Luggage shipping tonight — action required', 'Ship Kyoto → Akihabara Washington tonight (Oct 25): drop bags at Kyoto Granbell front desk by 8 PM after Kodai-ji; 2-day delivery arrives Oct 27 when you check in. Do NOT wait until Oct 26 (USJ day — 6 AM departure, back at 11 PM). ¥1,500–2,500/bag.', 'warn'),
    ],
  },

  // ───────────────────────────── D11 ─────────────────────────────
  {
    id: 'd11', n: 11, date: '2026-10-26', dow: 'Mon', city: 'Osaka',
    title: 'Universal Studios Japan — Halloween', tagline: 'USJ — Harry Potter + Mario + Horror Night',
    energy: 'HIGH', dinner: 'In-park themed restaurants', hotel: 'granbell',
    items: [
      N('Confirmed — Express Pass 7', 'EP7 Minecart & Selection for all. Flight of the Hippogriff 12:00–12:30 PM. Super Nintendo World timed entry 19:10–20:10. Mario Kart 19:10–19:40, Yoshi\'s Adventure 19:40–20:10, Mine Cart Madness 20:10–20:40. All other EP7 rides open on the day.', 'book'),
      E('6:00 AM', 'Leave Kyoto Granbell → USJ', 'Walk or taxi to Kyoto Station (~15 min). JR Shinkaisoku Kyoto → Osaka (~28 min, ¥580) → JR Osaka Loop Line to Nishikujo (~10 min) → JR Sakurajima Line to Universal City (~8 min). Total ~65 min.', { id: 'd11-leave', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['transit'] }),
      E('~7:20–7:40 AM', 'Arrive USJ gates', '', { id: 'd11-gates', place: P('Universal Studios Japan', 34.6655, 135.4323, 'Universal Studios Japan'), travel: { mode: 'train', label: 'JR via Osaka + Nishikujo, ~65 min' }, tags: ['sight'] }),
      E('8:00–8:30 AM', 'ROPE DROP', 'Gates open (confirm exact time on USJ app the night before). SPLIT: Husbands → The Flying Dinosaur (standby — rope drop queue is minimal, ~5–10 min) ~25 min total. Wives → Villain-Con Minion Blast (standby, similarly short) ~15 min. Regroup at Minion Mayhem — all four ride together on express. Then all head to Harry Potter area.', { id: 'd11-ropedrop', tags: ['sight'] }),
      S('Harry Potter area'),
      E('9:00–9:45 AM', 'Ollivanders wand ceremony + Forbidden Journey', 'Queue for first or second show of the day. One person gets chosen for the wand demonstration. ~15 min show, runs every 20–30 min. Then Harry Potter and the Forbidden Journey (express) — use it now while you\'re in the area.', { id: 'd11-ollivanders', tags: ['sight'] }),
      E('9:45–10:15 AM', 'Butterbeer', 'At the cart or Three Broomsticks — original (sweet, cream), frozen, or hot. Sit in Hogsmeade, soak it in.', { id: 'd11-butterbeer', tags: ['food'] }),
      E('10:15–11:55 AM', 'HP area: shows + photos + browse', 'Check USJ app the night before for show times — outdoor Hogsmeade performances run multiple times and are free. Photo spots: Hogwarts castle entrance, Hogsmeade rooftops, Hogwarts Express, Knight Bus. Browse Dervish & Banges, Ollivanders shop (interactive wand zones). No rush — this deserves the full window.', { id: 'd11-hp', tags: ['sight', 'shop'] }),
      S('Midday'),
      E('12:00–12:30 PM', '⭐ EXPRESS SLOT: Flight of the Hippogriff', 'Outdoor coaster through Hogsmeade. Be at ride entrance by 11:55 AM.', { id: 'd11-hippogriff', confirmed: true, tags: ['sight', 'booking'] }),
      E('12:30–1:30 PM', 'Lunch in park', 'Three Broomsticks is the safest pork-free option (rotisserie chicken, salad, soup — good for M&M). Or Louie\'s NY Pizza near the entrance. Rest your feet.', { id: 'd11-lunch', tags: ['food'] }),
      S('Afternoon'),
      E('1:30–5:00 PM', 'Free afternoon — no fixed order', 'JAWS express (flexible slot, use it now); Frieren experience (check USJ app for show times); Wicked themed experience (check app); browse One Piece Mugiwara Store and anime merch; Halloween Horror Nights décor builds from mid-afternoon. Power-Up bands at Nintendo World entrance if anyone wants the interactive game (separate purchase).', { id: 'd11-afternoon', tags: ['sight', 'shop'] }),
      E('5:30–7:00 PM', 'Dinner inside park', 'Eat before 7 PM, Nintendo World is next. Kinopio\'s Cafe inside Nintendo World is an option; otherwise eat before entry. M&M: check menus in advance.', { id: 'd11-dinner', tags: ['food'] }),
      S('Super Nintendo World — evening'),
      E('7:10 PM', '⭐ Super Nintendo World timed entry opens', 'Head to the gate.', { id: 'd11-snw', confirmed: true, tags: ['sight', 'booking'] }),
      E('7:10–7:40 PM', '⭐ EXPRESS: Mario Kart: Koopa\'s Challenge', '', { id: 'd11-mariokart', confirmed: true, tags: ['sight', 'booking'] }),
      E('7:40–8:10 PM', '⭐ EXPRESS: Yoshi\'s Adventure', '', { id: 'd11-yoshi', confirmed: true, tags: ['sight', 'booking'] }),
      E('8:10–8:40 PM', '⭐ EXPRESS: Mine Cart Madness (Donkey Kong Country)', '', { id: 'd11-minecart', confirmed: true, tags: ['sight', 'booking'] }),
      E('8:40–9:00 PM', 'Browse Nintendo World', 'Donkey Kong Country, Nintendo store, Power-Up band challenges if you have them.', { id: 'd11-browse', tags: ['shop'] }),
      S('Final hour'),
      E('9:00–10:00 PM', 'Halloween Horror Nights scare zones + Hollywood Dream', 'Free to walk through, park goes full Halloween in the evening (anime crossover theming). Hollywood Dream standby — queues collapse in the last hour (~15–20 min). Last merch run: One Piece store, Nintendo store close at 10 PM.', { id: 'd11-hhn', tags: ['sight'] }),
      E('10:00 PM', 'Park closes', '', { id: 'd11-close', tags: ['sight'] }),
      E('~10:15 PM', 'Return to Kyoto Granbell', 'Reverse the morning route: Universal City → JR Sakurajima Line → Nishikujo → JR Osaka Loop Line → Osaka Station → JR Shinkaisoku → Kyoto Station (~28 min) → taxi or walk to hotel. Total ~75 min. Arrive ~11:30 PM.', {
        id: 'd11-return', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), travel: { mode: 'train', label: 'JR, ~75 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D12 ─────────────────────────────
  {
    id: 'd12', n: 12, date: '2026-10-27', dow: 'Tue', city: 'Tokyo',
    title: 'Flexible Kyoto morning + Shinkansen to Tokyo + Ginza', tagline: 'Squad reunites — Ginza golden hour · NASA Yoroniku Ebisu · M&M romantic evening',
    energy: 'MEDIUM', dinner: 'Ginza together · NASA: Yoroniku Ebisu 9:30 PM · M&M romantic evening', hotel: 'washington',
    items: [
      S('Flexible Kyoto morning'),
      E('9:00 AM–12:00 PM', 'Flexible morning — no fixed plan', 'Sleep in, slow breakfast, wander Gion at your own pace. Bags already shipped ahead — check out at noon.', { id: 'd12-morning', place: P('Kyoto Granbell Hotel', 35.0036, 135.7711), tags: ['hotel'] }),
      C('d12-optional', 'Optional Kyoto morning picks', 'If anyone wants one last Kyoto thing before the train. None required — morning is intentionally open.', [
        { id: 'none', label: 'Nothing — enjoy the slow morning', desc: '', items: [] },
        { id: 'kenninji', label: 'Kennin-ji', desc: 'Kyoto\'s oldest Zen temple, 10-min walk from the hotel (opens 10 AM, ¥600). Twin dragon ceiling painting + gravel garden. Right on your doorstep.',
          items: [E('10:00–11:15 AM', 'Kennin-ji', 'Twin dragon ceiling + gravel garden. ¥600.', { id: 'd12-kenninji', optional: true, place: P('Kennin-ji', 35.0005, 135.7735, 'Kenninji Temple'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'] })] },
        { id: 'onitsuka', label: 'Onitsuka Tiger Kyoto', desc: '8-min walk from hotel, opens 11 AM–9 PM. Full range in-store, sizes run small — try before buying.',
          items: [E('11:00–11:45 AM', 'Onitsuka Tiger Kyoto', 'Full range in-store.', { id: 'd12-onitsuka', optional: true, place: P('Onitsuka Tiger Kyoto', 35.0040, 135.7690, 'Onitsuka Tiger Kyoto'), travel: { mode: 'walk', label: '8-min walk' }, tags: ['shop'] })] },
        { id: 'railway', label: 'Kyoto Railway Museum', desc: 'Near Kyoto Station (~20 min taxi, opens 10 AM–5:30 PM, closed Wed, ¥1,200). 53 full-size locomotives, steam loco rides, panoramic Shinkansen yard view. Convenient since you\'re heading to the station anyway.',
          items: [E('10:00–11:45 AM', 'Kyoto Railway Museum', '53 locomotives, steam rides. ¥1,200.', { id: 'd12-railway', optional: true, place: P('Kyoto Railway Museum', 34.9870, 135.7420, 'Kyoto Railway Museum'), travel: { mode: 'taxi', label: 'Taxi ~20 min' }, tags: ['sight'] })] },
      ], { default: 'none' }),
      E('12:00 PM', 'Check out · taxi to Kyoto Station', '~12 min, ¥700–1,000. Or Karasuma subway from Shijo-Karasuma (~20 min door-to-door). Allow 15–20 min.', {
        id: 'd12-checkout', place: P('Kyoto Station', 34.9858, 135.7588), travel: { mode: 'taxi', label: 'Taxi ~12 min, ¥700–1,000' }, tags: ['transit', 'hotel'],
      }),
      E('12:15–1:45 PM', 'Kyoto Station run', 'Porta underground mall, Isetan basement food hall, platform-level souvenir strip (all open 10 AM–8 PM). Grab bento boxes for the Shinkansen by ~1:30 PM. Kyoto makunouchi box is worth it. ~¥1,200–1,800 each.', { id: 'd12-station', tags: ['food', 'shop'] }),
      E('2:01 PM', 'Shinkansen Kyoto → Tokyo', 'CONFIRMED 2:01 PM departure, arrives Tokyo 4:15 PM. Left-side seats (A/B) for Fuji views heading east. Rear-row seats in designated large-baggage car.', {
        id: 'd12-shinkansen', confirmed: true, place: P('Tokyo Station', 35.6812, 139.7671), travel: { mode: 'train', label: 'Shinkansen, 2h14' }, tags: ['transit', 'booking'],
      }),
      S('Tokyo arrival'),
      E('4:20 PM', 'JR Keihin-Tohoku → Akihabara · check in', '5 min. Check in, drop bags, freshen up.', {
        id: 'd12-checkin', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'JR Keihin-Tohoku, 5 min' }, tags: ['hotel'],
      }),
      E('5:00 PM', 'JR Akihabara → Yurakucho', '~10 min — into Ginza.', { id: 'd12-to-ginza', tags: ['transit'] }),
      E('5:15–7:00 PM', 'Ginza — all four together', 'Chuo-dori, Itoya (closes 8 PM), Uniqlo Ginza flagship. No bags, hotel already checked in. Coffee break — you\'ve been on trains all day.', {
        id: 'd12-ginza', place: P('Ginza Chuo-dori', 35.6717, 139.7649, 'Ginza Chuo-dori'), travel: { mode: 'train', label: 'JR to Yurakucho, 10 min' }, tags: ['shop'],
      }),
      S('All four — Ginza vintage luxury'),
      E('7:00–8:00 PM', 'Brand Off + Komehyo + Casanova Vintage', 'Brand Off Ginza (dedicated Birkin/Kelly floor), Komehyo Ginza flagship (bags + watch floor, closes ~8:30 PM), Casanova Vintage Ginza — all within walking distance in the Ginza 6–7 chome area. Same cluster as D4 but a second pass — inventory rotates daily.', {
        id: 'd12-vintage', place: P('Komehyo Ginza', 35.6700, 139.7632, 'KOMEHYO Ginza'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'],
      }),
      E('~8:00 PM', 'Split', 'NASA heads toward Yoroniku; M&M into their own evening.', { id: 'd12-split', tags: ['logistics'] }),
      S('NASA — evening after Ginza'),
      E('8:00–9:10 PM', 'Marunouchi wander', '10 min walk east from Ginza. Imperial Palace moat lit at dusk, Marunouchi Naka-dori brick arcades, Tokyo Station illuminated red-brick facade at night. Easy stroll before dinner.', {
        id: 'd12-marunouchi', who: 'nasa', place: P('Marunouchi Naka-dori', 35.6800, 139.7640, 'Marunouchi Naka-dori'), travel: { mode: 'walk', label: '10-min walk' }, tags: ['sight'],
      }),
      E('9:30–11:30 PM', 'Yoroniku よろにく Ebisu', 'CONFIRMED 9:30 PM. Taxi from Marunouchi/Ginza ~15 min, ~¥2,000 — arrive just ahead of the reservation. Premium A5 wagyu yakiniku for two — Naf + Sara\'s first Tokyo night. Charcoal-grilled cuts tableside. Pure wagyu, no pork, no alcohol needed.', {
        id: 'd12-yoroniku', who: 'nasa', confirmed: true, place: P('Yoroniku Ebisu', 35.6475, 139.7100, 'Yoroniku Ebisu'), travel: { mode: 'taxi', label: 'Taxi ~15 min, ~¥2,000' }, tags: ['food', 'booking'],
      }),
      E('~11:30 PM', 'Taxi back to Akihabara', '~25 min, ~¥2,500.', {
        id: 'd12-home', who: 'nasa', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'taxi', label: 'Taxi ~25 min, ~¥2,500' }, tags: ['hotel'],
      }),
      S('M&M — romantic evening'),
      E('After 8 PM', 'M&M private evening', 'Dinner and the rest of the night at your own pace. Back to Akihabara whenever.', { id: 'd12-mm', who: 'mm', tags: ['food'] }),
    ],
  },

  // ───────────────────────────── D13 ─────────────────────────────
  {
    id: 'd13', n: 13, date: '2026-10-28', dow: 'Wed', city: 'Tokyo',
    title: 'Asakusa + chopstick workshop + Kappabashi + Okachimachi gold + Ueno', tagline: 'Old Tokyo — temples, knives, chopstick class + gold district',
    energy: 'HIGH', dinner: 'Graze Nakamise + dinner at Ameyoko stalls + Akihabara night', hotel: 'washington',
    items: [
      E('8:20 AM', 'Depart hotel — Tsukuba Express → Asakusa', '8 min, ¥210. Direct and frequent. Walk 5 min southeast to Senso-ji. Pelikan Bakery (since 1942, opens 9 AM, sells out late morning) is 5 min from Senso-ji if you want a bread breakfast.', { id: 'd13-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('8:30–10:00 AM', 'Senso-ji before peak crowds', 'Kaminarimon Gate, incense cauldron, main hall, fortune slips (omikuji ¥100). Wander into Asakusa Shrine next door — quieter and often overlooked. By 10:30 the tour groups arrive.', {
        id: 'd13-sensoji', place: P('Senso-ji', 35.7148, 139.7967, 'Sensoji Temple'), travel: { mode: 'train', label: 'Tsukuba Express, 8 min, ¥210' }, tags: ['sight'], subplaces: [P('Asakusa Shrine', 35.7153, 139.7975)],
      }),
      E('10:00–11:00 AM', 'Nakamise-dori deep dive', 'Fans, lacquerware, ningyo-yaki (sweet red-bean cakes fresh off the iron), tenugui hand-dyed cloth. Then branch into Denpoin Street (Edo-era shopfront facades) and Shin-Nakamise arcade. Stalls open 10 AM–6:30 PM.', {
        id: 'd13-nakamise', place: P('Nakamise-dori', 35.7117, 139.7966, 'Nakamise Shopping Street'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop', 'food'],
      }),
      E('11:00 AM–12:20 PM', 'Asakusa backstreets', 'Hoppy Street (old-school standing bars, great to photograph), the Hanayashiki amusement park exterior (Japan\'s oldest), and the quiet lanes behind the temple. Let yourself get a little lost.', {
        id: 'd13-backstreets', place: P('Hoppy Street', 35.7152, 139.7935, 'Hoppy Street Asakusa'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('12:20 PM', 'Quick lunch snack in Asakusa', 'Standing food stalls and small spots around Nakamise before the workshop.', { id: 'd13-snack', tags: ['food'] }),
      S('Zen Craft — chopstick workshop'),
      E('1:00–2:00 PM', '⭐ 禅 Zen Craft Chopsticks Workshop', 'CONFIRMED 1:00 PM. Walk ~8 min from central Asakusa, arrive a few minutes before 1 PM. Hand-carve your own hinoki cypress chopsticks. ~1 hour. You keep them.', {
        id: 'd13-zencraft', confirmed: true, place: P('Zen Craft Chopsticks Workshop', 35.7116, 139.7920, 'Zen Craft chopsticks workshop Asakusa'), travel: { mode: 'walk', label: '~8-min walk' }, tags: ['booking'],
      }),
      S('Kappabashi — knife district'),
      E('2:15–4:15 PM', 'Kappabashi kitchenware district', '~10–15 min walk west. Japanese chef knives (Masamoto, Tojiro, Sakai Takayuki), ceramics, lacquerware, plastic food display models. Budget ¥8,000–25,000 for a quality gyuto or santoku. Shopkeepers will let you test the weight and sharpness. Most shops open 9 AM–5 PM.', {
        id: 'd13-kappabashi', place: P('Kappabashi Kitchen Town', 35.7130, 139.7890, 'Kappabashi Dougu Street'), travel: { mode: 'walk', label: '10–15 min walk' }, tags: ['shop'],
      }),
      S('Okachimachi — gold + jewelry district'),
      E('4:30–5:15 PM', 'Okachimachi jewelry district', '~15 min walk from Kappabashi (straight south toward Ueno), or 5 min taxi. Sango Street (Coral Street) and Ruby Street, both east of JR Okachimachi Station. Dozens of wholesale and retail gold and diamond shops. Prices are negotiable (starting offer usually 10–15% below asking), most offer tax-free (bring passports). Browse 3–4 shops, compare. Look for karat stamp (18K/750 or 24K/999). GALA OKACHIMACHI is the largest store — good for range comparison. Most shops open until 6–7 PM. Ask for 「金のアクセサリー」 (kin no akusesarī).', {
        id: 'd13-okachimachi', place: P('Okachimachi Jewelry Town', 35.7083, 139.7745, 'Okachimachi jewelry town'), travel: { mode: 'walk', label: '~15-min walk south' }, tags: ['shop'], cost: '¥20,000–100,000+',
      }),
      C('d13-ueno', 'Ueno — pond or straight to market', 'Your call from here — two options depending on energy. Neither is wrong.', [
        { id: 'market', label: 'Hungry/tired → straight to Ameyoko', desc: 'Open and busy from 5 PM, food stalls run until 8–9 PM. Done and in Akihabara by 7–7:30 PM — early night before DisneySea.', items: [] },
        { id: 'pond', label: 'Energy → Shinobazu Pond loop first', desc: '20-min walk, free — large lotus pond with Benten shrine on an island, beautiful at golden hour (October sunset ~5:15 PM), then drop into Ameyoko after.',
          items: [E('5:15–5:40 PM', 'Shinobazu Pond loop', 'Lotus pond, Benten shrine on an island, golden hour.', { id: 'd13-pond', optional: true, place: P('Shinobazu Pond', 35.7125, 139.7700, 'Shinobazu Pond Ueno'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'] })] },
      ], { default: 'market' }),
      E('~5:30–6:30 PM', 'Ameyoko market — dinner on foot', '5-min walk north — Okachimachi flows directly into the market. Fresh sashimi, yakitori skewers, oysters, Korean pancakes (haemul pajeon), dried fruits and nuts. Food stalls open until 8–9 PM. 500m end-to-end — graze, loop back for seconds.', {
        id: 'd13-ameyoko', place: P('Ameyoko Market', 35.7110, 139.7745, 'Ameyoko Shopping Street'), travel: { mode: 'walk', label: '5-min walk' }, tags: ['food'],
      }),
      S('Akihabara — all four'),
      E('6:30 PM+', 'Akihabara night', '5 min by JR from Ueno, or walk the 20 min through the district. Multi-floor figure shops, Yodobashi Camera gaming floors, maid cafés on Chuo-dori, retro game arcades. No fixed plan — go with what catches you. Kanda Yabu Soba (historic, 1880) is an easy walk from base if anyone wants a proper sit-down.', {
        id: 'd13-akiba', place: P('Akihabara Electric Town', 35.6984, 139.7731, 'Akihabara Electric Town'), travel: { mode: 'walk', label: '20-min walk (or JR 5 min)' }, tags: ['shop', 'sight'],
      }),
    ],
  },

  // ───────────────────────────── D14 ─────────────────────────────
  {
    id: 'd14', n: 14, date: '2026-10-29', dow: 'Thu', city: 'Tokyo',
    title: 'Tokyo DisneySea — full day', tagline: 'DisneySea — Fantasy Springs + the harbour',
    energy: 'HIGH', dinner: 'In-park (Mediterranean Harbor at sunset)', hotel: 'washington',
    items: [
      N('Book ahead — Disney Premier Access (DPA)', 'Buy via TDR app the MOMENT you enter the park (cannot purchase before entry). PRIORITY 1: Frozen: A Frozen Journey — buy first, sells out fastest. PRIORITY 2: Peter Pan\'s Never Land Adventure. PRIORITY 3: Rapunzel\'s Lantern Festival. PRIORITY 4: Journey to the Center of the Earth. Then Toy Story Mania. Have card saved in app before you arrive. Fantasy Springs has standby lines, so DPA skips the 120-min+ wait but you can still queue without it. Also check the app for lottery/premium shows — Halloween season often has special evening shows.', 'book'),
      E('6:30 AM', 'Depart Akihabara → DisneySea', 'JR to Tokyo (4 min) → JR Keiyo Line → Maihama (~18 min) → Disney Resort Line monorail → Tokyo DisneySea Station (~15 min). Arrive gates ~7:10 AM.', { id: 'd14-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('7:30–9:00 AM', 'Queue at gates', '7:30 AM is the sweet spot. Security typically opens 30–45 min before official opening (~8:15–8:30 AM). Use the wait to plan DPA purchase order on the TDR app and have payment ready. Park hours Oct 29: 9:00 AM–9:00 PM.', {
        id: 'd14-gates', place: P('Tokyo DisneySea', 35.6267, 139.8851, 'Tokyo DisneySea'), travel: { mode: 'train', label: 'JR Keiyo + Disney Resort Line, ~40 min' }, tags: ['sight'],
      }),
      E('9:00 AM', 'ROPE DROP — buy DPAs', 'Enter and immediately buy DPAs in priority order on the TDR app. Do not stop for photos until Frozen DPA is secured.', { id: 'd14-ropedrop', tags: ['sight'] }),
      S('Fantasy Springs — priority area'),
      N('DisneySea — rides + priorities', 'FANTASY SPRINGS (go here first): Frozen: A Frozen Journey (the headliner, buy DPA first) · Peter Pan\'s Never Land Adventure (DPA or early standby) · Rapunzel\'s Lantern Festival (DPA or standby).\n\nELSEWHERE: Journey to the Center of the Earth (iconic, unmissable) · Toy Story Mania (manageable queues by afternoon) · Soaring: Fantastic Flight · 20,000 Leagues Under the Sea · Big Band Beat show (reserve via TDR app at rope drop).\n\nSUNSET MOMENT: Mediterranean Harbor at 5–6 PM. The whole harbour turns gold. Don\'t miss it.\n\nNIGHT: re-rides on anything you loved, Fantasy Springs at night is stunning.', 'tip'),
      E('9:00 AM–6:00 PM', 'Full park day', 'Fantasy Springs first, then work through the rest based on DPA times and queue lengths. Lunch in-park (Mediterranean area has good seafood options for M&M). Sunset at Mediterranean Harbor 5–6 PM — sit down and be there for this.', { id: 'd14-park', tags: ['sight', 'food'] }),
      E('6:00–9:00 PM', 'Evening in park', 'Halloween atmosphere builds, DisneySea at night is one of the most beautiful theme park views in the world. Re-rides, shows, final wanders.', { id: 'd14-evening', tags: ['sight'] }),
      E('~9:30 PM', 'Depart park → Akihabara', 'Disney Resort Line monorail → Maihama (~10 min) → JR Keiyo Line to Tokyo Station (~18 min) → JR Keihin-Tohoku to Akihabara (5 min). Total ~35 min. Arrive hotel ~10:15 PM.', {
        id: 'd14-return', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'Monorail + JR, ~35 min' }, tags: ['transit', 'hotel'],
      }),
    ],
  },

  // ───────────────────────────── D15 ─────────────────────────────
  {
    id: 'd15', n: 15, date: '2026-10-30', dow: 'Fri', city: 'Tokyo',
    title: 'Meiji Shrine + Harajuku + Shibuya + Shinjuku night', tagline: 'West-side sweep — shrine to scramble to Omoide Yokocho',
    energy: 'HIGH', dinner: 'Omoide Yokocho + dinner TBD — group night out in Shinjuku', hotel: 'washington',
    items: [
      E('9:00 AM', 'Depart hotel → Harajuku', 'JR Chuo-Sobu Line from Akihabara to Shinjuku (~12 min) → JR Yamanote 2 stops south to Harajuku (~5 min). Total ~20 min, ¥210 Suica. Today is a one-way sweep: Harajuku → Shibuya → Shinjuku. No backtracking.', { id: 'd15-depart', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['transit'] }),
      E('9:15–10:15 AM', 'Meiji Jingu Shrine', 'All four of you. Cedar forest path (700m each way), inner shrine courtyard, sake barrel display. Opens at sunrise, closes at sunset (~5:15 PM Oct). Free. Friday morning: well ahead of the weekend tour group peak.', {
        id: 'd15-meiji', place: P('Meiji Jingu', 35.6764, 139.6993, 'Meiji Jingu Shrine'), travel: { mode: 'train', label: 'JR Chuo-Sobu + Yamanote, ~20 min, ¥210' }, tags: ['sight'],
      }),
      N('Tokyo Toilet — Meiji + Shibuya', 'On the walk along Jingu-dori between Harajuku Station and Meiji Shrine, look for Jingu-Dori Park on your right — the Toyo Ito toilet there is a sculptural stainless-steel mushroom shape, free to use and photograph. Worth a 2-min stop. Later in Shibuya: Nanago Mori Park near Miyashita Park (Marc Newson design) is in the same block as Shibuya Parco.', 'tip'),
      E('10:30 AM–1:00 PM', 'Harajuku — Takeshita-dori + Cat Street', 'Takeshita-dori 10:30–11:15 AM (crepe stands, gachapon, photo booths, 3-floor Daiso — open from 10 AM). Cat Street / Ura-Harajuku 11:15 AM–1:00 PM when boutiques open: upscale vintage, indie designers, BAPE, Supreme, limited sneaker drops. Give Cat Street the full window. Coffee: Streamer Coffee (Harajuku) or Fuglen (Tomigaya) on the way south.', {
        id: 'd15-harajuku', place: P('Takeshita Street', 35.6716, 139.7045, 'Takeshita Street Harajuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Cat Street', 35.6670, 139.7060, 'Cat Street Harajuku')],
      }),
      E('1:00 PM', 'Transit to Shibuya', 'JR from Harajuku Station → Shibuya (2 min, ¥160 Suica).', { id: 'd15-to-shibuya', tags: ['transit'] }),
      E('1:05–1:35 PM', 'Quick bite', 'Parco B1 food hall, ramen on Dogenzaka, or grab something near the station. 30 min. About Life Coffee Brewers (Dogenzaka) for a standing espresso.', { id: 'd15-bite', place: P('Shibuya Station', 35.6580, 139.7016), travel: { mode: 'train', label: 'JR, 2 min, ¥160' }, tags: ['food'] }),
      E('1:35–5:00 PM', 'Shibuya explore + shop', '3.5 hours, no fixed order. Shibuya Parco — Nintendo Tokyo (B1, essential), Pokémon Center (6F), Jump Shop (6F), anime/culture floors; open 11 AM–9 PM, Nintendo/Pokémon close 8 PM. One Piece Mugiwara Store — Shanks straw hat photo op (separate from Parco — confirm address). Loft / Tokyu Hands — stationery, gifts, design goods. Tokyu Food Show (Shibuya Hikarie basement) — wagashi, sweets, bento for omiyage.', {
        id: 'd15-shibuya', place: P('Shibuya Parco', 35.6620, 139.6990, 'Shibuya PARCO'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Shibuya Hikarie', 35.6590, 139.7036, 'Shibuya Hikarie')],
      }),
      E('5:00–5:30 PM', 'Hachiko + Shibuya Crossing at dusk', 'October sunset is 5:15 PM so the screens ignite as the sky darkens. Stand in the scramble at the first light change. Best possible timing.', {
        id: 'd15-scramble', place: P('Shibuya Scramble Crossing', 35.6595, 139.7005, 'Shibuya Scramble Crossing'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('5:45 PM', 'JR Yamanote Shibuya → Shinjuku', '2 stops, 7 min.', { id: 'd15-to-shinjuku', tags: ['transit'] }),
      E('6:00–6:30 PM', 'Kabukicho neon', 'East Exit and straight into the entertainment district: Godzilla head on the TOHO Cinema rooftop, neon towers, the full Tokyo-at-night energy. Quick loop, great photos, then across to shopping.', {
        id: 'd15-kabukicho', place: P('Kabukicho (Godzilla head)', 35.6950, 139.7021, 'Godzilla Head Shinjuku Toho'), travel: { mode: 'train', label: 'JR Yamanote, 7 min' }, tags: ['sight'],
      }),
      E('6:30–9:00 PM', 'Shinjuku shopping — glasses first', 'Start with glasses: JINS at Takashimaya Times Square (2F, same building as GU) or Zoff in Lumine 1. Bring your current prescription or pay ~¥3,000 for an in-store eye exam (~20 min). Single-vision lenses take ~45–60 min — drop the order first, then everyone shops. GU is B2–3F in Times Square; Lumine 1 and 2 are a 5-min walk (South Exit): Uniqlo, Beams, United Arrows, Ships, DIANA, Odette e Odile. Once glasses are ready: split — girls continue Lumine; guys to Animate Shinjuku (East Exit, ~20 min from Lumine). Reconvene by 9:00 PM.', {
        id: 'd15-shopping', place: P('Takashimaya Times Square', 35.6876, 139.7024, 'Takashimaya Times Square Shinjuku'), travel: { mode: 'walk', label: 'Walk' }, tags: ['shop'], subplaces: [P('Lumine 1', 35.6885, 139.6995, 'Lumine Shinjuku 1'), P('Animate Shinjuku', 35.6935, 139.7040, 'Animate Shinjuku')],
      }),
      S('Shinjuku night — Omoide Yokocho + dinner TBD'),
      N('Free Tokyo view', 'Skip Shibuya Sky (¥2,000 + booking hassle). The Tokyo Metropolitan Government Building in West Shinjuku has a free observation deck at 202m — similar panorama including Fuji on clear days, open until 10:30 PM (north) / 11 PM (south), zero booking, walk straight in. Go up before Omoide Yokocho or whenever the mood strikes.', 'tip'),
      E('Optional', 'Tokyo Metropolitan Government Building observation deck', 'Free, 202m, no booking. Open until 10:30/11 PM.', {
        id: 'd15-tmg', optional: true, place: P('Tokyo Metropolitan Government Building', 35.6896, 139.6921, 'Tokyo Metropolitan Government Building Observation Deck'), travel: { mode: 'walk', label: '~10-min walk' }, tags: ['sight'],
      }),
      E('9:15 PM', 'Omoide Yokocho (Memory Lane)', '7-min walk through the South Exit underground passages to the West Exit. Vibe stop, not dinner. Narrow alley of 50+ tiny yakitori stalls wedged under the train tracks: smoke, grilled chicken skewers, old Tokyo neon. Grab a stool, order one or two skewers each (chicken/seafood only). ~30–40 min.', {
        id: 'd15-omoide', place: P('Omoide Yokocho', 35.6930, 139.6996, 'Omoide Yokocho'), travel: { mode: 'walk', label: '7-min walk' }, tags: ['food', 'sight'],
      }),
      E('~10:00 PM', 'Dinner in Shinjuku — TBD', 'Group dinner for all four. Shinjuku East Exit area has plenty of options: Gyukatsu Motomura (wagyu beef cutlet, pork-free), yakiniku spots on Kabukicho, or ramen on Shinjuku Higashi-dori. Decide closer to the date based on energy and what you haven\'t eaten yet. No booking needed for most options. See Suggestions.', {
        id: 'd15-dinner', tbd: true, place: P('Shinjuku East Exit', 35.6910, 139.7040, 'Shinjuku Station East Exit'), travel: { mode: 'walk', label: 'Walk' }, tags: ['food'],
      }),
      N('Halloween Eve', 'Shibuya and Shinjuku are already filling with costumes from Oct 30. Shibuya crossing at night (8–10 PM) is most atmospheric. Shinjuku Kabukicho for the full Halloween entertainment district energy.'),
    ],
  },

  // ───────────────────────────── D16 ─────────────────────────────
  {
    id: 'd16', n: 16, date: '2026-10-31', dow: 'Sat', city: 'Tokyo',
    title: 'Halloween: free morning + Ikebukuro cosplay festival night', tagline: 'Ikebukuro first visit · Cosplay Festival · Halal dinner · Halloween night',
    energy: 'MEDIUM → HIGH', dinner: 'Dinner + Halloween Cosplay Festival — Ikebukuro', hotel: 'washington',
    items: [
      N('Morning split', 'NASA + M&M each have a free morning — reconvene at 5:00–5:30 PM for Halloween evening together.', 'tip'),
      C('d16-morning', 'Free morning until 3:30 PM — options', 'No plan. Options if you want to use the time.', [
        { id: 'rest', label: 'Sleep in, pack, rest before a big night', desc: '', items: [] },
        { id: 'yanaka', label: 'Yanaka Ginza + Nezu Shrine', desc: 'Nippori, 10 min from hotel — old shitamachi Tokyo, cats wandering freely, local food stalls, wooden machiya backstreets, one of the most authentic neighbourhoods in the city.',
          items: [
            E('Morning', 'Yanaka Ginza', 'Old shitamachi Tokyo, cats, food stalls, machiya backstreets.', { id: 'd16-yanaka', optional: true, place: P('Yanaka Ginza', 35.7277, 139.7653, 'Yanaka Ginza'), travel: { mode: 'train', label: 'JR to Nippori, 10 min' }, tags: ['sight', 'food'] }),
            E('Late morning', 'Nezu Shrine', 'Torii tunnel, one of Tokyo\'s oldest shrines. 15-min walk from Yanaka Ginza.', { id: 'd16-nezu', optional: true, place: P('Nezu Shrine', 35.7196, 139.7645, 'Nezu Shrine'), travel: { mode: 'walk', label: '15-min walk' }, tags: ['sight'] }),
          ] },
        { id: 'omotesando', label: 'Jingumae / Omotesando', desc: 'Revisit the Harajuku area from D2 or D15, or just walk the boulevard with a proper coffee.',
          items: [E('Morning', 'Omotesando boulevard + coffee', '', { id: 'd16-omotesando', optional: true, place: P('Omotesando', 35.6652, 139.7120, 'Omotesando Tokyo'), travel: { mode: 'train', label: 'JR + Metro, ~30 min' }, tags: ['shop'] })] },
        { id: 'tsukiji', label: 'Tsukiji Outer Market breakfast / Toyosu Daiwa Sushi', desc: 'Last Tokyo market morning. Daiwa Sushi at Toyosu for tuna omakase (queue from 6:30 AM) or Tsukiji Outer Market stalls.',
          items: [E('Early morning', 'Tsukiji Outer Market', 'Tamagoyaki, oysters, tuna bowl. Or Daiwa Sushi at Toyosu, queue from 6:30 AM.', { id: 'd16-tsukiji', optional: true, place: P('Tsukiji Outer Market', 35.6654, 139.7707), travel: { mode: 'train', label: 'Hibiya Line, ~20 min' }, tags: ['food'] })] },
        { id: 'akiba', label: 'Akihabara — last chance', desc: 'Anything unfinished — you are staying here.', items: [] },
      ], { default: 'rest' }),
      E('3:30 PM', 'Back at hotel — costumes out', 'Everything laid out in advance.', { id: 'd16-back', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['hotel'] }),
      E('3:30–5:00 PM', 'Makeup + costumes', '90 min to get fully ready. Halloween in Tokyo: the level of costume detail from locals raises the bar for everyone. Commit completely. By 5 PM you should be done and waiting.', { id: 'd16-costume', tags: ['logistics'] }),
      N('Luggage to Narita — tonight by 8 PM', 'After 17 days of shopping, send large bags to Narita the evening before. Drop them at the hotel front desk by 8 PM before you go out — Yamato Transport delivers to Narita T1 check-in by the morning of Nov 1. ¥1,500–2,000/bag. You then ride the Skyliner with just a small carry-on. Highly recommended.', 'warn'),
      E('5:00–5:30 PM', 'Meet M&M — regroup', 'Head out together.', { id: 'd16-meet', tags: ['logistics'] }),
      E('5:30 PM', 'JR Yamanote Akihabara → Ikebukuro', '~20 min, ¥210. You\'ve never been to Ikebukuro — this is the introduction. Completely different vibe from Akihabara: Sunshine City, Otome Road (female-oriented anime/manga culture), Animate flagship, and a massive Halloween crowd tonight.', { id: 'd16-train', tags: ['transit'] }),
      E('6:00 PM', 'Arrive Ikebukuro — Sunshine 60 Street + Naka-Ikebukuro Park', 'The Ikebukuro Halloween Cosplay Festival official stage runs 10 AM–6 PM so you\'re catching the tail end and the street costume energy that follows. The parade streets (Sunshine 60 Street and Animate Street) fill with cosplayers long after the official close. Walk, photograph, absorb.', {
        id: 'd16-ikebukuro', place: P('Sunshine 60 Street', 35.7300, 139.7150, 'Sunshine 60 Street Ikebukuro'), travel: { mode: 'train', label: 'JR Yamanote, 20 min, ¥210' }, tags: ['sight'], subplaces: [P('Naka-Ikebukuro Park', 35.7300, 139.7170, 'Naka-Ikebukuro Park')],
      }),
      E('7:00–8:30 PM', 'Dinner in Ikebukuro — BOOK NOW', 'Best fit for the group: Halal Wagyu Shabu Shabu Shoutaian (fully halal-certified, no pork, no alcohol, wagyu beef cooked at your table — perfect celebration dinner, short walk from Ikebukuro Station). Alternative: Palmyra (Syrian/Lebanese mezze, sharing plates, belly-dance some evenings). Book Shoutaian directly and confirm group of 4 + halal requirement.', {
        id: 'd16-dinner', tbd: true, place: P('Halal Wagyu Shabu Shabu Shoutaian', 35.7312, 139.7110, 'Halal Wagyu Shabu Shabu Shoutaian Ikebukuro'), travel: { mode: 'walk', label: 'Short walk' }, tags: ['food', 'booking'],
      }),
      E('8:30 PM+', 'Post-dinner Ikebukuro Halloween', 'The costume streets peak after dark. Otome Road for the anime cosplay culture, Don Quijote Ikebukuro (open until 5 AM), Sunshine City exterior, Animate Street. The neighbourhood is huge — let it unfold. All four of you in costume in one of Tokyo\'s most underrated Halloween spots.', {
        id: 'd16-night', place: P('Otome Road', 35.7290, 139.7185, 'Otome Road Ikebukuro'), travel: { mode: 'walk', label: 'Walk' }, tags: ['sight'],
      }),
      E('~11:00 PM', 'Head back — JR Yamanote Ikebukuro → Akihabara', '~20 min. Last Halloween energy of the trip — Akihabara will also be in full costume mode as you walk from the station back to the hotel.', {
        id: 'd16-home', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), travel: { mode: 'train', label: 'JR Yamanote, 20 min' }, tags: ['transit', 'hotel'],
      }),
      N('Halloween night alternatives', 'Tokyo Halloween costume culture is extraordinary. While Shibuya\'s mass street event has been restricted (public alcohol banned — works perfectly for your group), the costume energy spreads city-wide. Alternative plan: Shibuya crossing 8–10 PM, then Shinjuku Kabukicho 10 PM–midnight. Trains back to Akihabara until ~1 AM. Organised club events and Halloween bar crawls in Shinjuku and Roppongi are good alternatives.'),
    ],
  },

  // ───────────────────────────── D17 ─────────────────────────────
  {
    id: 'd17', n: 17, date: '2026-11-01', dow: 'Sun', city: 'Tokyo',
    title: 'Final morning + 6:15 PM flight', tagline: 'Sayonara — last bites + Narita farewell',
    energy: 'LOW', dinner: 'Airport', hotel: 'washington',
    items: [
      E('9:00–9:30 AM', 'Konbini breakfast', 'Quick and done.', { id: 'd17-bfast', place: P('Akihabara Washington Hotel', 35.6975, 139.7745), tags: ['food'] }),
      E('9:30–11:00 AM', 'Free time — last shopping run, packing', 'Sorting any final buys. Hotel checkout is 11 AM.', { id: 'd17-free', tags: ['shop'] }),
      E('11:00 AM', 'Check out — leave bags with concierge', 'Lobby is yours until 1:30 PM: last Akihabara wander, coffee, sort additional purchases into carry-ons.', { id: 'd17-checkout', tags: ['hotel'] }),
      E('~1:30 PM', 'Group assembles in lobby', 'Collect bags from concierge, final sort into carry-ons if needed.', { id: 'd17-lobby', tags: ['logistics'] }),
      E('~1:45 PM', 'Both couples leave for Narita', 'JR from Akihabara → Ueno (5 min), then Keisei Skyliner to Narita T1 (36 min, ¥2,520). 4+ hrs before NASA\'s 6:15 PM flight, ~2.5 hrs before M&M\'s.', {
        id: 'd17-ueno', place: P('Keisei Ueno Station', 35.7126, 139.7741, 'Keisei Ueno Station'), travel: { mode: 'train', label: 'JR, 5 min' }, tags: ['transit'],
      }),
      E('~2:25 PM', 'Arrive Narita Terminal 1', '', {
        id: 'd17-narita', place: P('Narita Airport Terminal 1', 35.7654, 140.3860, 'Narita Airport Terminal 1'), travel: { mode: 'train', label: 'Keisei Skyliner, 36 min, ¥2,520' }, tags: ['flight'],
      }),
      E('2:25–5:15 PM', 'Check in · security · immigration · lounge', 'Eat at the airport lounge — no lunch was planned and you\'ve earned a proper sit-down. Browse Duty Free: Royce chocolate, matcha Kit Kats, Japanese whisky, any final Japan buys. Keep ¥10,000 cash for Duty Free.', { id: 'd17-airport', tags: ['food', 'shop'] }),
      E('~5:15 PM', 'M&M depart', 'One last see-you-on-the-other-side before their gate.', { id: 'd17-mm', who: 'mm', tags: ['flight'] }),
      E('5:30–6:00 PM', 'Gate', 'Boarding call ~30 min before departure.', { id: 'd17-gate', who: 'nasa', tags: ['flight'] }),
      E('6:15 PM', 'NASA depart', 'Sayonara.', { id: 'd17-depart', who: 'nasa', tags: ['flight'] }),
      N('Note', 'Return Suica at ticket machines for ¥500 deposit — or keep it as a souvenir, the card works on your next trip too.', 'tip'),
    ],
  },
];
