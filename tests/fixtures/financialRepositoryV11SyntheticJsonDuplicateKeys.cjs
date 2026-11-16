'use strict';
// Strict duplicate-object-key detection on synthetic JSON text only; no I/O.
function hasDuplicateKeys(text){
 let i=0;
 const ws=()=>{while(/[\x20\t\r\n]/.test(text[i]||'!'))i++};
 function str(){
  const start=i++;
  while(i<text.length){
   if(text[i]==='\\'){i+=2;continue}
   if(text[i++]==='"')return JSON.parse(text.slice(start,i));
  }
  throw Error('INVALID_JSON');
 }
 function value(depth=0){
  if(depth>32)throw Error('DEPTH_LIMIT');
  ws();const c=text[i];
  if(c==='"'){str();return false}
  if(c==='{'){
   i++;ws();const keys=new Set();let duplicate=false;
   if(text[i]==='}'){i++;return false}
   while(i<text.length){
    ws();if(text[i]!=='"')throw Error('INVALID_JSON');
    const k=str();if(keys.has(k))duplicate=true;keys.add(k);
    ws();if(text[i++]!==':')throw Error('INVALID_JSON');
    duplicate=value(depth+1)||duplicate;ws();
    if(text[i]==='}'){i++;return duplicate}
    if(text[i++]!==',')throw Error('INVALID_JSON');
   }
   throw Error('INVALID_JSON');
  }
  if(c==='['){
   i++;ws();let duplicate=false;
   if(text[i]===']'){i++;return false}
   while(i<text.length){
    duplicate=value(depth+1)||duplicate;ws();
    if(text[i]===']'){i++;return duplicate}
    if(text[i++]!==',')throw Error('INVALID_JSON');
   }
   throw Error('INVALID_JSON');
  }
  const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
  if(!match)throw Error('INVALID_JSON');i+=match[0].length;return false;
 }
 const duplicate=value();ws();if(i!==text.length)throw Error('INVALID_JSON');return duplicate;
}
module.exports=Object.freeze({hasDuplicateKeys});
