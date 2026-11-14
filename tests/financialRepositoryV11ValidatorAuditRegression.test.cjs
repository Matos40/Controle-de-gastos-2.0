'use strict';
// Diagnostic regression probes only. Intentionally document observed gaps without changing validators.
const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../js/services/financialRepositoryV11Integrity.js');
const L=require('./fixtures/financialRepositoryV11ValidatorPhase2Json.cjs');
const S=require('./fixtures/financialRepositoryV11ValidatorPhase23Sealed.cjs');
const P=require('./fixtures/financialRepositoryV11ValidatorPhase24Privacy.cjs');
const base=()=>({selectedMonth:'2026-11',months:{'2026-11':{salary:3000,expenses:[],cardExpenses:[]}}});
const json=x=>JSON.stringify(x);
async function probe(name,expected,operation){
 test(name,async()=>{
  const actual=await operation();
  assert.equal(actual,expected,'Diagnostic expected behavior not met; inspect this synthetic-only regression');
 });
}
probe('AUDIT-01 REVIEW do envelope deve persistir na privacidade','REVIEW',async()=>{
 const x=await I.seal(base());x.unknownEnvelopeField='fictional';return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-02 campo conhecido title com nome pessoal sem padrao exige REVIEW','REVIEW',async()=>{
 const x=base();x.months['2026-11'].expenses.push({title:'Maria Exemplo',amount:10});return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-03 campo conhecido name com texto pessoal exige REVIEW','REVIEW',async()=>{
 const x=base();x.months['2026-11'].name='Pessoa Ficticia';return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-04 campo desconhecido aninhado exige REVIEW','REVIEW',async()=>{
 const x=base();x.months['2026-11'].metadata={syntheticField:'value'};return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-05 token ficticio em campo description deve bloquear','BLOCKED',async()=>{
 const x=base();x.months['2026-11'].description='ghp_123456789012345678901234567890123456';return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-06 identificador ficticio de credencial em campo conhecido deve bloquear','BLOCKED',async()=>{
 const x=base();x.months['2026-11'].description='AKIAIOSFODNN7EXAMPLE';return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-07 JSON truncado com texto de perfil selado nao deve inferir perfil selado','json-legacy',async()=>{
 const r=await P.inspectSyntheticPrivacy('{"note":"database","selectedMonth":');return r.profile;
});
probe('AUDIT-08 JSON duplicado deve ser bloqueado','BLOCKED',async()=>{
 const x=json(base());const duplicated=x.replace('"selectedMonth":"2026-11"','"selectedMonth":"2026-10","selectedMonth":"2026-11"');return (await P.inspectSyntheticPrivacy(duplicated)).decision;
});
probe('AUDIT-09 limite de bytes permanece BLOCKED','BLOCKED',async()=>{
 return (await P.inspectSyntheticPrivacy(' '.repeat(L.MAX_BYTES+1))).decision;
});
probe('AUDIT-10 limite de nos permanece BLOCKED','BLOCKED',async()=>{
 const x=base();x.synthetic=Array.from({length:L.MAX_NODES+1},()=>null);return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-11 limite de profundidade permanece BLOCKED','BLOCKED',async()=>{
 const x=base();let p=x;for(let i=0;i<L.MAX_DEPTH+3;i++){p.nested={};p=p.nested}return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
probe('AUDIT-12 digest adulterado permanece BLOCKED','BLOCKED',async()=>{
 const x=await I.seal(base());x.database.months['2026-11'].salary=3001;return (await P.inspectSyntheticPrivacy(json(x))).decision;
});
