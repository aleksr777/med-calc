const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');

const stock = { stockConcentration: 100, stockUnit: 'percent', stockVolume: 1, targetConcentration: 50, targetUnit: 'percent' };

test('100 percent is valid for both source and target concentrations', () => {
  const result = calc.prepareSolution({ ...stock, targetConcentration: 100 });
  assert.equal(result.diluent, 0);
  assert.equal(result.finalVolume, 1);
  assert.equal(calc.prepareSolution(stock).finalVolume, 2);
});

test('source percentages above 100 block the preparation stage and direct calculation', () => {
  for (const value of [101, '100,1', 100.00000000000001]) {
    const data = { ...stock, stockConcentration: value };
    assert.throws(() => calc.prepareSolution(data), /100%/);
    const state = calc.solutionFormState(data);
    assert.equal(state.desiredEnabled, false);
    assert.equal(state.result, null);
    assert.match(state.errors.stockConcentration, /100%/);
  }
});

test('target percentages above 100 are rejected even if the source concentration is higher', () => {
  const data = { ...stock, stockConcentration: 2000, stockUnit: 'mg', targetConcentration: 101 };
  assert.throws(() => calc.prepareSolution(data), /100%/);
  const state = calc.solutionFormState(data);
  assert.equal(state.desiredEnabled, true);
  assert.equal(state.result, null);
  assert.match(state.errors.targetConcentration, /100%/);
});

test('a volume-derived percentage above 100 produces an error instead of an out-of-range field', () => {
  const data = { ...stock, stockConcentration: 2000, stockUnit: 'mg', finalVolume: 1, source: 'volume' };
  assert.throws(() => calc.concentrationByVolume(data), /100%/);
  const state = calc.solutionFormState(data);
  assert.equal(state.result, null);
  assert.equal(state.targetInUnit, null);
  assert.match(state.errors.finalVolume, /100%/);
  assert.equal(calc.solutionFormState({ ...data, finalVolume: 10 }).targetInUnit, 20);
});

test('floating-point noise at the calculated 100 percent boundary remains valid', () => {
  const state = calc.solutionFormState({ ...stock, stockVolume: 0.7, finalVolume: 0.7, source: 'volume' });
  assert.ok(state.result);
  assert.equal(state.targetInUnit, 100);
  assert.equal(state.result.diluent, 0);
});

test('infusion percentages enforce the cap in both the form model and direct conversion', () => {
  const data = { weight: 70, concentrationUnit: 'percent', rate: 2, rateUnit: 'ml-hour' };
  const boundary = calc.infusionFormState({ ...data, concentration: 100 });
  assert.equal(boundary.ratesEnabled, true);
  assert.equal(boundary.rates.hourlyDose, 2000);
  for (const concentration of [101, '100,1']) {
    assert.throws(() => calc.convertInfusion({ ...data, concentration }), /100%/);
    const state = calc.infusionFormState({ ...data, concentration });
    assert.equal(state.ratesEnabled, false);
    assert.equal(state.rates, null);
    assert.match(state.errors.concentration, /100%/);
  }
});

test('the percentage cap does not limit mass or activity concentrations', () => {
  for (const unit of ['mg', 'mcg', 'unit', 'iu']) {
    const state = calc.solutionFormState({ stockConcentration: 5000, stockUnit: unit, stockVolume: 1, targetConcentration: 1000, targetUnit: unit });
    assert.equal(state.result.finalVolume, 5);
    const rate = calc.infusionFormState({ weight: 70, concentration: 5000, concentrationUnit: unit, rate: 1, rateUnit: 'ml-hour' });
    assert.equal(rate.ratesEnabled, true);
    assert.equal(rate.rates.volumeRate, 1);
  }
});
