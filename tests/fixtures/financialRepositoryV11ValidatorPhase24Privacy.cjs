'use strict';
// Phase 2.4: synthetic JSON strings in memory only. No I/O, mutation, anonymization or logging.
const C=require('./financialRepositoryV11ValidatorPhase1Contracts.cjs');
const L=require('./financialRepositoryV11ValidatorPhase2Json.cjs');
const S=require('./financialRepositoryV11ValidatorPhase23Sealed.cjs');
const D=require('./financialRepositoryV11SyntheticJsonDuplicateKeys.cjs');
const known=new Set(['selectedMonth','months','salary','budgetLimit','expenses','cardExpenses','title','amount','installmentValue','installment','totalInstallments','category','id','date','description','value','type','paid','fixed','investments','income','extraIncome','cards','name','schemaVersion','algorithm','digest','database']);
const secretKey=/(?:password|passwd|senha|secret|token|api[_-]?key|private[_-]?key|authorization|credential|client[_-]?secret)/i;
const personalKey=/(?:email|e-mail|cpf|phone|telefone|celular|address|endereco|endereço|full[_-]?name|nome|documento|rg)/i;
const secretValue=/(?:ghp_[a-z0-9]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:bearer\s+)[a-z0-9._-]{8,}|(?:sk[_-](?:test[_-]|live[_-])?)[a-z0-9_-]{12,})/i;
const personalValue=/(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\(?\d{2}\)?\s?9?\d{4}[- ]?\d{4}\b)/i;
const failure=(profile,code)=>C.report({format:'json',profile,checks:[{code,severity:'BLOCKED',passed:false}]});
async function inspectSyntheticPrivacy(text){
 const profile=typeof text==='string'&&/"schemaVersion"\s*:|"digest"\s*:|"database"\s*:/.test(text)?'json-sealed-v1':'json-legacy';
 if(typeof text!=='string')return failure('json-legacy','INPUT_NOT_TEXT');
 if(Buffer.byteLength(text,'utf8')>L.MAX_BYTES)return failure(profile,'SIZE_LIMIT');
 let data;
 try{data=JSON.parse(text);}catch{return failure(profile,'JSON_PARSE_FAILED');}
 try{if(D.hasDuplicateKeys(text))return failure(profile,'DUPLICATE_JSON_KEY');}catch{return failure(profile,'JSON_PARSE_FAILED');}
 const sealed=!!data&&typeof data==='object'&&!Array.isArray(data)&&
  (Object.hasOwn(data,'schemaVersion')||Object.hasOwn(data,'digest')||Object.hasOwn(data,'database'));
 const actualProfile=sealed?'json-sealed-v1':'json-legacy';
 const prior=sealed?await S.validateSyntheticSealedJson(text):L.validateSyntheticJson(text);
 if(prior.decision==='BLOCKED')return failure(actualProfile,prior.checks.find(c=>!c.passed)?.code||'PREVALIDATION_BLOCKED');
 const stack=[{value:data,path:''}];let secret=false,personal=false,unknown=false;
 while(stack.length){
  const {value,path}=stack.pop();
  if(value&&typeof value==='object'){
   for(const [key,child] of Object.entries(value)){
    if(secretKey.test(key))secret=true;
    else if(personalKey.test(key)||key==='name')personal=true;
    else if(!Array.isArray(value)&&!known.has(key)&&!/^\d{4}-\d{2}$/.test(key))unknown=true;
    stack.push({value:child,path:key});
   }
  }else if(typeof value==='string'){
   if(secretValue.test(value))secret=true;
   else if(personalValue.test(value)||(path==='title'&&/^[A-ZÀ-Ý][a-zà-ÿ]+ [A-ZÀ-Ý][a-zà-ÿ]+$/u.test(value)))personal=true;
  }
 }
 return C.report({format:'json',profile:actualProfile,checks:[
  {code:'PRIVACY_SECRETS_ABSENT',severity:'BLOCKED',passed:!secret},
  {code:'PRIVACY_PERSONAL_INDICATORS_ABSENT',severity:'REVIEW',passed:!personal},
  {code:'PRIVACY_UNKNOWN_FIELDS_ABSENT',severity:'REVIEW',passed:!unknown},
  {code:'PRIVACY_PRIOR_VALIDATION',severity:'BLOCKED',passed:true}
 ]});
}
module.exports=Object.freeze({inspectSyntheticPrivacy});
