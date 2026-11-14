'use strict';
// Synthetic-only contract regressions: no filesystem, real backups or migration.
const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const L=require('./fixtures/financialRepositoryV11ValidatorPhase2Json.cjs');
const S=require('./fixtures/financialRepositoryV11ValidatorPhase23Sealed.cjs');
const P=require('./fixtures/financialRepositoryV11ValidatorPhase24Privacy.cjs');
const base=()=>({selectedMonth:'2026-11',months:{'2026-11':{salary:3000,expenses:[],cardExpenses:[]}}});
const json=x=>JSON.stringify(x);
const check=(result,decision,code,profile)=>{assert.equal(result.decision,decision);assert.equal(result.profile,profile);assert.equal(result.policyVersion,'synthetic-v1');assert.equal(result.reviewedByHuman,false);assert.ok(result.checks.some(c=>c.code===code&&c.passed===false))};
test('CONS-01 envelope REVIEW anterior persiste na privacidade mesmo com chave conhecida',async()=>{
 const x=await I.seal(base());x.description='fictional';const input=json(x);
 check(await S.validateSyntheticSealedJson(input),'REVIEW','ENVELOPE_FIELDS_KNOWN','json-sealed-v1');
 check(await P.inspectSyntheticPrivacy(input),'REVIEW','PRIVACY_PRIOR_VALIDATION','json-sealed-v1');
});
test('CONS-02 envelope sem campos adicionais permanece PASS',async()=>{
 const input=json(await I.seal(base()));
 assert.equal((await S.validateSyntheticSealedJson(input)).decision,'PASS');
 assert.equal((await P.inspectSyntheticPrivacy(input)).decision,'PASS');
});
test('CONS-03 chave duplicada na raiz legado bloqueada nas duas entradas',async()=>{
 const input=json(base()).replace('"selectedMonth":"2026-11"','"selectedMonth":"2026-10","selectedMonth":"2026-11"');
 check(L.validateSyntheticJson(input),'BLOCKED','DUPLICATE_JSON_KEY','json-legacy');
 check(await P.inspectSyntheticPrivacy(input),'BLOCKED','DUPLICATE_JSON_KEY','json-legacy');
});
test('CONS-04 chave duplicada aninhada legado bloqueada nas duas entradas',async()=>{
 const input=json(base()).replace('"salary":3000','"salary":3000,"salary":3001');
 check(L.validateSyntheticJson(input),'BLOCKED','DUPLICATE_JSON_KEY','json-legacy');
 check(await P.inspectSyntheticPrivacy(input),'BLOCKED','DUPLICATE_JSON_KEY','json-legacy');
});
test('CONS-05 chave duplicada no envelope selado bloqueada nas duas entradas',async()=>{
 const input=json(await I.seal(base())).replace('"algorithm":"SHA-256"','"algorithm":"SHA-256","algorithm":"SHA-256"');
 check(await S.validateSyntheticSealedJson(input),'BLOCKED','DUPLICATE_JSON_KEY','json-sealed-v1');
 check(await P.inspectSyntheticPrivacy(input),'BLOCKED','DUPLICATE_JSON_KEY','json-sealed-v1');
});
test('CONS-06 chave duplicada no database selado bloqueada nas duas entradas',async()=>{
 const input=json(await I.seal(base())).replace('"salary":3000','"salary":3000,"salary":3000');
 check(await S.validateSyntheticSealedJson(input),'BLOCKED','DUPLICATE_JSON_KEY','json-sealed-v1');
 check(await P.inspectSyntheticPrivacy(input),'BLOCKED','DUPLICATE_JSON_KEY','json-sealed-v1');
});
test('CONS-07 chaves iguais em objetos diferentes nao sao duplicatas',async()=>{
 const x=base();x.months['2026-10']={salary:1,expenses:[],cardExpenses:[]};
 assert.equal(L.validateSyntheticJson(json(x)).decision,'PASS');
 assert.equal((await P.inspectSyntheticPrivacy(json(x))).decision,'PASS');
});
test('CONS-08 chave com escape Unicode duplicada bloqueada em legado',async()=>{
 const input=json(base()).replace('"salary":3000','"salary":3000,"sal\\u0061ry":3001');
 check(L.validateSyntheticJson(input),'BLOCKED','DUPLICATE_JSON_KEY','json-legacy');
});
test('CONS-09 JSON invalido conserva codigo de parsing',async()=>{
 check(L.validateSyntheticJson('{"selectedMonth":'),'BLOCKED','JSON_PARSE_FAILED','json-legacy');
 check(await S.validateSyntheticSealedJson('{"schemaVersion":'),'BLOCKED','JSON_PARSE_FAILED','json-sealed-v1');
});
