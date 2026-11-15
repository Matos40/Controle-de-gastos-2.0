const test=require('node:test'),assert=require('node:assert/strict');
test('PWA-B2-01 official production entry stays disabled; laboratory rejects public origin independently',async()=>{
 const {createProductionSyncSession,createExperimentalSession}=await import('../js/experimentalSync/session.mjs');const {PRODUCTION_CONFIG}=await import('../js/productionV2/config.mjs');
 const location={origin:'https://matos40.github.io',pathname:'/Controle-de-gastos-2.0/',search:''};
 assert.throws(()=>createProductionSyncSession({config:PRODUCTION_CONFIG,location,search:''}),/TRANSFER_DISABLED/);
 assert.throws(()=>createExperimentalSession({origin:location.origin,search:''}),/ISOLATION/);
 const config={...PRODUCTION_CONFIG,syncEnabled:true};
 for(const search of ['?workspace=legacy','?workspace=v2-clean','?workspace=invalid'])assert.throws(()=>createProductionSyncSession({config,location:{...location,search},search}),/TRANSFER_DISABLED/);
 assert.throws(()=>createProductionSyncSession({config,location:{...location,origin:'https://example.com'},search:''}),/ORIGIN/);
});
test('PWA-B2-02 scoped review removal preserves legacy and test records',async()=>{
 const w=await import('../js/productionV2/cleanWorkspace.mjs');const map=new Map();const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const main=w.scopeSyncStorage(storage,'?workspace=v2-main'),trial=w.scopeSyncStorage(storage,'?workspace=v2-clean');
 const k='experimental-sync-review-v1';storage.setItem(k,'legacy');main.setItem(k,'main');trial.setItem(k,'test');main.removeItem(k);assert.equal(main.getItem(k),null);assert.equal(trial.getItem(k),'test');assert.equal(storage.getItem(k),'legacy');
});
