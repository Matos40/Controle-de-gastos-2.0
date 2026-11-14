'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('./fixtures/diff03SyntheticFixtures.cjs');
const {createLab,req,mp,write,create,setup,rp,resolve,hist,snapshot,month,card,clone,digest}=F;
function rejected(result,code){assert.equal(result.status,'rejected');assert.equal(result.code,code);}
function unchanged(l,before){assert.deepEqual(l.readSnapshot(),before);}

const {emptyMonth}=require('../experimental/diff03/shared/invariants.cjs');
test('T11 valid confirmation creates only requested month',()=>{const l=createLab(F.F03()),b=l.readSnapshot(),r=create(l),a=l.readSnapshot();assert.equal(r.revision,1);assert.equal(r.createdMonth,'2027-01');assert.deepEqual(a.financialState.months['2027-01'],emptyMonth());assert.deepEqual(a.financialState.months['2026-11'],b.financialState.months['2026-11']);assert.equal(a.financialState.selectedMonth,'2027-01');assert.equal(a.operationReceipts.length,1);assert.equal(r.pendingIds.length,1);});
test('T12 explicit confirmation required',()=>{const l=createLab(F.F03()),p=mp(l),b=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION(write(l,p,'synthetic-op',{confirmation:false})),'CONFIRMATION_REQUIRED');unchanged(l,b);});
test('T13 missing preview rejected',()=>{const l=createLab(F.F03()),b=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION(write(l,{previewId:'unknown'})),'PREVIEW_NOT_FOUND');unchanged(l,b);});
test('T14 obsolete preview rejected',()=>{const l=createLab(F.F03()),p=mp(l,'2027-02');create(l,'2027-01');const b=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION(write(l,p,'synthetic-other',{expectedRevision:0})),'PREVIEW_STALE');unchanged(l,b);});
test('T15 wrong contract preview rejected',()=>{const {l,pending}=setup();const p=rp(l,pending[0].pendingId),b=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION(write(l,p,'synthetic-wrong')),'PREVIEW_MISMATCH');unchanged(l,b);});
test('T16 no intermediate months or fake finances; existing cumulative balances protected',()=>{const l=createLab(F.F04());const b=l.readBalances();create(l);assert.deepEqual(Object.keys(l.readSnapshot().financialState.months),['2026-08','2027-01']);assert.deepEqual(l.readBalances(),{...b,'2027-01':0});const bridge=createLab(snapshot({'2026-11':month(100),'2027-01':month(200)}));const before=bridge.readSnapshot();rejected(bridge.CONFIRM_MONTH_CREATION(write(bridge,mp(bridge,'2026-12'))),'INVARIANT_VIOLATION');unchanged(bridge,before);});
test('T17 identical retry returns original receipt',()=>{const l=createLab(F.F07()),p=mp(l),q=write(l,p),r=l.CONFIRM_MONTH_CREATION(q),b=l.readSnapshot();assert.equal(r.status,'committed');assert.deepEqual(l.CONFIRM_MONTH_CREATION(q),r);unchanged(l,b);const reopened=createLab(b);assert.deepEqual(reopened.CONFIRM_MONTH_CREATION(q),r);});
test('T18 operation ID collision rejected',()=>{const l=createLab(F.F03()),p=mp(l),q=write(l,p);assert.equal(l.CONFIRM_MONTH_CREATION(q).status,'committed');const b=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION({...q,actorId:'other'}),'IDEMPOTENCY_CONFLICT');unchanged(l,b);});
test('T19 two simulated writers on same revision',()=>{const l=createLab(F.F10()),a=mp(l),b=mp(l,'2027-02'),qa=write(l,a,'writer-a'),qb=write(l,b,'writer-b');assert.equal(l.CONFIRM_MONTH_CREATION(qa).revision,11);const after=l.readSnapshot();rejected(l.CONFIRM_MONTH_CREATION(qb),'PREVIEW_STALE');unchanged(l,after);});
test('T20 faults before and after staging preserve complete snapshot',()=>{for(const point of ['beforeApply','afterApply','beforeCommit']){const l=F.F11(),p=mp(l),q=write(l,p),b=l.readSnapshot();l.failNextCommit(point);rejected(l.CONFIRM_MONTH_CREATION(q),'ATOMIC_COMMIT_FAILED');unchanged(l,b);assert.equal(l.CONFIRM_MONTH_CREATION(q).status,'committed');}});
