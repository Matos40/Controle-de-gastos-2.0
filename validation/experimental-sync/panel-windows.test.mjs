import {test} from 'node:test';
import assert from 'node:assert/strict';
import {servePanel} from './panel-server.mjs';

// Run on a native Windows runner, not a simulated Windows path on Linux.
// Starting the actual server exercises the esbuild entry-point resolution
// that failed when URL.pathname produced /C:/... on the user's PC.
// No Firebase instance, credentials or financial storage is used.
test('B213 native Windows panel build and loopback HTTP smoke test',async t=>{
 assert.equal(process.platform,'win32');
 const panel=await servePanel(0);
 t.after(()=>panel.close());
 assert.match(panel.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
 assert.equal(panel.server.address().address,'127.0.0.1');
 const html=await fetch(panel.origin+'/');
 assert.equal(html.status,200);
 assert.match(html.headers.get('content-type'),/^text\/html/);
 const body=await html.text();
 assert.match(body,/\/panel\.js/);
 const script=await fetch(panel.origin+'/panel.js');
 assert.equal(script.status,200);
 assert.match(script.headers.get('content-type'),/^text\/javascript/);
 assert.ok((await script.text()).length>1000);
 const unknown=await fetch(panel.origin+'/does-not-exist');
 assert.equal(unknown.status,404);
 await unknown.text();
});
