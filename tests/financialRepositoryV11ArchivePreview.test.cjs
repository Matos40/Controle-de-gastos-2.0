const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../js/services/financialRepositoryV11ArchivePreview.js');
const receipt=id=>({operationId:id,expectedRevision:0,nextRevision:1,databaseDigest:'a'.repeat(64)});
test('arquivamento atomico preserva indice e impede reutilizacao de ID',async()=>{
 const driver=A.createMemoryDriver(),archive=A.create(driver);
 await archive.initialize();
 assert.equal((await archive.append(receipt('a'))).status,'appended');
 assert.deepEqual(await archive.archiveActive(),{status:'archived',count:1});
 assert.equal((await archive.append(receipt('a'))).code,'OPERATION_ID_REUSED');
 assert.equal((await archive.append(receipt('b'))).status,'appended');
 const snapshot=await archive.read();
 assert.equal(snapshot.archives.length,1);assert.equal(snapshot.active.length,1);
 assert.deepEqual(Object.keys(snapshot.index).sort(),['a','b']);
});
test('concorrencia entre instancias nao duplica IDs',async()=>{
 const driver=A.createMemoryDriver(),a=A.create(driver),b=A.create(driver);
 await a.initialize();
 const outcomes=await Promise.all([a.append(receipt('same')),b.append(receipt('same'))]);
 assert.deepEqual(outcomes.map(x=>x.status).sort(),['appended','conflict']);
 assert.equal((await a.read()).active.length,1);
});
test('abort simulado conserva indice e recibos sem arquivo parcial',async()=>{
 const base=A.createMemoryDriver(),normal=A.create(base);await normal.initialize();
 await normal.append(receipt('a'));
 let abort=true;
 const failing=A.create({transact:fn=>base.transact(current=>{
   const result=fn(current);
   if(abort&&result&&result.response&&result.response.status==='archived'){
    abort=false;throw Error('TX_ABORT');
   }
   return result;
 })});
 await assert.rejects(()=>failing.archiveActive(),/TX_ABORT/);
 assert.equal((await normal.read()).archives.length,0);
 assert.equal((await normal.read()).active.length,1);
 assert.equal((await normal.archiveActive()).status,'archived');
});
test('backup exportado verifica integridade e permite restauracao isolada',async()=>{
 const store=A.create(A.createMemoryDriver());await store.initialize();
 await store.append(receipt('first'));await store.archiveActive();
 await store.append(receipt('second'));
 const backup=await store.exportBackup();
 const restored=await store.verifyBackup(backup);
 assert.equal(restored.archives.length,1);
 assert.equal(restored.active.length,1);
 assert.deepEqual(Object.keys(restored.index).sort(),['first','second']);
 backup.archiveState.active[0].operationId='corrupted';
 await assert.rejects(()=>store.verifyBackup(backup),/BACKUP_CHECKSUM_MISMATCH/);
});
test('arquivo adulterado e indice faltante sao rejeitados',async()=>{
 const driver=A.createMemoryDriver(),store=A.create(driver);await store.initialize();
 await store.append(receipt('a'));await store.archiveActive();
 const state=driver.inspect();state.archives[0].items[0].operationId='tampered';
 await assert.rejects(()=>A.create(A.createMemoryDriver(state)).read(),/ARCHIVE_CHECKSUM_MISMATCH/);
 const missing=driver.inspect();delete missing.index.a;
 await assert.rejects(()=>A.create(A.createMemoryDriver(missing)).read(),/INDEX_MISMATCH/);
});
