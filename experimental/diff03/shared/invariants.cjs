'use strict';
const C=require('./contracts.cjs');
const {fail}=require('./errors.cjs');
const {plain,own,id,month,revision,money,json,types,states,actions,outcome,key,digest}=C;
const array=Array.isArray;
const ensure=(ok)=>{if(!ok) fail('INVALID_SNAPSHOT');};
function emptyMonth(){return {salary:0,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[]};}
function pendingIdentity(p){return {type:p.type,originMonth:p.originMonth,targetMonth:p.targetMonth,sourceId:p.sourceId};}
function pendingId(p){return key('pending',pendingIdentity(p));}
function validateMonth(m){
  ensure(plain(m)&&money(m.salary)&&m.salary>=0&&money(m.budgetLimit)&&m.budgetLimit>=0);
  for(const k of ['extraIncomes','expenses','cardExpenses','deletedInstallmentOrigins']) ensure(array(m[k]));
  for(const x of m.extraIncomes) ensure(plain(x)&&id(x.id)&&money(x.amount)&&x.amount>=0);
  for(const x of m.expenses) ensure(plain(x)&&id(x.id)&&money(x.amount)&&x.amount>=0&&['fixed','one-time','variable'].includes(x.type)&&(x.paid===undefined||typeof x.paid==='boolean'));
  for(const x of m.cardExpenses){
    ensure(plain(x)&&id(x.id)&&money(x.installmentValue)&&x.installmentValue>=0&&typeof x.isInstallment==='boolean'&&(x.paid===undefined||typeof x.paid==='boolean'));
    if(x.originId!==undefined) ensure(id(x.originId));
    if(x.isInstallment) ensure(Number.isSafeInteger(x.installments)&&x.installments>=2&&Number.isSafeInteger(x.currentInstallment)&&x.currentInstallment>=1&&x.currentInstallment<=x.installments);
  }
  ensure(m.deletedInstallmentOrigins.every(id));
}
function unique(list, field){return new Set(list.map(x=>x[field])).size===list.length;}
function sourceExists(s,p){
  const m=s.financialState.months[p.originMonth]; if(!m)return false;
  if(p.type==='SALARY_GAP')return p.sourceId==='salary'&&m.salary>0;
  if(p.type==='FIXED_EXPENSE_GAP')return m.expenses.some(x=>x.id===p.sourceId&&x.type==='fixed');
  return m.cardExpenses.some(x=>(x.originId||x.id)===p.sourceId||x.id===p.sourceId);
}
function deleted(s,p){
  if(!['INSTALLMENT_GAP','SOURCE_AMBIGUITY','DELETION_CONFLICT'].includes(p.type))return false;
  const aliases=new Set([p.sourceId]);
  for(const m of Object.values(s.financialState.months)){
    for(const c of m.cardExpenses) if(c.originId===p.sourceId||c.id===p.sourceId){aliases.add(c.id);if(c.originId)aliases.add(c.originId);}
  }
  return Object.entries(s.financialState.months).some(([ym,m])=>ym<=p.targetMonth&&m.deletedInstallmentOrigins.some(x=>aliases.has(x)));
}
function validate(s){
  ensure(plain(s)&&json(s)&&s.contractVersion==='1.1'&&revision(s.revision)&&plain(s.financialState)&&plain(s.financialState.months));
  const months=s.financialState.months; const names=Object.keys(months);
  ensure(names.every(month));
  ensure(s.financialState.selectedMonth===null ? names.length===0 : month(s.financialState.selectedMonth)&&own(months,s.financialState.selectedMonth));
  for(const m of Object.values(months))validateMonth(m);
  ensure(plain(s.reconciliation)&&array(s.reconciliation.pending)&&array(s.reconciliation.history)&&array(s.operationReceipts));
  const {pending,history}=s.reconciliation;
  for(const p of pending){
    ensure(plain(p)&&types.includes(p.type)&&month(p.originMonth)&&month(p.targetMonth)&&p.originMonth<p.targetMonth&&own(months,p.targetMonth)&&id(p.sourceId)&&states.includes(p.status)&&p.pendingId===pendingId(p)&&sourceExists(s,p));
  }
  ensure(unique(pending,'pendingId'));
  for(const h of history){
    ensure(plain(h)&&id(h.historyId)&&id(h.actorId)&&id(h.pendingId)&&actions.includes(h.decision)&&h.decision!=='CANCEL'&&typeof h.reason==='string'&&h.reason.trim().length>0&&revision(h.previousRevision)&&h.resultingRevision===h.previousRevision+1&&h.resultingRevision<=s.revision&&h.financialImpact===0&&h.status===outcome(h.decision));
    const p=pending.find(x=>x.pendingId===h.pendingId);
    ensure(p&&h.targetMonth===p.targetMonth&&h.originMonth===p.originMonth&&h.sourceId===p.sourceId&&h.type===p.type);
  }
  ensure(unique(history,'historyId')&&unique(history,'resultingRevision'));
  for(const p of pending){
    const entries=history.filter(h=>h.pendingId===p.pendingId).sort((a,b)=>a.resultingRevision-b.resultingRevision);
    ensure(entries.slice(0,-1).every(h=>h.status==='OPEN'));
    ensure(entries.length?entries.at(-1).status===p.status:p.status==='OPEN');
  }
  for(const r of s.operationReceipts){
    ensure(plain(r)&&id(r.operationId)&&id(r.receiptId)&&['CONFIRM_MONTH_CREATION','RESOLVE_RECONCILIATION'].includes(r.kind)&&typeof r.requestDigest==='string'&&/^[a-f0-9]{64}$/.test(r.requestDigest)&&plain(r.result)&&r.result.status==='committed'&&r.result.receiptId===r.receiptId&&revision(r.result.revision)&&r.result.revision>0&&r.result.revision<=s.revision);
    ensure(r.receiptId===key('receipt',{kind:r.kind,operationId:r.operationId,requestDigest:r.requestDigest}));
    if(r.kind==='CONFIRM_MONTH_CREATION')ensure(month(r.result.createdMonth)&&own(months,r.result.createdMonth)&&array(r.result.pendingIds)&&r.result.pendingIds.every(x=>pending.some(p=>p.pendingId===x&&p.targetMonth===r.result.createdMonth)));
    else ensure(history.some(h=>h.historyId===r.result.historyId&&h.pendingId===r.result.pendingId&&h.resultingRevision===r.result.revision&&h.status===r.result.resolutionStatus)&&r.result.financialImpact===0);
  }
  ensure(unique(s.operationReceipts,'operationId')&&unique(s.operationReceipts,'receiptId')&&unique(s.operationReceipts.map(r=>r.result),'revision'));
  ensure(history.every(h=>s.operationReceipts.some(r=>r.kind==='RESOLVE_RECONCILIATION'&&r.result.historyId===h.historyId)));
  const revisions=s.operationReceipts.map(r=>r.result.revision).sort((a,b)=>a-b);
  ensure(!revisions.length||revisions.at(-1)===s.revision);
  ensure(revisions.every((v,i)=>i===0||v===revisions[i-1]+1));
  return s;
}
function monthNet(m){
  return m.salary+m.extraIncomes.reduce((a,x)=>a+x.amount,0)-m.expenses.reduce((a,x)=>a+x.amount,0)-m.cardExpenses.reduce((a,x)=>a+x.installmentValue,0);
}
// Read-only synthetic projection of existing gap-stop semantics; never used by application.
function balances(s){
  const ms=s.financialState.months;const out={};
  for(const ym of Object.keys(ms).sort()){
    const y=Number(ym.slice(0,4)),m=Number(ym.slice(5));
    const prev=m===1?String(y-1).padStart(4,'0')+'-12':ym.slice(0,5)+String(m-1).padStart(2,'0');
    out[ym]=monthNet(ms[ym])+(own(out,prev)?out[prev]:0);
  }
  return out;
}
function verifyTransition(before,after,kind,created){
  validate(after);
  if(after.revision!==before.revision+1)fail('INVARIANT_VIOLATION');
  const a=before.financialState,b=after.financialState;
  if(kind==='CONFIRM_MONTH_CREATION'){
    if(own(a.months,created)||digest(b.months[created])!==digest(emptyMonth())||b.selectedMonth!==created||Object.keys(b.months).length!==Object.keys(a.months).length+1)fail('INVARIANT_VIOLATION');
    const rest={...b.months};delete rest[created];
    if(digest(rest)!==digest(a.months))fail('INVARIANT_VIOLATION');
  }else if(digest(a)!==digest(b))fail('INVARIANT_VIOLATION');
  const oldBalances=balances(before),nextBalances=balances(after);
  // Inserting a zero-valued month inside an existing gap could bridge cumulative
  // balances; reject rather than change the semantics of any existing month.
  if(Object.keys(oldBalances).some(k=>oldBalances[k]!==nextBalances[k]))fail('INVARIANT_VIOLATION');
  const hist=before.reconciliation.history;
  if(digest(after.reconciliation.history.slice(0,hist.length))!==digest(hist))fail('INVARIANT_VIOLATION');
  const receipts=before.operationReceipts;
  if(digest(after.operationReceipts.slice(0,receipts.length))!==digest(receipts)||after.operationReceipts.length!==receipts.length+1)fail('INVARIANT_VIOLATION');
}
module.exports={emptyMonth,pendingIdentity,pendingId,sourceExists,deleted,validate,balances,verifyTransition};
