'use strict';
// Differential synthetic-only tests: evaluate exact legacy function bodies in a sandbox.
// No browser, storage, network, backup, integration or production mutation.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const Repository=require('../js/services/financialRepositoryV11.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const legacyState=fs.readFileSync(path.join(__dirname,'../js/state.js'),'utf8');
const legacyStorage=fs.readFileSync(path.join(__dirname,'../js/services/storageService.js'),'utf8');
function extract(source,name){
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'Legacy function missing: '+name);
 const brace=source.indexOf('{',start);let depth=0;
 for(let i=brace;i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&!--depth)return source.slice(start,i+1);
 }
 throw Error('Unclosed legacy function '+name);
}
function legacy(db){
 const context={appDb:clone(db),Date,Math,Number,String,Object,Array,
  inferCategoryFromTitle:()=> 'outros'};
 vm.createContext(context);
 vm.runInContext([extract(legacyState,'calculateMonthNetBalance'),
  extract(legacyState,'getPreviousMonthYM'),
  extract(legacyStorage,'ensureMonthExists')].join('\n'),context);
 return context;
}
const month=(salary=0)=>({salary,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[]});
function repo(db){const r=Repository.create(db);let rev=0,n=0;return {read:()=>r.read().database,apply:(type,payload)=>{const out=r.execute({schemaVersion:1,operationId:'diff-'+(++n),actorId:'synthetic',commandType:type,payload,expectedRevision:rev});assert.equal(out.status,'committed',JSON.stringify(out));rev++;}};}
const net=m=>(m.salary||0)+(m.extraIncomes||[]).reduce((a,x)=>a+x.amount,0)-(m.expenses||[]).reduce((a,x)=>a+x.amount,0)-(m.cardExpenses||[]).reduce((a,x)=>a+x.installmentValue,0);
test('DIFF-01 consecutive cumulative balances agree with exact legacy function',()=>{
 const db={selectedMonth:'2026-12',months:{'2026-12':month(1000),'2027-01':month(900)}};
 db.months['2026-12'].expenses.push({id:'a',title:'Despesa',amount:100,type:'one-time'});
 db.months['2027-01'].extraIncomes.push({id:'b',amount:50,description:'Bonus'});
 const ctx=legacy(db),r=repo(db);
 assert.equal(ctx.calculateMonthNetBalance('2027-01'),1750);
 assert.equal(ctx.calculateMonthNetBalance('2027-01'),net(r.read().months['2026-12'])+net(r.read().months['2027-01']));
});
test('DIFF-02 consecutive fixed and installment inheritance match by financial fields',()=>{
 const db={selectedMonth:'2026-12',months:{'2026-12':month(1000)}};
 db.months['2026-12'].expenses.push({id:'fixed',title:'Internet',type:'fixed',amount:120,paid:true});
 db.months['2026-12'].cardExpenses.push({id:'card',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:60,paid:true});
 const ctx=legacy(db);ctx.ensureMonthExists('2027-01');
 const r=repo(db);r.apply('CREATE_MONTH',{month:'2027-01'});
 const projection=m=>({salary:m.salary,expenses:m.expenses.map(x=>({title:x.title,type:x.type,amount:x.amount,paid:x.paid})),cards:m.cardExpenses.map(x=>({title:x.title,installmentValue:x.installmentValue,currentInstallment:x.currentInstallment,paid:x.paid}))});
 assert.deepEqual(projection(r.read().months['2027-01']),projection(ctx.appDb.months['2027-01']));
});
test('DIFF-03 gap month inheritance differs: legacy fallback versus immediate predecessor',()=>{
 const db={selectedMonth:'2026-11',months:{'2026-11':month(1200)}};
 db.months['2026-11'].expenses.push({id:'fixed',title:'Internet',type:'fixed',amount:100});
 const ctx=legacy(db);ctx.ensureMonthExists('2027-01');
 const r=repo(db);r.apply('CREATE_MONTH',{month:'2027-01'});
 assert.equal(ctx.appDb.months['2027-01'].salary,1200);
 assert.equal(ctx.appDb.months['2027-01'].expenses.length,1);
 assert.equal(r.read().months['2027-01'].salary,0);
 assert.equal(r.read().months['2027-01'].expenses.length,0);
});
test('DIFF-04 gap month accumulated balance stops at missing predecessor',()=>{
 const db={selectedMonth:'2026-11',months:{'2026-11':month(1200),'2027-01':month(300)}};
 const ctx=legacy(db),r=repo(db);
 assert.equal(ctx.calculateMonthNetBalance('2027-01'),300);
 assert.equal(ctx.calculateMonthNetBalance('2027-01'),net(r.read().months['2027-01']));
 assert.notEqual(ctx.calculateMonthNetBalance('2027-01'),net(r.read().months['2026-11'])+net(r.read().months['2027-01']));
});
