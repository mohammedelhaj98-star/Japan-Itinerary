# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS, no build step, Leaflet + OpenStreetMap (vendored), Cloudflare Pages + Pages Functions + Workers KV for shared state. Chosen with the user before the first build.

## Users

Four travellers on one 17-day Japan trip (Oct 16 – Nov 1, 2026): two couples, "NASA" (Naf + Sara) and "M&M" (Mariam + M). Primary scene: on a phone, one-handed, while out in Japan — walking between stops, on trains, outdoors in daylight and at night. They want "what's next, where is it, how do I get there" in two seconds. Planning at home before the trip is secondary. The group is pork-free / no-alcohol; dining notes carry that constraint.

## Product Purpose

Turn a 40-page Word itinerary into the thing they actually hold during the trip: every day as an ordered list of stops with times, how to get between them, which bookings are confirmed, what is still to decide, and a live map. Success: nobody opens the Word doc again; decisions made on the day (Fuji vs Nikko, which night gets the booked dinner) are visible to all four phones; nothing confirmed is missed.

## Positioning

The itinerary is the product, not a template around it: 212 real events, 142 real pins, real reservation times and prices, the group's own two-couple split, and shared on-the-day decisions. A generic travel app cannot carry the "choose on the day" branches, the NASA/M&M split evenings, or the booking states.

## Operating Context

Days, each with sections, timed events, travel legs (walk / taxi / train / boat / ropeway), callouts, and choose-on-the-day groups. Four hotels. Google Maps is the navigation tool they actually use for turn-by-turn; the app links out to it per stop and per leg. Shared state (done ticks, choices, suggestions, votes) syncs through the Cloudflare API; the app keeps working offline on a local copy. Installed to the home screen as a PWA.

## Capabilities and Constraints

- All content lives in `data/itinerary.js` and `data/guide.js`; the user says only the data is sacred — navigation, tabs, and layout may be rethought.
- Must work offline and on slow mobile data; no external fonts or CDNs at runtime (PWA shell is cached).
- Map tiles from OpenStreetMap, routing from the public OSRM server; no API keys.
- Open access, no passcode (user decision).
- Traveller filter All / NASA / M&M must exist in some form; split evenings must be unambiguous.
- Undecided: none recorded.

## Brand Commitments

Name: "Japan 2026". No logo. Standard the user named: should feel at home next to Wanderlog / TripIt — travel-app vocabulary (timeline, stops, pins, bookings) done at a high craft level. The user rejected the first build as "looks so AI".

## Evidence on Hand

- `data/itinerary.js`: 17 days, 212 events, 142 pins, verified coordinates.
- `data/guide.js`: 26 bookings (confirmed + to do), food guide by city, tips, curated suggestions.
- No photos or imagery assets. Do not fabricate reviews, prices beyond the document's, or venue claims.

## Product Principles

1. The next stop wins the screen: time, name, how to get there, done or not.
2. Decisions are shared facts, not private state — what one phone picks, all four see.
3. Everything links out to Google Maps by place name; the app never pretends to be the navigator.
4. Confirmed, to-book, and optional must read differently at a glance, in sunlight.
5. Offline is normal: the app shell and the day's content never depend on the network.

## Accessibility & Inclusion

Outdoor use: body text contrast ≥ 4.5:1 and 44px touch targets are requirements, not polish. Respect reduced motion. Keyboard access on desktop.
