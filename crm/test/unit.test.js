'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, validate } = require('../src/validate');
const { parseCsv, toCsv } = require('../src/csv');
const { hashPassword, verifyPassword } = require('../src/auth');

test('normalizePhone', () => {
  assert.equal(normalizePhone('+216 20 123 456'), '+21620123456');
  assert.equal(normalizePhone('00216 20 123 456'), '+21620123456');
  assert.equal(normalizePhone('20 123 456'), '20123456');
  assert.equal(normalizePhone('12'), undefined);
  assert.equal(normalizePhone(''), null);
});
test('validate drops unknown keys and reports errors per field', () => {
  const out = validate({ a: ' x ', evil: 1 }, { a: { type: 'string', required: true } });
  assert.deepEqual(out, { a: 'x' });
  assert.throws(() => validate({}, { a: { type: 'string', required: true } }), (e) => e.status === 400 && Boolean(e.details.a));
});
test('csv round trip and formula guard', () => {
  const csv = toCsv([{ label: 'A', key: 'a' }, { label: 'B', key: 'b' }], [{ a: '=SUM(1)', b: 'x, "y"' }]);
  assert.match(csv, /'=SUM\(1\)/);
  const rows = parseCsv('a;b\n1;"x; ""y"""\n');
  assert.deepEqual(rows, [{ a: '1', b: 'x; "y"' }]);
});
test('scrypt password hashing', () => {
  const h = hashPassword('Password123');
  assert.ok(verifyPassword('Password123', h));
  assert.ok(!verifyPassword('Password124', h));
  assert.ok(!verifyPassword('x', 'garbage'));
});
