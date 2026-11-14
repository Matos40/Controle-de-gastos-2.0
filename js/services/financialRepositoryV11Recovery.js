/* Read-only recovery inspection. No automatic rollback or database replacement. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports
  ?require('./financialRepositoryV11Integrity.js'):root.FinancialRepositoryV11Integrity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancialRepositoryV11Recovery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Integrity){
 'use strict';
 async function inspect(primary,backup){
   let primaryValid=false,backupValid=false,primaryError=null,backupError=null;
   let original=null,recovery=null;
   try {original=await Integrity.verify(primary);primaryValid=true;}
   catch(e){primaryError=e.message;}
   try {recovery=await Integrity.verify(backup);backupValid=true;}
   catch(e){backupError=e.message;}
   return {status:primaryValid?'PRIMARY_VALID':backupValid?'RECOVERY_AVAILABLE':'NO_VERIFIED_COPY',
     primaryValid,backupValid,primaryError,backupError,
     requiresUserApproval:!primaryValid&&backupValid,
     candidate:!primaryValid&&backupValid?recovery:null,
     automaticWrites:0};
 }
 return Object.freeze({inspect});
});
