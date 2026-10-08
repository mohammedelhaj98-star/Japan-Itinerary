// Bookings, food guide, trip tips and curated suggestions.

export const BOOKINGS = {
  confirmed: [
    { title: 'Omakase Sushi Dinner', when: 'Oct 18 · D3 · 8:30 PM', detail: 'Sushi Yoshikawa Kaido Shinjuku, 7-19-7 Nishi-Shinjuku, Sun Rose Shinjuku 101. 19-course omakase, ¥14,300/person. Arrive 8:20 PM.', day: 'd03' },
    { title: 'All hotels', when: 'Whole trip', detail: 'Sotetsu Grand Fresa (Oct 16–20), Mizunoto (Oct 20–21), Kyoto Granbell (Oct 21–27, 6 nights), Akihabara Washington (Oct 27–Nov 1). No Osaka hotel — day-tripping from Kyoto.' },
    { title: 'Odakyu Romancecar — Hakone 41', when: 'Oct 20 · D5 · 7:37 AM', detail: 'Booked on EMot app. Shinjuku 7:37 → Hakone-Yumoto 9:22. Car 1, right-side seats (C/D). ¥1,300 surcharge ticket confirmed. Buy Hakone Free Pass separately at the Odakyu Shinjuku counter that morning (¥6,100/person).', day: 'd05' },
    { title: 'Shinkansen Odawara → Kyoto', when: 'Oct 21 · D6 · 12:07 PM', detail: 'Booked on Klook. Hikari 12:07 → Kyoto ~2:10 PM. Right-side seats (D/E) for Fuji. Only overnight bags on this leg.', day: 'd06' },
    { title: 'Itsukichaya Arashiyama Honten — lunch', when: 'Oct 23 · D8 · 12:30 PM', detail: 'Booked. Cash only — bring yen. Near Togetsukyo Bridge.', day: 'd08' },
    { title: 'Samurai Class — Kenbu Theater', when: 'Oct 23 · D8 · 2:15 PM', detail: '2 hours, Gion.', day: 'd08' },
    { title: 'Nishiki Orizuruya — tea ceremony + calligraphy', when: 'Oct 24 · D9 · 1:30 PM', detail: '2 hours combined.', day: 'd09' },
    { title: 'Kimono Rental — Momo Kimono', when: 'Oct 25 · D10 · 9:30 AM', detail: 'Shop confirmed ready by 10:30 AM. Photographer meets 10:45 AM near Kodai-ji (11-min walk). Return 4:30 PM or later.', day: 'd10' },
    { title: 'Street Photographer — kimono shoot', when: 'Oct 25 · D10 · 10:45 AM', detail: '2-hour circuit. Meet near Kodai-ji.', day: 'd10' },
    { title: 'Hikiniku to Come 挽肉と米', when: 'Oct 25 · D10 · 1:30 PM', detail: 'Arrive within 10 min of slot. Apron provided. ¥1,800/person + ¥1,000 priority ticket. Cash or card.', day: 'd10' },
    { title: 'Universal Studios Japan — Express Pass 7', when: 'Oct 26 · D11', detail: 'EP7 Minecart & Selection for all. Flight of the Hippogriff 12:00–12:30. Super Nintendo World timed entry 19:10–20:10: Mario Kart 19:10, Yoshi\'s 19:40, Mine Cart Madness 20:10.', day: 'd11' },
    { title: 'Shinkansen Kyoto → Tokyo', when: 'Oct 27 · D12 · 2:01 PM', detail: 'Arrives Tokyo 4:15 PM. Left-side seats (A/B) for Fuji heading east. Rear-row seats in the large-baggage car.', day: 'd12' },
    { title: 'Yoroniku よろにく Ebisu — NASA dinner', when: 'Oct 27 · D12 · 9:30 PM', detail: 'NASA only. Premium A5 wagyu yakiniku.', day: 'd12', who: 'nasa' },
    { title: '禅 Zen Craft Chopsticks Workshop', when: 'Oct 28 · D13 · 1:00 PM', detail: '~1 hour, Asakusa.', day: 'd13' },
    { title: 'DisneySea 1-Day Passport', when: 'Oct 29 · D14', detail: 'Tickets purchased.', day: 'd14' },
  ],
  closer: [
    { title: 'Halloween dinner — Shoutaian, Ikebukuro', when: 'Oct 31 · D16 · ~7 PM', detail: 'BOOK NOW. Halal Wagyu Shabu Shabu Shoutaian — fully halal, no alcohol, group table. Call or book online, confirm group of 4 and halal requirements. Alt: Palmyra (Syrian/Lebanese, Ikebukuro).', day: 'd16', urgent: true },
    { title: 'NASA date dinner — Kyoto', when: 'Oct 21 · D6 · 7 PM', detail: 'Restaurant TBD — Gion/Pontocho. Kaiseki, kappo, or a good izakaya. Book once decided.', day: 'd06', who: 'nasa' },
    { title: 'Group dinner — Dotonbori/Namba', when: 'Oct 22 · D7 · 6 PM', detail: 'Book something that works for all four closer to the date, or decide on the day. À la carte is easier for halal/pork-free.', day: 'd07' },
    { title: 'NASA Kyoto dinner (D8 or D9)', when: 'Oct 23 or 24', detail: 'One of the two nights gets a proper booked dinner: Mishima-tei sukiyaki or Kikunoi Roan kaiseki are the top picks. Book as a couple.', day: 'd08', who: 'nasa' },
    { title: 'Disney Premier Access', when: 'Oct 29 · D14 · day-of', detail: 'Buy via TDR app the MOMENT gates open. Priority 1: all three Fantasy Springs DPAs (Frozen, Peter Pan, Rapunzel). Priority 2: Journey to the Center of the Earth. Priority 3: Toy Story Mania. Gone within 30 min.', day: 'd14' },
    { title: 'DisneySea shows', when: 'Oct 29 · D14 · day-of', detail: 'Most are walk-up or day-of lottery via the TDR app. Check for paid premium shows or lottery shows. Halloween season often has special evening shows — enter lottery as soon as park opens.', day: 'd14' },
    { title: 'Dotonbori Don Quijote Ferris Wheel', when: 'Oct 22 · D7', detail: 'Confirm if advance booking is needed or walk-up only — check donki.com or just show up. ~¥500–700/person.', day: 'd07' },
    { title: 'Tsutenkaku Tower Slider', when: 'Oct 22 · D7', detail: '60m body slide. Buy at the ticket counter the moment you arrive — slots sell out daily. ¥1,000 on top of observatory entry (¥1,100).', day: 'd07' },
    { title: 'Kichi Kichi Omurice — Kyoto', when: 'Any Kyoto evening', detail: 'Chef Yukimura\'s tableside omurice. Day-of reservations only: call the moment they open (typically 11 AM–12 PM JST) for that evening. Fills instantly. Try every Kyoto morning. +81-75-254-4460.', tel: '+81752544460' },
    { title: 'Wagyumafia Cutlet Sandwich', when: 'Any Tokyo day', detail: 'Pre-order a day ahead online for pickup at Ebisu. ¥4,000.' },
    { title: 'Restaurant reservations in Japan', when: 'On arrival', detail: 'For any walk-in omakase not pre-booked: ask the hotel concierge on arrival. Tokyo hotel concierges often have direct access to otherwise-inaccessible restaurants. Pocket Concierge and Tableall have English interfaces for high-end spots.' },
  ],
};

