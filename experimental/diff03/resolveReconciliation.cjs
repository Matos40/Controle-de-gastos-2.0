'use strict';
const C=require('./shared/contracts.cjs');
const {fail}=require('./shared/errors.cjs');
const preview=require('./previewReconciliation.cjs');
function resolve(next,p,stored){
  const current=preview(next,{contractVersion:C.VERSION,pendingId:stored.pendingId,expectedRevision:next.revision,decision:{action:stored.proposedDecision,reason:stored.reason}});
  if(C.digest(current)!==C.digest(stored))fail('PREVIEW_MISMATCH');
  const pending=next.reconciliation.pending.find(x=>x.pendingId===stored.pendingId);
  const resolutionStatus=C.outcome(stored.proposedDecision);
  pending.status=resolutionStatus;
  const h={pendingId:pending.pendingId,actorId:p.actorId,decision:stored.proposedDecision,reason:stored.reason,previousRevision:next.revision,resultingRevision:next.revision+1,financialImpact:0,status:resolutionStatus,targetMonth:pending.targetMonth,originMonth:pending.originMonth,sourceId:pending.sourceId,type:pending.type};
  h.historyId=C.key('history',{operationId:p.operationId,entry:h});
  next.reconciliation.history.push(h);
  return {pendingId:pending.pendingId,resolutionStatus,financialImpact:0,historyId:h.historyId};
}
module.exports=resolve;
