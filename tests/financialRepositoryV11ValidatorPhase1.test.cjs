'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./fixtures/financialRepositoryV11ValidatorPhase1Contracts.cjs');
const check=(code,severity,passed)=>({code,severity,passed});
const S=C.SEVERITIES;
const examples=Object.freeze([
 {name:'JSON-SYN-01',format:'json',profile:'json-legacy',checks:[check('SCHEMA_VALID',S.BLOCKED,true),check('IDENTIFIER_SCAN',S.BLOCKED,true)],expected:'PASS'},
 {name:'JSON-SYN-02',format:'json',profile:'json-legacy',checks:[check('SCHEMA_VALID',S.BLOCKED,true),check('CREDENTIAL_FIELD',S.BLOCKED,false)],expected:'BLOCKED'},
 {name:'JSON-SYN-03',format:'json',profile:'json-legacy',checks:[check('SCHEMA_VALID',S.BLOCKED,true),check('FREE_TEXT_REVIEW',S.REVIEW,false)],expected:'REVIEW'},
 {name:'JSON-SYN-04',format:'json',profile:'json-sealed-v1',checks:[check('DIGEST_VALID',S.BLOCKED,false)],expected:'BLOCKED'},
 {name:'XLSX-SYN-01',format:'xlsx',profile:'xlsx-export',checks:[check('WORKBOOK_STRUCTURE',S.BLOCKED,true)],expected:'PASS'},
 {name:'XLSX-SYN-02',format:'xlsx',profile:'xlsx-export',checks:[check('HIDDEN_SHEET_EMAIL',S.BLOCKED,false)],expected:'BLOCKED'},
 {name:'XLSX-SYN-03',format:'xlsx',profile:'xlsx-export',checks:[check('EXTERNAL_FORMULA',S.BLOCKED,false)],expected:'BLOCKED'}
]);
for(const example of examples){
 test('contrato sintetico '+example.name+' decide '+example.expected,()=>{
  const r=C.report(example);
  assert.equal(r.decision,example.expected);
  assert.equal(r.reviewedByHuman,false);
  assert.equal(r.policyVersion,'synthetic-v1');
  assert.equal(Object.isFrozen(r),true);
  assert.equal(Object.isFrozen(r.checks),true);
  assert.deepEqual(Object.keys(r).sort(),['checks','decision','format','policyVersion','profile','reviewedByHuman'].sort());
 });
}
test('falha bloqueante prevalece sobre revisao',()=>{
 assert.equal(C.decide([check('TEXT_REVIEW',S.REVIEW,false),check('TOKEN_FOUND',S.BLOCKED,false)]),'BLOCKED');
});
test('falha informativa nao permite aprovacao automatica',()=>{
 assert.equal(C.decide([check('UNKNOWN_WARNING',S.INFO,false)]),'REVIEW');
});
test('nao permite checks vazios ou repetidos',()=>{
 assert.throws(()=>C.decide([]),/CHECKS_REQUIRED/);
 assert.throws(()=>C.decide([check('DUPLICATE',S.BLOCKED,true),check('DUPLICATE',S.REVIEW,false)]),/DUPLICATE_CHECK_CODE/);
});
test('rejeita formato perfil e versao desconhecidos',()=>{
 const checks=[check('SCHEMA_VALID',S.BLOCKED,true)];
 assert.throws(()=>C.report({format:'csv',profile:'json-legacy',checks}),/UNSUPPORTED_FORMAT/);
 assert.throws(()=>C.report({format:'xlsx',profile:'json-legacy',checks}),/UNSUPPORTED_PROFILE/);
 assert.throws(()=>C.report({format:'json',profile:'json-legacy',checks,policyVersion:'other'}),/UNSUPPORTED_POLICY/);
});
test('rejeita checks invalidos sem copiar conteudo de entrada',()=>{
 assert.throws(()=>C.decide([{code:'free text',severity:S.BLOCKED,passed:false,detail:'synthetic'}]),/INVALID_CHECK_CODE/);
 assert.throws(()=>C.decide([check('BAD_SEVERITY','unknown',false)]),/INVALID_CHECK_SEVERITY/);
 assert.throws(()=>C.decide([check('BAD_RESULT',S.BLOCKED,'false')]),/INVALID_CHECK_RESULT/);
});
test('nao altera fixtures de entrada',()=>{
 const checks=Object.freeze([Object.freeze(check('VALID_STRUCTURE',S.BLOCKED,true))]);
 const r=C.report({format:'json',profile:'json-legacy',checks});
 assert.equal(checks[0].passed,true);
 assert.notEqual(r.checks,checks);
});
