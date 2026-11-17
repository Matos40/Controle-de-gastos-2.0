import {mountSmartLoginView} from './smartLoginView.mjs';
const root=document.getElementById('smartLogin');
const view=mountSmartLoginView(root,{signIn:async()=>{root.querySelector('[data-login-status]').textContent='Prévia visual. A autenticação real ainda não está conectada.';},signOut:async()=>view.paint({phase:'signed-out'})});
view.paint({phase:'signed-out'});
