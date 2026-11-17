// Local ownership policy. Does not migrate, erase or claim existing data.
export const OWNER_KEY='raytech_v334_original_workspace_owner';
export const ORIGINAL_KEYS=Object.freeze(['raytech_cg_v2_main_finance_v1','raytech_cg_v2_clean_finance_v1','controle_gastos_multimonth_v3','raytech_cg_v2_main_initialized_v1','raytech_cg_v2_main_quarantine_v1','controle_gastos_pin_lock','gemini_user_api_key']);
const valid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
export function resolveWorkspaceIdentity({uid,verifiedOwnerUid,storedOwnerUid,checkpointUid,hasOriginalData}){
 if(!valid(uid))throw Error('IDENTITY_REQUIRED');
 if(storedOwnerUid!==null&&!valid(storedOwnerUid))throw Error('OWNER_BINDING_INVALID');
 if(checkpointUid!==null&&!valid(checkpointUid))throw Error('CHECKPOINT_INVALID');
 if(storedOwnerUid&&checkpointUid&&storedOwnerUid!==checkpointUid)throw Error('OWNER_BINDING_CONFLICT');
 const owner=storedOwnerUid??checkpointUid??(valid(verifiedOwnerUid)?verifiedOwnerUid:null);
 if(owner===uid&&verifiedOwnerUid===uid)return Object.freeze({uid,original:true,prefix:''});
 if(owner===uid)throw Error('OWNER_VERIFICATION_REQUIRED');
 if(hasOriginalData&&!owner)throw Error('ORIGINAL_OWNER_UNRESOLVED');
 return Object.freeze({uid,original:false,prefix:'raytech_v334_uid:'+uid+':'});
}
export function scopedStorage(storage,identity,isActive){
 if(!valid(identity?.uid)||identity.prefix!==(identity.original?'':'raytech_v334_uid:'+identity.uid+':'))throw Error('INVALID_SCOPE');
 const key=k=>{if(!isActive(identity.uid))throw Error('SESSION_CHANGED');if(typeof k!=='string'||k===OWNER_KEY||k.startsWith('raytech_v334_uid:'))throw Error('RESERVED_KEY');return identity.prefix+k;};
 return Object.freeze({getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v),removeItem:k=>storage.removeItem(key(k))});
}
