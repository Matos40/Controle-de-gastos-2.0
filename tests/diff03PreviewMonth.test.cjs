'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('./fixtures/diff03SyntheticFixtures.cjs');
const {createLab,req,mp,write,create,setup,rp,resolve,hist,snapshot,month,card,clone,digest}=F;
function rejected(result,code){assert.equal(result.status,'rejected');assert.equal(result.code,code);}
function unchanged(l,before){assert.deepEqual(l.readSnapshot(),before);}

test('T01 empty snapshot cannot invent history',()=>{const l=createLab(F.F01());const p=mp(l);assert.equal(p.status,'preview');assert.equal(p.referenceMonth,null);assert.deepEqual(p.missingMonths,[]);assert.deepEqual(p.proposedPending,[]);assert.deepEqual(l.readSnapshot(),F.F01());});
test('T02 consecutive month has no gap',()=>{const l=createLab(F.F02());const p=mp(l);assert.equal(p.referenceMonth,'2026-12');assert.equal(p.requiresReconciliation,false);assert.deepEqual(p.missingMonths,[]);assert.deepEqual(p.proposedPending,[]);});
test('T03 single missing month',()=>{const p=mp(createLab(F.F03()));assert.equal(p.referenceMonth,'2026-11');assert.deepEqual(p.missingMonths,['2026-12']);assert.equal(p.requiresReconciliation,true);});
test('T04 multiple missing months are ordered',()=>{const p=mp(createLab(F.F04()));assert.deepEqual(p.missingMonths,['2026-09','2026-10','2026-11','2026-12']);assert.equal(p.targetMonth,'2027-01');});
test('T05 year boundary',()=>{const l=createLab(F.F05());assert.deepEqual(mp(l,'2027-01').missingMonths,[]);assert.deepEqual(mp(l,'2027-03').missingMonths,['2027-01','2027-02']);});
test('T06 invalid months and contract versions',()=>{const l=createLab(F.F03()),b=l.readSnapshot();for(const x of ['2026-00','2026-13','2026-1','0000-01','x',null])rejected(mp(l,x),'INVALID_MONTH');rejected(l.PREVIEW_MONTH_CREATION({contractVersion:'1.0',targetMonth:'2027-01',expectedRevision:0}),'INVALID_CONTRACT_VERSION');unchanged(l,b);});
test('T07 existing month rejected',()=>{const l=createLab(F.F03()),b=l.readSnapshot();rejected(mp(l,'2026-11'),'MONTH_ALREADY_EXISTS');unchanged(l,b);});
test('T08 invalid and conflicting revisions rejected',()=>{const l=createLab(F.F03()),b=l.readSnapshot();rejected(mp(l,'2027-01',1),'REVISION_CONFLICT');rejected(mp(l,'2027-01',-1),'INVALID_REVISION');unchanged(l,b);});
test('T09 preview is immutable and defensive',()=>{const original=F.F07(),b=clone(original),l=createLab(original),p=mp(l);p.proposedPending[0].sourceId='tampered';p.missingMonths.push('2099-01');original.financialState.months['2026-11'].salary=999;unchanged(l,b);assert.equal(mp(l).snapshotDigest,digest(b));assert.deepEqual(mp(l).missingMonths,['2026-12']);});
test('T10 deterministic equivalent previews',()=>{const a=F.F07(),b=clone(a);b.financialState={months:b.financialState.months,selectedMonth:b.financialState.selectedMonth};const p=mp(createLab(a));assert.deepEqual(p,mp(createLab(b)));assert.match(p.previewId,/^preview-[a-f0-9]{64}$/);});
