(function () {
  'use strict';
  const calc = window.MedCalc;
  const form = document.querySelector('#infusion-form');
  const weightInput = document.querySelector('#weight');
  const concentrationInput = document.querySelector('#concentration');
  const concentrationUnit = document.querySelector('#concentration-unit');
  const weightRateInput = document.querySelector('#rate-weight');
  const hourlyRateInput = document.querySelector('#rate-hourly');
  const volumeRateInput = document.querySelector('#rate-ml');
  const errorNodes = new Map([weightInput, concentrationInput, weightRateInput, hourlyRateInput, volumeRateInput]
    .map(input => [input, document.getElementById(input.id + '-error')]));
  const ui = {
    concentration: document.querySelector('#concentration-block'),
    rates: document.querySelector('#rate-block'),
    weightRate: document.querySelector('#rate-weight-field'),
    weightEquals: document.querySelector('#rate-weight-equals'),
    rateFields: document.querySelector('#rate-fields'),
    hourlyLabel: document.querySelector('#rate-hourly-label'),
    hourlyHint: document.querySelector('#rate-hourly-hint'),
    rateStatus: document.querySelector('#rate-status'),
    rateNote: document.querySelector('#rate-note'),
    reset: document.querySelector('#reset-form'),
    status: document.querySelector('#result-status')
  };
  const defaults = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min' };
  const raw = { ...defaults };

  function hourlyUnit(family = calc.solutionUnitInfo(raw.concentrationUnit).family) {
    return family === 'mass' ? 'mg-hour' : family === 'unit' ? 'unit-hour' : 'iu-hour';
  }

  function rateSummary(result) {
    const f = calc.formatInput;
    const info = calc.solutionUnitInfo(result.baseUnit);
    return info.family === 'mass'
      ? 'Скорость введения: ' + f(result.weightDose) + ' мкг/кг/мин; ' + f(result.hourlyDose) + ' мг/час; ' + f(result.volumeRate) + ' мл/час.'
      : 'Скорость введения: ' + f(result.hourlyActivity) + ' ' + info.amountUnit + '/час; ' + f(result.volumeRate) + ' мл/час.';
  }

  function setError(input, message = '') {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = errorNodes.get(input);
    error.textContent = message;
    error.hidden = !message;
  }

  function render() {
    const info = calc.solutionUnitInfo(raw.concentrationUnit);
    const activity = info.family !== 'mass';
    const hourly = hourlyUnit(info.family);
    const model = calc.infusionFormState(raw);
    if (!model.concentrationEnabled) {
      raw.concentration = '';
      raw.rate = '';
    } else if (!model.ratesEnabled) raw.rate = '';
    ui.concentration.disabled = !model.concentrationEnabled;
    ui.rates.disabled = !model.ratesEnabled;
    ui.weightRate.hidden = activity;
    ui.weightEquals.hidden = activity;
    weightRateInput.disabled = activity;
    ui.rateFields.classList.toggle('rate-fields-activity', activity);
    ui.hourlyLabel.textContent = activity ? info.amountUnit + '/час' : 'мг/час';
    ui.hourlyHint.textContent = activity ? 'Активность препарата за час' : 'Количество вещества за час';
    setError(weightInput, model.errors.weight);
    concentrationInput.value = model.concentrationEnabled ? raw.concentration : '';
    concentrationUnit.value = raw.concentrationUnit;
    setError(concentrationInput, model.errors.concentration);
    const rateInputs = { [hourly]: hourlyRateInput, 'ml-hour': volumeRateInput };
    if (!activity) rateInputs['mcg-kg-min'] = weightRateInput;
    else { weightRateInput.value = ''; setError(weightRateInput); }
    const values = model.rates ? {
      'mcg-kg-min': model.rates.weightDose,
      [hourly]: activity ? model.rates.hourlyActivity : model.rates.hourlyDose,
      'ml-hour': model.rates.volumeRate
    } : null;
    for (const [unit, input] of Object.entries(rateInputs)) {
      input.value = unit === raw.rateUnit && model.ratesEnabled ? raw.rate : values ? calc.formatInput(values[unit]) : '';
      setError(input, unit === raw.rateUnit ? model.errors.rate : '');
    }
    ui.rateStatus.textContent = model.ratesEnabled ? (activity ? 'Оба поля доступны для ввода' : 'Все три поля доступны для ввода')
      : model.concentrationEnabled ? 'Сначала введите концентрацию' : 'Сначала введите вес и концентрацию';
    ui.rateNote.textContent = activity
      ? 'Введите значение в любом из двух полей — второе пересчитается автоматически.'
      : 'Введите значение в любом из трёх полей — остальные пересчитаются автоматически.';
    ui.reset.disabled = !raw.weight && !raw.concentration && !raw.rate;
    ui.status.textContent = model.rates ? rateSummary(model.rates) : Object.values(model.errors).join(' ')
      || (model.ratesEnabled ? 'Введите скорость в любом из ' + (activity ? 'двух' : 'трёх') + ' полей.' : model.concentrationEnabled ? 'Введите концентрацию раствора.' : 'Введите вес пациента.');
  }

  weightInput.addEventListener('input', () => { raw.weight = weightInput.value; render(); });
  concentrationInput.addEventListener('input', () => { raw.concentration = concentrationInput.value; render(); });
  concentrationUnit.addEventListener('change', () => {
    const previousFamily = calc.solutionUnitInfo(raw.concentrationUnit).family;
    raw.concentrationUnit = concentrationUnit.value;
    const family = calc.solutionUnitInfo(raw.concentrationUnit).family;
    if (previousFamily !== family) {
      raw.rate = '';
      raw.rateUnit = family === 'mass' ? 'mcg-kg-min' : hourlyUnit(family);
    }
    render();
  });
  weightRateInput.addEventListener('input', () => { raw.rate = weightRateInput.value; raw.rateUnit = 'mcg-kg-min'; render(); });
  hourlyRateInput.addEventListener('input', () => { raw.rate = hourlyRateInput.value; raw.rateUnit = hourlyUnit(); render(); });
  volumeRateInput.addEventListener('input', () => { raw.rate = volumeRateInput.value; raw.rateUnit = 'ml-hour'; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.assign(raw, defaults);
    weightInput.value = '';
    render();
    weightInput.focus();
  });
  render();
})();
