// node render.mjs ch11-paper [ch11-rail …]  → out/<id>.mp4   (no ids: every composition)
import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler'; import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import './prepare.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const browserExecutable = process.env.CHROMIUM || ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].find((p) => fs.existsSync(p)) || null;
const serveUrl = await bundle({ entryPoint: path.join(HERE, 'src/index.jsx'), publicDir: path.join(HERE, 'public') });
let ids = process.argv.slice(2);
if (!ids.length) ids = (await getCompositions(serveUrl, { browserExecutable })).map((c) => c.id);
fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps: {} });
  const outputLocation = path.join(HERE, 'out', id + '.mp4');
  let last = -1;
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 16, outputLocation, browserExecutable, concurrency: 4, chromiumOptions: { gl: 'swangle' },
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; process.stdout.write(`${id} ${p * 10}%\n`); } } });
  console.log('wrote', outputLocation);
}