export const FOOD = [
  {
    city: 'Tokyo — first leg (Oct 16–20)', items: [
      { star: true, name: 'Omakase Sushi — Sushi Yoshikawa Kaido Shinjuku', meta: '¥14,300/person · CONFIRMED 8:30 PM Oct 18', text: '19-course Edomae omakase. Arrive 8:20 PM.', lat: 35.6957, lng: 139.6978 },
      { star: true, name: 'Tuna Omakase — Daiwa Sushi (Toyosu Market)', meta: '¥6,000–8,000/person · no reservation · queue from 6:30 AM', text: 'The original Tsukiji Daiwa, now relocated to Toyosu. Exceptional tuna quality direct from the market. Queue early. Add to Oct 31 morning or do as a standalone.', lat: 35.6450, lng: 139.7850 },
      { name: 'Ramen — Fuunji (Nishi-Shinjuku)', meta: '¥1,100 · lunch only · queue 20–40 min', text: 'Tsukemen (dipping ramen). One of the most recommended ramen shops in Tokyo. Opens 11 AM.', lat: 35.6872, lng: 139.6985 },
      { name: 'Wagyu Katsu Sando — Wagyumafia The Cutlet Sandwich', meta: '¥4,000 · pre-order required online', text: 'A thick wagyu beef cutlet sandwich. Pre-order a day ahead for pickup at Ebisu. Do this.', lat: 35.6467, lng: 139.7101 },
      { name: 'Ramen Experience — Ichiran', meta: '¥1,000–1,200 · no reservation · any time', text: 'Private solo ramen booths. Chain but uniquely Japanese — you order via form, eat alone, bowl comes through a curtain. There\'s one on Waseda-dori near the hotel.' },
      { name: 'Depachika — Isetan Shinjuku B1–B2', meta: 'Free entry · any afternoon', text: 'Japanese department store basements. Isetan Shinjuku is the best: wagashi, prepared bento, pastries, sake, chocolate.', lat: 35.6918, lng: 139.7045 },
    ],
    cafes: [
      { name: 'Bear Pond Espresso · Shimokitazawa', text: 'D4: legendary single-origin espresso. No phone policy, cash only, closes when coffee runs out. Queue before opening.', lat: 35.6625, lng: 139.6670 },
      { name: 'Fuglen Tokyo · Tomigaya', text: 'D15 area: Norwegian specialty roaster between Harajuku and Shibuya. Pour-overs and pastries; natural wine bar in the evenings.', lat: 35.6680, lng: 139.6920 },
      { name: 'Starbucks Reserve Roastery · Nakameguro', text: 'Four-storey experience store along the canal. Near Daikanyama — completely unlike a regular Starbucks.', lat: 35.6493, lng: 139.6926 },
      { name: 'Melon pan from a bakery window', text: '¥150–200. Japan\'s sweet bread with a crisp sugar crust. Best warm. Good on any morning between activities.' },
    ],
  },
  {
    city: 'Kyoto (Oct 21–27)', items: [
      { star: true, name: 'Wagyu Sukiyaki — Mishima-tei (Sanjo)', meta: '¥10,000–15,000/person · must book · since 1873', text: 'Kyoto\'s most historic wagyu restaurant. The beef sukiyaki is slow, ceremonial, and extraordinary. A great pick for the D8/D9 booked night. Confirm pork-free broth, no alcohol.', lat: 35.0088, lng: 135.7672 },
      { star: true, name: 'Kaiseki — Kikunoi Roan (Gion)', meta: '¥15,000–25,000/person · book ahead · 2 Michelin stars', text: 'The accessible sister to the 3-star Honten. True multi-course Kyoto kaiseki with seasonal ingredients. English reservations via their website.', lat: 35.0040, lng: 135.7705 },
      { name: 'Tofu Kaiseki (Yudofu) — Arashiyama', meta: '¥3,000–5,000 · no reservation', text: 'Kyoto\'s signature cuisine. Silken tofu in dashi broth. Already in your D8 Arashiyama lunch at Itsukichaya.' },
      { name: 'Matcha Everything — Nishiki Market + Gion', meta: '¥200–800 per item', text: 'Nishiki has matcha mochi, soft serve, and matcha nuts. In Gion: Gion Tsujiri and Itohkyuemon are standouts.' },
      { name: 'Obanzai (Kyoto home cooking)', meta: '¥1,500–2,500', text: 'Small plates of pickles, tofu, greens, fish in light dashi. Find it in Nishiki or small dinner spots in Gion.' },
      { name: 'Kichi Kichi Omurice · Nishiki area', meta: 'Day-of phone reservations only', text: 'Chef\'s theatrical tableside omurice. Call the moment lines open (11 AM–12 PM) for that evening; ask the concierge to help.', lat: 35.0075, lng: 135.7700 },
    ],
    cafes: [
      { name: '% Arabica Kyoto · Higashiyama (Yasaka Pagoda)', text: 'D10 area: on Yasaka-dori below the pagoda, right on the kimono circuit. One of the most photographed café spots in Kyoto. Queue moves fast.', lat: 34.9992, lng: 135.7781 },
      { name: 'Wife & Husband · Kuramaguchi', text: 'Beloved indie café with vintage furniture and home baking. A deliberate 20-min taxi detour — worth it for a slower morning. Check hours.', lat: 35.0434, lng: 135.7617 },
      { name: 'Omen · Ginkaku-ji area', text: 'Thick handmade udon with dipping broth. 5-min walk from Ginkaku-ji — a reliable north-east Kyoto lunch.', lat: 35.0250, lng: 135.7930 },
      { name: 'Gion Kinana · Gion', text: 'Matcha soft serve and mochi ice cream from a walk-up window near the hotel. Among the best matcha soft serve in Kyoto.', lat: 35.0030, lng: 135.7745 },
      { name: 'AWOMB Karasuma · central Kyoto', text: 'Roll-your-own temaki with seasonal ingredients arranged in a bento box, Zen-garden-style room. Book ahead.', lat: 35.0075, lng: 135.7600 },
      { name: 'Yoshimura · Arashiyama riverfront', text: 'D8 backup lunch: soba and yudofu right on the Katsura River near Togetsukyo Bridge. Window seats for mountain views.', lat: 35.0132, lng: 135.6778 },
    ],
  },
  {
    city: 'Osaka (Oct 22 full day)', items: [
      { star: true, name: 'Takoyaki — Wanaka Honten (Dotonbori)', meta: '¥700 / 6 pieces · short queue', text: 'The gold standard. Crispy outside, liquid inside, proper bonito flakes and sauce.', lat: 34.6680, lng: 135.5020 },
      { star: true, name: 'Kushikatsu — Daruma Shinsekai (original)', meta: '¥2,500–4,000 · no reservation', text: 'Older, more character, surrounded by the actual retro neighbourhood. You\'re in Shinsekai anyway on D7. The double-dip rule is sacred: one dip per skewer.', lat: 34.6523, lng: 135.5060 },
      { name: 'Kushikatsu — Daruma (Namba branch)', meta: '¥2,500–4,000 · no reservation', text: 'More practical on your route if you skip the Shinsekai one.', lat: 34.6670, lng: 135.5020 },
      { name: 'Okonomiyaki — Kiji (Umeda) or Chibo (Dotonbori)', meta: '¥1,200–1,800 · no reservation', text: 'Osaka-style savory pancake. Kiji is the more local pick; Chibo is on your Dotonbori route.', lat: 34.6686, lng: 135.5030 },
      { name: '24-Hour Ramen — Kinryu Ramen (Dotonbori)', meta: '¥850 · no reservation', text: 'The giant golden dragon sign. Reliable Osaka soy ramen at midnight or post-dinner.', lat: 34.6685, lng: 135.5025 },
      { name: 'Kuromon Ichiba crawl (already in plan)', meta: '¥2,500–3,500/person walking', text: 'Giant Nihon scallop on skewer, Daiwa wagyu nigiri, Maruhachi sea urchin, Kani Douraku crab tasting. Eat slowly across multiple stalls — this is lunch.', lat: 34.6655, lng: 135.5063 },
      { star: true, name: 'Cream Puffs — Mooken', meta: '¥300–500 · walk-in · Dotonbori/Namba', text: 'Famous Osaka cream puffs — track these down during the Dotonbori crawl.' },
    ],
    cafes: [
      { name: '% Arabica Osaka · Kitahama', text: 'Canal-side location north of Namba. Could fit on the route to Osaka Castle if you want a coffee stop.', lat: 34.6915, lng: 135.5070 },
      { name: 'Hozenji Yokocho cafés · Namba', text: 'Small bars and coffee spots tucked into the alley right after the Hozenji water shrine. Good for a quiet end-of-night drink before the train home.', lat: 34.6675, lng: 135.5030 },
      { name: 'Konbini food in Osaka', text: 'Osaka 7-Elevens stock local snacks — regional onigiri flavours and local sweets not available in Tokyo.' },
    ],
  },
  {
    city: 'Tokyo — second leg (Oct 27–Nov 1)', items: [
      { star: true, name: 'Tsukiji Outer Market', meta: '¥3,000–4,500/person walking', text: 'Marutake tamagoyaki (¥400), Tsukiji Tama Sushi for quick nigiri, Tsukiji Kimuraya oysters, Sushi Zanmai for budget tuna bowl. Do not eat before.', lat: 35.6654, lng: 139.7707 },
      { name: 'Yakitori Under the Tracks — Yurakucho', meta: '¥3,000–4,500 · no reservation · evenings', text: 'The alley of old yakitori stalls wedged under the Yamanote Line at Yurakucho Station. Best old-Tokyo atmosphere in the city. Any free evening.', lat: 35.6745, lng: 139.7630 },
      { name: 'Ramen — Afuri', meta: '¥1,200–1,500 · no reservation', text: 'Yuzu shio (citrus salt) ramen. Light, aromatic. If you missed Fuunji, Afuri is the consolation and it\'s excellent. Multiple locations.' },
      { name: 'Historic Soba — Kanda Yabu Soba', meta: '¥1,500 · no reservation · closed Tuesdays', text: 'Tokyo\'s most historic soba restaurant, 1880. Cold zaru soba. Near Akihabara — easy walk from base.', lat: 35.6960, lng: 139.7700 },
      { star: true, name: 'Beef Bowl — Kitsuneya (Ningyocho)', meta: '¥800–1,200 · no reservation · tiny counter', text: 'Legendary hole-in-the-wall gyudon. Deeply flavoured offal-and-beef bowl. Worth a short detour on any free afternoon.', lat: 35.6855, lng: 139.7830 },
      { name: 'Potato Curry Noodles — Shodai', meta: '¥1,200–1,500 · check hours', text: 'Rich potato-based curry noodles unlike anything else on the trip. Check current location before going.' },
      { name: 'Convenience Store Culture', meta: '¥100–500 per item', text: '7-Eleven: egg salad sando (¥220), hot karaage (¥130), strawberry daifuku (¥180), nikuman pork bun (avoid), onigiri. Hot coffee ¥100.' },
    ],
    cafes: [
      { name: 'Iyoshi Cola (伊良コーラ)', text: 'Japan\'s most celebrated craft cola, made with yakuzen herbal spices. Pop-up carts in Shibuya, Shimokitazawa and creative neighbourhoods. When you see the cart, stop.' },
      { name: 'Pelikan Bakery · Asakusa', text: 'D13: old-school Tokyo bakery since 1942. Thick toast and white loaves. Opens 9 AM, sells out by late morning. 5-min walk from Senso-ji.', lat: 35.7108, lng: 139.7940 },
      { name: 'About Life Coffee Brewers · Dogenzaka', text: 'D15: tiny standing-room specialty coffee. Order and move.', lat: 35.6570, lng: 139.6960 },
      { name: 'Streamer Coffee Company · Harajuku', text: 'D15: latte art and specialty filter coffee. Harajuku branch is closest to Cat Street.', lat: 35.6690, lng: 139.7065 },
      { name: 'Tokyu Food Show · Shibuya Hikarie', text: 'D15: department store basement food hall. Wagashi, bento, patisseries.', lat: 35.6590, lng: 139.7036 },
    ],
  },
];

