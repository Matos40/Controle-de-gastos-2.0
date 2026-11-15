import {PRODUCTION_CONFIG} from './config.mjs';
import {databaseKey,scopeSyncStorage,canTransfer,syncPrefix} from './cleanWorkspace.mjs';
import {createProductionSyncSession,DEVICE_KEY,LIMITS,RECOVERY_KEY,REVIEW_KEY} from '../experimentalSync/session.mjs';
import {createPollRuntime} from '../experimentalSync/runtime.mjs';
import {payloadHash} from './initialTransfer.mjs';
import {withQueueLock} from './queue.mjs';
import {decodeJsonFile} from '../experimentalSync/backupFiles.mjs';
export function bindCloudPanel(doc,storage,{config=PRODUCTION_CONFIG,open=async()=>{const m=await import('./firebaseAdapter.mjs');return m.openProductionCloud();},confirm=message=>globalThis.confirm(message),win=globalThis.window}={}){
 const el=id=>doc.getElementById(id),status=el('productionCloudStatus'),connect=el('productionCloudConnect'),login=el('productionCloudLogin'),inspect=el('productionCloudInspect'),seed=el('productionCloudSeed'),logout=el('productionCloudLogout'),refresh=el('productionCloudRefresh'),adopt=el('productionCloudAdopt'),pauseBtn=el('productionCloudPause'),resumeBtn=el('productionCloudResume');
 if(!status||!connect||!login||!inspect||!seed||!logout)return;
 const search=win?.location?.search??'',dbKey=databaseKey(search),syncStorage=scopeSyncStorage(storage,search),canSync=canTransfer(config,search);
 const b2=el('productionCloudB2'),planBox=el('productionCloudPlan'),reviewBox=el('productionCloudReview'),historyBox=el('productionCloudHistory'),backupBtn=el('productionCloudBackup'),stageBtn=el('productionCloudStage'),reviewBtn=el('productionCloudResolve'),updateBtn=el('productionCloudUpdateReview'),historyBtn=el('productionCloudShowHistory'),historyExport=el('productionCloudExportHistory'),diagnosticBtn=el('productionCloudDiagnostic');
 const extra=[pauseBtn,resumeBtn,backupBtn,stageBtn,reviewBtn,updateBtn,historyBtn,historyExport,diagnosticBtn];
 if(b2)b2.hidden=!canSync;
 if(dbKey===null){for(const button of [connect,login,inspect,seed,logout,refresh,adopt,...extra])if(button)button.disabled=true;status.textContent='Endereço de banco inválido.';return;}
 let cloud=null,uid=null,busy=false,generation=0,session=null,runtime=null,plan=null,bound=false,review=null,invalid=false,writeAllowed=false,storageChanged=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const ready=()=>!storageChanged&&win?.productionCleanWorkspaceReady===true&&unlocked();
 const say=message=>{status.textContent=message;};
 const error=e=>{const code=String(e?.code??e?.message??'PRODUCTION_UNAVAILABLE');say('Operação não concluída ('+(/^[A-Z0-9_/-]+$/i.test(code)?code:'PRODUCTION_UNAVAILABLE')+'). Dados e pendências preservados.');};
 const disable=(e,v)=>{if(e)e.disabled=!!v;};
 function paint(){
  connect.disabled=busy||!!cloud||!config.enabled;login.disabled=busy||!cloud||!!uid;inspect.disabled=busy||!uid;logout.disabled=busy||!uid;
  let st={active:false,busy:false};try{if(session)st=session.state();}catch{invalid=true;}
  const blocked=busy||!canSync||!session||invalid||!ready()||st.busy;
  seed.disabled=blocked||bound||plan?.mode!=='seed'||!writeAllowed;disable(adopt,blocked||bound||plan?.mode!=='adopt'||!writeAllowed);
  disable(refresh,blocked||!bound||!st.active||!!review||!writeAllowed);disable(pauseBtn,blocked||!st.active);disable(resumeBtn,blocked||!bound||st.active||!!review||!writeAllowed);
  disable(backupBtn,blocked);disable(stageBtn,blocked||!bound||st.active||!!review||!writeAllowed);disable(reviewBtn,blocked||st.active||!review||!writeAllowed);disable(updateBtn,blocked||st.active||!review||!writeAllowed);
  for(const e of [historyBtn,historyExport,diagnosticBtn])disable(e,blocked);
 }
 async function details(){if(!session)return;try{bound=!!await session.checkpoint();review=session.review();invalid=false;if(reviewBox)reviewBox.textContent=review?JSON.stringify(review,null,2):'Nenhuma revisão pendente.';const b=session.budget();if(el('productionCloudBudget'))el('productionCloudBudget').textContent='Reserva local: '+(b?.reads??0)+'/'+LIMITS.reads+' leituras; '+(b?.writes??0)+'/'+LIMITS.writes+' escritas. Não é faturamento.';if(syncStorage.getItem(RECOVERY_KEY)!==null)invalid=true;}catch{invalid=true;try{session.pause();}catch{}say('Metadados indisponíveis. Sincronização bloqueada; preserve os dados.');}}
 const action=async fn=>{if(busy||!unlocked())return;busy=true;paint();try{await fn();}catch(e){error(e);}finally{busy=false;await details();paint();runtime?.changed();}};
 function stop(){runtime?.close();runtime=null;if(session)try{session.sessionChanged();}catch{}session=null;plan=null;bound=false;review=null;invalid=false;writeAllowed=false;}
 function makeSession(who,g){
  const current=()=>g===generation&&uid===who&&ready();
  const s=createProductionSyncSession({config,location:win.location,search,cloud,storage:syncStorage,uid:who,hash:payloadHash,id:()=>win.crypto.randomUUID(),local:{read:()=>storage.getItem(dbKey),apply:(raw,payload)=>current()&&win.productionV2ApplyLocal?.(raw,payload)===true},unlocked:current,online:()=>win?.navigator?.onLine!==false,visible:()=>doc.visibilityState!=='hidden',lock:(key,fn)=>withQueueLock('main_b2_'+key,fn,win.navigator?.locks)});
  runtime=createPollRuntime({session:{state:s.state,tick:async opts=>{try{const r=await s.tick(opts);say('Nuvem V2 · '+r.status+(r.revision?' · revisão '+r.revision:''));return r;}finally{await details();paint();}},pause:s.pause,sessionChanged:s.sessionChanged},environment:()=>({visible:doc.visibilityState!=='hidden',online:win.navigator?.onLine!==false,unlocked:current(),bound}),setTimer:(fn,ms)=>win.setTimeout(fn,ms),clearTimer:id=>win.clearTimeout(id),onError:()=>say('Consulta automática interrompida. Revise o estado.')});
  return s;
 }
 function requireSession(){if(!canSync||!session||!ready()||invalid)throw Error('PRODUCTION_TRANSFER_DISABLED');return session;}
 async function authorizeWrite(){const who=uid,g=generation;const a=await cloud.approved(who,{write:true});if(g!==generation||uid!==who||!ready()||a?.writeEnabled!==true)throw Error('PRODUCTION_WRITE_NOT_APPROVED');writeAllowed=true;}
 function download(name,data){const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=name;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
 function checked(id){return el(id)?.checked===true;}
 function reset(...ids){for(const id of ids){if(el(id))el(id).checked=false;}}
 connect.addEventListener('click',()=>action(async()=>{if(!config.enabled)throw Error('PRODUCTION_DISABLED');cloud=await open();cloud.onSession(user=>{generation++;stop();uid=user?.uid??null;storageChanged=false;if(historyBox)historyBox.textContent='';if(reviewBox)reviewBox.textContent='';if(planBox)planBox.textContent='';reset('productionCloudConsent','productionCloudBackupSaved','productionCloudReviewConsent','productionCloudReviewBackup');if(uid){if(canSync)try{session=makeSession(uid,generation);}catch(e){error(e);paint();return;}say('UID: '+uid+'. Verifique a autorização da conta.');}else say('Entre com a conta Google desejada.');void details().then(paint);});}));
 login.addEventListener('click',()=>action(async()=>{if(!cloud||uid)return;await cloud.signIn();}));
 inspect.addEventListener('click',()=>action(async()=>{if(!cloud||!uid)return;const who=uid,g=generation;if(!canSync){const remote=await cloud.read(who);if(g!==generation||who!==uid||!unlocked())return;say('UID: '+who+(remote?' • Nuvem existente, revisão '+remote.head.revision:' • Conta autorizada; nuvem vazia.'));return;}const s=requireSession();writeAllowed=false;await authorizeWrite();if(await s.checkpoint()){say('Conta autorizada para escrita. Retomada exige confirmação explícita.');return;}const r=await s.inspect();if(g!==generation||who!==uid)return;plan=r;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent=JSON.stringify({uid:r.uid,mode:r.mode,local:r.local,remote:r.remote},null,2);say(r.mode==='seed'?'Conta autorizada; nuvem vazia. Revise e confirme.':'Conta autorizada; nuvem existente. Revise antes de receber.');}));
 function link(mode){return action(async()=>{const s=requireSession();if(plan?.mode!==mode||!checked('productionCloudConsent')||!checked('productionCloudBackupSaved'))throw Error('PRODUCTION_CONSENT');await authorizeWrite();await s.authorize({mode,confirmed:true,backupSaved:true});plan=null;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent='';say('Vínculo confirmado. Use Sincronizar agora.');});}
 seed.addEventListener('click',()=>link('seed'));adopt?.addEventListener('click',()=>link('adopt'));
 refresh?.addEventListener('click',()=>{if(!canSync)return;void action(async()=>{const s=requireSession();if(!writeAllowed||!s.state().active)throw Error('PRODUCTION_PAUSED');const r=await s.tick({manual:true});say('Nuvem V2 · '+r.status+(r.revision?' · revisão '+r.revision:''));});});
 pauseBtn?.addEventListener('click',()=>{if(canSync&&session){try{runtime.pause();say('Sincronização pausada.');paint();}catch(e){error(e);}}});
 resumeBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Retomar explicitamente a sincronização do banco V2 principal?'))return;await authorizeWrite();await s.resume(true);say('Sincronização retomada.');}));
 backupBtn?.addEventListener('click',()=>action(async()=>{download('raytech-backup-principal.json',requireSession().exportLocal());say('Backup exportado; guarde o arquivo antes de confirmar.');}));
 stageBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();const file=el('productionCloudBackupFile')?.files?.[0];if(!file||!file.name.toLowerCase().endsWith('.json')||file.size>2000000)throw Error('PRODUCTION_BACKUP_FILE');await s.stageRestore(decodeJsonFile(await file.text()));reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Backup em revisão; nenhum dado aplicado.');}));
 updateBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Preservar a revisão anterior e consultar a atual?'))return;await s.refreshReview(true);reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Revisão atualizada; confirme novamente.');}));
 reviewBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();await authorizeWrite();await s.resolve({choice:el('productionCloudChoice')?.value,confirmed:checked('productionCloudReviewConsent'),backupSaved:checked('productionCloudReviewBackup')});reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Decisão aplicada localmente. Sincronização pausada.');}));
 historyBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(historyBox)historyBox.textContent=JSON.stringify(s.history(),null,2);}));
 historyExport?.addEventListener('click',()=>action(async()=>{const s=requireSession();download('raytech-revisoes.json',{current:s.review(),history:s.history(),recovery:s.recoveryHistory()});}));
 diagnosticBtn?.addEventListener('click',()=>action(async()=>{download('raytech-diagnostico-local.json',requireSession().recoveryExport());}));
 logout.addEventListener('click',()=>action(async()=>{if(!uid)return;generation++;stop();await cloud.signOut();}));
 if(win&&canSync){
  const lifecycle=()=>{runtime?.changed();paint();};
  win.addEventListener('online',lifecycle);win.addEventListener('offline',lifecycle);doc.addEventListener?.('visibilitychange',lifecycle);
  win.addEventListener('storage',e=>{if(e.key===dbKey||e.key===syncPrefix(search)+DEVICE_KEY||e.key===syncPrefix(search)+REVIEW_KEY){storageChanged=true;stop();say('Alteração em outra aba. Feche as outras abas e reabra; sincronização bloqueada.');paint();}});
  win.addEventListener('pagehide',()=>{generation++;stop();},{once:true});
 }
 say(config.enabled?(canSync?'Conecte-se para verificar sua conta.':'Login disponível para validação. Transferências financeiras desativadas.'):'Nuvem V2 aguardando liberação. Nenhuma conexão foi iniciada.');paint();
}
if(typeof document!=='undefined')bindCloudPanel(document,localStorage);
