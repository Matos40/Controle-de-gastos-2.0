'use strict';
const R=require('../../experimental/phase2/repository.cjs');
const {createSession}=require('../../experimental/phase2/sync.cjs');
const uid='synthetic-user-a',other='synthetic-user-b';
const month=(salary=1000)=>({salary,budgetLimit:1200,expenses:[{id:'fixed-1',title:'Synthetic internet',type:'fixed',amount:100,paid:true}],cardExpenses:[{id:'card-1',title:'Synthetic computer',installmentOriginId:'origin-1',isInstallment:true,installments:5,currentInstallment:2,installmentValue:50,paid:true}],extraIncomes:[],deletedInstallmentOrigins:[],closed:false,closedAt:null});
const database=()=>({selectedMonth:'2026-11',months:{'2026-11':month()},customLegacyField:{retained:true}});
async function setup(account=uid,db=database(),store=R.createStore()){const plan=await R.prepareMigration(db,account),result=await R.activateCopy(store,plan,account,true);if(result.status!=='initialized')throw Error(JSON.stringify(result));return {store,plan,repo:R.createRepository(store,account),db};}
const cmd=(operationId,commandType,payload,expectedRevision=0,actorId=uid)=>({schemaVersion:1,actorId,operationId,commandType,expectedRevision,payload});
const salary=(id,amountCents,revision=0,actorId=uid)=>cmd(id,'SET_SALARY',{month:'2026-11',amountCents},revision,actorId);
async function createMonth(repo,target='2027-01',revision=0,actorId=uid){const p=await repo.preview({kind:'CREATE_MONTH',targetMonth:target,expectedRevision:revision});if(p.status!=='preview')throw Error(JSON.stringify(p));return cmd('month-'+target,'CREATE_MONTH',{month:target,previewId:p.previewId,confirmation:true},revision,actorId);}
async function resolve(repo,pendingId,decision='DISMISS',revision=1,actorId=uid){const reason='Synthetic reason';const p=await repo.preview({kind:'RESOLVE_RECONCILIATION',pendingId,decision,reason,expectedRevision:revision});if(p.status!=='preview')throw Error(JSON.stringify(p));return cmd('decision-'+revision,'RESOLVE_RECONCILIATION',{pendingId,decision,reason,previewId:p.previewId,confirmation:true},revision,actorId);}
function mockDevice(store,deviceId,account=uid,enabled=true){
 const auth={currentUser:null};let login=account;
 const sdk={GoogleAuthProvider:class{},async signInWithPopup(a){a.currentUser={uid:login};return {user:a.currentUser};},async signOut(a){a.currentUser=null;}};
 const device=createSession({enabled,sdk,auth,store,deviceId});
 return {device,auth,switchAccount(account){login=account;}};
}
module.exports={R,uid,other,month,database,setup,cmd,salary,createMonth,resolve,mockDevice};
