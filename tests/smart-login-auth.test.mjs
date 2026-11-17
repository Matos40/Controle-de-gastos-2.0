import test from 'node:test';
import assert from 'node:assert/strict';
import {openSmartLoginAuth} from '../js/productionV2/smartLoginAuth.mjs';
import {createSmartLoginGate} from '../js/productionV2/smartLoginGate.mjs';
test('reject missing test config before loading SDK',async()=>{await assert.rejects(openSmartLoginAuth({sdk:()=>{throw Error('unexpected');}}),/SMART_LOGIN_TEST_CONFIG_REQUIRED/);});
test('reject production even with test config',async()=>{await assert.rejects(openSmartLoginAuth({location:{origin:'https://matos40.github.io'},load:async()=>({SMART_LOGIN_TEST_CONFIG:{projectId:'raytech-cg-homologacao',authDomain:'raytech-cg-homologacao.firebaseapp.com',apiKey:'fake',appId:'fake'}}),sdk:()=>{throw Error('unexpected');}}),/SMART_LOGIN_TEST_CONFIG_REQUIRED/);});
test('authenticated but unverified bank stays blocked',async()=>{const gate=createSmartLoginGate();await gate.observe({uid:'a'},async()=>false);assert.equal(gate.permits('a'),false);});
test('logout invalidates pending check',async()=>{const gate=createSmartLoginGate();let release;const p=gate.observe({uid:'a'},()=>new Promise(r=>release=r));gate.lock();release(true);await p;assert.equal(gate.permits('a'),false);});
