const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
}

const solution = { stockConcentration: '2', stockUnit: 'mg', stockVolume: '4', targetConcentration: '0,08', targetUnit: 'mg' };

test('decimal comma, decimal point, whitespace and small numeric values', () => {
  assert.equal(calc.number(' 0,08 '), 0.08);
  assert.equal(calc.number('.5'), 0.5);
  assert.equal(calc.number('0.08'), 0.08);
  assert.equal(calc.number(1e-8), 1e-8);
  assert.equal(calc.number('-0', true), 0);
});

test('incomplete, ambiguous and nonfinite input is rejected', () => {
  for (const value of ['', ' ', '1,2.3', '1,000,000', '1 000', '12mg', 'Infinity', NaN, Infinity, '-', '--2', '0x10']) {
    assert.throws(() => calc.number(value), RangeError, String(value));
  }
});

test('mass and concentrations must be positive; zero dose is allowed', () => {
  for (const value of ['0', '-1', -0.1]) assert.throws(() => calc.number(value));
  assert.equal(calc.toWeightDose(0, 70), 0);
  assert.equal(calc.toHourlyDose('0', 70), 0);
  assert.throws(() => calc.toWeightDose(3, 0));
  assert.throws(() => calc.toHourlyDose(0.1, -70));
  assert.throws(() => calc.toWeightDose(-1, 70));
});

test('mg/hour to mcg/kg/min reference cases', () => {
  close(calc.toWeightDose('3', '70'), 5 / 7);
  close(calc.toWeightDose('2,5', '70'), 25 / 42);
  close(calc.toWeightDose(6, 100), 1);
  close(calc.toWeightDose(0.0000001, 70), 0.0000001 * 1000 / (60 * 70));
});

test('mcg/kg/min to mg/hour reference cases', () => {
  close(calc.toHourlyDose('0,1', 70), 0.42);
  close(calc.toHourlyDose(1, 100), 6);
  close(calc.toHourlyDose(0.05, 5), 0.015);
});

test('both conversions are inverse without intermediate rounding', () => {
  for (const mass of [0.5, 3, 12.5, 50, 70, 150, 300]) {
    for (const dose of [0, 0.000001, 0.025, 0.1, 0.3333333333, 1, 20, 1000]) {
      close(calc.toHourlyDose(calc.toWeightDose(dose, mass), mass), dose);
      close(calc.toWeightDose(calc.toHourlyDose(dose, mass), mass), dose);
    }
  }
});

test('mass/volume percentage and micrograms use the correct factors', () => {
  close(calc.prepareSolution({ ...solution, stockConcentration: '0,2', stockUnit: 'percent' }).stock, 2);
  close(calc.prepareSolution({ ...solution, stockConcentration: 80, stockUnit: 'mcg' }).stock, 0.08);
  assert.equal(calc.prepareSolution({ ...solution, stockConcentration: 2, stockUnit: 'mg' }).stock, 2);
  assert.throws(() => calc.prepareSolution({ ...solution, stockUnit: 'unknown' }));
});

test('diluent is final volume minus drug volume, not the final volume itself', () => {
  const result = calc.prepareSolution(solution);
  close(result.amount, 8);
  close(result.finalVolume, 100);
  close(result.diluent, 96);
  close(result.target, 0.08);
});

test('percentage, mg/ml and mcg/ml produce equivalent dilution', () => {
  const baseline = calc.prepareSolution(solution);
  const percent = calc.prepareSolution({ ...solution, stockConcentration: '0,2', stockUnit: 'percent', targetConcentration: '80', targetUnit: 'mcg' });
  const targetPercent = calc.prepareSolution({ ...solution, targetConcentration: '0,008', targetUnit: 'percent' });
  close(percent.diluent, baseline.diluent);
  close(targetPercent.diluent, baseline.diluent);
});

