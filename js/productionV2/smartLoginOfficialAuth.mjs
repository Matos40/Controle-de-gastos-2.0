// Authentication only. No finance database access or writes.
export async function openSmartLoginAuth({location=globalThis.location,load=()=>import('./config.mjs'),sdk=()=>Promise.all([import('../../vendor/firebase/app.mjs'),import('../../vendor/firebase/auth.mjs')])}={}){
 const {PRODUCTION_CONFIG,requireProductionConfig}=await load();
 const f=requireProductionConfig(PRODUCTION_CONFIG,location);
 const [appSdk,authSdk]=await sdk();
 const name='raytech-production-v2';
 const app=appSdk.getApps().find(a=>a.name===name)??appSdk.initializeApp(f,name);
 const auth=authSdk.getAuth(app);
 await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
 const fire=await import('../../vendor/firebase/firestore.mjs');
 const db=fire.getFirestore(app);
 const {registerFree}=await import('./smartLoginProfiles.mjs');
 const {identityFromClaims}=await import('./smartAdminIdentity.mjs');
 const profile=async uid=>{if(auth.currentUser?.uid!==uid)throw Error('ACCOUNT_SESSION_CHANGED');const token=await auth.currentUser.getIdTokenResult(true);const identity=identityFromClaims(token.claims);return registerFree({uid,now:()=>fire.serverTimestamp(),transaction:fn=>fire.runTransaction(db,async tx=>{
 const ref=who=>{if(auth.currentUser?.uid!==who)throw Error('ACCOUNT_SESSION_CHANGED');return fire.doc(db,'raytechAccountsV334',who);};
 return fn({read:async who=>{const s=await tx.get(ref(who));return s.exists()?s.data():null;},create:async(who,data)=>tx.set(ref(who),{...data,...identity}),touch:async(who,data)=>tx.update(ref(who),{...data,...identity})});
 })});};
 const guard=uid=>{if(auth.currentUser?.uid!==uid)throw Error('ACCOUNT_SESSION_CHANGED');};
 const accountRef=uid=>fire.doc(db,'raytechAccountsV334',uid);
 const roleRef=uid=>fire.doc(db,'raytechAdminRolesV334',uid);
 const {operatorRole}=await import('./smartAdminPolicy.mjs');
 const {accountEdit}=await import('./productionAccountEdit.mjs');
 const role=async uid=>{guard(uid);const s=await fire.getDocFromServer(roleRef(uid));guard(uid);return operatorRole(s.data());};
 const account=async uid=>{guard(uid);const s=await fire.getDocFromServer(accountRef(uid));guard(uid);return s.data();};
 const watchAccount=(uid,fn,error)=>{guard(uid);return fire.onSnapshot(accountRef(uid),s=>{if(auth.currentUser?.uid===uid&&!s.metadata.fromCache)fn(s.data());},error);};
 const watchRole=(uid,fn,error)=>{guard(uid);return fire.onSnapshot(roleRef(uid),s=>{if(auth.currentUser?.uid===uid&&!s.metadata.fromCache)fn(operatorRole(s.data()));},error);};
 const admin=uid=>({monitor:async()=>{guard(uid);return {unavailable:true};},role:()=>role(uid),list:async()=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');const s=await fire.getDocsFromServer(fire.query(fire.collection(db,'raytechAccountsV334'),fire.limit(100)));guard(uid);const accounts=await Promise.all(s.docs.map(async d=>{const rs=await fire.getDocFromServer(roleRef(d.id));return {...d.data(),protected:rs.exists(),role:operatorRole(rs.data()),usageUnavailable:true,readerEnabled:false};}));guard(uid);return accounts;},audit:async()=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');const s=await fire.getDocsFromServer(fire.query(fire.collection(db,'raytechAdminAuditV334'),fire.orderBy('at','desc'),fire.limit(100)));guard(uid);return s.docs.map(d=>d.data());},change:async(target,patch)=>{guard(uid);if(!await role(uid))throw Error('ADMIN_DENIED');await fire.runTransaction(db,async tx=>{guard(uid);const ref=accountRef(target),s=await tx.get(ref),operator=await tx.get(roleRef(target));
 const {fields,event}=accountEdit(uid,target,s.data(),patch,operator.exists());
 const audit=fire.doc(fire.collection(db,'raytechAdminAuditV334'));guard(uid);
 tx.update(ref,{...fields,lastAudit:audit.id});tx.set(audit,{...event,at:fire.serverTimestamp()});});}});
 const access=async uid=>{guard(uid);const s=await fire.getDocFromServer(fire.doc(db,'raytechProductionAccessV2',uid));guard(uid);return s.data();};
 return Object.freeze({admin,role,account,watchAccount,watchRole,access,currentUid:()=>auth.currentUser?.uid??null,profile,onSession:(fn,error)=>authSdk.onAuthStateChanged(auth,fn,error),signIn:()=>authSdk.signInWithPopup(auth,new authSdk.GoogleAuthProvider()),signOut:()=>authSdk.signOut(auth)});
}
