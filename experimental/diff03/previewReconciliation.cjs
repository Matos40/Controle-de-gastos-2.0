'use strict';
const C=require('./shared/contracts.cjs');
const I=require('./shared/invariants.cjs');
const {fail}=require('./shared/errors.cjs');
function preview(snapshot,p){
  C.request(p,['pendingId','expectedRevision','decision']);C.checkId(p.pendingId);C.checkRevision(p.expectedRevision,snapshot.revision);
  C.fields(p.decision,['action'],['reason']);
  const {action}=p.decision;
  if(!C.actions.includes(action))fail('INVALID_DECISION');
  const pending=snapshot.reconciliation.pending.find(x=>x.pendingId===p.pendingId);
  if(!pending)fail('PENDING_NOT_FOUND');
  if(pending.status!=='OPEN')fail('PENDING_ALREADY_RESOLVED');
  if(action==='CANCEL')return {status:'cancelled',baseRevision:snapshot.revision,pendingId:p.pendingId,financialImpact:0};
  const reason=typeof p.decision.reason==='string'?p.decision.reason.trim():'';
  if(!reason||reason.length>2048)fail('REASON_REQUIRED');
  if(!I.sourceExists(snapshot,pending))fail('SOURCE_NOT_FOUND');
  if(action==='CONFIRM_CONTINUITY'){
    if(pending.type==='DELETION_CONFLICT'||I.deleted(snapshot,pending))fail('SOURCE_DELETED');
    if(pending.type==='SOURCE_AMBIGUITY')fail('INVALID_DECISION');
  }
  const data={status:'preview',baseRevision:snapshot.revision,pendingId:p.pendingId,proposedDecision:action,reason,financialImpact:0,snapshotDigest:C.digest(snapshot)};
  return {...data,previewId:C.key('preview',{kind:'RESOLVE_RECONCILIATION',data})};
}
module.exports=preview;
