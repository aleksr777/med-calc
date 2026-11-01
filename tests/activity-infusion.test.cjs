const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test('activity per hour converts to ml per hour without a mass dose', () => {
  const result = calc.convertInfusion({ concentration: '100', concentrationUnit: 'unit', rate: '100', rateUnit: 'unit-hour', weight: '70' });
  assert.equal(result.volumeRate, 1);
  assert.equal(result.hourlyActivity, 100);
  assert.equal(result.baseUnit, 'unit');
  assert.equal(result.hourlyDose, null);
  assert.equal(result.weightDose, null);
});

test('ml per hour converts to international units per hour', () => {
  const result = calc.convertInfusion({ concentration: '500', concentrationUnit: 'iu', rate: '2', rateUnit: 'ml-hour', weight: '70' });
  assert.equal(result.hourlyActivity, 1000);
  assert.equal(result.volumeRate, 2);
  assert.equal(result.baseUnit, 'iu');
});

test('both activity-rate directions round-trip and conserve concentration', () => {
  for (const [concentrationUnit, rateUnit] of [['unit', 'unit-hour'], ['iu', 'iu-hour']]) {
    for (const concentration of [0.01, 1, 100, 5000]) {
      for (const rate of [0, 0.01, 1.5, 100]) {
        const fromVolume = calc.convertInfusion({ concentration, concentrationUnit, rate, rateUnit: 'ml-hour' });
        const fromActivity = calc.convertInfusion({ concentration, concentrationUnit, rate: fromVolume.hourlyActivity, rateUnit });
        close(fromVolume.hourlyActivity, concentration * rate);
        close(fromActivity.volumeRate, rate);
      }
    }
  }
});

test('activity rate units must match concentration and cannot be mass units', () => {
  for (const [concentrationUnit, forbidden] of [
    ['unit', ['mg-hour', 'mcg-kg-min', 'iu-hour']],
    ['iu', ['mg-hour', 'mcg-kg-min', 'unit-hour']],
    ['mg', ['unit-hour', 'iu-hour']]
  ]) {
    for (const rateUnit of forbidden) assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit, rate: 1, rateUnit, weight: 70 }));
  }
});

test('zero activity rate fills both outputs with zero', () => {
  for (const [concentrationUnit, hourlyUnit] of [['unit', 'unit-hour'], ['iu', 'iu-hour']]) {
    for (const rateUnit of ['ml-hour', hourlyUnit]) {
      const result = calc.convertInfusion({ concentration: 100, concentrationUnit, rate: 0, rateUnit });
      assert.equal(result.hourlyActivity, 0);
      assert.equal(result.volumeRate, 0);
    }
  }
});

test('activity mode retains weight and concentration gating without inventing mass values', () => {
  const raw = { weight: 70, concentration: 100, concentrationUnit: 'unit', rate: 100, rateUnit: 'unit-hour' };
  for (const weight of ['', 0, 'abc']) {
    const state = calc.infusionFormState({ ...raw, weight });
    assert.equal(state.concentrationEnabled, false);
    assert.equal(state.ratesEnabled, false);
    assert.equal(state.rates, null);
  }
  for (const concentration of ['', 0, 'abc']) {
    const state = calc.infusionFormState({ ...raw, concentration });
    assert.equal(state.concentrationEnabled, true);
    assert.equal(state.ratesEnabled, false);
    assert.equal(state.rates, null);
  }
  const ready = calc.infusionFormState(raw);
  assert.equal(ready.concentration, 100);
  assert.equal(ready.concentrationBaseUnit, 'unit');
  assert.equal(ready.rates.hourlyDose, null);
  assert.equal(ready.rates.weightDose, null);
  assert.equal(ready.rates.volumeRate, 1);
});

test('weight changes do not change activity rates; concentration changes retain the source rate', () => {
  const raw = { weight: 70, concentration: 100, concentrationUnit: 'unit', rate: 100, rateUnit: 'unit-hour' };
  assert.equal(calc.infusionFormState({ ...raw, weight: 80 }).rates.volumeRate, 1);
  const hourlySource = calc.infusionFormState({ ...raw, concentration: 200 });
  assert.equal(hourlySource.rates.hourlyActivity, 100);
  assert.equal(hourlySource.rates.volumeRate, 0.5);
  const volumeSource = calc.infusionFormState({ ...raw, concentration: 200, rate: 1, rateUnit: 'ml-hour' });
  assert.equal(volumeSource.rates.volumeRate, 1);
  assert.equal(volumeSource.rates.hourlyActivity, 200);
});

test('invalid activity rates remain editable but do not produce derived values', () => {
  for (const rate of ['-1', 'abc']) {
    const state = calc.infusionFormState({ weight: 70, concentration: 100, concentrationUnit: 'unit', rate, rateUnit: 'unit-hour' });
    assert.equal(state.ratesEnabled, true);
    assert.equal(state.rates, null);
    assert.ok(state.errors.rate);
  }
});

test('activity calculations reject overflow, underflow and nonpositive concentrations', () => {
  for (const concentration of [0, -1, '']) assert.throws(() => calc.convertInfusion({ concentration, concentrationUnit: 'unit', rate: 1, rateUnit: 'ml-hour' }));
  assert.throws(() => calc.convertInfusion({ concentration: 2, concentrationUnit: 'unit', rate: Number.MAX_VALUE, rateUnit: 'ml-hour' }));
  assert.throws(() => calc.convertInfusion({ concentration: 1e-100, concentrationUnit: 'iu', rate: 1e-300, rateUnit: 'ml-hour' }));
  assert.throws(() => calc.convertInfusion({ concentration: 1e100, concentrationUnit: 'iu', rate: 1e-300, rateUnit: 'iu-hour' }));
});
