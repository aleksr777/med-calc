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

test('percentage input accepts the boundary and rejects values above 100 without floating-point rounding', () => {
  for (const value of ['', '.', ',', '.5', '0', '99,99', '100', '100.', '100,000', '000100.00']) {
    assert.equal(input.isAllowed(value, 100), true, value);
  }
  for (const value of ['101', '100,1', '100.000000000000000001', '000101', '999999999999999999999']) {
    assert.equal(input.isAllowed(value, 100), false, value);
    assert.equal(input.isAllowed(value), true, value);
  }
});

test('percentage edits respect the selection and reject an entire out-of-range paste', () => {
  assert.equal(input.canInsert('10', '1', 2, 2, Infinity, 100), false);
  assert.equal(input.canInsert('100,', '1', 4, 4, Infinity, 100), false);
  assert.equal(input.canInsert('100,', '0', 4, 4, Infinity, 100), true);
  assert.equal(input.canInsert('100', '99,9', 0, 3, Infinity, 100), true);
  assert.equal(input.canInsert('100', '101', 0, 3, Infinity, 100), false);
});

function withInputEvents(callback) {
  const previousClass = global.HTMLInputElement;
  class Input {
    constructor(value = '', max = '') {
      Object.assign(this, { value, max, maxLength: -1, inputMode: 'decimal', selectionStart: value.length, selectionEnd: value.length });
    }
    setSelectionRange(start, end) {
      this.selectionStart = Math.min(start, this.value.length);
      this.selectionEnd = Math.min(end, this.value.length);
    }
  }
  global.HTMLInputElement = Input;
  const listeners = new Map();
  const document = { addEventListener(type, listener, capture) {
    assert.equal(capture, true);
    listeners.set(type, listener);
  } };
  const dispatch = (type, target, extra = {}) => {
    const event = { target, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...extra };
    listeners.get(type)(event);
    return event;
  };
  try { input.attach(document); callback({ Input, dispatch }); }
  finally {
    if (previousClass === undefined) delete global.HTMLInputElement;
    else global.HTMLInputElement = previousClass;
  }
}

test('page-wide drag and drop is cancelled for links, text and other elements', () => {
  withInputEvents(({ Input, dispatch }) => {
    for (const target of [{ tagName: 'A' }, { tagName: 'IMG' }, new Input('50', '100')]) {
      assert.equal(dispatch('dragstart', target).defaultPrevented, true);
      const dataTransfer = { dropEffect: 'copy' };
      assert.equal(dispatch('dragover', target, { dataTransfer }).defaultPrevented, true);
      assert.equal(dataTransfer.dropEffect, 'none');
      assert.equal(dispatch('drop', target).defaultPrevented, true);
    }
  });
});

test('input event handlers enforce the percentage cap for typing, paste and input fallback', () => {
  withInputEvents(({ Input, dispatch }) => {
    const field = new Input('100', '100');
    dispatch('focusin', field);
    field.setSelectionRange(0, 3);
    assert.equal(dispatch('beforeinput', field, { data: '101' }).defaultPrevented, true);
    assert.equal(dispatch('paste', field, { clipboardData: { getData: () => '100,1' } }).defaultPrevented, true);
    assert.equal(dispatch('paste', field, { clipboardData: { getData: () => '99,5' } }).defaultPrevented, false);
    field.value = '101';
    assert.equal(dispatch('input', field).stopped, true);
    assert.equal(field.value, '100');
    field.value = '99,5';
    assert.equal(dispatch('input', field).stopped, false);
    field.max = '';
    field.setSelectionRange(0, field.value.length);
    assert.equal(dispatch('paste', field, { clipboardData: { getData: () => '5000' } }).defaultPrevented, false);
  });
});

test('input fallback cannot restore an old value above the newly selected percentage cap', () => {
  withInputEvents(({ Input, dispatch }) => {
    const field = new Input('5000');
    dispatch('focusin', field);
    field.max = '100';
    field.value = '101';
    assert.equal(dispatch('input', field).stopped, true);
    assert.equal(field.value, '');
  });
});
