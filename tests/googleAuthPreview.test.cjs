const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../js/services/googleAuthPreview.js');
test('Google auth preview permanece desativado mesmo com SDK injetado',async()=>{
 let calls=0;
 const sdk={GoogleAuthProvider:class{},signInWithPopup:async()=>{calls++;return {user:{uid:'u'}};}};
 const auth=create({sdk,auth:{}});
 assert.deepEqual(auth.status(),{enabled:false,configured:true,active:false});
 assert.deepEqual(await auth.signIn(),{status:'disabled',code:'AUTH_NOT_ACTIVATED'});
 assert.equal(calls,0);
});
test('Google auth preview nao realiza login sem SDK',async()=>{
 const auth=create({enabled:true});
 assert.deepEqual(await auth.signIn(),{status:'rejected',code:'AUTH_NOT_CONFIGURED'});
});
test('Google auth preview valida resultado e nao expoe credenciais',async()=>{
 const auth=create({enabled:true,auth:{},sdk:{GoogleAuthProvider:class{},signInWithPopup:async()=>({user:{uid:'uid-1',accessToken:'secret'}})}});
 assert.deepEqual(await auth.signIn(),{status:'authenticated',uid:'uid-1'});
});
test('Google auth preview rejeita erros do provedor sem propagar detalhes',async()=>{
 const auth=create({enabled:true,auth:{},sdk:{GoogleAuthProvider:class{},signInWithPopup:async()=>{throw Error('secret');}}});
 assert.deepEqual(await auth.signIn(),{status:'rejected',code:'AUTH_FAILED'});
});
