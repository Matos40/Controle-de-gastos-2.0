import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';
import {createQueue} from './durable-queue.mjs';
import {blockedTransport,project} from './staging-guard.mjs';
const command={schemaVersion:1,actorId:'a',operationId:'synthetic-op',expectedRevision:0,commandType:'SET_SALARY',payload:{month:'2026-11',amountCents:100}};
function setup(){const db=new IDBFactory();let uid='a';const calls=[];const make=(u='a',p=project,idb=db)=>createQueue({project:p,uid:u,indexedDB:idb,crypto:webcrypto,session:()=>uid,call:(...args)=>{calls.push(args[0]);return blockedTransport(...args);}});return {db,make,calls,switchTo:u=>uid=u};}
test('T17 persistência após reabertura',async()=>{const s=setup();await s.make().enqueue(command);assert.deepEqual(await s.make().inspect(),{state:'pending',operationId:command.operationId});});
test('T18 isolamento A/B',async()=>{const s=setup();await s.make().enqueue(command);s.switchTo('b');assert.equal(await s.make('b').inspect(),null);await assert.rejects(s.make().inspect(),/SESSION_CHANGED/);});
test('T19 retorno a A preserva fila',async()=>{const s=setup();await s.make().enqueue(command);s.switchTo(null);s.switchTo('a');assert.equal((await s.make().inspect()).operationId,command.operationId);});
test('T20 namespace por projeto',async()=>{const s=setup();await s.make().enqueue(command);assert.equal(await s.make('a','demo-raytech-cg').inspect(),null);});
test('T21 IndexedDB indisponível sem fallback',()=>{const s=setup();assert.throws(()=>s.make('a',project,null),/INVALID_QUEUE/);assert.deepEqual(s.calls,[]);});
test('T22 abort transacional não confirma gravação',async()=>{const s=setup();const bad={open(...args){const req=s.db.open(...args);req.addEventListener('success',()=>{const db=req.result;const transaction=db.transaction.bind(db);db.transaction=(...a)=>{const tx=transaction(...a);if(a[1]==='readwrite'){const store=tx.objectStore('pending');const add=store.add.bind(store);store.add=(...v)=>{const result=add(...v);tx.abort();return result;};tx.objectStore=()=>store;}return tx;};});return req;}};await assert.rejects(s.make('a',project,bad).enqueue(command));assert.equal(await s.make().inspect(),null);});
test('T23 transporte indisponível para toda ação',async()=>{for(const action of ['Receipt','Command','Read','Initialize'])assert.deepEqual(await blockedTransport(action),{status:'unknown',code:'TRUSTED_BACKEND_UNAVAILABLE'});});
test('T24 reconexão não envia comando e preserva fila',async()=>{const s=setup();await s.make().enqueue(command);assert.deepEqual(s.calls,[]);assert.equal((await s.make().flush()).status,'unknown');assert.deepEqual(s.calls,['Receipt']);assert.equal((await s.make().inspect()).state,'pending');});
