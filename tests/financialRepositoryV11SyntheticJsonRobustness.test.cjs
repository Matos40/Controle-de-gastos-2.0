'use strict';
// Synthetic in-memory JSON robustness probes only.
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('./fixtures/financialRepositoryV11ValidatorPhase2Json.cjs');
const S=require('./fixtures/financialRepositoryV11ValidatorPhase23Sealed.cjs');
const P=require('./fixtures/financialRepositoryV11ValidatorPhase24Privacy.cjs');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const D=require('./fixtures/financialRepositoryV11SyntheticJsonDuplicateKeys.cjs');
const base=()=>({selectedMonth:'2026-11',months:{'2026-11':{salary:3000,expenses:[],cardExpenses:[]}}});
const fail=(r,code,profile)=>{assert.equal(r.decision,'BLOCKED');assert.equal(r.profile,profile);assert.ok(r.checks.some(c=>c.code===code&&!c.passed));};
test('ROB-01 deep nested valid JSON is controlled BLOCKED for legacy',()=>{
 const input=JSON.stringify(base()).replace('"expenses":[]','"expenses":'+ '['.repeat(1500)+'null'+']'.repeat(1500));
 fail(L.validateSyntheticJson(input),'DEPTH_LIMIT','json-legacy');
});
test('ROB-02 deep nested valid JSON is controlled BLOCKED for privacy',async()=>{
 const input=JSON.stringify(base()).replace('"expenses":[]','"expenses":'+ '['.repeat(1500)+'null'+']'.repeat(1500));
 fail(await P.inspectSyntheticPrivacy(input),'DEPTH_LIMIT','json-legacy');
});
test('ROB-03 deep nested valid JSON is controlled BLOCKED for sealed',async()=>{
 const x=await I.seal(base());const input=JSON.stringify(x).replace('"expenses":[]','"expenses":'+ '['.repeat(1500)+'null'+']'.repeat(1500));
 fail(await S.validateSyntheticSealedJson(input),'DEPTH_LIMIT','json-sealed-v1');
});
test('ROB-04 maximum byte size is enforced before duplicate scanner',async()=>{
 const input=JSON.stringify(base())+' '.repeat(L.MAX_BYTES+1);
 fail(L.validateSyntheticJson(input),'SIZE_LIMIT','json-legacy');
 fail(await P.inspectSyntheticPrivacy(input),'SIZE_LIMIT','json-legacy');
});
test('ROB-05 escaped equivalent object keys are detected',()=>{
 const input=JSON.stringify(base()).replace('"salary":3000','"salary":3000,"sal\\u0061ry":3001');
 assert.equal(D.hasDuplicateKeys(input),true);
 fail(L.validateSyntheticJson(input),'DUPLICATE_JSON_KEY','json-legacy');
});
test('ROB-06 nested duplicate inside array is detected',()=>{
 const input=JSON.stringify(base()).replace('"expenses":[]','"expenses":[{"title":"Teste","amount":1,"amount":2}]');
 fail(L.validateSyntheticJson(input),'DUPLICATE_JSON_KEY','json-legacy');
});
test('ROB-07 distinct keys in nested objects are accepted',()=>{
 const x=base();x.months['2026-11'].expenses=[{title:'Teste',amount:1},{title:'Outro',amount:2}];
 assert.equal(L.validateSyntheticJson(JSON.stringify(x)).decision,'PASS');
});
test('ROB-08 escaped syntax inside string does not create phantom duplicates',()=>{
 const x=base();x.months['2026-11'].description='\\\"salary\\\": 3000';
 assert.equal(D.hasDuplicateKeys(JSON.stringify(x)),false);
});
test('ROB-09 node limit returns controlled BLOCKED',()=>{
 const x=base();x.months['2026-11'].expenses=Array.from({length:L.MAX_NODES+1},()=>({title:'a',amount:1}));
 const input=JSON.stringify(x);
 assert.ok(Buffer.byteLength(input,'utf8')>L.MAX_BYTES);
 fail(L.validateSyntheticJson(input),'SIZE_LIMIT','json-legacy');
});
