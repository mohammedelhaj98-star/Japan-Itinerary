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
- **Add a stop by its name** — type the name and the rest fills in: the place on the map, its type, a short note (with pork and alcohol warnings for food), the usual cost and time there, its Japanese name for the phrases card, a line of background, and a credited Wikimedia photo. Claude answers when the `ANTHROPIC_API_KEY` secret is set, Workers AI otherwise (`POST /api/fill`, `lib/fill-claude.js`); the phone finds the map position and photo itself. Only empty fields are filled, and Undo puts them back.
- **Shared state** — checkmarks, day-of choices, suggestions and votes sync across everyone's phones (Cloudflare KV). If the API is unreachable the app keeps working on a local copy and says so.
- **Search** — ⌕ or Ctrl/Cmd+K searches every event, note, booking, food spot and tip.
- **Today** — opens on the current trip day automatically; ← → keys move between days on desktop.
- **PWA** — add to home screen; the app shell and recently viewed map tiles are cached for offline use.

## Deploy

Live at https://ourtrips.date/japan/ (`/` and `/Japan` redirect there; Pages project `japan2026`, KV namespace `japan2026-state` bound as `TRIP_KV` in `wrangler.toml`).
The site root (`hub/`) is the trips page: it asks who you are once per phone and lists trips, Japan first. The Japan app is at `/japan/`; expenses, ticks, choices and edits are shared through KV (each expense is its own `ex:<id>` key). The group photo `hub/img/group.webp` is kept out of git; put it back in `hub/img/` before deploying from a fresh clone.
**Publishing changes:** GitHub Actions (`.github/workflows/test-and-deploy.yml`) runs the three test suites on every
push to any branch, and on `main` puts the site live only if all of them pass (once the GitHub secrets below are set). Work on a branch, then
merge it into `main` when it's ready. (`scripts/deploy.sh` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set
still deploys by hand; it uploads only the public site files.)

### Browser caching: one dashboard setting to check

`scripts/deploy.sh` writes a `_headers` file telling browsers never to keep code and data (`Cache-Control: no-cache`),
yet the live site answers for `js/*.js`, `sw.js` and `data/*.js` with `max-age=14400`: the **ourtrips.date zone** is
overriding it with a four-hour browser cache (the image rule from the same file *is* applied, so it is a zone setting,
not the file). The `?v=` stamps on imports work around it, but files loaded without a stamp (`js/report.js`, the
vendored libraries, the worker itself) can lag a deploy by up to four hours on a phone. To fix it, in the Cloudflare
dashboard pick the **ourtrips.date** domain (not the Pages project), then:

1. *Caching* → *Configuration* → **Browser Cache TTL** → set it to **Respect Existing Headers**. That is the usual culprit:
   any other value replaces every `Cache-Control` the site sends.
2. *Rules* → *Cache Rules*: if a rule there sets a *Browser TTL* for scripts (or for everything), edit it to
   *Respect origin TTL* or delete it. (*Page Rules*, if any are left, can set the same thing.)
3. Check: `curl -sI -A "Mozilla/5.0" https://ourtrips.date/japan/js/store.js | grep -i cache-control` should say
   `no-cache`. Phones pick the change up on their next visit; nothing needs redeploying.

### If the site breaks

Rolling back only swaps the code; expenses, ticks and photos are not touched. Any of these works:

- **From a phone:** dash.cloudflare.com → *Workers & Pages* → **japan2026** → *Deployments* → find the last version that
  worked → **⋯** → **Rollback to this deployment**. It's live within seconds.
- **From GitHub:** *Actions* → **Roll back the site** → *Run workflow* (leave `previous`, or paste an id; `list` shows them).
- **From a Claude session:** `bash scripts/rollback.sh` lists the versions (LIVE marks the current one),
  `bash scripts/rollback.sh previous` goes back one, `bash scripts/rollback.sh <id>` goes to that one.
- **To fix forward:** revert the bad commit on `main` (`git revert <commit>` and push); the tests run and it deploys.

The next push to `main` deploys over a rollback, so fix or revert the problem on `main` before pushing again.

### Problem reports and the daily check

