import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {accountEdit} from '../../js/productionV2/productionAccountEdit.mjs';

const root = process.env.RAYTECH_PROD_CANDIDATE || process.cwd();
const output = process.env.RAYTECH_RC_OUTPUT || 'release-output';
const sha = data => createHash('sha256').update(data).digest('hex');
const bytes = file => readFile(path.join(root,file));
const sw = await bytes('sw.js');
const {files} = JSON.parse(sw.toString().match(/^const BUILD=(.*);\r?\n/)[1]);
assert.equal(new Set(files.map(([file])=>file)).size,files.length);
assert.ok(files.length>300);
const full = [...files,['sw.js',sha(sw)]].sort(([a],[b])=>a.localeCompare(b));
for (const [file,digest] of full) {
  assert.ok(/^[\w./-]+$/.test(file)&&!file.split('/').includes('..'),file);
  const data=await bytes(file);
  assert.equal(sha(data),digest,file);
  if (/\.(mjs|js|html|json)$/.test(file) && !file.startsWith('vendor/')) {
    assert.doesNotMatch(data.toString(),/raytech-cg-homologacao|raytechHml34741|demo-raytech-v340|labCredentials/);
  }
}
const pinned = {
  'css/v345.css':'179588f6999a1967a929c7726004925b9e11ce487decb2c002a1f3beb4fc6603',
  'js/productionV2/smartAdminView.mjs':'6f3955fe1fe01bc6a77e7066e42943af7b11abacf9101031c0e0b13257c1c83d',
  'js/productionV2/smartLoginView.mjs':'d68d431aa0177da55276fae64b696ebb71f81ef95c9e516c299fd64c663527ee',
  'js/productionV2/config.mjs':'5652ed8c2d435a95cef945a145ae65b04c67aba4b84e965e0ae0ae1409028b27',
  'manifest.json':'79717008769e21c660ab30547d3c31d751886e2744f3567aa32c616de188c1d6',
};
for(const [file,digest] of Object.entries(pinned)) assert.equal(sha(await bytes(file)),digest,file);
const html=(await bytes('index.html')).toString();
assert.equal(sha(html.match(/<main class="smart-login"[\s\S]*?<\/main>/)[0]),
  'cc586c8905d2f637222f0d7aeabf370948dcc000d94b03c518f4094b040753c1');
for(const id of ['premiumAiNotice','invoiceFileInput','geminiApiKeyInput','productionCloudLogout']) {
  assert.equal(html.split('id="'+id+'"').length,2,id);
}
const before={uid:'synthetic',plan:'free',blocked:false};
const patch={plan:'free',blocked:false,limits:{minute:1,day:2,month:5}};
assert.throws(()=>accountEdit('owner','synthetic',before,patch,true),/ADMIN_TARGET/);
assert.throws(()=>accountEdit('owner','synthetic',before,{...patch,limits:{minute:3,day:2,month:5}},false),/ADMIN_LIMITS/);
const {fields,event}=accountEdit('owner','synthetic',before,patch,false);
assert.deepEqual(fields,patch);
assert.equal(event.beforeLimits,null);
assert.deepEqual(event.afterLimits,patch.limits);

await mkdir(output);
for(const [file] of full) {
  const dest=path.join(output,'candidate',file);
  await mkdir(path.dirname(dest),{recursive:true});
  await copyFile(path.join(root,file),dest);
}
await writeFile(path.join(output,'candidate-sha256.txt'),full.map(([file,digest])=>digest+'  ./'+file).join('\n')+'\n');
console.log(full.length+' production files verified and staged; '+files.length+' entries in the worker.');
