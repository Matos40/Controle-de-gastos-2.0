import test from 'node:test';import assert from 'node:assert/strict';
import {cacheOfflineGrant,revokeOfflineGrant,resolveOfflineIdentity,scopedStorage,OFFLINE_GRANT_PREFIX} from '../../js/productionV2/smartLoginOfficialIdentity.mjs';
function setup(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const owner={uid:'owner',original:true,prefix:''},client={uid:'client',original:false,prefix:'raytech_v334_uid:client:'};
const bound={storedOwnerUid:'owner',checkpointUid:'owner',hasOriginalData:true};
test('offline owner requires prior grant and matching binding',()=>{const s=setup();assert.throws(()=>resolveOfflineIdentity(s,'owner',bound));cacheOfflineGrant(s,owner);assert.deepEqual(resolveOfflineIdentity(s,'owner',bound),owner);assert.throws(()=>resolveOfflineIdentity(s,'owner',{...bound,storedOwnerUid:null}));assert.throws(()=>resolveOfflineIdentity(s,'client',bound));});
test('offline client cannot access original bank or change scope',()=>{const s=setup();cacheOfflineGrant(s,client);assert.deepEqual(resolveOfflineIdentity(s,'client',bound),client);assert.throws(()=>resolveOfflineIdentity(s,'client',{...bound,storedOwnerUid:'client',checkpointUid:'client'}));});
test('logout and block remove offline grant and scoped access to grant is denied',()=>{const s=setup();cacheOfflineGrant(s,owner);const scoped=scopedStorage(s,owner,()=>true);assert.throws(()=>scoped.getItem(OFFLINE_GRANT_PREFIX+'owner'));revokeOfflineGrant(s,'owner');assert.throws(()=>resolveOfflineIdentity(s,'owner',bound));});
