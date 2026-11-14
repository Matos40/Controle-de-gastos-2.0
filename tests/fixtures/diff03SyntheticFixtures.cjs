'use strict';
const {createLab}=require('../../experimental/diff03/shared/snapshotLab.cjs');
const {emptyMonth}=require('../../experimental/diff03/shared/invariants.cjs');
const {clone,digest}=require('../../experimental/diff03/shared/contracts.cjs');
function month(salary=0){return {...emptyMonth(),salary};}
function snapshot(months={},selectedMonth=Object.keys(months).sort().at(-1)||null){
  return {contractVersion:'1.1',revision:0,financialState:{selectedMonth,months:clone(months)},reconciliation:{pending:[],history:[]},operationReceipts:[]};
}
const fixed=(id='synthetic-fixed-01')=>({id,title:'Synthetic fixed',type:'fixed',amount:120,paid:true});
const card=(overrides={})=>({id:'synthetic-card-01',originId:'synthetic-origin-01',title:'Synthetic installment',isInstallment:true,installments:6,currentInstallment:2,installmentValue:60,paid:true,...overrides});
const F01=()=>snapshot();
const F02=()=>snapshot({'2026-11':month(1200),'2026-12':month(1300)});
const F03=()=>snapshot({'2026-11':month(1200)});
const F04=()=>snapshot({'2026-08':month(1200)});
const F05=()=>snapshot({'2026-12':month(1200)});
const F06=()=>{const m=month(1200);m.expenses.push(fixed());m.extraIncomes.push({id:'synthetic-extra-01',description:'Synthetic bonus',amount:50});return snapshot({'2026-11':m});};
const F07=()=>{const s=F06();s.financialState.months['2026-11'].cardExpenses.push(card());return s;};
const F08=()=>{const s=F07();s.financialState.months['2026-11'].deletedInstallmentOrigins.push('synthetic-origin-01');return s;};
const req=x=>({contractVersion:'1.1',...x});
function mp(l,targetMonth='2027-01',expectedRevision=l.readSnapshot().revision){return l.PREVIEW_MONTH_CREATION(req({targetMonth,expectedRevision}));}
function write(l,p,operationId='synthetic-op-01',extra={}){return req({operationId,actorId:'synthetic-actor',previewId:p.previewId,expectedRevision:l.readSnapshot().revision,confirmation:true,...extra});}
function create(l,targetMonth='2027-01',op='synthetic-create-01'){const p=mp(l,targetMonth);const result=l.CONFIRM_MONTH_CREATION(write(l,p,op));if(result.status!=='committed')throw Error(JSON.stringify(result));return result;}
function setup(s=F07()){const l=createLab(s);create(l);return {l,pending:l.readSnapshot().reconciliation.pending};}
function rp(l,pendingId,action='DISMISS',reason='Synthetic justification'){return l.PREVIEW_RECONCILIATION(req({pendingId,expectedRevision:l.readSnapshot().revision,decision:{action,reason}}));}
function resolve(l,pendingId,action='DISMISS',operationId='synthetic-resolve-01'){const p=rp(l,pendingId,action);const result=l.RESOLVE_RECONCILIATION(write(l,p,operationId));if(result.status!=='committed')throw Error(JSON.stringify(result));return result;}
function F09(){const {l,pending}=setup();resolve(l,pending[0].pendingId);return l.readSnapshot();}
const F10=()=>({...F07(),revision:10});
const F11=()=>createLab(F07());
const F12=()=>{const s=F03();s.financialState.months['2026-11'].salary=-1;return s;};
function hist(l,filters){return l.READ_RECONCILIATION_HISTORY(req(filters===undefined?{}:{filters}));}
module.exports={createLab,clone,digest,month,snapshot,fixed,card,F01,F02,F03,F04,F05,F06,F07,F08,F09,F10,F11,F12,req,mp,write,create,setup,rp,resolve,hist};
