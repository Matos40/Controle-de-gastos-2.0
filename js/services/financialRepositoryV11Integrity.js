/* Isolated integrity and migration planning. No localStorage or IndexedDB writes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinancialRepositoryV11Integrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function canonical(value){
   if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
   if(typeof value==='number'){
     if(!Number.isFinite(value))throw Error('NON_FINITE_NUMBER');
     return JSON.stringify(value);
   }
   if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
   if(value&&typeof value==='object'){
     const keys=Object.keys(value).sort();
     if(keys.some(k=>value[k]===undefined))throw Error('UNDEFINED_FIELD');
     return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
   }
   throw Error('UNSUPPORTED_VALUE');
 }
 function validate(database){
   if(!database||typeof database!=='object'||Array.isArray(database)||
      typeof database.selectedMonth!=='string'||!MONTH.test(database.selectedMonth)||
      !database.months||typeof database.months!=='object'||Array.isArray(database.months)||
      !Object.prototype.hasOwnProperty.call(database.months,database.selectedMonth))
     throw Error('INVALID_DATABASE');
   const months=Object.keys(database.months);
   if(!months.length)throw Error('EMPTY_DATABASE');
   for(const ym of months){
     const m=database.months[ym];
     if(!MONTH.test(ym)||!m||typeof m!=='object'||Array.isArray(m)||
        !Array.isArray(m.expenses)||!Array.isArray(m.cardExpenses)||
        (m.extraIncomes!==undefined&&!Array.isArray(m.extraIncomes))||
        (m.deletedInstallmentOrigins!==undefined&&(!Array.isArray(m.deletedInstallmentOrigins)||
          m.deletedInstallmentOrigins.some(k=>typeof k!=='string')))||
        (m.salary!==undefined&&(!Number.isFinite(m.salary)||m.salary<0))||
        (m.budgetLimit!==undefined&&(!Number.isFinite(m.budgetLimit)||m.budgetLimit<0)))
       throw Error('INVALID_MONTH_DATA');
     for(const item of m.expenses)
       if(!item||typeof item!=='object'||typeof item.title!=='string'||
          !Number.isFinite(item.amount)||item.amount<0)throw Error('INVALID_EXPENSE');
     for(const item of m.cardExpenses)
       if(!item||typeof item!=='object'||typeof item.title!=='string'||
          !Number.isFinite(item.installmentValue)||item.installmentValue<0||
          (item.isInstallment&&(!Number.isSafeInteger(item.installments)||item.installments<2||
          !Number.isSafeInteger(item.currentInstallment)||item.currentInstallment<1||
          item.currentInstallment>item.installments)))throw Error('INVALID_CARD');
   }
   canonical(database);
   return true;
 }
 async function sha256(data){
   const bytes=new TextEncoder().encode(data);
   if(typeof crypto!=='undefined'&&crypto.subtle){
     const hash=await crypto.subtle.digest('SHA-256',bytes);
     return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
   }
   if(typeof module==='object'&&module.exports)
     return require('node:crypto').createHash('sha256').update(bytes).digest('hex');
   throw Error('HASH_UNAVAILABLE');
 }
 async function seal(database){
   validate(database);
   const snapshot=clone(database);
   return {schemaVersion:1,algorithm:'SHA-256',digest:await sha256(canonical(snapshot)),database:snapshot};
 }
 async function verify(sealed){
   if(!sealed||sealed.schemaVersion!==1||sealed.algorithm!=='SHA-256'||
      typeof sealed.digest!=='string'||!/^[0-9a-f]{64}$/.test(sealed.digest))
     throw Error('INVALID_SEAL');
   validate(sealed.database);
   if(await sha256(canonical(sealed.database))!==sealed.digest)throw Error('CHECKSUM_MISMATCH');
   return clone(sealed.database);
 }
 async function planMigration(legacy){
   const verified=await seal(legacy);
   const months=Object.keys(verified.database.months).sort();
   return {mode:'DRY_RUN_ONLY',activated:false,legacyKey:'controle_gastos_multimonth_v3',
     destination:'raytech-financial-repository-v11-isolated',
     monthCount:months.length,months,checksum:verified.digest,
     sealed:verified,
     instructions:['Exportar backup JSON completo e conferir hash antes de qualquer gravacao',
       'Criar copia isolada em IndexedDB sem modificar localStorage',
       'Comparar hash da copia com a origem e validar todas as estruturas',
       'Manter localStorage como fonte principal ate homologacao explicita',
       'Reversao: descartar somente a copia isolada; nao apagar a origem']};
 }
 return Object.freeze({canonical,validate,seal,verify,planMigration});
});
