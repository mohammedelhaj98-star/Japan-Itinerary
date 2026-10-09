// Bookings, food guide, trip tips and curated suggestions.

export const BOOKINGS = {
  confirmed: [
    { title: 'Omakase Sushi Dinner', when: 'Oct 18, D3, 8:30 PM', detail: 'Sushi Yoshikawa Kaido Shinjuku, 7-19-7 Nishi-Shinjuku, Sun Rose Shinjuku 101. 19 courses, ¥14,300/person. Arrive 8:20 PM.', day: 'd03' },
    { title: 'All hotels', when: 'Whole trip', detail: 'Sotetsu Grand Fresa (Oct 16–20), Mizunoto (Oct 20–21), Kyoto Granbell (Oct 21–27, 6 nights), Akihabara Washington (Oct 27–Nov 1). No Osaka hotel; day trip from Kyoto.' },
    { title: 'Odakyu Romancecar, Hakone 41', when: 'Oct 20, D5, 7:37 AM', detail: 'EMot app. Shinjuku 7:37 → Hakone-Yumoto 9:22. Car 1, right side (C/D). ¥1,300 surcharge confirmed. Hakone Free Pass (¥6,100/person) at Odakyu Shinjuku counter that morning.', day: 'd05' },
    { title: 'Shinkansen Odawara → Kyoto', when: 'Oct 21, D6, 12:07 PM', detail: 'Klook. Hikari 12:07 → Kyoto ~2:10 PM. Right side (D/E) for Fuji. Overnight bags only.', day: 'd06' },
    { title: 'Itsukichaya Arashiyama Honten, lunch', when: 'Oct 23, D8, 12:30 PM', detail: 'Booked. Cash only, bring yen. Near Togetsukyo Bridge.', day: 'd08' },
    { title: 'Samurai Class, Kenbu Theater', when: 'Oct 23, D8, 2:15 PM', detail: '2 hours, Gion.', day: 'd08' },
    { title: 'Nishiki Orizuruya, tea ceremony + calligraphy', when: 'Oct 24, D9, 1:30 PM', detail: '2 hours combined.', day: 'd09' },
    { title: 'Kimono Rental, Momo Kimono', when: 'Oct 25, D10, 9:30 AM', detail: 'Ready by 10:30 AM. Photographer 10:45 AM near Kodai-ji (11-min walk). Return 4:30 PM or later.', day: 'd10' },
    { title: 'Street Photographer, kimono shoot', when: 'Oct 25, D10, 10:45 AM', detail: '2-hour circuit. Meet near Kodai-ji.', day: 'd10' },
    { title: 'Hikiniku to Come 挽肉と米', when: 'Oct 25, D10, 1:30 PM', detail: 'Arrive within 10 min of slot. Apron provided. ¥1,800/person + ¥1,000 priority ticket. Cash or card.', day: 'd10' },
    { title: 'Universal Studios Japan, Express Pass 7', when: 'Oct 26, D11', detail: 'EP7 Minecart & Selection, all four. Flight of the Hippogriff 12:00–12:30. Super Nintendo World entry 19:10–20:10: Mario Kart 19:10, Yoshi\'s 19:40, Mine Cart Madness 20:10.', day: 'd11' },
    { title: 'Shinkansen Kyoto → Tokyo', when: 'Oct 27, D12, 2:01 PM', detail: 'Arrives Tokyo 4:15 PM. Left side (A/B) for Fuji eastbound. Rear row, large-baggage car.', day: 'd12' },
    { title: 'Yoroniku よろにく Ebisu, NASA dinner', when: 'Oct 27, D12, 9:30 PM', detail: 'NASA only. Premium A5 wagyu yakiniku.', day: 'd12', who: 'nasa' },
    { title: '禅 Zen Craft Chopsticks Workshop', when: 'Oct 28, D13, 1:00 PM', detail: '~1 hour, Asakusa.', day: 'd13' },
    { title: 'DisneySea 1-Day Passport', when: 'Oct 29, D14', detail: 'Tickets purchased.', day: 'd14' },
  ],
  closer: [
    { title: 'Halloween dinner, Shoutaian, Ikebukuro', when: 'Oct 31, D16, ~7 PM', detail: 'BOOK NOW. Halal Wagyu Shabu Shabu Shoutaian: fully halal, no alcohol, group table. Call or book online; confirm 4 pax + halal. Alt: Palmyra (Syrian/Lebanese, Ikebukuro).', day: 'd16', urgent: true },
    { title: 'NASA date dinner, Kyoto', when: 'Oct 21, D6, 7 PM', detail: 'TBD, Gion/Pontocho. Kaiseki, kappo or izakaya. Book once decided.', day: 'd06', who: 'nasa' },
    { title: 'Group dinner, Dotonbori/Namba', when: 'Oct 22, D7, 6 PM', detail: 'Book for four nearer the date, or decide on the day. À la carte easier for halal/pork-free.', day: 'd07' },
    { title: 'NASA Kyoto dinner (D8 or D9)', when: 'Oct 23 or 24', detail: 'One booked night: Mishima-tei sukiyaki or Kikunoi Roan kaiseki. Book as a couple.', day: 'd08', who: 'nasa' },
    { title: 'Disney Premier Access', when: 'Oct 29, D14, day-of', detail: 'TDR app the MOMENT gates open. 1: all three Fantasy Springs DPAs (Frozen, Peter Pan, Rapunzel). 2: Journey to the Center of the Earth. 3: Toy Story Mania. Gone within 30 min.', day: 'd14' },
    { title: 'DisneySea shows', when: 'Oct 29, D14, day-of', detail: 'Mostly walk-up or day-of lottery via TDR app. Check paid premium/lottery shows; Halloween season often has special evening shows. Enter lottery at park open.', day: 'd14' },
    { title: 'Dotonbori Don Quijote Ferris Wheel', when: 'Oct 22, D7', detail: 'Advance booking or walk-up? Check donki.com or just show up. ~¥500–700/person.', day: 'd07' },
    { title: 'Tsutenkaku Tower Slider', when: 'Oct 22, D7', detail: '60m body slide. Buy at counter on arrival; sells out daily. ¥1,000 + observatory entry (¥1,100).', day: 'd07' },
    { title: 'Kichi Kichi Omurice, Kyoto', when: 'Any Kyoto evening', detail: 'Chef Yukimura\'s tableside omurice. Day-of only: call at opening (typically 11 AM–12 PM JST) for that evening. Fills instantly. Try every Kyoto morning. +81-75-254-4460.', tel: '+81752544460' },
    { title: 'Wagyumafia Cutlet Sandwich', when: 'Any Tokyo day', detail: 'Pre-order a day ahead online for pickup at Ebisu. ¥4,000.' },
    { title: 'Restaurant reservations in Japan', when: 'On arrival', detail: 'Unbooked omakase: ask hotel concierge on arrival; Tokyo concierges often reach otherwise-inaccessible tables. Pocket Concierge and Tableall: English, high-end.' },
  ],
};

