const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, createMemoryDriver } = require('../js/services/financialRepositoryV11Storage.js');
const db = () => ({ selectedMonth:'2026-11', months:{'2026-11':{salary:0,expenses:[],cardExpenses:[]}} });
const commit = (operationId, amount, expectedRevision=0) => ({
  operationId, expectedRevision, nextRevision:expectedRevision+1,
  database:{selectedMonth:'2026-11',months:{'2026-11':{salary:amount,expenses:[],cardExpenses:[]}}}
});
test('inicializacao e idempotente e preserva banco preexistente',async()=>{
  const store=createStore(createMemoryDriver());
  assert.equal((await store.initialize(db())).status,'initialized');
  assert.equal((await store.initialize(db())).status,'existing');
  assert.deepEqual((await store.read()).database,db());
});
test('concorrencia com mesma revisao permite apenas um commit',async()=>{
  const store=createStore(createMemoryDriver());
  await store.initialize(db());
  const [a,b]=await Promise.all([store.commit(commit('a',100)),store.commit(commit('b',200))]);
  assert.deepEqual([a.status,b.status].sort(),['committed','conflict']);
  assert.equal((await store.read()).revision,1);
  assert.ok([100,200].includes((await store.read()).database.months['2026-11'].salary));
});
test('repeticao da mesma operacao e segura apos reabertura',async()=>{
  const driver=createMemoryDriver();
  const store=createStore(driver);
  await store.initialize(db());
  const req=commit('op',150);
  assert.equal((await store.commit(req)).status,'committed');
  const reopened=createStore(driver);
  const replay=await reopened.commit(req);
  assert.equal(replay.status,'committed');
  assert.equal(replay.replay,true);
  assert.equal((await reopened.read()).revision,1);
});
test('mesmo id com payload diferente e rejeitado',async()=>{
  const store=createStore(createMemoryDriver());
  await store.initialize(db());
  await store.commit(commit('op',150));
  assert.equal((await store.commit(commit('op',999))).code,'OPERATION_ID_REUSED');
  assert.equal((await store.read()).database.months['2026-11'].salary,150);
});
test('falha antes de commit nao modifica estado',async()=>{
  const driver=createMemoryDriver();
  const store=createStore(driver);
  await store.initialize(db());
  assert.equal((await store.commit({...commit('bad',300),nextRevision:5})).code,'INVALID_COMMIT');
  assert.equal((await store.read()).revision,0);
});
test('falha do driver devolve estado desconhecido sem anunciar sucesso',async()=>{
  const driver={transact:()=>{throw Error('storage failure')}};
  const store=createStore(driver);
  assert.equal((await store.commit(commit('op',50))).status,'unknown');
});
test('leitura retorna copia isolada',async()=>{
  const store=createStore(createMemoryDriver());
  await store.initialize(db());
  const read=await store.read();
  read.database.months['2026-11'].salary=900;
  assert.equal((await store.read()).database.months['2026-11'].salary,0);
});

test('recuperacao de resultado incerto usa recibo persistido',async()=>{
  const underlying=createMemoryDriver();
  const stable=createStore(underlying);
  await stable.initialize(db());
  let first=true;
  const flaky={transact: async callback=>{
    const result=await underlying.transact(callback);
    if(first && result && result.status==='committed'){first=false;throw Error('ack lost');}
    return result;
  }};
  const store=createStore(flaky);
  const req=commit('ack-lost',320);
  assert.equal((await store.commit(req)).status,'unknown');
  const replay=await createStore(underlying).commit(req);
  assert.equal(replay.status,'committed');
  assert.equal(replay.replay,true);
  assert.equal((await stable.read()).revision,1);
  assert.equal((await stable.read()).database.months['2026-11'].salary,320);
});

test('falha de leitura nao promove sucesso nem altera estado',async()=>{
 const base=createMemoryDriver();
 const store=createStore(base);
 await store.initialize(db());
 const broken=createStore({transact:()=>{throw Error('READ_FAILED')}});
 await assert.rejects(()=>broken.read(),/READ_FAILED/);
 assert.equal((await broken.commit(commit('x',20))).status,'unknown');
 assert.equal((await store.read()).revision,0);
});

test('recibos mantem historico de ids sem expirar',async()=>{
 const store=createStore(createMemoryDriver());await store.initialize(db());
 for(let i=0;i<25;i++){
  const result=await store.commit(commit('op-'+i,i+1,i));
  assert.equal(result.status,'committed');
 }
 const saved=await store.read();
 assert.equal(saved.receipts.length,25);
 assert.equal((await store.commit(commit('op-0',1,0))).replay,true);
 assert.equal((await store.commit(commit('op-0',999,0))).code,'OPERATION_ID_REUSED');
 assert.equal((await store.read()).revision,25);
});
test('corrupcao do digest de recibos bloqueia escrita sem reparo automatico',async()=>{
 const driver=createMemoryDriver(),store=createStore(driver);await store.initialize(db());
 await store.commit(commit('original',10));
 const original=driver.inspect();
 const corrupted={...original,receipts:original.receipts.map(x=>({...x}))};
 corrupted.receipts[0].signature='tampered';
 const damaged=createStore(createMemoryDriver(corrupted));
 await assert.rejects(()=>damaged.read(),/RECEIPTS_MISMATCH/);
 const result=await damaged.commit(commit('another',20,1));
 assert.equal(result.code,'INTEGRITY_FAILURE');
});
test('inicializacao nao repara silenciosamente envelope corrompido',async()=>{
 const store=createStore(createMemoryDriver({revision:0,database:db(),receipts:[]}));
 assert.equal((await store.initialize(db())).status,'existing');
 await assert.rejects(()=>store.read(),/UNSEALED_ENVELOPE/);
});

