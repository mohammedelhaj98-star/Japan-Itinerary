---
name: Japan 2026
description: Each stop is a coloured pass in a stack you flip through, laid over a frosted map, kept in a paper travel wallet.
colors:
  ink: "#141412"
  ink-2: "#4b4a45"
  ink-3: "#6b6962"
  paper: "#f6f4ef"
  card: "#ffffff"
  line: "rgba(20,20,10,.08)"
  link-blue: "#1e6bff"
  link-blue-ink: "#1858d6"
  alert-red: "#e23b2e"
  alert-red-ink: "#c62d22"
  done-green: "#2f9e57"
  done-green-ink: "#1f7a45"
  pass-sight: "#2c4f86"
  pass-food: "#cc5a26"
  pass-food-ink: "#b84d1c"
  pass-shop: "#b94b74"
  pass-hotel: "#55702f"
  pass-booking: "#6f4f98"
  pass-transit: "#4f5d66"
  pass-plan: "#3f3b35"
  route-walk: "#2a8a4a"
  route-taxi: "#d7731a"
  route-train: "#2f5fd0"
  route-water: "#1f98b8"
  route-flight: "#6d6d69"
  warn-cream: "#fff6dd"
  warn-ink: "#7a5a00"
typography:
  display:
    fontFamily: "'Instrument Serif', 'Times New Roman', serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Zen Kaku', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Zen Kaku', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Zen Kaku', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "'Zen Kaku', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  japanese:
    fontFamily: "'Zen Old Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
    fontWeight: 700
rounded:
  tag: "6px"
  field: "12px"
  control: "14px"
  card: "22px"
  sheet: "30px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "48px"
  button-pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 14px"
  button-round:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "48px"
  segment:
    backgroundColor: "rgba(0,0,0,.05)"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
  segment-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px"
  pass:
    textColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "18px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "0 14px"
  toast:
    backgroundColor: "rgba(20,20,18,.92)"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
---

# Design System: Japan 2026

## Overview

**Creative North Star: "The Pass Wallet"**

The trip lives in a travel wallet. Each stop of the day is a pass: a rounded, colour-filled ticket that says what it is (sight, food, shop, hotel, booking) by its colour alone, stacked so the next one is on top and the rest fan out below. The wallet sits over a live map behind frosted glass, so the place and the plan are always in the same view. Everything around the passes is quiet paper: a warm off-white ground, white cards for lists and tools, near-black ink.

The voice is a printed itinerary brought to life. Money and big numbers are set in Instrument Serif, the way a ticket prints its fare; everything you read or tap is Zen Kaku Gothic; Japanese phrases are Zen Old Mincho, so they look like Japanese and not like a translation. Density is calm but not sparse: one column, 460px at most, 12–16px gutters, built for one thumb in daylight.

Colour carries meaning, never mood. Pass colours say what a stop is, route colours say how you get there, couple colours say whose plan it is. Ink and paper do everything else.

