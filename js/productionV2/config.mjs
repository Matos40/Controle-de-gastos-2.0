// Deliberately disabled until production project and rules are verified.
export const PRODUCTION_CONFIG=Object.freeze({enabled:false,firebase:null});
export function requireProductionConfig(config,location){
 if(config?.enabled!==true)throw Error('PRODUCTION_DISABLED');
 const f=config.firebase;
 if(location?.origin!=='https://matos40.github.io'||!['/Controle-de-gastos-2.0/','/Controle-de-gastos-2.0/index.html'].includes(location.pathname))throw Error('PRODUCTION_ORIGIN');
 if(!f||!/^raytech-cg-producao(?:-[a-z0-9]+)?$/.test(f.projectId)||f.authDomain!==f.projectId+'.firebaseapp.com'||![f.apiKey,f.appId,f.messagingSenderId].every(x=>typeof x==='string'&&x.length>0))throw Error('PRODUCTION_CONFIG');
 return Object.freeze({...f});
}
