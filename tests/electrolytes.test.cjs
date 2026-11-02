const { test } = require('node:test');
const assert = require('node:assert/strict');
const electrolyte = require('../assets/electrolytes-calculations.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-11 * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const sodium = { weight: '70', waterGroup: 'man', current: '120', target: '124', source: 'target' };

test('sodium goal includes the water in the infusate: 70 kg, TBW 42 L, 120 to 124 needs a modelled 5.6 L', () => {
  const result = electrolyte.sodiumState(sodium).result;
  close(result.water, 42);
  close(result.volume, 5600);
  close(result.change, 4);
  close(result.sodiumAmount, 862.4);
  close((120 * 42 + result.sodiumAmount) / (42 + result.volume / 1000), 124);
});

test('sodium predictions are nonlinear in volume and match Adrogue-Madias at one litre', () => {
  const one = electrolyte.sodiumState({ ...sodium, volume: 1000, source: 'volume' }).result;
  const two = electrolyte.sodiumState({ ...sodium, volume: 2000, source: 'volume' }).result;
  close(one.target, 120 + 34 / 43);
  close(two.target, 120 + 68 / 44);
  assert.notEqual(two.change, one.change * 2);
});

test('sodium target and volume round-trip across all TBW groups without mutating the input', () => {
  for (const [waterGroup, coefficient] of [['man', 0.6], ['woman', 0.5], ['olderMan', 0.5], ['olderWoman', 0.45]]) {
    for (const current of [110, 120, 130]) {
      for (const change of [0.5, 2, 4]) {
        const raw = { ...sodium, waterGroup, current, target: current + change };
        const before = { ...raw };
        const forward = electrolyte.sodiumState(raw).result;
        const reverse = electrolyte.sodiumState({ ...raw, source: 'volume', volume: forward.volume }).result;
        close(forward.water, 70 * coefficient);
        close(reverse.target, raw.target);
        assert.deepEqual(raw, before);
      }
    }
  }
});

test('a zero sodium change requires no solution and zero volume leaves sodium unchanged', () => {
  assert.equal(electrolyte.sodiumState({ ...sodium, target: 120 }).result.volume, 0);
  assert.equal(electrolyte.sodiumState({ ...sodium, volume: 0, source: 'volume' }).result.target, 120);
});

test('sodium linked fields stay locked until all valid baseline data are supplied', () => {
  for (const fields of [{ weight: '' }, { waterGroup: '' }, { current: '' }, { weight: 0 }, { waterGroup: 'unknown' }, { current: 154 }, { current: 160 }]) {
    const state = electrolyte.sodiumState({ ...sodium, ...fields });
    assert.equal(state.linkedEnabled, false);
    assert.equal(state.result, null);
  }
  assert.equal(electrolyte.sodiumState({ ...sodium, target: '' }).linkedEnabled, true);
  assert.equal(electrolyte.sodiumState({ ...sodium, target: '' }).result, null);
});

test('unreachable sodium goals and invalid volumes produce field errors rather than a dose', () => {
  for (const fields of [{ target: 119 }, { target: 154 }, { target: 160 }, { target: 'abc' }, { volume: -1, source: 'volume' }]) {
    const state = electrolyte.sodiumState({ ...sodium, ...fields });
    assert.equal(state.linkedEnabled, true);
    assert.equal(state.result, null);
    assert.ok(state.errors[fields.source === 'volume' ? 'volume' : 'target']);
  }
});

test('20 mmol potassium is 37.2755 mL KCl 4%, and mEq has the same numerical value', () => {
  for (const doseUnit of ['mmol', 'meq']) {
    const result = electrolyte.potassiumState({ dose: '20', doseUnit }).result;
    close(result.volume, 37.2755);
    close(result.mmol, 20);
    close(result.meq, 20);
    close(result.saltGrams, 1.49102);
  }
});

test('potassium dose and volume round-trip and preserve mass in 40 mg/mL concentrate', () => {
  for (const volume of [0, 0.1, 10, 50, 100]) {
    const fromVolume = electrolyte.potassiumState({ volume, source: 'volume' }).result;
    const fromDose = electrolyte.potassiumState({ dose: fromVolume.mmol }).result;
    close(fromVolume.mmol * 74.551, volume * 40);
    close(fromVolume.saltGrams, volume * 0.04);
    close(fromDose.volume, volume);
  }
});

test('calcium requires an explicitly chosen product composition', () => {
  for (const content of ['', undefined, 'unknown', '0.223', '__proto__']) {
    const state = electrolyte.calciumState({ content, dose: 2.23 });
    assert.equal(state.linkedEnabled, false);
    assert.equal(state.result, null);
  }
  assert.equal(electrolyte.calciumState({ content: 'custom', customContent: '', dose: 2.23 }).linkedEnabled, false);
});

test('2.23 mmol calcium or 4.46 mEq equals 10 mL only for the 2.23 mmol/10 mL product', () => {
  const mmol = electrolyte.calciumState({ content: '2.23', dose: '2,23', doseUnit: 'mmol' }).result;
  const meq = electrolyte.calciumState({ content: '2.23', dose: '4,46', doseUnit: 'meq' }).result;
  close(mmol.volume, 10);
  close(meq.volume, 10);
  close(meq.mmol, 2.23);
  close(meq.meq, 4.46);
  const different = electrolyte.calciumState({ content: '2.325', dose: '2.23' }).result;
  close(different.volume, 2.23 / 2.325 * 10);
  assert.notEqual(different.volume, 10);
});

test('the 0.465 mEq/mL calcium formulation has 2.325 mmol in 10 mL', () => {
  const result = electrolyte.calciumState({ content: '2.325', volume: 10, source: 'volume', doseUnit: 'meq' }).result;
  close(result.mmol, 2.325);
  close(result.meq, 4.65);
  close(result.dose, 4.65);
});

test('custom calcium content uses mmol per TEN mL and rejects zero or invalid values', () => {
  const result = electrolyte.calciumState({ content: 'custom', customContent: '2,5', dose: 5 }).result;
  close(result.volume, 20);
  close(result.concentration, 0.25);
  for (const customContent of [0, -1, 'abc']) {
    const state = electrolyte.calciumState({ content: 'custom', customContent, dose: 5 });
    assert.equal(state.result, null);
    assert.equal(state.linkedEnabled, false);
    assert.ok(state.errors.customContent);
  }
});

test('calcium dose and volume round-trip in both amount units for both compositions', () => {
  for (const content of ['2.23', '2.325']) {
    for (const doseUnit of ['mmol', 'meq']) {
      for (const volume of [0, 0.1, 10, 20]) {
        const forward = electrolyte.calciumState({ content, doseUnit, volume, source: 'volume' }).result;
        const reverse = electrolyte.calciumState({ content, doseUnit, dose: forward.dose }).result;
        close(reverse.volume, volume);
      }
    }
  }
});

test('dose calculators reject negative, malformed and incompatible units without returning stale results', () => {
  for (const calculate of [electrolyte.potassiumState, raw => electrolyte.calciumState({ content: '2.23', ...raw })]) {
    for (const fields of [{ dose: -1 }, { dose: 'abc' }, { dose: 1, doseUnit: 'mg' }, { volume: -1, source: 'volume' }]) {
      const state = calculate(fields);
      assert.equal(state.result, null);
      assert.ok(Object.keys(state.errors).length);
    }
    assert.equal(calculate({ dose: '' }).result, null);
    assert.equal(calculate({ dose: 0 }).result.volume, 0);
  }
});

test('overflow and underflow are rejected rather than displayed as zero or infinity', () => {
  assert.equal(electrolyte.sodiumState({ ...sodium, weight: Number.MAX_VALUE }).result, null);
  assert.equal(electrolyte.potassiumState({ dose: Number.MAX_VALUE }).result, null);
  assert.equal(electrolyte.potassiumState({ volume: Number.MIN_VALUE, source: 'volume' }).result, null);
  assert.equal(electrolyte.calciumState({ content: '2.23', volume: Number.MIN_VALUE, source: 'volume' }).result, null);
  assert.equal(electrolyte.calciumState({ content: 'custom', customContent: Number.MIN_VALUE, dose: 1 }).result, null);
});
