const prefix='controle-gastos-shell-v34-6-5-production:';
const cacheName=prefix+BUILD.id;
const scope=new URL(self.registration.scope);
const inventory=new Map(BUILD.files);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const key=p=>new URL(p,scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(cacheName);let cursor=0;const entries=[...inventory];
 const results=await Promise.allSettled(Array.from({length:8},async()=>{while(cursor<entries.length){const [path,expected]=entries[cursor++],url=key(path);const res=await fetch(url,{cache:'reload',credentials:'omit',redirect:'error'});if(!res.ok||await digest(await res.clone().arrayBuffer())!==expected)throw Error('PWA_INCOMPLETE_BUILD');await cache.put(url,res);}}));
 if(results.some(r=>r.status==='rejected')){await caches.delete(cacheName);throw Error('PWA_INCOMPLETE_BUILD');}
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;const rel=decodeURIComponent(url.pathname.slice(scope.pathname.length));const file=req.mode==='navigate'&&['','index.html'].includes(rel)?'index.html':rel;if(!inventory.has(file))return;event.respondWith((async()=>{const cache=await caches.open(cacheName);return await cache.match(key(file))||new Response('Recursos locais indisponíveis. Reconecte para preparar o aplicativo.',{status:503});})());});
