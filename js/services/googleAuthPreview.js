/* Isolated Google sign-in preparation. Disabled by default; no Firebase imports or side effects. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.RaytechGoogleAuthPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create(options){
   const config=options||{};
   const enabled=config.enabled===true;
   const sdk=config.sdk;
   const auth=config.auth;
   function status(){return Object.freeze({enabled,configured:Boolean(sdk&&auth),active:false});}
   async function signIn(){
     if(!enabled)return {status:'disabled',code:'AUTH_NOT_ACTIVATED'};
     if(!sdk||!auth||typeof sdk.signInWithPopup!=='function'||
        typeof sdk.GoogleAuthProvider!=='function')return {status:'rejected',code:'AUTH_NOT_CONFIGURED'};
     // No database writes, sync, or localStorage access in this isolated adapter.
     try {
       const provider=new sdk.GoogleAuthProvider();
       const result=await sdk.signInWithPopup(auth,provider);
       if(!result||!result.user||typeof result.user.uid!=='string'||!result.user.uid)
         return {status:'rejected',code:'INVALID_AUTH_RESULT'};
       return {status:'authenticated',uid:result.user.uid};
     }catch(_){return {status:'rejected',code:'AUTH_FAILED'};}
   }
   return Object.freeze({status,signIn});
 }
 return Object.freeze({create});
});
