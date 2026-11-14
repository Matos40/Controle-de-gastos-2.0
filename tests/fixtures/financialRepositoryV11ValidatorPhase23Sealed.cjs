'use strict';
// Phase 2.3, synthetic sealed-v1 JSON text only. No filesystem, network or storage.
const C=require('./financialRepositoryV11ValidatorPhase1Contracts.cjs');
const I=require('../../js/services/financialRepositoryV11Integrity.js');
const L=require('./financialRepositoryV11ValidatorPhase2Json.cjs');
const knownEnvelope=new Set(['schemaVersion','algorithm','digest','database']);
const fail=code=>C.report({format:'json',profile:'json-sealed-v1',checks:[{code,severity:'BLOCKED',passed:false}]});
function inspect(root){
 const stack=[{value:root,depth:0}];let count=0;
 while(stack.length){
  const {value,depth}=stack.pop();
  if(++count>L.MAX_NODES)return 'NODE_LIMIT';
  if(depth>L.MAX_DEPTH)return 'DEPTH_LIMIT';
  if(value&&typeof value==='object'){
   for(const key of Object.keys(value)){
    if(['__proto__','constructor','prototype'].includes(key))return 'DANGEROUS_KEY';
    stack.push({value:value[key],depth:depth+1});
   }
  }
 }
 return null;
}
async function validateSyntheticSealedJson(text){
 if(typeof text!=='string')return fail('INPUT_NOT_TEXT');
 if(Buffer.byteLength(text,'utf8')>L.MAX_BYTES)return fail('SIZE_LIMIT');
 let envelope;
 try{envelope=JSON.parse(text);}catch{return fail('JSON_PARSE_FAILED');}
 const issue=inspect(envelope);
 if(issue)return fail(issue);
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))return fail('INVALID_ENVELOPE');
 if(envelope.schemaVersion!==1||envelope.algorithm!=='SHA-256'||
    typeof envelope.digest!=='string'||!/^[0-9a-f]{64}$/.test(envelope.digest)||
    !envelope.database||typeof envelope.database!=='object'||Array.isArray(envelope.database))
  return fail('INVALID_SEAL');
 try{I.validate(envelope.database);}catch{return fail('LEGACY_SCHEMA_INVALID');}
 try{await I.verify(envelope);}catch{return fail('DIGEST_MISMATCH');}
 const unknown=Object.keys(envelope).some(k=>!knownEnvelope.has(k));
 return C.report({format:'json',profile:'json-sealed-v1',checks:[
  {code:'SEALED_V1_INTEGRITY',severity:'BLOCKED',passed:true},
  {code:'ENVELOPE_FIELDS_KNOWN',severity:'REVIEW',passed:!unknown}
 ]});
}
module.exports=Object.freeze({validateSyntheticSealedJson});
