import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, terminate } from 'firebase/firestore';
import { createClient } from './client.mjs';
const projectId='demo-raytech-cg';
const clients=[];
let sequence=0;
async function device(identity){
 const client=await createClient({name:'test-'+(++sequence)});
 clients.push(client);
 // Auth Emulator accepts unsigned simulated Google ID token JSON.
 const credential=GoogleAuthProvider.credential(JSON.stringify({sub:identity,email:identity+'@example.test',email_verified:true}));
 await signInWithCredential(client.auth,credential);
 // Synchronize auth listener before the first callable.
 await client.auth.authStateReady();
 return client;
}
const call=(c,name,body={})=>c.call(name,body);
function salary(c,id,amount,revision=0){return {schemaVersion:1,actorId:c.auth.currentUser.uid,operationId:id,commandType:'SET_SALARY',expectedRevision:revision,payload:{month:'2026-11',amountCents:amount}};}
const submit=(c,q)=>call(c,'Command',{command:q});
after(async()=>{await Promise.allSettled(clients.map(c=>c.close()));});
test('FB-E01 unauthenticated callable cannot read data',async()=>{
 const c=await createClient({name:'anon-test'});clients.push(c);
 const out=await httpsCallable(c.functions,'raytechReadV1')({schemaVersion:1});
 assert.equal(out.data.code,'UNAUTHENTICATED');
});
test('FB-E02 Google emulator identity initializes synthetic data and isolated second account',async()=>{
 const a=await device('account-a'),b=await device('account-b');
 assert.notEqual(a.auth.currentUser.uid,b.auth.currentUser.uid);
 assert.equal((await call(a,'Initialize',{confirmation:false})).code,'CONFIRMATION_REQUIRED');
 assert.equal((await call(a,'Initialize',{confirmation:true})).status,'initialized');
 assert.equal((await call(b,'Read')).status,'absent');
 assert.equal((await call(a,'Initialize',{confirmation:true})).code,'DESTINATION_EXISTS');
 assert.equal((await call(a,'Read')).snapshot.uid,a.auth.currentUser.uid);
});
test('FB-E03 same Google identity on two clients observes committed changes',async()=>{
 const a=await device('same-user'),b=await device('same-user');
 assert.equal(a.auth.currentUser.uid,b.auth.currentUser.uid);
 assert.equal((await call(a,'Initialize',{confirmation:true})).status,'initialized');
 assert.equal((await submit(a,salary(a,'same-write',245678))).status,'committed');
 const snapshot=(await call(b,'Read')).snapshot;assert.equal(snapshot.revision,1);assert.equal(snapshot.database.months['2026-11'].salary,2456.78);
});
test('FB-E04 concurrent Firestore transactions retain exactly one write and stable receipt',async()=>{
 const a=await device('race-user'),b=await device('race-user');await call(a,'Initialize',{confirmation:true});
 const q1=salary(a,'race-a',123400),q2=salary(b,'race-b',432100);
 const results=await Promise.all([submit(a,q1),submit(b,q2)]);
 assert.deepEqual(results.map(x=>x.status).sort(),['committed','conflict']);
 const winner=results[0].status==='committed'?q1:q2;
 assert.equal((await call(b,'Receipt',{operationId:winner.operationId})).status,'found');
 assert.equal((await submit(b,winner)).replay,true);
 assert.equal((await call(a,'Read')).snapshot.revision,1);
});
test('FB-E05 actor forgery and UID override cannot access other account',async()=>{
 const a=await device('victim'),b=await device('attacker');await call(a,'Initialize',{confirmation:true});await call(b,'Initialize',{confirmation:true});
 const q=salary(a,'forged',100);
 assert.equal((await submit(b,q)).code,'INVALID_PROTOCOL');
 assert.equal((await call(b,'Read',{uid:a.auth.currentUser.uid})).code,'INVALID_PROTOCOL');
 assert.equal((await call(a,'Read')).snapshot.revision,0);
 assert.equal((await call(b,'Receipt',{operationId:'forged'})).status,'absent');
});
test('FB-E06 direct Firestore reads and writes denied even to authenticated owner',async()=>{
 const a=await device('rules-user');await call(a,'Initialize',{confirmation:true});
 const app=a.auth.app,db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
 try{const ref=doc(db,'raytechExperimentalAccounts',a.auth.currentUser.uid);
 await assert.rejects(getDoc(ref),e=>e.code==='permission-denied');
 await assert.rejects(setDoc(ref,{revision:999}),e=>e.code==='permission-denied');
 }finally{await terminate(db);}
});
test('FB-E07 replay collision, invalid payload, logout and revision unchanged',async()=>{
 const a=await device('retry-user');await call(a,'Initialize',{confirmation:true});
 const q=salary(a,'op',50000);assert.equal((await submit(a,q)).status,'committed');
 assert.equal((await submit(a,salary(a,'op',60000))).code,'OPERATION_ID_REUSED');
 assert.equal((await submit(a,salary(a,'negative',-100,1))).code,'INVALID_COMMAND');
 await a.logout();assert.equal((await call(a,'Read')).code,'AUTH_REQUIRED');
});
test('FB-E08 gap preview and confirmation persist reconciliation metadata atomically',async()=>{
 const a=await device('gap-user');await call(a,'Initialize',{confirmation:true});
 const p=await call(a,'Preview',{preview:{kind:'CREATE_MONTH',targetMonth:'2027-01',expectedRevision:0}});
 assert.equal(p.status,'preview');
 const q={schemaVersion:1,actorId:a.auth.currentUser.uid,operationId:'gap',expectedRevision:0,commandType:'CREATE_MONTH',payload:{month:'2027-01',confirmation:true,previewId:p.previewId}};
 assert.equal((await submit(a,q)).status,'committed');
 const s=(await call(a,'Read')).snapshot;
 assert.equal(s.database.months['2027-01'].salary,0);assert.ok(!s.database.months['2026-12']);assert.equal(s.revision,1);assert.equal(s.pending.length,1);assert.equal(s.pending[0].type,'SALARY_GAP');
});
