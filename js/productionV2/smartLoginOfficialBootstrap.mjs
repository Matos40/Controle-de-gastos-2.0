import {cloudEntitlement} from './smartPremiumPolicy.mjs';
import {mountSmartLoginView} from './smartLoginView.mjs';
import {mountAdmin} from './smartAdminView.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {resolveWorkspaceIdentity,scopedStorage,OWNER_KEY,ORIGINAL_KEYS,resolveOfflineIdentity,cacheOfflineGrant,revokeOfflineGrant} from './smartLoginOfficialIdentity.mjs';
const root=document.getElementById('smartLogin'),panel=document.getElementById('smartAccountApp'),raw=window.localStorage;
let auth,active=null,generation=0,started=false,stopAccount=()=>{},stopRole=()=>{},stopAdmin=()=>{};
let aiGrant=false;
Object.defineProperty(window,'raytechCanUseInvoiceAI',{value:()=>aiGrant&&!!active&&auth?.currentUid()===active&&!window.raytechSessionRevoked&&navigator.onLine!==false});
const notifyAI=()=>window.dispatchEvent(new Event('raytech-ai-entitlement-changed'));
const accountBar=document.querySelector('.v345-account'),cloudProfile=document.getElementById('productionCloudProfile');
const cloudLogout=document.getElementById('productionCloudLogout');
const paintAccountChrome=role=>{accountBar.hidden=!(['owner','admin'].includes(role)&&navigator.onLine!==false);};
const help=document.getElementById('incomeBaseHelpToggle');
help.addEventListener('click',()=>{const body=document.getElementById('incomeBaseHelp');body.hidden=!body.hidden;help.setAttribute('aria-expanded',String(!body.hidden));});
const lock=()=>{accountBar.hidden=cloudProfile.hidden=true;cloudLogout.disabled=true;document.querySelector('.v345-profile')?.removeAttribute('open');document.getElementById('v345Identity').textContent='';document.getElementById('v345Avatar').replaceChildren();aiGrant=false;active=null;notifyAI();window.raytechSessionRevoked=true;window.productionCleanWorkspaceReady=false;panel.hidden=true;panel.inert=true;root.hidden=false;stopAccount();stopRole();stopAdmin();};
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
 const uid=user.uid,offlineStartup=navigator.onLine===false;let role=null,access=null,accountPlan=null;
 if(!offlineStartup){try{accountPlan=await auth.profile(uid);role=await auth.role(uid);access=await auth.access(uid);}catch(error){try{revokeOfflineGrant(raw,uid);}catch{}throw error;}}
 if(token!==generation||auth.currentUid()!==uid)return;
 const checkpoint=raw.getItem('raytech_cg_v2_main_sync_v1:raytech_production_v2_device');
 const checkpointUid=checkpoint===null?null:JSON.parse(checkpoint).uid;
 const storedOwnerUid=raw.getItem(OWNER_KEY),hasOriginalData=ORIGINAL_KEYS.some(k=>raw.getItem(k)!==null);
 const verifiedOwnerUid=(checkpointUid===uid&&access?.enabled===true)||(role==='owner'&&access?.enabled===true&&(!checkpointUid||checkpointUid===uid))?uid:null;
 const identity=offlineStartup?resolveOfflineIdentity(raw,uid,{storedOwnerUid,checkpointUid,hasOriginalData}):resolveWorkspaceIdentity({uid,verifiedOwnerUid,storedOwnerUid,checkpointUid,hasOriginalData});
 if(identity.original&&!storedOwnerUid){if(!checkpointUid&&!window.confirm('Vincular os bancos originais deste dispositivo à sua conta Google? Nenhum dado será copiado.'))throw Error('OWNER_CONFIRMATION_REQUIRED');if(raw.getItem(OWNER_KEY)!==null)throw Error('OWNER_BINDING_CHANGED');raw.setItem(OWNER_KEY,uid);}
 if(!offlineStartup){try{cacheOfflineGrant(raw,identity);}catch{console.warn('[V33.4] local offline grant unavailable');}}
 if(offlineStartup){window.addEventListener('online',()=>{if(active===uid){generation++;lock();location.reload();}},{once:true,capture:true});if(navigator.onLine){location.reload();return;}}
 const entitlement=cloudEntitlement({plan:accountPlan,role,access,verified:!offlineStartup});window.raytechCloudEntitlement=entitlement;
 aiGrant=!offlineStartup&&(accountPlan==='premium'||['owner','admin'].includes(role));
 active=uid;window.raytechSessionRevoked=false;window.raytechStorage=scopedStorage(raw,identity,who=>active===who&&auth.currentUid()===who);
 const avatar=document.getElementById('v345Avatar'),label=(user.displayName||user.email||'Minha conta').trim()||'Minha conta';
 cloudProfile.hidden=cloudLogout.disabled=false;cloudProfile.classList.add('flex');
 document.getElementById('productionCloudGuest').hidden=true;
 document.getElementById('productionCloudName').textContent=label;
 const first=document.getElementById('productionCloudInitial');first.textContent=label.slice(0,1).toUpperCase();
 const cloudPhoto=document.getElementById('productionCloudPhoto');
 if(!offlineStartup&&user.photoURL){try{const url=new URL(user.photoURL);if(url.origin==='https://lh3.googleusercontent.com'&&!url.username&&!url.password){cloudPhoto.onload=()=>{if(active===uid){cloudPhoto.hidden=false;first.hidden=true;}};cloudPhoto.src=url.href;}}catch{}}
 const paintProfile=()=>{document.getElementById('productionCloudPlanLabel').textContent=offlineStartup?'Plano não verificado offline':accountPlan==='premium'?'Premium':'Free';document.getElementById('productionCloudPremiumGreeting').hidden=accountPlan!=='premium';document.getElementById('v345Identity').textContent=label+' · '+(offlineStartup?'Offline':role==='owner'?'Owner':role==='admin'?'Admin':accountPlan==='premium'?'Premium':'Free');};
 paintAccountChrome(offlineStartup?null:role);paintProfile();avatar.textContent=label.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
 if(!offlineStartup&&['owner','admin'].includes(role)&&user.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(url.hostname)&&!url.username&&!url.password){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.onload=()=>{if(active===uid&&auth.currentUid()===uid)avatar.replaceChildren(img);};img.src=url.href;}}catch{}}
 started=true;await loadScripts();if(token!==generation||active!==uid)return;
 await import('./preview.mjs');await import('./cloudPanel.mjs');
 if(token!==generation||active!==uid)return;
 if(!offlineStartup)stopAccount=auth.watchAccount(uid,a=>{if(!a||a.blocked===true){try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();view.paint({phase:'workspace-blocked',message:'Conta bloqueada. Entre em contato com o suporte.'});}else if(a.plan!==accountPlan){aiGrant=a.plan==='premium'||['owner','admin'].includes(role);notifyAI();window.raytechCloudEntitlement=cloudEntitlement({plan:a.plan,role,access});window.dispatchEvent(new Event('raytech-plan-changed'));accountPlan=a.plan;paintProfile();}},()=>{try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();view.paint({phase:'error'});});
 const logout=document.getElementById('productionCloudLogout');
 const signOut=async event=>{event?.stopImmediatePropagation();try{revokeOfflineGrant(raw,uid);}catch{}generation++;lock();try{await auth.signOut();location.reload();}catch{view.paint({phase:'workspace-blocked',message:'Não foi possível encerrar a sessão. Tente novamente.'});}};
 logout?.addEventListener('click',signOut,{capture:true});
 const profile=document.querySelector('.v345-profile');
 document.getElementById('v345Logout').addEventListener('click',signOut);
 window.addEventListener('offline',()=>{accountBar.hidden=true;profile.open=false;stopAdmin();});
 window.addEventListener('online',()=>{if(active===uid&&!offlineStartup&&['owner','admin'].includes(role)){generation++;lock();location.reload();}});
 document.addEventListener('click',event=>{if(!profile.contains(event.target))profile.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&profile.open){profile.open=false;profile.querySelector('summary').focus();}});
 if(!offlineStartup&&['owner','admin'].includes(role)){
   stopAdmin=mountAdmin({api:auth.admin(uid),role,uid});
   const removeAdmin=()=>{stopAdmin();role=null;paintAccountChrome(null);paintProfile();aiGrant=accountPlan==='premium';notifyAI();};
   stopRole=auth.watchRole(uid,next=>{if(next!==role){removeAdmin();try{revokeOfflineGrant(raw,uid);}catch{}lock();location.reload();}},removeAdmin);
 }
 window.dispatchEvent(new Event('raytech-account-start'));document.dispatchEvent(new Event('raytech-account-start'));
 if(token!==generation||active!==uid)return;
 panel.hidden=false;panel.inert=false;view.paint({phase:'ready'});notifyAI();
 }catch(e){lock();console.error('[V33.4]',e);view.paint({phase:'workspace-blocked',message:'Acesso protegido. Verifique a conexão, autorização e vínculo da conta. Nenhum banco foi apagado.'});}
}
try{auth=await openSmartLoginAuth();auth.onSession(user=>void observe(user),()=>{lock();view.paint({phase:'error'});});}catch{view.paint({phase:'error'});}
