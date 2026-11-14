import {createClient} from './client.mjs';
import {createQueue} from './durable-queue.mjs';
import {onAuthStateChanged} from 'firebase/auth';
const $=id=>document.getElementById(id);
const c=await createClient({name:'raytech-local-lab',persistSession:true});
let epoch=0,session=null,busy=false;
const msg=t=>$('message').textContent=t;
function controls(){
 const s=session;
 $('login').disabled=busy||!!s;$('logout').disabled=busy||!s;
 $('init').disabled=busy||!s||!!s.pending||s.revision!==null||!navigator.onLine;
 $('pull').disabled=busy||!s;
 $('save').disabled=$('amount').disabled=busy||!s||s.revision===null||!!s.pending;
}
const active=s=>session===s&&s.epoch===epoch&&c.auth.currentUser?.uid===s.uid;
function clear(){for(const id of ['revision','confirmed'])$(id).textContent='—';$('output').textContent='';$('amount').value='';msg('');$('queue').textContent='sem sessão';}
async function inspect(s){
 const p=await s.q.inspect();if(!active(s))return;
 s.pending=p;$('queue').textContent=p?(p.state==='conflict'?'conflito: revisão necessária':'pendente'):'vazia';controls();
}
async function read(s){
 if(!active(s)||!navigator.onLine)return;
 const r=await c.call('Read');if(!active(s))return;
 if(r.status==='success'){
  s.revision=r.snapshot.revision;$('revision').textContent=String(s.revision);
  $('confirmed').textContent=String(r.snapshot.database.months['2026-11'].salary);
  $('output').textContent=JSON.stringify({revision:s.revision,salary:r.snapshot.database.months['2026-11'].salary},null,2);
 }else if(r.status==='absent'){s.revision=null;$('revision').textContent=$('confirmed').textContent='—';}
 else msg('Leitura não confirmada.');
 controls();
}
async function sync(s){
 if(!active(s))return;
 await inspect(s);if(!active(s))return;
 if(!navigator.onLine){msg('Sem conexão. Fila preservada.');return;}
 const result=await s.q.flush();if(!active(s))return;
 await inspect(s);if(!active(s))return;
 if(result.status==='conflict'||s.pending?.state==='conflict')msg('Conflito financeiro: operação preservada; nenhuma sobrescrita.');
 else if(result.status==='unknown')msg('Confirmação pendente. Operação preservada para reenvio.');
 else if(result.status==='confirmed')msg('Operação confirmada.');
 await read(s);
}
async function run(fn){
 if(busy)return;busy=true;controls();
 const s=session;
 try{await fn(s);}catch(_){if(session===s)msg('Operação não concluída. Verifique a fila e a conexão.');}
 finally{busy=false;controls();}
}
onAuthStateChanged(c.auth,user=>{
 const ticket=++epoch;session=null;clear();
 if(!user){$('status').textContent='Desconectado';controls();return;}
 const s={uid:user.uid,epoch:ticket,revision:null,pending:null};
 s.q=createQueue({project:'demo-raytech-cg',uid:s.uid,session:()=>c.auth.currentUser?.uid,sessionValid:()=>active(s),call:(...args)=>active(s)?c.call(...args):Promise.resolve({status:'unknown'})});
 session=s;$('status').textContent='Conectado: '+s.uid;controls();
 // Auth restoration does not reuse a previous account's memory or queue.
 void sync(s).catch(()=>{if(active(s))msg('Fila indisponível. Nenhuma operação enviada.');});
});
$('login').onclick=()=>run(async()=>{await c.signIn();});
$('logout').onclick=()=>run(async()=>{++epoch;session=null;clear();await c.logout();});
$('init').onclick=()=>run(async s=>{if(!s||!active(s)||s.pending)return;await c.call('Initialize',{confirmation:true});await sync(s);});
$('pull').onclick=()=>run(async s=>{if(s)await sync(s);});
$('salary').onsubmit=e=>{e.preventDefault();void run(async s=>{
 if(!s||!active(s)||s.revision===null||s.pending)return;
 const raw=$('amount').value,amountCents=Math.round(Number(raw)*100);
 if(!raw||!Number.isSafeInteger(amountCents)||amountCents<0||amountCents>100000000000){msg('Valor inválido.');return;}
 const command={schemaVersion:1,actorId:s.uid,operationId:crypto.randomUUID(),commandType:'SET_SALARY',expectedRevision:s.revision,payload:{month:'2026-11',amountCents}};
 await s.q.enqueue(command);if(!active(s))return;
 $('amount').value='';await sync(s);
});};
window.addEventListener('online',()=>{if(!busy)void run(async s=>{if(s)await sync(s);});});
window.addEventListener('offline',()=>{if(session)msg('Sem conexão. Fila preservada.');controls();});
controls();
