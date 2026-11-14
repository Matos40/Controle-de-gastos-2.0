import {createStagingAuth} from './staging-auth.mjs';
import {createQueue} from './durable-queue.mjs';
import {guardLocation,createSessionGuard,blockedTransport,project} from './staging-guard.mjs';
const $=id=>document.getElementById(id);
const guard=createSessionGuard();
let auth=null,q=null,busy=false,allowed=false;
try{guardLocation(location);allowed=true;}catch{$('status').textContent='Origem ou caminho não autorizado.';}
function render(){const signed=!!auth?.current();$('login').disabled=!allowed||busy||signed||!$('consent').checked||!$('key').value.trim();for(const id of ['logout','queue','inspect'])$(id).disabled=busy||!signed;$('key').disabled=busy||signed;$('consent').disabled=busy||signed;}
async function run(fn){if(busy||!allowed)return;busy=true;render();try{await fn();}catch{$('status').textContent='Operação não concluída; confira permissões e conexão.';}finally{busy=false;render();}}
$('consent').onchange=$('key').oninput=render;
$('login').onclick=()=>run(async()=>{
 if(!$('consent').checked)return;
 const config={projectId:project,authDomain:project+'.firebaseapp.com',appId:'1:195471491370:web:b7e5a0a5a218d16f7a9e53',apiKey:$('key').value.trim()};
 if(auth)await auth.close();auth=null;q=null;guard.change(null);$('result').textContent='';
 auth=await createStagingAuth({config,enabled:true});$('key').value='';
 const {uid}=await auth.signIn();guard.change(uid);const ticket=guard.capture();
 q=createQueue({project,uid,session:()=>auth?.current(),sessionValid:()=>guard.active(ticket),call:blockedTransport});
 $('status').textContent='Conta autenticada. Transporte financeiro bloqueado.';
 const row=await q.inspect();if(guard.active(ticket))$('result').textContent=row?'Fila fictícia existente':'Fila vazia';
});
$('logout').onclick=()=>run(async()=>{guard.change(null);q=null;$('result').textContent='';await auth.close();auth=null;$('status').textContent='Sessão encerrada';});
$('queue').onclick=()=>run(async()=>{const ticket=guard.capture();if(!q||auth.current()!==ticket.uid)return;await q.enqueue({schemaVersion:1,actorId:ticket.uid,operationId:crypto.randomUUID(),commandType:'SET_SALARY',expectedRevision:0,payload:{month:'2026-11',amountCents:100}});if(guard.active(ticket))$('result').textContent='Operação fictícia local preservada';});
$('inspect').onclick=()=>run(async()=>{const ticket=guard.capture();const row=await q.inspect();if(guard.active(ticket))$('result').textContent=row?'Fila fictícia existente':'Fila vazia';});
render();
