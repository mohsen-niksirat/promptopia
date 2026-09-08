#!/usr/bin/env node
/**
 * Generate premium activation codes for Promptopia.
 * Code format: PRO-<payload>-<sig> where sig is a P-256 ECDSA signature
 * (WebCrypto) over the payload bytes. The site embeds the matching public
 * key, so codes can be validated offline and cannot be forged.
 *
 *   node tools/gen-code.mjs            -> 1 code valid for 1 year, 9999 uses
 *   node tools/gen-code.mjs --count 10 --days 90
 *
 * The private key is created here and printed once — keep it secret.
 * If you already have one, export it and pass it via PROMPTOPIA_PRIVKEY
 * (PKCS8 base64). The matching public key goes into js/premium.js.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const get = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const count = Math.max(1, Number(get('--count', 1)));
const days = Number(get('--days', 365));

const b64url = (b) => Buffer.from(b).toString('base64url');

let privJwk = null;
const KEY_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.premium-key.json');
if (process.env.PROMPTOPIA_PRIVKEY) {
  privJwk = JSON.parse(Buffer.from(process.env.PROMPTOPIA_PRIVKEY, 'base64').toString());
} else if (fs.existsSync(KEY_FILE)) {
  privJwk = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
} else {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  privJwk = privateKey.export({ format: 'jwk' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  fs.writeFileSync(KEY_FILE, JSON.stringify(privJwk, null, 2), { mode: 0o600 });
  console.log('NOTE: new private key saved to tools/.premium-key.json (keep it secret, never commit)');
  console.log('PUBLIC KEY (embed in js/premium.js):');
  console.log(JSON.stringify(pubJwk));
}

const privKey = crypto.createPrivateKey({ key: privJwk, format: 'jwk' });
const pubJwk = crypto.createPublicKey(privKey).export({ format: 'jwk' });

console.log('\nPUBLIC KEY (already embedded in js/premium.js — keep in sync):');
console.log(JSON.stringify(pubJwk));

async function sign(payload) {
  const key = await crypto.subtle.importKey(
    'jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, payload);
}

const exp = Math.floor(Date.now() / 1000) + days * 86400;
const codes = [];
for (let i = 0; i < count; i++) {
  const payload = b64url(JSON.stringify({ v: 1, e: exp }));
  const sig = b64url(await sign(Buffer.from(payload)));
  /* '.' separator: base64url tokens can contain '-' and '_', so '.' is the
     only unambiguous separator (it never appears in base64url output) */
  codes.push(`PRO.${payload}.${sig}`);
}
console.log(`\n${count} code(s), expires in ${days} days (${new Date(exp * 1000).toISOString().slice(0, 10)}):`);
codes.forEach((c) => console.log(c));
