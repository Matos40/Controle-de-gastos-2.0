'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('./fixtures/financialRepositoryV11ValidatorPhase2Json.cjs');
const valid=()=>({selectedMonth:'2026-11',months:{
 '2026-10':{salary:3100,expenses:[{id:'syn-a',title:'Ficticia',amount:15}],cardExpenses:[]},
 '2026-11':{salary:3200,expenses:[],cardExpenses:[{id:'syn-b',title:'Ficticia',installmentValue:20,isInstallment:true,installments:3,currentInstallment:2}],deletedInstallmentOrigins:['syn-origin'],investments:[{id:'syn-i',amount:10}]}
}});
const run=x=>V.validateSyntheticJson(x);
const expect=(x,decision,code)=>{const r=run(x);assert.equal(r.decision,decision);assert.equal(r.reviewedByHuman,false);assert.equal(r.format,'json');assert.equal(r.profile,'json-legacy');if(code)assert.equal(r.checks[0].code,code);assert.ok(!JSON.stringify(r).includes('Ficticia'));};
test('fase 2 JSON legado sintetico valido',()=>expect(JSON.stringify(valid()),'PASS'));
test('fase 2 JSON truncado bloqueado',()=>expect('{"selectedMonth":','BLOCKED','JSON_PARSE_FAILED'));
test('fase 2 JSON nao texto bloqueado',()=>expect({synthetic:true},'BLOCKED','INPUT_NOT_TEXT'));
test('fase 2 JSON limite de bytes bloqueado',()=>expect(' '.repeat(V.MAX_BYTES+1),'BLOCKED','SIZE_LIMIT'));
test('fase 2 JSON raiz array bloqueada',()=>expect('[]','BLOCKED','INVALID_ROOT'));
test('fase 2 JSON mes selecionado inexistente bloqueado',()=>{const x=valid();x.selectedMonth='2026-09';expect(JSON.stringify(x),'BLOCKED','LEGACY_SCHEMA_INVALID')});
test('fase 2 JSON parcela inconsistente bloqueada',()=>{const x=valid();x.months['2026-11'].cardExpenses[0].currentInstallment=4;expect(JSON.stringify(x),'BLOCKED','LEGACY_SCHEMA_INVALID')});
test('fase 2 JSON salario negativo bloqueado',()=>{const x=valid();x.months['2026-10'].salary=-1;expect(JSON.stringify(x),'BLOCKED','LEGACY_SCHEMA_INVALID')});
test('fase 2 JSON envelope selado fora do escopo bloqueado',()=>expect(JSON.stringify({schemaVersion:1,database:valid(),digest:'synthetic'}),'BLOCKED','SEALED_NOT_SUPPORTED_IN_PHASE2'));
test('fase 2 JSON chave perigosa bloqueada',()=>expect('{"selectedMonth":"2026-11","months":{},"__proto__":{}}','BLOCKED','DANGEROUS_KEY'));
test('fase 2 JSON profundidade excessiva bloqueada',()=>{const x=valid();let y=x;for(let i=0;i<35;i++){y.synthetic={};y=y.synthetic}expect(JSON.stringify(x),'BLOCKED','DEPTH_LIMIT')});
test('fase 2 JSON excesso de nos bloqueado',()=>{const x=valid();x.synthetic=Array.from({length:V.MAX_NODES+1},()=>null);expect(JSON.stringify(x),'BLOCKED','NODE_LIMIT')});
test('fase 2 JSON nao altera entrada e nao expõe conteudo no relatorio',()=>{const s=JSON.stringify(valid());const r=run(s);assert.equal(s,JSON.stringify(valid()));assert.ok(!JSON.stringify(r).includes('3200'));assert.ok(!JSON.stringify(r).includes('syn-a'));assert.equal(Object.isFrozen(r),true)});
