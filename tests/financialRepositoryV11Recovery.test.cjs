const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const R=require('../js/services/financialRepositoryV11Recovery.js');
const db=()=>({selectedMonth:'2026-11',months:{'2026-11':{
 salary:2500,expenses:[{id:'e',title:'Aluguel',amount:900,type:'fixed'}],
 cardExpenses:[{id:'c',title:'Compra',installmentValue:99}],extraIncomes:[]}}});
test('corrupcao primaria com backup integro oferece recuperacao somente sob aprovacao',async()=>{
 const primary=await I.seal(db()),backup=await I.seal(db());
 primary.database.months['2026-11'].salary=999999;
 const result=await R.inspect(primary,backup);
 assert.equal(result.status,'RECOVERY_AVAILABLE');
 assert.equal(result.requiresUserApproval,true);
 assert.equal(result.automaticWrites,0);
 assert.deepEqual(result.candidate,db());
});
test('duas copias corrompidas nao permitem restauracao silenciosa',async()=>{
 const primary=await I.seal(db()),backup=await I.seal(db());
 primary.database.months['2026-11'].salary=888;
 backup.database.months['2026-11'].expenses[0].amount=100000;
 const result=await R.inspect(primary,backup);
 assert.equal(result.status,'NO_VERIFIED_COPY');
 assert.equal(result.candidate,null);
 assert.equal(result.automaticWrites,0);
});
test('primario integro nao e substituido por backup antigo',async()=>{
 const primary=await I.seal(db()),old=db();old.months['2026-11'].salary=100;
 const result=await R.inspect(primary,await I.seal(old));
 assert.equal(result.status,'PRIMARY_VALID');
 assert.equal(result.candidate,null);
 assert.equal(result.automaticWrites,0);
});

test('plano de migracao e somente leitura e reversivel sem alterar origem',async()=>{
 const source=db();source.months['2026-10']={salary:1200,expenses:[],cardExpenses:[],deletedInstallmentOrigins:['x:2']};
 const before=I.canonical(source);
 const plan=await I.planMigration(source);
 assert.equal(plan.mode,'DRY_RUN_ONLY');assert.equal(plan.activated,false);
 assert.equal(plan.legacyKey,'controle_gastos_multimonth_v3');
 assert.deepEqual(plan.months,['2026-10','2026-11']);
 assert.equal(I.canonical(source),before);
 assert.deepEqual(await I.verify(plan.sealed),source);
 plan.sealed.database.months['2026-11'].salary=0;
 assert.equal(I.canonical(source),before);
 await assert.rejects(()=>I.verify(plan.sealed),/CHECKSUM_MISMATCH/);
});
test('backup financeiro com parcelas e exclusoes permanece intacto na recuperacao',async()=>{
 const source=db();
 source.months['2026-11'].cardExpenses=[{id:'p',title:'Parcelada',installmentValue:70,
  isInstallment:true,installments:6,currentInstallment:3}];
 source.months['2026-11'].deletedInstallmentOrigins=['p:4','p:5'];
 const primary=await I.seal(source),backup=await I.seal(source);
 primary.database.months['2026-11'].deletedInstallmentOrigins.pop();
 const result=await R.inspect(primary,backup);
 assert.equal(result.status,'RECOVERY_AVAILABLE');
 assert.equal(result.requiresUserApproval,true);
 assert.deepEqual(result.candidate,source);
 assert.equal(result.automaticWrites,0);
});
