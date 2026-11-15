import {initializeApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
import {localAdapter,PROJECT,hash} from './adapter.mjs';
import {createExperimentalSession,LIMITS,RECOVERY_KEY} from '../../js/experimentalSync/session.mjs';
import {createPollRuntime} from '../../js/experimentalSync/runtime.mjs';
import {decodeJsonFile,decodeExcelFile} from '../../js/experimentalSync/backupFiles.mjs';
import {blank,validatePayload} from '../../js/productionV2/model.mjs';
import * as XLSX from 'xlsx';
if(location.protocol!=='http:'||location.hostname!=='127.0.0.1'||location.pathname!=='/')throw Error('LOOPBACK_ONLY');
const uid='panel-owner',app=initializeApp({projectId:PROJECT,apiKey:'demo-only',appId:'demo-only'}),db=getFirestore(app);
connectFirestoreEmulator(db,'127.0.0.1',8081,{mockUserToken:{sub:uid,user_id:uid}});
const key='synthetic-bank-b2',marker='synthetic-bank-b2-initialized',prefix='raytech-lab-b2:';
const scoped={getItem:k=>localStorage.getItem(prefix+k),setItem:(k,v)=>localStorage.setItem(prefix+k,v),removeItem:k=>localStorage.removeItem(prefix+k)};
const el=id=>document.getElementById(id),say=s=>{el('status').textContent=s;};
const local={read:()=>localStorage.getItem(key),apply:(a,b)=>{if(localStorage.getItem(key)!==a)return false;localStorage.setItem(key,b);return localStorage.getItem(key)===b;}};
let release,ready=false,session,runtime,plan=null,repair=false,working=false,bound=false,reviewing=false,valid=false,uidOkay=true;
function download(name,obj){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function resetConsent(...ids){for(const id of ids)el(id).checked=false;}
function safeError(e){const code=String(e?.code??e?.message??'ERRO');return /^[A-Z0-9_/-]+$/i.test(code)?code:'OPERACAO_RECUSADA';}
function show(id,x){el(id).textContent=x===null||x===undefined?'—':JSON.stringify(x,null,2);}
async function paint(){
 let cp=null,cpInvalid=false;try{cp=await session.checkpoint();}catch{cpInvalid=true;}
 bound=!!cp;let rv=null;try{rv=session.review();}catch{}reviewing=!!rv;
 valid=false;try{const d=validatePayload(local.read());valid=true;const amount=d.months[d.selectedMonth].salary;el('salaryText').textContent=amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});if(document.activeElement!==el('salaryInput'))el('salaryInput').value=amount;}catch{el('salaryText').textContent='Banco local inválido';}
 let st={active:false,persisted:'indisponível'};try{st=session.state();}catch{}
 const journal=scoped.getItem(RECOVERY_KEY)!==null;
 el('deviceState').textContent='Identidade fictícia: '+uid+' · '+(navigator.onLine?'Online':'Offline');
 el('linkState').textContent=cpInvalid?'Checkpoint inválido · preservado':(bound?'Vinculado · revisão '+(cp.base?.head.revision??0):'Não vinculado')+' · '+(st.active?'ativo':'pausado');
 const b=session.budget();el('budget').textContent='Orçamento reservado: '+(b?.reads??0)+' / '+LIMITS.reads+' leituras; '+(b?.writes??0)+' / '+LIMITS.writes+' escritas.';
 show('base',rv?JSON.parse(rv.base.head.payload):null);show('local',rv?JSON.parse(rv.local):null);show('remote',rv?JSON.parse(rv.remote.head.payload):null);show('restoreTarget',rv?.target?JSON.parse(rv.target):null);
 el('reviewCount').textContent=session.history().length+' revisão(ões) preservadas no arquivo local.';
 const dis={inspect:bound||cpInvalid||!valid||journal,authorize:!plan||bound||cpInvalid,cancel:!plan,pause:!st.active,resume:!bound||st.active||cpInvalid||!valid||reviewing||journal,syncNow:!st.active||!valid||reviewing||journal,saveSalary:!valid||reviewing||journal,exportLocal:!valid,stage:!bound||st.active||!valid||reviewing||journal||cpInvalid,refreshReview:!reviewing||st.active||journal,resolve:!reviewing||st.active||journal,inspectRecovery:!bound||cpInvalid||st.active||reviewing||(valid&&!journal),recover:!repair||st.active,diagnostic:false,exportHistory:false};
 for(const [id,v] of Object.entries(dis))el(id).disabled=working||v;
}
async function act(fn){if(!ready||working)return;working=true;for(const b of document.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(e){say('Recusado: '+safeError(e)+'. Dados preservados para revisão.');}finally{working=false;try{await paint();runtime.changed();}catch(e){say('Diagnóstico necessário: '+safeError(e));}}}
function on(id,fn){el(id).addEventListener('click',()=>act(fn));}
async function boot(){
 if(!navigator.locks?.request)throw Error('LOCK_UNAVAILABLE');
 const hold=new Promise(r=>{release=r;});
 await new Promise((resolve,reject)=>{navigator.locks.request('raytech-lab-b2-workspace',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock){reject(Error('TAB_BUSY'));return;}resolve();await hold;}).catch(reject);});
 if(local.read()===null&&localStorage.getItem(marker)===null&&scoped.getItem('raytech_production_v2_device')===null){localStorage.setItem(marker,'1');localStorage.setItem(key,JSON.stringify(blank('2026-11')));}
 session=createExperimentalSession({cloud:localAdapter(db,uid),storage:scoped,local,uid,hash,id:()=>crypto.randomUUID(),online:()=>navigator.onLine,visible:()=>document.visibilityState==='visible',unlocked:()=>uidOkay,lock:(k,fn)=>navigator.locks.request('raytech-lab-b2-'+k,fn)});
 runtime=createPollRuntime({session:{state:session.state,tick:async opts=>{const result=await session.tick(opts);say('Consulta automática: '+result.status);await paint();return result;},pause:session.pause,sessionChanged:session.sessionChanged},environment:()=>({visible:document.visibilityState==='visible',online:navigator.onLine,unlocked:uidOkay,bound}),setTimer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id),onError:()=>say('Consulta automática interrompida. Revise o estado local.')});
 on('saveSalary',()=>{const d=validatePayload(local.read()),v=Number(el('salaryInput').value);if(el('salaryInput').value==='')throw Error('VALOR_INVALIDO');d.months[d.selectedMonth].salary=v;const raw=JSON.stringify(d);validatePayload(raw);localStorage.setItem(key,raw);say('Salário fictício salvo localmente.');});
 on('exportLocal',()=>{download('backup-ficticio.json',session.exportLocal());say('Backup fictício exportado. Confirme somente após guardar o arquivo.');});
 on('inspect',async()=>{plan=await session.inspect();resetConsent('consent','backupSaved');el('plan').hidden=false;show('plan',{uid:plan.uid,operation:plan.mode,local:plan.local,remote:plan.remote});say(plan.mode==='seed'?'Nuvem fictícia vazia. Revise antes do vínculo.':'Nuvem fictícia existente. Revise antes de receber.');});
 on('authorize',async()=>{if(!el('consent').checked||!el('backupSaved').checked)throw Error('CONSENTIMENTO_NECESSARIO');const mode=plan.mode;plan=null;el('plan').hidden=true;await session.authorize({mode,confirmed:true,backupSaved:true});resetConsent('consent','backupSaved');say('Vínculo confirmado. Use Sincronizar agora para iniciar a troca.');});
 on('cancel',async()=>{await session.authorize({confirmed:false});plan=null;el('plan').hidden=true;resetConsent('consent','backupSaved');say('Plano cancelado.');});
 on('pause',()=>{runtime.pause();plan=null;say('Sincronização pausada.');});
 on('resume',async()=>{if(!confirm('Retomar a sincronização fictícia deste dispositivo?'))return;await session.resume(true);say('Sincronização retomada.');});
 on('syncNow',async()=>{const r=await session.tick({manual:true});say('Sincronização: '+r.status+(r.revision?' · revisão '+r.revision:''));});
 on('stage',async()=>{const f=el('backupFile').files[0];if(!f||f.size>2000000)throw Error('ARQUIVO_INVALIDO');const env=f.name.toLowerCase().endsWith('.xlsx')?decodeExcelFile(new Uint8Array(await f.arrayBuffer()),XLSX):decodeJsonFile(await f.text());await session.stageRestore(env);resetConsent('reviewConsent','reviewBackup');el('choice').value='';say('Backup em revisão. Nenhum dado aplicado.');});
 on('exportHistory',()=>{download('revisoes-ficticias.json',{current:session.review(),history:session.history(),recovery:session.recoveryHistory()});say('Histórico experimental exportado.');});
 on('refreshReview',async()=>{if(!confirm('Preservar a revisão antiga e consultar a versão atual?'))return;await session.refreshReview(true);resetConsent('reviewConsent','reviewBackup');el('choice').value='';say('Revisão atualizada. Decisão anterior não reutilizada.');});
 on('resolve',async()=>{await session.resolve({choice:el('choice').value,confirmed:el('reviewConsent').checked,backupSaved:el('reviewBackup').checked});resetConsent('reviewConsent','reviewBackup');el('choice').value='';say('Decisão aplicada localmente. Sincronização permanece pausada.');});
 on('diagnostic',()=>{download('diagnostico-ficticio.json',session.recoveryExport());say('Diagnóstico exportado.');});
 on('inspectRecovery',async()=>{repair=false;const r=await session.inspectRecovery();repair=true;show('recoveryPlan',r);resetConsent('recoveryConsent','recoveryBackup');say('Recuperação preparada. Nenhum dado alterado.');});
 on('recover',async()=>{await session.recover({confirmed:el('recoveryConsent').checked,backupSaved:el('recoveryBackup').checked});repair=false;resetConsent('recoveryConsent','recoveryBackup');say('Banco recuperado localmente. Sincronização pausada.');});
 const lifecycle=()=>{runtime.changed();void paint();};
 window.addEventListener('online',lifecycle);window.addEventListener('offline',lifecycle);document.addEventListener('visibilitychange',lifecycle);window.addEventListener('pagehide',()=>{ready=false;runtime.close();release();},{once:true});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
 ready=true;await paint();say('Laboratório pronto. Nenhuma transferência sem consentimento.');
}
boot().catch(e=>{ready=false;release?.();for(const b of document.querySelectorAll('button'))b.disabled=true;say('Laboratório indisponível: '+safeError(e));});
