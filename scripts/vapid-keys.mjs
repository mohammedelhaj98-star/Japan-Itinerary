// Makes the key pair for flight alerts (Web Push "VAPID" keys). Run once: node scripts/vapid-keys.mjs
// The public half goes in workers/state/wrangler.toml as VAPID_PUBLIC (phones see it, that's fine). The private half is
// a secret: paste it straight into `npx wrangler secret put VAPID_PRIVATE --config workers/state/wrangler.toml`, never
// into the repo or a chat. Making a new pair later means every phone has to turn alerts on again.
import { b64u } from '../lib/webpush.js';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log('VAPID_PUBLIC (goes in wrangler.toml [vars]):\n' + pub + '\n');
console.log('VAPID_PRIVATE (secret, for wrangler secret put):\n' + JSON.stringify({ kty, crv, x, y, d }));
