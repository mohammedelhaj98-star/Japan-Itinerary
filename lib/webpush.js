// Sending a phone notification (Web Push) with nothing but WebCrypto, so it runs in the Worker and in Node's tests.
//   sendPush(sub, payload, vapid)  sub: the phone's PushSubscription JSON { endpoint, keys: { p256dh, auth } }
//                                  vapid: { publicKey (base64url, 65-byte raw key), privateJwk (JWK with d), subject }
// → the push service's status: 201 delivered, 404/410 the phone unsubscribed (forget it), anything else try again later.
// Encryption is RFC 8291 (aes128gcm, one record); the sender proves who it is with a VAPID token (RFC 8292). The key
// pair is made once (scripts/vapid-keys.mjs); the public half goes to the phones, the private half is a Worker secret.

const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const hkdf = async (salt, ikm, info, bytes) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
  await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

async function vapidToken(endpoint, vapid) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject })));
  const key = await crypto.subtle.importKey('jwk', { ...vapid.privateJwk, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

export async function encryptPayload(sub, text) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, mine.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, sealed);
}

export async function sendPush(sub, payload, vapid, fetchFn = fetch) {
  const body = await encryptPayload(sub, typeof payload === 'string' ? payload : JSON.stringify(payload));
  const r = await fetchFn(sub.endpoint, { method: 'POST', body, headers: {
    authorization: `vapid t=${await vapidToken(sub.endpoint, vapid)}, k=${vapid.publicKey}`,
    'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '21600', urgency: 'high',
  } });
  return r.status;
}
