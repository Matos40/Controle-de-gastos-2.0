import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDocFromServer,setDoc,deleteDoc,getDocs,collection,writeBatch,serverTimestamp,updateDoc,query,limit} from 'firebase/firestore';
let env;
const projectId='demo-raytech-production-v2';
const access='raytechProductionAccessV2', heads='raytechProductionFinanceV2';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const hash='a'.repeat(64);
const head=(rev,n,extra={})=>({marker:'raytech-financial-production-v2',revision:rev,lastOperationId:id(n),payload:'{"fixture":"synthetic"}',hash,...extra});
const receipt=(rev,n,parent)=>({revision:rev,operationId:id(n),parentId:parent===null?'':id(parent),hash});
const own=uid=>env.authenticatedContext(uid).firestore();
const h=(db,uid)=>doc(db,heads,uid);
const r=(db,uid,n)=>doc(db,heads,uid,'receipts',id(n));
async function allow(uid){await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),access,uid),{enabled:true}));}
async function pair(db,uid,rev,n,parent,extra={}){const batch=writeBatch(db);batch.set(h(db,uid),head(rev,n,extra));batch.set(r(db,uid,n),receipt(rev,n,parent));return batch.commit();}
before(async()=>{assert.ok(process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:'));env=await initializeTestEnvironment({projectId,firestore:{rules:readFileSync(new URL('../../docs/firestore-v334-producao-candidata.rules',import.meta.url),'utf8')}});await env.clearFirestore();});
after(async()=>{await env?.cleanup();});
test('RULE01 anonymous and unapproved users denied',async()=>{await allow('owner');const anon=env.unauthenticatedContext().firestore();await assertFails(getDocFromServer(h(anon,'owner')));await assertFails(pair(own('unapproved'),'unapproved',1,1,null));});
test('RULE02 access provision cannot be self-created or modified',async()=>{const db=own('owner');await assertSucceeds(getDocFromServer(doc(db,access,'owner')));await assertFails(setDoc(doc(db,access,'owner'),{enabled:true}));await assertFails(setDoc(doc(own('other'),access,'other'),{enabled:true}));});
test('RULE03 approved owner may seed head and receipt atomically',async()=>{await allow('seed');const db=own('seed');await assertSucceeds(pair(db,'seed',1,1,null));assert.equal((await getDocFromServer(h(db,'seed'))).data().revision,1);assert.equal((await getDocFromServer(r(db,'seed',1))).data().revision,1);});
test('RULE04 cross-account access blocked including receipts',async()=>{await allow('cross');const db=own('cross');await assertFails(getDocFromServer(h(db,'seed')));await assertFails(getDocFromServer(r(db,'seed',1)));await assertFails(pair(db,'seed',2,2,1));});
test('RULE05 unpaired head and receipt denied',async()=>{await allow('unpaired');const db=own('unpaired');await assertFails(setDoc(h(db,'unpaired'),head(1,1)));await assertFails(setDoc(r(db,'unpaired',1),receipt(1,1,null)));});
test('RULE06 revision must advance exactly one and parent match',async()=>{await allow('step');const db=own('step');await assertSucceeds(pair(db,'step',1,1,null));await assertFails(pair(db,'step',3,3,1));await assertFails(pair(db,'step',2,2,3));await assertSucceeds(pair(db,'step',2,2,1));});
test('RULE07 receipt immutable, old operation cannot be reused',async()=>{await allow('immutable');const db=own('immutable');await assertSucceeds(pair(db,'immutable',1,1,null));await assertFails(setDoc(r(db,'immutable',1),receipt(1,1,null)));await assertFails(deleteDoc(r(db,'immutable',1)));await assertFails(pair(db,'immutable',2,1,1));await assertFails(deleteDoc(h(db,'immutable')));});
test('RULE08 reject extra fields, wrong marker, oversize and wrong hash pairing',async()=>{await allow('shape');const db=own('shape');await assertFails(pair(db,'shape',1,1,null,{secret:'x'}));await assertFails(pair(db,'shape',1,1,null,{marker:'raytech-financial-test-v2'}));await assertFails(pair(db,'shape',1,1,null,{payload:'x'.repeat(180001)}));await assertFails(pair(db,'shape',1,1,null,{hash:'b'.repeat(64)}));});
test('RULE09 revoke access and deny collection queries',async()=>{await allow('revoked');const db=own('revoked');await assertSucceeds(pair(db,'revoked',1,1,null));await assertFails(getDocs(collection(db,heads)));await assertFails(getDocs(collection(db,heads,'revoked','receipts')));await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),access,'revoked'),{enabled:false}));await assertFails(getDocFromServer(h(db,'revoked')));await assertFails(pair(db,'revoked',2,2,1));});
test('RULE10 default deny unrelated and homologation namespaces',async()=>{await allow('default');const db=own('default');for(const path of ['users','raytechFinancialActiveV2','raytechFinancialTestV1']){await assertFails(getDocFromServer(doc(db,path,'default')));await assertFails(setDoc(doc(db,path,'default'),{enabled:true}));}});

const accounts='raytechAccountsV334',roles='raytechAdminRolesV334',audits='raytechAdminAuditV334';
const profile=uid=>({uid,plan:'free',blocked:false,createdAt:serverTimestamp(),lastAccess:serverTimestamp()});
test('V334 registration and self escalation denied',async()=>{const db=own('new334');await assertSucceeds(setDoc(doc(db,accounts,'new334'),profile('new334')));await assertFails(updateDoc(doc(db,accounts,'new334'),{plan:'premium'}));await assertFails(setDoc(doc(db,roles,'new334'),{role:'owner',active:true}));await assertFails(getDocFromServer(doc(db,accounts,'seed')));});
test('V334 admin cannot access finance or change protected account',async()=>{await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,roles,'admin334'),{role:'admin',active:true});await setDoc(doc(db,roles,'protected334'),{role:'owner',active:true});await setDoc(doc(db,accounts,'protected334'),{uid:'protected334',plan:'free',blocked:false});});const db=own('admin334');await assertSucceeds(getDocs(query(collection(db,accounts),limit(100))));await assertFails(getDocFromServer(h(db,'seed')));await assertFails(updateDoc(doc(db,accounts,'protected334'),{blocked:true}));});
test('V334 block and audit atomic; blocked finance denied',async()=>{await allow('new334');const target=own('new334');await assertSucceeds(pair(target,'new334',1,1,null));const db=own('admin334');await assertFails(updateDoc(doc(db,accounts,'new334'),{blocked:true}));const batch=writeBatch(db);batch.update(doc(db,accounts,'new334'),{blocked:true,lastAudit:'block334'});batch.set(doc(db,audits,'block334'),{actor:'admin334',target:'new334',beforePlan:'free',afterPlan:'free',beforeBlocked:false,afterBlocked:true,at:serverTimestamp()});await assertSucceeds(batch.commit());await assertFails(getDocFromServer(h(target,'new334')));await assertFails(pair(target,'new334',2,2,1));await assertFails(updateDoc(doc(db,audits,'block334'),{afterBlocked:false}));});
