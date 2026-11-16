'use strict';
const C=require('./shared/contracts.cjs');
const I=require('./shared/invariants.cjs');
const {fail}=require('./shared/errors.cjs');
const preview=require('./previewMonthCreation.cjs');
function confirm(next,p,stored){
  const current=preview(next,{contractVersion:C.VERSION,targetMonth:stored.targetMonth,expectedRevision:next.revision});
  if(C.digest(current)!==C.digest(stored))fail('PREVIEW_MISMATCH');
  next.financialState.months[stored.targetMonth]=I.emptyMonth();
  next.financialState.selectedMonth=stored.targetMonth;
  for(const pending of stored.proposedPending){
    if(!next.reconciliation.pending.some(x=>x.pendingId===pending.pendingId))next.reconciliation.pending.push(C.clone(pending));
  }
  return {createdMonth:stored.targetMonth,pendingIds:stored.proposedPending.map(x=>x.pendingId)};
}
module.exports=confirm;
