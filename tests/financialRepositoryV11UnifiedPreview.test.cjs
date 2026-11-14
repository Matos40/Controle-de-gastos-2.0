const test=require('node:test');
const assert=require('node:assert/strict');
const U=require('../js/services/financialRepositoryV11UnifiedPreview.js');
const A=require('../js/services/financialRepositoryV11ArchivePreview.js');
const db=n=>({selectedMonth:'2026-11',months:{'2026-11':{salary:n,expenses:[],cardExpenses:[]}}});
const req=(id,revision,amount)=>({operationId:id,expectedRevision:revision,nextRevision:revision+1,
 signature:'SET_SALARY:'+amount,database:db(amount)});
test('snapshot e recibo sao gravados atomicamente com replay validado',async()=>{
 const driver=A.createMemoryDriver(),store=U.create(driver);
 await store.initialize(db(0));
 const request=req('first',0,100);
 assert.equal((await store.commit(request)).status,'committed');
 assert.equal((await store.commit(request)).replay,true);
 assert.equal((await store.commit(req('first',0,101))).code,'OPERATION_ID_REUSED');
 const state=await store.read();
 assert.equal(state.database.months['2026-11'].salary,100);
 assert.equal(state.revision,1);
 assert.equal(state.index.first.databaseDigest,state.active[0].databaseDigest);
});
test('arquivamento preserva revisoes e replay de operacoes antigas',async()=>{
 const driver=A.createMemoryDriver(),store=U.create(driver);
 await store.initialize(db(0));
 await store.commit(req('first',0,100));await store.archiveActive();
 await store.commit(req('second',1,200));
 const state=await store.read();
 assert.equal(state.archives.length,1);assert.equal(state.active.length,1);
 assert.equal((await store.commit(req('first',0,100))).replay,true);
 assert.equal((await store.commit(req('first',0,300))).code,'OPERATION_ID_REUSED');
});
test('aborto de transacao nao altera snapshot nem indice',async()=>{
 const base=A.createMemoryDriver(),store=U.create(base);await store.initialize(db(0));
 let fail=true;
 const broken=U.create({transact:fn=>base.transact(current=>{
  const result=fn(current);
  if(fail&&result&&result.response&&result.response.status==='committed'){
   fail=false;throw Error('SIMULATED_ABORT');
  }
  return result;
 })});
 await assert.rejects(()=>broken.commit(req('abort',0,999)),/SIMULATED_ABORT/);
 const state=await store.read();
 assert.equal(state.revision,0);assert.equal(state.database.months['2026-11'].salary,0);
 assert.equal(Object.keys(state.index).length,0);
});
test('backup financeiro integral restaura recibos e detecta adulteracao',async()=>{
 const store=U.create(A.createMemoryDriver());await store.initialize(db(0));
 await store.commit(req('first',0,100));await store.archiveActive();
 await store.commit(req('second',1,200));
 const backup=await store.exportBackup();
 const verified=await store.verifyBackup(backup);
 assert.equal(verified.database.months['2026-11'].salary,200);
 assert.equal(verified.archives.length,1);
 const restored=U.create(A.createMemoryDriver(verified));
 assert.equal((await restored.commit(req('first',0,100))).replay,true);
 backup.envelope.database.months['2026-11'].salary=999;
 await assert.rejects(()=>store.verifyBackup(backup),/INVALID_UNIFIED_BACKUP/);
});
test('checksum recalculado nao oculta vinculo incorreto entre snapshot e ultimo recibo',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const driver=A.createMemoryDriver(),store=U.create(driver);await store.initialize(db(0));
 await store.commit(req('first',0,100));
 const broken=driver.inspect();broken.database=db(999);
 const wrapper={selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}}};
 const {digest,...body}=broken;
 broken.digest=(await I.seal({...wrapper,value:body})).digest;
 await assert.rejects(()=>U.create(A.createMemoryDriver(broken)).read(),/SNAPSHOT_RECEIPT_MISMATCH/);
});
test('duas instancias concorrentes nao perdem atualizacoes',async()=>{
 const driver=A.createMemoryDriver(),a=U.create(driver),b=U.create(driver);
 await a.initialize(db(0));
 const results=await Promise.all([a.commit(req('a',0,100)),b.commit(req('b',0,200))]);
 assert.equal(results.filter(x=>x.status==='committed').length,1);
 assert.equal((await a.read()).revision,1);
});

test('backup rejeita recibo com digest adulterado mesmo com selo externo recalculado',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const store=U.create(A.createMemoryDriver());await store.initialize(db(0));
 await store.commit(req('first',0,100));await store.archiveActive();
 const backup=await store.exportBackup();
 backup.envelope.archives[0].items[0].databaseDigest='f'.repeat(64);
 const wrapper={selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}}};
 backup.digest=(await I.seal({...wrapper,value:backup.envelope})).digest;
 await assert.rejects(()=>store.verifyBackup(backup),/UNIFIED_CHECKSUM_MISMATCH/);
});
