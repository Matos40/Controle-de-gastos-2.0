let installEvent,registration,phase='preparing';
const snapshot=()=>Object.freeze({version:'34.6.7',phase,canInstall:!!installEvent,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true});
const publish=next=>{phase=next;window.dispatchEvent(new CustomEvent('raytech-pwa-state',{detail:snapshot()}));};
window.raytechPwa=Object.freeze({state:snapshot,async install(){if(!installEvent)return {outcome:'unavailable'};const event=installEvent;installEvent=null;try{await event.prompt();return await event.userChoice;}finally{publish(phase);}},async checkUpdate(){if(registration&&navigator.onLine)await registration.update();return snapshot();}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;publish(phase);});
window.addEventListener('appinstalled',()=>{installEvent=null;publish(phase);});
const official=location.origin==='https://matos40.github.io'&&location.pathname.startsWith('/Controle-de-gastos-2.0/');
const local=['localhost','127.0.0.1'].includes(location.hostname);
if((official||local)&&navigator.serviceWorker){try{registration=await navigator.serviceWorker.register(new URL('../../sw.js',import.meta.url),{updateViaCache:'none'});const refresh=()=>publish(registration.waiting?'update-waiting':registration.active?.state==='activated'?'ready':'preparing');const watch=()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>worker.state==='redundant'?publish(registration.active?'update-failed':'unavailable'):refresh());refresh();};registration.addEventListener('updatefound',watch);navigator.serviceWorker.addEventListener('controllerchange',refresh);watch();}catch{publish('unavailable');}}else publish('unavailable');
