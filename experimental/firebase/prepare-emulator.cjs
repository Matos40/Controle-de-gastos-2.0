'use strict';
// Assemble a disposable self-contained functions project OUTSIDE app code.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),target=path.join(__dirname,'.emulator-functions');
fs.mkdirSync(target,{recursive:true});
for(const dir of ['experimental/diff03','experimental/phase2','js/services']){
 fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true});
}
for(const name of ['store.cjs','backend.cjs','functions.cjs']){
 const dest=path.join(target,'experimental/firebase',name);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(__dirname,name),dest);
}
fs.writeFileSync(path.join(target,'package.json'),JSON.stringify({name:'raytech-emulator-functions',private:true,main:'experimental/firebase/functions.cjs',engines:{node:'22'},dependencies:{'firebase-admin':'13.6.0','firebase-functions':'6.4.0'}},null,2));
