const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const P=require('../js/services/financialRepositoryV11LegacyPlan.js');
const U=require('../js/services/financialRepositoryV11UnifiedPreview.js');
const A=require('../js/services/financialRepositoryV11ArchivePreview.js');
const legacy=()=>({selectedMonth:'2026-11',months:{
 '2026-10':{salary:2000,budgetLimit:1800,expenses:[],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:3000,expenses:[{id:'rent',title:'Aluguel',amount:1000,type:'fixed',paid:false}],
 cardExpenses:[{id:'card',title:'Compra',installmentValue:75,isInstallment:true,installments:3,currentInstallment:2}],
 deletedInstallmentOrigins:['origin:3'],extraIncomes:[{id:'extra',amount:100}]}}});
test('plano legado preserva campos e nao altera fonte',async()=>{
 const source=legacy(),before=JSON.stringify(source);
 const report=await P.plan(source);
 assert.equal(report.mode,'DRY_RUN_ONLY');assert.equal(report.writes,0);
 assert.equal(report.monthCount,2);assert.equal(report.rollback.sourcePreserved,true);
 assert.equal(JSON.stringify(source),before);
 const details=await P.inspect(source);
 assert.deepEqual(details.verifiedDatabase,source);
});
test('backup selado legado valido e aceito apenas para planejamento',async()=>{
 const source=legacy(),sealed=await I.seal(source);
 const report=await P.inspect(sealed);
 assert.equal(report.sourceFormat,'SEALED_V1');
 assert.equal(report.sourceDigest,sealed.digest);
 assert.deepEqual(report.verifiedDatabase,source);
});
test('backup selado adulterado nao gera plano de migracao',async()=>{
 const sealed=await I.seal(legacy());
 sealed.database.months['2026-11'].salary=9999;
 await assert.rejects(()=>P.plan(sealed),/CHECKSUM_MISMATCH/);
});
test('legado invalido e rejeitado sem criar estado',async()=>{
 const source=legacy();source.months['2026-11'].expenses[0].amount=-1;
 await assert.rejects(()=>P.inspect(source),/INVALID_EXPENSE/);
});
test('snapshot legado pode iniciar envelope isolado na revisao zero sem fabricar historico',async()=>{
 const source=legacy(),report=await P.inspect(source);
 const driver=A.createMemoryDriver(),store=U.create(driver);
 assert.equal((await store.initialize(report.verifiedDatabase)).status,'initialized');
 const state=await store.read();
 assert.equal(state.revision,0);assert.deepEqual(state.active,[]);
 assert.deepEqual(state.archives,[]);assert.deepEqual(state.index,{});
 assert.equal((await I.seal(state.database)).digest,report.sourceDigest);
 assert.equal(state.database.months['2026-11'].deletedInstallmentOrigins[0],'origin:3');
});

test('planejamento rejeita backup desconhecido sem tocar origem',async()=>{
 const unknown={schemaVersion:9,database:legacy(),digest:'x'};
 const before=JSON.stringify(unknown);
 await assert.rejects(()=>P.inspect(unknown),/INVALID_DATABASE/);
 assert.equal(JSON.stringify(unknown),before);
});
test('planejamento de backup legado conserva investimentos e despesas recorrentes',async()=>{
 const source=legacy();
 source.months['2026-11'].investments=[{id:'inv',amount:500,category:'Investimentos'}];
 source.months['2026-11'].expenses.push({id:'electric',title:'Energia',amount:150,type:'fixed'});
 const report=await P.inspect(source);
 assert.deepEqual(report.verifiedDatabase.months['2026-11'].investments,source.months['2026-11'].investments);
 assert.equal(report.verifiedDatabase.months['2026-11'].expenses.length,2);
});

test('backup legado preserva campos extras, parcelas, exclusoes e categorias sem normalizacao destrutiva',async()=>{
 const source=legacy(),month=source.months['2026-11'];
 month.customMetadata={theme:'dark',nested:{flag:true}};
 month.expenses.push({id:'monthly',title:'Internet',amount:99.9,type:'fixed',category:'Servicos',paid:true,
  installments:12,custom:{origin:'legacy'}});
 month.cardExpenses.push({id:'oneoff',title:'Compra avulsa',installmentValue:29.9,isInstallment:false,
  category:'Compras',paid:true});
 month.deletedInstallmentOrigins.push('other:2');
 month.extraIncomes.push({id:'dividend',amount:80,description:'Dividendos',category:'Investimentos'});
 const report=await P.inspect(source);
 assert.deepEqual(report.verifiedDatabase,source);
 assert.equal((await I.seal(report.verifiedDatabase)).digest,report.sourceDigest);
});
test('origem selada e origem simples geram exatamente o mesmo snapshot financeiro',async()=>{
 const source=legacy();
 const plain=await P.inspect(source),sealed=await P.inspect(await I.seal(source));
 assert.equal(plain.sourceDigest,sealed.sourceDigest);
 assert.deepEqual(plain.verifiedDatabase,sealed.verifiedDatabase);
});
