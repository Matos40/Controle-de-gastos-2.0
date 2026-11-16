'use strict';
// Deliberately fail closed anywhere except the local Emulator Suite.
const project='demo-raytech-cg';
// Guard inside invocation; Firebase CLI loads module during endpoint discovery.
function assertLocal(){if(process.env.FUNCTIONS_EMULATOR!=='true'||process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:8080$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')||!/^127\.0\.0\.1:9099$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||''))throw Error('EMULATOR_ONLY');}
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {onCall}=require('firebase-functions/v2/https');
const {createFirestoreStore}=require('./store.cjs');
const {createHandlers}=require('./backend.cjs');
let handlers;
for(const name of ['read','initialize','preview','command','receipt'])exports['raytech'+name[0].toUpperCase()+name.slice(1)+'V1']=onCall({region:'us-central1',timeoutSeconds:30},async request=>{assertLocal();if(!handlers){initializeApp({projectId:project});handlers=createHandlers(createFirestoreStore(getFirestore()));}return handlers[name](request);});
