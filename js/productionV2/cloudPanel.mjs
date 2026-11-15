import {PRODUCTION_CONFIG} from './config.mjs';
import {prepareLocal} from './preview.mjs';
import {seedCloud} from './initialTransfer.mjs';
export function bindCloudPanel(doc,storage,{config=PRODUCTION_CONFIG,open=async()=>{const m=await import('./firebaseAdapter.mjs');return m.openProductionCloud();},confirm=message=>globalThis.confirm(message)}={}){
 const el=id=>doc.getElementById(id),status=el('productionCloudStatus'),connect=el('productionCloudConnect'),login=el('productionCloudLogin'),inspect=el('productionCloudInspect'),seed=el('productionCloudSeed'),logout=el('productionCloudLogout');
 if(!status||!connect||!login||!inspect||!seed||!logout)return;
 let cloud=null,uid=null,busy=false,generation=0,approved=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const say=message=>{status.textContent=message;};
 function paint(){connect.disabled=busy||!!cloud||!config.enabled;login.disabled=busy||!cloud||!!uid;inspect.disabled=busy||!uid;seed.disabled=busy||!uid||!approved;logout.disabled=busy||!uid;}
 const action=async fn=>{if(busy||!unlocked())return;busy=true;paint();try{await fn();}catch(e){const code=typeof e?.code==='string'?e.code:typeof e?.message==='string'&&/^PRODUCTION_[A-Z_]+$/.test(e.message)?e.message:'PRODUCTION_UNAVAILABLE';say('Operação não concluída ('+code+'). Banco local preservado; confira a fila antes de repetir.');}finally{busy=false;paint();}};
 connect.addEventListener('click',()=>action(async()=>{if(!config.enabled)throw Error('PRODUCTION_DISABLED');cloud=await open();cloud.onSession(user=>{generation++;uid=user?.uid??null;approved=false;say(uid?'UID: '+uid+'. Verifique a autorização antes de transferir.':'Entre com a conta Google desejada.');paint();});}));
 login.addEventListener('click',()=>action(async()=>{if(!cloud||uid)return;await cloud.signIn();}));
 inspect.addEventListener('click',()=>action(async()=>{const who=uid,g=generation;approved=false;const remote=await cloud.read(who);if(g!==generation||who!==uid||!unlocked())return;approved=true;say('UID: '+who+(remote?' • Nuvem existente; não será sobrescrita. Revisão '+remote.head.revision:' • Conta autorizada; nuvem vazia.'));}));
 seed.addEventListener('click',()=>action(async()=>{const who=uid,g=generation;if(!approved||!who||!unlocked())return;const p=prepareLocal(storage.getItem('controle_gastos_multimonth_v3'));if(!p.compatible){say(p.reason);return;}if(!confirm('Enviar uma cópia de '+p.months+' mês(es) e '+p.entries+' lançamento(s) para a conta UID '+who+'? O banco local permanecerá intacto. Prossiga somente com a sua conta e seu backup.'))return;if(g!==generation||who!==uid||!unlocked())return;const result=await seedCloud({cloud,storage,uid:who,payload:p.payload,isCurrent:()=>g===generation&&uid===who&&unlocked()});if(g===generation){approved=false;say('Cópia inicial confirmada na nuvem, revisão '+result.revision+'. Banco local preservado. Sincronização automática ainda não ativada.');}}));
 logout.addEventListener('click',()=>action(async()=>{if(!uid)return;approved=false;await cloud.signOut();}));
 say(config.enabled?'Conecte-se para verificar sua conta.':'Nuvem V2 aguardando liberação. Nenhuma conexão foi iniciada.');paint();
}
if(typeof document!=='undefined')bindCloudPanel(document,localStorage);
