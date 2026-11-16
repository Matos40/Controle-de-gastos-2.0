'use strict';
// A deterministic two-device simulator. No Firebase SDK initialization or network calls.
const C=require('../diff03/shared/contracts.cjs');
const {createRepository,verify}=require('./repository.cjs');
const Google=require('../../js/services/googleAuthPreview.js');
function createSession({enabled=false,sdk,auth,store,deviceId}={}){
 if(!C.id(deviceId))throw Error('INVALID_DEVICE');
 const adapter=Google.create({enabled,sdk,auth});
 let uid=null,generation=0,online=true,cache=null;
 const queues=new Map();let flushing=false;
 const rejected=code=>({status:'rejected',code});
 function status(){if(uid&&auth?.currentUser?.uid!==uid)clear();return {enabled,uid,online,queued:uid?(queues.get(uid)||[]).length:0,revision:cache?cache.revision:null};}
 function clear(){generation++;uid=null;cache=null;}
 async function signIn(){
  if(!enabled)return {status:'disabled',code:'AUTH_NOT_ACTIVATED'};
  clear();const ticket=generation;
  const result=await adapter.signIn();
  if(ticket!==generation)return rejected('SESSION_CHANGED');
  if(result.status!=='authenticated')return result;
  if(!C.id(result.uid)||!auth||auth.currentUser?.uid!==result.uid)return rejected('INVALID_AUTH_RESULT');
  uid=result.uid;return {status:'authenticated',uid};
 }
 async function signOut(){
  clear();
  if(!enabled)return {status:'disabled'};
  if(!sdk||typeof sdk.signOut!=='function')return rejected('SIGN_OUT_NOT_CONFIGURED');
  try{await sdk.signOut(auth);return {status:'signed_out'};}catch(_){return rejected('SIGN_OUT_FAILED');}
 }
 function session(){if(!enabled||!uid||auth?.currentUser?.uid!==uid)throw Error('AUTH_REQUIRED');return {uid,generation};}
 function current(ticket){return ticket.generation===generation&&ticket.uid===uid&&auth?.currentUser?.uid===uid;}
 function setOnline(value){online=value===true;return status();}
 async function pull(){
  try{const ticket=session();if(!online)return {status:'offline',snapshot:cache?C.clone(cache):null};
   const remote=await createRepository(store,ticket.uid).read();
   if(!current(ticket))return rejected('SESSION_CHANGED');
   if(remote&&remote.uid!==ticket.uid)return rejected('UID_MISMATCH');
   cache=remote?verify(remote):null;return {status:'success',snapshot:cache?C.clone(cache):null};
  }catch(e){return rejected(e.message);}
 }
 async function enqueue(command){
  try{const ticket=session();
   if(!C.json(command)||!command||command.actorId!==ticket.uid||!C.id(command.operationId)||command.schemaVersion!==1)return rejected('INVALID_COMMAND');
   const q=queues.get(ticket.uid)||[],prior=q.find(x=>x.operationId===command.operationId);
   if(prior)return C.digest(prior)===C.digest(command)?{status:'queued',replay:true}:rejected('OPERATION_ID_REUSED');
   q.push(C.clone(command));queues.set(ticket.uid,q);
   return {status:'queued',operationId:command.operationId};
  }catch(e){return rejected(e.message);}
 }
 async function flush(){
  if(flushing)return rejected('SYNC_IN_PROGRESS');
  flushing=true;
  try{
   const ticket=session();if(!online)return {status:'offline'};
   const q=queues.get(ticket.uid)||[],results=[];
   const repo=createRepository(store,ticket.uid);
   while(q.length){
    if(!current(ticket))return rejected('SESSION_CHANGED');
    if(!online)return {status:'offline',results};
    const result=await repo.execute(q[0]);
    if(!current(ticket))return rejected('SESSION_CHANGED');
    results.push(result);
    if(result.status!=='committed')return {status:'blocked',results,remaining:q.length};
    q.shift();
   }
   const refreshed=await pull();
   if(!current(ticket))return rejected('SESSION_CHANGED');
   return {status:refreshed.status==='success'?'synced':'blocked',results,remaining:q.length};
  }catch(e){return rejected(e.message);}finally{flushing=false;}
 }
 function discardQueued(operationId,confirmation){
  try{const ticket=session();if(flushing)return rejected('SYNC_IN_PROGRESS');if(confirmation!==true)return rejected('CONFIRMATION_REQUIRED');
   const q=queues.get(ticket.uid)||[],i=q.findIndex(x=>x.operationId===operationId);
   if(i<0)return rejected('OPERATION_NOT_FOUND');q.splice(i,1);return {status:'discarded'};
  }catch(e){return rejected(e.message);}
 }
 return Object.freeze({status,signIn,signOut,setOnline,pull,enqueue,flush,discardQueued});
}
module.exports={createSession};
