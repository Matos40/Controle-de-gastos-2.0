// Experimental only. Not imported by production HTML, PWA or Firebase adapter.
import {createSyncEngine,DEVICE_KEY} from './engine.mjs';
import {canonical,validatePayload,validId} from '../productionV2/model.mjs';
import {validateV2Head,validateV2Receipt} from '../productionV2/capacity.mjs';
import {strictPrepare,decodeMainBackup,encodeMainBackup,isMainWorkspace} from '../productionV2/cleanWorkspace.mjs';
export const POLICY_KEY='experimental-sync-policy-v1',REVIEW_KEY='experimental-sync-review-v1',ARCHIVE_KEY='experimental-sync-review-archive-v1',BUDGET_KEY='experimental-sync-budget-v1';
const fail=code=>{throw Error(code);}, same=(a,b)=>canonical(a)===canonical(b);
const shape=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.split('|').sort().join('|');
const read=(s,k)=>{const x=s.getItem(k);return x===null?null:JSON.parse(x);};
function put(s,k,x){const raw=JSON.stringify(x);s.setItem(k,raw);if(s.getItem(k)!==raw)fail('EXPERIMENTAL_STORAGE');}
export const LIMITS=Object.freeze({reads:2400,writes:120,minPollMs:120000,maxBackoffMs:1800000});
export function nextDelay(failures){return Math.min(LIMITS.maxBackoffMs,LIMITS.minPollMs*2**Math.min(8,Math.max(0,failures)));}
export function canPoll({active,visible,unlocked,online,bound,busy}){return active&&visible&&unlocked&&online&&bound&&!busy;}
export async function verifyRemote(x,hash){if(x===null)return null;if(!shape(x,'head|receipt'))fail('EXPERIMENTAL_REMOTE');const h=validateV2Head(x.head),r=validateV2Receipt(x.receipt);if(h.revision!==r.revision||h.lastOperationId!==r.operationId||h.hash!==r.hash||await hash(h.payload)!==h.hash)fail('EXPERIMENTAL_REMOTE');return x;}
export async function validateCheckpoint(s,uid,hash){
 if(s===null)return null;
 if(!shape(s,'format|uid|base|pending|apply')||s.format!==1||s.uid!==uid||s.pending&&s.apply)fail('EXPERIMENTAL_CHECKPOINT');
 await verifyRemote(s.base,hash);
 if(s.pending!==null){const q=s.pending;if(!shape(q,'id|expectedRevision|parentId|payload')||!validId(q.id)||q.id===q.parentId||q.expectedRevision!==(s.base?.head.revision??0)||q.parentId!==(s.base?.head.lastOperationId??''))fail('EXPERIMENTAL_CHECKPOINT');validatePayload(q.payload);}
 if(s.apply!==null){const a=s.apply;if(!shape(a,'before|target|base')||!a.base)fail('EXPERIMENTAL_CHECKPOINT');validatePayload(a.before);validatePayload(a.target);await verifyRemote(a.base,hash);if(s.base&&a.base.head.revision<s.base.head.revision)fail('EXPERIMENTAL_CHECKPOINT');}
 return s;
}
function reserve(storage,uid,day,reads,writes){const b=read(storage,BUDGET_KEY);if(b&&(!shape(b,'uid|day|reads|writes')||b.uid!==uid||!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||![b.reads,b.writes].every(n=>Number.isSafeInteger(n)&&n>=0)||b.day>day))fail('EXPERIMENTAL_BUDGET');const n=b?.day===day?b:{uid,day,reads:0,writes:0};if(n.reads+reads>LIMITS.reads||n.writes+writes>LIMITS.writes)fail('EXPERIMENTAL_BUDGET');put(storage,BUDGET_KEY,{...n,reads:n.reads+reads,writes:n.writes+writes});}
export function createExperimentalSession({cloud,storage,local,uid,hash,id,day=()=>new Date().toISOString().slice(0,10),online=()=>true,visible=()=>true,unlocked=()=>true,lock,search='?workspace=v2-main',origin=globalThis.location?.origin??'http://localhost'}){
 if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)||!isMainWorkspace(search)||!/^[-\w]{1,128}$/.test(uid)||!lock||!hash||!id)fail('EXPERIMENTAL_ISOLATION');
 let active=false,busy=false,epoch=0,operationEpoch=-1,failures=0,next=0,plan=null;
 const current=()=>cloud.currentUid()===uid&&unlocked();
 const allowed=()=>active&&current()&&operationEpoch===epoch;
 const policy=()=>{const p=read(storage,POLICY_KEY);if(p&&(!shape(p,'uid|state')||p.uid!==uid||!['active','paused'].includes(p.state)))fail('EXPERIMENTAL_POLICY');return p;};
 const setPolicy=state=>put(storage,POLICY_KEY,{uid,state});
 const stop=()=>{active=false;epoch++;plan=null;setPolicy('paused');};
 const check=()=>{if(!current())fail('EXPERIMENTAL_SESSION');};
 const budget=(r,w=0)=>reserve(storage,uid,day(),r,w);
 const transport={currentUid:()=>cloud.currentUid(),read:async who=>{if(!allowed())fail('EXPERIMENTAL_PAUSED');budget(12);return cloud.read(who);},confirm:async(who,r)=>{if(!allowed())fail('EXPERIMENTAL_PAUSED');budget(4);return cloud.confirm(who,r);},send:async(who,q)=>{if(!allowed())fail('EXPERIMENTAL_PAUSED');budget(16,6);return cloud.send(who,q);}};
 const engine=createSyncEngine({cloud:transport,storage,local,uid,hash,id,day,online,lock,isCurrent:allowed,prepare:strictPrepare,onConflict:s=>{const old=read(storage,REVIEW_KEY);if(old&&!same(old,{kind:'conflict',...s}))fail('EXPERIMENTAL_REVIEW_EXISTS');put(storage,REVIEW_KEY,{kind:'conflict',...s});}});
 const checkpoint=()=>validateCheckpoint(read(storage,DEVICE_KEY),uid,hash);
 const serial=async fn=>{if(busy)fail('EXPERIMENTAL_BUSY');busy=true;try{return await lock('experimental_session',async()=>{check();policy();await checkpoint();operationEpoch=epoch;return fn();});}finally{busy=false;}};
 const remoteRead=async()=>{check();if(!online()||!visible())fail('EXPERIMENTAL_OFFLINE');budget(12);const remote=await verifyRemote(await cloud.read(uid),hash);check();return remote;};
 const summary=raw=>{const d=validatePayload(raw);return {months:Object.keys(d.months).length,entries:Object.values(d.months).reduce((n,m)=>n+m.expenses.length+m.cardExpenses.length+m.extraIncomes.length,0)};};
 async function inspect(){return serial(async()=>{if(await checkpoint())fail('EXPERIMENTAL_ALREADY_BOUND');const raw=local.read();validatePayload(raw);const e=epoch,remote=await remoteRead();if(e!==epoch||local.read()!==raw)fail('EXPERIMENTAL_BIND_CHANGED');plan={local:raw,remote,uid};return {uid,mode:remote?'adopt':'seed',local:summary(raw),remote:remote?{revision:remote.head.revision,...summary(remote.head.payload)}:null,backup:encodeMainBackup(validatePayload(raw))};});}
 async function authorize({mode,confirmed=false,backupSaved=false}={}){return serial(async()=>{if(!confirmed){plan=null;return {status:'cancelled'};}if(!backupSaved||!plan||mode!==(plan.remote?'adopt':'seed')||local.read()!==plan.local)fail('EXPERIMENTAL_CONSENT');const expected=plan;plan=null;setPolicy('active');active=true;try{return await engine.bind({adopt:mode==='adopt',plan:expected});}catch(e){stop();throw e;}});}
 async function resume(confirmed){return serial(async()=>{if(confirmed!==true||!await checkpoint()||read(storage,REVIEW_KEY))fail('EXPERIMENTAL_RESUME');setPolicy('active');active=true;next=0;});}
 async function tick({manual=false,now=Date.now()}={}){if(!active||!current())return {status:'paused'};if(!visible()||busy)return {status:'idle'};if(!manual&&now<next)return {status:'throttled'};return serial(async()=>{if(!active||read(storage,REVIEW_KEY))return {status:'paused'};try{const r=await engine.tick();failures=0;next=now+LIMITS.minPollMs;if(r.status==='conflict')stop();return r;}catch(e){failures++;next=now+nextDelay(failures);if(/CHECKPOINT|RECOVERY|INTEGRITY|DIVERGENCE|BUDGET|SESSION|permission-denied/i.test(String(e.code??e.message)))stop();throw e;}});}
 async function stageRestore(backup){return serial(async()=>{if(active)fail('EXPERIMENTAL_PAUSE_FIRST');const s=await checkpoint();if(!s||s.pending||s.apply||read(storage,REVIEW_KEY))fail('EXPERIMENTAL_REVIEW_PENDING');const target=JSON.stringify(decodeMainBackup(backup)),raw=local.read();validatePayload(raw);const e=epoch,remote=await remoteRead();if(e!==epoch||!remote||!same(remote,s.base)||local.read()!==raw)fail('EXPERIMENTAL_REVIEW_CHANGED');put(storage,REVIEW_KEY,{kind:'restore',base:s.base,local:raw,remote,target});return {status:'review-required',revision:remote.head.revision};});}
 function review(){check();const r=read(storage,REVIEW_KEY);return r?structuredClone(r):null;}
 async function resolve({confirmed=false,backupSaved=false,choice}={}){return serial(async()=>{if(active||!confirmed||!backupSaved)fail('EXPERIMENTAL_REVIEW_CONSENT');const r=review();if(!r)fail('EXPERIMENTAL_REVIEW_MISSING');await verifyRemote(r.base,hash);await verifyRemote(r.remote,hash);validatePayload(r.local);let target=choice==='local'?r.local:choice==='remote'?r.remote.head.payload:choice==='restore'&&r.kind==='restore'?r.target:null;if(!target)fail('EXPERIMENTAL_REVIEW_CHOICE');validatePayload(target);const archive=read(storage,ARCHIVE_KEY);if(archive&&!same(archive,r))fail('EXPERIMENTAL_ARCHIVE_OCCUPIED');put(storage,ARCHIVE_KEY,r);active=true;try{await engine.review({snapshot:r,target});storage.removeItem(REVIEW_KEY);if(storage.getItem(REVIEW_KEY)!==null)fail('EXPERIMENTAL_STORAGE');return {status:'reviewed-paused'};}finally{stop();}});}
 return {inspect,authorize,resume,pause:stop,logout:stop,tick,stageRestore,review,resolve,checkpoint,budget:()=>read(storage,BUDGET_KEY),state:()=>({active:active&&current(),persisted:policy()?.state??'unbound',busy}),exportLocal:()=>encodeMainBackup(validatePayload(local.read()))};
}
