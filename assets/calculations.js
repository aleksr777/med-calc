(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MedCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function number(value, allowZero = false) {
    let parsed = value;
    if (typeof value !== 'number') {
      const raw = String(value).trim();
      if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(raw)) {
        throw new RangeError('Введите число. Для дробной части используйте точку или запятую.');
      }
      parsed = Number(raw.replace(',', '.'));
      if (parsed === 0 && /[1-9]/.test(raw.split(/[eE]/)[0])) {
        throw new RangeError('Значение выходит за диапазон расчёта.');
      }
    }
    if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
      throw new RangeError(allowZero ? 'Введите число не меньше нуля.' : 'Введите число больше нуля.');
    }
    return parsed === 0 ? 0 : parsed;
  }

  function checked(value, allowZero = false) {
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
      throw new RangeError('Значения выходят за диапазон расчёта. Проверьте исходные данные.');
    }
    return value;
  }

  function concentrationInMg(value, unit) {
    const factors = { mg: 1, mcg: 0.001, percent: 10 };
    if (!Object.hasOwn(factors, unit)) throw new RangeError('Неизвестная единица концентрации.');
    return checked(number(value) * factors[unit]);
  }

  function toWeightDose(rate, weight) {
    const amount = number(rate, true);
    return checked(amount / number(weight) * (1000 / 60), amount === 0);
  }

  function toHourlyDose(dose, weight) {
    const amount = number(dose, true);
    return checked(amount * number(weight) * 0.06, amount === 0);
  }

  function convertInfusion({ rate, rateUnit, concentration, concentrationUnit, weight }) {
    const sourceRate = number(rate, true);
    const solutionConcentration = concentrationInMg(concentration, concentrationUnit);
    const mass = weight === undefined || weight === null || String(weight).trim() === '' ? null : number(weight);
    let hourlyDose;
    if (rateUnit === 'ml-hour') hourlyDose = checked(sourceRate * solutionConcentration, sourceRate === 0);
    else if (rateUnit === 'mg-hour') hourlyDose = sourceRate;
    else if (rateUnit === 'mcg-kg-min') {
      if (mass === null) throw new RangeError('Для дозы в мкг/кг/мин укажите массу тела.');
      hourlyDose = toHourlyDose(sourceRate, mass);
    } else throw new RangeError('Неизвестная единица скорости введения.');
    return {
      sourceRate, rateUnit, concentration: solutionConcentration, weight: mass, hourlyDose,
      volumeRate: rateUnit === 'ml-hour' ? sourceRate : checked(hourlyDose / solutionConcentration, hourlyDose === 0),
      weightDose: mass === null ? null : rateUnit === 'mcg-kg-min' ? sourceRate : toWeightDose(hourlyDose, mass)
    };
  }

  function infusionFormState({ weight, concentration, concentrationUnit = 'mg', rate, rateUnit = 'mcg-kg-min' } = {}) {
    const state = { weight: null, concentrationMg: null, concentrationPercent: null, rates: null,
      concentrationEnabled: false, ratesEnabled: false, errors: {} };
    const empty = value => value === undefined || value === null || String(value).trim() === '';
    if (empty(weight)) return state;
    try { state.weight = number(weight); }
    catch (error) { state.errors.weight = error.message; return state; }
    state.concentrationEnabled = true;
    if (empty(concentration)) return state;
    try {
      const mg = concentrationInMg(concentration, concentrationUnit);
      const percent = checked(mg / 10);
      state.concentrationMg = mg;
      state.concentrationPercent = percent;
    } catch (error) { state.errors.concentration = error.message; return state; }
    state.ratesEnabled = true;
    if (empty(rate)) return state;
    try {
      state.rates = convertInfusion({ rate, rateUnit, concentration: state.concentrationMg, concentrationUnit: 'mg', weight: state.weight });
    } catch (error) { state.errors.rate = error.message; }
    return state;
  }

  function formatInput(value) {
    if (!Number.isFinite(value)) throw new RangeError('Невозможно отобразить значение.');
    return Number(value.toPrecision(12)).toString().replace('.', ',');
  }

  function prepareSolution({ stockConcentration, stockUnit, stockVolume, targetConcentration, targetUnit }) {
    const stock = concentrationInMg(stockConcentration, stockUnit);
    const volume = number(stockVolume);
    const target = concentrationInMg(targetConcentration, targetUnit);
    const tolerance = Number.EPSILON * 16 * Math.max(stock, target);
    if (target - stock > tolerance) {
      throw new RangeError('Нужная концентрация выше исходной. Добавлением растворителя её получить нельзя.');
    }
    const amount = checked(stock * volume);
    const finalVolume = Math.abs(target - stock) <= tolerance ? volume : checked(amount / target);
    return { amount, stock, target, stockVolume: volume, finalVolume, diluent: checked(Math.max(0, finalVolume - volume), true) };
  }

  function concentrationByVolume({ stockConcentration, stockUnit, stockVolume, finalVolume }) {
    const stock = concentrationInMg(stockConcentration, stockUnit);
    const volume = number(stockVolume);
    const total = number(finalVolume);
    if (total < volume) throw new RangeError('Конечный объём не может быть меньше объёма исходного раствора.');
    const amount = checked(stock * volume);
    return { amount, stock, target: checked(amount / total), stockVolume: volume, finalVolume: total, diluent: checked(total - volume, true) };
  }

  function format(value) {
    if (!Number.isFinite(value)) throw new RangeError('Невозможно отобразить результат.');
    const absolute = Math.abs(value);
    if ((absolute > 0 && absolute < 0.000001) || absolute >= 1e9) {
      return value.toExponential(6).replace('.', ',').replace(/0+e/, 'e').replace(/,e/, 'e');
    }
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(value);
  }

  return Object.freeze({ number, concentrationInMg, toWeightDose, toHourlyDose, convertInfusion, infusionFormState, formatInput, prepareSolution, concentrationByVolume, format });
});
