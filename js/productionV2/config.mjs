// Controlled release: Controlled V2 synchronization; explicit account authorization and local consent required.
export const PRODUCTION_CONFIG=Object.freeze({enabled:true,syncEnabled:true,firebase:Object.freeze({
  "apiKey": "AIzaSyCLmwjAC-tuKwSusDNfnZo83a-2K0ZoP3M",
  "authDomain": "raytech-cg-producao.firebaseapp.com",
  "projectId": "raytech-cg-producao",
  "storageBucket": "raytech-cg-producao.firebasestorage.app",
  "messagingSenderId": "609408493250",
  "appId": "1:609408493250:web:3dd0a5d8ed9df408367d5b"
})});
export function requireProductionConfig(config,location){
 if(config?.enabled!==true)throw Error('PRODUCTION_DISABLED');
 const f=config.firebase;
 if(location?.origin!=='https://matos40.github.io'||!['/Controle-de-gastos-2.0/','/Controle-de-gastos-2.0/index.html'].includes(location.pathname))throw Error('PRODUCTION_ORIGIN');
 if(!f||!/^raytech-cg-producao(?:-[a-z0-9]+)?$/.test(f.projectId)||f.authDomain!==f.projectId+'.firebaseapp.com'||![f.apiKey,f.appId,f.messagingSenderId].every(x=>typeof x==='string'&&x.length>0))throw Error('PRODUCTION_CONFIG');
 return Object.freeze({...f});
}
