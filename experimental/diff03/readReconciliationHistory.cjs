'use strict';
const C=require('./shared/contracts.cjs');
const {fail}=require('./shared/errors.cjs');
function read(snapshot,p){
  C.request(p,[],['filters']);
  const f=p.filters===undefined?{}:p.filters;
  C.fields(f,[],['targetMonth','pendingId','status']);
  if(f.targetMonth!=null)C.checkMonth(f.targetMonth);
  if(f.pendingId!=null)C.checkId(f.pendingId);
  if(f.status!=null&&!C.states.includes(f.status))fail('INVALID_PAYLOAD');
  const entries=snapshot.reconciliation.history.filter(h=>['targetMonth','pendingId','status'].every(k=>f[k]==null||h[k]===f[k])).sort((a,b)=>a.resultingRevision-b.resultingRevision||a.historyId.localeCompare(b.historyId));
  return {status:'success',revision:snapshot.revision,entries:C.clone(entries)};
}
module.exports=read;
