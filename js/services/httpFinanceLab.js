'use strict';
// HTTP estritamente local para laboratorio. Nao expor em producao.
const http=require('node:http');
const {createAuthenticatedBackend}=require('./emulatorAuthBackendLab.js');
const MAX_BODY=128*1024;
const {validate,HttpInputError}=require('./httpInputValidationLab.js');
const {createHttpGuards}=require('./httpGuardsLab.js');
function assertLab(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8094'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9100')
  throw Error('Etapa 23 exige Firestore 127.0.0.1:8094 e Auth 127.0.0.1:9100');
}
function createHttpLab(db,auth,options={}){
 assertLab();
 const backend=createAuthenticatedBackend(db,auth);
 const guards=options.guards||createHttpGuards();
 const routes={'/v1/initialize':'initialize','/v1/submit':'submit','/v1/audit':'audit'};
 const server=http.createServer(async(req,res)=>{
  let lease=null;
  let timedOut=false;
  req.setTimeout(10000,()=>{
   timedOut=true;
   if(!res.headersSent&&!res.writableEnded){
    res.writeHead(408,{'Content-Type':'application/json; charset=utf-8',
     'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify({error:'request_timeout'}));
   }
  });
  const reply=(status,body)=>{
   if(res.writableEnded||timedOut||res.destroyed)return;
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
   // Encerrado o recebimento: nao expirar uma transacao financeira em execucao.
   req.setTimeout(0);
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   validate(action,data);
   const token=header.slice(7);
   // Limite por credencial apresentada; nao substitui rate limit de borda.
   lease=guards.acquire(token);
   if(!lease.ok)return reply(lease.status,{error:lease.error});
   // Autenticacao SEMPRE antes de qualquer operacao financeira.
   const result=await backend[action](token,action==='initialize'?data.snapshot:
    action==='submit'?data.operation:undefined);
   reply(200,result);
  }catch(e){
   if(e instanceof SyntaxError)return reply(400,{error:'invalid_json'});
   if(e instanceof HttpInputError)return reply(400,{error:e.code});
   // Apenas codigos tipados do Firebase Auth sao tratados como autenticacao.
   if(typeof e?.code==='string'&&e.code.startsWith('auth/'))
    return reply(401,{error:'unauthorized'});
   if(e?.message==='ID token ausente.'||e?.message==='Token sem UID.'||
      e?.message==='Nao autorizado.')return reply(401,{error:'unauthorized'});
   reply(422,{error:'operation_rejected'});
  }finally{
   if(lease?.ok)lease.release();
  }
 });
 // Timeouts de recebimento. Nao cancelar transacoes financeiras em andamento:
 // resposta antecipada poderia ocultar commit bem-sucedido.
 server.headersTimeout=10000;
 server.requestTimeout=15000;
 return server;
}
module.exports={createHttpLab,assertLab};
