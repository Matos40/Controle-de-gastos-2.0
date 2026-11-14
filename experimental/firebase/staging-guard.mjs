// Authentication-only physical-device laboratory. No financial transport.
export const project='raytech-cg-homologacao';
export function guardLocation(location){
 if(location?.origin!=='https://matos40.github.io'||location.pathname!=='/Controle-de-gastos-homologacao/experimental/firebase/staging.html'||location.search||location.hash)throw Error('STAGING_LOCATION_REJECTED');
}
export function createSessionGuard(){
 let uid=null,epoch=0;
 return Object.freeze({change(next){uid=next||null;epoch++;},capture(){if(!uid)throw Error('AUTH_REQUIRED');return {uid,epoch};},active(ticket){return !!uid&&ticket?.uid===uid&&ticket.epoch===epoch;}});
}
export function blockedTransport(){return Promise.resolve({status:'unknown',code:'TRUSTED_BACKEND_UNAVAILABLE'});}