test('same concentration requires zero diluent, including float-equivalent units', () => {
  assert.equal(calc.prepareSolution({ ...solution, targetConcentration: 2 }).diluent, 0);
  assert.equal(calc.prepareSolution({ ...solution, stockConcentration: 0.3, targetConcentration: 0.03, targetUnit: 'percent' }).diluent, 0);
});

test('a stronger concentration cannot be obtained by dilution', () => {
  assert.throws(() => calc.prepareSolution({ ...solution, targetConcentration: '3' }), /выше исходной/);
});

test('known final volume: 4 ml of 2 mg/ml in 50 ml total gives 0.16 mg/ml', () => {
  const result = calc.concentrationByVolume({ ...solution, finalVolume: 50 });
  close(result.amount, 8);
  close(result.target, 0.16);
  close(result.diluent, 46);
});

test('final volume must include the original solution volume', () => {
  assert.throws(() => calc.concentrationByVolume({ ...solution, finalVolume: 3 }), /меньше/);
  assert.throws(() => calc.concentrationByVolume({ ...solution, finalVolume: 0 }));
  const result = calc.concentrationByVolume({ ...solution, finalVolume: 4 });
  assert.equal(result.diluent, 0);
  assert.equal(result.target, 2);
});

test('inverse solution calculations conserve the amount of substance', () => {
  for (const stock of [0.03, 0.2, 1, 2, 50]) {
    for (const volume of [0.1, 1, 4, 8, 100]) {
      for (const divisor of [1, 2, 10, 25, 1000]) {
        const input = { stockConcentration: stock, stockUnit: 'mg', stockVolume: volume, targetConcentration: stock / divisor, targetUnit: 'mg' };
        const diluted = calc.prepareSolution(input);
        const checked = calc.concentrationByVolume({ ...input, finalVolume: diluted.finalVolume });
        close(checked.target, input.targetConcentration);
        close(diluted.target * diluted.finalVolume, stock * volume);
      }
    }
  }
});

test('extreme overflow is rejected and small nonzero results are never displayed as zero', () => {
  assert.throws(() => calc.toHourlyDose(Number.MAX_VALUE, 100), RangeError);
  assert.throws(() => calc.prepareSolution({ ...solution, stockConcentration: Number.MAX_VALUE, stockUnit: 'percent' }), RangeError);
  assert.equal(calc.format(0), '0');
  assert.equal(calc.format(0.0000001), '1e-7');
  assert.equal(calc.format(0.000000125), '1,25e-7');
  assert.equal(calc.format(1000000000), '1e+9');
  assert.equal(calc.format(0.714285714285), '0,714286');
  assert.throws(() => calc.format(Infinity), RangeError);
});

const infusion = { rate: '5', rateUnit: 'ml-hour', concentration: '0,4', concentrationUnit: 'mg' };

test('ml/hour to mg/hour uses the concentration of the finished solution', () => {
  const result = calc.convertInfusion(infusion);
  close(result.hourlyDose, 2);
  close(result.volumeRate, 5);
  assert.equal(result.weight, null);
  assert.equal(result.weightDose, null);
});

test('mg/hour to ml/hour does not require body mass', () => {
  const result = calc.convertInfusion({ ...infusion, rate: '2', rateUnit: 'mg-hour', weight: '' });
  close(result.volumeRate, 5);
  close(result.hourlyDose, 2);
  assert.equal(result.weightDose, null);
});

test('optional mass adds the weight-based dose without changing the infusion rate', () => {
  const result = calc.convertInfusion({ ...infusion, weight: '70' });
  close(result.volumeRate, 5);
  close(result.hourlyDose, 2);
  close(result.weightDose, 10 / 21);
});

test('mcg/kg/min converts directly to both mg/hour and ml/hour', () => {
  const result = calc.convertInfusion({ ...infusion, rate: '0,1', rateUnit: 'mcg-kg-min', weight: 70 });
  close(result.hourlyDose, 0.42);
  close(result.volumeRate, 1.05);
  close(result.weightDose, 0.1);
  assert.throws(() => calc.convertInfusion({ ...infusion, rateUnit: 'mcg-kg-min' }), /массу тела/);
});

