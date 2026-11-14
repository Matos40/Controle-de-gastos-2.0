/* FinancialRepository v1.1: armazenamento transacional isolado, sem ativacao no app. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinancialRepositoryV11Storage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
        let response, decided = false;
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
            decided = true;
          } catch (err) {
            try { tx.abort(); } catch (_) {}
            reject(err);
          }
        };
      });
    }
    return Object.freeze({ transact });
  }
  function createStore(driver) {
    if (!driver || typeof driver.transact !== 'function') throw new Error('DRIVER_REQUIRED');
    async function initialize(database) {
      if (!database || typeof database !== 'object') throw Error('INVALID_DATABASE');
      return driver.transact(current => current === null
        ? { write: { revision: 0, database: clone(database), receipts: [] },
            response: { status: 'initialized', revision: 0 } }
        : { response: { status: 'existing', revision: validateEnvelope(current).revision } });
    }
    async function read() {
      return driver.transact(current => ({
        response: current === null ? null : clone(validateEnvelope(current))
      }));
    }
    async function commit(request) {
      if (!request || !Number.isSafeInteger(request.expectedRevision) ||
          request.expectedRevision < 0 || !Number.isSafeInteger(request.nextRevision) ||
          request.nextRevision !== request.expectedRevision + 1 ||
          typeof request.operationId !== 'string' || !request.operationId.trim() ||
          !request.database || typeof request.database !== 'object')
        return { status: 'rejected', code: 'INVALID_COMMIT' };
      try {
        return await driver.transact(current => {
          if (current === null) return { response: { status: 'rejected', code: 'NOT_INITIALIZED' } };
          validateEnvelope(current);
          const prior = current.receipts.find(x => x.operationId === request.operationId);
          if (prior) {
            return { response: prior.expectedRevision === request.expectedRevision &&
                prior.nextRevision === request.nextRevision && same(prior.database, request.database)
                ? { status: 'committed', revision: prior.nextRevision, replay: true }
                : { status: 'rejected', code: 'OPERATION_ID_REUSED' } };
          }
          if (current.revision !== request.expectedRevision)
            return { response: { status: 'conflict', code: 'REVISION_MISMATCH', revision: current.revision } };
          const next = clone(current);
          next.revision = request.nextRevision;
          next.database = clone(request.database);
          next.receipts.push({ operationId: request.operationId,
            expectedRevision: request.expectedRevision, nextRevision: request.nextRevision,
            database: clone(request.database) });
          return { write: next, response: { status: 'committed', revision: next.revision } };
        });
      } catch (_) {
        return { status: 'unknown', code: 'COMMIT_UNCONFIRMED' };
      }
    }
    return Object.freeze({ initialize, read, commit });
  }
  return Object.freeze({ createStore, createMemoryDriver, createIndexedDbDriver });
});
