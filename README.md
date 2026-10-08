# Japan 2026 — itinerary site

A mobile-first web app for the Oct 16 – Nov 1, 2026 trip. Day-by-day timeline, interactive map with routed legs,
bookings tracker, food guide, trip tips, and a shared suggestions board. Installable as a home-screen app and works offline.

**Stack:** static HTML/CSS/JS (no build step), [Leaflet](https://leafletjs.com) + OpenStreetMap tiles (vendored, no API key),
OSRM public routing for walking/driving legs, Cloudflare Pages for hosting, Cloudflare Pages Functions + Workers KV for shared state.

## Features

- **Days** — 17-day strip, per-day timeline with numbered stops, travel legs between stops (mode + "Directions" button that opens Google Maps with transit/walking/driving), callouts, "choose on the day" options, confirmed / TBD / optional badges, cost chips, done-checkboxes with progress.
- **Map** — pins for the selected day, walking/taxi/driving legs follow real streets (OSRM), transit legs dashed; tap a pin to see details and open in Google Maps. "Whole trip" shows the four hotels; "Food spots" plots the food guide.
- **All / NASA / M&M toggle** — split evenings and mornings show only the selected couple's plan; shared events always show.
- **Bookings** — what's still to book (red = book now) and everything confirmed, each linked to its day.
- **Guide** — must-eat food by city with map links, cafés, and all the logistics / money / dining / shopping tips.
- **Ideas** — curated picks for every open slot (TBD dinners, free evenings, optional mornings) plus a shared suggestion board with voting.
- **Shared state** — checkmarks, day-of choices, suggestions and votes sync across everyone's phones (Cloudflare KV). If the API is unreachable the app keeps working on a local copy and says so.
- **Search** — ⌕ or Ctrl/Cmd+K searches every event, note, booking, food spot and tip.
- **Today** — opens on the current trip day automatically; ← → keys move between days on desktop.
- **PWA** — add to home screen; the app shell and recently viewed map tiles are cached for offline use.

## Deploy on Cloudflare Pages (your domain)

1. **Create the Pages project** — Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → pick this repo and branch.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (the repo root)
   - Deploy. You get a `*.pages.dev` URL immediately.
2. **Create the KV namespace** — *Workers & Pages* → *KV* → *Create a namespace* → name it e.g. `japan2026-state`.
3. **Bind it to the project** — open the Pages project → *Settings* → *Bindings* → *Add* → *KV namespace* →
   Variable name **`TRIP_KV`** (exactly) → select the namespace → Save. Then *Deployments* → *Retry deployment* (or push any commit) so the binding takes effect.
4. **Custom domain** — Pages project → *Custom domains* → *Set up a custom domain* → e.g. `japan.yourdomain.com`. Since the domain is already on Cloudflare, the DNS record is created for you.
5. Open the site, tick something, open it on another phone — the green dot in the header means sync is live. An orange banner means the KV binding is missing or you're offline.

Everyone on the trip just opens the URL. On iPhone: Share → *Add to Home Screen*. On Android: the browser offers *Install app*.

## Local preview

```bash
# any static server works for the UI (shared sync is off, state stays in the browser):
python3 -m http.server 8080
# full preview including the KV-backed API:
npx wrangler pages dev . --kv TRIP_KV
```

## Editing the plan

All content lives in two files, no code changes needed:

- `data/itinerary.js` — the 17 days. Each day is a list of items: `section`, `event` (with optional `place` for a map pin and `travel` for how you get there), `note` (callout), `choice` (choose-on-the-day options whose selection is shared).
- `data/guide.js` — bookings (confirmed + still to do), food guide, tips, and the curated suggestions.

Coordinates are approximate pins for the map; every pin and leg also carries a Google Maps link by place name, which is what you'd actually navigate with.

## Project layout

```
index.html            app shell
css/app.css           styles (light + dark)
js/app.js             UI: days, map tab, bookings, guide, ideas, search
js/map.js             Leaflet map, OSRM routing, Google Maps links
js/store.js           shared state client (API + localStorage fallback)
data/itinerary.js     the trip
data/guide.js         bookings, food, tips, suggestions
functions/api/        Cloudflare Pages Function (KV-backed API)
vendor/leaflet/       Leaflet 1.9.4 (BSD-2)
sw.js, manifest.webmanifest, icons/   PWA
```
