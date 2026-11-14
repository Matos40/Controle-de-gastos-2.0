const test = require('node:test');
const assert = require('node:assert/strict');
const Repository = require('../js/services/financialRepositoryV11.js');
function initial() {
  return { selectedMonth: '2026-11', months: { '2026-11': {
    salary: 100, expenses: [{id:'e1',title:'Luz',amount:30,paid:false}],
    cardExpenses: [{id:'c1',title:'Cartao',installmentValue:20,paid:false}],
    extraIncomes: []
  } } };
}
function command(operationId, commandType, payload, expectedRevision = 0) {
  return {schemaVersion:1,operationId,actorId:'test',commandType,payload,expectedRevision};
}
test('leitura e isolada e nao altera o estado', () => {
  const repo = Repository.create(initial());
  const data = repo.read();
  data.database.months['2026-11'].salary = 999;
  assert.equal(repo.read().database.months['2026-11'].salary,100);
  assert.equal(repo.read().revision,0);
});
test('salario em centavos e replay idempotente', () => {
  const repo = Repository.create(initial());
  const cmd = command('op1','SET_SALARY',{month:'2026-11',amountCents:12345});
  assert.equal(repo.execute(cmd).status,'committed');
  assert.equal(repo.execute(cmd).status,'committed');
  assert.equal(repo.read().revision,1);
  assert.equal(repo.read().database.months['2026-11'].salary,123.45);
  assert.equal(repo.execute({...cmd,payload:{month:'2026-11',amountCents:999}}).code,'OPERATION_ID_REUSED');
});
test('revisao antiga gera conflito e nao altera dados', () => {
  const repo = Repository.create(initial());
  repo.execute(command('a','SET_SALARY',{month:'2026-11',amountCents:20000}));
  assert.equal(repo.execute(command('b','SET_SALARY',{month:'2026-11',amountCents:50000})).status,'conflict');
  assert.equal(repo.read().database.months['2026-11'].salary,200);
});
test('valor invalido e comando pendente nao geram mutacao', () => {
  const repo = Repository.create(initial());
  assert.equal(repo.execute(command('a','SET_SALARY',{month:'2026-11',amountCents:-1})).code,'INVALID_MONEY');
  assert.equal(repo.execute(command('b','CLEAR_CARD_EXPENSES',{month:'2026-11'})).code,'INVALID_SCOPE');
  assert.equal(repo.read().revision,0);
});
test('alteracao de pagamento e entrada extra preservam isolamento', () => {
  const repo = Repository.create(initial());
  assert.equal(repo.execute(command('p','SET_CARD_PAID',{month:'2026-11',id:'c1',paid:true})).status,'committed');
  assert.equal(repo.execute(command('i','CREATE_EXTRA_INCOME',{month:'2026-11',item:{id:'x',description:'Bonus',amountCents:2050}},1)).status,'committed');
  assert.equal(repo.read().database.months['2026-11'].cardExpenses[0].paid,true);
  assert.equal(repo.read().database.months['2026-11'].extraIncomes[0].amount,20.5);
});
test('adaptador nao transacional e rejeitado sem gravar', () => {
  const repo = Repository.create(initial(),{adapter:{commit:()=>({status:'committed'})}});
  assert.equal(repo.execute(command('x','SET_SALARY',{month:'2026-11',amountCents:30000})).code,'TRANSACTIONAL_ADAPTER_REQUIRED');
  assert.equal(repo.read().revision,0);
});
test('resultado incerto de commit nao e anunciado como sucesso', () => {
  const repo = Repository.create(initial(),{adapter:{atomic:true,commit:()=>({status:'unknown'})}});
  assert.equal(repo.execute(command('x','SET_SALARY',{month:'2026-11',amountCents:30000})).status,'unknown');
  assert.equal(repo.read().revision,0);
});
test('substituicao integral requer implementacao transacional', () => {
  const repo = Repository.create(initial());
  assert.equal(repo.execute(command('r','REPLACE_FINANCIAL_DATABASE',{database:initial()})).code,'REPLACEMENT_REQUIRES_TRANSACTIONAL_ADAPTER');
  assert.equal(repo.read().revision,0);
});

