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
  await page.goto('http://localhost:8765/legacy-migration-test');
  for(const file of ['financialRepositoryV11Integrity.js','financialRepositoryV11ArchivePreview.js',
    'financialRepositoryV11UnifiedPreview.js','financialRepositoryV11LegacyPlan.js'])
   await page.addScriptTag({content:read(file)});
  return await page.evaluate(fn);
 }finally{await browser.close();}
}
test('backup legado inicia envelope isolado e preserva fonte apos reabertura',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,P=FinancialRepositoryV11LegacyPlan;
  const U=FinancialRepositoryV11UnifiedPreview,A=FinancialRepositoryV11ArchivePreview;
  const source={selectedMonth:'2026-11',months:{
   '2026-10':{salary:2500,expenses:[],cardExpenses:[],extraIncomes:[]},
   '2026-11':{salary:3000,expenses:[{id:'rent',title:'Aluguel',amount:1200,type:'fixed'}],
    cardExpenses:[{id:'card',title:'Compra',installmentValue:50,isInstallment:true,installments:3,currentInstallment:2}],
    deletedInstallmentOrigins:['old:3'],extraIncomes:[{id:'extra',amount:200}]}}};
  const original=JSON.stringify(source),report=await P.inspect(source);
  const name='legacy-unified-'+crypto.randomUUID(),driver=A.createIndexedDbDriver(indexedDB,name),store=U.create(driver);
  await store.initialize(report.verifiedDatabase);driver.close();
  const reopened=A.createIndexedDbDriver(indexedDB,name),state=await U.create(reopened).read();
  const sameDigest=(await I.seal(state.database)).digest===report.sourceDigest;
  reopened.close();
  return {sameSource:JSON.stringify(source)===original,sameDigest,revision:state.revision,
   archived:state.archives.length,ids:Object.keys(state.index),
   months:Object.keys(state.database.months).length,
   deleted:state.database.months['2026-11'].deletedInstallmentOrigins};
 });
 assert.deepEqual(result,{sameSource:true,sameDigest:true,revision:0,archived:0,ids:[],months:2,deleted:['old:3']});
});
test('backup selado adulterado e rejeitado antes de criar IndexedDB',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,P=FinancialRepositoryV11LegacyPlan;
  const db={selectedMonth:'2026-11',months:{'2026-11':{salary:100,expenses:[],cardExpenses:[]}}};
  const sealed=await I.seal(db);sealed.database.months['2026-11'].salary=999;
  let rejected=false;
  try{await P.inspect(sealed);}catch(_){rejected=true;}
  return {rejected};
 });
 assert.deepEqual(result,{rejected:true});
});
test('rollback descarta somente banco isolado e preserva backup original',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,A=FinancialRepositoryV11ArchivePreview;
  const U=FinancialRepositoryV11UnifiedPreview;
  const db={selectedMonth:'2026-11',months:{'2026-11':{salary:100,expenses:[],cardExpenses:[]}}};
  const backup=await I.seal(db),original=JSON.stringify(backup);
  const name='legacy-rollback-'+crypto.randomUUID();
  const driver=A.createIndexedDbDriver(indexedDB,name),store=U.create(driver);
  await store.initialize(db);driver.close();
  const removed=await new Promise((resolve,reject)=>{
   const req=indexedDB.deleteDatabase(name);
   req.onsuccess=()=>resolve(true);req.onerror=()=>reject(req.error);
   req.onblocked=()=>reject(Error('ROLLBACK_BLOCKED'));
  });
  const fresh=A.createIndexedDbDriver(indexedDB,name),state=await U.create(fresh).read();fresh.close();
  return {removed,empty:state===null,sourceIntact:JSON.stringify(backup)===original};
 });
 assert.deepEqual(result,{removed:true,empty:true,sourceIntact:true});
});

