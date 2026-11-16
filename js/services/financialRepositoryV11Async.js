/* Isolated async bridge: legacy storage and UI are intentionally untouched. */
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports
      ? require('./financialRepositoryV11.js') : root.FinancialRepositoryV11
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinancialRepositoryV11Async = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const signature = cmd => JSON.stringify([cmd.commandType, cmd.payload, cmd.expectedRevision, cmd.actorId]);
  function create(store) {
    if (!Core || !store || typeof store.read !== 'function' ||
        typeof store.commit !== 'function') throw Error('INVALID_DEPENDENCIES');
    async function read() {
      const envelope = await store.read();
      if (!envelope) return null;
      Core.validateDatabase(envelope.database);
      return { revision: envelope.revision, database: clone(envelope.database) };
    }
    async function execute(cmd) {
      if (!cmd || typeof cmd.operationId !== 'string' || !cmd.operationId.trim())
        return { status: 'rejected', code: 'INVALID_COMMAND' };
      let envelope;
      try { envelope = await store.read(); }
      catch (_) { return { status: 'unknown', code: 'READ_UNAVAILABLE' }; }
      if (!envelope) return { status: 'rejected', code: 'NOT_INITIALIZED' };
      const previous = envelope.receipts.find(x => x.operationId === cmd.operationId);
      const fingerprint = signature(cmd);
      if (previous) {
        return previous.signature === fingerprint
          ? { status: 'committed', revision: previous.nextRevision, operationId: cmd.operationId, replay: true }
          : { status: 'rejected', code: 'OPERATION_ID_REUSED' };
      }
      if (cmd.expectedRevision !== envelope.revision)
        return { status: 'conflict', code: 'REVISION_MISMATCH', revision: envelope.revision };
      let prepared;
      try {
        const core = Core.create(envelope.database, { revision: envelope.revision });
        prepared = core.execute(cmd);
        if (prepared.status !== 'committed') return prepared;
        const next = core.read();
        const outcome = await store.commit({
          expectedRevision: envelope.revision, nextRevision: next.revision,
          operationId: cmd.operationId, signature: fingerprint, database: next.database
        });
        if (outcome.status === 'committed') return {
          status: 'committed', revision: outcome.revision, operationId: cmd.operationId,
          replay: Boolean(outcome.replay)
        };
        if (outcome.status !== 'unknown') return outcome;
        // A lost acknowledgement is not proof of a failed commit.
        try {
          const recovered = await store.read();
          const receipt = recovered && recovered.receipts.find(x => x.operationId === cmd.operationId);
          if (receipt && receipt.signature === fingerprint)
            return { status: 'committed', revision: receipt.nextRevision,
              operationId: cmd.operationId, replay: true, recovered: true };
          if (receipt) return { status: 'rejected', code: 'OPERATION_ID_REUSED' };
        } catch (_) { /* leave outcome uncertain */ }
        return { status: 'unknown', code: 'COMMIT_UNCONFIRMED' };
      } catch (_) { return { status: 'unknown', code: 'EXECUTION_UNCONFIRMED' }; }
    }
    return Object.freeze({ read, execute });
  }
  return Object.freeze({ create });
});
