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
  close(calc.concentrationInMg('0,2', 'percent'), 2);
  close(calc.concentrationInMg(80, 'mcg'), 0.08);
  assert.equal(calc.concentrationInMg(2, 'mg'), 2);
  assert.throws(() => calc.concentrationInMg(2, 'unknown'));
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
  assert.throws(() => calc.concentrationInMg(Number.MAX_VALUE, 'percent'), RangeError);
  assert.equal(calc.format(0), '0');
  assert.equal(calc.format(0.0000001), '1e-7');
  assert.equal(calc.format(0.000000125), '1,25e-7');
  assert.equal(calc.format(1000000000), '1e+9');
  assert.equal(calc.format(0.714285714285), '0,714286');
  assert.throws(() => calc.format(Infinity), RangeError);
});
