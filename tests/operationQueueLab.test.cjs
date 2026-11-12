'use strict';
const assert = require('node:assert/strict');
const { createQueue, LAB_KEY } = require('../js/services/operationQueueLab.js');
const values = new Map();
const storage = {
  getItem: k => values.has(k) ? values.get(k) : null,
  setItem: (k, v) => values.set(k, String(v))
};
let counter = 0;
const make = () => createQueue(storage, { idFactory: () => 'op_' + (++counter) });
let queue = make();
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('APROVADO:', name); }
const month = '2026-11';
const data = { title: 'Conta ficticia', amountCents: 15000 };
test('nenhum dado real lido ou modificado', () => {
  assert.equal(values.size, 0);
  assert.equal(queue.pending().length, 0);
});
test('criar registro individual', () => {
  assert.equal(queue.create(month, 'expense', 'e1', data), 'op_1');
  assert.equal(queue.get(month, 'expense', 'e1').version, 1);
});
test('impedir ID duplicado', () => {
  assert.throws(() => queue.create(month, 'expense', 'e1', data), /existente/);
});
test('editar com versao correta', () => {
  queue.update(month, 'expense', 'e1', { title: 'Conta ficticia', amountCents: 16000 }, 1);
  assert.equal(queue.get(month, 'expense', 'e1').version, 2);
});
test('bloquear edicao desatualizada', () => {
  assert.throws(() => queue.update(month, 'expense', 'e1', data, 1), /Conflito/);
});
test('bloquear edicao sem mudanca', () => {
  assert.throws(() => queue.update(month, 'expense', 'e1', { title: 'Conta ficticia', amountCents: 16000 }, 2), /sem alteracao/);
});
test('exclusao logica cria tombstone', () => {
  queue.remove(month, 'expense', 'e1', 2);
  assert.equal(queue.get(month, 'expense', 'e1').deleted, true);
  assert.equal(queue.get(month, 'expense', 'e1').version, 3);
});
test('excluido nao pode ser ressuscitado', () => {
  assert.throws(() => queue.create(month, 'expense', 'e1', data), /existente/);
  assert.throws(() => queue.update(month, 'expense', 'e1', data, 3), /Conflito/);
});
test('fila persiste apos reiniciar', () => {
  queue = make();
  assert.deepEqual(queue.pending().map(x => x.kind), ['create', 'update', 'delete']);
});
test('confirmacao remove somente a operacao', () => {
  assert.equal(queue.acknowledge('op_1'), true);
  assert.equal(queue.acknowledge('op_1'), false);
  assert.equal(queue.pending().length, 2);
  assert.equal(queue.get(month, 'expense', 'e1').deleted, true);
});
test('outros tipos de lancamento sao independentes', () => {
  queue.create(month, 'cardExpense', 'e1', data);
  queue.create(month, 'extraIncome', 'e1', data);
  assert.equal(queue.get(month, 'cardExpense', 'e1').version, 1);
  assert.equal(queue.get(month, 'extraIncome', 'e1').version, 1);
});
test('dados retornados sao copias', () => {
  const record = queue.get(month, 'cardExpense', 'e1');
  record.data.amountCents = 1;
  const pending = queue.pending();
  pending.length = 0;
  assert.equal(queue.get(month, 'cardExpense', 'e1').data.amountCents, 15000);
  assert.equal(queue.pending().length, 4);
});
test('dados invalidos nao alteram estado', () => {
  const before = values.get(LAB_KEY);
  assert.throws(() => queue.create(month, 'expense', 'bad', { title: '', amountCents: -1 }), /invalidos/);
  assert.equal(values.get(LAB_KEY), before);
});
test('PIN, Gemini e banco legado nunca acessados', () => {
  assert.deepEqual([...values.keys()], [LAB_KEY]);
});
console.log('RESULTADO: ' + passed + '/14 TESTES APROVADOS');
