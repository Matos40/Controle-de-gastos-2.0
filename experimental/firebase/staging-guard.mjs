// Authentication-only physical-device laboratory. No financial transport.
export const project='raytech-cg-homologacao';
export const stagingOrigin='https://raytech-cg-homologacao.firebaseapp.com';
export const stagingPath='/staging.html';
export function loginAllowed({allowed=false,busy=false,signed=false,consent=false,key='' }={}){return allowed===true&&!busy&&!signed&&consent===true&&typeof key==='string'&&!!key.trim();}
export function guardLocation(location){
 if(location?.origin!==stagingOrigin||location.pathname!==stagingPath||location.search||location.hash)throw Error('STAGING_LOCATION_REJECTED');
}
export function createSessionGuard(){
 let uid=null,epoch=0;
 return Object.freeze({change(next){uid=next||null;epoch++;},capture(){if(!uid)throw Error('AUTH_REQUIRED');return {uid,epoch};},active(ticket){return !!uid&&ticket?.uid===uid&&ticket.epoch===epoch;}});
}
export function blockedTransport(){return Promise.resolve({status:'unknown',code:'TRUSTED_BACKEND_UNAVAILABLE'});}
