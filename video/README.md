# Tutorial video

How-to videos for the Japan 2026 site, made from the real app. Nothing here is deployed (`scripts/deploy.sh` copies
only the site files).

0. **Set up** once: `cd video && npm install && npm run setup` (the last step downloads the Chromium that records; skip it
   if `CHROMIUM` points at a Chrome binary).
1. **Record** a chapter: `node video/capture/run.mjs ch11` (from the repo root, after `npm install` in `video/`; it brings its own Playwright).
   It builds the site, serves it with the real API on an in-memory store seeded with sample spending
   (`capture/seed.mjs`), opens it on a pretend iPhone in practice mode, and taps through the chapter script
   (`capture/ch11.mjs`). The page runs 5× slower while frames are grabbed, then the clip is put back to normal
   speed, so it plays smoothly at 60 fps. Output: `public/clips/<name>/clip.mp4` and `timeline.json` (every tap,
   with where the button was).
2. **Render**: `cd video && npm install && node render.mjs ch11-paper` (or `-rail`, `-camera`; no id renders all).
   Output: `out/<id>.mp4`, 1080×1920. `npm run studio` previews it live.

Chapters are listed in `src/chapters.js`; the three looks are in `src/Chapter.jsx`.

## The 4-feature video

The 82-second video of the dial, receipts, settling up and photos, cut to Mo's voiceover:

1. Put the voiceover at `public/audio/vo-raw.mp3` and run `node vo.mjs` (tightens the pauses, times every line).
   The line timings in `vo.mjs` (`LINES`) come from the recording's pauses; update them for a new take.
2. Put the music at `public/audio/track-raw.wav` and run `node track.mjs` (evens its loudness, finds its tempo and
   downbeats). Without a track, `node music.mjs 82` makes a stand-in, and the `feature` composition's `music` prop can
   point at `audio/music.wav`.
3. Record the four scenes: `node video/capture/run.mjs f1-dial f2-receipt f3-settle f4-photos` from the repo root
   (one or two at a time, so the capture stays smooth).
4. `node plan-total.mjs` prints the timing; `node render.mjs feature` renders `out/feature.mp4`.

The voice and music files are not committed (`public/audio/` is ignored).
