import {createConciliation,loadPlan,savePlan,PLAN_KEY} from './conciliation.mjs';
const DB='controle_gastos_multimonth_v3';
export function bindConciliation(doc,storage,win=globalThis.window){
 const el=id=>doc.getElementById(id),open=el('productionConciliationOpen'),panel=el('productionConciliationPanel'),status=el('productionConciliationStatus'),list=el('productionConciliationList'),undo=el('productionConciliationUndo'),reset=el('productionConciliationReset'),save=el('productionConciliationSave'),close=el('productionConciliationClose');
 if(!open||!panel||!status||!list||!undo||!reset||!save||!close)return;
 let source=null,session=null,generation=0,busy=false;
 const unlocked=()=>!el('pinLockOverlay')||el('pinLockOverlay').classList.contains('hidden');
 const say=t=>{status.textContent=t;};
 const clear=()=>{generation++;source=null;session=null;busy=false;list.replaceChildren();say('');panel.classList.add('hidden');};
 const check=()=>{if(!unlocked()){clear();return false;}if(!session||storage.getItem(DB)!==source){clear();panel.classList.remove('hidden');say('Banco local alterado. Reabra a conciliação para gerar um plano atualizado.');return false;}return true;};
 const make=(tag,text,cls)=>{const node=doc.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
 const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 function paint(){
  if(!check())return;list.replaceChildren();const s=session.status();
  undo.disabled=busy||!s.decisions;save.disabled=busy||!s.compatible;reset.disabled=busy;
  say(s.compatible?'Compatível. Equivalência financeira conferida. Confirme para guardar somente o plano local.':s.remaining+' parcela(s) pendente(s). '+s.decisions+' decisão(ões) nesta revisão.');
  for(const item of session.list()){
   const card=make('div','','space-y-2 border border-slate-700 rounded-lg p-2');
   card.append(make('p',item.month+' · '+item.number+'/'+item.total+' · '+fmt(item.amount)+' · '+(item.paid?'Pago':'Pendente'),'font-semibold text-xs'),make('p',item.title,'text-xs break-words'));
   const select=make('select','','w-full bg-slate-900 text-slate-100 text-xs rounded p-2');
   const placeholder=make('option','Selecione após conferir a compra');placeholder.value='';select.append(placeholder);
   for(const o of item.options){
    const label=o.kind==='independent'?'Série independente (somente se tiver certeza)':(o.kind==='link_pending'?'Associar duas pendentes: ':'Associar à série existente: ')+o.month+' · '+o.number+'/'+item.total+' · '+fmt(o.amount)+(o.projected?' · sequência compatível':' · intervalo exige conferência');
    const option=make('option',label);option.value=o.anchor;select.append(option);
   }
   const btn=make('button','Confirmar associação','px-2 py-2 rounded bg-slate-800 text-xs');btn.type='button';btn.disabled=true;
   select.disabled=busy;select.addEventListener('change',()=>{btn.disabled=busy||!select.value;});
   btn.addEventListener('click',()=>{if(busy||!check()||!select.value)return;const o=item.options.find(x=>x.anchor===select.value);if(!o)return;
    const msg=o.kind==='independent'?'Você confirma que esta parcela deve ficar em uma série independente, sem vínculo com outras compras? Não use esta opção se tiver dúvida.':'Você confirma que as parcelas pertencem à mesma compra? Confira os meses e a numeração no histórico antes de confirmar.';
    if(!win.confirm(msg)||!check())return;try{session.apply({target:item.token,anchor:o.anchor});paint();}catch{say('Associação bloqueada: conflito de identidade, sequência ou exclusão.');}});
   card.append(select,btn);if(!item.options.length)card.append(make('p','Nenhuma associação segura disponível. Não force a vinculação.','text-amber-300 text-xs'));list.append(card);
  }
 }
 open.addEventListener('click',async()=>{if(!unlocked()||busy)return;clear();panel.classList.remove('hidden');source=storage.getItem(DB);const g=generation;busy=true;say('Preparando revisão local...');
  try{const prior=await loadPlan(storage,source);if(g!==generation)return;session=createConciliation(source,prior);busy=false;paint();}catch(e){if(g!==generation)return;busy=false;const stale=e?.message==='CONCILIATION_SOURCE_CHANGED';say(stale?'Plano anterior desatualizado. Use Reiniciar revisão para descartar o plano antigo.':'Não foi possível abrir a conciliação. Verifique as incompatibilidades restantes.');reset.disabled=false;save.disabled=true;undo.disabled=true;}});
 undo.addEventListener('click',()=>{if(busy||!check())return;session.undo();paint();});
 reset.addEventListener('click',()=>{if(busy||!unlocked()||!win.confirm('Descartar o plano de conciliação e reiniciar a revisão? O banco financeiro permanecerá intacto.'))return;
  try{storage.removeItem(PLAN_KEY);source=storage.getItem(DB);session=createConciliation(source);paint();}catch{say('Não foi possível reiniciar a revisão.');}});
 save.addEventListener('click',async()=>{if(busy||!check()||!session.status().compatible||!win.confirm('Guardar o plano auditado apenas neste dispositivo? Nenhum lançamento será modificado ou enviado.'))return;
  const g=generation;busy=true;save.disabled=true;undo.disabled=true;reset.disabled=true;
  try{await savePlan(storage,source,session);if(g===generation&&check())say('Plano local salvo e auditado. Banco original preservado. Nenhum dado enviado. A migração continua bloqueada.');}catch{if(g===generation)say('Plano não salvo: banco alterado ou armazenamento indisponível.');}finally{if(g===generation){busy=false;reset.disabled=false;undo.disabled=!session?.status().decisions;save.disabled=!session?.status().compatible;}}});
 close.addEventListener('click',clear);
 win?.addEventListener('storage',e=>{if(e.key===DB||e.key===PLAN_KEY)clear();});
 if(win?.MutationObserver&&el('pinLockOverlay'))new win.MutationObserver(()=>{if(!unlocked())clear();}).observe(el('pinLockOverlay'),{attributes:true,attributeFilter:['class']});
}
if(typeof document!=='undefined')bindConciliation(document,localStorage);
