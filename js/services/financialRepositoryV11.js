/* FinancialRepository v1.1 - nucleo isolado. Nao substitui os escritores legados. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinancialRepositoryV11 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = new Set(['SET_SALARY', 'SET_EXPENSE_PAID', 'SET_CARD_PAID',
    'CREATE_EXTRA_INCOME', 'DELETE_EXTRA_INCOME', 'UPSERT_EXPENSE', 'DELETE_EXPENSE',
    'UPSERT_CARD_EXPENSE', 'DELETE_CARD_EXPENSE', 'CLEAR_EXPENSES',
    'CLEAR_CARD_EXPENSES', 'CREATE_MONTH', 'ADVANCE_MONTH',
    'SYNC_PREVIOUS_MONTH', 'REPLACE_FINANCIAL_DATABASE']);
  const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function fail(code) { return { status: 'rejected', code }; }
  function cents(value) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_MONEY');
    return value / 100;
  }
  function validateDatabase(db) {
    if (!db || typeof db !== 'object' || Array.isArray(db) ||
        !db.months || typeof db.months !== 'object' || Array.isArray(db.months) ||
        !MONTH.test(db.selectedMonth) || !Object.hasOwn(db.months, db.selectedMonth))
      throw new Error('INVALID_DATABASE');
    for (const [ym, m] of Object.entries(db.months)) {
      if (!MONTH.test(ym) || !m || !Array.isArray(m.expenses) ||
          !Array.isArray(m.cardExpenses) || (m.extraIncomes != null && !Array.isArray(m.extraIncomes)))
        throw new Error('INVALID_DATABASE');
    }
    return true;
  }
  function create(initial, options) {
    validateDatabase(initial);
    const settings = options || {};
    let snapshot = clone(initial);
    let revision = Number.isSafeInteger(settings.revision) && settings.revision >= 0 ? settings.revision : 0;
    const receipts = new Map();
    const adapter = settings.adapter || null;
    function read() { return { revision, database: clone(snapshot) }; }
    function execute(cmd) {
      if (!cmd || cmd.schemaVersion !== 1 || typeof cmd.operationId !== 'string' ||
          !cmd.operationId.trim() || !TYPES.has(cmd.commandType))
        return fail('INVALID_COMMAND');
      const signature = JSON.stringify([cmd.commandType, cmd.payload, cmd.expectedRevision, cmd.actorId]);
      if (receipts.has(cmd.operationId)) {
        const old = receipts.get(cmd.operationId);
        return old.signature === signature ? clone(old.result) : fail('OPERATION_ID_REUSED');
      }
      if (!Number.isSafeInteger(cmd.expectedRevision) || cmd.expectedRevision !== revision)
        return { status: 'conflict', code: 'REVISION_MISMATCH', revision };
      const next = clone(snapshot);
      const p = cmd.payload || {};
      const month = next.months[p.month];
      let result;
      try {
        switch (cmd.commandType) {
          case 'SET_SALARY':
            if (!month) return fail('MONTH_NOT_FOUND');
            month.salary = cents(p.amountCents);
            break;
          case 'SET_EXPENSE_PAID':
          case 'SET_CARD_PAID': {
            if (!month || typeof p.id !== 'string' || typeof p.paid !== 'boolean')
              return fail('INVALID_PAYLOAD');
            const items = cmd.commandType === 'SET_EXPENSE_PAID' ? month.expenses : month.cardExpenses;
            const item = items.find(x => x.id === p.id);
            if (!item) return fail('ITEM_NOT_FOUND');
            item.paid = p.paid;
            break;
          }
          case 'CREATE_EXTRA_INCOME': {
            if (!month || !p.item || typeof p.item.id !== 'string' ||
                !p.item.id || typeof p.item.description !== 'string')
              return fail('INVALID_PAYLOAD');
            if (!Array.isArray(month.extraIncomes)) month.extraIncomes = [];
            if (month.extraIncomes.some(x => x.id === p.item.id)) return fail('DUPLICATE_ID');
            month.extraIncomes.push({ id: p.item.id, description: p.item.description,
              date: p.item.date || '', amount: cents(p.item.amountCents) });
            break;
          }
          case 'DELETE_EXTRA_INCOME': {
            if (!month || !Array.isArray(month.extraIncomes)) return fail('ITEM_NOT_FOUND');
            const index = month.extraIncomes.findIndex(x => x.id === p.id);
            if (index < 0) return fail('ITEM_NOT_FOUND');
            month.extraIncomes.splice(index, 1);
            break;
          }
          case 'REPLACE_FINANCIAL_DATABASE':
            return fail('REPLACEMENT_REQUIRES_TRANSACTIONAL_ADAPTER');
          default:
            return fail('COMMAND_NOT_YET_IMPLEMENTED');
        }
        validateDatabase(next);
        if (adapter) {
          // O adaptador deve garantir commit atomico e deteccao de conflito.
          if (typeof adapter.commit !== 'function' || adapter.atomic !== true)
            return fail('TRANSACTIONAL_ADAPTER_REQUIRED');
          let outcome;
          try {
            outcome = adapter.commit({ expectedRevision: revision, nextRevision: revision + 1,
              operationId: cmd.operationId, database: clone(next) });
          } catch (_) {
            return { status: 'unknown', code: 'COMMIT_UNCONFIRMED' };
          }
          if (outcome && typeof outcome.then === 'function')
            return fail('ASYNC_ADAPTER_NOT_SUPPORTED');
          if (!outcome || outcome.status !== 'committed')
            return outcome && ['conflict', 'rejected', 'unknown'].includes(outcome.status)
              ? outcome : { status: 'unknown', code: 'COMMIT_UNCONFIRMED' };
        }
        snapshot = next;
        revision++;
        result = { status: 'committed', revision, operationId: cmd.operationId };
        receipts.set(cmd.operationId, { signature, result });
        return clone(result);
      } catch (err) {
        return fail(err && err.message === 'INVALID_MONEY' ? 'INVALID_MONEY' : 'INVALID_PAYLOAD');
      }
    }
    return Object.freeze({ read, execute });
  }
  return Object.freeze({ create, validateDatabase, commandTypes: Object.freeze(Array.from(TYPES)) });
});
