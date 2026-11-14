'use strict';
// Synthetic JSON boundary tests. No file I/O or real financial data.
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('./fixtures/financialRepositoryV11ValidatorPhase2Json.cjs');
const S=require('./fixtures/financialRepositoryV11ValidatorPhase23Sealed.cjs');
const P=require('./fixtures/financialRepositoryV11ValidatorPhase24Privacy.cjs');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const base=()=>({selectedMonth:'2026-11',months:{'2026-11':{salary:3000,expenses:[],cardExpenses:[]}}});
const check=(r,code,profile)=>{assert.equal(r.decision,'BLOCKED');assert.equal(r.profile,profile);assert.ok(r.checks.some(c=>c.code===code&&!c.passed),JSON.stringify(r));};
const withDepth=(n)=>JSON.stringify(base()).replace('"expenses":[]','"expenses":'+'['.repeat(n)+'null'+']'.repeat(n));
const exactBytes=(text,bytes)=>text+' '.repeat(bytes-Buffer.byteLength(text,'utf8'));
test('BOUND-01 node limit isolated below size cap in legacy and privacy',async()=>{
 const input=JSON.stringify(base()).replace('"expenses":[]','"expenses":['+Array(L.MAX_NODES+1).fill('0').join(',')+']');
 assert.ok(Buffer.byteLength(input,'utf8')<L.MAX_BYTES);
 check(L.validateSyntheticJson(input),'NODE_LIMIT','json-legacy');
 check(await P.inspectSyntheticPrivacy(input),'NODE_LIMIT','json-legacy');
});
test('BOUND-02 node limit isolated below size cap in sealed',async()=>{
 const input=JSON.stringify(await I.seal(base())).replace('"expenses":[]','"expenses":['+Array(L.MAX_NODES+1).fill('0').join(',')+']');
 assert.ok(Buffer.byteLength(input,'utf8')<L.MAX_BYTES);
 check(await S.validateSyntheticSealedJson(input),'NODE_LIMIT','json-sealed-v1');
});
test('BOUND-03 exact size boundary accepts parsing and over-limit blocks',async()=>{
 const input=exactBytes(JSON.stringify(base()),L.MAX_BYTES);
 assert.equal(Buffer.byteLength(input,'utf8'),L.MAX_BYTES);
 assert.equal(L.validateSyntheticJson(input).decision,'PASS');
 check(L.validateSyntheticJson(input+' '),'SIZE_LIMIT','json-legacy');
 assert.equal((await P.inspectSyntheticPrivacy(input)).decision,'PASS');
 check(await P.inspectSyntheticPrivacy(input+' '),'SIZE_LIMIT','json-legacy');
});
test('BOUND-04 exact size boundary for sealed',async()=>{
 const input=exactBytes(JSON.stringify(await I.seal(base())),L.MAX_BYTES);
 assert.equal((await S.validateSyntheticSealedJson(input)).decision,'PASS');
 check(await S.validateSyntheticSealedJson(input+' '),'SIZE_LIMIT','json-sealed-v1');
});
test('BOUND-05 depth exactly 32 is not rejected by depth guard',()=>{
 const input=withDepth(L.MAX_DEPTH-3);
 assert.equal(L.validateSyntheticJson(input).checks.some(c=>c.code==='DEPTH_LIMIT'),false);
});
test('BOUND-06 depth 33 is rejected in legacy and privacy',async()=>{
 const input=withDepth(L.MAX_DEPTH-2);
 check(L.validateSyntheticJson(input),'DEPTH_LIMIT','json-legacy');
 check(await P.inspectSyntheticPrivacy(input),'DEPTH_LIMIT','json-legacy');
});
test('BOUND-07 extreme depth is controlled for legacy and privacy',async()=>{
 const input=withDepth(12000);
 assert.ok(Buffer.byteLength(input,'utf8')<L.MAX_BYTES);
 check(L.validateSyntheticJson(input),'DEPTH_LIMIT','json-legacy');
 check(await P.inspectSyntheticPrivacy(input),'DEPTH_LIMIT','json-legacy');
});
test('BOUND-08 extreme depth is controlled for sealed',async()=>{
 const input=JSON.stringify(await I.seal(base())).replace('"expenses":[]','"expenses":'+'['.repeat(12000)+'null'+']'.repeat(12000));
 assert.ok(Buffer.byteLength(input,'utf8')<L.MAX_BYTES);
 check(await S.validateSyntheticSealedJson(input),'DEPTH_LIMIT','json-sealed-v1');
});
