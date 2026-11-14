// Isolated synthetic queue. One unresolved operation per project/UID.
// Never touches existing application IndexedDB or localStorage.
const projects=new Set(['demo-raytech-cg','raytech-cg-homologacao']);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
async function hash(x,crypto){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x)))),b=>b.toString(16).padStart(2,'0')).join('');}
export function createQueue({project,uid,indexedDB=globalThis.indexedDB,crypto=globalThis.crypto,session,call}){
 if(!projects.has(project)||!validId(uid)||!indexedDB||!crypto||typeof session!=='function'||typeof call!=='function')throw Error('INVALID_QUEUE');
 const key=[project,uid],name='raytech-cg-v11-experimental-queue-v1';
 const active=()=>session()===uid;
 async function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('pending',{keyPath:['project','uid']});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function tx(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const t=db.transaction('pending',mode),s=t.objectStore('pending');let value; t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('ABORTED'));const r=s.get(key);r.onsuccess=()=>{try{value=fn(s,r.result);}catch(e){reject(e);t.abort();}};});}finally{db.close();}}
 const read=()=>tx('readonly',(_,row)=>row||null);
 async function enqueue(command){
  if(!active())throw Error('SESSION_CHANGED');
  const q=JSON.parse(JSON.stringify(command));
  if(q?.actorId!==uid||q.schemaVersion!==1||!validId(q.operationId)||!Number.isSafeInteger(q.expectedRevision)||q.expectedRevision<0)throw Error('INVALID_COMMAND');
  const fingerprint=await hash(q,crypto);
  if(!active())throw Error('SESSION_CHANGED');
  return tx('readwrite',(s,row)=>{if(row){if(row.fingerprint===fingerprint)return {status:'queued'};throw Error('PENDING_OPERATION');}s.add({project,uid,command:q,fingerprint,state:'pending'});return {status:'queued'};});
 }
 async function settle(row,state){return tx('readwrite',(s,current)=>{if(!current||current.fingerprint!==row.fingerprint)return false;if(state==='confirmed')s.delete(key);else s.put({...current,state});return true;});}
 let busy=false;
 async function flush(){
  if(busy)return {status:'busy'};
  if(!active())return {status:'blocked',code:'SESSION_CHANGED'};
  busy=true;
  try{
   const row=await read();if(!row)return {status:'empty'};
   if(!active())return {status:'blocked',code:'SESSION_CHANGED'};
   if(row.fingerprint!==await hash(row.command,crypto)||row.command.actorId!==uid||row.project!==project||row.uid!==uid)return {status:'blocked',code:'CORRUPT_QUEUE'};
   if(row.state!=='pending')return {status:'blocked',code:'REVIEW_REQUIRED'};
   if(!active())return {status:'blocked',code:'SESSION_CHANGED'};
   const receipt=await call('Receipt',{operationId:row.command.operationId});
   if(!active())return {status:'blocked',code:'SESSION_CHANGED'};
   if(receipt?.status==='found'){
    if(receipt.receipt?.fingerprint!==row.fingerprint||receipt.receipt?.actorId!==uid||receipt.receipt?.operationId!==row.command.operationId){await settle(row,'conflict');return {status:'conflict'};}
    await settle(row,'confirmed');return {status:'confirmed',recovered:true};
   }
   if(receipt?.status!=='absent')return {status:'unknown'};
   const result=await call('Command',{command:row.command});
   if(!active())return {status:'blocked',code:'SESSION_CHANGED'};
   if(result?.status==='committed'&&result.operationId===row.command.operationId&&result.revision===row.command.expectedRevision+1){await settle(row,'confirmed');return {status:'confirmed'};}
   if(['rejected','conflict'].includes(result?.status)){await settle(row,'conflict');return {status:'conflict'};}
   return {status:'unknown'};
  }catch(_){return {status:'unknown'};}finally{busy=false;}
 }
 return Object.freeze({enqueue,flush,async inspect(){if(!active())throw Error('SESSION_CHANGED');const row=await read();if(!active())throw Error('SESSION_CHANGED');return row?{state:row.state,operationId:row.command.operationId}:null;}});
}