Any error on a phone is sent to the server once (`js/report.js` → `POST /api/log`, at most 50 a day). A session reads
them with `curl -A "Mozilla/5.0" -H "x-trip-pin: <PIN>" https://ourtrips.date/api/log`: the message, the page, whose
phone, when, and which deploy it came from (`v`: the stamp `scripts/deploy.sh` puts on each page). Every morning at 07:17 Japan time, GitHub runs `tests/live-check.mjs` (`.github/workflows/site-check.yml`)
against the live site: the pages load and show their content without errors, the storage answers, no problem reports in
the last day, the money backup didn't fail. If anything is wrong the run fails and GitHub emails the owner.
(Scheduled runs only happen from the repo's default branch, which must be `main`.)

### GitHub secrets (optional)

Without them GitHub only runs the tests, and sessions deploy by hand with `scripts/deploy.sh` after the tests pass.
With them, a push to `main` that passes the tests goes live by itself, and the *Roll back the site* action works.

GitHub → this repo → *Settings* → *Secrets and variables* → *Actions* → **New repository secret**, twice:
`CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard → *Workers & Pages* → the Account ID on the right) and
`CLOUDFLARE_API_TOKEN` (Cloudflare → *My Profile* → *API Tokens* → *Create Token* → *Custom token* → permission
**Account · Cloudflare Pages · Edit** → *Create* → copy it).

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

All three typefaces are served from `vendor/fonts/` rather than Google Fonts, so nothing blocks the first paint and
they work offline. Zen Old Mincho (the Japanese display face) is a 100 KB subset holding only the characters the site
uses; after adding Japanese text to the trip run `bash scripts/font-subset.sh` and commit what it writes (`npm test`
says which characters are missing otherwise; until then the phone's own Mincho shows for them).

## Project layout

```
index.html            app shell
js/store.js           shared state client (API + localStorage fallback)
data/itinerary.js     the trip
data/guide.js         bookings, food, tips, suggestions
functions/api/        Cloudflare Pages Function (the API; state in KV or the Durable Object)
lib/state-store.js    where the shared state lives: KV, or the Durable Object when bound
workers/state/        the Durable Object Worker (scripts/deploy-state.sh puts it live)
vendor/leaflet/       Leaflet 1.9.4 (BSD-2)
vendor/maplibre/      MapLibre GL + the Leaflet bridge, loaded after the plan is on screen
vendor/fonts/         the three typefaces, self-hosted (SIL OFL); scripts/font-subset.sh rebuilds the Japanese subset
sw.js, manifest.webmanifest, icons/   PWA
```

## Tests

`npm install && npm test` builds the site into `dist/`, serves it like Cloudflare Pages with the real API on an
in-memory KV, and drives several simulated phones through the app (84 checks: welcome, M&M view, passes, shared
expenses, profiles, bookings, food ideas, stamps, Word export, map gestures, tour, offline). Set `CHROMIUM` to use a
specific browser binary. Screenshots land in `tests/shots/`.

## Syncing and Cloudflare limits

Phones check `GET /api/version` (one read) every 20 s while the app is on screen, and fetch `/api/state` only when
it changed. Normal use does no KV list operations (capped at 1,000/day on the free plan); each change costs 2 writes.
With the Durable Object on (below), each phone also holds a WebSocket to `/api/live` and is told the moment anything
changes, so a tick or an expense shows on the other phones at once; the poll drops to every 2 minutes as a safety net
and takes over whenever the connection is down (phone asleep, no signal, or the object not bound).

## Shared state in one place (Durable Object)

Every change (a tick, an expense, a choice) is read-modify-write of a whole map in KV, and KV is eventually consistent:
two phones writing within the same minute from different Cloudflare locations can silently lose one of the changes.
`workers/state` is a tiny Worker holding a Durable Object that keeps the same maps once, with a revision per key, so a
write that would overwrite someone else's change is refused and redone (`lib/state-store.js`). The API works either
way: with the `TRIP_DO` binding it uses the object (and keeps a copy of every write in KV, so a rollback that drops the
binding still has the data); without it, KV alone as before. The first request after the binding appears copies KV's
data into the object. Photos, problem reports and backup records stay in KV.

To switch it on (once, about five minutes):

1. A Cloudflare API token with **Account · Workers Scripts · Edit** (the deploy token only has Pages). With it and the
   account id set, run `bash scripts/deploy-state.sh` (it runs `wrangler deploy` on `workers/state/wrangler.toml`).
2. In `wrangler.toml`, uncomment the three `TRIP_DO` lines, commit, push to `main`. The deploy binds the object.
3. Check: `curl -s -A "Mozilla/5.0" https://ourtrips.date/api/health` says `"store":"durable-object"`.

Durable Objects with SQLite storage are on the free plan (100k requests a day; the phones' polling uses about a tenth
of that, less once the live connection carries the changes; a hibernating WebSocket costs nothing while quiet). `npm test` runs the whole app against the object's code, and a few checks against KV alone.

## Trip photos (Google Drive)

`/japan/photos` (+ menu → Photos) shows everyone's photos and videos by day and stop. Files live in one person's
Google Drive, all in one folder, `Our Trips / Japan 2026` (the site sorts them by day and stop); the site uploads into it as them (`lib/photos.js`).
The four can also add photos with the Google Drive app (the Photos page's **Drive** button opens the trip folder; the
app keeps uploading in the background). The next member to open the Photos page files them by day and stop, from the
camera time and location. (Older day folders are emptied into the trip folder and binned.) That needs the full `drive` scope; a Drive connected
with the older `drive.file` scope shows a "Reconnect" banner, and a reconnect must use the same Google account.

One-time setup:
1. Google Cloud console: new project → enable the **Google Drive API** → OAuth consent screen (External, add the
   `drive` scope, then **Publish app** so sign-ins don't expire after 7 days) → Credentials → OAuth client ID,
   type *Web application*, redirect URI `https://ourtrips.date/api/photos/callback`.
2. `npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name japan2026` and the same for `GOOGLE_CLIENT_SECRET`,
   then redeploy (`bash scripts/deploy.sh`).
3. Open the photos page as one of the four and tap **Connect Google Drive**, signing in with the Drive's account.

Secrets already set: `TRIP_PIN` (members), `PHOTO_PIN` (guests' viewing PIN), `PHOTO_SECRET` (signs viewing tokens).
### Money backups

The money is backed up into the same Drive, in `Our Trips / Japan 2026 backups` (`lib/backup.js`): each Japan day
gets `Money <date>.json` (every money record and setting), `Expenses <date>.csv` and the same as a Google Sheet, and
each receipt photo is copied once into `Japan 2026 backups / Receipts`. It runs on the server after the first money change of
each day (Pages has no schedule), and from Settings → Expenses → **Back up now**, which also shows the last backup.

Tests: `npm run test:photos` runs the photos page, the backups and the API against a stand-in Google.