export const TIPS = [
  { title: 'Money & payments', items: [
    'Suica card: load ¥5,000–10,000 on arrival via 7-Bank ATM at Narita. Top up at any station ticket machine. Covers transit + convenience stores + some vending machines across Tokyo, Osaka and Kyoto.',
    'Cash: Japan is 30–40% cash-only at small restaurants and markets. Budget ¥80,000–120,000 per person in cash. Best ATMs: 7-Bank (inside 7-Eleven) and Japan Post.',
    'Tax-free shopping: show your passport at major department stores and electronics shops (Bic Camera, Yodobashi) for 10% consumption tax refund. Minimum spend ¥5,000–10,000 per transaction.',
    'Narita duty-free: buy Japanese whisky (Nikka, Yamazaki), Royce chocolate, and matcha Kit Kats on departure. Same price as Tokyo, zero effort carrying them for 17 days.',
  ] },
  { title: 'What things cost', items: [
    'Convenience store: onigiri ¥120–180 · egg salad sando ¥200–250 · hot coffee ¥100–150 · karaage ¥130–160 · strawberry daifuku ¥200–300.',
    'Ramen / soba / udon: ¥900–1,500 for a full bowl. Anything under ¥1,200 is good value. Best ramen in Japan is cheap.',
    'Izakaya dinner (casual): ¥2,500–5,000/person. Higher-end ¥6,000–8,000.',
    'Café coffee: specialty pour-over or espresso ¥600–900. Vending machine coffee ¥100–150 (surprisingly good).',
    'Temple / shrine entry: ¥300–600 typical. Major sites ¥400–1,000. Many sites have a free outer area and paid inner hall.',
    'Taxis: base fare ¥500–700, then ~¥100/km. A 15-min taxi in Kyoto is ¥1,000–1,500. Late night (11 PM+) adds 20–30%.',
    'Don Quijote vs Matsumoto Kiyoshi: pharmacy for skincare and health products; Donki for snacks, electronics, gifts and quirky items.',
    'Onitsuka Tiger: ¥8,000–25,000 at official stores vs ¥30,000–50,000+ resale abroad. Sizes run small — try in-store. Tokyo: Shinjuku, Harajuku, Ginza. Osaka: Shinsaibashi.',
    '100-yen shops (Daiso, Seria, Can★Do): ¥110/item. Good for chopsticks, small ceramics, stationery, travel organizers. Seria is more aesthetic.',
    'Fine dining reference: ramen ¥1,000 · kaiseki ¥15,000–25,000 · omakase sushi ¥25,000–45,000+ · wagyu sukiyaki ¥10,000–18,000 · yoshoku ¥2,000–4,000 · street stall ¥300–800.',
  ] },
  { title: 'Getting around', items: [
    'Luggage forwarding (takuhaibin): ¥1,500–2,500/bag, 1–2 day delivery. Ship Tokyo → Kyoto Granbell on Oct 19. Ship Kyoto → Akihabara Washington on Oct 25 evening (by 8 PM). Do NOT wait until Oct 26 (USJ day). Book at hotel front desk or any FamilyMart/7-Eleven with the Yamato receipt.',
    'Coin lockers: ¥400–700/day at all major stations. Essential on day trips.',
    'Kyoto bus day pass: ¥600 unlimited buses. Buy on your first boarding.',
    'Taxi app (GO or S.Ride): download before you go. More reliable than hailing in Kyoto and Osaka. English interface, pay in-app.',
    'Shinkansen large luggage rule: bags over 160cm total (H+W+D) must go in a reserved oversized baggage space — book a rear-row seat in a designated car. Free, but must be selected at reservation. Both your legs (Oct 21 and Oct 27) have this.',
    'Green car (first class) is worth the upgrade if you want extra space and quiet — roughly ¥5,000–7,000 more per person per journey.',
  ] },
  { title: 'Dining', items: [
    'Booking apps: Pocket Concierge (pocketconcierge.com) and Tableall (tableall.com) have English interfaces for high-end restaurants. For anything else, ask the hotel concierge.',
    'Last order vs closing time: most restaurants take last orders 30–60 min before closing. If a restaurant closes at 10 PM, arrive by 8:30 PM.',
    'Queuing is normal and legitimate. Most lines move fast. Queue as a pair.',
    'No eating while walking outside of festival zones and covered markets (Nishiki, Kuromon). Find a spot to stand still or sit.',
    'Pork-free / halal: seafood is widely available. For beef say \'buta nashi\' (no pork) and confirm no mirin or sake in the broth. Choose shoyu (soy) or shio (salt) ramen and ask about the stock. Safe izakaya orders: edamame, tofu, seafood skewers, chicken (tori) yakitori, vegetable tempura. Avoid tonkotsu, gyoza, yakisoba. Muslim-friendly restaurants exist in Asakusa and Harajuku — ask the concierge.',
  ] },
  { title: 'Daily life', items: [
    'Shoes: slip-on footwear saves time at every temple — you remove shoes constantly. Avoid lace-ups on the Kyoto days.',
    'Google Translate camera mode works in real time on menus. Download the Japanese offline pack before you go.',
    'Train etiquette: phone on silent, no calls, no eating on local trains (bullet trains are fine). Priority seats near doors are for elderly and pregnant — avoid them even when empty.',
    'Pharmacy: Matsumoto Kiyoshi (green and yellow sign) on almost every shopping street. Sunscreen, blister pads, motion sickness, cold medicine.',
    'Weather in late October: 15–19°C in Tokyo and Kyoto. Light jacket for mornings and evenings. The Fushimi Inari dawn (6 AM, Oct 24) will feel cold — bring a layer. Rain possible but usually brief.',
    'SIM: stick with your eSIM activated at Narita. Backups: IIJmio and Rakuten Mobile eSIMs.',
  ] },
  { title: 'Shopping', items: [
    'Best vintage: Shimokitazawa (Oct 19) for creative/eclectic indie pieces, Harajuku Cat Street (Oct 30) for upscale vintage, Amerikamura Osaka (Oct 22) for streetwear.',
    'Japanese knives: Kappabashi (Oct 28). Look for Masamoto, Tojiro, or Sakai Takayuki. A gyuto or santoku makes the best trip souvenir.',
    'Stationery: Itoya in Ginza is 12 floors of Japanese stationery. Worth 20 minutes.',
    'What not to buy at the airport: most things are cheaper in the city. Exceptions: whisky and perishable food — buy those duty-free on the way out.',
    'Evening shopping: Don Quijote is open 24 hours or until midnight at most locations — including Akihabara, Shinjuku, Shibuya, and Dotonbori. Uniqlo flagships until 9–10 PM. ABC-Mart until 9 PM. Onitsuka Tiger until 8 PM. Loft / Hands until 9 PM.',
    'Group shopping: vintage luxury (bags + watches) → Komehyo Ginza flagship (D4 + D12). Onitsuka Tiger and Uniqlo flagships on D4 Ginza. Osaka streetwear → Amerika-mura (D7). Don Quijote and Shibuya Parco for late-night souvenir and general shopping.',
  ] },
];

