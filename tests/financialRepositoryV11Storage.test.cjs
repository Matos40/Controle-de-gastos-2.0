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
    if(first){first=false;throw Error('ack lost');}
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
