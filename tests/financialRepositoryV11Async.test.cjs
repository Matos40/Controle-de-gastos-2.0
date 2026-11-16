const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../js/services/financialRepositoryV11.js');
const Storage=require('../js/services/financialRepositoryV11Storage.js');
const Async=require('../js/services/financialRepositoryV11Async.js');
const db=()=>({selectedMonth:'2026-11',months:{'2026-11':{
 salary:100,expenses:[{id:'f1',title:'Luz',type:'fixed',amount:50,paid:false}],
 cardExpenses:[{id:'c1',title:'Notebook',installmentValue:20,paid:false}],extraIncomes:[]}}});
const cmd=(operationId,amount,revision=0)=>({schemaVersion:1,actorId:'test',operationId,
 commandType:'SET_SALARY',expectedRevision:revision,payload:{month:'2026-11',amountCents:amount}});
test('bridge integra comando e armazenamento sem alterar objeto legado',async()=>{
 const original=db(),driver=Storage.createMemoryDriver(),store=Storage.createStore(driver);
 await store.initialize(original);
 const bridge=Async.create(store);
 assert.equal((await bridge.execute(cmd('one',12345))).status,'committed');
 assert.equal((await bridge.read()).database.months['2026-11'].salary,123.45);
 assert.equal(original.months['2026-11'].salary,100);
});
test('duas instancias concorrentes detectam conflito sem perda',async()=>{
 const driver=Storage.createMemoryDriver(),store=Storage.createStore(driver);
 await store.initialize(db());
 const a=Async.create(store),b=Async.create(Storage.createStore(driver));
 const results=await Promise.all([a.execute(cmd('a',10000)),b.execute(cmd('b',20000))]);
 assert.deepEqual(results.map(x=>x.status).sort(),['committed','conflict']);
 assert.equal((await a.read()).revision,1);
});
test('reabertura recupera recibo e nao duplica operacao',async()=>{
 const driver=Storage.createMemoryDriver(),store=Storage.createStore(driver);
 await store.initialize(db());
 assert.equal((await Async.create(store).execute(cmd('same',25000))).status,'committed');
 const reopened=Async.create(Storage.createStore(driver));
 assert.equal((await reopened.execute(cmd('same',25000))).replay,true);
 assert.equal((await reopened.execute(cmd('same',99000))).code,'OPERATION_ID_REUSED');
 assert.equal((await reopened.read()).revision,1);
});
test('ack perdido recupera confirmacao por recibo persistido',async()=>{
 const driver=Storage.createMemoryDriver(),stable=Storage.createStore(driver);
 await stable.initialize(db());
 let lost=true;
 const flaky={read:()=>stable.read(),commit:async request=>{
   const result=await stable.commit(request);
   if(lost){lost=false;return {status:'unknown'};}
   return result;
 }};
 const result=await Async.create(flaky).execute(cmd('lost',44000));
 assert.equal(result.status,'committed');
 assert.equal(result.recovered,true);
 assert.equal((await stable.read()).revision,1);
});
test('banco legado com campos adicionais e preservado integralmente',async()=>{
 const legacy=db();
 legacy.months['2026-11'].budgetLimit=4500;
 legacy.months['2026-11'].deletedInstallmentOrigins=['p:2'];
 legacy.months['2026-11'].cardExpenses[0].customLegacyField='preserve';
 const store=Storage.createStore(Storage.createMemoryDriver());
 await store.initialize(legacy);
 assert.equal((await Async.create(store).execute(cmd('legacy',30000))).status,'committed');
 const saved=(await store.read()).database.months['2026-11'];
 assert.equal(saved.budgetLimit,4500);
 assert.deepEqual(saved.deletedInstallmentOrigins,['p:2']);
 assert.equal(saved.cardExpenses[0].customLegacyField,'preserve');
});
test('operacao invalida nao gera commit',async()=>{
 const store=Storage.createStore(Storage.createMemoryDriver());
 await store.initialize(db());
 const result=await Async.create(store).execute(cmd('invalid',-1));
 assert.equal(result.code,'INVALID_MONEY');
 assert.equal((await store.read()).revision,0);
});
