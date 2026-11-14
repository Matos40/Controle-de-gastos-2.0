const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const S=require('../js/services/financialRepositoryV11Storage.js');
const fixture=()=>({selectedMonth:'2026-11',months:{
 '2026-10':{salary:3000,budgetLimit:2000,expenses:[{id:'e0',title:'Luz',type:'fixed',amount:150,paid:true}],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:3500,budgetLimit:2200,expenses:[{id:'e1',title:'Luz',type:'fixed',amount:180,paid:false},{id:'e2',title:'Luz',type:'one-time',amount:30}],
 cardExpenses:[{id:'c1',title:'Notebook',isInstallment:true,installments:4,currentInstallment:2,installmentOriginId:'c0',installmentValue:199.99}],
 deletedInstallmentOrigins:['c0:3'],extraIncomes:[{id:'x',description:'Freela',amount:120}]}}});
test('hash canonico independe da ordem das chaves',async()=>{
 const a=fixture(),b={months:a.months,selectedMonth:a.selectedMonth};
 assert.equal((await I.seal(a)).digest,(await I.seal(b)).digest);
});
test('backup completo selado conserva todos os meses e campos',async()=>{
 const original=fixture(),sealed=await I.seal(original),restored=await I.verify(sealed);
 assert.deepEqual(restored,original);
 restored.months['2026-11'].salary=0;
 assert.equal(original.months['2026-11'].salary,3500);
});
test('adulteracao de valor financeiro detectada por checksum',async()=>{
 const sealed=await I.seal(fixture());
 sealed.database.months['2026-11'].salary=999999;
 await assert.rejects(I.verify(sealed),/CHECKSUM_MISMATCH/);
});
test('corrupcao estrutural bloqueia verificacao e planejamento',async()=>{
 const bad=fixture();bad.months['2026-11'].cardExpenses[0].currentInstallment=7;
 await assert.rejects(I.seal(bad),/INVALID_CARD/);
 const other=fixture();delete other.months[other.selectedMonth];
 await assert.rejects(I.planMigration(other),/INVALID_DATABASE/);
});
test('digest invalido nao e aceito como backup confiavel',async()=>{
 const sealed=await I.seal(fixture());sealed.digest='abc';
 await assert.rejects(I.verify(sealed),/INVALID_SEAL/);
});
test('plano de migracao nao altera nem grava banco original',async()=>{
 const original=fixture(),before=JSON.stringify(original);
 const plan=await I.planMigration(original);
 assert.equal(plan.mode,'DRY_RUN_ONLY');
 assert.equal(plan.activated,false);
 assert.equal(plan.monthCount,2);
 assert.equal(JSON.stringify(original),before);
 assert.deepEqual(await I.verify(plan.sealed),original);
});
test('falha na preparacao nao altera armazenamento existente',async()=>{
 const driver=S.createMemoryDriver(),store=S.createStore(driver);
 await store.initialize(fixture());
 const before=await store.read();
 const corrupt=fixture();corrupt.months['2026-10'].expenses[0].amount=-100;
 await assert.rejects(I.planMigration(corrupt),/INVALID_EXPENSE/);
 assert.deepEqual(await store.read(),before);
});
test('corrupcao de envelope e rejeitada antes da leitura',async()=>{
 const corrupted=S.createMemoryDriver({revision:0,database:fixture(),receipts:[]});
 const store=S.createStore(corrupted);
 const before=await store.read();
 assert.deepEqual(before.database,fixture());
});
