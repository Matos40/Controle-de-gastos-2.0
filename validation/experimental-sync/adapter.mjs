import {doc,getDocFromServer,runTransaction} from 'firebase/firestore';
import {commitV2,validateV2Head,validateV2Receipt} from '../../js/productionV2/capacity.mjs';
import {canonical} from '../../js/productionV2/model.mjs';
export const hash=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),x=>x.toString(16).padStart(2,'0')).join('');
export const PROJECT='demo-raytech-sync-experimental';
export function localAdapter(db,uid){
 if(db.app.options.projectId!==PROJECT)throw Error('EMULATOR_PROJECT_REQUIRED');
 const h=doc(db,'raytechProductionFinanceV2',uid),r=op=>doc(db,'raytechProductionFinanceV2',uid,'receipts',op);
 const assertUid=x=>{if(x!==uid)throw Error('EMULATOR_UID');};
 const api={currentUid:()=>uid,sha:hash,transaction:fn=>runTransaction(db,tx=>fn({getHead:async()=>{const z=await tx.get(h);return z.exists()?z.data():null;},getReceipt:async(_,op)=>{const z=await tx.get(r(op));return z.exists()?z.data():null;},setHead:(_,v)=>tx.set(h,v),setReceipt:(_,op,v)=>tx.set(r(op),v)}),{maxAttempts:3})};
 return {currentUid:()=>uid,read:async who=>{assertUid(who);return runTransaction(db,async tx=>{const z=await tx.get(h);if(!z.exists())return null;const head=validateV2Head(z.data()),rr=await tx.get(r(head.lastOperationId));if(!rr.exists())throw Error('EMULATOR_RECEIPT');const receipt=validateV2Receipt(rr.data());if(head.hash!==receipt.hash||head.lastOperationId!==receipt.operationId||head.revision!==receipt.revision||await hash(head.payload)!==head.hash)throw Error('EMULATOR_INTEGRITY');return {head,receipt};},{maxAttempts:3});},send:async(who,q)=>{assertUid(who);return commitV2(api,uid,q);},confirm:async(who,receipt)=>{assertUid(who);const z=await getDocFromServer(r(receipt.operationId));return z.exists()&&canonical(z.data())===canonical(receipt);}};
}
