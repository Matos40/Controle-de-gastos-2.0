import {mountSmartLoginView} from './smartLoginView.mjs';
import {createSmartLoginGate} from './smartLoginGate.mjs';
import {openSmartLoginAuth} from './smartLoginAuth.mjs';
const root=document.getElementById('smartLogin');
let auth=null,unsubscribe=null;
const view=mountSmartLoginView(root,{signIn:async()=>{if(!auth)throw Error('AUTH_NOT_READY');await auth.signIn();},signOut:async()=>{if(!auth)throw Error('AUTH_NOT_READY');await auth.signOut();},onRetry:()=>start()});
const gate=createSmartLoginGate({onState:state=>view.paint(state)});
async function start(){
 view.paint({phase:'checking'});
 try{
  unsubscribe?.();auth=await openSmartLoginAuth();
  unsubscribe=auth.onSession(user=>{void gate.observe(user,async()=>false);},()=>view.paint({phase:'error'}));
 }catch{view.paint({phase:'error'});}
}
void start();
