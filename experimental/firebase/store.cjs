'use strict';
const C=require('../diff03/shared/contracts.cjs');
const {verify}=require('../phase2/repository.cjs');
const MAX_BYTES=700000;
const validUid=u=>C.id(u)&&!['constructor','prototype','__proto__'].includes(u);
function createFirestoreStore(db){
 if(!db||typeof db.runTransaction!=='function')throw Error('INVALID_FIRESTORE');
 return Object.freeze({async transact(uid,fn){
  if(!validUid(uid))throw Error('INVALID_UID');
  const ref=db.collection('raytechExperimentalAccounts').doc(uid);
  return db.runTransaction(async tx=>{
   const doc=await tx.get(ref);
   const saved=doc.exists?doc.data():null;
   if(saved&& (saved.uid!==uid||typeof saved.payload!=='string'||Buffer.byteLength(saved.payload,'utf8')>MAX_BYTES))throw Error('INVALID_STORED_ENVELOPE');
   const current=saved?verify(JSON.parse(saved.payload)):null;
   if(current&&current.uid!==uid)throw Error('UID_MISMATCH');
   const result=fn(current===null?null:C.clone(current));
   if(!result||typeof result.then==='function'||!C.json(result.response))throw Error('INVALID_TRANSACTION');
   if(Object.hasOwn(result,'write')){
    if(result.write===null)throw Error('DELETE_DISABLED');
    const next=verify(result.write);
    if(next.uid!==uid)throw Error('UID_MISMATCH');
    if(Buffer.byteLength(JSON.stringify(next),'utf8')>MAX_BYTES)throw Error('CAPACITY_EXCEEDED');
    tx.set(ref,{uid, payload:JSON.stringify(next)});
   }
   return C.clone(result.response);
  });
 }});
}
module.exports={createFirestoreStore,validUid,MAX_BYTES};
