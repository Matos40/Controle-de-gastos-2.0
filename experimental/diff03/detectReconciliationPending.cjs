'use strict';
const C=require('./shared/contracts.cjs');
const I=require('./shared/invariants.cjs');
const {fail}=require('./shared/errors.cjs');
function candidates(snapshot,targetMonth){
  const months=snapshot.financialState.months;
  const {missingMonths,referenceMonth:originMonth}=C.gap(months,targetMonth);
  if(!originMonth||!missingMonths.length)return [];
  const m=months[originMonth], out=new Map();
  function add(type,sourceId){
    const p={type,originMonth,targetMonth,sourceId,status:'OPEN'};
    p.pendingId=I.pendingId(p);
    const existing=snapshot.reconciliation.pending.find(x=>x.pendingId===p.pendingId);
    out.set(p.pendingId,existing||p);
  }
  if(m.salary>0)add('SALARY_GAP','salary');
  for(const x of m.expenses.filter(x=>x.type==='fixed')){
    if(m.expenses.filter(y=>y.id===x.id).length>1)fail('INVALID_SNAPSHOT');
    add('FIXED_EXPENSE_GAP',x.id);
  }
  const installments=m.cardExpenses.filter(x=>x.isInstallment&&x.currentInstallment<x.installments);
  for(const x of installments){
    const sourceId=x.originId||x.id;
    const ambiguous=!x.originId||m.cardExpenses.filter(y=>(y.originId||y.id)===sourceId).length!==1;
    const p={type:'INSTALLMENT_GAP',sourceId,targetMonth};
    if(I.deleted(snapshot,p)||Object.entries(months).some(([ym,m])=>ym<=targetMonth&&m.deletedInstallmentOrigins.includes(x.id)))add('DELETION_CONFLICT',sourceId);
    else if(ambiguous)add('SOURCE_AMBIGUITY',sourceId);
    else add('INSTALLMENT_GAP',sourceId);
  }
  for(const p of snapshot.reconciliation.pending) if(p.targetMonth===targetMonth) out.set(p.pendingId,p);
  return [...out.values()].sort((a,b)=>a.pendingId.localeCompare(b.pendingId));
}
function detect(snapshot,p){
  C.request(p,['targetMonth','expectedRevision']);C.checkMonth(p.targetMonth);C.checkRevision(p.expectedRevision,snapshot.revision);
  return {status:'detected',baseRevision:snapshot.revision,pending:C.clone(candidates(snapshot,p.targetMonth))};
}
module.exports={detect,candidates};
