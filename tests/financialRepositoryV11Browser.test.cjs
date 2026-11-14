const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const core = fs.readFileSync(path.join(__dirname, '../js/services/financialRepositoryV11.js'),'utf8');
const storage = fs.readFileSync(path.join(__dirname, '../js/services/financialRepositoryV11Storage.js'),'utf8');
const bridge = fs.readFileSync(path.join(__dirname, '../js/services/financialRepositoryV11Async.js'),'utf8');
async function browserTest(fn) {
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('http://localhost:8765/**', route => route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>IndexedDB isolated tests</title>'}));
    await page.goto('http://localhost:8765/isolated-test');
    await page.addScriptTag({content:core});
    await page.addScriptTag({content:storage});
    await page.addScriptTag({content:bridge});
    return await page.evaluate(fn);
  } finally { await browser.close(); }
}
test('Chromium IndexedDB persiste apos fechar e reabrir conexao',async()=>{
 const result=await browserTest(async()=>{
  const S=FinancialRepositoryV11Storage,A=FinancialRepositoryV11Async;
  const name='idb-reopen-'+String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const initial={selectedMonth:'2026-11',months:{'2026-11':{salary:100,expenses:[],cardExpenses:[]}}};
  const driver=S.createIndexedDbDriver(indexedDB,name),store=S.createStore(driver);
  await store.initialize(initial);
  const command={schemaVersion:1,operationId:'one',actorId:'test',expectedRevision:0,
    commandType:'SET_SALARY',payload:{month:'2026-11',amountCents:23456}};
  const first=await A.create(store).execute(command);
  driver.close();
  const secondDriver=S.createIndexedDbDriver(indexedDB,name);
  const reopened=S.createStore(secondDriver);
  const persisted=await reopened.read();
  const replay=await A.create(reopened).execute(command);
  secondDriver.close();
  return {first:first.status,salary:persisted.database.months['2026-11'].salary,
    revision:persisted.revision,replay:replay.replay};
 });
 assert.deepEqual(result,{first:'committed',salary:234.56,revision:1,replay:true});
});
test('Chromium IndexedDB serializa duas conexoes concorrentes',async()=>{
 const result=await browserTest(async()=>{
  const S=FinancialRepositoryV11Storage,A=FinancialRepositoryV11Async;
  const name='idb-race-'+String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const initial={selectedMonth:'2026-11',months:{'2026-11':{salary:0,expenses:[],cardExpenses:[]}}};
  const d1=S.createIndexedDbDriver(indexedDB,name),d2=S.createIndexedDbDriver(indexedDB,name);
  const s1=S.createStore(d1),s2=S.createStore(d2);
  await s1.initialize(initial);
  const command=(id,cents)=>({schemaVersion:1,operationId:id,actorId:'test',expectedRevision:0,
    commandType:'SET_SALARY',payload:{month:'2026-11',amountCents:cents}});
  const outcomes=await Promise.all([A.create(s1).execute(command('a',10000)),
    A.create(s2).execute(command('b',20000))]);
  const saved=await s1.read();d1.close();d2.close();
  return {statuses:outcomes.map(x=>x.status).sort(),revision:saved.revision,
    salary:saved.database.months['2026-11'].salary};
 });
 assert.deepEqual(result.statuses,['committed','conflict']);
 assert.equal(result.revision,1);
 assert.ok([100,200].includes(result.salary));
});
test('Chromium IndexedDB aborta transacao sem gravacao parcial',async()=>{
 const result=await browserTest(async()=>{
  const S=FinancialRepositoryV11Storage;
  const name='idb-abort-'+String(Date.now())+'-'+Math.random().toString(36).slice(2),d=S.createIndexedDbDriver(indexedDB,name);
  const initial={selectedMonth:'2026-11',months:{'2026-11':{salary:20,expenses:[],cardExpenses:[]}}};
  const store=S.createStore(d);await store.initialize(initial);
  let rejected=false;
  try {
    await d.transact(current=>{
      const changed=structuredClone(current);
      changed.revision=1;changed.database.months['2026-11'].salary=999;
      throw Error('forced abort');
    });
  } catch (_) { rejected=true; }
  const saved=await store.read();d.close();
  return {rejected,revision:saved.revision,salary:saved.database.months['2026-11'].salary};
 });
 assert.deepEqual(result,{rejected:true,revision:0,salary:20});
});
test('Chromium IndexedDB conserva estrutura e campos de backup legado',async()=>{
 const result=await browserTest(async()=>{
  const S=FinancialRepositoryV11Storage,A=FinancialRepositoryV11Async;
  const name='idb-legacy-'+String(Date.now())+'-'+Math.random().toString(36).slice(2),d=S.createIndexedDbDriver(indexedDB,name);
  const legacy={selectedMonth:'2026-11',months:{
   '2026-10':{salary:2000,budgetLimit:1500,expenses:[],cardExpenses:[],extraIncomes:[]},
   '2026-11':{salary:3000,budgetLimit:2000,expenses:[
    {id:'fixed',title:'Energia',type:'fixed',amount:150,category:'Casa',paid:false}],
    cardExpenses:[{id:'inst',title:'Notebook',isInstallment:true,installments:3,
      currentInstallment:2,installmentOriginId:'origin',installmentValue:99.9,paid:false}],
    deletedInstallmentOrigins:['origin:3'],extraIncomes:[{id:'extra',description:'Freela',amount:100}]}}};
  const store=S.createStore(d);await store.initialize(legacy);
  const cmd={schemaVersion:1,operationId:'legacy-change',actorId:'test',expectedRevision:0,
   commandType:'SET_SALARY',payload:{month:'2026-11',amountCents:350000}};
  const outcome=await A.create(store).execute(cmd);
  const saved=(await store.read()).database;
  d.close();
  return {outcome:outcome.status,previous:saved.months['2026-10'],
    fixed:saved.months['2026-11'].expenses[0],
    card:saved.months['2026-11'].cardExpenses[0],
    deleted:saved.months['2026-11'].deletedInstallmentOrigins,
    extra:saved.months['2026-11'].extraIncomes,
    salary:saved.months['2026-11'].salary};
 });
 assert.equal(result.outcome,'committed');
 assert.equal(result.previous.salary,2000);
 assert.equal(result.fixed.amount,150);
 assert.equal(result.card.installmentOriginId,'origin');
 assert.deepEqual(result.deleted,['origin:3']);
 assert.equal(result.extra[0].amount,100);
 assert.equal(result.salary,3500);
});
