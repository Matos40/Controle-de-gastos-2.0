import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,cpSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {stagingOrigin,stagingPath} from './staging-guard.mjs';
export const base='8a9b2958e7f87e73b771df179ae790412d9d1ff6';
const here=dirname(fileURLToPath(import.meta.url));
export const root=resolve(here,'../..'),dist=join(here,'dist-staging'),out=join(here,'hml-output'),zipName='raytech-cg-hml-001-v1.1.zip';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
export function payload(dir){assert.deepEqual(readdirSync(dir).filter(n=>n!=='manifest.json').sort(),['assets','staging.html']);assert.ok(statSync(join(dir,'assets')).isDirectory());const assets=readdirSync(join(dir,'assets')).sort();assert.ok(assets.length);for(const n of assets){assert.match(n,/^[\w.-]+\.(js|css)$/);assert.ok(statSync(join(dir,'assets',n)).isFile());}return ['staging.html',...assets.map(n=>'assets/'+n)];}
export function checkAssets(dir){const names=payload(dir);const html=readFileSync(join(dir,'staging.html'),'utf8');const links=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);assert.ok(links.length);for(const link of links){assert.ok(link.startsWith('./assets/'));assert.ok(names.includes(link.slice(2)));}assert.match(html,/Sincronização financeira bloqueada/);return names;}
export function checkIsolation(dir){for(const n of payload(dir)){const s=readFileSync(join(dir,n),'utf8');assert.doesNotMatch(s,/raytechCommandV1|raytech-cg-v11-financial|firebase-functions|firestore\.googleapis\.com/);assert.doesNotMatch(s,/AIza[0-9A-Za-z_-]{35}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|raytech-cg-homologacao\.web\.app/);} }
export function manifestFor(dir,commit){return {version:'ESP-HML-001 v1.1',commit,project:'raytech-cg-homologacao',origin:stagingOrigin,path:stagingPath,files:payload(dir).map(path=>{const bytes=readFileSync(join(dir,path));return {path,size:bytes.length,sha256:hash(bytes)};})};}
export function verifyManifest(dir,commit){assert.deepEqual(JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8')),manifestFor(dir,commit));}
export function verifyChecksum(bytes,expected){assert.match(expected,/^[a-f0-9]{64}$/);assert.equal(hash(bytes),expected);}
function pack(){checkAssets(dist);checkIsolation(dist);rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});const dir=join(out,'payload');cpSync(dist,dir,{recursive:true});const commit=git('rev-parse','HEAD');writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifestFor(dir,commit),null,2)+'\n');verifyManifest(dir,commit);const zip=join(out,zipName);execFileSync('zip',['-X','-q','-r',zip,'staging.html','assets','manifest.json'],{cwd:dir});const digest=hash(readFileSync(zip));writeFileSync(zip+'.sha256',digest+'  '+zipName+'\n');verifyChecksum(readFileSync(zip),digest);console.log('HML ZIP SHA-256: '+digest);}
function report(){const log=readFileSync(join(out,'hml-tests.tap'),'utf8');assert.match(log,/# tests 32\s/);assert.match(log,/# pass 32\s/);assert.match(log,/# fail 0\s/);const ids=[...log.matchAll(/^ok \d+ - (T\d\d) /gm)].map(x=>x[1]).sort();assert.deepEqual(ids,Array.from({length:32},(_,i)=>'T'+String(i+1).padStart(2,'0')));writeFileSync(join(out,'validation-report.json'),JSON.stringify({commit:git('rev-parse','HEAD'),baselineExpected:399,hmlTests:32,hmlPassed:32,ids,artifact:zipName,sha256:hash(readFileSync(join(out,zipName))),runId:process.env.GITHUB_RUN_ID||null},null,2)+'\n');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv[2]==='package')pack();else if(process.argv[2]==='report')report();else throw Error('unknown command');}