test('migracao interrompida antes da inicializacao deixa IndexedDB vazio',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,P=FinancialRepositoryV11LegacyPlan;
  const U=FinancialRepositoryV11UnifiedPreview,A=FinancialRepositoryV11ArchivePreview;
  const source={selectedMonth:'2026-11',months:{'2026-11':{salary:900,expenses:[],cardExpenses:[]}}};
  const original=JSON.stringify(source),name='legacy-interrupted-'+crypto.randomUUID();
  const report=await P.inspect(source),base=A.createIndexedDbDriver(indexedDB,name);
  const failing=U.create({transact:async fn=>base.transact(current=>{
   const result=fn(current);
   if(result&&result.write)throw Error('SIMULATED_MIGRATION_FAILURE');
   return result;
  })});
  let failed=false;
  try{await failing.initialize(report.verifiedDatabase);}catch(e){failed=e.message==='SIMULATED_MIGRATION_FAILURE';}
  base.close();
  const reopened=A.createIndexedDbDriver(indexedDB,name),state=await U.create(reopened).read();
  reopened.close();
  return {failed,empty:state===null,sourcePreserved:JSON.stringify(source)===original,
   digestPreserved:(await I.seal(source)).digest===report.sourceDigest};
 });
 assert.deepEqual(result,{failed:true,empty:true,sourcePreserved:true,digestPreserved:true});
});
test('rollback apos operacao no banco isolado nao altera backup legado',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,U=FinancialRepositoryV11UnifiedPreview;
  const A=FinancialRepositoryV11ArchivePreview;
  const source={selectedMonth:'2026-11',months:{'2026-11':{salary:100,expenses:[],cardExpenses:[]}}};
  const backup=await I.seal(source),before=JSON.stringify(backup);
  const name='legacy-rollback-after-commit-'+crypto.randomUUID();
  const driver=A.createIndexedDbDriver(indexedDB,name),store=U.create(driver);
  await store.initialize(source);
  const changed={selectedMonth:'2026-11',months:{'2026-11':{salary:200,expenses:[],cardExpenses:[]}}};
  const committed=await store.commit({operationId:'test-change',expectedRevision:0,nextRevision:1,
   signature:'test-only',database:changed});
  driver.close();
  const removed=await new Promise((resolve,reject)=>{
   const req=indexedDB.deleteDatabase(name);
   req.onsuccess=()=>resolve(true);req.onerror=()=>reject(req.error);
   req.onblocked=()=>reject(Error('ROLLBACK_BLOCKED'));
  });
  const reopened=A.createIndexedDbDriver(indexedDB,name),state=await U.create(reopened).read();
  reopened.close();
  return {committed:committed.status,removed,empty:state===null,
   sourcePreserved:JSON.stringify(backup)===before,
   sourceDigest:(await I.seal(source)).digest===backup.digest};
 });
 assert.deepEqual(result,{committed:'committed',removed:true,empty:true,
  sourcePreserved:true,sourceDigest:true});
});

test('rollback bloqueado por conexao aberta nao destrói backup e conclui apos fechamento',async()=>{
 const result=await run(async()=>{
  const I=FinancialRepositoryV11Integrity,A=FinancialRepositoryV11ArchivePreview;
  const U=FinancialRepositoryV11UnifiedPreview;
  const source={selectedMonth:'2026-11',months:{'2026-11':{salary:123,expenses:[],cardExpenses:[]}}};
  const backup=await I.seal(source),original=JSON.stringify(backup);
  const name='legacy-blocked-rollback-'+crypto.randomUUID();
  const driver=A.createIndexedDbDriver(indexedDB,name),store=U.create(driver);
  await store.initialize(source);driver.close();
  const blocker=await new Promise((resolve,reject)=>{
   const req=indexedDB.open(name,1);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const deletion=indexedDB.deleteDatabase(name);
  const blocked=await new Promise((resolve,reject)=>{
   deletion.onblocked=()=>resolve(true);
   deletion.onerror=()=>reject(deletion.error);
   deletion.onsuccess=()=>resolve(false);
  });
  const intact=JSON.stringify(backup)===original;
  blocker.close();
  const removed=await new Promise((resolve,reject)=>{
   deletion.onsuccess=()=>resolve(true);deletion.onerror=()=>reject(deletion.error);
  });
  const reopened=A.createIndexedDbDriver(indexedDB,name),state=await U.create(reopened).read();
  reopened.close();
  return {blocked,intact,removed,empty:state===null};
 });
 assert.deepEqual(result,{blocked:true,intact:true,removed:true,empty:true});
});
