import {validatePayload} from './model.mjs';
// No cloud dependency or write. Defaults are only applied in a disposable copy.
export function prepareLocal(raw){
 if(typeof raw!=='string'||raw.length>180000)return {compatible:false,reason:'Banco ausente ou acima do limite de tamanho.'};
 try{
  const parsed=JSON.parse(raw),db=structuredClone(parsed);
  for(const m of Object.values(db.months??{})){
   if(m.deletedInstallmentOrigins===undefined)m.deletedInstallmentOrigins=[];
   if(m.closed===undefined)m.closed=false;
   if(m.closedAt===undefined)m.closedAt=null;
   if(m.budgetLimit===undefined)m.budgetLimit=0;
   if(m.extraIncomes===undefined)m.extraIncomes=[];
  }
  validatePayload(JSON.stringify(db));
  return {compatible:true,payload:JSON.stringify(db),months:Object.keys(db.months).length,entries:Object.values(db.months).reduce((n,m)=>n+m.expenses.length+m.cardExpenses.length+m.extraIncomes.length,0)};
 }catch{return {compatible:false,reason:'Estrutura, parcelas antigas, datas ou limites incompatíveis. O banco original não foi alterado.'};}
}
export function previewLocal(raw){const {payload,...summary}=prepareLocal(raw);return summary;}
export function bindPreview(document,storage){
 const button=document.getElementById('productionV2Preview'),status=document.getElementById('productionV2PreviewStatus');
 if(!button||!status)return;
 button.addEventListener('click',()=>{
  if(document.getElementById('pinLockOverlay')&&!document.getElementById('pinLockOverlay').classList.contains('hidden'))return;
  try{const p=previewLocal(storage.getItem('controle_gastos_multimonth_v3'));status.textContent=p.compatible?'Compatível: '+p.months+' mês(es), '+p.entries+' lançamento(s). Nenhum dado enviado.':p.reason;}
  catch{status.textContent='Não foi possível ler o banco local. Nenhuma alteração realizada.';}
 });
}
if(typeof document!=='undefined')bindPreview(document,localStorage);
