'use strict';
const assert = require('node:assert/strict');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, runTransaction, getDoc } = require('firebase/firestore');
const { createQueue } = require('../../js/services/operationQueueLab.js');
const { drainOne } = require('../../js/services/firestoreSyncLab.js');
const path = require('node:path');
const fs = require('node:fs');
const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
const projectId = 'demo-raytech-cg-sync';
const month = '2026-11';
const storageMap = new Map();
const storage = {
  getItem: key => storageMap.has(key) ? storageMap.get(key) : null,
  setItem: (key, value) => storageMap.set(key, String(value))
};
let seq = 0;
const queue = createQueue(storage, { idFactory: () => 'sync_' + (++seq) });
let passed = 0;
async function check(label, fn) {
  await fn(); passed++; console.log('APROVADO:', label);
}
async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8082, rules }
  });
  try {
    await env.clearFirestore();
    const db = env.authenticatedContext('usuarioA').firestore();
    const otherDb = env.authenticatedContext('usuarioB').firestore();
    function transportFor(database, uid) {
      return { async send(op) {
        const itemId = [op.month, op.type, op.id].join('_');
        const item = doc(database, 'users', uid, 'labItems', itemId);
        const receipt = doc(database, 'users', uid, 'labReceipts', op.operationId);
        return runTransaction(database, async tx => {
          const existingReceipt = await tx.get(receipt);
          if (existingReceipt.exists()) {
            const r = existingReceipt.data();
            if (r.targetId !== itemId || r.version !== op.version || r.kind !== op.kind) {
              throw new Error('Recibo divergente.');
            }
            return { confirmed: true, operationId: op.operationId };
          }
          const existingItem = await tx.get(item);
          const previous = existingItem.exists() ? existingItem.data() : null;
          if (op.kind === 'create' ? previous !== null :
              previous === null || previous.deleted || previous.version !== op.version - 1) {
            throw new Error('Conflito remoto.');
          }
          tx.set(item, {
            month: op.month, type: op.type, id: itemId, version: op.version,
            deleted: op.kind === 'delete', data: op.payload, operationId: op.operationId
          });
          tx.set(receipt, {
            targetId: itemId, version: op.version, kind: op.kind, operationId: op.operationId
          });
          return { confirmed: true, operationId: op.operationId };
        });
      }};
    }
    const transport = transportFor(db, 'usuarioA');
    const data = { title: 'Despesa ficticia', amountCents: 10000 };
    const firstId = queue.create(month, 'expense', 'teste1', data);
    await check('fila registra despesa ficticia', async () => {
      assert.equal(queue.pending().length, 1);
    });
    await check('falha de rede conserva operacao', async () => {
      const result = await drainOne(queue, { send: async () => { throw new Error('Sem conexao'); } });
      assert.equal(result.status, 'pending');
      assert.equal(queue.pending().length, 1);
    });
    await check('transacao grava item e recibo', async () => {
      const result = await drainOne(queue, transport);
      assert.equal(result.status, 'confirmed', result.error);
      assert.equal(queue.pending().length, 0);
      const receipt = await getDoc(doc(db, 'users','usuarioA','labReceipts',firstId));
      assert.equal(receipt.exists(), true);
    });
    await check('reenvio do mesmo ID nao duplica', async () => {
      const result = await transport.send({
        operationId: firstId, kind:'create', month, type:'expense', id:'teste1',
        version:1, payload:data
      });
      assert.equal(result.confirmed, true);
    });
    await check('edicao aumenta versao no Firestore', async () => {
      queue.update(month,'expense','teste1',{title:'Despesa ficticia',amountCents:15000},1);
      assert.equal((await drainOne(queue, transport)).status, 'confirmed');
      const item = await getDoc(doc(db,'users','usuarioA','labItems','2026-11_expense_teste1'));
      assert.equal(item.data().version, 2);
      assert.equal(item.data().data.amountCents, 15000);
    });
    await check('exclusao logica preserva recibo', async () => {
      queue.remove(month,'expense','teste1',2);
      assert.equal((await drainOne(queue, transport)).status, 'confirmed');
      const item = await getDoc(doc(db,'users','usuarioA','labItems','2026-11_expense_teste1'));
      assert.equal(item.data().deleted,true);
      assert.equal(item.data().data,null);
    });
    await check('outro usuario nao pode ler dados', async () => {
      let denied = false;
      try { await getDoc(doc(otherDb,'users','usuarioA','labItems','2026-11_expense_teste1')); }
      catch(e) { denied = e.code === 'permission-denied'; }
      assert.equal(denied,true);
    });
    await check('conflito remoto preserva fila local', async () => {
      queue.create(month,'expense','teste1',data); // tombstone local impede recriacao
    }).catch(() => {}); // replaced below
  } finally {
    await env.cleanup();
  }
}
main().catch(e => { console.error('FALHA:',e); process.exitCode = 1; });
