/* Experimental unified financial snapshot + receipt archive envelope. No production imports. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports
  ?require('./financialRepositoryV11Integrity.js'):root.FinancialRepositoryV11Integrity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancialRepositoryV11UnifiedPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(I){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const validId=id=>typeof id==='string'&&id.trim()&&
  !['__proto__','constructor','prototype'].includes(id);
 async function digest(value){
  return (await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},value})).digest;
 }
 async function verify(state){
  if(!state||state.schemaVersion!==1||!Number.isSafeInteger(state.revision)||
   state.revision<0||!Array.isArray(state.active)||!Array.isArray(state.archives)||
   !state.index||typeof state.index!=='object'||Array.isArray(state.index)||
   typeof state.digest!=='string')throw Error('INVALID_UNIFIED_ENVELOPE');
  I.validate(state.database);
  const {digest:seal,...body}=state;
  if(await digest(body)!==seal)throw Error('UNIFIED_CHECKSUM_MISMATCH');
  const receipts=[...state.active];
  for(const archive of state.archives){
   if(!archive||!Array.isArray(archive.items)||archive.count!==archive.items.length||
      archive.digest!==await digest(archive.items))throw Error('INVALID_UNIFIED_ARCHIVE');
   receipts.push(...archive.items);
  }
  if(receipts.length!==state.revision)throw Error('REVISION_CHAIN_MISMATCH');
  const seen=new Set();
  for(let i=0;i<receipts.length;i++){
   const r=receipts[i];
   if(!r||!validId(r.operationId)||seen.has(r.operationId)||
      !Number.isSafeInteger(r.expectedRevision)||r.expectedRevision<0||
      r.nextRevision!==r.expectedRevision+1||
      typeof r.databaseDigest!=='string'||!/^[a-f0-9]{64}$/.test(r.databaseDigest)||
      !own(state.index,r.operationId)||I.canonical(state.index[r.operationId])!==I.canonical(r))
      throw Error('UNIFIED_RECEIPT_MISMATCH');
   seen.add(r.operationId);
  }
  if(Object.keys(state.index).length!==seen.size)throw Error('UNIFIED_INDEX_MISMATCH');
  const revisions=receipts.map(r=>r.nextRevision).sort((a,b)=>a-b);
  if(revisions.some((n,i)=>n!==i+1))throw Error('REVISION_CHAIN_MISMATCH');
  if(receipts.length){
   const last=receipts.find(r=>r.nextRevision===state.revision);
   if(last.databaseDigest!==(await I.seal(state.database)).digest)
    throw Error('SNAPSHOT_RECEIPT_MISMATCH');
  }
  return clone(state);
 }
 function create(driver){
  if(!driver||typeof driver.transact!=='function')throw Error('DRIVER_REQUIRED');
  async function read(){
   const state=await driver.transact(s=>({response:s}));
   return state===null?null:verify(state);
  }
  async function initialize(database){
   I.validate(database);
   const body={schemaVersion:1,revision:0,database:clone(database),active:[],archives:[],index:{}};
   const sealed={...body,digest:await digest(body)};
   return driver.transact(s=>s===null
    ?{write:sealed,response:{status:'initialized'}}:{response:{status:'existing'}});
  }
  async function commit(request){
   if(!request||!validId(request.operationId)||!Number.isSafeInteger(request.expectedRevision)||
      request.expectedRevision<0||request.nextRevision!==request.expectedRevision+1||
      typeof request.signature!=='string'||!request.signature)
    return {status:'rejected',code:'INVALID_COMMIT'};
   I.validate(request.database);
   const state=await read();
   if(!state)return {status:'rejected',code:'NOT_INITIALIZED'};
   const dbDigest=(await I.seal(request.database)).digest;
   if(own(state.index,request.operationId)){
    const r=state.index[request.operationId];
    return r.expectedRevision===request.expectedRevision&&r.nextRevision===request.nextRevision&&
      r.signature===request.signature&&r.databaseDigest===dbDigest
      ?{status:'committed',revision:r.nextRevision,replay:true}
      :{status:'rejected',code:'OPERATION_ID_REUSED'};
   }
   if(state.revision!==request.expectedRevision)
    return {status:'conflict',code:'REVISION_MISMATCH',revision:state.revision};
   const next=clone(state);
   const receipt={operationId:request.operationId,expectedRevision:request.expectedRevision,
    nextRevision:request.nextRevision,signature:request.signature,databaseDigest:dbDigest};
   next.revision=request.nextRevision;next.database=clone(request.database);
   next.active.push(receipt);
   Object.defineProperty(next.index,receipt.operationId,{value:receipt,enumerable:true,writable:true,configurable:true});
   delete next.digest;next.digest=await digest(next);
   const fingerprint=I.canonical(state);
   return driver.transact(latest=>{
    if(I.canonical(latest)!==fingerprint)return {response:{status:'conflict',code:'CONCURRENT_CHANGE'}};
    return {write:next,response:{status:'committed',revision:next.revision}};
   });
  }
  async function archiveActive(){
   const state=await read();
   if(!state)return {status:'rejected',code:'NOT_INITIALIZED'};
   if(!state.active.length)return {status:'noop'};
   const next=clone(state),items=clone(next.active);
   next.archives.push({items,count:items.length,digest:await digest(items)});
   next.active=[];delete next.digest;next.digest=await digest(next);
   const fingerprint=I.canonical(state);
   return driver.transact(latest=>{
    if(I.canonical(latest)!==fingerprint)return {response:{status:'conflict'}};
    return {write:next,response:{status:'archived',count:items.length}};
   });
  }
  async function exportBackup(){
   const state=await read();
   if(!state)throw Error('NOT_INITIALIZED');
   return {schemaVersion:1,envelope:state,digest:await digest(state)};
  }
  async function verifyBackup(backup){
   if(!backup||backup.schemaVersion!==1||!backup.envelope||
    backup.digest!==await digest(backup.envelope))throw Error('INVALID_UNIFIED_BACKUP');
   return verify(backup.envelope);
  }
  return Object.freeze({initialize,read,commit,archiveActive,exportBackup,verifyBackup});
 }
 return Object.freeze({create,verify});
});
