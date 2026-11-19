import {test} from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {readFile,writeFile,cp,mkdtemp,rm} from 'node:fs/promises';import {createServer} from 'node:http';import {createHash} from 'node:crypto';import {tmpdir} from 'node:os';import path from 'node:path';
const root=process.env.RAYTECH_PROD_CANDIDATE;
const sha=b=>createHash('sha256').update(b).digest('hex');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'};
test('four authorized account profiles, compact version, logout and update notice', {timeout:40000},async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'raytech-profiles-'));t.after(()=>rm(dir,{recursive:true,force:true}));await cp(root,dir,{recursive:true});
 const authPath='js/productionV2/smartLoginOfficialAuth.mjs',adapterPath='js/productionV2/firebaseAdapter.mjs';
 const authMock=`export async function openSmartLoginAuth(){let uid=sessionStorage.getItem('fixture-uid'),cb;const role=()=>['owner','admin'].includes(sessionStorage.getItem('fixture-role'))?sessionStorage.getItem('fixture-role'):null;return {currentUid:()=>uid,profile:async()=>sessionStorage.getItem('fixture-role')==='premium'?'premium':'free',role:async()=>role(),access:async()=>({enabled:true,writeEnabled:true}),onSession:fn=>{cb=fn;queueMicrotask(()=>fn(uid?{uid,displayName:'Pessoa Fictícia'}:null));},signIn:async()=>{uid='profile-fixture';sessionStorage.setItem('fixture-uid',uid);cb({uid,displayName:'Pessoa Fictícia'});},signOut:async()=>{uid=null;sessionStorage.removeItem('fixture-uid');cb(null);},watchAccount:()=>()=>{},watchRole:()=>()=>{},admin:()=>({role:async()=>role(),list:async()=>[],audit:async()=>[],monitor:async()=>({unavailable:true})})};}`;
 const adapterMock=`export async function openProductionCloud(){return {currentUid:()=>sessionStorage.getItem('fixture-uid'),onSession:fn=>queueMicrotask(()=>fn({uid:sessionStorage.getItem('fixture-uid')})),approved:async()=>({writeEnabled:false}),read:async()=>null,sha:async()=> 'a'.repeat(64),watchHead:()=>()=>{},send:async()=>{throw Error('FIXTURE_NO_UPLOAD');},confirm:async()=>false};}`;
 await writeFile(path.join(dir,authPath),authMock);await writeFile(path.join(dir,adapterPath),adapterMock);
 const prefix='/Controle-de-gastos-2.0/';const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(!u.pathname.startsWith(prefix))throw Error('scope');const p=path.resolve(dir,decodeURIComponent(u.pathname.slice(prefix.length))||'index.html');if(!p.startsWith(dir+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.statusCode=404;res.end('missing');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port+prefix;
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const role of ['free','premium','admin','owner']){
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:844}});await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());const page=await ctx.newPage();page.setDefaultTimeout(6500);page.on("pageerror",e=>console.log("PAGE",e.message));page.on("console",m=>{if(m.type()==="error")console.log("CONSOLE",m.text())});page.on("response",r=>{if(r.status()>=400)console.log("HTTP",r.status(),r.url())});page.on('dialog',d=>d.accept());await page.goto(base);await page.evaluate(role=>sessionStorage.setItem('fixture-role',role),role);await page.locator('[data-login-enter]').click();await page.waitForFunction(()=>window.productionCleanWorkspaceReady===true&&!document.getElementById('smartAccountApp').hidden);
 const privileged=['admin','owner'].includes(role);
 for(const width of [1280,390]){
 await page.setViewportSize({width,height:844});assert.equal(await page.locator('.v345-account').isVisible(),privileged);assert.equal(await page.locator('#smartAdminOpen').evaluate(e=>e.hidden),!privileged);
 assert.equal(await page.locator('#raytechHeaderVersion').textContent(),'v34.7.4.5');assert.ok(await page.locator('#raytechHeaderVersion').isVisible());
 await page.locator('#incomeBaseHelpToggle').click();assert.ok(await page.locator('#incomeBaseHelp').isVisible());await page.locator('#incomeBaseHelpToggle').click();
 await page.locator('#headerToolsToggleBtn').click();assert.equal(await page.locator('#productionCloudLogout').isVisible(),true);await page.locator('#smartPwaOpen').click();assert.ok(await page.locator('#raytechInstallVersion').isVisible());assert.equal(await page.locator('#raytechInstallVersion').textContent(),'V34.7.4.5');await page.locator('#smartPwaClose').click();await page.evaluate(()=>closeHeaderDrawer());
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('raytech-pwa-state',{detail:{phase:'update-waiting',version:'34.7.4.5'}})));
 assert.ok(await page.locator('#smartPwaNotice').isVisible());await page.locator('#smartPwaNoticeLater').click();assert.equal(await page.locator('#smartPwaNotice').isVisible(),false);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('raytech-pwa-state',{detail:{phase:'ready',version:'34.7.4.5'}})));
 }
 let mocked=0;
 await page.route('https://generativelanguage.googleapis.com/**',route=>{
   const request=route.request();
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-goog-api-key'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   mocked++;
   const json=request.method()==='GET'
     ? {models:[{name:'models/gemini-3.5-flash',supportedGenerationMethods:['generateContent']}]}
     : {candidates:[{content:{parts:[{text:JSON.stringify([{title:'Synthetic invoice',amount:20,category:'compras'}])}]}}]};
   return route.fulfill({status:200,headers,json});
 });
 await page.locator('#headerToolsToggleBtn').click();
 assert.equal(await page.locator('#premiumInvoiceIndicator').evaluate(node=>node.classList.contains('fa-crown')),role==='premium');
 await page.locator('#premiumInvoiceButton').click();
 if(role==='premium'){
   await page.locator('#ocrModal').waitFor({state:'visible'});
   await page.evaluate(()=>{window.raytechStorage.setItem(STORAGE_GEMINI_KEY,'synthetic-only-key');});
   await page.locator('#invoiceFileInput').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(
     'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nr7sAAAAASUVORK5CYII=','base64')});
   await page.locator('#ocrProcessBtn').click();
   const review=page.locator('#geminiReviewOverlay');
   await review.waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>getCurrentMonthData().cardExpenses.length),0);
   await review.getByRole('button',{name:'Importar selecionados'}).click();
   await page.waitForFunction(()=>getCurrentMonthData().cardExpenses.some(item=>item.title==='Synthetic invoice'));
   assert.equal(mocked,2);
 }else{
   await page.locator('#premiumAiNotice').waitFor({state:'visible'});
   assert.equal(await page.locator('#ocrModal').isVisible(),false);
   await page.locator('#premiumAiNoticeClose').click();
   assert.equal(mocked,0);
 }
 if(!privileged){await page.locator('#headerToolsToggleBtn').click();await page.locator('#productionCloudLogout').click();await page.locator('[data-login-enter]').waitFor({state:'visible'});}
 await ctx.close();
 }
});
