(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MedCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const units = Object.freeze({
    mg: Object.freeze({ family: 'mass', factor: 1, label: 'мг/мл', baseUnit: 'mg', amountUnit: 'мг' }),
    mcg: Object.freeze({ family: 'mass', factor: 0.001, label: 'мкг/мл', baseUnit: 'mg', amountUnit: 'мг' }),
    percent: Object.freeze({ family: 'mass', factor: 10, label: '%', baseUnit: 'mg', amountUnit: 'мг' }),
    unit: Object.freeze({ family: 'unit', factor: 1, label: 'ЕД/мл', baseUnit: 'unit', amountUnit: 'ЕД' }),
    iu: Object.freeze({ family: 'iu', factor: 1, label: 'МЕ/мл', baseUnit: 'iu', amountUnit: 'МЕ' })
  });
  const resultFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 });

  function isEmpty(value) {
    return value === undefined || value === null || String(value).trim() === '';
  }

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

  function solutionUnitInfo(unit) {
    if (!Object.hasOwn(units, unit)) throw new RangeError('Неизвестная единица концентрации.');
    return units[unit];
  }

  function solutionConcentration(value, unit) {
    const parsed = number(value);
    if (unit === 'percent') percentage(parsed);
    return checked(parsed * solutionUnitInfo(unit).factor);
  }

  function percentage(value, calculated = false) {
    const tolerance = calculated ? Number.EPSILON * 100 * 16 : 0;
    if (value > 100 + tolerance) throw new RangeError('Концентрация в процентах не может превышать 100%.');
    return calculated ? Math.min(value, 100) : value;
  }

  function compatibleSolutionUnits(stockUnit, targetUnit) {
    const stock = solutionUnitInfo(stockUnit);
    const target = solutionUnitInfo(targetUnit);
    if (stock.family !== target.family) {
      throw new RangeError('Исходная и нужная концентрации должны быть в совместимых единицах. Калькулятор не выполняет пересчёт между ЕД, МЕ и единицами массы.');
    }
    return stock;
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
    const info = solutionUnitInfo(concentrationUnit);
    const solutionValue = solutionConcentration(concentration, concentrationUnit);
    const mass = isEmpty(weight) ? null : number(weight);
    if (info.family !== 'mass') {
      const hourlyUnit = info.family === 'unit' ? 'unit-hour' : 'iu-hour';
      const weightUnit = info.family === 'unit' ? 'unit-kg-hour' : 'iu-kg-hour';
      if (rateUnit !== 'ml-hour' && rateUnit !== hourlyUnit && rateUnit !== weightUnit) {
        throw new RangeError('Единица скорости должна соответствовать выбранным единицам активности или мл/час.');
      }
      if (rateUnit === weightUnit && mass === null) {
        throw new RangeError('Для дозы на килограмм в час укажите массу тела.');
      }
      const hourlyActivity = rateUnit === 'ml-hour' ? checked(sourceRate * solutionValue, sourceRate === 0)
        : rateUnit === weightUnit ? checked(sourceRate * mass, sourceRate === 0) : sourceRate;
      return {
        sourceRate, rateUnit, concentration: solutionValue, baseUnit: info.baseUnit, weight: mass,
        hourlyActivity, hourlyDose: null, weightDose: null,
        weightActivity: mass === null ? null : rateUnit === weightUnit ? sourceRate : checked(hourlyActivity / mass, hourlyActivity === 0),
        volumeRate: rateUnit === 'ml-hour' ? sourceRate : checked(hourlyActivity / solutionValue, hourlyActivity === 0)
      };
    }
    let hourlyDose;
    if (rateUnit === 'ml-hour') hourlyDose = checked(sourceRate * solutionValue, sourceRate === 0);
    else if (rateUnit === 'mg-hour') hourlyDose = sourceRate;
    else if (rateUnit === 'mcg-kg-min') {
      if (mass === null) throw new RangeError('Для дозы в мкг/кг/мин укажите массу тела.');
      hourlyDose = toHourlyDose(sourceRate, mass);
    } else throw new RangeError('Неизвестная единица скорости введения.');
    return {
      sourceRate, rateUnit, concentration: solutionValue, baseUnit: 'mg', weight: mass, hourlyDose, hourlyActivity: null, weightActivity: null,
      volumeRate: rateUnit === 'ml-hour' ? sourceRate : checked(hourlyDose / solutionValue, hourlyDose === 0),
      weightDose: mass === null ? null : rateUnit === 'mcg-kg-min' ? sourceRate : toWeightDose(hourlyDose, mass)
    };
  }

  function infusionFormState({ weight, concentration, concentrationUnit = 'mg', rate, rateUnit = 'mcg-kg-min' } = {}) {
    const state = { weight: null, concentration: null, concentrationBaseUnit: null, rates: null,
      concentrationEnabled: false, ratesEnabled: false, errors: {} };
    if (isEmpty(weight)) return state;
    try { state.weight = number(weight); }
    catch (error) { state.errors.weight = error.message; return state; }
    state.concentrationEnabled = true;
    if (isEmpty(concentration)) return state;
    try {
      const info = solutionUnitInfo(concentrationUnit);
      const value = solutionConcentration(concentration, concentrationUnit);
      state.concentration = value;
      state.concentrationBaseUnit = info.baseUnit;
    } catch (error) { state.errors.concentration = error.message; return state; }
    state.ratesEnabled = true;
    if (isEmpty(rate)) return state;
    try {
      state.rates = convertInfusion({ rate, rateUnit, concentration: state.concentration, concentrationUnit: state.concentrationBaseUnit, weight: state.weight });
    } catch (error) { state.errors.rate = error.message; }
    return state;
  }

  function formatInput(value) {
    if (!Number.isFinite(value)) throw new RangeError('Невозможно отобразить значение.');
    const rounded = Number(value.toPrecision(12));
    const text = (Number.isFinite(rounded) ? rounded : value).toString();
    if (!text.includes('e')) return text.replace('.', ',');
    const [coefficient, exponent] = text.split('e');
    const sign = coefficient.startsWith('-') ? '-' : '';
    const unsigned = coefficient.replace('-', '');
    const digits = unsigned.replace('.', '');
    const position = (unsigned.includes('.') ? unsigned.indexOf('.') : unsigned.length) + Number(exponent);
    const decimal = position <= 0 ? '0.' + '0'.repeat(-position) + digits
      : position >= digits.length ? digits + '0'.repeat(position - digits.length)
      : digits.slice(0, position) + '.' + digits.slice(position);
    return sign + decimal.replace('.', ',');
  }

  function prepareSolution({ stockConcentration, stockUnit, stockVolume, targetConcentration, targetUnit }) {
    const info = compatibleSolutionUnits(stockUnit, targetUnit);
    const stock = solutionConcentration(stockConcentration, stockUnit);
    const volume = number(stockVolume);
    const target = solutionConcentration(targetConcentration, targetUnit);
    const tolerance = Number.EPSILON * 16 * Math.max(stock, target);
    if (target - stock > tolerance) {
      throw new RangeError('Нужная концентрация выше исходной. Добавлением растворителя её получить нельзя.');
    }
    const amount = checked(stock * volume);
    const finalVolume = Math.abs(target - stock) <= tolerance ? volume : checked(amount / target);
    return { amount, stock, target, stockVolume: volume, finalVolume, diluent: checked(Math.max(0, finalVolume - volume), true), baseUnit: info.baseUnit };
  }

  function concentrationByVolume({ stockConcentration, stockUnit, stockVolume, finalVolume, targetUnit = stockUnit }) {
    const info = compatibleSolutionUnits(stockUnit, targetUnit);
    const stock = solutionConcentration(stockConcentration, stockUnit);
    const volume = number(stockVolume);
    const total = number(finalVolume);
    if (total < volume) throw new RangeError('Конечный объём не может быть меньше объёма исходного раствора.');
    const amount = checked(stock * volume);
    const target = checked(amount / total);
    if (targetUnit === 'percent') percentage(target / units.percent.factor, true);
    return { amount, stock, target, stockVolume: volume, finalVolume: total, diluent: checked(total - volume, true), baseUnit: info.baseUnit };
  }

  function solutionFormState({ stockConcentration, stockUnit = 'mg', stockVolume, targetConcentration, targetUnit = 'mg', finalVolume, source = 'concentration' } = {}) {
    const state = { desiredEnabled: false, result: null, targetInUnit: null, errors: {} };
    let stock;
    let volume;
    if (!isEmpty(stockConcentration)) {
      try { stock = solutionConcentration(stockConcentration, stockUnit); }
      catch (error) { state.errors.stockConcentration = error.message; }
    }
    if (!isEmpty(stockVolume)) {
      try { volume = number(stockVolume); }
      catch (error) { state.errors.stockVolume = error.message; }
    }
    if (stock === undefined || volume === undefined) return state;
    try { checked(stock * volume); }
    catch (error) { state.errors.stockVolume = error.message; return state; }
    state.desiredEnabled = true;
    const key = source === 'volume' ? 'finalVolume' : 'targetConcentration';
    if (isEmpty(source === 'volume' ? finalVolume : targetConcentration)) return state;
    try {
      const data = { stockConcentration, stockUnit, stockVolume, targetConcentration, targetUnit, finalVolume };
      const result = source === 'volume' ? concentrationByVolume(data) : prepareSolution(data);
      let targetInUnit = checked(result.target / solutionUnitInfo(targetUnit).factor);
      if (targetUnit === 'percent') targetInUnit = percentage(targetInUnit, true);
      state.result = result;
      state.targetInUnit = targetInUnit;
    } catch (error) { state.errors[key] = error.message; }
    return state;
  }

  function format(value) {
    if (!Number.isFinite(value)) throw new RangeError('Невозможно отобразить результат.');
    const absolute = Math.abs(value);
    if ((absolute > 0 && absolute < 0.000001) || absolute >= 1e9) {
      return value.toExponential(6).replace('.', ',').replace(/0+e/, 'e').replace(/,e/, 'e');
    }
    return resultFormatter.format(value);
  }

  return Object.freeze({ number, solutionUnitInfo, toWeightDose, toHourlyDose, convertInfusion, infusionFormState, formatInput, prepareSolution, concentrationByVolume, solutionFormState, format });
});
