---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface brief — index.html (the whole app shell)

Scope: the single-page app (Days, Map, Bookings, Guide, Ideas). Visitor mode: Operate.
Audience: four travellers on phones, outdoors in Japan, Oct 16 – Nov 1 2026. Job: "what's next, where, how do I get there" in two seconds; tick stops; make shared on-the-day choices.
Proof/content: data/itinerary.js (212 events, 142 pins), data/guide.js. Constraints: offline PWA, no runtime CDN, 44px targets, 4.5:1 text, standard web controls, All/NASA/M&M filter, keep every existing feature.

## Direction contract

THESIS: A day is a rail line. Stops are stations, legs are coloured by how you travel, and the next station is the biggest thing on the screen. It refuses the travel-app default of same-size cards in a scrolling column with a map tucked behind a button.

OWN-WORLD: Japanese rail signage. Ground is pure white (night mode: pure black), ink is true black, neutrals snapped to a seven-step ramp. Line colours are data only: green walk, blue rail, orange taxi, teal water/ropeway, grey flight. One accent, signage red, for "now" and primary actions. Type: BIZ UDPGothic (a universal-design gothic made for public signage), one family, two weights, tabular figures. Station-number circles (3px black ring, white fill), 4px line segments, pictograms as drawn SVG icons in one stroke weight. No cards, no shadows, hairlines at one device pixel.

STORY: Open the app and see today's line: where you are, what's next and in how many minutes of walking, which stops are confirmed, what still needs deciding. Tick a station and it fills green for everyone. Tap its number and the map jumps there. Tap a leg and Google Maps navigates.

FIRST VIEWPORT (phone): black signboard header with the trip name, All/NASA/M&M, search and sync. Under it the day strip as one line of 17 stations with city-coloured segments and the current day's station enlarged. Then the day's name board: large bold title, date sentence under it, energy as three bars, hotel link. Then the signature move: the day's route diagram, a horizontal line of numbered station circles with leg colours and the walk/taxi minutes under each gap, scrollable; the next stop sits at 1.6× with its time large. Below, the vertical rail: each stop a station row (number, time, name, description, done control) joined by a coloured leg with its pictogram and a Directions link. Primary action = the done control on the next stop and the Directions link on its leg.

FORM: Rail station signage + route diagram (Impeccable's pick, position 1 of 7 grounded candidates; roll assigned 7, user chose the pick). Seed key 4bf9d1b2. Raised by the hand: neutrals on a fixed tonal ramp (exposure record); every rule at one device pixel (reference setting); the next stop lifts while the rest dim (streaming wall); one monumental next-stop figure (metro tiles).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved
None. Build path: code-led (no image generation in this harness).
