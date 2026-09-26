import { createHash, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const extensionId = process.argv[2];
if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) throw new Error('Supply the 32-letter item ID from the Chrome Web Store draft: npm run check:store -- <ID>');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
if (!manifest.key) throw new Error('Add the dashboard public key to manifest.json and rebuild. Do not generate a replacement key.');
const der = Buffer.from(manifest.key, 'base64');
createPublicKey({ key: der, format: 'der', type: 'spki' });
const derivedId = [...createHash('sha256').update(der).digest().subarray(0, 16)]
  .map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
if (extensionId !== derivedId) throw new Error('Public key does not match the store item ID.');
console.log(`Package identity verified. Client: branilist-sync\nCallback: https://${extensionId}.chromiumapp.org/oauth2\nBackend provisioning and real login must still be verified manually.`);
