const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test('activity per hour converts to ml per hour without a mass dose', () => {
  const result = calc.convertInfusion({ concentration: '100', concentrationUnit: 'unit', rate: '100', rateUnit: 'unit-hour', weight: '70' });
  assert.equal(result.volumeRate, 1);
  assert.equal(result.hourlyActivity, 100);
  close(result.weightActivity, 100 / 70);
  assert.equal(result.baseUnit, 'unit');
  assert.equal(result.hourlyDose, null);
  assert.equal(result.weightDose, null);
});

test('ml per hour converts to international units per hour', () => {
  const result = calc.convertInfusion({ concentration: '500', concentrationUnit: 'iu', rate: '2', rateUnit: 'ml-hour', weight: '70' });
  assert.equal(result.hourlyActivity, 1000);
  assert.equal(result.volumeRate, 2);
  close(result.weightActivity, 1000 / 70);
  assert.equal(result.baseUnit, 'iu');
});

test('all activity-rate directions round-trip and conserve concentration', () => {
  for (const [concentrationUnit, rateUnit] of [['unit', 'unit-hour'], ['iu', 'iu-hour']]) {
    for (const concentration of [0.01, 1, 100, 5000]) {
      for (const rate of [0, 0.01, 1.5, 100]) {
        const weight = 70;
        const fromVolume = calc.convertInfusion({ concentration, concentrationUnit, rate, rateUnit: 'ml-hour', weight });
        const fromActivity = calc.convertInfusion({ concentration, concentrationUnit, rate: fromVolume.hourlyActivity, rateUnit, weight });
        const fromWeight = calc.convertInfusion({ concentration, concentrationUnit, rate: fromVolume.weightActivity, rateUnit: concentrationUnit + '-kg-hour', weight });
        close(fromVolume.hourlyActivity, concentration * rate);
        close(fromVolume.weightActivity, concentration * rate / weight);
        close(fromActivity.volumeRate, rate);
        close(fromWeight.volumeRate, rate);
        close(fromWeight.hourlyActivity, fromVolume.hourlyActivity);
      }
    }
  }
});

test('activity rate units must match concentration and cannot be mass units', () => {
  for (const [concentrationUnit, forbidden] of [
    ['unit', ['mg-hour', 'mcg-kg-min', 'iu-hour', 'iu-kg-hour']],
    ['iu', ['mg-hour', 'mcg-kg-min', 'unit-hour', 'unit-kg-hour']],
    ['mg', ['unit-hour', 'iu-hour', 'unit-kg-hour', 'iu-kg-hour']]
  ]) {
    for (const rateUnit of forbidden) assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit, rate: 1, rateUnit, weight: 70 }));
  }
});

test('zero activity rate fills all three outputs with zero', () => {
  for (const [concentrationUnit, hourlyUnit] of [['unit', 'unit-hour'], ['iu', 'iu-hour']]) {
    for (const rateUnit of ['ml-hour', hourlyUnit, concentrationUnit + '-kg-hour']) {
      const result = calc.convertInfusion({ concentration: 100, concentrationUnit, rate: 0, rateUnit, weight: 70 });
      assert.equal(result.hourlyActivity, 0);
      assert.equal(result.weightActivity, 0);
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

test('hourly and volume sources retain their values when weight or concentration changes', () => {
  const raw = { weight: 70, concentration: 100, concentrationUnit: 'unit', rate: 100, rateUnit: 'unit-hour' };
  assert.equal(calc.infusionFormState({ ...raw, weight: 80 }).rates.volumeRate, 1);
  assert.equal(calc.infusionFormState({ ...raw, weight: 80 }).rates.weightActivity, 1.25);
  const hourlySource = calc.infusionFormState({ ...raw, concentration: 200 });
  assert.equal(hourlySource.rates.hourlyActivity, 100);
  assert.equal(hourlySource.rates.volumeRate, 0.5);
  const volumeSource = calc.infusionFormState({ ...raw, concentration: 200, rate: 1, rateUnit: 'ml-hour' });
  assert.equal(volumeSource.rates.volumeRate, 1);
  assert.equal(volumeSource.rates.hourlyActivity, 200);
  close(volumeSource.rates.weightActivity, 200 / 70);
});

test('weight-based activity converts to hourly activity and volume in matching units', () => {
  const units = calc.convertInfusion({ weight: '70', concentration: '100', concentrationUnit: 'unit', rate: '0,5', rateUnit: 'unit-kg-hour' });
  assert.equal(units.weightActivity, 0.5);
  assert.equal(units.hourlyActivity, 35);
  close(units.volumeRate, 0.35);
  const international = calc.convertInfusion({ weight: 80, concentration: 200, concentrationUnit: 'iu', rate: 10, rateUnit: 'iu-kg-hour' });
  assert.equal(international.weightActivity, 10);
  assert.equal(international.hourlyActivity, 800);
  assert.equal(international.volumeRate, 4);
});

test('weight-based source stays fixed when weight or concentration changes', () => {
  for (const concentrationUnit of ['unit', 'iu']) {
    const raw = { weight: 70, concentration: 100, concentrationUnit, rate: 2, rateUnit: concentrationUnit + '-kg-hour' };
    const initial = calc.infusionFormState(raw).rates;
    assert.equal(initial.hourlyActivity, 140);
    close(initial.volumeRate, 1.4);
    const weightChanged = calc.infusionFormState({ ...raw, weight: 80 }).rates;
    assert.equal(weightChanged.weightActivity, 2);
    assert.equal(weightChanged.hourlyActivity, 160);
    close(weightChanged.volumeRate, 1.6);
    const concentrationChanged = calc.infusionFormState({ ...raw, concentration: 200 }).rates;
    assert.equal(concentrationChanged.weightActivity, 2);
    assert.equal(concentrationChanged.hourlyActivity, 140);
    close(concentrationChanged.volumeRate, 0.7);
  }
});

test('weight-based activity requires a valid positive weight', () => {
  for (const concentrationUnit of ['unit', 'iu']) {
    const raw = { concentration: 100, concentrationUnit, rate: 2, rateUnit: concentrationUnit + '-kg-hour' };
    for (const weight of [undefined, '', 0, -1, 'abc', Infinity]) {
      assert.throws(() => calc.convertInfusion({ ...raw, weight }));
      assert.equal(calc.infusionFormState({ ...raw, weight }).ratesEnabled, false);
    }
    assert.equal(calc.convertInfusion({ ...raw, rateUnit: concentrationUnit + '-hour' }).weightActivity, null);
  }
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
  assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: 'unit', rate: Number.MAX_VALUE, rateUnit: 'unit-kg-hour', weight: 2 }));
  assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: 'unit', rate: Number.MIN_VALUE, rateUnit: 'unit-kg-hour', weight: 0.1 }));
  assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: 'iu', rate: 2, rateUnit: 'iu-hour', weight: Number.MIN_VALUE }));
  assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: 'iu', rate: Number.MIN_VALUE, rateUnit: 'iu-hour', weight: Number.MAX_VALUE }));
});