test('infusion concentration units are equivalent', () => {
  for (const [concentration, concentrationUnit] of [[0.4, 'mg'], [400, 'mcg'], [0.04, 'percent']]) {
    const result = calc.convertInfusion({ ...infusion, concentration, concentrationUnit, weight: 70 });
    close(result.hourlyDose, 2);
    close(result.weightDose, 10 / 21);
  }
});

test('infusion conversions round-trip across all three input units', () => {
  for (const concentration of [0.001, 0.16, 0.4, 2, 10]) {
    for (const weight of [0.5, 5, 70, 150]) {
      for (const rate of [0, 0.01, 1.05, 15, 100]) {
        const fromVolume = calc.convertInfusion({ ...infusion, rate, concentration, weight });
        const fromHourly = calc.convertInfusion({ ...infusion, rate: fromVolume.hourlyDose, rateUnit: 'mg-hour', concentration, weight });
        const fromWeight = calc.convertInfusion({ ...infusion, rate: fromVolume.weightDose, rateUnit: 'mcg-kg-min', concentration, weight });
        close(fromHourly.volumeRate, rate);
        close(fromWeight.volumeRate, rate);
        close(fromWeight.hourlyDose, fromVolume.hourlyDose);
      }
    }
  }
});

test('infusion zero rate is valid, but zero concentration and invalid optional mass are rejected', () => {
  for (const rateUnit of ['ml-hour', 'mg-hour', 'mcg-kg-min']) {
    const result = calc.convertInfusion({ ...infusion, rate: 0, rateUnit, weight: 70 });
    assert.equal(result.hourlyDose, 0);
    assert.equal(result.volumeRate, 0);
    assert.equal(result.weightDose, 0);
  }
  for (const concentration of [0, -1, '', '1,2.3']) assert.throws(() => calc.convertInfusion({ ...infusion, concentration }));
  for (const weight of [0, -1, 'abc']) assert.throws(() => calc.convertInfusion({ ...infusion, weight }));
  assert.throws(() => calc.convertInfusion({ ...infusion, rateUnit: 'unknown' }));
  assert.throws(() => calc.convertInfusion({ ...infusion, rate: -1 }));
});

test('infusion overflow is rejected instead of returning a nonfinite result', () => {
  assert.throws(() => calc.convertInfusion({ ...infusion, rate: Number.MAX_VALUE, concentration: 2 }));
  assert.throws(() => calc.convertInfusion({ ...infusion, rate: Number.MAX_VALUE, rateUnit: 'mg-hour', concentration: 0.1 }));
});

test('unified form locks both dependent stages until a valid positive weight exists', () => {
  for (const weight of ['', undefined, '0', '-70', 'abc']) {
    const state = calc.infusionFormState({ weight, concentration: '0.4', rate: '5', rateUnit: 'ml-hour' });
    assert.equal(state.concentrationEnabled, false);
    assert.equal(state.ratesEnabled, false);
    assert.equal(state.rates, null);
  }
  const state = calc.infusionFormState({ weight: '70' });
  assert.equal(state.concentrationEnabled, true);
  assert.equal(state.ratesEnabled, false);
});

test('selected mass concentration units normalize to the same base', () => {
  for (const [concentration, concentrationUnit] of [['0,04', 'percent'], ['0,4', 'mg']]) {
    const state = calc.infusionFormState({ weight: '70', concentration, concentrationUnit });
    assert.equal(state.ratesEnabled, true);
    close(state.concentration, 0.4);
    assert.equal(state.concentrationBaseUnit, 'mg');
    assert.equal(state.rates, null);
  }
});

