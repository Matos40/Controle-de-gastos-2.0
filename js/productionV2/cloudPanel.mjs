import {PRODUCTION_CONFIG} from './config.mjs';
import {databaseKey,scopeSyncStorage,canTransfer,syncPrefix} from './cleanWorkspace.mjs';
import {createProductionSyncSession,LIMITS,RECOVERY_KEY,REVIEW_KEY} from '../experimentalSync/session.mjs';
import {DEVICE_KEY} from '../experimentalSync/engine.mjs';
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
 const technical=el('productionCloudTechnical'),setupPanel=el('productionCloudSetup'),advanced=el('productionCloudAdvanced'),header=el('productionCloudHeader');
 if(technical)technical.hidden=!canSync;if(header)header.hidden=!canSync;
 const previewStatus=el('productionV2PreviewStatus');if(canSync&&previewStatus)previewStatus.textContent='Verificação de compatibilidade somente neste dispositivo.';
 if(dbKey===null){for(const button of [connect,login,inspect,seed,logout,refresh,adopt,...extra])if(button)button.disabled=true;status.textContent='Endereço de banco inválido.';return;}
 const CONNECTION_KEY='auto-connect-v1',LAST_KEY='last-sync-v1';
 const connection=()=>{const stored=syncStorage.getItem(CONNECTION_KEY);if(stored!==null)return stored==='signed-out'?null:stored;try{const p=JSON.parse(syncStorage.getItem('experimental-sync-policy-v1')),c=JSON.parse(syncStorage.getItem(DEVICE_KEY));return p?.uid&&p.uid===c?.uid&&['active','paused'].includes(p.state)?p.uid:null;}catch{return null;}};
 const online=()=>win?.navigator?.onLine!==false;
 let unifiedLogin=false,profile=null,syncing=false,attention=false,verifiedSync=false,restoring=false,cloud=null,uid=null,busy=false,generation=0,session=null,runtime=null,plan=null,bound=false,review=null,invalid=false,writeAllowed=false,storageChanged=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const ready=()=>!storageChanged&&win?.productionCleanWorkspaceReady===true&&unlocked();
 const say=message=>{status.textContent=message;};
 const result=r=>{verifiedSync=['synced','updated'].includes(r.status);attention=r.status==='conflict';const labels={synced:'Sincronizado',updated:'Sincronizado',paused:'Pausado',offline:'Sem internet',conflict:'Conflito: revisão necessária',idle:'Aguardando',throttled:'Aguardando próxima consulta'};if(['synced','updated'].includes(r.status)&&uid){try{syncStorage.setItem(LAST_KEY,JSON.stringify({uid,at:new Date().toISOString()}));}catch{}}say('Nuvem V2 · '+(labels[r.status]??r.status)+(r.revision?' · revisão '+r.revision:''));};
 const error=e=>{attention=true;verifiedSync=false;const code=String(e?.code??e?.message??'PRODUCTION_UNAVAILABLE');say('Operação não concluída ('+(/^[A-Z0-9_/-]+$/i.test(code)?code:'PRODUCTION_UNAVAILABLE')+'). Dados e pendências preservados.');};
 const disable=(e,v)=>{if(e)e.disabled=!!v;};
 function paint(){
  connect.disabled=busy||!!cloud||!config.enabled;login.disabled=busy||!cloud||!!uid;inspect.disabled=busy||!uid;logout.disabled=busy||!uid;
  let st={active:false,busy:false};try{if(session)st=session.state();}catch{invalid=true;}
  const indicator=el('productionCloudConnection'),last=el('productionCloudLastSync');
  if(indicator)indicator.textContent=!online()?'Sem internet — dados locais preservados':!unlocked()?'Bloqueado pelo PIN':!uid?'Desconectado':invalid||review?'Revisão necessária':st.active?'Conectado · automático':bound?'Conectado · pausado':'Conectado · aguardando vínculo';
  if(setupPanel)setupPanel.hidden=!canSync||bound||!plan;
  if(advanced&&review){advanced.open=true;const reviewDetails=reviewBox?.closest('details');if(reviewDetails)reviewDetails.open=true;}
  if(header&&canSync){
   const kind=!uid?'disconnected':!online()?'offline':invalid||review||attention?'attention':syncing||st.busy?'syncing':st.active&&verifiedSync?'synced':st.active?'online':'paused';
   const icons={disconnected:'fa-cloud',offline:'fa-cloud-arrow-down',attention:'fa-triangle-exclamation',syncing:'fa-arrows-rotate',synced:'fa-cloud-circle-check',online:'fa-cloud',paused:'fa-circle-pause'};
   const labels={disconnected:'Desconectado',offline:'Sem internet',attention:'Atenção necessária',syncing:'Sincronizando',synced:'Sincronizado',online:'Conectado',paused:'Pausado'};
   header.title='Nuvem: '+labels[kind];header.setAttribute('aria-label',header.title);header.dataset.syncState=kind;
   header.classList.remove('text-emerald-400','text-amber-400','text-slate-400','text-blue-400','text-red-400');
   header.classList.add(kind==='synced'||kind==='online'?'text-emerald-400':kind==='syncing'?'text-blue-400':kind==='attention'?'text-red-400':kind==='offline'||kind==='paused'?'text-amber-400':'text-slate-400');
   const glyph=header.querySelector('i');if(glyph)glyph.className='fa-solid '+icons[kind]+(kind==='syncing'?' fa-spin':'');
   const guest=el('productionCloudGuest'),person=el('productionCloudProfile'),google=el('productionCloudGoogle'),name=el('productionCloudName'),photo=el('productionCloudPhoto'),initial=el('productionCloudInitial'),notice=el('productionCloudNotice');
   if(guest)guest.hidden=!!uid;if(person)person.hidden=!uid;if(google)google.disabled=busy||!online()||!ready();
   if(name)name.textContent=profile?.displayName||profile?.email||'Conta Google';
   if(initial)initial.textContent=(profile?.displayName||profile?.email||'G').trim().slice(0,1).toUpperCase();
   if(photo){let url=null;try{const u=new URL(profile?.photoURL);if(u.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(u.hostname))url=u.href;}catch{}if(url&&photo.getAttribute('src')!==url){photo.hidden=false;if(initial)initial.hidden=true;photo.src=url;}else if(!url){photo.removeAttribute('src');photo.hidden=true;if(initial)initial.hidden=false;}}
   if(notice){notice.hidden=!review&&!attention&&!invalid;notice.textContent=review?'Existem alterações que precisam ser revisadas em Manutenção e recuperação.':'Verifique sua conexão ou autorização em Manutenção e recuperação.';}
   if(indicator&&kind==='syncing')indicator.textContent='Sincronizando…';
   if(indicator&&kind==='attention')indicator.textContent='Atenção necessária';
  }
  if(indicator&&canSync){indicator.classList.toggle('text-emerald-400',!!st.active&&online()&&!invalid&&!review);indicator.classList.toggle('text-amber-400',!!uid&&(!st.active||!online()||invalid||!!review));indicator.classList.toggle('text-slate-400',!uid);}
  if(last){try{const x=JSON.parse(syncStorage.getItem(LAST_KEY));last.textContent=x?.uid===uid?'Última sincronização: '+new Date(x.at).toLocaleString('pt-BR'):'Última sincronização: —';}catch{last.textContent='Última sincronização: —';}}
  const blocked=busy||!canSync||!session||invalid||!ready()||st.busy;
  seed.disabled=blocked||bound||plan?.mode!=='seed'||!writeAllowed;disable(adopt,blocked||bound||plan?.mode!=='adopt'||!writeAllowed);
  disable(refresh,blocked||!bound||!st.active||!!review||!writeAllowed);
  if(canSync){connect.hidden=!!cloud;login.hidden=!!uid||!cloud;inspect.hidden=bound&&writeAllowed;seed.hidden=bound||plan?.mode!=='seed';if(adopt)adopt.hidden=bound||plan?.mode!=='adopt';if(refresh)refresh.hidden=!bound;logout.hidden=!uid;}else if(el('productionCloudProfile'))el('productionCloudProfile').hidden=!uid;
disable(pauseBtn,!canSync||!session||!st.active);disable(resumeBtn,blocked||!bound||st.active||!!review||!writeAllowed);
  disable(backupBtn,blocked);disable(stageBtn,blocked||!bound||st.active||!!review||!writeAllowed);disable(reviewBtn,blocked||st.active||!review||!writeAllowed);disable(updateBtn,blocked||st.active||!review||!writeAllowed);
  for(const e of [historyBtn,historyExport,diagnosticBtn])disable(e,blocked);
 }
 async function details(){if(!session)return;try{bound=!!await session.checkpoint();review=session.review();invalid=false;if(reviewBox)reviewBox.textContent=review?JSON.stringify(review,null,2):'Nenhuma revisão pendente.';const b=session.budget();if(el('productionCloudBudget'))el('productionCloudBudget').textContent='Reserva local: '+(b?.reads??0)+'/'+LIMITS.reads+' leituras; '+(b?.writes??0)+'/'+LIMITS.writes+' escritas. Não é faturamento.';if(syncStorage.getItem(RECOVERY_KEY)!==null)invalid=true;}catch{invalid=true;try{session.pause();}catch{}say('Metadados indisponíveis. Sincronização bloqueada; preserve os dados.');}}
 const action=async fn=>{if(busy||!unlocked())return;busy=true;paint();try{await fn();}catch(e){error(e);}finally{busy=false;await details();paint();runtime?.changed();if(unifiedLogin&&uid&&canSync&&ready()&&online()&&!bound&&!invalid&&!plan){unifiedLogin=false;void action(inspectAccount);}}};
 function stop(preserve=false){runtime?.close();runtime=null;if(session)try{preserve?session.suspend():session.sessionChanged();}catch{}session=null;plan=null;bound=false;review=null;invalid=false;writeAllowed=false;}
 function makeSession(who,g){
  const current=()=>g===generation&&uid===who&&ready();
  const s=createProductionSyncSession({config,location:win.location,search,cloud,storage:syncStorage,uid:who,hash:payloadHash,id:()=>win.crypto.randomUUID(),local:{read:()=>storage.getItem(dbKey),apply:(raw,payload)=>current()&&win.productionV2ApplyLocal?.(raw,payload)===true},unlocked:current,online:()=>win?.navigator?.onLine!==false,visible:()=>doc.visibilityState!=='hidden',lock:(key,fn)=>withQueueLock('main_b2_'+key,fn,win.navigator?.locks)});
  runtime=createPollRuntime({session:{state:s.state,tick:async opts=>{try{syncing=true;paint();const r=await s.tick(opts);if(g===generation)result(r);return r;}finally{syncing=false;await details();paint();}},pause:s.pause,sessionChanged:s.sessionChanged},environment:()=>({visible:doc.visibilityState!=='hidden',online:win.navigator?.onLine!==false,unlocked:current(),bound}),setTimer:(fn,ms)=>win.setTimeout(fn,ms),clearTimer:id=>win.clearTimeout(id),onError:()=>{attention=true;verifiedSync=false;say('Consulta automática interrompida. Revise o estado.');paint();}});
  return s;
 }
 function requireSession(){if(!canSync||!session||!ready()||invalid)throw Error('PRODUCTION_TRANSFER_DISABLED');return session;}
 async function authorizeWrite(){const who=uid,g=generation;const a=await cloud.approved(who,{write:true});if(g!==generation||uid!==who||!ready()||a?.writeEnabled!==true)throw Error('PRODUCTION_WRITE_NOT_APPROVED');writeAllowed=true;}
 function download(name,data){const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download=name;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
 function checked(id){return el(id)?.checked===true;}
 function reset(...ids){for(const id of ids){if(el(id))el(id).checked=false;}}
 async function restore(){
  if(restoring||busy||!canSync||!ready()||!online()||doc.visibilityState==='hidden'||!uid||!session||connection()!==uid)return;
  const s=session,g=generation;restoring=true;busy=true;paint();
  try{await details();if(g!==generation||!bound||invalid||review)return;await authorizeWrite();if(g!==generation)return;
   if(!s.state().active&&s.state().persisted==='active')await s.restoreActive();
   if(g===generation&&s.state().active){syncing=true;paint();try{const r=await s.tick({manual:true});if(g===generation)result(r);}finally{syncing=false;}}
  }catch(e){if(g===generation)error(e);}finally{restoring=false;busy=false;await details();paint();runtime?.changed();}
 }
 async function connectCloud(){if(cloud||!config.enabled)return;cloud=await open();cloud.onSession(user=>{
  const previous=uid;generation++;stop(!previous||previous===user?.uid);uid=user?.uid??null;profile=user??null;attention=false;verifiedSync=false;storageChanged=false;
  if(historyBox)historyBox.textContent='';if(reviewBox)reviewBox.textContent='';if(planBox)planBox.textContent='';
  reset('productionCloudConsent','productionCloudBackupSaved','productionCloudReviewConsent','productionCloudReviewBackup');
  if(uid){if(canSync)try{session=makeSession(uid,generation);}catch(e){error(e);paint();return;}say('Conta Google conectada. Verifique a autorização da conta.');}else say('Entre com a conta Google desejada.');
  void details().then(()=>{paint();win.setTimeout(()=>{if(!canSync||!uid||!ready()||!online())return;if(connection()===uid)void restore();else if(unifiedLogin&&!bound&&!invalid){unifiedLogin=false;void action(inspectAccount);}},0);});
 });}
 connect.addEventListener('click',()=>action(connectCloud));
 const photo=el('productionCloudPhoto');photo?.addEventListener('error',()=>{photo.hidden=true;const initial=el('productionCloudInitial');if(initial)initial.hidden=false;});
 el('productionCloudGoogle')?.addEventListener('click',()=>{if(!canSync||!ready()||!online())return;unifiedLogin=true;void action(async()=>{await connectCloud();if(!cloud.currentUid())await cloud.signIn();});});

 login.addEventListener('click',()=>action(async()=>{if(!cloud||uid)return;await cloud.signIn();}));
 async function inspectAccount(){if(!cloud||!uid)return;const who=uid,g=generation;if(!canSync){const remote=await cloud.read(who);if(g!==generation||who!==uid||!unlocked())return;say('UID: '+who+(remote?' • Nuvem existente, revisão '+remote.head.revision:' • Conta autorizada; nuvem vazia.'));return;}const s=requireSession();writeAllowed=false;await authorizeWrite();if(await s.checkpoint()){say('Conta autorizada para escrita. Retomada exige confirmação explícita.');return;}const r=await s.inspect();if(g!==generation||who!==uid)return;plan=r;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent=JSON.stringify({uid:r.uid,mode:r.mode,local:r.local,remote:r.remote},null,2);say(r.mode==='seed'?'Conta autorizada; nuvem vazia. Revise e confirme.':'Conta autorizada; nuvem existente. Revise antes de receber.');}
 inspect.addEventListener('click',()=>action(inspectAccount));
 function link(mode){return action(async()=>{const s=requireSession();if(plan?.mode!==mode||!checked('productionCloudConsent')||!checked('productionCloudBackupSaved'))throw Error('PRODUCTION_CONSENT');await authorizeWrite();await s.authorize({mode,confirmed:true,backupSaved:true});syncStorage.setItem(CONNECTION_KEY,uid);plan=null;reset('productionCloudConsent','productionCloudBackupSaved');if(planBox)planBox.textContent='';say('Vínculo confirmado. Sincronização automática ativa.');});}
 seed.addEventListener('click',()=>link('seed'));adopt?.addEventListener('click',()=>link('adopt'));
 refresh?.addEventListener('click',()=>{if(!canSync)return;void action(async()=>{const s=requireSession();if(!writeAllowed||!s.state().active)throw Error('PRODUCTION_PAUSED');syncing=true;paint();try{const r=await s.tick({manual:true});result(r);}finally{syncing=false;}});});
 pauseBtn?.addEventListener('click',()=>{if(canSync&&session){try{runtime.pause();say('Sincronização pausada.');paint();}catch(e){error(e);}}});
 resumeBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Retomar explicitamente a sincronização do banco V2 principal?'))return;await authorizeWrite();await s.resume(true);syncStorage.setItem(CONNECTION_KEY,uid);say('Sincronização retomada.');}));
 backupBtn?.addEventListener('click',()=>action(async()=>{download('raytech-backup-principal.json',requireSession().exportLocal());say('Backup exportado; guarde o arquivo antes de confirmar.');}));
 stageBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();const file=el('productionCloudBackupFile')?.files?.[0];if(!file||!file.name.toLowerCase().endsWith('.json')||file.size>2000000)throw Error('PRODUCTION_BACKUP_FILE');await s.stageRestore(decodeJsonFile(await file.text()));reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Backup em revisão; nenhum dado aplicado.');}));
 updateBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(!confirm('Preservar a revisão anterior e consultar a atual?'))return;await s.refreshReview(true);reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Revisão atualizada; confirme novamente.');}));
 reviewBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();await authorizeWrite();await s.resolve({choice:el('productionCloudChoice')?.value,confirmed:checked('productionCloudReviewConsent'),backupSaved:checked('productionCloudReviewBackup')});reset('productionCloudReviewConsent','productionCloudReviewBackup');el('productionCloudChoice').value='';say('Decisão aplicada localmente. Sincronização pausada.');}));
 historyBtn?.addEventListener('click',()=>action(async()=>{const s=requireSession();if(historyBox)historyBox.textContent=JSON.stringify(s.history(),null,2);}));
 historyExport?.addEventListener('click',()=>action(async()=>{const s=requireSession();download('raytech-revisoes.json',{current:s.review(),history:s.history(),recovery:s.recoveryHistory()});}));
 diagnosticBtn?.addEventListener('click',()=>action(async()=>{download('raytech-diagnostico-local.json',requireSession().recoveryExport());}));
 logout.addEventListener('click',()=>action(async()=>{if(!uid)return;syncStorage.setItem(CONNECTION_KEY,'signed-out');generation++;stop();await cloud.signOut();}));
 if(win&&canSync){
  const lifecycle=()=>{runtime?.changed();paint();if(!online()||!ready()||doc.visibilityState==='hidden')return;if(!cloud&&connection()&&!busy)void action(connectCloud);else void restore();};
  win.addEventListener('online',lifecycle);win.addEventListener('offline',lifecycle);doc.addEventListener?.('visibilitychange',lifecycle);
  win.addEventListener('storage',e=>{if(e.key===dbKey||e.key===syncPrefix(search)+DEVICE_KEY||e.key===syncPrefix(search)+REVIEW_KEY){storageChanged=true;stop();say('Alteração em outra aba. Feche as outras abas e reabra; sincronização bloqueada.');paint();}});
  win.addEventListener('pagehide',()=>{generation++;stop(true);},{once:true});
  const observer=new win.MutationObserver(lifecycle);const pin=el('pinLockOverlay');if(pin)observer.observe(pin,{attributes:true,attributeFilter:['class']});
  const startup=()=>{if(!ready()){win.setTimeout(startup,500);return;}lifecycle();};if(connection())win.setTimeout(startup,0);
 }
 say(config.enabled?(canSync?'Conecte-se para verificar sua conta.':'Login disponível para validação. Transferências financeiras desativadas.'):'Nuvem V2 aguardando liberação. Nenhuma conexão foi iniciada.');paint();
}
if(typeof document!=='undefined')bindCloudPanel(document,localStorage);
