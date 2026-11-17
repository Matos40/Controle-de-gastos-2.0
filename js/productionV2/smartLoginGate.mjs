// Smart Login V33.1 — isolated authorization gate, no financial storage access.
export function createSmartLoginGate({onState=()=>{}}={}){
 let state=Object.freeze({phase:'checking',uid:null}),generation=0;
 const publish=(phase,uid=null)=>{state=Object.freeze({phase,uid});onState(state);return state;};
 return Object.freeze({
  state:()=>state,
  async observe(user,verifyWorkspace){
   const token=++generation;
   if(!user?.uid)return publish('signed-out');
   const uid=user.uid;
   publish('checking-workspace');
   try{
    const result=await verifyWorkspace(uid);
    if(token!==generation)return state;
    return result===true?publish('ready',uid):publish('workspace-blocked');
   }catch{
    return token===generation?publish('workspace-blocked'):state;
   }
  },
  lock(){generation++;return publish('signed-out');},
  permits(uid){return state.phase==='ready'&&state.uid===uid;}
 });
}
