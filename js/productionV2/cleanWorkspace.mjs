import {blank,validatePayload} from './model.mjs';
export const LEGACY_KEY='controle_gastos_multimonth_v3';
export const CLEAN_KEY='raytech_cg_v2_clean_finance_v1';
export const SYNC_PREFIX='raytech_cg_v2_clean_sync_v1:';
export const CLEAN_QUERY='workspace=v2-clean';
export function isCleanWorkspace(search=''){return new URLSearchParams(search).get('workspace')==='v2-clean';}
export const databaseKey=search=>isCleanWorkspace(search)?CLEAN_KEY:LEGACY_KEY;
export function scopeSyncStorage(storage){return {getItem:k=>storage.getItem(SYNC_PREFIX+k),setItem:(k,v)=>storage.setItem(SYNC_PREFIX+k,v)};}
export function strictPrepare(raw){try{validatePayload(raw);return {compatible:true,payload:raw};}catch{return {compatible:false};}}
export function openCleanStore(storage,month){
 const fail=code=>{throw Error(code);};
 let committed=storage.getItem(CLEAN_KEY);
 if(committed===null){
  // If a checkpoint exists, a missing local database is a recovery condition, not a fresh install.
  if(scopeSyncStorage(storage).getItem('raytech_production_v2_device')!==null)fail('CLEAN_RECOVERY_REQUIRED');
  const first=JSON.stringify(blank(month));validatePayload(first);
  if(storage.getItem(CLEAN_KEY)!==null)fail('CLEAN_STORE_CHANGED');
  storage.setItem(CLEAN_KEY,first);if(storage.getItem(CLEAN_KEY)!==first)fail('CLEAN_WRITE_FAILED');committed=first;
 }
 try{validatePayload(committed);}catch{fail('CLEAN_RECOVERY_REQUIRED');}
 const snapshot=()=>validatePayload(committed);
 function replace(expected,next){
  if(expected!==committed||storage.getItem(CLEAN_KEY)!==committed)fail('CLEAN_STORE_CHANGED');
  validatePayload(next);
  storage.setItem(CLEAN_KEY,next);
  if(storage.getItem(CLEAN_KEY)!==next)fail('CLEAN_WRITE_FAILED');
  committed=next;return true;
 }
 return {snapshot,read:()=>committed,replace,save:next=>replace(committed,next),check:next=>{validatePayload(next);return true;},readCurrent:()=>storage.getItem(CLEAN_KEY)};
}
// Hold an exclusive browser lock for the lifetime of a clean-workspace tab.
// Never silently fall back to a different bank or an unlocked writer.
export function acquireCleanLease(locks=globalThis.navigator?.locks){
 if(!locks?.request)return Promise.reject(Error('CLEAN_LOCK_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let release;const hold=new Promise(r=>{release=r;});
  Promise.resolve(locks.request('raytech-cg-v2-clean-workspace',{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock){reject(Error('CLEAN_TAB_BUSY'));return;}
   resolve(()=>release());await hold;
  })).catch(reject);
 });
}
