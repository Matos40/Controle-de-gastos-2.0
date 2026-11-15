import {blank,validatePayload} from './model.mjs';
export const LEGACY_KEY='controle_gastos_multimonth_v3';
export const CLEAN_KEY='raytech_cg_v2_clean_finance_v1';
export const SYNC_PREFIX='raytech_cg_v2_clean_sync_v1:';
export const CLEAN_QUERY='workspace=v2-clean';
export function isCleanWorkspace(search=''){return new URLSearchParams(search).get('workspace')==='v2-clean';}
export const MAIN_KEY='raytech_cg_v2_main_finance_v1';
export const MAIN_SYNC_PREFIX='raytech_cg_v2_main_sync_v1:';
export const MAIN_QUERY='workspace=v2-main';
export const MAIN_INITIALIZED_KEY='raytech_cg_v2_main_initialized_v1';
export const MAIN_BACKUP_FORMAT='raytech-cg-v2-main-backup-v1';
export function isMainWorkspace(search=''){return new URLSearchParams(search).get('workspace')==='v2-main';}
export function isV2Workspace(search=''){return isCleanWorkspace(search)||isMainWorkspace(search);}
export const databaseKey=search=>isMainWorkspace(search)?MAIN_KEY:isCleanWorkspace(search)?CLEAN_KEY:LEGACY_KEY;
export const syncPrefix=search=>isMainWorkspace(search)?MAIN_SYNC_PREFIX:SYNC_PREFIX;
export const canTransfer=(config,search)=>config?.enabled===true&&config?.syncEnabled===true&&isMainWorkspace(search);
export function scopeSyncStorage(storage,search='?workspace=v2-clean'){const prefix=syncPrefix(search);return {getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v)};}
export function encodeMainBackup(db){validatePayload(JSON.stringify(db));return {format:MAIN_BACKUP_FORMAT,database:db};}
export function decodeMainBackup(value){
 if(!value||Object.keys(value).length!==2||value.format!==MAIN_BACKUP_FORMAT||!Object.hasOwn(value,'database'))throw Error('Use somente um backup identificado do V2 principal. Backups de teste ou legado não são aceitos.');
 return validatePayload(JSON.stringify(value.database));
}
export function strictPrepare(raw){try{validatePayload(raw);return {compatible:true,payload:raw};}catch{return {compatible:false};}}
export function openCleanStore(storage,month,search='?workspace=v2-clean'){
 const fail=code=>{throw Error(code);};
 if(!isV2Workspace(search))fail('CLEAN_WORKSPACE_INVALID');
 const key=databaseKey(search),main=isMainWorkspace(search);
 let committed=storage.getItem(key);
 if(committed===null){
  // If a checkpoint exists, a missing local database is a recovery condition, not a fresh install.
  if(scopeSyncStorage(storage,search).getItem('raytech_production_v2_device')!==null||main&&storage.getItem(MAIN_INITIALIZED_KEY)!==null)fail('CLEAN_RECOVERY_REQUIRED');
  const first=JSON.stringify(blank(month));validatePayload(first);
  if(storage.getItem(key)!==null)fail('CLEAN_STORE_CHANGED');
  // Marker first: interrupted initialization fails closed rather than risking silent reset.
  if(main){storage.setItem(MAIN_INITIALIZED_KEY,'1');if(storage.getItem(MAIN_INITIALIZED_KEY)!=='1')fail('CLEAN_WRITE_FAILED');}
  storage.setItem(key,first);if(storage.getItem(key)!==first)fail('CLEAN_WRITE_FAILED');committed=first;
 }
 try{validatePayload(committed);if(main&&storage.getItem(MAIN_INITIALIZED_KEY)!=='1')fail('CLEAN_RECOVERY_REQUIRED');}catch{fail('CLEAN_RECOVERY_REQUIRED');}
 const snapshot=()=>validatePayload(committed);
 function replace(expected,next){
  if(expected!==committed||storage.getItem(key)!==committed)fail('CLEAN_STORE_CHANGED');
  validatePayload(next);
  storage.setItem(key,next);
  if(storage.getItem(key)!==next)fail('CLEAN_WRITE_FAILED');
  committed=next;return true;
 }
 return {snapshot,read:()=>committed,replace,save:next=>replace(committed,next),check:next=>{validatePayload(next);return true;},encodeBackup:db=>main?encodeMainBackup(db):db,decodeBackup:db=>main?decodeMainBackup(db):db,readCurrent:()=>storage.getItem(key)};
}
// Hold an exclusive browser lock for the lifetime of a clean-workspace tab.
// Never silently fall back to a different bank or an unlocked writer.
export function acquireCleanLease(locks=globalThis.navigator?.locks,search='?workspace=v2-clean'){
 if(!isV2Workspace(search))return Promise.reject(Error('CLEAN_WORKSPACE_INVALID'));
 const lockName=isMainWorkspace(search)?'raytech-cg-v2-main-workspace':'raytech-cg-v2-clean-workspace';
 if(!locks?.request)return Promise.reject(Error('CLEAN_LOCK_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let release;const hold=new Promise(r=>{release=r;});
  Promise.resolve(locks.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock){reject(Error('CLEAN_TAB_BUSY'));return;}
   resolve(()=>release());await hold;
  })).catch(reject);
 });
}
