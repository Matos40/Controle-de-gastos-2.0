// Explicitly authorized configuration only. No live initialization on import.
// No Firestore client writes or Functions calls until a trusted staging backend exists.
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,setPersistence,inMemoryPersistence} from 'firebase/auth';
export function validateStagingConfig(config,origin){
 if(config?.projectId!=='raytech-cg-homologacao'||config.authDomain!=='raytech-cg-homologacao.firebaseapp.com'||config.appId!=='1:195471491370:web:b7e5a0a5a218d16f7a9e53'||typeof config.apiKey!=='string'||!config.apiKey||origin!=='https://matos40.github.io')throw Error('STAGING_CONFIG_REJECTED');
 return Object.freeze({projectId:config.projectId,authDomain:config.authDomain,appId:config.appId,apiKey:config.apiKey});
}
export async function createStagingAuth({config,enabled=false,origin=globalThis.location?.origin}={}){
 if(!enabled)throw Error('STAGING_DISABLED');
 const app=initializeApp(validateStagingConfig(config,origin),'raytech-v11-staging-auth');
 const auth=getAuth(app);await setPersistence(auth,inMemoryPersistence);
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 return Object.freeze({async signIn(){const r=await signInWithPopup(auth,provider);return {uid:r.user.uid};},current:()=>auth.currentUser?.uid||null,logout:()=>signOut(auth),async close(){await signOut(auth);await deleteApp(app);}});
}
