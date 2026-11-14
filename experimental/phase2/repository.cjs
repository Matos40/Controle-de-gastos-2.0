'use strict';
// Experimental composition. Never loaded by the application.
const Core=require('../../js/services/financialRepositoryV11.js');
const Integrity=require('../../js/services/financialRepositoryV11Integrity.js');
const Legacy=require('../../js/services/financialRepositoryV11LegacyPlan.js');
const C=require('../diff03/shared/contracts.cjs');
const {createLab}=require('../diff03/shared/snapshotLab.cjs');
const clone=C.clone,digest=C.digest;
const fail=code=>{throw Error(code);};
const rejected=code=>({status:'rejected',code});
const validId=x=>C.id(x)&&!['__proto__','prototype','constructor'].includes(x);
const validRevision=n=>Number.isSafeInteger(n)&&n>=0;
const validMonth=x=>C.month(x);
function checkDatabase(db){
 if(!C.json(db))fail('INVALID_DATABASE');
 Integrity.validate(db);Core.validateDatabase(db);
 for(const [ym,m] of Object.entries(db.months)){
  if(!validMonth(ym))fail('INVALID_MONTH');
  for(const group of ['expenses','cardExpenses','extraIncomes']){
   const rows=m[group]||[]; const ids=new Set();
   for(const row of rows){
    if(!row||!validId(row.id)||ids.has(row.id))fail('INVALID_OR_DUPLICATE_ID');
    ids.add(row.id);
    const money=group==='cardExpenses'?row.installmentValue:row.amount;
    if(!C.money(money)||money<0)fail('INVALID_MONEY');
   }
  }
 }
 return db;
}
function projection(db){
 const months={};
 for(const [ym,m] of Object.entries(db.months)){
  for(const card of m.cardExpenses){
   if(card.installmentOriginId&&card.originId&&card.installmentOriginId!==card.originId)fail('AMBIGUOUS_ORIGIN');
  }
  // The existing core stores tombstones as origin:number; Phase 1 expects
  // an origin-level marker. Widen only in this projection, never in financial data.
  const tombstones=(m.deletedInstallmentOrigins||[]).flatMap(x=>{
   const match=/^(.+):([1-9][0-9]*)$/.exec(x);
   return match?[x,match[1]]:[x];
  });
  months[ym]={salary:m.salary||0,budgetLimit:m.budgetLimit||0,
   extraIncomes:clone(m.extraIncomes||[]),expenses:clone(m.expenses),
   cardExpenses:m.cardExpenses.map(x=>({...clone(x),isInstallment:Boolean(x.isInstallment),...(x.installmentOriginId?{originId:x.installmentOriginId}:{})})),
   deletedInstallmentOrigins:[...new Set(tombstones)]};
 }
 return {contractVersion:'1.1',revision:0,financialState:{selectedMonth:db.selectedMonth,months},reconciliation:{pending:[],history:[]},operationReceipts:[]};
}
function previous(ym){const [y,m]=ym.split('-').map(Number);return m===1?String(y-1).padStart(4,'0')+'-12':ym.slice(0,5)+String(m-1).padStart(2,'0');}
function balances(db){
 const out={};
 for(const ym of Object.keys(db.months).sort()){
  const m=db.months[ym];
  const cents=x=>{const n=Math.round(x*100);if(!Number.isSafeInteger(n))fail('INVALID_MONEY');return n;};
  const net=cents(m.salary||0)+(m.extraIncomes||[]).reduce((s,x)=>s+cents(x.amount),0)-m.expenses.reduce((s,x)=>s+cents(x.amount),0)-m.cardExpenses.reduce((s,x)=>s+cents(x.installmentValue),0);
  out[ym]=net+(out[previous(ym)]||0);if(!Number.isSafeInteger(net)||!Number.isSafeInteger(out[ym]))fail('INVALID_MONEY');
 }
 return out;
}
function checkPending(p,db){
 if(!p||!validId(p.pendingId)||!validId(p.sourceId)||!validMonth(p.originMonth)||!validMonth(p.targetMonth)||p.originMonth>=p.targetMonth||!Object.hasOwn(db.months,p.originMonth)||!Object.hasOwn(db.months,p.targetMonth)||!C.types.includes(p.type)||!C.states.includes(p.status))fail('INVALID_PENDING');
 const identity={type:p.type,originMonth:p.originMonth,targetMonth:p.targetMonth,sourceId:p.sourceId};
 if(p.pendingId!==C.key('pending',identity))fail('INVALID_PENDING');
}
function body(s){const {checksum,...rest}=s;return rest;}
function seal(s){return {...body(s),checksum:digest(body(s))};}
function verify(s){
 if(!C.json(s)||!s||s.schemaVersion!==1||!validId(s.uid)||!validRevision(s.revision)||!Array.isArray(s.receipts)||!Array.isArray(s.pending)||!Array.isArray(s.history)||s.checksum!==digest(body(s)))fail('INVALID_ENVELOPE');
 checkDatabase(s.database);
 if(typeof s.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(s.sourceDigest))fail('INVALID_PROVENANCE');
 if(s.receipts.length!==s.revision)fail('INVALID_RECEIPTS');
 const ids=new Set();
 for(let i=0;i<s.receipts.length;i++){
  const x=s.receipts[i];if(!x||!validId(x.operationId)||ids.has(x.operationId)||!validId(x.actorId)||x.revision!==i+1||typeof x.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(x.fingerprint)||!x.result||x.result.status!=='committed'||x.result.revision!==x.revision||x.result.operationId!==x.operationId)fail('INVALID_RECEIPTS');
  ids.add(x.operationId);
 }
 const ps=new Set();
 for(const p of s.pending){checkPending(p,s.database);if(ps.has(p.pendingId))fail('INVALID_PENDING');ps.add(p.pendingId);}
 const hs=new Set();
 for(const h of s.history){
  const p=s.pending.find(x=>x.pendingId===h.pendingId);
  if(!p||!validId(h.operationId)||hs.has(h.operationId)||!validId(h.actorId)||!['KEEP_PENDING','DISMISS','CONFIRM_CONTINUITY'].includes(h.decision)||C.outcome(h.decision)!==h.status||typeof h.reason!=='string'||!h.reason.trim()||h.financialImpact!==0||!validRevision(h.revision)||h.revision<1||h.revision>s.revision||h.originMonth!==p.originMonth||h.targetMonth!==p.targetMonth||h.sourceId!==p.sourceId||!s.receipts.some(r=>r.operationId===h.operationId&&r.revision===h.revision&&r.actorId===h.actorId&&r.result.pendingId===h.pendingId&&r.result.resolutionStatus===h.status))fail('INVALID_HISTORY');
  hs.add(h.operationId);
 }
 for(const p of s.pending){const entries=s.history.filter(h=>h.pendingId===p.pendingId).sort((a,b)=>a.revision-b.revision);if(entries.slice(0,-1).some(h=>h.status!=='OPEN')||(entries.length?entries.at(-1).status:'OPEN')!==p.status)fail('INVALID_HISTORY');}
 for(const r of s.receipts)if(r.result.pendingId&&!hs.has(r.operationId))fail('INVALID_HISTORY');
 return clone(s);
}
async function prepareMigration(input,uid){
 if(!validId(uid)||!C.json(input))fail('INVALID_MIGRATION_INPUT');
 const original=clone(input);
 if(original&&Object.hasOwn(original,'schemaVersion')&&!(original.schemaVersion===1&&original.database&&original.algorithm==='SHA-256'))fail('INVALID_MIGRATION_INPUT');
 const inspected=await Legacy.inspect(original);
 const db=checkDatabase(inspected.verifiedDatabase);
 const originalDigest=digest(original);
 const envelope=seal({schemaVersion:1,uid,revision:0,sourceDigest:inspected.sourceDigest,database:clone(db),pending:[],history:[],receipts:[]});
 verify(envelope);
 return {mode:'EXPERIMENTAL_COPY',original,originalDigest,envelope,planId:digest({uid,originalDigest,checksum:envelope.checksum})};
}
function createStore(){
 const slots=new Map();let queue=Promise.resolve();let fault=null;
 function transact(uid,fn){
  if(!validId(uid))return Promise.reject(Error('INVALID_UID'));
  const work=queue.then(()=>{
   if(fault==='before'){fault=null;fail('UNAVAILABLE');}
   const old=slots.has(uid)?clone(slots.get(uid)):null;
   const result=fn(old);
   if(result&&Object.hasOwn(result,'write')){
    if(result.write!==null){const sealed=verify(result.write);if(sealed.uid!==uid)fail('UID_MISMATCH');}
    if(fault==='abort'){fault=null;fail('COMMIT_ABORTED');}
    if(result.write===null)slots.delete(uid);else slots.set(uid,clone(result.write));
    if(fault==='lost'){fault=null;fail('ACK_LOST');}
   }
   return clone(result.response);
  });
  queue=work.catch(()=>{});return work;
 }
 return Object.freeze({transact,failNext(point){if(!['before','abort','lost'].includes(point))fail('INVALID_FAULT');fault=point;}});
}
async function activateCopy(store,plan,uid,consent){
 if(consent!==true)return rejected('CONSENT_REQUIRED');
 try{
  if(!plan||plan.mode!=='EXPERIMENTAL_COPY'||plan.envelope.uid!==uid||digest(plan.original)!==plan.originalDigest)return rejected('INVALID_PLAN');
  const rebuilt=await prepareMigration(plan.original,uid);
  if(rebuilt.planId!==plan.planId||digest(rebuilt.envelope)!==digest(plan.envelope))return rejected('INVALID_PLAN');
  return await store.transact(uid,current=>current!==null?{response:rejected('DESTINATION_EXISTS')}:{write:rebuilt.envelope,response:{status:'initialized',revision:0}});
 }catch(e){return e.message==='ACK_LOST'?{status:'unknown',code:'ACK_LOST'}:rejected('MIGRATION_FAILED');}
}
async function rollbackCopy(store,plan,uid,consent){
 if(consent!==true)return rejected('CONSENT_REQUIRED');
 try{
  const rebuilt=await prepareMigration(plan.original,uid);
  if(rebuilt.planId!==plan.planId||plan.originalDigest!==rebuilt.originalDigest||plan.envelope.uid!==uid)return rejected('INVALID_PLAN');
  return await store.transact(uid,current=>{
   if(!current)return {response:{status:'absent'}};
   if(current.uid!==uid||current.checksum!==rebuilt.envelope.checksum||current.revision!==0)return {response:rejected('DESTINATION_CHANGED')};
   return {write:null,response:{status:'rolled_back',original:clone(rebuilt.original),originalDigest:rebuilt.originalDigest}};
  });
 }catch(e){return e.message==='ACK_LOST'?{status:'unknown',code:'ACK_LOST'}:rejected('ROLLBACK_FAILED');}
}
function createRepository(store,uid){
 if(!validId(uid)||!store||typeof store.transact!=='function')fail('INVALID_DEPENDENCIES');
 async function read(){return store.transact(uid,s=>({response:s===null?null:verify(s)}));}
 function monthPreview(s,targetMonth){
  if(!validMonth(targetMonth))fail('INVALID_MONTH');
  if(Object.hasOwn(s.database.months,targetMonth))fail('MONTH_ALREADY_EXISTS');
  const lab=createLab(projection(s.database));
  const p=lab.PREVIEW_MONTH_CREATION({contractVersion:'1.1',targetMonth,expectedRevision:0});
  if(p.status!=='preview')fail(p.code);
  return {kind:'CREATE_MONTH',targetMonth,baseRevision:s.revision,baseChecksum:s.checksum,missingMonths:p.missingMonths,proposedPending:p.proposedPending};
 }
 function reconciliationPreview(s,pendingId,decision,reason){
  const p=s.pending.find(x=>x.pendingId===pendingId);
  if(!p)fail('PENDING_NOT_FOUND');
  if(p.status!=='OPEN')fail('PENDING_ALREADY_RESOLVED');
  if(decision==='CANCEL')return {status:'cancelled',financialImpact:0};
  if(!['DISMISS','KEEP_PENDING','CONFIRM_CONTINUITY'].includes(decision))fail('INVALID_DECISION');
  if(typeof reason!=='string'||!reason.trim()||reason.length>2048)fail('REASON_REQUIRED');
  if(decision==='CONFIRM_CONTINUITY'){
   const current=projection(s.database);
   const origin=current.financialState.months[p.originMonth];
   const source=p.type==='SALARY_GAP'?origin.salary>0:p.type==='FIXED_EXPENSE_GAP'?origin.expenses.some(x=>x.id===p.sourceId&&x.type==='fixed'):origin.cardExpenses.some(x=>(x.originId||x.id)===p.sourceId);
   if(!source)fail('SOURCE_NOT_FOUND');
   const aliases=new Set([p.sourceId]);
   for(const m of Object.values(current.financialState.months))for(const c of m.cardExpenses)if(c.originId===p.sourceId||c.id===p.sourceId){aliases.add(c.id);if(c.originId)aliases.add(c.originId);}
   const deleted=Object.entries(current.financialState.months).some(([ym,m])=>ym<=p.targetMonth&&m.deletedInstallmentOrigins.some(x=>aliases.has(x)));
   if(p.type==='DELETION_CONFLICT'||(p.type==='INSTALLMENT_GAP'&&deleted))fail('SOURCE_DELETED');
   if(p.type==='SOURCE_AMBIGUITY'||(p.type==='INSTALLMENT_GAP'&&origin.cardExpenses.filter(x=>(x.originId||x.id)===p.sourceId).length!==1))fail('INVALID_DECISION');
  }
  return {kind:'RESOLVE_RECONCILIATION',pendingId,decision,reason:reason.trim(),baseRevision:s.revision,baseChecksum:s.checksum,financialImpact:0};
 }
 async function preview(q){
  try{
   if(!C.json(q)||!q||!validRevision(q.expectedRevision))return rejected('INVALID_PREVIEW');
   const s=await read();if(!s)return rejected('NOT_INITIALIZED');
   if(q.expectedRevision!==s.revision)return {status:'conflict',code:'REVISION_MISMATCH',revision:s.revision};
   let p;if(q.kind==='CREATE_MONTH')p=monthPreview(s,q.targetMonth);
   else if(q.kind==='RESOLVE_RECONCILIATION')p=reconciliationPreview(s,q.pendingId,q.decision,q.reason);
   else return rejected('INVALID_PREVIEW');
   if(p.status==='cancelled')return p;
   const result={status:'preview',...p,previewId:C.key('phase2-preview',{uid,...p})};
   return clone(result);
  }catch(e){return rejected(e.message);}
 }
 function executeIn(s,q){
  if(!s)return {response:rejected('NOT_INITIALIZED')};
  verify(s);
  if(!C.json(q)||!q||q.schemaVersion!==1||q.actorId!==uid||!validId(q.operationId)||!validRevision(q.expectedRevision)||!C.plain(q.payload)||typeof q.commandType!=='string')return {response:rejected('INVALID_COMMAND')};
  const signature=digest(q);
  const prior=s.receipts.find(r=>r.operationId===q.operationId);
  if(prior)return {response:prior.fingerprint===signature?{...prior.result,replay:true}:rejected('OPERATION_ID_REUSED')};
  if(q.expectedRevision!==s.revision)return {response:{status:'conflict',code:'REVISION_MISMATCH',revision:s.revision}};
  const next=clone(s),extra={};
  try{
   if(q.commandType==='REPLACE_FINANCIAL_DATABASE')fail('MIGRATION_REQUIRED');
   if(q.commandType==='CREATE_MONTH'||q.commandType==='RESOLVE_RECONCILIATION'){
    if(q.payload.confirmation!==true)fail('CONFIRMATION_REQUIRED');
    // Recompute the exact preview at the current revision, including after restart.
    // Digest is a binding token, not an authentication or authorization credential.
    const fresh=q.commandType==='CREATE_MONTH'?monthPreview(s,q.payload.month):reconciliationPreview(s,q.payload.pendingId,q.payload.decision,q.payload.reason);
    if(fresh.status==='cancelled')fail('INVALID_DECISION');
    const previewId=C.key('phase2-preview',{uid,...fresh});
    if(q.payload.previewId!==previewId)fail('PREVIEW_STALE');
    if(q.commandType==='CREATE_MONTH'){
     const target=fresh.targetMonth;
     const core=Core.create(next.database,{revision:s.revision});
     const out=core.execute({...q,payload:{month:target}});
     if(out.status!=='committed')return {response:out};
     next.database=core.read().database;
     const old=balances(s.database),after=balances(next.database);
     if(Object.keys(old).some(k=>old[k]!==after[k]))fail('INVARIANT_VIOLATION');
     for(const p of fresh.proposedPending)if(!next.pending.some(x=>x.pendingId===p.pendingId))next.pending.push(clone(p));
     extra.createdMonth=target;extra.pendingIds=fresh.proposedPending.map(p=>p.pendingId);
    }else{
     const p=next.pending.find(x=>x.pendingId===fresh.pendingId);
     p.status=C.outcome(fresh.decision);
     next.history.push({operationId:q.operationId,actorId:uid,pendingId:p.pendingId,originMonth:p.originMonth,targetMonth:p.targetMonth,sourceId:p.sourceId,decision:fresh.decision,reason:fresh.reason,status:p.status,financialImpact:0,revision:s.revision+1});
     extra.pendingId=p.pendingId;extra.resolutionStatus=p.status;extra.financialImpact=0;
    }
   }else{
    // Prevent bypass of gap checks through alternate creation or inheritance commands.
    if(['ADVANCE_MONTH','SYNC_PREVIOUS_MONTH'].includes(q.commandType))fail('MONTH_WORKFLOW_REQUIRES_PREVIEW');
    const core=Core.create(next.database,{revision:s.revision});
    const outcome=core.execute(q);
    if(outcome.status!=='committed')return {response:outcome};
    next.database=core.read().database;
   }
   checkDatabase(next.database);
   next.revision++;
   const result={status:'committed',revision:next.revision,operationId:q.operationId,...extra};
   next.receipts.push({operationId:q.operationId,actorId:uid,revision:next.revision,fingerprint:signature,result});
   const sealed=seal(next);verify(sealed);
   return {write:sealed,response:result};
  }catch(e){return {response:rejected(e.message)};}
 }
 async function execute(q){
  // Freeze caller intent synchronously before crossing the async boundary.
  if(!C.json(q))return rejected('INVALID_COMMAND');const request=clone(q);
  try{return await store.transact(uid,s=>executeIn(s,request));}
  catch(_){
   try{const state=await read();const receipt=state&&state.receipts.find(x=>x.operationId===request.operationId);if(receipt)return receipt.fingerprint===digest(request)?{...receipt.result,replay:true,recovered:true}:rejected('OPERATION_ID_REUSED');}catch(_){}
   return {status:'unknown',code:'COMMIT_UNCONFIRMED'};
  }
 }
 return Object.freeze({read,preview,execute});
}
module.exports={prepareMigration,activateCopy,rollbackCopy,createStore,createRepository,verify,checkDatabase,projection};
