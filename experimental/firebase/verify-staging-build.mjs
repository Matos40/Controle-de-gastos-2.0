import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('./dist-staging/',import.meta.url);
const entries=(await readdir(root)).sort();assert.deepEqual(entries,['assets','staging.html']);
const html=await readFile(new URL('staging.html',root),'utf8');
const match=html.match(/src="\.\/assets\/([^"]+\.js)"/);assert.ok(match,'relative bundled entry required');
const assets=await readdir(new URL('assets/',root));assert.ok(assets.includes(match[1]));
for(const asset of assets){assert.match(asset,/^[\w.-]+\.(js|css)$/);const source=await readFile(new URL('assets/'+asset,root),'utf8');assert.ok(!source.includes('demo-raytech-cg')||source.includes('raytech-cg-homologacao'));assert.ok(!source.includes('raytechCommandV1'));assert.ok(!source.includes('AIzaSyAlOok')); }
assert.ok(html.includes('Sincronização financeira bloqueada'));
console.log('Isolated staging bundle verified; no deployment.');
