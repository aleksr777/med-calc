const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');
const stock = { stockConcentration: '2', stockUnit: 'mg', stockVolume: '4', targetUnit: 'mg' };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test('desired solution requires both valid source concentration and source volume', () => {
  for (const fields of [{}, { stockConcentration: '2' }, { stockVolume: '4' }, { ...stock, stockConcentration: '0' }, { ...stock, stockVolume: '0' }, { ...stock, stockVolume: 'abc' }]) {
    const state = calc.solutionFormState({ ...fields, targetConcentration: '0.08' });
    assert.equal(state.desiredEnabled, false);
    assert.equal(state.result, null);
  }
  const ready = calc.solutionFormState(stock);
  assert.equal(ready.desiredEnabled, true);
  assert.equal(ready.result, null);
});

test('target concentration calculates final volume and diluent immediately', () => {
  const state = calc.solutionFormState({ ...stock, targetConcentration: '0,08' });
  assert.equal(state.desiredEnabled, true);
  close(state.result.finalVolume, 100);
  close(state.result.diluent, 96);
  close(state.targetInUnit, 0.08);
});

test('target final volume calculates concentration immediately', () => {
  const state = calc.solutionFormState({ ...stock, finalVolume: '50', source: 'volume' });
  close(state.result.finalVolume, 50);
  close(state.result.target, 0.16);
  close(state.targetInUnit, 0.16);
  close(state.result.diluent, 46);
});

test('linked target concentration respects selected percent and microgram units', () => {
  const percent = calc.solutionFormState({ ...stock, stockConcentration: '0.2', stockUnit: 'percent', finalVolume: 50, targetUnit: 'percent', source: 'volume' });
  close(percent.targetInUnit, 0.016);
  const micrograms = calc.solutionFormState({ ...stock, finalVolume: 50, targetUnit: 'mcg', source: 'volume' });
  close(micrograms.targetInUnit, 160);
  const fromMicrograms = calc.solutionFormState({ ...stock, targetConcentration: 80, targetUnit: 'mcg' });
  close(fromMicrograms.result.finalVolume, 100);
});

test('source changes retain the last user-edited target concentration or volume', () => {
  const concentration = calc.solutionFormState({ ...stock, stockVolume: '8', targetConcentration: '0.08', finalVolume: '100', source: 'concentration' });
  close(concentration.result.finalVolume, 200);
  close(concentration.result.target, 0.08);
  const volume = calc.solutionFormState({ ...stock, stockVolume: '8', targetConcentration: '0.16', finalVolume: '50', source: 'volume' });
  close(volume.result.finalVolume, 50);
  close(volume.result.target, 0.32);
});

test('invalid target inputs preserve editability but cannot produce a misleading result', () => {
  for (const fields of [{ targetConcentration: '0' }, { targetConcentration: '3' }, { finalVolume: '0', source: 'volume' }, { finalVolume: '3', source: 'volume' }]) {
    const state = calc.solutionFormState({ ...stock, ...fields });
    assert.equal(state.desiredEnabled, true);
    assert.equal(state.result, null);
    assert.ok(Object.keys(state.errors).length);
  }
  for (const fields of [{ targetConcentration: '' }, { finalVolume: '', source: 'volume' }]) {
    const state = calc.solutionFormState({ ...stock, ...fields });
    assert.equal(state.desiredEnabled, true);
    assert.equal(state.result, null);
  }
});

test('unchanged concentration or unchanged final volume requires no diluent', () => {
  assert.equal(calc.solutionFormState({ ...stock, targetConcentration: '2' }).result.diluent, 0);
  assert.equal(calc.solutionFormState({ ...stock, finalVolume: '4', source: 'volume' }).result.diluent, 0);
});

test('overflow in the source amount blocks the target stage', () => {
  const state = calc.solutionFormState({ ...stock, stockConcentration: Number.MAX_VALUE, stockVolume: 10 });
  assert.equal(state.desiredEnabled, false);
  assert.equal(state.result, null);
  assert.ok(state.errors.stockVolume);
});
