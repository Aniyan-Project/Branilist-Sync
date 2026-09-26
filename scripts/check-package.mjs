import { readFile, copyFile, access } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import vm from 'node:vm';
await copyFile('manifest.json', 'dist/manifest.json');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version || manifest.manifest_version !== 3) throw new Error('Invalid manifest version');
for (const path of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...manifest.content_scripts.flatMap(script => script.js),
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action.default_icon ?? {}),
]) await access(`dist/${path}`);
const icon128 = await readFile('dist/icons/branilist-128.png');
if (icon128.length < 24 || icon128.subarray(1, 4).toString('ascii') !== 'PNG') {
  throw new Error('Invalid 128px icon PNG');
}
const width = icon128.readUInt32BE(16);
const height = icon128.readUInt32BE(20);
if (width !== 128 || height !== 128) throw new Error(`Invalid 128px icon dimensions: ${width}x${height}`);

// MV3 content_scripts are classic scripts: imports/exports must fail this check.
new vm.Script(await readFile('dist/assets/content.js', 'utf8'));
if (manifest.optional_host_permissions?.length) throw new Error('Unexpected optional hosts');
console.log(`Validated Chrome package ${pkg.version}`);
