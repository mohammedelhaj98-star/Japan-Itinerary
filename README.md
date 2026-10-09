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

## Deploy

Live at https://ourtrips.date/japan/ (`/` and `/Japan` redirect there; Pages project `japan2026`, KV namespace `japan2026-state` bound as `TRIP_KV` in `wrangler.toml`).
The site root (`hub/`) is the trips page: it asks who you are once per phone and lists trips, Japan first. The Japan app is at `/japan/`; expenses, ticks, choices and edits are shared through KV (each expense is its own `ex:<id>` key). The group photo `hub/img/group.webp` is kept out of git; put it back in `hub/img/` before deploying from a fresh clone.
To publish changes, run `scripts/deploy.sh` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set. It uploads only the public site files.

### Setting up from scratch in the dashboard

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

## Design

The visual system is Japanese rail station signage: each day is a line, stops are numbered stations on a vertical rail, legs are coloured by how you travel (green walk, blue train, orange taxi, teal boat/ropeway), and the next stop is the largest thing on the screen. White ground by day, black by night (dark mode), one accent (signage red) for "now" and primary actions. Type is BIZ UDPGothic, a universal-design gothic made for public signage, self-hosted for Latin; Japanese glyphs use the phone's own gothic. `DESIGN.md` records the tokens and rules; `PRODUCT.md` records what the product is for.

Design skills used to build and review it live in `.claude/skills/` (Impeccable, Emil Kowalski's design-engineering skills, Anthropic's frontend-design) so future sessions on this repo load them automatically. Run `/impeccable critique` or `/impeccable polish` before shipping visual changes.

## Project layout

```
index.html            app shell
js/store.js           shared state client (API + localStorage fallback)
data/itinerary.js     the trip
data/guide.js         bookings, food, tips, suggestions
functions/api/        Cloudflare Pages Function (KV-backed API)
vendor/leaflet/       Leaflet 1.9.4 (BSD-2)
sw.js, manifest.webmanifest, icons/   PWA
```

## Tests

`npm install && npm test` builds the site into `dist/`, serves it like Cloudflare Pages with the real API on an
in-memory KV, and drives several simulated phones through the app (84 checks: welcome, M&M view, passes, shared
expenses, profiles, bookings, food ideas, stamps, Word export, map gestures, tour, offline). Set `CHROMIUM` to use a
specific browser binary. Screenshots land in `tests/shots/`.

## Syncing and Cloudflare limits

Phones check `GET /api/version` (one KV read) every 20 s while the app is on screen, and fetch `/api/state` only when
it changed. Normal use does no KV list operations (capped at 1,000/day on the free plan); each change costs 2 writes.
