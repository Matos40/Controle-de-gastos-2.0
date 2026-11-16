'use strict';
const codes = Object.freeze([
'INVALID_CONTRACT_VERSION','INVALID_PAYLOAD','INVALID_MONTH','MONTH_ALREADY_EXISTS',
'INVALID_SNAPSHOT','INVALID_REVISION','REVISION_CONFLICT','PREVIEW_NOT_FOUND',
'PREVIEW_STALE','PREVIEW_MISMATCH','CONFIRMATION_REQUIRED','INVALID_OPERATION_ID',
'IDEMPOTENCY_CONFLICT','PENDING_NOT_FOUND','PENDING_ALREADY_RESOLVED','INVALID_DECISION',
'REASON_REQUIRED','SOURCE_NOT_FOUND','SOURCE_DELETED','INVARIANT_VIOLATION','ATOMIC_COMMIT_FAILED']);
class ContractError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}
function fail(code, details) { throw new ContractError(code, details); }
module.exports = { codes, ContractError, fail };
