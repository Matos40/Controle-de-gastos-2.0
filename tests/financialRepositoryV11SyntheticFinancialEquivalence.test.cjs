'use strict';
// Synthetic financial equivalence only: pure independent oracle, no browser/storage I/O.
const test=require('node:test');
const assert=require('node:assert/strict');
const Repository=require('../js/services/financialRepositoryV11.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=()=>({selectedMonth:'2026-11',months:{'2026-11':{salary:3000,budgetLimit:5000,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[]}}});
const cents=x=>Math.round(x*100);
const sum=(items,key)=>items.reduce((n,x)=>n+cents(x[key]||0),0);
const totals=m=>{const salary=cents(m.salary||0),extra=sum(m.extraIncomes||[],'amount'),expenses=sum(m.expenses||[],'amount'),cards=sum(m.cardExpenses||[],'installmentValue'),invested=sum((m.expenses||[]).filter(x=>x.category==='investimentos'),'amount');return {salary,extra,expenses,cards,invested,available:salary+extra-expenses-cards};};
function harness(){const db=initial(),repo=Repository.create(db);let revision=0,sequence=0;const apply=(type,payload)=>{const result=repo.execute({schemaVersion:1,operationId:'synthetic-eq-'+(++sequence),actorId:'synthetic',commandType:type,payload,expectedRevision:revision});assert.equal(result.status,'committed',JSON.stringify(result));revision++;return repo.read().database};return {repo,apply};}
test('EQ-01 salario em centavos equivale ao oraculo de saldo',()=>{
 const {repo,apply}=harness();apply('SET_SALARY',{month:'2026-11',amountCents:456789});const m=repo.read().database.months['2026-11'];assert.equal(cents(m.salary),456789);assert.equal(totals(m).available,456789);
});
test('EQ-02 receita extra aumenta disponivel e exclusao restaura saldo',()=>{
 const {repo,apply}=harness();apply('CREATE_EXTRA_INCOME',{month:'2026-11',item:{id:'bonus',description:'Bonus ficticio',amountCents:12345}});let m=repo.read().database.months['2026-11'];assert.equal(totals(m).available,312345);apply('DELETE_EXTRA_INCOME',{month:'2026-11',id:'bonus'});m=repo.read().database.months['2026-11'];assert.equal(totals(m).available,300000);
});
test('EQ-03 despesas fixas e unicas equivalem ao total independente',()=>{
 const {repo,apply}=harness();apply('UPSERT_EXPENSE',{month:'2026-11',item:{id:'f',title:'Energia',type:'fixed',amountCents:15125}});apply('UPSERT_EXPENSE',{month:'2026-11',item:{id:'v',title:'Mercado',type:'one-time',amountCents:8040}});const m=repo.read().database.months['2026-11'];assert.deepEqual({spent:totals(m).expenses,available:totals(m).available},{spent:23165,available:276835});
});
test('EQ-04 cartao de credito reduz saldo apenas pelo valor mensal',()=>{
 const {repo,apply}=harness();apply('UPSERT_CARD_EXPENSE',{month:'2026-11',item:{id:'c',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,amountCents:7000}});const m=repo.read().database.months['2026-11'];assert.equal(totals(m).cards,7000);assert.equal(totals(m).available,293000);
});
test('EQ-05 investimento categorizado como despesa abate salario sem duplicar renda',()=>{
 const {repo,apply}=harness();apply('UPSERT_EXPENSE',{month:'2026-11',item:{id:'inv',title:'Aporte ficticio',type:'one-time',category:'investimentos',amountCents:20000}});const m=repo.read().database.months['2026-11'];assert.equal(totals(m).invested,20000);assert.equal(totals(m).extra,0);assert.equal(totals(m).available,280000);
});
test('EQ-06 historico mensal preserva mes anterior e herda fixas e parcelas',()=>{
 const {repo,apply}=harness();apply('UPSERT_EXPENSE',{month:'2026-11',item:{id:'f',title:'Internet',type:'fixed',amountCents:10000}});apply('UPSERT_CARD_EXPENSE',{month:'2026-11',item:{id:'p',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,amountCents:5000}});const before=clone(repo.read().database.months['2026-11']);apply('CREATE_MONTH',{month:'2026-12'});const db=repo.read().database;assert.deepEqual(db.months['2026-11'],before);assert.equal(db.selectedMonth,'2026-11');assert.equal(db.months['2026-12'].salary,3000);assert.equal(totals(db.months['2026-12']).expenses,10000);assert.equal(totals(db.months['2026-12']).cards,5000);assert.equal(db.months['2026-12'].cardExpenses[0].currentInstallment,2);
});
test('EQ-07 sincronizacao nao duplica despesas nem parcelas',()=>{
 const {repo,apply}=harness();apply('UPSERT_EXPENSE',{month:'2026-11',item:{id:'f',title:'Internet',type:'fixed',amountCents:10000}});apply('UPSERT_CARD_EXPENSE',{month:'2026-11',item:{id:'p',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,amountCents:5000}});apply('CREATE_MONTH',{month:'2026-12'});const before=totals(repo.read().database.months['2026-12']);apply('SYNC_PREVIOUS_MONTH',{month:'2026-12'});const db=repo.read().database;assert.deepEqual(totals(db.months['2026-12']),before);assert.equal(db.months['2026-12'].expenses.length,1);assert.equal(db.months['2026-12'].cardExpenses.length,1);
});
test('EQ-08 valores decimais ficticios mantem centavos em operacoes encadeadas',()=>{
 const {repo,apply}=harness();for(const [id,amount] of [['a',10],['b',20],['c',30]])apply('UPSERT_EXPENSE',{month:'2026-11',item:{id,title:id,type:'one-time',amountCents:amount}});const m=repo.read().database.months['2026-11'];assert.equal(totals(m).expenses,60);assert.equal(totals(m).available,299940);
});
