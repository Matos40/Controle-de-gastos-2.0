const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../js/services/'+name),'utf8');
async function isolated(fn){
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({storageState:{cookies:[],origins:[]}});
  const page=await context.newPage();
  await page.route('http://localhost:8765/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic Lab</title>'}));
  await page.goto('http://localhost:8765/financial-v11-synthetic-lab');
  for(const name of ['financialRepositoryV11Integrity.js','financialRepositoryV11ArchivePreview.js',
    'financialRepositoryV11UnifiedPreview.js','financialRepositoryV11LegacyPlan.js'])
   await page.addScriptTag({content:read(name)});
  return await page.evaluate(fn);
 }finally{await browser.close();}
}
test('laboratorio sintetico preserva estrutura, digest e origem apos reabertura',async()=>{
 const result=await isolated(async()=>{
  const I=FinancialRepositoryV11Integrity,P=FinancialRepositoryV11LegacyPlan;
  const A=FinancialRepositoryV11ArchivePreview,U=FinancialRepositoryV11UnifiedPreview;
  const source={selectedMonth:'2026-11',months:{
   '2026-10':{salary:3100,expenses:[{id:'fix-1',title:'Conta ficticia',amount:120,type:'fixed'}],cardExpenses:[]},
   '2026-11':{salary:3200,expenses:[{id:'a',title:'Despesa sintetica',amount:35,category:'Casa'}],
    cardExpenses:[{id:'c',title:'Compra ficticia',installmentValue:50,isInstallment:true,installments:3,currentInstallment:2}],
    deletedInstallmentOrigins:['origin:2'],extraIncomes:[{id:'e',amount:100}],
    investments:[{id:'i',amount:200}],customMetadata:{synthetic:true}}}};
  const original=JSON.stringify(source),report=await P.inspect(source);
  const name='fr-v11-synthetic-'+crypto.randomUUID();
  const driver=A.createIndexedDbDriver(indexedDB,name);
  try{
   const store=U.create(driver),initialized=await store.initialize(report.verifiedDatabase);
   driver.close();
   const reopened=A.createIndexedDbDriver(indexedDB,name);
   const state=await U.create(reopened).read();
   reopened.close();
   const equal=JSON.stringify(state.database)===original;
   const digest=(await I.seal(state.database)).digest===report.sourceDigest;
   return {initialized:initialized.status,equal,digest,sourceIntact:JSON.stringify(source)===original,
    revision:state.revision,months:Object.keys(state.database.months).length,
    noInventedReceipts:state.active.length===0&&state.archives.length===0};
  }finally{
   driver.close();
   await new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(name);
    request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('SYNTHETIC_LAB_ROLLBACK_BLOCKED'));
   });
  }
 });
 assert.deepEqual(result,{initialized:'initialized',equal:true,digest:true,sourceIntact:true,
  revision:0,months:2,noInventedReceipts:true});
});
test('laboratorio sintetico rejeita arquivo adulterado sem criar destino',async()=>{
 const result=await isolated(async()=>{
  const I=FinancialRepositoryV11Integrity,P=FinancialRepositoryV11LegacyPlan;
  const source={selectedMonth:'2026-11',months:{'2026-11':{salary:100,expenses:[],cardExpenses:[]}}};
  const sealed=await I.seal(source),originalDigest=sealed.digest;
  sealed.database.months['2026-11'].salary=999;
  let rejected=false;
  try{await P.inspect(sealed);}catch(error){rejected=error.message==='CHECKSUM_MISMATCH';}
  return {rejected,sourceIntact:source.months['2026-11'].salary===100,
   digestUnchanged:sealed.digest===originalDigest};
 });
 assert.deepEqual(result,{rejected:true,sourceIntact:true,digestUnchanged:true});
});
