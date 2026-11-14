'use strict';
// Synthetic-only regression scenarios. No I/O, no integration and no real financial data.
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../js/services/financialRepositoryV11.js');
const month=(salary=0)=>({salary,expenses:[],cardExpenses:[],extraIncomes:[],deletedInstallmentOrigins:[]});
const initial=()=>({selectedMonth:'2026-12',months:{'2026-12':month(1000)}});
function run(db){const repo=R.create(db);let rev=0,n=0;const cmd=(type,payload)=>{const result=repo.execute({schemaVersion:1,operationId:'eq-advanced-'+(++n),actorId:'synthetic',commandType:type,payload,expectedRevision:rev});assert.equal(result.status,'committed',JSON.stringify(result));rev++;return repo.read().database};return {repo,cmd};}
const cents=n=>Math.round((n||0)*100);
const net=m=>cents(m.salary)+(m.extraIncomes||[]).reduce((s,x)=>s+cents(x.amount),0)-(m.expenses||[]).reduce((s,x)=>s+cents(x.amount),0)-(m.cardExpenses||[]).reduce((s,x)=>s+cents(x.installmentValue),0);
const previous=ym=>{const [y,m]=ym.split('-').map(Number);return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;};
function cumulative(db,ym){const seen=new Set();let total=0;while(db.months[ym]){assert.ok(!seen.has(ym));seen.add(ym);total+=net(db.months[ym]);ym=previous(ym);}return total;}
test('EQ-09 virada de dezembro para janeiro preserva origem e herda fixas',()=>{
 const {repo,cmd}=run(initial());cmd('UPSERT_EXPENSE',{month:'2026-12',item:{id:'fixed',title:'Internet',type:'fixed',amountCents:12345}});const before=JSON.stringify(repo.read().database.months['2026-12']);cmd('ADVANCE_MONTH',{month:'2027-01',fromMonth:'2026-12'});const db=repo.read().database;assert.equal(JSON.stringify(db.months['2026-12']),before);assert.equal(db.months['2027-01'].salary,1000);assert.equal(net(db.months['2027-01']),87655);assert.equal(db.selectedMonth,'2026-12');
});
test('EQ-10 parcela excluida registra bloqueio e nao reaparece na sincronizacao',()=>{
 const {repo,cmd}=run(initial());cmd('UPSERT_CARD_EXPENSE',{month:'2026-12',item:{id:'origin',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,amountCents:5000}});cmd('CREATE_MONTH',{month:'2027-01'});const january=repo.read().database.months['2027-01'];assert.equal(january.cardExpenses.length,1);const installment=january.cardExpenses[0];cmd('DELETE_CARD_EXPENSE',{month:'2027-01',id:installment.id,scope:'current'});cmd('SYNC_PREVIOUS_MONTH',{month:'2027-01'});const db=repo.read().database;assert.deepEqual(db.months['2027-01'].cardExpenses,[]);assert.ok(db.months['2027-01'].deletedInstallmentOrigins.includes('origin:2'));assert.equal(db.months['2026-12'].cardExpenses.length,1);
});
test('EQ-11 edicao em mes anterior nao modifica automaticamente mes ja criado',()=>{
 const {repo,cmd}=run(initial());cmd('UPSERT_EXPENSE',{month:'2026-12',item:{id:'fixed',title:'Internet',type:'fixed',amountCents:10000}});cmd('CREATE_MONTH',{month:'2027-01'});const janBefore=JSON.stringify(repo.read().database.months['2027-01']);cmd('UPSERT_EXPENSE',{month:'2026-12',item:{id:'fixed',title:'Internet',type:'fixed',amountCents:18000}});const db=repo.read().database;assert.equal(JSON.stringify(db.months['2027-01']),janBefore);assert.equal(net(db.months['2026-12']),82000);assert.equal(net(db.months['2027-01']),90000);
});
test('EQ-12 saldos acumulados com receitas despesas e cartao seguem oraculo independente',()=>{
 const {repo,cmd}=run(initial());cmd('CREATE_EXTRA_INCOME',{month:'2026-12',item:{id:'bonus',description:'Bonus ficticio',amountCents:12500}});cmd('UPSERT_EXPENSE',{month:'2026-12',item:{id:'food',title:'Mercado',type:'one-time',amountCents:20000}});cmd('CREATE_MONTH',{month:'2027-01'});cmd('UPSERT_CARD_EXPENSE',{month:'2027-01',item:{id:'card',title:'Compra',amountCents:5000}});const db=repo.read().database;assert.equal(net(db.months['2026-12']),92500);assert.equal(net(db.months['2027-01']),95000);assert.equal(cumulative(db,'2027-01'),187500);assert.equal(cumulative(db,'2026-12'),92500);
});
test('EQ-13 editar mes anterior altera acumulado sem reescrever meses futuros',()=>{
 const {repo,cmd}=run(initial());cmd('CREATE_MONTH',{month:'2027-01'});cmd('CREATE_MONTH',{month:'2027-02'});const future=JSON.stringify(repo.read().database.months['2027-02']);const before=cumulative(repo.read().database,'2027-02');cmd('UPSERT_EXPENSE',{month:'2026-12',item:{id:'old',title:'Despesa antiga',type:'one-time',amountCents:2500}});const after=repo.read().database;assert.equal(cumulative(after,'2027-02'),before-2500);assert.equal(JSON.stringify(after.months['2027-02']),future);assert.equal(after.selectedMonth,'2026-12');
});
