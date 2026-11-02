(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calculations.js'));
  else root.Electrolytes = factory(root.MedCalc);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calc) {
  'use strict';

  const SODIUM = 154; // mmol/L of Na+ in NaCl 0.9%.
  const POTASSIUM = 40 / 74.551; // mmol/mL of K+ in KCl 4% (40 mg/mL).
  const waterFactors = Object.freeze({ man: 0.6, woman: 0.5, olderMan: 0.5, olderWoman: 0.45 });
  const calciumContents = Object.freeze({ '2.23': 2.23, '2.325': 2.325 }); // mmol Ca2+ per 10 mL; verify product label.
  const empty = value => value === undefined || value === null || String(value).trim() === '';
  const checked = (value, allowZero = false) => {
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) throw new RangeError('Значения выходят за диапазон расчёта.');
    return value;
  };
  function choice(options, value) {
    if (!Object.hasOwn(options, value)) throw new RangeError('Выберите вариант из списка.');
    return options[value];
  }
  function readFields(raw, rules) {
    const values = {};
    const errors = {};
    let complete = true;
    for (const [name, parse] of Object.entries(rules)) {
      if (empty(raw[name])) { complete = false; continue; }
      try { values[name] = parse(raw[name]); }
      catch (error) { errors[name] = error.message; complete = false; }
    }
    return { values, errors, complete };
  }

  function sodiumState(raw = {}) {
    const base = readFields(raw, {
      weight: value => calc.number(value),
      waterGroup: value => choice(waterFactors, value),
      current: value => {
        const current = calc.number(value);
        if (current >= SODIUM) throw new RangeError('Модель повышения Na⁺ раствором 0,9% рассчитана на исходный Na⁺ ниже 154 ммоль/л.');
        return current;
      }
    });
    const state = { linkedEnabled: false, result: null, errors: base.errors };
    if (!base.complete) return state;
    const { weight, waterGroup, current } = base.values;
    let water;
    try { water = checked(weight * waterGroup); }
    catch (error) { state.errors.weight = error.message; return state; }
    state.linkedEnabled = true;
    const key = raw.source === 'volume' ? 'volume' : 'target';
    if (empty(raw[key])) return state;
    try {
      let target;
      let volume;
      if (key === 'target') {
        target = calc.number(raw.target);
        if (target < current) throw new RangeError('Целевой Na⁺ не должен быть ниже исходного в модели повышения натрия.');
        if (target >= SODIUM) throw new RangeError('Целевой Na⁺ должен быть ниже 154 ммоль/л: модель не достигает концентрации инфузата конечным объёмом.');
        volume = target === current ? 0 : checked((target - current) / (SODIUM - target) * water * 1000);
      } else {
        volume = calc.number(raw.volume, true);
        const litres = checked(volume / 1000, volume === 0);
        const denominator = checked(water + litres);
        const change = checked((SODIUM - current) * (litres / denominator), volume === 0);
        target = checked(current + change);
        if (volume > 0 && (target === current || target >= SODIUM)) throw new RangeError('Изменение Na⁺ выходит за точность этой модели.');
      }
      const change = target - current;
      state.result = { volume, target, change, water, sodiumAmount: checked(volume / 1000 * SODIUM, volume === 0) };
    } catch (error) { state.errors[key] = error.message; }
    return state;
  }

  function doseState(raw, concentration, valence) {
    const state = { linkedEnabled: true, result: null, errors: {} };
    if (!['mmol', 'meq'].includes(raw.doseUnit)) {
      state.errors.doseUnit = 'Выберите единицу дозы.';
      return state;
    }
    const key = raw.source === 'volume' ? 'volume' : 'dose';
    if (empty(raw[key])) return state;
    try {
      const value = calc.number(raw[key], true);
      const mmol = key === 'volume' ? checked(value * concentration, value === 0)
        : checked(raw.doseUnit === 'meq' ? value / valence : value, value === 0);
      const volume = key === 'volume' ? value : checked(mmol / concentration, mmol === 0);
      const meq = checked(mmol * valence, mmol === 0);
      state.result = { volume, mmol, meq, dose: raw.doseUnit === 'meq' ? meq : mmol, concentration };
    } catch (error) { state.errors[key] = error.message; }
    return state;
  }

  function potassiumState(raw = {}) {
    const state = doseState({ doseUnit: 'mmol', ...raw }, POTASSIUM, 1);
    if (state.result) {
      try { state.result.saltGrams = checked(state.result.volume * 0.04, state.result.volume === 0); }
      catch (error) { state.errors[raw.source === 'volume' ? 'volume' : 'dose'] = error.message; state.result = null; }
    }
    return state;
  }

  function calciumState(raw = {}) {
    const state = { linkedEnabled: false, result: null, errors: {} };
    if (empty(raw.content)) return state;
    let content;
    try {
      if (raw.content === 'custom') {
        if (empty(raw.customContent)) return state;
        content = calc.number(raw.customContent);
      } else content = choice(calciumContents, raw.content);
    } catch (error) { state.errors[raw.content === 'custom' ? 'customContent' : 'content'] = error.message; return state; }
    try { return doseState({ doseUnit: 'mmol', ...raw }, checked(content / 10), 2); }
    catch (error) { state.errors[raw.content === 'custom' ? 'customContent' : 'content'] = error.message; return state; }
  }

  return Object.freeze({ SODIUM, POTASSIUM, sodiumState, potassiumState, calciumState });
});
