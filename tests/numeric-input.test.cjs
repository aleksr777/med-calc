const { test } = require('node:test');
const assert = require('node:assert/strict');
const input = require('../assets/numeric-input.js');
const calc = require('../assets/calculations.js');

test('decimal input accepts integers, both decimal separators and intermediate editing states', () => {
  for (const value of ['', '0', '70', '0,04', '0.04', ',5', '.5', '1,', '1.', ',', '.']) {
    assert.equal(input.isAllowed(value), true, value);
  }
});

test('letters, signs, spaces, mixed separators and scientific notation cannot be inserted', () => {
  for (const value of ['abc', '70кг', '-1', '+1', '1e3', '1E3', '1 000', ' 70', '70 ', '1,2.3', '1..2', '1,,2', '10%', '1/2', '∞']) {
    assert.equal(input.isAllowed(value), false, value);
    assert.equal(input.canInsert('', value), false, value);
  }
});

test('selection replacement permits changing decimal separator and editing fractional digits', () => {
  assert.equal(input.canInsert('0,5', '.', 1, 2), true);
  assert.equal(input.canInsert('0,5', '.', 3, 3), false);
  assert.equal(input.canInsert('0,5', '25', 2, 3), true);
  assert.equal(input.canInsert('70', '0,04', 0, 2), true);
  assert.equal(input.canInsert('0,5', ',', 0, 3), true);
});

test('invalid paste is rejected as a whole, including values that would change if stripped', () => {
  for (const paste of ['-1', '1e3', '12 mg', '12,5\n', '1.2,3']) assert.equal(input.canInsert('70', paste, 0, 2), false);
  assert.equal(input.canInsert('70', '0.5', 0, 2), true);
  assert.equal(input.canInsert('', '12345', 0, 0, 4), false);
  assert.equal(input.canInsert('1234', '5', 4, 4, 4), false);
  assert.equal(input.canInsert('1234', '5', 3, 4, 4), true);
});

test('calculated input values contain only digits and one decimal separator, even for tiny and large numbers', () => {
  assert.equal(calc.formatInput(1e-7), '0,0000001');
  assert.equal(calc.formatInput(1.25e-8), '0,0000000125');
  assert.equal(calc.formatInput(1.234e21), '1234000000000000000000');
  for (const value of [0, 0.4, 5 / 7, 1e-12, 1e21, Number.MIN_VALUE, Number.MAX_VALUE]) {
    const formatted = calc.formatInput(value);
    assert.equal(input.isAllowed(formatted), true, formatted);
    assert.equal(Number.isFinite(calc.number(formatted, true)), true);
    if (value > 0) assert.ok(calc.number(formatted) > 0);
  }
});
