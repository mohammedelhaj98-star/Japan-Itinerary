---
version: 2
slug: "index-html"
primary_target: "index.html"
related_targets: ["prototypes/tools.html", "hub/index.html", "photos.html"]
---

# Surface brief — index.html (the trip page and its tools)

Scope: the trip page (map + the day's passes) and the tools it opens (Expenses, Bookings, Taxi cards, Ideas, Settings in prototypes/tools.html; Photos). Visitor mode: Operate.
Audience: four travellers (two couples, NASA and M&M) on phones, outdoors in Japan, Oct 16 – Nov 1 2026. Job: "what's next, where, how do I get there" in two seconds; stamp stops; make shared on-the-day choices; log and settle money.
Proof/content: data/itinerary.js, data/guide.js. Constraints: offline PWA, 44px targets, 4.5:1 text, All/NASA/M&M filter, keep every existing feature. Visual system: DESIGN.md ("The Pass Wallet").

## Direction contract

THESIS: The day is a stack of passes in a travel wallet, laid over a live map. The open pass is the next stop; the rest fan out beneath it. Place and plan are always in the same view.

OWN-WORLD: See DESIGN.md. Warm paper ground, white cards, near-black ink; colour-filled passes whose colour says what the stop is; frosted glass for anything floating over the map; Instrument Serif for money, Zen Kaku Gothic for UI, Zen Old Mincho for Japanese.

STORY: Open the app on today. The map shows the day's pins and routes; the sheet shows the day's name, weather, sunrise and sunset, and the open pass for what's next with its time, how to get there and Directions. Stamp it 済 when done and it's done on all four phones. Swipe the sheet down to give the map the screen; flick through the passes; the day dial on the side shows every stop's time round an arc. ¥+ logs an expense for the day on screen in two taps.

FIRST VIEWPORT (phone): full-screen map; a glass top bar with the previous/next day arrows, the day pill (tap for the calendar) and the ¥ currency button; the sheet at half height with All / NASA / M&M, the day header and the open pass on top of the pile; the tools bubble (+) and ¥+ bottom right in the thumb zone. Primary actions = Directions and Stamp on the open pass; ¥+ for money.

## Unresolved
None.