export const FOOD = [
  {
    city: 'Tokyo — first leg (Oct 16–20)', items: [
      { star: true, name: 'Sushi Yoshikawa Kaido omakase, Shinjuku', meta: '¥14,300/person, CONFIRMED 8:30 PM Oct 18', text: '19-course Edomae omakase. Arrive 8:20 PM.', lat: 35.6957, lng: 139.6978 },
      { star: true, name: 'Daiwa Sushi tuna omakase, Toyosu Market', meta: '¥6,000–8,000/person, no reservation, queue from 6:30 AM', text: 'Original Tsukiji Daiwa, now at Toyosu. Exceptional market tuna. Queue early. Oct 31 morning or standalone.', lat: 35.6450, lng: 139.7850 },
      { name: 'Fuunji ramen, Nishi-Shinjuku', meta: '¥1,100, lunch only, queue 20–40 min', text: 'Tsukemen (dipping ramen). Top-rated in Tokyo. Opens 11 AM.', lat: 35.6872, lng: 139.6985 },
      { name: 'Wagyumafia wagyu katsu sando', meta: '¥4,000, pre-order required online', text: 'Thick wagyu cutlet sandwich. Pre-order a day ahead, pickup Ebisu.', lat: 35.6467, lng: 139.7101 },
      { name: 'Ichiran ramen', meta: '¥1,000–1,200, no reservation, any time', text: 'Solo booths; order by form, bowl through a curtain. One on Waseda-dori near the hotel.' },
      { name: 'Isetan Shinjuku depachika, B1–B2', meta: 'Free entry, any afternoon', text: 'Best depachika: wagashi, bento, pastries, sake, chocolate.', lat: 35.6918, lng: 139.7045 },
    ],
    cafes: [
      { name: 'Bear Pond Espresso, Shimokitazawa', text: 'D4: single-origin espresso. No phones, cash only, closes when coffee runs out. Queue before opening.', lat: 35.6625, lng: 139.6670 },
      { name: 'Fuglen Tokyo, Tomigaya', text: 'D15 area: Norwegian roaster between Harajuku and Shibuya. Pour-overs, pastries; natural wine evenings.', lat: 35.6680, lng: 139.6920 },
      { name: 'Starbucks Reserve Roastery, Nakameguro', text: 'Four-storey canal-side store near Daikanyama. Not a regular Starbucks.', lat: 35.6493, lng: 139.6926 },
      { name: 'Melon pan, bakery window', text: '¥150–200. Sweet bread, crisp sugar crust. Best warm; any morning.' },
    ],
  },
  {
    city: 'Kyoto (Oct 21–27)', items: [
      { star: true, name: 'Mishima-tei wagyu sukiyaki, Sanjo', meta: '¥10,000–15,000/person, must book, since 1873', text: 'Kyoto\'s most historic wagyu house; slow, ceremonial sukiyaki. Pick for D8/D9 booked night. Confirm pork-free broth, no alcohol.', lat: 35.0088, lng: 135.7672 },
      { star: true, name: 'Kikunoi Roan kaiseki, Gion', meta: '¥15,000–25,000/person, book ahead, 2 Michelin stars', text: 'Sister of the 3-star Honten. Seasonal multi-course kaiseki. English booking via website.', lat: 35.0040, lng: 135.7705 },
      { name: 'Yudofu tofu kaiseki, Arashiyama', meta: '¥3,000–5,000, no reservation', text: 'Kyoto\'s signature: silken tofu in dashi. Covered by D8 Itsukichaya lunch.' },
      { name: 'Matcha everything, Nishiki Market + Gion', meta: '¥200–800 per item', text: 'Nishiki: matcha mochi, soft serve, nuts. Gion: Gion Tsujiri, Itohkyuemon.' },
      { name: 'Obanzai (Kyoto home cooking)', meta: '¥1,500–2,500', text: 'Small plates: pickles, tofu, greens, fish in light dashi. Nishiki or small Gion spots.' },
      { name: 'Kichi Kichi Omurice, Nishiki area', meta: 'Day-of phone reservations only', text: 'Theatrical tableside omurice. Call when lines open (11 AM–12 PM) for that evening; concierge can help.', lat: 35.0075, lng: 135.7700 },
    ],
    cafes: [
      { name: '% Arabica Kyoto, Higashiyama (Yasaka Pagoda)', text: 'D10 area: Yasaka-dori below the pagoda, on the kimono circuit. Kyoto\'s most photographed café. Queue moves fast.', lat: 34.9992, lng: 135.7781 },
      { name: 'Wife & Husband, Kuramaguchi', text: 'Indie café, vintage furniture, home baking. 20-min taxi detour, slow morning. Check hours.', lat: 35.0434, lng: 135.7617 },
      { name: 'Omen, Ginkaku-ji area', text: 'Thick handmade udon, dipping broth. 5 min from Ginkaku-ji; reliable NE Kyoto lunch.', lat: 35.0250, lng: 135.7930 },
      { name: 'Gion Kinana, Gion', text: 'Matcha soft serve, mochi ice cream; walk-up window near the hotel. Among Kyoto\'s best.', lat: 35.0030, lng: 135.7745 },
      { name: 'AWOMB Karasuma, central Kyoto', text: 'Roll-your-own temaki, seasonal bento-box ingredients, Zen-garden room. Book ahead.', lat: 35.0075, lng: 135.7600 },
      { name: 'Yoshimura, Arashiyama riverfront', text: 'D8 backup lunch: soba, yudofu on the Katsura River by Togetsukyo Bridge. Window seats, mountain views.', lat: 35.0132, lng: 135.6778 },
    ],
  },
  {
    city: 'Osaka (Oct 22 full day)', items: [
      { star: true, name: 'Wanaka Honten takoyaki, Dotonbori', meta: '¥700 / 6 pieces, short queue', text: 'The gold standard. Crispy outside, liquid inside, proper bonito flakes and sauce.', lat: 34.6680, lng: 135.5020 },
      { star: true, name: 'Daruma Shinsekai kushikatsu (original)', meta: '¥2,500–4,000, no reservation', text: 'Older, more character, retro neighbourhood; in Shinsekai on D7 anyway. One dip per skewer, never double-dip.', lat: 34.6523, lng: 135.5060 },
      { name: 'Daruma kushikatsu, Namba branch', meta: '¥2,500–4,000, no reservation', text: 'More practical on your route if you skip the Shinsekai one.', lat: 34.6670, lng: 135.5020 },
      { name: 'Okonomiyaki: Kiji (Umeda) or Chibo (Dotonbori)', meta: '¥1,200–1,800, no reservation', text: 'Osaka savory pancake. Kiji more local; Chibo on the Dotonbori route.', lat: 34.6686, lng: 135.5030 },
      { name: 'Kinryu Ramen 24h, Dotonbori', meta: '¥850, no reservation', text: 'Giant golden dragon sign. Reliable soy ramen, midnight or post-dinner.', lat: 34.6685, lng: 135.5025 },
      { name: 'Kuromon Ichiba crawl (already in plan)', meta: '¥2,500–3,500/person walking', text: 'Giant Nihon scallop skewer, Daiwa wagyu nigiri, Maruhachi sea urchin, Kani Douraku crab tasting. Slowly, many stalls; this is lunch.', lat: 34.6655, lng: 135.5063 },
      { star: true, name: 'Mooken cream puffs', meta: '¥300–500, walk-in, Shinsaibashi', text: 'Famous Osaka cream puffs, a short walk north of Dotonbori in Shinsaibashi.' },
    ],
    cafes: [
      { name: '% Arabica Osaka, Kitahama', text: 'Canal-side, north of Namba. Coffee stop en route to Osaka Castle.', lat: 34.6915, lng: 135.5070 },
      { name: 'Hozenji Yokocho cafés, Namba', text: 'Small bars and coffee spots in the alley past the Hozenji water shrine. Quiet nightcap before the train home.', lat: 34.6675, lng: 135.5030 },
      { name: 'Konbini food in Osaka', text: 'Osaka 7-Elevens: regional onigiri flavours and local sweets not sold in Tokyo.' },
    ],
  },
  {
    city: 'Tokyo — second leg (Oct 27–Nov 1)', items: [
      { star: true, name: 'Tsukiji Outer Market', meta: '¥3,000–4,500/person walking', text: 'Marutake tamagoyaki (¥400), Tsukiji Tama Sushi quick nigiri, Tsukiji Kimuraya oysters, Sushi Zanmai budget tuna bowl. Do not eat before.', lat: 35.6654, lng: 139.7707 },
      { name: 'Yurakucho yakitori under the tracks', meta: '¥3,000–4,500, no reservation, evenings', text: 'Old yakitori stalls under the Yamanote Line at Yurakucho Station. Best old-Tokyo atmosphere. Any free evening.', lat: 35.6745, lng: 139.7630 },
      { name: 'Afuri ramen', meta: '¥1,200–1,500, no reservation', text: 'Yuzu shio (citrus salt) ramen, light, aromatic. Fallback if Fuunji missed. Multiple locations.' },
      { name: 'Kanda Yabu Soba (historic)', meta: '¥1,500, no reservation, closed Tuesdays', text: 'Tokyo\'s most historic soba, 1880. Cold zaru soba. Easy walk from Akihabara base.', lat: 35.6960, lng: 139.7700 },
      { star: true, name: 'Kitsuneya beef bowl, Tsukiji', meta: '¥800–1,200, no reservation, tiny counter', text: 'Legendary hole-in-the-wall gyudon; deep offal-and-beef bowl. Inside Tsukiji Outer Market; pair it with the market morning. Any free afternoon.', lat: 35.6655, lng: 139.7707 },
      { name: 'Shodai potato curry noodles', meta: '¥1,200–1,500, check hours', text: 'Rich potato-based curry noodles, unlike anything else on the trip. Check current location first.' },
      { name: 'Convenience store culture', meta: '¥100–500 per item', text: '7-Eleven: egg salad sando (¥220), hot karaage (¥130), strawberry daifuku (¥180), onigiri; nikuman pork bun (avoid). Hot coffee ¥100.' },
    ],
    cafes: [
      { name: 'Iyoshi Cola (伊良コーラ)', text: 'Japan\'s top craft cola, yakuzen herbal spices. Pop-up carts in Shibuya, Shimokitazawa, creative neighbourhoods. See the cart, stop.' },
      { name: 'Pelikan Bakery, Asakusa', text: 'D13: old-school bakery since 1942. Thick toast, white loaves. Opens 9 AM, sells out by late morning. 5 min from Senso-ji.', lat: 35.7108, lng: 139.7940 },
      { name: 'About Life Coffee Brewers, Dogenzaka', text: 'D15: tiny standing-room specialty coffee. Order and move.', lat: 35.6570, lng: 139.6960 },
      { name: 'Streamer Coffee Company, Harajuku', text: 'D15: latte art and specialty filter coffee. Harajuku branch is closest to Cat Street.', lat: 35.6690, lng: 139.7065 },
      { name: 'Tokyu Food Show, Shibuya Hikarie', text: 'D15: department store basement food hall. Wagashi, bento, patisseries.', lat: 35.6590, lng: 139.7036 },
    ],
  },
];

