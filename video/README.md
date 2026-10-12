# Tutorial video

How-to videos for the Japan 2026 site, made from the real app. Nothing here is deployed (`scripts/deploy.sh` copies
only the site files).

1. **Record** a chapter: `node video/capture/run.mjs ch11` (from the repo root, after `npm install` there).
   It builds the site, serves it with the real API on an in-memory store seeded with sample spending
   (`capture/seed.mjs`), opens it on a pretend iPhone in practice mode, and taps through the chapter script
   (`capture/ch11.mjs`). The page runs 5× slower while frames are grabbed, then the clip is put back to normal
   speed, so it plays smoothly at 60 fps. Output: `public/clips/<name>/clip.mp4` and `timeline.json` (every tap,
   with where the button was).
2. **Render**: `cd video && npm install && node render.mjs ch11-paper` (or `-rail`, `-camera`; no id renders all).
   Output: `out/<id>.mp4`, 1080×1920. `npx remotion studio src/index.jsx` previews it live.

Chapters are listed in `src/chapters.js`; the three looks are in `src/Chapter.jsx`.
