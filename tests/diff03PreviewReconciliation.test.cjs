'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('./fixtures/diff03SyntheticFixtures.cjs');
const {createLab,req,mp,write,create,setup,rp,resolve,hist,snapshot,month,card,clone,digest}=F;
function rejected(result,code){assert.equal(result.status,'rejected');assert.equal(result.code,code);}
function unchanged(l,before){assert.deepEqual(l.readSnapshot(),before);}

test('T31 proper preview without financial or state mutation',()=>{const {l,pending}=setup(),b=l.readSnapshot(),p=rp(l,pending[0].pendingId);assert.equal(p.status,'preview');assert.equal(p.financialImpact,0);assert.equal(p.pendingId,pending[0].pendingId);unchanged(l,b);});
test('T32 unknown pending ID rejected',()=>{const {l}=setup(),b=l.readSnapshot();rejected(rp(l,'unknown'),'PENDING_NOT_FOUND');unchanged(l,b);});
test('T33 closed pending cannot be silently reopened',()=>{const l=createLab(F.F09());const p=l.readSnapshot().reconciliation.pending.find(x=>x.status==='DISMISSED'),b=l.readSnapshot();rejected(rp(l,p.pendingId),'PENDING_ALREADY_RESOLVED');unchanged(l,b);});
test('T34 unknown decision rejected',()=>{const {l,pending}=setup(),b=l.readSnapshot();rejected(rp(l,pending[0].pendingId,'PAY_ALL'),'INVALID_DECISION');unchanged(l,b);});
test('T35 meaningful reason required',()=>{const {l,pending}=setup(),b=l.readSnapshot();for(const reason of ['', '  ',null,123])rejected(rp(l,pending[0].pendingId,'DISMISS',reason),'REASON_REQUIRED');unchanged(l,b);});
test('T36 KEEP_PENDING preserves OPEN',()=>{const {l,pending}=setup(),id=pending[0].pendingId,b=l.readSnapshot();const p=rp(l,id,'KEEP_PENDING');assert.equal(p.proposedDecision,'KEEP_PENDING');unchanged(l,b);const r=l.RESOLVE_RECONCILIATION(write(l,p,'keep'));assert.equal(r.resolutionStatus,'OPEN');assert.equal(l.readSnapshot().reconciliation.pending.find(x=>x.pendingId===id).status,'OPEN');});
test('T37 cancellation cannot mutate snapshot',()=>{const {l,pending}=setup(),b=l.readSnapshot();const r=rp(l,pending[0].pendingId,'CANCEL','');assert.equal(r.status,'cancelled');assert.equal(r.financialImpact,0);assert.equal(Object.hasOwn(r,'previewId'),false);unchanged(l,b);});
test('T38 dismiss preview has zero effect on balances',()=>{const {l,pending}=setup(),b=l.readSnapshot(),balances=l.readBalances();assert.equal(rp(l,pending[0].pendingId).financialImpact,0);unchanged(l,b);assert.deepEqual(l.readBalances(),balances);});
test('T39 continuity preview cannot generate actual entry',()=>{const {l,pending}=setup(),b=l.readSnapshot();const p=rp(l,pending.find(x=>x.type==='INSTALLMENT_GAP').pendingId,'CONFIRM_CONTINUITY');assert.equal(p.status,'preview');assert.equal(p.financialImpact,0);unchanged(l,b);});
test('T40 preview bound to exact revision and digest',()=>{const {l,pending}=setup(),b=l.readSnapshot(),p=rp(l,pending[0].pendingId);assert.equal(p.baseRevision,b.revision);assert.equal(p.snapshotDigest,digest(b));rejected(l.PREVIEW_RECONCILIATION(req({pendingId:pending[0].pendingId,expectedRevision:0,decision:{action:'DISMISS',reason:'Synthetic'}})),'REVISION_CONFLICT');p.reason='tampered';assert.notEqual(rp(l,pending[0].pendingId).reason,p.reason);unchanged(l,b);});
