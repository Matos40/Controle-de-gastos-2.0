import {createClient} from './client.mjs';
const $=id=>document.getElementById(id);
const show=x=>{$('output').textContent=JSON.stringify(x,null,2);};
const c=await createClient({name:'raytech-local-lab'});
let revision=null,actor=null,uncertain=null,busy=false;
function reset(){revision=null;actor=null;uncertain=null;$('output').textContent='';}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(_){show({status:'rejected',code:'LAB_ERROR'});}finally{busy=false;}}
async function pull(){const r=await c.call('Read');if(r.status==='success'){revision=r.snapshot.revision;actor=r.snapshot.uid;}else{revision=null;}show(r);}
$('login').onclick=()=>run(async()=>{reset();const r=await c.signIn();$('status').textContent='Conectado: '+r.uid;await pull();});
$('logout').onclick=()=>run(async()=>{reset();await c.logout();$('status').textContent='Desconectado';});
$('init').onclick=()=>run(async()=>{const r=await c.call('Initialize',{confirmation:true});show(r);await pull();});
$('pull').onclick=()=>run(async()=>{
 if(uncertain){const r=await c.call('Receipt',{operationId:uncertain.operationId});if(r.status==='found'){uncertain=null;}else if(r.status==='absent'){const again=await c.call('Command',{command:uncertain});if(again.status!=='unknown')uncertain=null;show(again);if(again.status==='unknown')return;}else{show(r);return;}}
 await pull();
});
$('salary').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(uncertain||revision===null||actor!==c.auth.currentUser?.uid){show({status:'blocked',code:'SYNC_REQUIRED'});return;}
 const amountCents=Math.round(Number($('amount').value)*100);
 if(!Number.isSafeInteger(amountCents)||amountCents<0){show({status:'rejected',code:'INVALID_AMOUNT'});return;}
 const command={schemaVersion:1,actorId:actor,operationId:crypto.randomUUID(),commandType:'SET_SALARY',expectedRevision:revision,payload:{month:'2026-11',amountCents}};
 const r=await c.call('Command',{command});if(r.status==='unknown'){uncertain=command;show(r);return;}show(r);await pull();
});};
