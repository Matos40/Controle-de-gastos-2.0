import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
const projectId='demo-raytech-cg';
export async function createClient({name,host='127.0.0.1'}={}){
 if(host!=='127.0.0.1'||typeof name!=='string'||!name.trim())throw Error('EMULATOR_ONLY');
 const app=initializeApp({projectId,apiKey:'demo-key',authDomain:projectId+'.firebaseapp.com',appId:'1:123:web:demo'},name);
 const auth=getAuth(app),functions=getFunctions(app,'us-central1');
 connectAuthEmulator(auth,'http://'+host+':9099',{disableWarnings:true});
 connectFunctionsEmulator(functions,host,5001);
 await setPersistence(auth,inMemoryPersistence);
 let generation=0,uid=null,disposed=false;
 const stop=onAuthStateChanged(auth,u=>{const next=u?.uid||null;if(next!==uid){uid=next;generation++;}});
 async function signIn(){if(disposed)throw Error('DISPOSED');const r=await signInWithPopup(auth,new GoogleAuthProvider());if(auth.currentUser?.uid!==r.user.uid)throw Error('SESSION_CHANGED');return {uid:r.user.uid};}
 async function logout(){generation++;uid=null;await signOut(auth);}
 async function call(action,data={}){
  if(disposed||!auth.currentUser)return {status:'rejected',code:'AUTH_REQUIRED'};
  const actor=auth.currentUser.uid;
  if(uid!==actor){uid=actor;generation++;}
  const ticket=generation;
  try{
   const result=await httpsCallable(functions,'raytech'+action+'V1')({schemaVersion:1,...data});
   if(disposed||generation!==ticket||auth.currentUser?.uid!==actor)return {status:'rejected',code:'SESSION_CHANGED'};
   if(result.data?.snapshot&&result.data.snapshot.uid!==actor)return {status:'rejected',code:'UID_MISMATCH'};
   return result.data;
  }catch(_){return {status:'unknown',code:'REMOTE_RESULT_UNKNOWN'};}
 }
 async function close(){disposed=true;generation++;stop();await signOut(auth);await deleteApp(app);}
 return {auth,functions,signIn,logout,call,close};
}
