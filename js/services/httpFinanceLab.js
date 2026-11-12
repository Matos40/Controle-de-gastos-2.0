'use strict';
// HTTP estritamente local para laboratorio. Nao expor em producao.
const http=require('node:http');
const {createAuthenticatedBackend}=require('./emulatorAuthBackendLab.js');
const MAX_BODY=128*1024;
function assertLab(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8094'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9100')
  throw Error('Etapa 23 exige Firestore 127.0.0.1:8094 e Auth 127.0.0.1:9100');
}
function createHttpLab(db,auth){
 assertLab();
 const backend=createAuthenticatedBackend(db,auth);
 const routes={'/v1/initialize':'initialize','/v1/submit':'submit','/v1/audit':'audit'};
 return http.createServer(async(req,res)=>{
  const reply=(status,body)=>{
   if(res.writableEnded)return;
   res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'});
   res.end(JSON.stringify(body));
  };
  const action=routes[req.url];
  if(req.method!=='POST'||!action)return reply(404,{error:'not_found'});
  if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')
   return reply(415,{error:'unsupported_media_type'});
  const header=req.headers.authorization||'';
  if(!/^Bearer [^\s]+$/.test(header))return reply(401,{error:'unauthorized'});
  let bytes=0,chunks=[];
  try{
   for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>MAX_BODY)return reply(413,{error:'payload_too_large'});
    chunks.push(chunk);
   }
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!data||typeof data!=='object'||Array.isArray(data))return reply(400,{error:'invalid_json'});
   if(action==='initialize'&&(!data.snapshot||typeof data.snapshot!=='object'))
    return reply(400,{error:'invalid_snapshot'});
   if(action==='submit'&&(!data.operation||typeof data.operation!=='object'))
    return reply(400,{error:'invalid_operation'});
   if(action==='audit'&&Object.keys(data).length!==0)
    return reply(400,{error:'unexpected_fields'});
   const token=header.slice(7);
   // Autenticacao SEMPRE antes de qualquer operacao financeira.
   const result=await backend[action](token,action==='initialize'?data.snapshot:
    action==='submit'?data.operation:undefined);
   reply(200,result);
  }catch(e){
   if(e instanceof SyntaxError)return reply(400,{error:'invalid_json'});
   // Erros internos, tokens e detalhes do Firestore nunca sao devolvidos.
   if(/token|autorizad|auth\//i.test(String(e.message)))return reply(401,{error:'unauthorized'});
   reply(422,{error:'operation_rejected'});
  }
 });
}
module.exports={createHttpLab,assertLab};
