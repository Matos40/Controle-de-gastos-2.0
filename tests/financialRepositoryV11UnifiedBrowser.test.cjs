const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../js/services/'+name),'utf8');
async function run(fn){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route('http://localhost:8765/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html>'}));
  await page.goto('http://localhost:8765/unified-test');
  for(const file of ['financialRepositoryV11Integrity.js','financialRepositoryV11ArchivePreview.js','financialRepositoryV11UnifiedPreview.js'])
   await page.addScriptTag({content:read(file)});
  return await page.evaluate(fn);
 }finally{await browser.close();}
}
test('envelope unificado persiste snapshot recibos e indice apos reabertura',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,U=FinancialRepositoryV11UnifiedPreview;
  const name='unified-reopen-'+crypto.randomUUID();
  const db=n=>({selectedMonth:'2026-11',months:{'2026-11':{salary:n,expenses:[],cardExpenses:[]}}});
  const request={operationId:'one',expectedRevision:0,nextRevision:1,signature:'salary:100',database:db(100)};
  const d=A.createIndexedDbDriver(indexedDB,name),s=U.create(d);
  await s.initialize(db(0));await s.commit(request);await s.archiveActive();d.close();
  const reopened=A.createIndexedDbDriver(indexedDB,name),store=U.create(reopened);
  const state=await store.read(),replay=await store.commit(request);reopened.close();
  return {salary:state.database.months['2026-11'].salary,revision:state.revision,
   archived:state.archives.length,active:state.active.length,replay:replay.replay,
   index:Object.keys(state.index)};
 });
 assert.deepEqual(result,{salary:100,revision:1,archived:1,active:0,replay:true,index:['one']});
});
test('duas conexoes disputam mesma revisao sem perda de dados',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,U=FinancialRepositoryV11UnifiedPreview;
  const name='unified-race-'+crypto.randomUUID();
  const db=n=>({selectedMonth:'2026-11',months:{'2026-11':{salary:n,expenses:[],cardExpenses:[]}}});
  const d1=A.createIndexedDbDriver(indexedDB,name),d2=A.createIndexedDbDriver(indexedDB,name);
  const a=U.create(d1),b=U.create(d2);await a.initialize(db(0));
  const req=(id,n)=>({operationId:id,expectedRevision:0,nextRevision:1,signature:'salary:'+n,database:db(n)});
  const outcomes=await Promise.all([a.commit(req('a',100)),b.commit(req('b',200))]);
  const state=await a.read();d1.close();d2.close();
  return {statuses:outcomes.map(x=>x.status).sort(),revision:state.revision,
   salary:state.database.months['2026-11'].salary,ids:Object.keys(state.index)};
 });
 assert.deepEqual(result.statuses,['committed','conflict']);
 assert.equal(result.revision,1);
 assert.ok([100,200].includes(result.salary));
 assert.equal(result.ids.length,1);
});
test('aborto de IndexedDB nao altera envelope financeiro',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,U=FinancialRepositoryV11UnifiedPreview;
  const name='unified-abort-'+crypto.randomUUID();
  const db=n=>({selectedMonth:'2026-11',months:{'2026-11':{salary:n,expenses:[],cardExpenses:[]}}});
  const d=A.createIndexedDbDriver(indexedDB,name),s=U.create(d);await s.initialize(db(0));
  let aborted=false;
  try{await d.transact(current=>{current.database=db(900);current.revision=1;throw Error('ABORT');});}
  catch(_){aborted=true;}
  const state=await s.read();d.close();
  return {aborted,revision:state.revision,salary:state.database.months['2026-11'].salary,ids:Object.keys(state.index)};
 });
 assert.deepEqual(result,{aborted:true,revision:0,salary:0,ids:[]});
});
test('backup integral restaura snapshot e recibos arquivados em outro IndexedDB',async()=>{
 const result=await run(async()=>{
  const A=FinancialRepositoryV11ArchivePreview,U=FinancialRepositoryV11UnifiedPreview;
  const db=n=>({selectedMonth:'2026-11',months:{'2026-11':{salary:n,expenses:[],cardExpenses:[]}}});
  const source=A.createIndexedDbDriver(indexedDB,'unified-source-'+crypto.randomUUID()),s=U.create(source);
  await s.initialize(db(0));
  const req=(id,rev,n)=>({operationId:id,expectedRevision:rev,nextRevision:rev+1,signature:'salary:'+n,database:db(n)});
  await s.commit(req('old',0,100));await s.archiveActive();await s.commit(req('new',1,200));
  const backup=await s.exportBackup(),verified=await s.verifyBackup(backup);
  const dest=A.createIndexedDbDriver(indexedDB,'unified-dest-'+crypto.randomUUID());
  await dest.transact(()=>({write:verified,response:true}));
  const restored=U.create(dest),state=await restored.read();
  const replay=await restored.commit(req('old',0,100));
  source.close();dest.close();
  return {revision:state.revision,salary:state.database.months['2026-11'].salary,
   archived:state.archives.length,active:state.active.length,replay:replay.replay};
 });
 assert.deepEqual(result,{revision:2,salary:200,archived:1,active:1,replay:true});
});
