'use strict';
const C=require('./shared/contracts.cjs');
const {fail}=require('./shared/errors.cjs');
const {candidates}=require('./detectReconciliationPending.cjs');
function preview(snapshot,p){
  C.request(p,['targetMonth','expectedRevision']);C.checkMonth(p.targetMonth);C.checkRevision(p.expectedRevision,snapshot.revision);
  if(C.own(snapshot.financialState.months,p.targetMonth))fail('MONTH_ALREADY_EXISTS');
  const {referenceMonth,missingMonths}=C.gap(snapshot.financialState.months,p.targetMonth);
  const data={status:'preview',baseRevision:snapshot.revision,targetMonth:p.targetMonth,referenceMonth,missingMonths,requiresReconciliation:missingMonths.length>0,proposedPending:candidates(snapshot,p.targetMonth),snapshotDigest:C.digest(snapshot)};
  return {...data,previewId:C.key('preview',{kind:'CONFIRM_MONTH_CREATION',data})};
}
module.exports=preview;