export const TIPS = [
  { title: 'Money & payments', items: [
    'Suica: load ¥5,000–10,000 at Narita 7-Bank ATM; top up at station ticket machines. Transit, convenience stores, some vending machines in Tokyo, Osaka, Kyoto.',
    'Cash: 30–40% of small restaurants and markets cash-only. Budget ¥80,000–120,000/person. ATMs: 7-Bank (inside 7-Eleven), Japan Post.',
    'Tax-free: passport at major department stores and electronics shops (Bic Camera, Yodobashi), 10% consumption tax refund. Min ¥5,000–10,000/transaction.',
    'Narita duty-free on departure: Japanese whisky (Nikka, Yamazaki), Royce chocolate, matcha Kit Kats. Same price as Tokyo, no carrying for 17 days.',
  ] },
  { title: 'What things cost', items: [
    'Convenience store: onigiri ¥120–180, egg salad sando ¥200–250, hot coffee ¥100–150, karaage ¥130–160, strawberry daifuku ¥200–300.',
    'Ramen / soba / udon: ¥900–1,500 a bowl; under ¥1,200 is good value. Best ramen is cheap.',
    'Izakaya dinner (casual): ¥2,500–5,000/person. Higher-end ¥6,000–8,000.',
    'Café coffee: pour-over or espresso ¥600–900. Vending machine ¥100–150 (surprisingly good).',
    'Temple / shrine: ¥300–600 typical, major sites ¥400–1,000. Often free outer area, paid inner hall.',
    'Taxis: base ¥500–700, then ~¥100/km. 15 min in Kyoto ¥1,000–1,500. After 11 PM +20–30%.',
    'Matsumoto Kiyoshi: skincare, health. Don Quijote: snacks, electronics, gifts, quirky items.',
    'Onitsuka Tiger: ¥8,000–25,000 official vs ¥30,000–50,000+ resale abroad. Sizes run small; try in-store. Tokyo: Shinjuku, Harajuku, Ginza. Osaka: Shinsaibashi.',
    '100-yen shops (Daiso, Seria, Can★Do): ¥110/item. Chopsticks, small ceramics, stationery, travel organizers. Seria more aesthetic.',
    'Fine dining reference: ramen ¥1,000, kaiseki ¥15,000–25,000, omakase sushi ¥25,000–45,000+, wagyu sukiyaki ¥10,000–18,000, yoshoku ¥2,000–4,000, street stall ¥300–800.',
  ] },
  { title: 'Getting around', items: [
    'Luggage forwarding (takuhaibin): ¥1,500–2,500/bag, 1–2 days. Tokyo → Kyoto Granbell: ship Oct 19. Kyoto → Akihabara Washington: ship Oct 25 evening (by 8 PM), NOT Oct 26 (USJ day). Hotel front desk or any FamilyMart/7-Eleven, Yamato receipt.',
    'Coin lockers: ¥400–700/day at all major stations. Essential on day trips.',
    'Kyoto bus day pass: ¥600 unlimited buses. Buy on your first boarding.',
    'Taxi app (GO or S.Ride): download beforehand. Beats hailing in Kyoto and Osaka. English, pay in-app.',
    'Shinkansen oversized luggage: bags over 160cm total (H+W+D) need a reserved oversized baggage space; book a rear-row seat in a designated car. Free, select at reservation. Applies Oct 21 and Oct 27.',
    'Green car (first class): extra space and quiet, roughly ¥5,000–7,000 more per person per journey.',
  ] },
  { title: 'Dining', items: [
    'Booking apps: Pocket Concierge (pocketconcierge.com), Tableall (tableall.com), English, high-end. Otherwise hotel concierge.',
    'Last orders 30–60 min before closing. Closes 10 PM → arrive by 8:30 PM.',
    'Queuing is normal and legitimate. Most lines move fast. Queue as a pair.',
    'No eating while walking except festival zones and covered markets (Nishiki, Kuromon). Stand still or sit.',
    'Pork-free / halal: seafood widely available. For beef say \'buta nashi\' (no pork); confirm no mirin or sake in broth. Shoyu (soy) or shio (salt) ramen; ask about stock. Safe izakaya orders: edamame, tofu, seafood skewers, chicken (tori) yakitori, vegetable tempura. Avoid tonkotsu, gyoza, yakisoba. Muslim-friendly restaurants in Asakusa and Harajuku; ask concierge.',
  ] },
  { title: 'Daily life', items: [
    'Shoes: slip-ons; off at every temple. No lace-ups on Kyoto days.',
    'Google Translate camera mode reads menus live. Download the Japanese offline pack beforehand.',
    'Trains: phone silent, no calls, no eating on local trains (bullet trains fine). Priority seats near doors for elderly/pregnant; avoid even when empty.',
    'Pharmacy: Matsumoto Kiyoshi (green and yellow sign) on most shopping streets. Sunscreen, blister pads, motion sickness, cold medicine.',
    'Late October: 15–19°C Tokyo and Kyoto. Light jacket mornings/evenings. Fushimi Inari dawn (6 AM, Oct 24) cold; bring a layer. Rain possible, usually brief.',
    'SIM: stick with your eSIM activated at Narita. Backups: IIJmio and Rakuten Mobile eSIMs.',
  ] },
  { title: 'Shopping', items: [
    'Vintage: Shimokitazawa (Oct 19) creative/indie, Harajuku Cat Street (Oct 30) upscale, Amerikamura Osaka (Oct 22) streetwear.',
    'Knives: Kappabashi (Oct 28). Masamoto, Tojiro or Sakai Takayuki. Gyuto or santoku, best souvenir.',
    'Stationery: Itoya in Ginza is 12 floors of Japanese stationery. Worth 20 minutes.',
    'Airport: most things cheaper in the city. Exceptions: whisky and perishable food, duty-free on the way out.',
    'Evening hours: Don Quijote 24 hours or until midnight at most locations (Akihabara, Shinjuku, Shibuya, Dotonbori). Uniqlo flagships 9–10 PM. ABC-Mart 9 PM. Onitsuka Tiger 8 PM. Loft / Hands 9 PM.',
    'Group shopping: vintage luxury (bags + watches) → Komehyo Ginza flagship (D4 + D12). Onitsuka Tiger and Uniqlo flagships, D4 Ginza. Osaka streetwear → Amerika-mura (D7). Don Quijote and Shibuya Parco for late-night souvenirs and general.',
  ] },
];