test('validacao aceita mes real e rejeita mes malformado', () => {
  assert.equal(Repository.validateDatabase(initial()),true);
  const bad = initial();
  bad.selectedMonth = '2026-13';
  assert.throws(()=>Repository.validateDatabase(bad),/INVALID_DATABASE/);
});
test('excecao do adaptador produz estado desconhecido sem falso sucesso', () => {
  const repo = Repository.create(initial(),{adapter:{atomic:true,commit:()=>{throw Error('falha de rede');}}});
  assert.equal(repo.execute(command('uncertain','SET_SALARY',{month:'2026-11',amountCents:9999})).status,'unknown');
  assert.equal(repo.read().revision,0);
});

test('despesa fixa e despesa unica com mesmo titulo coexistem por id', () => {
  const repo = Repository.create(initial());
  const a = command('a','UPSERT_EXPENSE',{month:'2026-11',item:{id:'fix',title:'Internet',type:'fixed',amountCents:12500}});
  const b = command('b','UPSERT_EXPENSE',{month:'2026-11',item:{id:'once',title:'Internet',type:'one-time',amountCents:3000}},1);
  assert.equal(repo.execute(a).status,'committed');
  assert.equal(repo.execute(b).status,'committed');
  assert.equal(repo.read().database.months['2026-11'].expenses.filter(x=>x.title==='Internet').length,2);
  assert.equal(repo.read().database.months['2026-11'].expenses.find(x=>x.id==='fix').amount,125);
});
test('edicao por id preserva campos legados e rejeita valores invalidos', () => {
  const repo = Repository.create(initial());
  assert.equal(repo.execute(command('a','UPSERT_EXPENSE',{month:'2026-11',item:{id:'e1',title:'Luz editada',type:'fixed',amountCents:12345}})).status,'committed');
  assert.equal(repo.read().database.months['2026-11'].expenses.length,1);
  assert.equal(repo.read().database.months['2026-11'].expenses[0].amount,123.45);
  assert.equal(repo.execute(command('b','UPSERT_EXPENSE',{month:'2026-11',item:{id:'e1',title:'Luz',type:'fixed',amountCents:1.2}},1)).code,'INVALID_MONEY');
  assert.equal(repo.read().revision,1);
});
test('parcela excluida registra tombstone sem afetar outros meses', () => {
  const db=initial();
  db.months['2026-11'].cardExpenses[0]={id:'p2',title:'Notebook',isInstallment:true,installments:3,currentInstallment:2,installmentOriginId:'p1',installmentValue:100};
  const repo=Repository.create(db);
  assert.equal(repo.execute(command('del','DELETE_CARD_EXPENSE',{month:'2026-11',id:'p2',scope:'current'})).status,'committed');
  assert.deepEqual(repo.read().database.months['2026-11'].deletedInstallmentOrigins,['p1:2']);
  assert.equal(repo.read().database.months['2026-11'].cardExpenses.length,0);
});
test('limpeza do cartao registra tombstones das parcelas', () => {
  const db=initial();
  db.months['2026-11'].cardExpenses.push({id:'p3',title:'Notebook',isInstallment:true,installments:3,currentInstallment:3,installmentOriginId:'p1',installmentValue:100});
  const repo=Repository.create(db);
  assert.equal(repo.execute(command('clear','CLEAR_CARD_EXPENSES',{month:'2026-11',scope:'current'})).status,'committed');
  assert.deepEqual(repo.read().database.months['2026-11'].deletedInstallmentOrigins,['p1:3']);
  assert.equal(repo.read().database.months['2026-11'].cardExpenses.length,0);
});
test('exclusao sem escopo explicito e rejeitada sem mutacao', () => {
  const repo=Repository.create(initial());
  assert.equal(repo.execute(command('bad','DELETE_EXPENSE',{month:'2026-11',id:'e1'})).code,'INVALID_SCOPE');
  assert.equal(repo.read().database.months['2026-11'].expenses.length,1);
  assert.equal(repo.read().revision,0);
});
test('parcela com numero invalido e rejeitada', () => {
  const repo=Repository.create(initial());
  const item={id:'new',title:'Compra',isInstallment:true,installments:3,currentInstallment:4,amountCents:2000};
  assert.equal(repo.execute(command('bad','UPSERT_CARD_EXPENSE',{month:'2026-11',item})).code,'INVALID_INSTALLMENT');
  assert.equal(repo.read().revision,0);
});
