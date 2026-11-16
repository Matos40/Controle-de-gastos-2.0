const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const integrity=fs.readFileSync(path.join(__dirname,'../js/services/financialRepositoryV11Integrity.js'),'utf8');
const archive=fs.readFileSync(path.join(__dirname,'../js/services/financialRepositoryV11ArchivePreview.js'),'utf8');
async function run(fn){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('http://localhost:8765/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html>'}));
  await page.goto('http://localhost:8765/archive-test');
  await page.addScriptTag({content:integrity});await page.addScriptTag({content:archive});
  return await page.evaluate(fn);
 }finally{await browser.close();}
}
test('arquivo e indice persistem apos reabertura de IndexedDB',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-reopen-'+crypto.randomUUID();
  const d=A.createIndexedDbDriver(indexedDB,name),s=A.create(d);
  await s.initialize();
  await s.append({operationId:'first',expectedRevision:0,nextRevision:1});
  await s.archiveActive();d.close();
  const reopened=A.createIndexedDbDriver(indexedDB,name),store=A.create(reopened);
  const saved=await store.read();
  const duplicate=await store.append({operationId:'first',expectedRevision:0,nextRevision:1});
  reopened.close();
  return {archives:saved.archives.length,ids:Object.keys(saved.index),duplicate:duplicate.code};
 });
 assert.deepEqual(result,{archives:1,ids:['first'],duplicate:'OPERATION_ID_REUSED'});
});
test('duas conexoes IndexedDB nao perdem atualizacoes concorrentes',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-race-'+crypto.randomUUID();
  const d1=A.createIndexedDbDriver(indexedDB,name),d2=A.createIndexedDbDriver(indexedDB,name);
  const a=A.create(d1),b=A.create(d2);await a.initialize();
  const outcomes=await Promise.all([
   a.append({operationId:'a',expectedRevision:0,nextRevision:1}),
   b.append({operationId:'b',expectedRevision:1,nextRevision:2})]);
  const state=await a.read();d1.close();d2.close();
  return {statuses:outcomes.map(x=>x.status).sort(),count:state.active.length};
 });
 assert.deepEqual(result.statuses,['appended','conflict']);
 assert.equal(result.count,1);
});
test('aborto real de transacao IndexedDB nao deixa escrita parcial',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-abort-'+crypto.randomUUID();
  const d=A.createIndexedDbDriver(indexedDB,name),store=A.create(d);
  await store.initialize();await store.append({operationId:'safe',expectedRevision:0,nextRevision:1});
  let rejected=false;
  try{await d.transact(current=>{current.index.unsafe=true;throw Error('FORCED_ABORT');});}
  catch(_){rejected=true;}
  const saved=await store.read();d.close();
  return {rejected,ids:Object.keys(saved.index),active:saved.active.length};
 });
 assert.deepEqual(result,{rejected:true,ids:['safe'],active:1});
});
test('backup IndexedDB preserva arquivo e rejeita adulteracao',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-backup-'+crypto.randomUUID();
  const d=A.createIndexedDbDriver(indexedDB,name),s=A.create(d);await s.initialize();
  await s.append({operationId:'old',expectedRevision:0,nextRevision:1});await s.archiveActive();
  await s.append({operationId:'new',expectedRevision:1,nextRevision:2});
  const backup=await s.exportBackup();
  const verified=await s.verifyBackup(backup);
  backup.archiveState.index.old=false;
  let rejected=false;
  try{await s.verifyBackup(backup);}catch(_){rejected=true;}
  d.close();
  return {archives:verified.archives.length,active:verified.active.length,rejected};
 });
 assert.deepEqual(result,{archives:1,active:1,rejected:true});
});

test('IndexedDB reabre apos backup verificado sem perder idempotencia',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-recover-'+crypto.randomUUID();
  const d=A.createIndexedDbDriver(indexedDB,name),s=A.create(d);
  await s.initialize();
  await s.append({operationId:'old',expectedRevision:0,nextRevision:1,databaseDigest:'a'.repeat(64)});
  await s.archiveActive();
  const backup=await s.exportBackup();
  const verified=await s.verifyBackup(backup);
  d.close();
  const recoveredName='archive-recovered-'+crypto.randomUUID();
  const rd=A.createIndexedDbDriver(indexedDB,recoveredName);
  await rd.transact(current=>({write:verified,response:true}));
  const restored=A.create(rd);
  const replay=await restored.append({operationId:'old',expectedRevision:0,nextRevision:1});
  const state=await restored.read();rd.close();
  return {duplicate:replay.code,archives:state.archives.length,index:Object.keys(state.index)};
 });
 assert.deepEqual(result,{duplicate:'OPERATION_ID_REUSED',archives:1,index:['old']});
});
test('IndexedDB impede arquivamento concorrente com append sem perder recibos',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,name='archive-mixed-'+crypto.randomUUID();
  const d1=A.createIndexedDbDriver(indexedDB,name),d2=A.createIndexedDbDriver(indexedDB,name);
  const a=A.create(d1),b=A.create(d2);
  await a.initialize();await a.append({operationId:'first'});
  const results=await Promise.all([a.archiveActive(),b.append({operationId:'second'})]);
  const saved=await a.read();d1.close();d2.close();
  return {statuses:results.map(x=>x.status).sort(),ids:Object.keys(saved.index),total:saved.active.length+saved.archives.reduce((n,x)=>n+x.count,0)};
 });
 assert.ok(result.statuses.includes('conflict'));
 assert.ok(result.statuses.includes('archived')||result.statuses.includes('appended'));
 assert.ok(result.ids.includes('first'));
 assert.equal(result.total,result.ids.length);
 assert.ok([1,2].includes(result.total));
});