**Key Characteristics:**
- Warm paper ground (#f6f4ef), white cards, near-black ink; one column up to 460px.
- Colour-filled passes with a soft top-to-bottom gradient as the day's signature element.
- Frosted glass for anything that floats over the map: top bar buttons, the day dial, the bottom sheet.
- Instrument Serif for amounts and big figures, Zen Kaku Gothic for UI, Zen Old Mincho for Japanese.
- Pills and round buttons for controls; 22px corners for cards and passes; 30px for sheets.
- Fast, springy motion on one ease (cubic-bezier(.23,1,.32,1)); presses scale to .96.

## Colors

Paper and ink with three working accents, plus a set of meaning colours for passes, routes and people.

### Primary
- **Ink** (#141412): all primary text, the primary button, the selected state of chips and presets, the tools bubble. It is the system's real accent: black on paper reads in sunlight.

### Secondary
- **Link Blue** (#1e6bff): links and small text actions ("Got it", "Copy"). As small text on paper use **Link Blue Ink** (#1858d6).
- **Alert Red** (#e23b2e): "book now", destructive actions (Delete), overspend. Small red text uses **Alert Red Ink** (#c62d22).
- **Done Green** (#2f9e57): done, paid, online, "on pace". Small green text uses **Done Green Ink** (#1f7a45).

### Tertiary (meaning colours)
- **Pass colours**: Sight (#2c4f86), Food (#cc5a26), Shop (#b94b74), Hotel/Admin (#55702f), Booking (#6f4f98), Transit/Flight (#4f5d66), Plan (#3f3b35). They fill passes and tint category icons; the same mapping is used in the Settings colour key (js/colors.js is the source).
- **Route colours**: Walk (#2a8a4a), Taxi/Drive (#d7731a), Train (#2f5fd0), Boat/Ropeway (#1f98b8), Flight (#6d6d69). They draw route lines on the map and colour ticket stubs.
- **People**: each person picks a profile colour (default Naf #2c4f86, Sara #6f4f98, Mariam #cc5a26, Mo #b94b74); avatars are filled circles in that colour with white initials. Couples: NASA #4b4f9a, M&M #c25350.

### Neutral
- **Paper** (#f6f4ef): the page ground everywhere.
- **Card** (#ffffff): lists, tools, form fields, segment thumbs.
- **Ink 2** (#4b4a45): secondary text, descriptions, conversions.
- **Ink 3** (#6b6962): metadata, captions, section labels, placeholders. (Darkened from #86847c, which failed outdoor contrast.)
- **Line** (rgba(20,20,10,.08)): hairline dividers and 1px control outlines.
- **Warn Cream** (#fff6dd) with **Warn Ink** (#7a5a00): the only warning surface (offline notice, duplicate check, "not synced yet").

### Named Rules
**The Meaning-Only Rule.** Pass, route and people colours are data. They never decorate a heading, a background or an empty state.

**The Sunlight Rule.** Every text colour clears 4.5:1 on its ground. Accent fills under white text are for bold or large type; small accent-coloured text uses the matching `-ink` shade.

## Typography

**Display Font:** Instrument Serif (with Times New Roman)
**Body Font:** Zen Kaku Gothic, vendored as 'Zen Kaku' (with Hiragino Sans, Noto Sans JP, system-ui)
**Japanese Font:** Zen Old Mincho (with Hiragino Mincho ProN, Yu Mincho)

**Character:** A printed fare next to a clean Japanese gothic. The serif is used sparingly for numbers that matter; the gothic does all the work.

### Hierarchy
- **Display** (Instrument Serif 400, 46px, line-height 1): the one big figure on a screen (spend so far, an amount being typed). Smaller serif figures (24–30px) for amounts in rows and stats.
- **Headline** (Zen Kaku 700, 32px, -0.035em, line-height 1.05): page titles in the tools.
- **Title** (700, 15–16px): list item names, button labels.
- **Body** (400, 14.5px, line-height 1.5, tabular figures): descriptions and notes.
- **Label** (700, 12px, uppercase, +0.06em): section labels only. Never above a page title.

### Named Rules
**The Fare Rule.** Money is set in Instrument Serif; nothing else is. Tabular figures everywhere digits line up.

**The Twelve Floor Rule.** No text below 12px, and nothing tappable labelled below 13px.

## Layout

One column, centred, max 460px. Side gutters are 12px for cards and 16–20px for text. The trip page is a full-screen map with a draggable sheet over it: half height by default, swipe down to give the map the screen, up to read. Floating controls sit in the thumb zone: the tools bubble and ¥+ bottom right, day controls top centre. Tool pages scroll as one column with the tab picker pinned at the bottom.

Spacing steps are 4, 8, 12, 16 and 22px: tight inside a group (8px), 22px above a section label, 8px below it. Every screen respects the safe-area insets.

## Elevation & Depth

A layered system with three materials. **Paper** is the flat ground. **Cards** sit on it with a whisper of shadow so they read as objects in daylight. **Glass** floats over the map, blurred and saturated, with an inner highlight on the top edge. Passes are the only thing with real lift: a gradient fill and a deeper shadow so the stack reads as physical tickets.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 26px -18px rgba(0,0,0,.3)`): cards on paper.
- **Control** (`box-shadow: 0 1px 3px rgba(0,0,0,.08)`): white round buttons and pills on paper.
- **Outline** (`box-shadow: 0 0 0 1px var(--line)`): unselected chips, inputs and filter pills.
- **Glass** (`backdrop-filter: blur(22px) saturate(1.8)` on rgba(255,255,255,.72), with `0 1px 0 rgba(255,255,255,.9) inset, 0 0 0 .5px rgba(0,0,0,.06), 0 10px 30px -12px rgba(0,0,0,.28)`): anything over the map.
- **Floating** (`box-shadow: 0 10px 30px -10px rgba(0,0,0,.35), 0 0 0 1px var(--line)`): the tools bubble options, the ¥+ button.
- **Sheet** (`box-shadow: 0 -14px 40px -18px rgba(0,0,0,.35)`): bottom sheets rising over content.

### Named Rules
**The One Glass Rule.** Glass is only for things that float: controls over the map, the bottom sheet, and the floating tab picker. Content on a page is paper and cards, never glass.

## Shapes

Soft and pocketable. Passes and cards use 22px corners, bottom sheets 30px on the top edge, inputs and primary buttons 14px, small icon tiles and tags 12px and 6px. Controls are pills (999px) or circles: round buttons are 48px, chips and filter pills are full pills. Avatars are circles with initials or a photo. No sharp corners except hairline dividers.

## Components

### Buttons
- **Primary:** ink fill, white label, 48–54px tall, 14–16px corners, full width at the bottom of forms ("Add expense", "Mark paid"). Disabled is a muted grey fill.
- **Round:** 48px white circles with a control shadow (day arrows, ¥ currency). On the map they are glass.
- **Pill:** white pill with a 1px outline for secondary actions and filters; selected pills invert to ink with white text.
- **Press:** every button scales to .96 on press over 160ms on the system ease.

### Chips
- **Category and preset chips:** 36–38px pills, outline when off, ink when on, with an optional leading emoji or icon.
- **Status chips:** small uppercase tags (6px corners): booked (green tint), to book (amber tint), book now (red fill).

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** white on paper.
- **Shadow Strategy:** Card shadow (see Elevation).
- **Internal Padding:** 14–18px; list rows inside cards run edge to edge with hairline dividers.

### Passes (signature component)
A pass is a stop: full-width, 22px corners, white text on its category colour with a gradient from a lighter tint at the top to a darker shade at the bottom. The open pass sits on top of the stack with its time, title, travel leg and actions (Directions, edit, Stamp 済); the rest fan out as a pile below. Done passes are stamped. Ticket-style cards (bookings) use a beige stub with the route colour as a stripe.

### Inputs / Fields
- **Style:** white fill, 1px line outline, 14px corners, 46px tall, 16px text (prevents zoom on iOS).
- **Focus:** outline becomes a 2px ink ring.
- **Error:** the field turns red-tinted (#fdecea) with Alert Red Ink text, and the message beside it names the fix.

### Navigation
- **Tool tabs:** a floating dark-glass pill (rgba(10,10,10,.82), blurred) at the bottom of tool pages, with white labels and a sliding highlight on the current tab.
- **Segmented controls:** grey track, white thumb that slides on the system ease.
- **Tools bubble:** a 54px ink circle bottom right that opens a column of labelled options; ¥+ sits above it.
- **Day bar:** glass pill at the top with the day number and title; arrows either side; tap for the calendar.

### Toasts
Ink at 92% opacity, white text, 14–16px corners, bottom centre above the thumb zone. One action at most (Undo). Swipe sideways to dismiss.

## Do's and Don'ts

### Do:
- **Do** keep money in Instrument Serif and everything else in Zen Kaku Gothic.
- **Do** use pass colours only to say what a stop is, and route colours only for how you travel.
- **Do** use Ink 3 (#6b6962) as the lightest text colour; use the `-ink` shades for small coloured text.
- **Do** make every tap target at least 44×44px, enlarging the hit area rather than the visual when needed.
- **Do** use glass only for floating things (map controls, sheets, the tab picker), and cards only on paper.
- **Do** name people and couples in copy ("Naf", "NASA"), never "you", "me" or "us".

### Don't:
- **Don't** put a small uppercase label above a page title.
- **Don't** use text below 12px, or light grey (#86847c) for anything people need to read outdoors.
- **Don't** nest cards inside cards; list rows inside a card are divided by hairlines.
- **Don't** add explanatory paragraphs where the heading already says what the section is.
- **Don't** use emoji as decoration; category emoji are allowed only as the category marker.
