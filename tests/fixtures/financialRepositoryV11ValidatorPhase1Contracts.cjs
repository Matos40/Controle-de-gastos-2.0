'use strict';
// FinancialRepository v1.1 — phase 1 contracts only. No file I/O, parsing or integration.
const DECISIONS=Object.freeze({PASS:'PASS',REVIEW:'REVIEW',BLOCKED:'BLOCKED'});
const SEVERITIES=Object.freeze({INFO:'INFO',REVIEW:'REVIEW',BLOCKED:'BLOCKED'});
const FORMATS=Object.freeze(['json','xlsx']);
const PROFILES=Object.freeze(['json-legacy','json-sealed-v1','xlsx-export']);
const POLICY_VERSION='synthetic-v1';
function reject(message){throw new TypeError(message);}
function validateCheck(check){
 if(!check||typeof check!=='object'||Array.isArray(check))reject('INVALID_CHECK');
 if(typeof check.code!=='string'||!/^([A-Z][A-Z0-9_]{1,63})$/.test(check.code))reject('INVALID_CHECK_CODE');
 if(!Object.values(SEVERITIES).includes(check.severity))reject('INVALID_CHECK_SEVERITY');
 if(typeof check.passed!=='boolean')reject('INVALID_CHECK_RESULT');
 return Object.freeze({code:check.code,severity:check.severity,passed:check.passed});
}
function decide(checks){
 if(!Array.isArray(checks)||checks.length===0)reject('CHECKS_REQUIRED');
 const normalized=checks.map(validateCheck);
 const codes=new Set(normalized.map(c=>c.code));
 if(codes.size!==normalized.length)reject('DUPLICATE_CHECK_CODE');
 if(normalized.some(c=>!c.passed&&c.severity===SEVERITIES.BLOCKED))return DECISIONS.BLOCKED;
 if(normalized.some(c=>!c.passed&&c.severity===SEVERITIES.REVIEW))return DECISIONS.REVIEW;
 if(normalized.some(c=>!c.passed&&c.severity===SEVERITIES.INFO))return DECISIONS.REVIEW;
 return DECISIONS.PASS;
}
function report({format,profile,checks,policyVersion=POLICY_VERSION}){
 if(!FORMATS.includes(format))reject('UNSUPPORTED_FORMAT');
 if(!PROFILES.includes(profile)||!profile.startsWith(format+'-'))reject('UNSUPPORTED_PROFILE');
 if(policyVersion!==POLICY_VERSION)reject('UNSUPPORTED_POLICY');
 const normalized=checks.map(validateCheck);
 const decision=decide(normalized);
 return Object.freeze({decision,format,profile,policyVersion,reviewedByHuman:false,
  checks:Object.freeze(normalized)});
}
module.exports=Object.freeze({DECISIONS,SEVERITIES,FORMATS,PROFILES,POLICY_VERSION,validateCheck,decide,report});
