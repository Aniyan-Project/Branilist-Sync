import { readFile, copyFile, access } from 'node:fs/promises';
import vm from 'node:vm';
await copyFile('manifest.json', 'dist/manifest.json');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version || manifest.manifest_version !== 3) throw new Error('Invalid manifest version');
for (const path of [manifest.background.service_worker, manifest.action.default_popup, ...manifest.content_scripts.flatMap(script => script.js)]) await access(`dist/${path}`);
// MV3 content_scripts are classic scripts: imports/exports must fail this check.
new vm.Script(await readFile('dist/assets/content.js', 'utf8'));
if (manifest.optional_host_permissions?.length) throw new Error('Unexpected optional hosts');
console.log(`Validated Chrome package ${pkg.version}`);
