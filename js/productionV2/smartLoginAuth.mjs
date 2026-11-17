// Authentication only. No finance database access or writes.
export async function openSmartLoginAuth({location=globalThis.location,load=()=>import('./smartLoginTestConfig.mjs'),sdk=()=>Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')])}={}){
 const {SMART_LOGIN_TEST_CONFIG:f}=await load();
 if(!f||f.projectId!=='raytech-cg-homologacao'||f.authDomain!=='raytech-cg-homologacao.firebaseapp.com'||!f.apiKey||!f.appId||!['https://raytech-cg-homologacao.firebaseapp.com','https://raytech-cg-homologacao.web.app'].includes(location?.origin))throw Error('SMART_LOGIN_TEST_CONFIG_REQUIRED');
 const [appSdk,authSdk]=await sdk();
 const name='raytech-smart-login-homologacao';
 const app=appSdk.getApps().find(a=>a.name===name)??appSdk.initializeApp(f,name);
 const auth=authSdk.getAuth(app);
 await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);
 return Object.freeze({onSession:(fn,error)=>authSdk.onAuthStateChanged(auth,fn,error),signIn:()=>authSdk.signInWithPopup(auth,new authSdk.GoogleAuthProvider()),signOut:()=>authSdk.signOut(auth)});
}
