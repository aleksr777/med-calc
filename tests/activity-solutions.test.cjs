const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../assets/calculations.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test('unit-based dilution retains the activity and includes the stock volume', () => {
  const state = calc.solutionFormState({ stockConcentration: '100', stockUnit: 'unit', stockVolume: '0,5', targetConcentration: '1', targetUnit: 'unit' });
  assert.equal(state.desiredEnabled, true);
  assert.equal(state.result.baseUnit, 'unit');
  assert.equal(state.result.stock, 100);
  assert.equal(state.result.amount, 50);
  assert.equal(state.result.finalVolume, 50);
  assert.equal(state.result.diluent, 49.5);
  assert.equal(state.targetInUnit, 1);
});

test('international-unit concentration is calculated from the total final volume', () => {
  const state = calc.solutionFormState({ stockConcentration: '5000', stockUnit: 'iu', stockVolume: '5', finalVolume: '50', targetUnit: 'iu', source: 'volume' });
  assert.equal(state.result.baseUnit, 'iu');
  assert.equal(state.result.amount, 25000);
  assert.equal(state.result.target, 500);
  assert.equal(state.targetInUnit, 500);
  assert.equal(state.result.diluent, 45);
});

test('activity-based calculations conserve activity and round-trip in both directions', () => {
  for (const unit of ['unit', 'iu']) {
    for (const concentration of [0.25, 100, 5000]) {
      for (const volume of [0.1, 1, 5]) {
        for (const divisor of [1, 2, 10, 100]) {
          const input = { stockConcentration: concentration, stockUnit: unit, stockVolume: volume, targetConcentration: concentration / divisor, targetUnit: unit };
          const diluted = calc.prepareSolution(input);
          const reverse = calc.concentrationByVolume({ ...input, finalVolume: diluted.finalVolume });
          close(diluted.amount, diluted.target * diluted.finalVolume);
          close(reverse.target, input.targetConcentration);
          close(diluted.diluent + volume, diluted.finalVolume);
          assert.equal(reverse.baseUnit, unit);
        }
      }
    }
  }
});

test('unit activity, international-unit activity and mass cannot be mixed', () => {
  for (const stockUnit of ['mg', 'mcg', 'percent', 'unit', 'iu']) {
    for (const targetUnit of ['mg', 'mcg', 'percent', 'unit', 'iu']) {
      if (calc.solutionUnitInfo(stockUnit).family === calc.solutionUnitInfo(targetUnit).family) continue;
      const input = { stockConcentration: 100, stockUnit, stockVolume: 1, targetConcentration: 1, targetUnit, finalVolume: 100 };
      assert.throws(() => calc.prepareSolution(input), /совместимых единицах/);
      assert.throws(() => calc.concentrationByVolume(input), /совместимых единицах/);
      for (const source of ['concentration', 'volume']) {
        const state = calc.solutionFormState({ ...input, source });
        assert.equal(state.result, null);
        assert.equal(state.targetInUnit, null);
        assert.equal(state.desiredEnabled, true);
        assert.ok(Object.keys(state.errors).length);
      }
    }
  }
});

test('activity concentrations reject mass infusion rates', () => {
  for (const unit of ['unit', 'iu']) {
    assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: unit, rate: 1, rateUnit: 'mg-hour', weight: 70 }));
    assert.throws(() => calc.convertInfusion({ concentration: 100, concentrationUnit: unit, rate: 1, rateUnit: 'mcg-kg-min', weight: 70 }));
  }
});

test('source and target validation still applies to activity-based dilution', () => {
  for (const unit of ['unit', 'iu']) {
    const input = { stockConcentration: 100, stockUnit: unit, stockVolume: 1, targetConcentration: 1, targetUnit: unit };
    assert.equal(calc.solutionFormState({ ...input, stockVolume: '' }).desiredEnabled, false);
    assert.equal(calc.solutionFormState({ ...input, stockConcentration: 0 }).desiredEnabled, false);
    assert.equal(calc.solutionFormState({ ...input, stockConcentration: Number.MAX_VALUE, stockVolume: 10 }).desiredEnabled, false);
    assert.equal(calc.prepareSolution({ ...input, targetConcentration: 100 }).diluent, 0);
    assert.throws(() => calc.prepareSolution({ ...input, targetConcentration: 101 }), /выше исходной/);
    assert.throws(() => calc.concentrationByVolume({ ...input, finalVolume: 0.5 }), /меньше/);
  }
});

test('changing stock data retains the target source in activity units', () => {
  const input = { stockConcentration: 100, stockUnit: 'unit', stockVolume: 2, targetUnit: 'unit', finalVolume: 50, targetConcentration: 1 };
  const byVolume = calc.solutionFormState({ ...input, source: 'volume' });
  assert.equal(byVolume.result.finalVolume, 50);
  assert.equal(byVolume.targetInUnit, 4);
  const byConcentration = calc.solutionFormState({ ...input, source: 'concentration' });
  assert.equal(byConcentration.result.target, 1);
  assert.equal(byConcentration.result.finalVolume, 200);
});
