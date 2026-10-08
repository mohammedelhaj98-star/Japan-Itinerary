---
name: Japan 2026
description: A day is a rail line. Stops are stations, legs are coloured by how you travel, and the next station is the biggest thing on the screen.
colors:
  signage-red: "#e60012"
  signage-red-ink: "#ffffff"
  ground: "#ffffff"
  paper: "#f3f3f3"
  rule: "#e3e3e3"
  ring-grey: "#bdbdbd"
  ink-3: "#6f6f6f"
  ink-2: "#3d3d3d"
  ink: "#000000"
  line-walk: "#008a3e"
  line-rail: "#1d3fb5"
  line-taxi: "#d35f00"
  line-water: "#0092b2"
  line-flight: "#6f6f6f"
  line-kyoto: "#6b3fa0"
  done-green: "#008a3e"
  nasa-blue: "#0063b5"
  mm-magenta: "#a2006d"
  amber: "#f5c400"
  amber-ink: "#2b2300"
typography:
  display:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  section:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "tnum"
  label:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  caption:
    fontFamily: "'BIZ UDPGothic', 'Hiragino Sans', 'Noto Sans JP', -apple-system, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  none: "0"
  tag: "3px"
  sm: "4px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
components:
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  button-primary:
    backgroundColor: "{colors.signage-red}"
    textColor: "{colors.signage-red-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  button-small:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  chip-confirmed:
    backgroundColor: "{colors.done-green}"
    textColor: "{colors.ground}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  chip-tbd:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "1px 7px"
  chip-nasa:
    backgroundColor: "{colors.nasa-blue}"
    textColor: "{colors.ground}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  chip-mm:
    backgroundColor: "{colors.mm-magenta}"
    textColor: "{colors.ground}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  input-form:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
    height: "44px"
  input-search:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
    height: "44px"
  tab:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
    padding: "4px 0 6px"
    height: "58px"
  tab-selected:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    padding: "4px 0 6px"
    height: "58px"
  station-number:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "30px"
  station-number-next:
    backgroundColor: "{colors.signage-red}"
    textColor: "{colors.signage-red-ink}"
    rounded: "{rounded.circle}"
    size: "40px"
  station-number-done:
    backgroundColor: "{colors.done-green}"
    textColor: "{colors.ground}"
    rounded: "{rounded.circle}"
    size: "30px"
  filter-pill:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  filter-pill-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
---

# Design System: Japan 2026

## Overview

**Creative North Star: "The Station Signboard"**

The whole app is drawn the way Japanese rail signage is drawn: white ground, black ink, one red for "now", and colour reserved for the lines themselves. A day is a line; its stops are stations with numbered rings; the legs between them are 4px rules in the colour of how you travel. Nothing is a card. Depth comes from the ink, never from a shadow. The next station is lifted (a 40px red ring, a 44px time) while everything already done dims to the mid-grey of the ramp and is struck through.

Density is high and honest: 16px gutters, hairlines at one device pixel, no decorative whitespace. The system is built for a phone held one-handed in daylight, so every tap target is 44px, every text colour clears 4.5:1 on its ground, and the dark scheme is a true inversion to pure black rather than a tinted theme. The world was chosen against the generic travel-app default (same-size cards in a scrolling column, map behind a button) and the build keeps that refusal.

