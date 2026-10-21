# Japan 2026 tutorial video: the plan

A how-to video for Naf, Sara and Mariam (and any guest): what the site can do for them on the trip, and exactly
how to do each thing. It's a tutorial, not an ad. It's built from the real app in the repo, so when a feature
changes we re-run one command and get an updated video.

## How it's made, in one paragraph

Claude drives the real app on a pretend iPhone and records each task as its own clip, the same way the test
suite already taps through the app. Those clips go into a video project written in code (Remotion, which turns
web pages into video). That's where the step numbers, captions, zoom-ins and touch dots are added, in the
site's own colours and fonts from `DESIGN.md`. Recordings run against a local copy with a throwaway store, in the
app's practice mode, so nothing touches the live site or your real trip data.

## How each chapter teaches

Every chapter answers one question a traveller would ask, in the same rhythm:

1. **The question as a title:** "How do I log an expense?", with one line on why it helps ("so nobody has to
   keep receipts in their head").
2. **Step by step:** before each tap, the camera eases in on the button, a numbered badge appears (1, 2, 3…)
   and the caption says what to press using the app's own button label, such as *Tap* ***¥+***. A soft touch
   dot shows the tap.
3. **Show the result:** it holds for a beat on what changed, for example "Stamped 済, and it's on everyone's
   phone".
4. **Recap card:** the steps in one line, such as *¥+ → amount → who's in → Add expense*.

What we take from whatships.com is only the finish: the real app on screen, smooth zooms, clean type, nothing
cluttered. The pace is a tutorial's pace, slow enough to follow along.

## The shape

- **One full tutorial, about 7 to 8 minutes, in 4 parts and 21 chapters** (below), with chapter markers so
  people can skip to what they need.
- **Every chapter is also its own clip** of 15 to 30 seconds. You can drop one into the group chat when someone
  asks "how do I…".
- **A 2-minute "must know" cut** for anyone who won't watch the whole thing: chapters 1, 2, 3, 5, 11 and 14.
- **Vertical (1080×1920),** because everyone will watch it on their phone.
- **Captions carry every step,** so it works with the sound off. A voiceover is optional; your own voice would
  make it feel personal.

## The chapters

### Part 1: Getting started
| # | The question | What we show |
|---|---|---|
| 1 | How do I get in? | Trips page: tap your name, enter the 4-digit PIN once, open Japan 2026. Guests tap *Just looking*. *Not Naf? Switch* changes person. |
| 2 | How do I find a day? | Arrows either side of the day bar; tap the day bar for the mini calendar (coloured by city, a dot means something's booked). *Today* jumps to today during the trip. |

### Part 2: Out and about each day
| # | The question | What we show |
|---|---|---|
| 3 | What's next, and how do I get there? | Each stop is a pass: swipe or use ‹ ›, and the map flies to it. *Directions* opens Google Maps for walking, train or taxi. |
| 4 | How do I see just our couple's plan? | Open the day panel from the left edge, tap *NASA* or *M&M*; split evenings show only yours. *All* brings everyone back. |
| 5 | How do I mark a stop as done? | *Stamp 済*: the pass fades, the pin pops, and every phone sees it. |
| 6 | How do we decide on the day? | *Notes & decisions* → tap an option in a *Decide* card (e.g. Fuji or Nikko); everyone's day swaps to it. |
| 7 | How do I read the day at a glance? | The day dial: booked stops as times on a clock, the red tick is now, drag the sun to scrub. Weather, sunrise and sunset. |
| 8 | How do I make the map bigger? | Tap or swipe the handle down for a full-screen map; tap again to bring the stops back. |
| 9 | How do I add or change a stop? | *Add a stop here* or the pen on a pass: name, time, who's going, search the place, *Save*. *Hide*, *Reset to original*, and *Edit trip* for undoing everything. |
| 10 | What's on a pass besides the stop? | *Phrases for here* (show staff), *Read the story*, tonight's hotel card, and tapping *≈$* to see prices in CAD, QAR or USD. |

### Part 3: Money
| # | The question | What we show |
|---|---|---|
| 11 | How do I log an expense? | *¥+* → amount → *What for* → *Paid by* and Cash / Card / IC → *Who's in* (Only me / us two / All four) → *Add expense*. Undo, and tap a row to fix or delete it. |
| 12 | How do I scan a receipt and split it by item? | *Scan* → photo → amount, shop and date fill in by themselves → *Split by item* → tap who had what → *Use these shares*. |
| 13 | How do I log cash or an IC card top-up? | *Cash* tab: *Got cash* (from an ATM or a person) or *Gave cash*. *IC top-up* tab: amount, paid by card or cash. |
| 14 | Who owes whom, and how do we settle up? | *Settle up*, by couple or person to person → *Paid* (or *Handed over in cash*). *Pay separately* splits a combined row. |
| 15 | How much have I spent? | The switch at the top: Group / me / our couple; a budget, the cash and IC wallet, and filters by day and type. |

### Part 4: Tools and extras (the round + button)
| # | The question | What we show |
|---|---|---|
| 16 | What still needs booking? | *Bookings*: *Book now* in red, then *Mark as booked* and it moves to *Booked* for everyone. |
| 17 | How do we share ideas? | *Ideas*: type a place, *Post for everyone*, *Vote*. Food / Shops / Places lists. |
| 18 | How do I find halal food nearby? | *Halal*: pick a stop or *Near me*, filter chips, *Go* for walking directions, and the pork card to show staff. |
| 19 | How do I tell a taxi driver where to go? | *Taxi*: tap tonight's hotel, show the full-screen Japanese card. |
| 20 | Yen, phrases and emergencies | The ¥ button: converter with a keypad, phrases full screen, 110 / 119 and the visitor hotline. |
| 21 | Photos, settings and offline | Upload photos (filed by day and stop), *Relive* a day. Profile colour and photo, *Save whole trip* for offline, *Export to Word*, *Take the tour*. Add to Home Screen. |

## Step by step from here

1. **You:** tick off the chapters (cut, merge or reorder anything) and say whether you want a voiceover.
2. **Claude:** writes the exact caption for every step and posts the script for a quick read.
3. **Claude:** records each chapter at iPhone size, 60 frames a second, on a real trip morning (Day 7, Nara +
   Osaka) so *now*, *Today* and the weather look alive.
4. **Claude:** builds the video project (a `video/` folder on a branch with a PR; it is never deployed, because
   the deploy only copies the site files) and renders chapter 11 first as a sample for you to judge the style.
5. **Together:** you give notes by timestamp; Claude re-renders the full tutorial, the chapter clips and the
   2-minute cut.
6. **Later:** one command (`npm run video`) re-records and re-renders after the site changes.

## Things to know before filming

- **Receipts and photos use samples.** Receipt reading and Google Drive photos need real services. The video
  uses the sample receipts in the repo and a stand-in Drive, so your real Drive and Anthropic key aren't used.
- **Add to Home Screen** is Safari's own screen, which can't be recorded here. Either you screen-record ten
  seconds on your iPhone, or Claude animates the steps (Share → Add to Home Screen). Default: Claude animates it.
- **Small bug found while mapping:** in Settings, *Show money in* and *Settle up by* save to a different place
  than the money page reads (`prototypes/tools.html:860` vs `money.html:744`), so changing them there likely
  does nothing. Worth fixing before filming chapter 21.

## Decisions so far (2026-10-12)

- **Style: Rail** (night signage, the steps as stations on a red line that light up in turn). Paper and Camera
  stay in `src/Chapter.jsx` but aren't used.
- **No camera movement.** Mo: "I don't think we need to move around on the screen. Just highlight the clickable
  areas and darken the other areas." Rail now keeps the whole screen still (`camOpts={{ still: true }}`) and
  darkens everything around the button being explained (`dim`).
- **Pace:** slower than the first try (`capture/recorder.mjs` defaults: 1.7 s before a tap, 2 s after,
  typing at 0.13 s a character). Chapter 11 runs about 40 s.
- **Rendering** runs on the processor: on the 4-core cloud machine one ~40 s chapter takes about 10 min at
  30 fps. The full tutorial is to be rendered on Mo's PC. Use `--fps=30` for previews, 60 for the final.
- The other chapter scripts (`capture/chNN.mjs`) still need writing, following `capture/ch11.mjs`. Mo is adding a
  passes/stamping feature, so check main is current before filming chapters 3 to 10.