// Curated suggestions for the open slots and free time. `day` links the card to a day; `slot` is the open item it fills.
export const SUGGESTIONS = [
  { id: 's-d06-dinner', day: 'd06', slot: 'NASA date dinner, Oct 21 ~7 PM', who: 'nasa', title: 'First Kyoto night dinner', picks: [
    { name: 'Kikunoi Roan (Gion kaiseki)', why: 'Two-star kaiseki 5 min from the Granbell, English online booking. The first-night Kyoto meal.', lat: 35.0040, lng: 135.7705 },
    { name: 'Pontocho kappo counter', why: 'Any Pontocho kappo counter, river-facing seat: relaxed, seasonal, no formality. Concierge to find one handling no-pork.', lat: 35.0067, lng: 135.7707 },
    { name: 'Gion Kinana for dessert after', why: 'Matcha soft serve walk-up window on the way back to the hotel.', lat: 35.0030, lng: 135.7745 },
  ] },
  { id: 's-d07-dinner', day: 'd07', slot: 'Group dinner Dotonbori/Namba, Oct 22 6 PM', title: 'Osaka group dinner', picks: [
    { name: 'Chibo Dotonbori (okonomiyaki)', why: 'On the strip, big tables, à la carte so pork-free is easy (seafood or beef okonomiyaki).', lat: 34.6686, lng: 135.5030 },
    { name: 'Daruma Namba (kushikatsu)', why: 'Fast, fun, skewer by skewer — pick seafood, beef, vegetables. No reservation.', lat: 34.6670, lng: 135.5020 },
    { name: 'Kani Douraku Dotonbori (crab)', why: 'Giant moving crab sign. Crab courses, halal-safe by nature; book for all four.', lat: 34.6688, lng: 135.5018 },
  ] },
  { id: 's-d08-night', day: 'd08', slot: 'NASA booked Kyoto night (D8 or D9)', who: 'nasa', title: 'The one booked Kyoto dinner', picks: [
    { name: 'Mishima-tei (wagyu sukiyaki, since 1873)', why: 'The classic. Book for 2, confirm pork-free broth, no alcohol. Sanjo, 10 min from hotel.', lat: 35.0088, lng: 135.7672 },
    { name: 'Kikunoi Roan', why: 'If you didn\'t use it on D6. Two Michelin stars, seasonal kaiseki.', lat: 35.0040, lng: 135.7705 },
    { name: 'Kichi Kichi omurice (if you get through)', why: 'Call at 11 AM any Kyoto morning. If they say yes, make that the night.', lat: 35.0075, lng: 135.7700 },
  ] },
  { id: 's-d09-eve', day: 'd09', slot: 'NASA free evening after Orizuruya', who: 'nasa', title: 'Loose Kyoto evening ideas', picks: [
    { name: 'Kamo River walk at dusk', why: 'South bank from Shijo Bridge, lit at night. Free, 5 min from the hotel.', lat: 35.0040, lng: 135.7715 },
    { name: 'Yakitori or ramen counter in Gion backstreets', why: 'Up since 6 AM: something short and good, early night before the kimono dawn.' },
    { name: 'Meet M&M after GEAR (~9:30 PM)', why: 'Pontocho is right there — dessert or tea together.', lat: 35.0067, lng: 135.7707 },
  ] },
  { id: 's-d10-free', day: 'd10', slot: 'Free Higashiyama afternoon in kimono', title: 'Kimono afternoon', picks: [
    { name: 'Kennin-ji', why: 'Kyoto\'s oldest Zen temple, 10 min from hotel, ¥600. Twin dragon ceiling, gravel garden; perfect in kimono.', lat: 35.0005, lng: 135.7735 },
    { name: '% Arabica Higashiyama', why: 'Below Yasaka Pagoda, Kyoto\'s most photographed café. In kimono: the shot.', lat: 34.9992, lng: 135.7781 },
    { name: 'Philosopher\'s Path toward Ginkaku-ji', why: 'If you want to walk further — taxi north and stroll back along the canal.', lat: 35.0210, lng: 135.7950 },
  ] },
  { id: 's-d12-morning', day: 'd12', slot: 'Flexible Kyoto morning', title: 'Last Kyoto morning', picks: [
    { name: 'Wife & Husband café', why: 'Indie café, north Kyoto, slow pour-over morning. 20-min taxi.', lat: 35.0434, lng: 135.7617 },
    { name: 'Kennin-ji', why: 'If you skipped it on D10. Opens 10 AM, right on the doorstep.', lat: 35.0005, lng: 135.7735 },
    { name: 'Kyoto Railway Museum', why: 'Near Kyoto Station, en route anyway. Closed Wed; open Tue Oct 27.', lat: 34.9870, lng: 135.7420 },
  ] },
  { id: 's-d12-mm', day: 'd12', slot: 'M&M romantic evening in Tokyo', who: 'mm', title: 'M&M Tokyo night', picks: [
    { name: 'Yakitori under the tracks, Yurakucho', why: 'Next to Ginza where you split. Smoke, skewers, old Tokyo. Chicken/seafood skewers only.', lat: 35.6745, lng: 139.7630 },
    { name: 'Marunouchi + Tokyo Station at night', why: 'Imperial Palace moat and red-brick station facade lit up. Free, 10-min walk from Ginza.', lat: 35.6800, lng: 139.7640 },
    { name: 'Ginza Six rooftop garden', why: 'Free rooftop above the shops, open until 11 PM. Quiet view over Ginza.', lat: 35.6697, lng: 139.7640 },
  ] },
  { id: 's-d15-dinner', day: 'd15', slot: 'Group dinner Shinjuku, Oct 30 ~10 PM', title: 'Shinjuku late dinner', picks: [
    { name: 'Gyukatsu Motomura Shinjuku', why: 'Wagyu cutlet seared yourself on a stone. Pork-free, fast, several Shinjuku branches, open late.', lat: 35.6920, lng: 139.7050 },
    { name: 'Yakiniku in Kabukicho', why: 'Charcoal-grilled beef, à la carte, no-pork easy. Plenty open past midnight.', lat: 35.6950, lng: 139.7021 },
    { name: 'Shoyu/shio ramen on Shinjuku Higashi-dori', why: 'If everyone is shopped out — ask for chicken or seafood stock.' },
  ] },
  { id: 's-d16-morning', day: 'd16', slot: 'Free Halloween morning', title: 'Last free morning in Tokyo', picks: [
    { name: 'Daiwa Sushi at Toyosu (tuna omakase)', why: 'The unscheduled must-eat. Queue from 6:30 AM, done by 9.', lat: 35.6450, lng: 139.7850 },
    { name: 'Kitsuneya gyudon, Tsukiji', why: 'Legendary tiny-counter beef bowl in Tsukiji Outer Market. Early lunch.', lat: 35.6655, lng: 139.7707 },
    { name: 'Yanaka Ginza + Nezu Shrine', why: 'Old shitamachi Tokyo 10 min from the hotel. Cats, food stalls, torii tunnel at Nezu.', lat: 35.7277, lng: 139.7653 },
  ] },
  { id: 's-anytime', day: null, slot: 'Any free hour', title: 'Fill any gap', picks: [
    { name: 'Depachika lap (Isetan Shinjuku, Tokyu Food Show)', why: 'Department store food basements. Better than any market for prepared items.' },
    { name: 'Tokyo Toilet Project spots', why: 'Harajuku (Shigeru Ban), Jingu-dori Park (Toyo Ito), Nanago Mori Park (Marc Newson). Free, 2-min detours.' },
    { name: 'Don Quijote late-night run', why: 'Akihabara (until midnight), Dotonbori, Ikebukuro (until 5 AM). Souvenirs, snacks, everything.' },
    { name: 'Iyoshi Cola cart', why: 'Any time you see it in Shibuya or Shimokitazawa — stop.' },
  ] },
];
