const { test } = require('node:test');
const assert = require('node:assert/strict');
const transfer = require('../assets/solution-transfer.js');
const calc = require('../assets/calculations.js');

test('solution links carry the concentration and all five units without server query parameters', () => {
  for (const [concentration, concentrationUnit] of [['0,16', 'mg'], ['160', 'mcg'], ['0,016', 'percent'], ['100', 'unit'], ['5000', 'iu']]) {
    const url = new URL(transfer.link(concentration, concentrationUnit), 'https://example.invalid/med-calc/');
    assert.equal(url.pathname, '/med-calc/infusion-rate.html');
    assert.equal(url.search, '');
    const data = transfer.read(url.hash);
    assert.deepEqual(data, { concentration, concentrationUnit });
    const beforeWeight = calc.infusionFormState(data);
    assert.equal(beforeWeight.concentrationEnabled, false);
    assert.equal(beforeWeight.ratesEnabled, false);
    assert.equal(calc.infusionFormState({ weight: 70, ...data }).ratesEnabled, true);
  }
});

test('transfer preserves the displayed text, decimal separator and manually entered precision', () => {
  for (const value of ['0.0800', '0,0800', '1,', '0000,123456789012345678901234567890']) {
    const hash = new URL(transfer.link(value, 'mg'), 'https://example.invalid/').hash;
    assert.equal(transfer.read(hash).concentration, value);
  }
});

test('the transferred value is the finished concentration calculated from the final volume', () => {
  for (const [targetUnit, expected] of [['mg', '0,16'], ['mcg', '160'], ['percent', '0,016']]) {
    const state = calc.solutionFormState({ stockConcentration: 2, stockUnit: 'mg', stockVolume: 4, finalVolume: 50, targetUnit, source: 'volume' });
    const displayed = calc.formatInput(state.targetInUnit);
    assert.equal(displayed, expected);
    const hash = new URL(transfer.link(displayed, targetUnit), 'https://example.invalid/').hash;
    assert.deepEqual(transfer.read(hash), { concentration: expected, concentrationUnit: targetUnit });
  }
});

test('invalid, empty, negative and out-of-range concentrations cannot be transferred', () => {
  for (const value of ['', '0', '0,0', '-1', '+1', 'abc', '1e3', 'NaN', 'Infinity', '1 000', '1,2.3', '9'.repeat(400), '0.' + '0'.repeat(400) + '1']) {
    assert.equal(transfer.link(value, 'mg'), null, value);
    assert.equal(transfer.read('#' + new URLSearchParams({ concentration: value, unit: 'mg' })), null, value);
  }
});

test('the percentage cap is enforced on imported links without restricting other units', () => {
  assert.ok(transfer.link('100,000', 'percent'));
  for (const concentration of ['101', '100,1', '100.000000000000000001']) {
    assert.equal(transfer.link(concentration, 'percent'), null);
    assert.equal(transfer.read('#' + new URLSearchParams({ concentration, unit: 'percent' })), null);
    assert.ok(transfer.link(concentration, 'mg'));
  }
});

test('missing, unknown and duplicated units or concentrations are ignored', () => {
  for (const unit of [undefined, null, '', 'unknown', '__proto__', 'mg-hour']) assert.equal(transfer.link('1', unit), null);
  for (const hash of ['', '#main', '#concentration=1', '#unit=mg', '#concentration=1&unit=unknown',
    '#concentration=1&unit=mg&unit=iu', '#concentration=1&concentration=100&unit=mg',
    '#concentration=%3Cscript%3E&unit=mg', '#concentration=1&unit=mg%3Cscript%3E']) {
    assert.equal(transfer.read(hash), null, hash);
  }
});
