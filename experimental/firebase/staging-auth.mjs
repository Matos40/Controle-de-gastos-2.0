// Explicit authorization only. No live initialization on import or financial transport.
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,setPersistence,inMemoryPersistence} from 'firebase/auth';
import {stagingOrigin,project} from './staging-guard.mjs';
const liveSDK={initializeApp,deleteApp,getAuth,GoogleAuthProvider,signInWithPopup,signOut,setPersistence,inMemoryPersistence};
export function validateStagingConfig(config,origin){
 if(config?.projectId!==project||config.authDomain!==project+'.firebaseapp.com'||config.appId!=='1:195471491370:web:b7e5a0a5a218d16f7a9e53'||typeof config.apiKey!=='string'||!config.apiKey.trim()||origin!==stagingOrigin)throw Error('STAGING_CONFIG_REJECTED');
 return Object.freeze({projectId:config.projectId,authDomain:config.authDomain,appId:config.appId,apiKey:config.apiKey.trim()});
}
export async function createStagingAuth({config,enabled=false,origin=globalThis.location?.origin,sdk=liveSDK}={}){
 if(enabled!==true)throw Error('STAGING_DISABLED');
 const app=sdk.initializeApp(validateStagingConfig(config,origin),'raytech-v11-staging-auth');
 try{
  const auth=sdk.getAuth(app);await sdk.setPersistence(auth,sdk.inMemoryPersistence);
  const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  return Object.freeze({async signIn(){try{const r=await sdk.signInWithPopup(auth,provider);return {uid:r.user.uid};}catch(e){await sdk.signOut(auth);throw e;}},current:()=>auth.currentUser?.uid||null,logout:()=>sdk.signOut(auth),async close(){try{await sdk.signOut(auth);}finally{await sdk.deleteApp(app);}}});
 }catch(e){await sdk.deleteApp(app);throw e;}
}
