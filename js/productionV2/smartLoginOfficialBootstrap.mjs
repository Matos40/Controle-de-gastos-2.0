import {mountSmartLoginView} from './smartLoginView.mjs';
import {mountAdmin} from './smartAdminView.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {resolveWorkspaceIdentity,scopedStorage,OWNER_KEY,ORIGINAL_KEYS} from './smartLoginOfficialIdentity.mjs';
const root=document.getElementById('smartLogin'),panel=document.getElementById('smartAccountApp'),raw=window.localStorage;
let auth,active=null,generation=0,started=false,stopAccount=()=>{},stopRole=()=>{},stopAdmin=()=>{};
const lock=()=>{active=null;window.raytechSessionRevoked=true;window.productionCleanWorkspaceReady=false;panel.hidden=true;panel.inert=true;root.hidden=false;stopAccount();stopRole();stopAdmin();};
const view=mountSmartLoginView(root,{signIn:()=>auth.signIn(),signOut:()=>auth.signOut(),onRetry:()=>location.reload()});
const scripts=["./js/state.js","./js/services/storageService.js","./js/services/geminiService.js","./js/services/excelService.js","./js/ui/renderSummary.js","./js/ui/renderExpenses.js","./js/ui/renderCards.js","./js/ui/renderAnalytics.js","./js/ui/renderHistory.js","./js/app.js","./js/onboarding.js","./js/ui/categoryPicker.js"];
async function loadScripts(){for(const path of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
async function observe(user){
 if(started&&active&&active===user?.uid)return;
 const token=++generation;lock();
 if(started){location.reload();return;}
 if(!user){view.paint({phase:'signed-out'});return;}
 view.paint({phase:'checking-workspace'});
 try{
 const uid=user.uid;await auth.profile(uid);const role=await auth.role(uid),access=await auth.access(uid);
 if(token!==generation||auth.currentUid()!==uid)return;
 const checkpoint=raw.getItem('raytech_cg_v2_main_sync_v1:raytech_production_v2_device');
 const checkpointUid=checkpoint===null?null:JSON.parse(checkpoint).uid;
 const storedOwnerUid=raw.getItem(OWNER_KEY),hasOriginalData=ORIGINAL_KEYS.some(k=>raw.getItem(k)!==null);
 const verifiedOwnerUid=(checkpointUid===uid&&access?.enabled===true)||(role==='owner'&&access?.enabled===true&&(!checkpointUid||checkpointUid===uid))?uid:null;
 const identity=resolveWorkspaceIdentity({uid,verifiedOwnerUid,storedOwnerUid,checkpointUid,hasOriginalData});
 if(identity.original&&!storedOwnerUid){if(!checkpointUid&&!window.confirm('Vincular os bancos originais deste dispositivo à sua conta Google? Nenhum dado será copiado.'))throw Error('OWNER_CONFIRMATION_REQUIRED');if(raw.getItem(OWNER_KEY)!==null)throw Error('OWNER_BINDING_CHANGED');raw.setItem(OWNER_KEY,uid);}
 active=uid;window.raytechSessionRevoked=false;window.raytechStorage=scopedStorage(raw,identity,who=>active===who&&auth.currentUid()===who);
 started=true;await loadScripts();if(token!==generation||active!==uid)return;
 await import('./preview.mjs');await import('./cloudPanel.mjs');
 if(token!==generation||active!==uid)return;
 stopAccount=auth.watchAccount(uid,a=>{if(!a||a.blocked===true){generation++;lock();view.paint({phase:'workspace-blocked',message:'Conta bloqueada. Entre em contato com o suporte.'});}},()=>{generation++;lock();view.paint({phase:'error'});});
 if(role){stopAdmin=mountAdmin({api:auth.admin(uid),role,uid});stopRole=auth.watchRole(uid,next=>{if(next!==role){lock();location.reload();}},()=>stopAdmin());}
 const logout=document.getElementById('productionCloudLogout');logout?.addEventListener('click',event=>{event.stopImmediatePropagation();lock();void auth.signOut().catch(()=>location.reload());},{capture:true});
 window.dispatchEvent(new Event('raytech-account-start'));document.dispatchEvent(new Event('raytech-account-start'));
 if(token!==generation||active!==uid)return;
 panel.hidden=false;panel.inert=false;view.paint({phase:'ready'});
 }catch(e){lock();console.error('[V33.4]',e);view.paint({phase:'workspace-blocked',message:'Acesso protegido. Verifique a conexão, autorização e vínculo da conta. Nenhum banco foi apagado.'});}
}
try{auth=await openSmartLoginAuth();auth.onSession(user=>void observe(user),()=>{lock();view.paint({phase:'error'});});}catch{view.paint({phase:'error'});}
