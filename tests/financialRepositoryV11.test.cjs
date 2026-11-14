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
  assert.equal(repo.execute(command('b','CLEAR_CARD_EXPENSES',{month:'2026-11'})).code,'COMMAND_NOT_YET_IMPLEMENTED');
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
