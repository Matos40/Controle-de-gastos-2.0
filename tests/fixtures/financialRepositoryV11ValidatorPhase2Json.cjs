'use strict';
// Phase 2.1/2.2: synthetic JSON text in memory only. No file, network, or storage APIs.
const C=require('./financialRepositoryV11ValidatorPhase1Contracts.cjs');
const I=require('../../js/services/financialRepositoryV11Integrity.js');
const D=require('./financialRepositoryV11SyntheticJsonDuplicateKeys.cjs');
const MAX_BYTES=128*1024,MAX_DEPTH=32,MAX_NODES=10000;
const fail=(code)=>C.report({format:'json',profile:'json-legacy',checks:[{code,severity:'BLOCKED',passed:false}]});
function inspectTree(root){
 let nodes=0;const stack=[{value:root,depth:0}];
 while(stack.length){
  const {value,depth}=stack.pop();
  if(++nodes>MAX_NODES)return 'NODE_LIMIT';
  if(depth>MAX_DEPTH)return 'DEPTH_LIMIT';
  if(value&&typeof value==='object'){
   if(Object.getPrototypeOf(value)!==Object.prototype&&!Array.isArray(value))return 'INVALID_OBJECT';
   for(const key of Object.keys(value)){
    if(key==='__proto__'||key==='constructor'||key==='prototype')return 'DANGEROUS_KEY';
    stack.push({value:value[key],depth:depth+1});
   }
  }
 }
 return null;
}
function validateSyntheticJson(text){
 if(typeof text!=='string')return fail('INPUT_NOT_TEXT');
 if(Buffer.byteLength(text,'utf8')>MAX_BYTES)return fail('SIZE_LIMIT');
 let data;
 try{data=JSON.parse(text);}catch{return fail('JSON_PARSE_FAILED');}
 try{if(D.hasDuplicateKeys(text))return fail('DUPLICATE_JSON_KEY');}catch(error){return fail(error.message==='DEPTH_LIMIT'?'DEPTH_LIMIT':'JSON_PARSE_FAILED');}
 const issue=inspectTree(data);
 if(issue)return fail(issue);
 if(!data||typeof data!=='object'||Array.isArray(data))return fail('INVALID_ROOT');
 if(Object.hasOwn(data,'schemaVersion')||Object.hasOwn(data,'database')||Object.hasOwn(data,'digest'))
  return fail('SEALED_NOT_SUPPORTED_IN_PHASE2');
 try{I.validate(data);}catch{return fail('LEGACY_SCHEMA_INVALID');}
 return C.report({format:'json',profile:'json-legacy',checks:[
  {code:'JSON_PARSE_VALID',severity:'BLOCKED',passed:true},
  {code:'LEGACY_SCHEMA_VALID',severity:'BLOCKED',passed:true}
 ]});
}
module.exports=Object.freeze({validateSyntheticJson,MAX_BYTES,MAX_DEPTH,MAX_NODES});
