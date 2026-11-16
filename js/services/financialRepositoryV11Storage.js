/* FinancialRepository v1.1: armazenamento transacional isolado, sem ativacao no app. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./financialRepositoryV11Integrity.js') : root.FinancialRepositoryV11Integrity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinancialRepositoryV11Storage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Integrity) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const MAX_RECEIPTS = 10000;
  function validateEnvelope(e) {
    if (!e || !Number.isSafeInteger(e.revision) || e.revision < 0 ||
        !e.database || typeof e.database !== 'object' || !Array.isArray(e.receipts))
      throw new Error('INVALID_ENVELOPE');
    return e;
  }
  function createMemoryDriver(initial) {
    let state = initial == null ? null : clone(validateEnvelope(initial));
    let queue = Promise.resolve();
    function transact(operation) {
      const job = queue.then(async () => {
        const working = state === null ? null : clone(state);
        const result = await operation(working);
        if (result && result.write) state = clone(validateEnvelope(result.write));
        return clone(result.response);
      });
      queue = job.then(() => {}, () => {});
      return job;
    }
    return Object.freeze({ transact, inspect: () => state === null ? null : clone(state) });
  }
  function createIndexedDbDriver(indexedDB, name) {
    if (!indexedDB || typeof indexedDB.open !== 'function') throw new Error('INDEXEDDB_UNAVAILABLE');
    const dbName = name || 'raytech-financial-repository-v11-isolated';
    let openPromise;
    function open() {
      if (!openPromise) {
        openPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || Error('IDB_OPEN_FAILED'));
          request.onblocked = () => reject(Error('IDB_BLOCKED'));
        }).catch(err => { openPromise = null; throw err; });
      }
      return openPromise;
    }
    async function transact(operation) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        const store = tx.objectStore('state');
        let response;
        tx.oncomplete = () => resolve(clone(response));
        tx.onabort = () => reject(tx.error || Error('IDB_ABORTED'));
        tx.onerror = () => {};
        const request = store.get('current');
        request.onerror = () => { try { tx.abort(); } catch (_) {} };
        request.onsuccess = () => {
          try {
            // Operation MUST be synchronous to retain the IDB transaction.
            const result = operation(request.result == null ? null : clone(request.result));
            if (result && typeof result.then === 'function') throw Error('ASYNC_TRANSACTION_CALLBACK');
            response = result.response;
            if (result.write) store.put(clone(validateEnvelope(result.write)), 'current');
          } catch (err) {
            try { tx.abort(); } catch (_) {}
            reject(err);
          }
        };
      });
    }
    function close() { if (openPromise) openPromise.then(db => db.close()).catch(() => {}); openPromise = null; }
    return Object.freeze({ transact, close });
  }
  function createStore(driver) {
    if (!Integrity) throw Error('INTEGRITY_DEPENDENCY_REQUIRED');
    // Integrity checks occur outside IDB callbacks; compare-and-swap remains inside the transaction.
    async function checkedRead() {
      const snapshot = await driver.transact(current => ({response: current === null ? null : clone(validateEnvelope(current))}));
      if (snapshot === null) return null;
      if (!snapshot.seal) throw Error('UNSEALED_ENVELOPE');
      if (snapshot.receipts.length > MAX_RECEIPTS) throw Error('RECEIPT_CAPACITY_EXCEEDED');
      if (new Set(snapshot.receipts.map(x=>x.operationId)).size !== snapshot.receipts.length) throw Error('DUPLICATE_RECEIPTS');
      for (const receipt of snapshot.receipts) {
        if (!receipt || typeof receipt.operationId !== 'string' || !receipt.operationId.trim() ||
            !Number.isSafeInteger(receipt.expectedRevision) || receipt.expectedRevision < 0 ||
            receipt.nextRevision !== receipt.expectedRevision + 1 ||
            receipt.nextRevision > snapshot.revision ||
            (receipt.database === undefined &&
             (typeof receipt.databaseDigest !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.databaseDigest))))
          throw Error('INVALID_RECEIPT');
      }
      const verified = await Integrity.verify(snapshot.seal);
      if (Integrity.canonical(verified) !== Integrity.canonical(snapshot.database)) throw Error('DATABASE_MISMATCH');
      if (snapshot.seal.revision !== undefined && snapshot.seal.revision !== snapshot.revision) throw Error('REVISION_MISMATCH');
      if (snapshot.seal.receiptsDigest !== undefined) {
        const receiptSeal = await Integrity.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts:snapshot.receipts});
        if (receiptSeal.digest !== snapshot.seal.receiptsDigest) throw Error('RECEIPTS_MISMATCH');
      } else throw Error('UNSEALED_RECEIPTS');
      return snapshot;
    }
    async function prepareSeal(database, revision, receipts) {
      const seal = await Integrity.seal(database);
      const receiptSeal = await Integrity.seal({selectedMonth:'2026-11',months:{'2026-11':{expenses:[],cardExpenses:[]}},receipts});
      return {...seal,revision,receiptsDigest:receiptSeal.digest};
    }
    if (!driver || typeof driver.transact !== 'function') throw new Error('DRIVER_REQUIRED');
    async function initialize(database) {
      Integrity.validate(database);
      const initial = {revision:0,database:clone(database),receipts:[]};
      initial.seal = await prepareSeal(initial.database,0,[]);
      return driver.transact(current => current === null
        ? {write:initial,response:{status:'initialized',revision:0}}
        : {response:{status:'existing',revision:validateEnvelope(current).revision}});
    }
    async function read() { return checkedRead(); }
    async function commit(request) {
      if (!request || !Number.isSafeInteger(request.expectedRevision) ||
          request.expectedRevision < 0 || request.nextRevision !== request.expectedRevision+1 ||
          typeof request.operationId !== 'string' || !request.operationId.trim())
        return {status:'rejected',code:'INVALID_COMMIT'};
      try {
        Integrity.validate(request.database);
        const current = await checkedRead();
        if (!current) return {status:'rejected',code:'NOT_INITIALIZED'};
        const prior = current.receipts.find(x=>x.operationId===request.operationId);
        if (prior) return prior.expectedRevision===request.expectedRevision &&
          prior.nextRevision===request.nextRevision &&
          prior.signature===(request.signature||null) &&
          (prior.database ? Integrity.canonical(prior.database)===Integrity.canonical(request.database) :
           prior.databaseDigest===(await Integrity.seal(request.database)).digest)
          ? {status:'committed',revision:prior.nextRevision,replay:true}
          : {status:'rejected',code:'OPERATION_ID_REUSED'};
        if (current.revision!==request.expectedRevision)
          return {status:'conflict',code:'REVISION_MISMATCH',revision:current.revision};
        if(current.receipts.length>=MAX_RECEIPTS) return {status:'rejected',code:'RECEIPT_CAPACITY_EXCEEDED'};
        const databaseDigest=(await Integrity.seal(request.database)).digest;
        const next={revision:request.nextRevision,database:clone(request.database),
          receipts:current.receipts.concat([{operationId:request.operationId,
          expectedRevision:request.expectedRevision,nextRevision:request.nextRevision,
          signature:request.signature||null,databaseDigest}])};
        next.seal=await prepareSeal(next.database,next.revision,next.receipts);
        const fingerprint=Integrity.canonical(current);
        return await driver.transact(latest=>{
          if (Integrity.canonical(latest)!==fingerprint)
            return {response:{status:'conflict',code:'CONCURRENT_CHANGE'}};
          return {write:next,response:{status:'committed',revision:next.revision}};
        });
      } catch (error) {
        if (['UNSEALED_ENVELOPE','DATABASE_MISMATCH','REVISION_MISMATCH',
          'RECEIPTS_MISMATCH','UNSEALED_RECEIPTS','CHECKSUM_MISMATCH',
          'INVALID_DATABASE','INVALID_MONTH_DATA','INVALID_SEAL',
          'RECEIPT_CAPACITY_EXCEEDED','DUPLICATE_RECEIPTS','INVALID_RECEIPT'].includes(error.message))
          return {status:'rejected',code:'INTEGRITY_FAILURE'};
        return {status:'unknown',code:'COMMIT_UNCONFIRMED'};
      }
    }
    return Object.freeze({ initialize, read, commit });
  }
  return Object.freeze({ createStore, createMemoryDriver, createIndexedDbDriver });
});
