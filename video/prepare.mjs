// Copies the site's self-hosted fonts into public/fonts so the video uses exactly the same type (and the app icon).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(HERE, '../vendor/fonts'), to = path.join(HERE, 'public/fonts');
fs.mkdirSync(to, { recursive: true });
for (const f of fs.readdirSync(from)) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(from, f), path.join(to, f));
// and the app's home-screen icon, for the drawn "Add to Home Screen" part
fs.copyFileSync(path.join(HERE, '../icons/icon-192.png'), path.join(HERE, 'public/home-icon.png'));
