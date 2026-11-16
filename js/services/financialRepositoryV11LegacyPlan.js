/* Read-only legacy compatibility and reversible migration planning. Never writes source or destination. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports
  ?require('./financialRepositoryV11Integrity.js'):root.FinancialRepositoryV11Integrity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancialRepositoryV11LegacyPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(I){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 async function inspect(input){
  const candidate=input&&typeof input==='object'&&input.database&&input.schemaVersion===1
   ?await I.verify(input):clone(input);
  I.validate(candidate);
  const sealed=await I.seal(candidate);
  const months=Object.keys(candidate.months).sort();
  return {mode:'DRY_RUN_ONLY',sourceFormat:input&&input.schemaVersion===1&&input.database
    ?'SEALED_V1':'LEGACY_DATABASE',sourceDigest:sealed.digest,monthCount:months.length,
   months,selectedMonth:candidate.selectedMonth,verifiedDatabase:sealed.database,
   destination:'UNIFIED_PREVIEW_ISOLATED',writes:0};
 }
 async function plan(input){
  const source=await inspect(input);
  return {mode:'DRY_RUN_ONLY',activated:false,sourceDigest:source.sourceDigest,
   monthCount:source.monthCount,months:source.months,
   destination:'UNIFIED_PREVIEW_ISOLATED',writes:0,
   steps:['Preservar bytes do backup original e calcular hash',
    'Validar origem sem alterar dados',
    'Criar novo banco isolado e envelope de revisao zero',
    'Verificar snapshot copiado e digest contra origem',
    'Nunca inventar recibos de operacoes historicas',
    'Rollback: descartar apenas banco isolado e manter backup original'],
   rollback:{sourcePreserved:true,deleteOnlyIsolatedCopy:true,automaticActivation:false}};
 }
 return Object.freeze({inspect,plan});
});