// Curated suggestions for the open slots and free time. `day` links the card to a day; `slot` is the open item it fills.
export const SUGGESTIONS = [
  { id: 's-d06-dinner', day: 'd06', slot: 'NASA date dinner, Oct 21 ~7 PM', who: 'nasa', title: 'First Kyoto night dinner', picks: [
    { name: 'Kikunoi Roan (Gion kaiseki)', why: 'Two-star kaiseki 5 min from the Granbell, English online booking. The most "first night in Kyoto" meal possible.', lat: 35.0040, lng: 135.7705 },
    { name: 'Pontocho kappo counter', why: 'Any kappo counter on Pontocho with a river-facing seat — relaxed, seasonal, no formality. Ask the concierge for one that handles no-pork.', lat: 35.0067, lng: 135.7707 },
    { name: 'Gion Kinana for dessert after', why: 'Matcha soft serve walk-up window on the way back to the hotel.', lat: 35.0030, lng: 135.7745 },
  ] },
  { id: 's-d07-dinner', day: 'd07', slot: 'Group dinner Dotonbori/Namba, Oct 22 6 PM', title: 'Osaka group dinner', picks: [
    { name: 'Chibo Dotonbori (okonomiyaki)', why: 'Right on the strip, big tables, à la carte so pork-free orders are easy (seafood or beef okonomiyaki).', lat: 34.6686, lng: 135.5030 },
    { name: 'Daruma Namba (kushikatsu)', why: 'Fast, fun, skewer by skewer — pick seafood, beef, vegetables. No reservation.', lat: 34.6670, lng: 135.5020 },
    { name: 'Kani Douraku Dotonbori (crab)', why: 'The giant moving crab sign. Crab courses, halal-safe by nature, worth booking for all four.', lat: 34.6688, lng: 135.5018 },
  ] },
  { id: 's-d08-night', day: 'd08', slot: 'NASA booked Kyoto night (D8 or D9)', who: 'nasa', title: 'The one booked Kyoto dinner', picks: [
    { name: 'Mishima-tei (wagyu sukiyaki, since 1873)', why: 'The classic. Book for 2, confirm pork-free broth and no alcohol. Sanjo, 10 min from the hotel.', lat: 35.0088, lng: 135.7672 },
    { name: 'Kikunoi Roan', why: 'If you didn\'t use it on D6. Two Michelin stars, seasonal kaiseki.', lat: 35.0040, lng: 135.7705 },
    { name: 'Kichi Kichi omurice (if you get through)', why: 'Call at 11 AM any Kyoto morning. If they say yes, make that the night.', lat: 35.0075, lng: 135.7700 },
  ] },
  { id: 's-d09-eve', day: 'd09', slot: 'NASA free evening after Orizuruya', who: 'nasa', title: 'Loose Kyoto evening ideas', picks: [
    { name: 'Kamo River walk at dusk', why: 'South bank from Shijo Bridge, lit at night. Free, 5 min from the hotel.', lat: 35.0040, lng: 135.7715 },
    { name: 'Yakitori or ramen counter in Gion backstreets', why: 'You\'ve been up since 6 AM. Something short and good, then early night before the kimono dawn.' },
    { name: 'Meet M&M after GEAR (~9:30 PM)', why: 'Pontocho is right there — dessert or tea together.', lat: 35.0067, lng: 135.7707 },
  ] },
  { id: 's-d10-free', day: 'd10', slot: 'Free Higashiyama afternoon in kimono', title: 'Kimono afternoon', picks: [
    { name: 'Kennin-ji', why: 'Kyoto\'s oldest Zen temple, 10 min from the hotel, ¥600. Twin dragon ceiling + gravel garden, perfect in kimono.', lat: 35.0005, lng: 135.7735 },
    { name: '% Arabica Higashiyama', why: 'Below Yasaka Pagoda, the most photographed café in Kyoto. You\'re in kimono — this is the shot.', lat: 34.9992, lng: 135.7781 },
    { name: 'Philosopher\'s Path toward Ginkaku-ji', why: 'If you want to walk further — taxi north and stroll back along the canal.', lat: 35.0210, lng: 135.7950 },
  ] },
  { id: 's-d12-morning', day: 'd12', slot: 'Flexible Kyoto morning', title: 'Last Kyoto morning', picks: [
    { name: 'Wife & Husband café', why: 'Indie café in north Kyoto — a slow pour-over morning. 20-min taxi, worth it.', lat: 35.0434, lng: 135.7617 },
    { name: 'Kennin-ji', why: 'If you skipped it on D10. Opens 10 AM, right on the doorstep.', lat: 35.0005, lng: 135.7735 },
    { name: 'Kyoto Railway Museum', why: 'Near Kyoto Station — convenient since you\'re heading there anyway. Closed Wed, so open on Tue Oct 27.', lat: 34.9870, lng: 135.7420 },
  ] },
  { id: 's-d12-mm', day: 'd12', slot: 'M&M romantic evening in Tokyo', who: 'mm', title: 'M&M Tokyo night', picks: [
    { name: 'Yakitori under the tracks, Yurakucho', why: 'Right next to Ginza where you split. Smoke, skewers, old-Tokyo energy. Chicken/seafood skewers only.', lat: 35.6745, lng: 139.7630 },
    { name: 'Marunouchi + Tokyo Station at night', why: 'Imperial Palace moat and the red-brick station facade lit up. Free, 10-min walk from Ginza.', lat: 35.6800, lng: 139.7640 },
    { name: 'Ginza Six rooftop garden', why: 'Free rooftop above the shops, open until 11 PM. Quiet view over Ginza.', lat: 35.6697, lng: 139.7640 },
  ] },
  { id: 's-d15-dinner', day: 'd15', slot: 'Group dinner Shinjuku, Oct 30 ~10 PM', title: 'Shinjuku late dinner', picks: [
    { name: 'Gyukatsu Motomura Shinjuku', why: 'Wagyu beef cutlet you sear yourself on a stone. Pork-free, fast, several Shinjuku branches, open late.', lat: 35.6920, lng: 139.7050 },
    { name: 'Yakiniku in Kabukicho', why: 'Charcoal-grilled beef, à la carte, no-pork easy. Plenty open past midnight.', lat: 35.6950, lng: 139.7021 },
    { name: 'Shoyu/shio ramen on Shinjuku Higashi-dori', why: 'If everyone is shopped out — ask for chicken or seafood stock.' },
  ] },
  { id: 's-d16-morning', day: 'd16', slot: 'Free Halloween morning', title: 'Last free morning in Tokyo', picks: [
    { name: 'Daiwa Sushi at Toyosu (tuna omakase)', why: 'The one must-eat you haven\'t scheduled. Queue from 6:30 AM, done by 9.', lat: 35.6450, lng: 139.7850 },
    { name: 'Kitsuneya gyudon, Ningyocho', why: 'Legendary tiny-counter beef bowl, 15 min from Akihabara. Early lunch.', lat: 35.6855, lng: 139.7830 },
    { name: 'Yanaka Ginza + Nezu Shrine', why: 'Old shitamachi Tokyo 10 min from the hotel. Cats, food stalls, torii tunnel at Nezu.', lat: 35.7277, lng: 139.7653 },
  ] },
  { id: 's-anytime', day: null, slot: 'Any free hour', title: 'Fill any gap', picks: [
    { name: 'Depachika lap (Isetan Shinjuku, Tokyu Food Show)', why: 'Department store food basements. Better than any market for prepared items.' },
    { name: 'Tokyo Toilet Project spots', why: 'Harajuku (Shigeru Ban), Jingu-dori Park (Toyo Ito), Nanago Mori Park (Marc Newson). Free, 2-min detours.' },
    { name: 'Don Quijote late-night run', why: 'Akihabara (until midnight), Dotonbori, Ikebukuro (until 5 AM). Souvenirs, snacks, everything.' },
    { name: 'Iyoshi Cola cart', why: 'Any time you see it in Shibuya or Shimokitazawa — stop.' },
  ] },
];
