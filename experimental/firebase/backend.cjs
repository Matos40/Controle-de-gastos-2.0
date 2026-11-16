'use strict';
const C=require('../diff03/shared/contracts.cjs');
const {createRepository,prepareMigration,activateCopy}=require('../phase2/repository.cjs');
const {validUid}=require('./store.cjs');
const reject=code=>({status:'rejected',code});
const month=(salary=1000)=>({salary,budgetLimit:0,expenses:[],cardExpenses:[],extraIncomes:[],deletedInstallmentOrigins:[],closed:false,closedAt:null});
const fixture=()=>({selectedMonth:'2026-11',months:{'2026-11':month()}});
function createHandlers(store){
 function handler(fn){
  return async request=>{
   const uid=request?.auth?.uid;
   if(!validUid(uid))return reject('UNAUTHENTICATED');
   const data=request.data;
   if(!C.plain(data)||!C.json(data)||data.schemaVersion!==1)return reject('INVALID_PROTOCOL');
   if(Buffer.byteLength(JSON.stringify(data),'utf8')>32000)return reject('REQUEST_TOO_LARGE');
   try{return await fn(createRepository(store,uid),uid,data);}
   catch(_){return {status:'unknown',code:'REMOTE_RESULT_UNKNOWN'};}
  };
 }
 const exact=(d,...keys)=>Object.keys(d).every(k=>['schemaVersion',...keys].includes(k));
 const read=handler(async(repo,uid,d)=>{if(!exact(d))return reject('INVALID_PROTOCOL');const snapshot=await repo.read();return snapshot?{status:'success',snapshot}:{status:'absent'};});
 const initialize=handler(async(repo,uid,d)=>{
  if(!exact(d,'confirmation')||d.confirmation!==true)return reject('CONFIRMATION_REQUIRED');
  // Synthetic data ONLY; client cannot pass a real backup or choose destination uid.
  return activateCopy(store,await prepareMigration(fixture(),uid),uid,true);
 });
 const preview=handler(async(repo,uid,d)=>exact(d,'preview')&&C.plain(d.preview)?repo.preview(d.preview):reject('INVALID_PROTOCOL'));
 const command=handler(async(repo,uid,d)=>{
  if(!exact(d,'command')||!C.plain(d.command)||d.command.actorId!==uid)return reject('INVALID_PROTOCOL');
  const q=d.command,p=q.payload;
  // Initial emulator scope: salary, paid state, extra income, expenses,
  // cards and preview-confirmed month/reconciliation operations.
  // The repository executes actual financial rules, not client snapshots.
  if(!C.plain(p)||!C.id(q.operationId)||q.schemaVersion!==1||!C.revision(q.expectedRevision))return reject('INVALID_COMMAND');
  const fields=(o,required,optional=[])=>C.plain(o)&&required.every(k=>Object.hasOwn(o,k))&&Object.keys(o).every(k=>[...required,...optional].includes(k));
  if(!fields(q,['schemaVersion','actorId','operationId','commandType','expectedRevision','payload']))return reject('INVALID_COMMAND');
  const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000000;
  const str=x=>typeof x==='string'&&x.length<=240;
  const id=x=>C.id(x)&&!['constructor','prototype','__proto__'].includes(x);
  const ym=C.month;
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
  let ok=false;
  switch(q.commandType){
   case 'SET_SALARY':ok=fields(p,['month','amountCents'])&&ym(p.month)&&cents(p.amountCents);break;
   case 'SET_EXPENSE_PAID':case 'SET_CARD_PAID':ok=fields(p,['month','id','paid'])&&ym(p.month)&&id(p.id)&&typeof p.paid==='boolean';break;
   case 'CREATE_EXTRA_INCOME':ok=fields(p,['month','item'])&&ym(p.month)&&fields(p.item,['id','description','amountCents'],['date'])&&id(p.item.id)&&str(p.item.description)&&cents(p.item.amountCents)&&(!Object.hasOwn(p.item,'date')||date(p.item.date));break;
   case 'DELETE_EXTRA_INCOME':ok=fields(p,['month','id'])&&ym(p.month)&&id(p.id);break;
   case 'DELETE_EXPENSE':case 'DELETE_CARD_EXPENSE':ok=fields(p,['month','id','scope'])&&ym(p.month)&&id(p.id)&&p.scope==='current';break;
   case 'UPSERT_EXPENSE':ok=fields(p,['month','item'])&&ym(p.month)&&fields(p.item,['id','title','amountCents','type'],['paid','date','category'])&&id(p.item.id)&&str(p.item.title)&&p.item.title.trim().length>0&&cents(p.item.amountCents)&&['fixed','one-time'].includes(p.item.type)&&(!Object.hasOwn(p.item,'paid')||typeof p.item.paid==='boolean')&&(!Object.hasOwn(p.item,'date')||date(p.item.date))&&(!Object.hasOwn(p.item,'category')||str(p.item.category));break;
   case 'UPSERT_CARD_EXPENSE':ok=fields(p,['month','item'])&&ym(p.month)&&fields(p.item,['id','title','amountCents'],['paid','date','category','isInstallment','installments','currentInstallment','installmentOriginId'])&&id(p.item.id)&&str(p.item.title)&&p.item.title.trim().length>0&&cents(p.item.amountCents)&&(!Object.hasOwn(p.item,'paid')||typeof p.item.paid==='boolean')&&(!Object.hasOwn(p.item,'date')||date(p.item.date))&&(!Object.hasOwn(p.item,'category')||str(p.item.category))&&(!Object.hasOwn(p.item,'isInstallment')||typeof p.item.isInstallment==='boolean')&&(!Object.hasOwn(p.item,'installments')||Number.isSafeInteger(p.item.installments)&&p.item.installments>=1&&p.item.installments<=120)&&(!Object.hasOwn(p.item,'currentInstallment')||Number.isSafeInteger(p.item.currentInstallment)&&p.item.currentInstallment>=1&&p.item.currentInstallment<=120)&&(!Object.hasOwn(p.item,'installmentOriginId')||id(p.item.installmentOriginId));break;
   case 'CREATE_MONTH':ok=fields(p,['month','previewId','confirmation'])&&ym(p.month)&&id(p.previewId)&&p.confirmation===true;break;
   case 'RESOLVE_RECONCILIATION':ok=fields(p,['pendingId','decision','reason','previewId','confirmation'])&&id(p.pendingId)&&id(p.previewId)&&C.actions.includes(p.decision)&&typeof p.reason==='string'&&p.reason.length<=2048&&p.confirmation===true;break;
  }
  if(!ok)return reject('INVALID_COMMAND');
  return repo.execute(q);
 });
 const receipt=handler(async(repo,uid,d)=>{if(!exact(d,'operationId')||!C.id(d.operationId))return reject('INVALID_PROTOCOL');const s=await repo.read();const item=s?.receipts.find(x=>x.operationId===d.operationId);return item?{status:'found',receipt:item}:{status:'absent'};});
 return {read,initialize,preview,command,receipt};
}
module.exports={createHandlers};
