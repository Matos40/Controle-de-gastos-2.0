'use strict';
const { createHash } = require('node:crypto');
const { fail } = require('./errors.cjs');
const VERSION = '1.1';
const own = (o,k) => Object.hasOwn(o,k);
const plain = x => x !== null && typeof x === 'object' && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const month = x => typeof x === 'string' && /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(x);
const revision = x => Number.isSafeInteger(x) && x >= 0;
const money = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= Number.MAX_SAFE_INTEGER / 100;
const safeKeys = k => !['__proto__','constructor','prototype'].includes(k);
function json(x, seen = new Set()) {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return true;
  if (typeof x === 'number') return Number.isFinite(x);
  if ((!Array.isArray(x) && !plain(x)) || seen.has(x)) return false;
  seen.add(x);
  const keys = Reflect.ownKeys(x);
  const values = Array.isArray(x) ? keys.filter(k=>k!=='length') : keys;
  if (Array.isArray(x) && values.length !== x.length) return false;
  for (const k of values) {
    if (typeof k !== 'string' || !safeKeys(k) || (Array.isArray(x) && !/^(0|[1-9][0-9]*)$/.test(k))) return false;
    const d = Object.getOwnPropertyDescriptor(x,k);
    if (!d.enumerable || !own(d,'value') || !json(d.value,seen)) return false;
  }
  seen.delete(x); return true;
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function canonical(x) {
  if (Array.isArray(x)) return '['+x.map(canonical).join(',')+']';
  if (plain(x)) return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
function digest(x) { return createHash('sha256').update(canonical(x)).digest('hex'); }
function key(prefix, x) { return prefix+'-'+digest(x); }
function fields(x, required, optional=[]) {
  if (!plain(x) || !json(x) || !required.every(k=>own(x,k)) || Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k))) fail('INVALID_PAYLOAD');
}
function request(x, required, optional=[]) {
  if (!plain(x) || !json(x)) fail('INVALID_PAYLOAD');
  if (x.contractVersion !== VERSION) fail('INVALID_CONTRACT_VERSION');
  fields(x,['contractVersion',...required],optional);
}
function checkRevision(x, current) {
  if (!revision(x)) fail('INVALID_REVISION');
  if (x !== current) fail('REVISION_CONFLICT');
}
function checkMonth(x) { if (!month(x)) fail('INVALID_MONTH'); }
function checkId(x) { if (!id(x)) fail('INVALID_PAYLOAD'); }
function writeRequest(x) {
  request(x,['operationId','actorId','previewId','expectedRevision'],['confirmation']);
  if (!id(x.operationId)) fail('INVALID_OPERATION_ID');
  checkId(x.actorId); checkId(x.previewId);
  if (!revision(x.expectedRevision)) fail('INVALID_REVISION');
  if (x.confirmation !== true) fail('CONFIRMATION_REQUIRED');
}
function ordinal(x) { return Number(x.slice(0,4))*12 + Number(x.slice(5))-1; }
function ym(n) { return String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0'); }
function gap(months,target) {
  const referenceMonth = Object.keys(months).filter(k=>k<target).sort().at(-1) || null;
  const missingMonths = [];
  if (referenceMonth) for(let i=ordinal(referenceMonth)+1;i<ordinal(target);i++) missingMonths.push(ym(i));
  return {referenceMonth,missingMonths};
}
const types = Object.freeze(['SALARY_GAP','FIXED_EXPENSE_GAP','INSTALLMENT_GAP','DELETION_CONFLICT','SOURCE_AMBIGUITY']);
const states = Object.freeze(['OPEN','RESOLVED','DISMISSED']);
const actions = Object.freeze(['KEEP_PENDING','DISMISS','CONFIRM_CONTINUITY','CANCEL']);
const outcome = a => a==='DISMISS'?'DISMISSED':a==='CONFIRM_CONTINUITY'?'RESOLVED':'OPEN';
module.exports={VERSION,own,plain,id,month,revision,money,json,clone,canonical,digest,key,fields,request,checkRevision,checkMonth,checkId,writeRequest,gap,types,states,actions,outcome};