test('clearing or invalidating concentration blocks rates and discards the result', () => {
  for (const concentration of ['', '0', '-1', 'abc']) {
    const state = calc.infusionFormState({ weight: '70', concentration, rate: '5', rateUnit: 'ml-hour' });
    assert.equal(state.concentrationEnabled, true);
    assert.equal(state.ratesEnabled, false);
    assert.equal(state.rates, null);
  }
});

test('editing weight preserves the user-selected dose unit as the source', () => {
  const raw = { weight: '70', concentration: '0.4', concentrationUnit: 'mg', rate: '0.1', rateUnit: 'mcg-kg-min' };
  const initial = calc.infusionFormState(raw);
  close(initial.rates.hourlyDose, 0.42);
  const changed = calc.infusionFormState({ ...raw, weight: '80' });
  close(changed.rates.weightDose, 0.1);
  close(changed.rates.hourlyDose, 0.48);
  close(changed.rates.volumeRate, 1.2);
  const hourlySource = calc.infusionFormState({ ...raw, weight: '80', rate: '2', rateUnit: 'mg-hour' });
  close(hourlySource.rates.hourlyDose, 2);
  close(hourlySource.rates.volumeRate, 5);
  close(hourlySource.rates.weightDose, 5 / 12);
});

test('editing concentration keeps the last user-edited rate fixed', () => {
  const state = calc.infusionFormState({ weight: '70', concentration: '0.5', rate: '5', rateUnit: 'ml-hour' });
  close(state.rates.volumeRate, 5);
  close(state.rates.hourlyDose, 2.5);
  close(state.rates.weightDose, 25 / 42);
});

test('zero rate fills all three values with zero, while invalid rate keeps the stage editable', () => {
  for (const rateUnit of ['mcg-kg-min', 'mg-hour', 'ml-hour']) {
    const zero = calc.infusionFormState({ weight: 70, concentration: 0.4, rate: '0', rateUnit });
    assert.equal(zero.ratesEnabled, true);
    assert.equal(zero.rates.hourlyDose, 0);
    assert.equal(zero.rates.volumeRate, 0);
    assert.equal(zero.rates.weightDose, 0);
  }
  const invalid = calc.infusionFormState({ weight: 70, concentration: 0.4, rate: '-1' });
  assert.equal(invalid.ratesEnabled, true);
  assert.equal(invalid.rates, null);
  assert.ok(invalid.errors.rate);
});

test('editable values have no grouping separators and retain up to 12 significant digits', () => {
  assert.equal(calc.formatInput(1000), '1000');
  assert.equal(calc.formatInput(0.4), '0,4');
  assert.equal(calc.formatInput(5 / 7), '0,714285714286');
  for (const number of [0, 1e-12, 1e12, 5 / 7, 1000, 0.08]) {
    close(calc.number(calc.formatInput(number), true), number);
  }
  assert.equal(calc.number('1,2e-7'), 1.2e-7);
  for (const bad of ['1e', '1e-', '1e999', '1e-999']) assert.throws(() => calc.number(bad, true));
});

test('underflow cannot be mistaken for a zero dose', () => {
  assert.throws(() => calc.toWeightDose(1e-300, 1e100));
  assert.throws(() => calc.toHourlyDose(1e-300, 1e-100));
  assert.throws(() => calc.convertInfusion({ rate: 1e-300, rateUnit: 'ml-hour', concentration: 1e-100, concentrationUnit: 'mg' }));
});

test('tiny mass concentration works without an unused percentage conversion', () => {
  const state = calc.infusionFormState({ weight: 1, concentration: Number.MIN_VALUE, concentrationUnit: 'mg', rate: 6, rateUnit: 'ml-hour' });
  assert.equal(state.ratesEnabled, true);
  assert.equal(state.rates.hourlyDose, Number.MIN_VALUE * 6);
  assert.equal(state.rates.volumeRate, 6);
  assert.ok(state.rates.weightDose > 0);
});
