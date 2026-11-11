// node video/capture/run.mjs ch11   → video/public/clips/ch11-log-expense/{clip.mp4,timeline.json}
import path from 'path'; import { fileURLToPath } from 'url';
import { startServer } from './server.mjs'; import { record } from './recorder.mjs'; import { seed } from './seed.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const REPO = path.resolve(HERE, '../..');
const ids = process.argv.slice(2); if (!ids.length) { console.log('usage: node video/capture/run.mjs ch11 [ch12 …]'); process.exit(1); }
const srv = await startServer(REPO, { seed });
for (const id of ids) {
  const ch = (await import(`./${id}.mjs`)).default;
  const sandboxState = { checks: {}, choices: {}, suggestions: [], custom: {}, money: {}, profiles: {}, covers: {}, ...seed, ...(ch.state || {}), updatedAt: null }; // ch.state: extra sample data just for this chapter (practice only)
  const meta = await record(REPO, { sandboxState, ...ch, url: srv.url + ch.path, out: path.join(REPO, 'video/public/clips') });
  console.log(`${ch.name}: ${meta.duration.toFixed(1)} s, ${meta.fpsCaptured.toFixed(0)} frames/s captured${meta.errors.length ? ', page errors: ' + meta.errors.join(' | ') : ''}`);
}
srv.close();
