import {stageLegacy,finishLegacy} from './preview.mjs';
import {inspectPayload,canonical} from './model.mjs';
export const PLAN_KEY='raytech_production_v2_conciliation_plan_v1';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,512}$/.test(x);
const absent=x=>x===undefined||x===null||x==='';
const norm=x=>typeof x==='string'?x.trim().toLowerCase():'';
const samePurchase=(a,b)=>norm(a.title)===norm(b.title)&&a.category===b.category&&a.installments===b.installments&&a.installmentValue===b.installmentValue&&a.totalAmount===b.totalAmount;
const ordinal=m=>Number(m.slice(0,4))*12+Number(m.slice(5))-1;
const fail=code=>{throw Error(code);};
const own=(x,k)=>Object.hasOwn(x,k);
export async function fingerprint(raw){
 if(typeof raw!=='string')fail('CONCILIATION_SOURCE');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
}
function records(db){
 return Object.keys(db.months).sort().flatMap(month=>db.months[month].cardExpenses.map((x,index)=>({token:month+':'+index,month,x})));
}
function decisionShape(d){return d&&typeof d==='object'&&!Array.isArray(d)&&Object.keys(d).length===2&&typeof d.target==='string'&&typeof d.anchor==='string';}
export function createConciliation(raw,prior=[]){
 const stage=stageLegacy(raw);if(!stage.staged)fail('CONCILIATION_SOURCE');
 const initial=inspectPayload(JSON.stringify(stage.db));
 if(initial.issues.some(i=>i.code!=='INSTALLMENT_ORIGIN'))fail('CONCILIATION_OTHER_ERRORS');
 if(!Array.isArray(prior)||prior.length>4800)fail('CONCILIATION_PLAN_INVALID');
 let db=structuredClone(stage.db),steps=[];
 function candidates(target){
  const all=records(db),t=all.find(r=>r.token===target);
  if(!t||t.x.isInstallment!==true||!absent(t.x.installmentOriginId))return [];
  const tombs=Object.entries(db.months).flatMap(([month,m])=>m.deletedInstallmentOrigins.map(v=>({month,root:v.slice(0,v.lastIndexOf(':')),n:Number(v.slice(v.lastIndexOf(':')+1))})));
  const options=[];
  for(const a of all){
   if(a.x.isInstallment!==true||!validId(a.x.id))continue;
   const separate=a.token===t.token,unassigned=absent(a.x.installmentOriginId);
   if(!separate&&!samePurchase(a.x,t.x))continue;
   if(!separate&&unassigned&&(a.x.currentInstallment>=t.x.currentInstallment||ordinal(a.month)>=ordinal(t.month)))continue;
   const root=unassigned?a.x.id:a.x.installmentOriginId;if(!validId(root))continue;
   const members=all.filter(r=>r.x.isInstallment===true&&r.x.installmentOriginId===root);
   if(separate&&members.length)continue;
   const incoming=[t,...(!separate&&unassigned?[a]:[])];
   const combined=[...members,...incoming];
   // Reject shared source IDs, unrelated root IDs and any alternate tombstone identity.
   if(combined.some(r=>all.filter(z=>z.x.id===r.x.id).length!==1))continue;
   if(all.some(r=>r.x.id===root&&!combined.some(c=>c.token===r.token)))continue;
   if(combined.some(r=>!samePurchase(r.x,t.x)))continue;
   if(new Set(combined.map(r=>r.x.currentInstallment)).size!==combined.length||new Set(combined.map(r=>r.month)).size!==combined.length)continue;
   const sorted=[...combined].sort((x,y)=>x.x.currentInstallment-y.x.currentInstallment);
   if(sorted.some((r,i)=>i&&(ordinal(r.month)<=ordinal(sorted[i-1].month)||ordinal(r.month)-ordinal(sorted[i-1].month)<r.x.currentInstallment-sorted[i-1].x.currentInstallment)))continue;
   if(combined.some(r=>r.x.id!==root&&tombs.some(v=>v.root===r.x.id)))continue;
   if(tombs.some(v=>v.root===root&&combined.some(r=>r.x.currentInstallment===v.n)))continue;
   // Distinct-series declaration permitted only for existing record ID, never a fabricated ID.
   const projected=ordinal(t.month)-t.x.currentInstallment===ordinal(a.month)-a.x.currentInstallment;
   options.push({anchor:a.token,kind:separate?'independent':unassigned?'link_pending':'link_existing',root,month:a.month,number:a.x.currentInstallment,title:a.x.title,amount:a.x.installmentValue,projected});
  }
  // One option per existing series; prefer earliest visible member.
  const seen=new Set();return options.sort((a,b)=>Number(a.kind==='independent')-Number(b.kind==='independent')||Number(b.projected)-Number(a.projected)||a.anchor.localeCompare(b.anchor)).filter(o=>{if(seen.has(o.root))return false;seen.add(o.root);return true;});
 }
 function apply(d){
  if(!decisionShape(d))fail('CONCILIATION_PLAN_INVALID');
  const o=candidates(d.target).find(x=>x.anchor===d.anchor);if(!o)fail('CONCILIATION_ASSOCIATION_BLOCKED');
  const all=records(db),t=all.find(r=>r.token===d.target),a=all.find(r=>r.token===d.anchor),next=structuredClone(db),dest=records(next);
  dest.find(r=>r.token===t.token).x.installmentOriginId=o.root;
  if(o.kind==='link_pending')dest.find(r=>r.token===a.token).x.installmentOriginId=o.root;
  const report=inspectPayload(JSON.stringify(next));
  if(report.issues.some(i=>i.code!=='INSTALLMENT_ORIGIN'))fail('CONCILIATION_ASSOCIATION_BLOCKED');
  db=next;steps.push({target:d.target,anchor:d.anchor});return status();
 }
 function status(){
  const pending=records(db).filter(r=>r.x.isInstallment===true&&absent(r.x.installmentOriginId));
  const result=finishLegacy(stage,db);
  return {remaining:pending.length,decisions:steps.length,compatible:result.compatible===true,issues:result.issues,audit:result.audit??null};
 }
 function list(){return records(db).filter(r=>r.x.isInstallment===true&&absent(r.x.installmentOriginId)).map(r=>({token:r.token,month:r.month,title:r.x.title,number:r.x.currentInstallment,total:r.x.installments,amount:r.x.installmentValue,paid:r.x.paid,options:candidates(r.token)}));}
 function undo(){if(!steps.length)return status();const replay=steps.slice(0,-1);db=structuredClone(stage.db);steps=[];for(const d of replay)apply(d);return status();}
 function reset(){db=structuredClone(stage.db);steps=[];return status();}
 function finish(){const r=finishLegacy(stage,db);if(!r.compatible||!r.audit?.equivalent)fail('CONCILIATION_INCOMPLETE');return {payload:r.payload,original:raw,audit:r.audit,decisions:structuredClone(steps)};}
 function reverse(result,payload){const actual=finish();if(!result||payload!==actual.payload||result.payload!==actual.payload||result.original!==raw||canonical(result.decisions)!==canonical(actual.decisions))fail('CONCILIATION_REVERSAL_MISMATCH');return raw;}
 for(const d of prior)apply(d);
 return {list,status,apply,undo,reset,finish,reverse,decisions:()=>structuredClone(steps)};
}
export async function loadPlan(storage,raw,hash=fingerprint){
 const v=storage.getItem(PLAN_KEY);if(v===null)return [];
 let plan;try{plan=JSON.parse(v);}catch{fail('CONCILIATION_PLAN_INVALID');}
 if(!plan||plan.version!==1||!Array.isArray(plan.decisions)||plan.decisions.length>4800||!plan.decisions.every(decisionShape))fail('CONCILIATION_PLAN_INVALID');
 if(plan.source!==await hash(raw))fail('CONCILIATION_SOURCE_CHANGED');
 const s=createConciliation(raw,plan.decisions);s.finish();return s.decisions();
}
export async function savePlan(storage,raw,session,hash=fingerprint){
 const result=session.finish(),source=await hash(raw);
 // Re-run full audit rather than trusting the UI or serialized decisions.
 const verified=createConciliation(raw,result.decisions).finish();
 if(verified.payload!==result.payload)fail('CONCILIATION_PLAN_INVALID');
 if(storage.getItem('controle_gastos_multimonth_v3')!==raw)fail('CONCILIATION_SOURCE_CHANGED');
 const value=JSON.stringify({version:1,source,decisions:result.decisions});storage.setItem(PLAN_KEY,value);
 if(storage.getItem(PLAN_KEY)!==value)fail('CONCILIATION_PLAN_WRITE');
 return {saved:true,audit:verified.audit};
}
