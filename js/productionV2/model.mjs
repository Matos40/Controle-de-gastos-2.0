/* Adapted from homologation 4a01326. Production candidate, strict fail-closed compatibility boundary. */
export function blank(ym){return {selectedMonth:ym,months:{[ym]:{salary:0,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[],closed:false,closedAt:null}}};}
export function validatePayload(payload){
  const fail=()=>{throw Error("PRODUCTION_CONTRACT: dados incompatíveis; mantenha o original e revise antes de importar.");};
  const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
  const keys=(x,allowed,required=allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(x,k));
  const ym=x=>typeof x==="string"&&/^(20[0-9]{2})-(0[1-9]|1[0-2])$/.test(x);
  const date=x=>typeof x==="string"&&/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(x);
  const money=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=10000000&&Math.abs(x*100-Math.round(x*100))<0.0001;
  const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
  const name=x=>typeof x==="string"&&x.length<=100&&x.trim().length>0&&!/[\x00-\x1f<>&"'`\\]/.test(x);
  const cat=x=>["moradia","alimentacao","transporte","compras","lazer","saude","investimentos","outros"].includes(x);
  if(typeof payload!=="string"||payload.length>180000)fail();
  const d=JSON.parse(payload);
  if(!keys(d,["selectedMonth","months"])||!ym(d.selectedMonth)||!obj(d.months)||!Object.hasOwn(d.months,d.selectedMonth)||Object.keys(d.months).length>24)fail();
  for(const [month,m] of Object.entries(d.months)){
    if(!ym(month)||!keys(m,["salary","budgetLimit","extraIncomes","expenses","cardExpenses","deletedInstallmentOrigins","closed","closedAt"],["salary","budgetLimit","extraIncomes","expenses","cardExpenses","closed","closedAt"])||!money(m.salary)||!money(m.budgetLimit)||typeof m.closed!=="boolean"||!(m.closedAt===null||(typeof m.closedAt==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.closedAt))))fail();
    for(const k of ["expenses","cardExpenses","extraIncomes"]){if(!Array.isArray(m[k])||m[k].length>200)fail();const seen=new Set();for(const x of m[k]){
      if(!obj(x)||!id(x.id)||seen.has(x.id)||!date(x.date))fail();seen.add(x.id);
      if(k==="expenses"){
        if(!keys(x,["id","title","category","amount","type","date","paid"])||!name(x.title)||!cat(x.category)||!money(x.amount)||!["fixed","one-time"].includes(x.type)||typeof x.paid!=="boolean")fail();
      }else if(k==="extraIncomes"){
        if(!keys(x,["id","description","amount","date"])||!name(x.description)||!money(x.amount))fail();
      }else{
        if(!keys(x,["id","installmentOriginId","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"],["id","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"])||!name(x.title)||!cat(x.category)||typeof x.isInstallment!=="boolean"||typeof x.paid!=="boolean"||!money(x.installmentValue)||!money(x.totalAmount)||!Number.isInteger(x.installments)||!Number.isInteger(x.currentInstallment)||x.installments<1||x.installments>120||x.currentInstallment<1||x.currentInstallment>x.installments||(x.isInstallment?(!id(x.installmentOriginId)||x.installments<2):(x.installments!==1||x.currentInstallment!==1))||Math.abs(x.totalAmount-x.installmentValue*x.installments)>0.011)fail();
      }
    }}
    const tomb=m.deletedInstallmentOrigins??[];if(!Array.isArray(tomb)||tomb.length>500||new Set(tomb).size!==tomb.length||!tomb.every(x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}:[1-9][0-9]{0,2}$/.test(x)))fail();
  }return d;
}
export function validId(x){return typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);}
export function canonical(x){if(x===null||typeof x!=="object")return JSON.stringify(x);if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";}
export function mergeThreeWay(basePayload,localPayload,remotePayload){
 const b=validatePayload(basePayload),l=validatePayload(localPayload),r=validatePayload(remotePayload),out=JSON.parse(remotePayload),conflicts=[];
 const eq=(a,b)=>canonical(a??null)===canonical(b??null),keys=x=>Object.keys(x).sort(),fail=path=>conflicts.push(path);
 const choose=(a,x,y,path)=>{if(eq(x,a))return y;if(eq(y,a)||eq(x,y))return x;fail(path);return y;};
 if(!eq(keys(b.months),keys(l.months))||!eq(keys(b.months),keys(r.months)))return {payload:null,conflicts:["Estrutura de meses mudou"]};
 const groups=db=>{const map=new Map();for(const [ym,m] of Object.entries(db.months)){for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId,arr=map.get(k)??[];arr.push([ym,c]);map.set(k,arr);}for(const t of m.deletedInstallmentOrigins??[]){const k=t.split(":")[0],arr=map.get(k)??[];arr.push([ym,t]);map.set(k,arr);}}for(const arr of map.values())arr.sort((x,y)=>canonical(x).localeCompare(canonical(y)));return map;};
 const [gb,gl,gr]=[b,l,r].map(groups);for(const k of new Set([...gb.keys(),...gl.keys(),...gr.keys()])){const a=gb.get(k)??[],x=gl.get(k)??[],y=gr.get(k)??[];if(!eq(a,x)&&!eq(a,y)&&!eq(x,y))fail("Série de parcelas "+k);}
 for(const ym of keys(b.months)){
  const a=b.months[ym],x=l.months[ym],y=r.months[ym],m=out.months[ym];
  if(a.closed!==x.closed||a.closed!==y.closed||a.closedAt!==x.closedAt||a.closedAt!==y.closedAt){fail(ym+" · fechamento de mês");continue;}
  if(a.closed&&(!eq(a,x)||!eq(a,y))){fail(ym+" · mês fechado");continue;}
  for(const k of ["salary","budgetLimit"])m[k]=choose(a[k],x[k],y[k],ym+" · "+k);
  const ta=new Set(a.deletedInstallmentOrigins??[]),tl=new Set(x.deletedInstallmentOrigins??[]),tr=new Set(y.deletedInstallmentOrigins??[]);
  if([...ta].some(t=>!tl.has(t)||!tr.has(t)))fail(ym+" · remoção de marca de exclusão");
  const tomb=new Set([...tr,...tl]);if(tomb.size||Object.hasOwn(m,"deletedInstallmentOrigins"))m.deletedInstallmentOrigins=[...tomb];
  for(const k of ["expenses","cardExpenses","extraIncomes"]){
   const [aa,xx,yy]=[a,x,y].map(m=>new Map(m[k].map(i=>[i.id,i])));m[k]=[];
   for(const id of new Set([...yy.keys(),...xx.keys(),...aa.keys()])){
    const av=aa.get(id),lv=xx.get(id),rv=yy.get(id);
    if(!av&&/^(exp_sync_|exp_inherited_|card_sync_|card_inherited_)/.test(id))fail(ym+" · lançamento herdado "+id);
    const v=choose(av,lv,rv,ym+" · "+k+" · "+id);if(v!==undefined)m[k].push(v);
    if(k==="cardExpenses"&&av?.isInstallment&&!v&&!tomb.has(av.installmentOriginId+":"+av.currentInstallment))fail(ym+" · exclusão de parcela sem marca "+id);
   }
  }
  const origins=new Set();for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId+":"+c.currentInstallment;if(origins.has(k)||tomb.has(k))fail(ym+" · parcela duplicada ou excluída "+k);origins.add(k);}
 }
 if(conflicts.length)return {payload:null,conflicts:[...new Set(conflicts)]};
 const payload=JSON.stringify(out);try{validatePayload(payload);}catch{return {payload:null,conflicts:["Limites ou integridade financeira incompatíveis"]};}
 return {payload,conflicts:[]};
}
