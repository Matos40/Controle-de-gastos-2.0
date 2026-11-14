/* Experimental durable receipt archive. Not imported by production or FinancialRepository v1.1. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports
  ?require('./financialRepositoryV11Integrity.js'):root.FinancialRepositoryV11Integrity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancialRepositoryV11ArchivePreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(I){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const canonical=x=>I.canonical(x);
 const validId=x=>typeof x==='string'&&x.trim().length>0;
 function createMemoryDriver(initial){
  let state=initial==null?null:clone(initial),tail=Promise.resolve();
  function transact(fn){
   const work=tail.then(async()=>{
    const result=fn(state===null?null:clone(state));
    if(result&&typeof result.then==='function')throw Error('ASYNC_ARCHIVE_TRANSACTION');
    if(result&&result.write!==undefined)state=clone(result.write);
    return clone(result.response);
   });
   tail=work.then(()=>{},()=>{});
   return work;
  }
  return Object.freeze({transact,inspect:()=>state===null?null:clone(state)});
 }
 async function makeArchive(receipts){
  if(!Array.isArray(receipts)||receipts.some(r=>!r||!validId(r.operationId)))
   throw Error('INVALID_ARCHIVE');
  if(new Set(receipts.map(r=>r.operationId)).size!==receipts.length)throw Error('DUPLICATE_OPERATION_ID');
  const items=clone(receipts);
  const sealed=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts:items});
  return {schemaVersion:1,items,digest:sealed.digest,count:items.length};
 }
 async function verifyArchive(archive){
  if(!archive||archive.schemaVersion!==1||!Array.isArray(archive.items)||
     archive.count!==archive.items.length)throw Error('INVALID_ARCHIVE');
  const checked=await makeArchive(archive.items);
  if(checked.digest!==archive.digest)throw Error('ARCHIVE_CHECKSUM_MISMATCH');
  return clone(archive.items);
 }
 function create(driver){
  if(!driver||typeof driver.transact!=='function')throw Error('DRIVER_REQUIRED');
  async function read(){
   const snapshot=await driver.transact(state=>({response:state}));
   if(!snapshot)return null;
   if(!Array.isArray(snapshot.active)||!Array.isArray(snapshot.archives)||
      !snapshot.index||typeof snapshot.index!=='object')throw Error('INVALID_ARCHIVE_STATE');
   const ids=new Set();
   for(const receipt of snapshot.active){
    if(!validId(receipt.operationId)||ids.has(receipt.operationId))throw Error('DUPLICATE_OPERATION_ID');
    ids.add(receipt.operationId);
   }
   for(const archive of snapshot.archives){
    const receipts=await verifyArchive(archive);
    for(const receipt of receipts){
     if(ids.has(receipt.operationId))throw Error('DUPLICATE_OPERATION_ID');
     ids.add(receipt.operationId);
    }
   }
   if(Object.keys(snapshot.index).length!==ids.size||
      [...ids].some(id=>!Object.prototype.hasOwnProperty.call(snapshot.index,id)))
     throw Error('INDEX_MISMATCH');
   return snapshot;
  }
  async function initialize(){
   return driver.transact(state=>state===null
    ?{write:{active:[],archives:[],index:{}},response:{status:'initialized'}}
    :{response:{status:'existing'}});
  }
  async function append(receipt){
   if(!receipt||!validId(receipt.operationId))return {status:'rejected',code:'INVALID_RECEIPT'};
   const current=await read();
   if(!current)return {status:'rejected',code:'NOT_INITIALIZED'};
   if(Object.prototype.hasOwnProperty.call(current.index,receipt.operationId))
    return {status:'rejected',code:'OPERATION_ID_REUSED'};
   const fingerprint=canonical(current);
   return driver.transact(latest=>{
    if(canonical(latest)!==fingerprint)return {response:{status:'conflict'}};
    const next=clone(latest);
    next.active.push(clone(receipt));
    next.index[receipt.operationId]=true;
    return {write:next,response:{status:'appended'}};
   });
  }
  async function archiveActive(){
   const current=await read();
   if(!current)return {status:'rejected',code:'NOT_INITIALIZED'};
   if(!current.active.length)return {status:'noop'};
   const archive=await makeArchive(current.active),fingerprint=canonical(current);
   return driver.transact(latest=>{
    if(canonical(latest)!==fingerprint)return {response:{status:'conflict'}};
    const next=clone(latest);
    next.archives.push(archive);
    next.active=[];
    return {write:next,response:{status:'archived',count:archive.count}};
   });
  }
  async function exportBackup(){
   const state=await read();
   if(!state)throw Error('NOT_INITIALIZED');
   const sealed=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},archiveState:state});
   return {schemaVersion:1,archiveState:clone(state),digest:sealed.digest};
  }
  async function verifyBackup(backup){
   if(!backup||backup.schemaVersion!==1||!backup.archiveState)throw Error('INVALID_BACKUP');
   const sealed=await I.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},archiveState:backup.archiveState});
   if(sealed.digest!==backup.digest)throw Error('BACKUP_CHECKSUM_MISMATCH');
   const temporary=create(createMemoryDriver(backup.archiveState));
   return temporary.read();
  }
  return Object.freeze({initialize,read,append,archiveActive,exportBackup,verifyBackup});
 }
 return Object.freeze({create,createMemoryDriver,makeArchive,verifyArchive});
});
