const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const {join}=require('node:path');
const code=readFileSync(join(__dirname,'../sw.js'),'utf8');
function boot({online=true,network=async()=>new Response('fresh'),hit='current',put=async()=>{},open,timer=setTimeout,cancel=clearTimeout}={}){
 const listeners={},calls={open:[],network:0,global:0,removed:0};
 const cache={match:async()=>hit==null?undefined:new Response(hit),put};
 runInNewContext(code,{Request,Response,URL,AbortController,setTimeout:timer,clearTimeout:cancel,caches:{open:n=>{calls.open.push(n);return open?open():Promise.resolve(cache);},match:async()=>{calls.global++;return new Response('old');},delete:async()=>{calls.removed++;}},fetch:(...a)=>{calls.network++;return network(...a);},self:{navigator:{onLine:online},location:{origin:'https://example.test'},registration:{scope:'https://example.test/app/'},clients:{claim:async()=>{}},addEventListener:(n,f)=>listeners[n]=f}});
 function dispatch(url='https://example.test/app/',mode='navigate'){
  let response,lifetime;listeners.fetch({request:{url,mode,method:'GET'},respondWith:p=>response=p,waitUntil:p=>lifetime=p});return {response,lifetime};
 }
 return {dispatch,calls,listeners};
}
test('offline navigation uses current cache exclusively',async()=>{
 const w=boot({online:false});assert.equal(await(await w.dispatch().response).text(),'current');assert.deepEqual(w.calls.open,['controle-gastos-shell-v29-interface']);assert.equal(w.calls.network,0);assert.equal(w.calls.global,0);
});
test('stalled connection uses current shell within deadline',async()=>{
 let signal,ms;const w=boot({network:(_,opts)=>{signal=opts.signal;return new Promise(()=>{});},timer:(fn,d)=>{ms=d;queueMicrotask(fn);return 1;},cancel:()=>{}});
 assert.equal(await(await w.dispatch().response).text(),'current');assert.equal(ms,3500);assert.equal(signal.aborted,true);
});
test('asset cache clone is made before body consumption',async()=>{
 let resolveCache,saved;const gate=new Promise(r=>resolveCache=r),response=new Response('fresh');
 const w=boot({network:async()=>response,open:()=>gate});const e=w.dispatch('https://example.test/app/css/styles.css','cors');
 await Promise.resolve();await Promise.resolve();assert.equal(await response.text(),'fresh');resolveCache({match:async()=>undefined,put:async(_,copy)=>{saved=await copy.text();}});
 assert.equal(await e.response,response);await e.lifetime;assert.equal(saved,'fresh');
});
test('cache errors preserve network response and offline hit',async()=>{
 const w=boot({hit:null,put:async()=>{throw Error('quota');}});const e=w.dispatch('https://example.test/app/css/styles.css','cors');assert.equal(await(await e.response).text(),'fresh');await e.lifetime;
 const off=boot({network:async()=>{throw Error('offline');}});const f=off.dispatch('https://example.test/app/css/styles.css','cors');assert.equal(await(await f.response).text(),'current');await f.lifetime;
});
test('scope isolation and activation never delete other caches',async()=>{
 const w=boot();assert.equal(w.dispatch('https://example.test/other/index.html').response,undefined);let promise;w.listeners.activate({waitUntil:p=>promise=p});await promise;assert.equal(w.calls.removed,0);
});
test('failed network does not mix old HTML versions',async()=>{
 const w=boot({hit:null,network:async()=>{throw Error('offline');}});assert.equal((await w.dispatch().response).type,'error');assert.equal(w.calls.global,0);
});
