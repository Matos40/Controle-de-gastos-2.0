import {test,expect} from '@playwright/test';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
const projectId='demo-raytech-cg';
let n=0;
const accounts=[];
async function remote(identity){
 const app=initializeApp({projectId,apiKey:'demo-key'},'remote-'+(++n));accounts.push(app);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:identity,email:identity+'@example.test',email_verified:true})));
 const funcs=getFunctions(app,'us-central1');connectFunctionsEmulator(funcs,'127.0.0.1',5001);
 return {uid:auth.currentUser.uid,call:async(name,data={})=>(await httpsCallable(funcs,'raytech'+name+'V1')({schemaVersion:1,...data})).data};
}
test.afterAll(async()=>{await Promise.allSettled(accounts.map(deleteApp));});
// Seed the official browser Auth SDK's session via the same named app and emulator.
// No mock enqueue, mock network response or fake IndexedDB.
async function login(page,identity){
 await page.goto('/');
 await expect(page.locator('#status')).toHaveText('Desconectado');
 await page.evaluate(async identity=>{
  const {getApp}=await import('/node_modules/.vite/deps/firebase_app.js');
  const {getAuth,GoogleAuthProvider,signInWithCredential}=await import('/node_modules/.vite/deps/firebase_auth.js');
  const auth=getAuth(getApp('raytech-local-lab'));
  await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:identity,email:identity+'@example.test',email_verified:true})));
 },identity);
 await expect(page.locator('#status')).toContainText('Conectado:');
}
async function init(page){await page.locator('#init').click();await expect(page.locator('#revision')).toHaveText('0');await expect(page.locator('#queue')).toHaveText('vazia');}
async function enqueue(page,value){await page.locator('#amount').fill(String(value));await page.locator('#save').click();}
async function offline(page){await page.context().setOffline(true);await expect(page.locator('#message')).toContainText('Sem conexão');}
async function online(page){await page.context().setOffline(false);}
test('PW01 persists pending operation after real page reload',async({page})=>{
 await login(page,'pw-persist');await init(page);
 // Block only callable traffic so the document can reload while a write is unconfirmed.
 await page.route('http://127.0.0.1:5001/**',r=>r.abort());
 await enqueue(page,1234);await expect(page.locator('#queue')).toHaveText('pendente');
 await page.reload();await expect(page.locator('#queue')).toHaveText('pendente');
 await page.unroute('http://127.0.0.1:5001/**');await page.locator('#pull').click();
 await expect(page.locator('#queue')).toHaveText('vazia');await expect(page.locator('#confirmed')).toHaveText('1234');
});
test('PW02 actual browser offline and online trigger sync',async({page})=>{
 await login(page,'pw-reconnect');await init(page);await offline(page);
 await enqueue(page,2222);await expect(page.locator('#queue')).toHaveText('pendente');await expect(page.locator('#revision')).toHaveText('0');
 await online(page);await expect(page.locator('#queue')).toHaveText('vazia');await expect(page.locator('#revision')).toHaveText('1');await expect(page.locator('#confirmed')).toHaveText('2222');
});
test('PW03 logout and account switch isolate pending queue',async({page})=>{
 await login(page,'pw-owner');await init(page);await offline(page);await enqueue(page,3333);await expect(page.locator('#queue')).toHaveText('pendente');
 await page.locator('#logout').click();await expect(page.locator('#status')).toHaveText('Desconectado');await online(page);
 await login(page,'pw-other');await expect(page.locator('#queue')).toHaveText('vazia');await init(page);await expect(page.locator('#confirmed')).toHaveText('1000');
 await page.locator('#logout').click();await expect(page.locator('#status')).toHaveText('Desconectado');
 await login(page,'pw-owner');await expect(page.locator('#queue')).toHaveText('vazia');await expect(page.locator('#confirmed')).toHaveText('3333');
 const other=await remote('pw-other');expect((await other.call('Read')).snapshot.revision).toBe(0);
});
test('PW04 stale revision blocks and preserves conflict after reload',async({page})=>{
 await login(page,'pw-conflict');await init(page);await offline(page);await enqueue(page,4444);await expect(page.locator('#queue')).toHaveText('pendente');
 const r=await remote('pw-conflict');const q={schemaVersion:1,actorId:r.uid,operationId:'other-device-write',commandType:'SET_SALARY',expectedRevision:0,payload:{month:'2026-11',amountCents:555500}};
 expect((await r.call('Command',{command:q})).status).toBe('committed');
 await online(page);await expect(page.locator('#queue')).toContainText('conflito');await expect(page.locator('#confirmed')).toHaveText('5555');
 await page.reload();await expect(page.locator('#queue')).toContainText('conflito');await expect(page.locator('#save')).toBeDisabled();expect((await r.call('Read')).snapshot.revision).toBe(1);
});
test('PW05 lost acknowledgement replay via receipt never duplicates',async({page})=>{
 await login(page,'pw-replay');await init(page);
 let lost=false;
 await page.route('http://127.0.0.1:5001/**/raytechCommandV1',async route=>{if(route.request().method()!=='POST'||lost)return route.continue();const response=await route.fetch();expect(response.ok()).toBeTruthy();lost=true;await route.abort();});
 await enqueue(page,6666);await expect(page.locator('#queue')).toHaveText('pendente');await expect(page.locator('#message')).toContainText('Confirmação pendente');
 const r=await remote('pw-replay');expect((await r.call('Read')).snapshot.revision).toBe(1);
 await page.reload();await expect(page.locator('#queue')).toHaveText('vazia');await expect(page.locator('#confirmed')).toHaveText('6666');
 const s=(await r.call('Read')).snapshot;expect(s.revision).toBe(1);expect(s.receipts).toHaveLength(1);
});