**Key Characteristics:**
- Pure white ground (pure black at night), true black ink, neutrals snapped to a seven-step ramp.
- Line colours are data: green walk, blue rail, orange taxi, teal water or ropeway, grey flight, purple Kyoto. They never decorate.
- One accent, signage red, used for "now" (the next stop, the current tab, today's dot) and primary actions.
- BIZ UDPGothic, one family, two weights (400, 700), tabular figures everywhere.
- Station rings: a circle with a 3px ink ring on a ground fill; filled red when next, green when done, dashed grey when optional.
- Flat. No box-shadow anywhere except the 3px focus ring on the search field; hairline rules do the structuring.
- Pictograms are inline SVG symbols drawn at one stroke weight (2px, round caps), never glyph fonts.

## Colors

A black-and-white signboard with a strict seven-step grey ramp, one red, and a small set of line colours that carry meaning rather than mood.

### Primary
- **Signage Red** (`signage-red`): the "now" colour and the single call to action. It fills the next stop's station ring and the 52px number badge, the selected tab's 3px edge, today's 7px dot on the day strip, the primary button, the pressed vote tile, the text caret, and text selection. Its ink is pure white in light scheme; in dark scheme the red lifts to #ff3b4a and its ink becomes near-black #1a0004.

### Secondary
- **Done Green** (`done-green`): a finished stop. Fills the station ring, the confirmed chip, the day-strip progress bar, the online sync dot.
- **NASA Blue** (`nasa-blue`) and **M&M Magenta** (`mm-magenta`): the two couples. They colour a station ring's border and fill the traveller chip. Only these two tell a split evening apart.

### Tertiary (line colours, data only)
- **Walk Green** (`line-walk`), **Rail Blue** (`line-rail`), **Taxi Orange** (`line-taxi`, also drive), **Water Teal** (`line-water`, boat and ropeway), **Flight Grey** (`line-flight`), **Kyoto Purple** (`line-kyoto`). They paint leg segments (4px solid, or 4px dashed for transit), the travel-mode pictogram disc, the day-strip city segments, and the map legend. Rail Blue is also the link colour and the focus-ring colour. Each has a brighter dark-scheme twin so it stays legible on black.
- **Amber** (`amber`) with its own dark ink is declared and reserved for a warning surface; the build does not yet place it.

### Neutral
- **Ground** (`ground`): the page and every control's fill. Pure white; pure black at night.
- **Paper** (`paper`): the faint second rule, chip fill, the banner, and the row highlight when a stop is flashed from the map.
- **Rule** (`rule`): the 1px dividers under the header, day strip and tab bar, and the 2px form borders.
- **Ring Grey** (`ring-grey`): unpressed radio and check rings, the energy bars at rest, the sync dot offline.
- **Ink 3** (`ink-3`): captions, leg minutes, unselected tabs, done titles.
- **Ink 2** (`ink-2`): descriptions, times, metadata.
- **Ink** (`ink`): titles, numbers, rings, the 2px next-stop rule.

### Named Rules
**The Seven-Step Rule.** Every grey comes from the seven fixed steps (#ffffff, #f3f3f3, #e3e3e3, #bdbdbd, #6f6f6f, #3d3d3d, #000000). No opacity tints, no new greys. Night mode is the same ramp reversed, step for step.

**The Data-Only Line Rule.** Walk, rail, taxi, water, flight and city colours appear only where they encode a leg or a city. They never colour a heading, a background or a decoration.

**The One Red Rule.** Signage red means "now" or "do this". The next stop and the primary action may be red; nothing else on the same screen may.

## Typography

**Display Font:** BIZ UDPGothic 700 (self-hosted Latin subsets; Japanese glyphs fall back to Hiragino Sans, Noto Sans JP, Yu Gothic UI, then the device gothic)
**Body Font:** BIZ UDPGothic 400 (same stack)
**Label/Mono Font:** none; tabular figures (`font-feature-settings: "tnum" 1`) on the body carry every time and count.

**Character:** A universal-design gothic made for public signage: wide counters, open apertures, numerals that stay legible at 10px and at 44px. One family, two weights. Hierarchy is made with size and a little negative tracking at the top of the ramp, never with a second face.

### Hierarchy
- **Display** (700, 44px, line-height 1, -0.03em): the next stop's departure time. One per screen, with the small "次 Next" signage label on its baseline.
- **Headline** (700, 27px, 1.12, -0.02em): the day's name board.
- **Section** (700, 22px, 1.2, -0.015em): the Bookings, Guide and Ideas section heads; the next-stop number badge uses the same 22px at 700.
- **Title** (700, 17px, 1.25, -0.01em): stop titles, the next-stop title, accordion summaries, idea titles. Bookings use 16.5px, food 16px.
- **Body** (400, 14.5px, 1.5): descriptions, notes and sub-copy, capped at 64ch. The base element size is 16px, used by form inputs so iOS does not zoom.
- **Label** (700, 13.5px, 1.2): times, metadata, section rules in the timeline, small buttons, segmented and filter buttons, travel legs.
- **Caption** (700, 11.5px to 13px, 1.1 to 1.2): tab labels (11.5px), route-diagram stop names (11.5px), day-strip numbers (13px) and dates (11px), chips (12px). Leg minutes sit at the bottom at 10.5px in Ink 3.

### Named Rules
**The Two-Weights Rule.** Only 400 and 700 exist. Anything that must stand out goes bold or goes up the ramp; there is no 500 or 600 and no italic.

**The Tabular Time Rule.** Every number that can change (times, counts, votes, day numbers) is set tabular so columns and rings do not shift as the day progresses.

**The Device Gothic Rule.** Japanese text (the 日 brand mark, "次") is rendered by the device's own gothic by design; do not ship a CJK subset.

## Layout

A single column on the phone, a two-pane split on desktop. The sticky black signboard header is 56px plus the top safe area; the bottom tab bar is 58px plus the bottom safe area and the body is padded to clear it. Under the header the day strip (17 stations on one line, 66px per station, horizontally scrolled with hidden scrollbars) stays sticky at z-index 40. Content columns are centred: the timeline at 720px, other panels at 760px, all with a 16px side gutter and 40 to 48px bottom padding. Full-bleed elements (the route diagram) use negative 16px margins and re-pad inside so the line runs edge to edge.

The vertical rail is a two-column grid, 40px for the station ring and the rest for the card, with a 12px gap; the 4px leg runs down the ring column at left 18px. Signboards (notes, choices, section rules) indent 52px to align with the card column.

Spacing rhythm steps at 4, 6, 8, 10, 12, 16, 24px. Row padding is 12px top, 14px bottom; chips sit 8px below the description, links 10px below. Heading margins above are 24 to 26px.

At 960px and up the tab bar moves under the header as a 48px sticky row with the red edge on the bottom of the selected tab; the Days panel becomes a grid of `minmax(440px, 640px) 1fr` with a sticky side map that fills the remaining viewport height behind a 1px left rule. At 430px and narrower the header compresses: the date line hides, the brand drops to 15.5px, icon buttons to 40px.

Touch targets are at least 44px on every control (icon buttons 44px, checks 44px, options and rows 44px min-height, stop tiles 44px). Buttons that must sit smaller (36px pills, 32px segment buttons, 34px couple toggle) are grouped inside a larger hit area.

## Elevation & Depth

Flat. The system uses no box-shadow for depth anywhere; the only `box-shadow` is the 3px Rail Blue ring on the focused search input. Structure comes from ink: 1px rules in Rule or Paper separate rows, a 2px Ink rule under the next-stop headline and above accordions and ideas, a 2px ring around outline buttons and pills, a 3px ring around station numbers. Layering is tonal: the signboard header is solid black on white, the day strip and tab bar are Ground over Ground separated by a single hairline, and a flashed row lifts one step to Paper. Z-order is fixed at header 50, tab bar 50 (45 on desktop), day strip 40, search dialog 100.

### Named Rules
**The No-Shadow Rule.** Nothing casts a shadow. If a surface needs to read as separate, give it a rule or move it one ramp step; never add elevation.

**The Hairline Rule.** Dividers are 1px (`rule` or `paper`). Emphasis rules are 2px Ink. Lines that carry data (legs, rings) are 3 or 4px. There is no other stroke weight.

## Shapes

Two silhouettes: the circle and the hard-edged rectangle. Anything that stands for a station, a traveller, a sync state or a mode is a circle (station rings 28 to 52px, the 34px brand mark, the 26px mode disc, the 20px radio, the 10px food dot, the 7px today dot). Buttons, pills, the couple toggle, the segmented control, the search field and filter buttons are full pills (999px). Everything else is square: form inputs and the form box (radius 0, 2px border), stop tiles (radius 0, 1.5px border), vote tiles. Tags and chips get a 3px corner; the map popup and the hotel pin get 4px. Dashed borders mean optional: the station ring, the route marker and the map pin all switch to `border-style: dashed` in Ink 3. Leg segments are 4px solid for walk and taxi, 4px dashed for rail, water and flight.

## Components

### Buttons
- **Shape:** full pill (999px), 2px ring.
- **Outline (default):** Ground fill, Ink text and 2px Ink border, 40px tall, 0 14px padding, 14px bold, inline icon with a 6px gap.
- **Primary:** Signage Red fill and border, red-ink text; same geometry. One per surface (post suggestion, done).
- **Small:** 36px tall, 0 12px, 13.5px, 1.5px Ring Grey border that turns Ink on a fine-pointer hover. Used for map links, day jumps, calls, and prev/next day as a 40px round variant.
- **Press:** scale(0.97) over 160ms on `cubic-bezier(0.23, 1, 0.32, 1)`, removed under reduced motion. Focus is the global 3px Rail Blue outline with a 2px offset.
- **Icon buttons:** 44px circles, transparent, white on the signboard, 12% white wash on hover.

### Chips
- **Style:** 12px bold, 3px corners, 3px 8px padding, Paper fill with Ink 2 text.
- **Variants:** Confirmed is Done Green with white and a 12px check; Still to decide is a 2px Ink outline on Ground; NASA and M&M are solid couple colours with white; cost is a 1px Rule outline. Chips are state and ownership only, never navigation.

### Cards / Containers
- **There are no cards.** A stop is a row: 12px 0 14px padding and a 1px Paper rule beneath. Done rows push title and description to Ink 3 and strike the title with a 1.5px line. The only boxed container is the suggestion form (2px Rule border, 14px padding, radius 0).
- **Signboards** (note, choice): indented 52px, a 1px Ink rule on top, a 14.5px bold heading led by an 18px pictogram; tip pictograms are Walk Green, info is Rail Blue, warn, book and decide are Ink.

### Inputs / Fields
- **Form fields:** 16px text, 2px Rule border, radius 0, 10px 12px padding, 44px min-height, Ground fill. Focus turns the border Ink and removes the outline. Textareas start at 84px and resize vertically.
- **Search field:** a 44px pill with a 2px Ink border and 10px 16px padding; focus shows a 3px Rail Blue box-shadow ring. The dialog is full-screen on Ground with a 200ms fade-and-scale from 0.98 (opacity only under reduced motion).
- **Radios (choice options):** 20px circle, 3px Ring Grey border; checked turns the ring Ink and fills a centre dot; the label goes from 400 to 700.

### Navigation
- **Signboard header:** sticky, pure black, white text, 56px, holds the 34px white brand circle with 日, the trip name at 17px bold, the All / NASA / M&M pill group (2px white ring, white fill on the pressed segment), search and the sync dot.
- **Tab bar:** five tabs, 58px, 22px pictogram over an 11.5px bold label, Ink 3 at rest, Ink with a 3px Signage Red top edge when selected. Desktop moves it under the header as a 48px row with the red edge on the bottom.
- **Day strip:** 17 station buttons on a 4px line coloured by city; the current day's ring grows from 12px to 18px and fills Ink; today carries a 7px red dot; each has a 40px by 3px Done Green progress bar.
- **Filter and segment groups:** pills; pressed is Ink fill with Ground text. The segmented control on the map is a 2px Ink pill with 32px buttons.

### Station Ring (signature)
A circle with a 3px ring on a Ground fill and a bold number. Timeline rings are 30px (13px numeral), route-diagram rings 28px (12.5px), map pins 28px with a black ring on white and 12px numerals, popup numbers 22px. State is told by the ring: Signage Red fill at 40px (route) or 52px (headline) for the next stop; Done Green fill with white numeral when done; dashed Ink 3 for optional; NASA Blue or M&M Magenta border for a couple's stop. A placeholder ring with no number collapses to a 12px Ring Grey dot. Tapping a ring in the timeline jumps the map to that stop; rings scale to 0.94 on press.

### Next-Stop Headline (signature)
A two-column grid under the route diagram: the 52px red number badge, then the 44px time with the 13px Ink 3 "次 Next" signage label on its baseline, the 17px title clamped to two lines, and the leg in Ink 2. Closed with a 2px Ink rule. When the day is complete the badge turns Done Green with a 26px check.

### Travel Leg
A 40px-min row in the card column: a 26px disc in the leg colour holding the 16px mode pictogram, the label at 13.5px Ink 2, and a bold Directions link pushed to the right edge. The 4px vertical rail beside it takes the same leg colour.

## Do's and Don'ts

### Do:
- **Do** paint every leg, ring and city segment from the line-colour tokens by data (`--leg`, `--city`); the colour is the mode.
- **Do** use the Seven-Step Rule for every grey and reverse the ramp for night mode; never tint with opacity.
- **Do** keep Signage Red for "now" and the primary action only.
- **Do** draw pictograms as inline SVG `<symbol>`s at 2px stroke with round caps and joins, 16 to 22px, referenced with `<use>`.
- **Do** keep all text at 4.5:1 on its ground and every control at 44px; group smaller buttons inside a larger hit area.
- **Do** set times and counts tabular, in 700, with the next stop's time at 44px and nothing larger.
- **Do** structure with 1px hairlines and 2px Ink rules; let the ramp step do the rest.
- **Do** honour reduced motion: remove the press scale and the search transform.

### Don't:
- **Don't** add cards, shadows, gradients, blur or rounded 8 to 16px containers; the world is flat signboard.
- **Don't** introduce a second typeface, a 500 or 600 weight, or an italic.
- **Don't** colour a heading, background or icon with a line colour for decoration.
- **Don't** use a glyph icon font or emoji for pictograms.
- **Don't** invent eyebrow or kicker labels above headings; "次 Next" is the signage label beside the time, not a kicker pattern.
- **Don't** ship CJK font subsets; Japanese glyphs come from the device gothic.
- **Don't** use dashed strokes for anything but optional stops and transit, water or flight legs.