test('recibos novos guardam digest sem replicar snapshot financeiro',async()=>{
 const store=createStore(createMemoryDriver());await store.initialize(db());
 const req=commit('compact',123);
 assert.equal((await store.commit(req)).status,'committed');
 const receipt=(await store.read()).receipts[0];
 assert.equal(receipt.database,undefined);
 assert.match(receipt.databaseDigest,/^[0-9a-f]{64}$/);
 assert.equal((await store.commit(req)).replay,true);
 assert.equal((await store.commit(commit('compact',124))).code,'OPERATION_ID_REUSED');
});
test('recibo legado com snapshot continua valido quando envelope esta selado',async()=>{
 const Integrity=require('../js/services/financialRepositoryV11Integrity.js');
 const initial=db(),next=commit('legacy',44).database;
 const receipts=[{operationId:'legacy',expectedRevision:0,nextRevision:1,signature:null,database:next}];
 const seal=await Integrity.seal(next);
 const receiptSeal=await Integrity.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts});
 const driver=createMemoryDriver({revision:1,database:next,receipts,
  seal:{...seal,revision:1,receiptsDigest:receiptSeal.digest}});
 const store=createStore(driver);
 assert.equal((await store.commit(commit('legacy',44))).replay,true);
 assert.equal((await store.read()).revision,1);
});
test('recibos duplicados sao rejeitados sem alterar envelope',async()=>{
 const Integrity=require('../js/services/financialRepositoryV11Integrity.js');
 const initial=db();
 const receipts=[{operationId:'duplicate',expectedRevision:0,nextRevision:1,signature:null,databaseDigest:'0'.repeat(64)},
 {operationId:'duplicate',expectedRevision:1,nextRevision:2,signature:null,databaseDigest:'1'.repeat(64)}];
 const seal=await Integrity.seal(initial);
 const receiptSeal=await Integrity.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts});
 const driver=createMemoryDriver({revision:2,database:initial,receipts,seal:{...seal,revision:2,receiptsDigest:receiptSeal.digest}});
 const store=createStore(driver);
 await assert.rejects(()=>store.read(),/DUPLICATE_RECEIPTS/);
 assert.equal((await store.commit(commit('new',1,2))).status,'rejected');
 assert.equal(driver.inspect().receipts.length,2);
});

test('recibo compacto malformado com selo recalculado e rejeitado',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const driver=createMemoryDriver(),store=createStore(driver);
 await store.initialize(db());
 await store.commit(commit('valid',42));
 const tampered=driver.inspect();
 tampered.receipts[0].databaseDigest='not-a-sha256';
 const receiptSeal=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts:tampered.receipts});
 tampered.seal.receiptsDigest=receiptSeal.digest;
 const isolated=createStore(createMemoryDriver(tampered));
 await assert.rejects(()=>isolated.read(),/INVALID_RECEIPT/);
 assert.equal((await isolated.commit(commit('new',99,1))).code,'INTEGRITY_FAILURE');
});
test('recibo com revisao futura e rejeitado mesmo com checksum valido',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const driver=createMemoryDriver(),store=createStore(driver);await store.initialize(db());
 await store.commit(commit('valid',42));
 const tampered=driver.inspect();tampered.receipts[0].nextRevision=900;
 const receiptSeal=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts:tampered.receipts});
 tampered.seal.receiptsDigest=receiptSeal.digest;
 await assert.rejects(()=>createStore(createMemoryDriver(tampered)).read(),/INVALID_RECEIPT/);
});

test('limite de 10000 recibos bloqueia nova operacao sem apagar historico e preserva replay',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const database=db(),digest=(await I.seal(database)).digest;
 const receipts=Array.from({length:10000},(_,i)=>({
  operationId:'history-'+i,expectedRevision:i,nextRevision:i+1,signature:null,databaseDigest:digest
 }));
 const receiptSeal=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts});
 const seal={...(await I.seal(database)),revision:10000,receiptsDigest:receiptSeal.digest};
 const driver=createMemoryDriver({revision:10000,database,receipts,seal}),store=createStore(driver);
 assert.equal((await store.read()).receipts.length,10000);
 const replay=await store.commit({operationId:'history-0',expectedRevision:0,nextRevision:1,database});
 assert.equal(replay.status,'committed');assert.equal(replay.replay,true);
 const rejected=await store.commit({operationId:'new-10001',expectedRevision:10000,nextRevision:10001,database});
 assert.deepEqual(rejected,{status:'rejected',code:'RECEIPT_CAPACITY_EXCEEDED'});
 assert.equal((await store.read()).revision,10000);
 assert.equal(driver.inspect().receipts.length,10000);
});
test('limite nao autoriza repeticao com payload diferente',async()=>{
 const I=require('../js/services/financialRepositoryV11Integrity.js');
 const database=db(),digest=(await I.seal(database)).digest;
 const receipts=Array.from({length:10000},(_,i)=>({
  operationId:'history-'+i,expectedRevision:i,nextRevision:i+1,signature:null,databaseDigest:digest
 }));
 const receiptSeal=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts});
 const seal={...(await I.seal(database)),revision:10000,receiptsDigest:receiptSeal.digest};
 const store=createStore(createMemoryDriver({revision:10000,database,receipts,seal}));
 assert.equal((await store.commit(commit('history-0',500))).code,'OPERATION_ID_REUSED');
});
