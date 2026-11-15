import {initializeTestEnvironment} from '@firebase/rules-unit-testing';import {doc,setDoc} from 'firebase/firestore';import {readFileSync} from 'node:fs';import {PROJECT} from './adapter.mjs';import {servePanel} from './panel-server.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8081')throw Error('EMULATOR_REQUIRED');
const env=await initializeTestEnvironment({projectId:PROJECT,firestore:{rules:readFileSync(new URL('../../docs/firestore-sync-experimental.rules',import.meta.url),'utf8')}});
await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'raytechProductionAccessV2','panel-owner'),{enabled:true,writeEnabled:true}));
const panel=await servePanel(8787);console.log('Laboratório fictício: '+panel.origin);for(const sig of ['SIGINT','SIGTERM'])process.once(sig,async()=>{panel.close();await env.cleanup();process.exit(0);});
