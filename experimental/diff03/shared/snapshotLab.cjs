'use strict';
// Independent Node laboratory. No application, browser, storage or network dependencies.
const C=require('./contracts.cjs');
const I=require('./invariants.cjs');
const {ContractError,fail}=require('./errors.cjs');
const monthPreview=require('../previewMonthCreation.cjs');
const monthConfirm=require('../confirmMonthCreation.cjs');
const {detect}=require('../detectReconciliationPending.cjs');
const reconPreview=require('../previewReconciliation.cjs');
const reconResolve=require('../resolveReconciliation.cjs');
const history=require('../readReconciliationHistory.cjs');
function createLab(initial){
  I.validate(initial);let snapshot=C.clone(initial);
  const previews=new Map();
  let fault=null;
  function guarded(fn){
    try{return C.clone(fn());}
    catch(e){if(!(e instanceof ContractError))throw e;return {status:'rejected',code:e.code,revision:snapshot.revision,details:C.clone(e.details)};}
  }
  function preview(kind,fn,p){
    const result=fn(snapshot,p);
    if(result.status==='preview')previews.set(result.previewId,{kind,result:C.clone(result)});
    return result;
  }
  function inject(point){
    if(fault===point){fault=null;fail('ATOMIC_COMMIT_FAILED',{point});}
  }
  function commit(kind,fn,p){
    C.writeRequest(p);
    const requestDigest=C.digest({kind,request:p});
    const existing=snapshot.operationReceipts.find(r=>r.operationId===p.operationId);
    if(existing){
      if(existing.kind!==kind||existing.requestDigest!==requestDigest)fail('IDEMPOTENCY_CONFLICT');
      return existing.result;
    }
    const stored=previews.get(p.previewId);
    if(!stored)fail('PREVIEW_NOT_FOUND');
    if(stored.kind!==kind)fail('PREVIEW_MISMATCH');
    if(stored.result.baseRevision!==snapshot.revision||stored.result.snapshotDigest!==C.digest(snapshot))fail('PREVIEW_STALE');
    C.checkRevision(p.expectedRevision,snapshot.revision);
    const next=C.clone(snapshot);
    inject('beforeApply');
    const details=fn(next,p,stored.result);
    inject('afterApply');
    next.revision++;
    const receiptId=C.key('receipt',{kind,operationId:p.operationId,requestDigest});
    const result={status:'committed',revision:next.revision,...details,receiptId};
    next.operationReceipts.push({operationId:p.operationId,receiptId,kind,requestDigest,result:C.clone(result)});
    I.verifyTransition(snapshot,next,kind,details.createdMonth);
    inject('beforeCommit');
    snapshot=next;
    return result;
  }
  return Object.freeze({
    readSnapshot:()=>C.clone(snapshot),
    readBalances:()=>C.clone(I.balances(snapshot)),
    // Deterministic one-shot fault injection for synthetic tests only.
    failNextCommit(point){if(!['beforeApply','afterApply','beforeCommit'].includes(point))throw new TypeError('Unknown fault point');fault=point;},
    PREVIEW_MONTH_CREATION:p=>guarded(()=>preview('CONFIRM_MONTH_CREATION',monthPreview,p)),
    CONFIRM_MONTH_CREATION:p=>guarded(()=>commit('CONFIRM_MONTH_CREATION',monthConfirm,p)),
    DETECT_RECONCILIATION_PENDING:p=>guarded(()=>detect(snapshot,p)),
    PREVIEW_RECONCILIATION:p=>guarded(()=>preview('RESOLVE_RECONCILIATION',reconPreview,p)),
    RESOLVE_RECONCILIATION:p=>guarded(()=>commit('RESOLVE_RECONCILIATION',reconResolve,p)),
    READ_RECONCILIATION_HISTORY:p=>guarded(()=>history(snapshot,p))
  });
}
module.exports={createLab};
