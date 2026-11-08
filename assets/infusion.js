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
    weightLabel: document.querySelector('#rate-weight-label'),
    weightHint: document.querySelector('#rate-weight-hint'),
    hourlyLabel: document.querySelector('#rate-hourly-label'),
    hourlyHint: document.querySelector('#rate-hourly-hint'),
    rateStatus: document.querySelector('#rate-status'),
    rateNote: document.querySelector('#rate-note'),
    reset: document.querySelector('#reset-form'),
    status: document.querySelector('#result-status')
  };
  const defaults = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min' };
  const importedSolution = window.SolutionTransfer.read(window.location.hash);
  const raw = { ...defaults, ...importedSolution };
  let pendingSolution = Boolean(importedSolution);

  function hourlyUnit(family = calc.solutionUnitInfo(raw.concentrationUnit).family) {
    return family === 'mass' ? 'mg-hour' : family === 'unit' ? 'unit-hour' : 'iu-hour';
  }

  function weightUnit(family = calc.solutionUnitInfo(raw.concentrationUnit).family) {
    return family === 'mass' ? 'mcg-kg-min' : family === 'unit' ? 'unit-kg-hour' : 'iu-kg-hour';
  }

  function rateSummary(result) {
    const f = calc.formatInput;
    const info = calc.solutionUnitInfo(result.baseUnit);
    return info.family === 'mass'
      ? 'Скорость введения: ' + f(result.weightDose) + ' мкг/кг/мин; ' + f(result.hourlyDose) + ' мг/час; ' + f(result.volumeRate) + ' мл/час.'
      : 'Скорость введения: ' + f(result.weightActivity) + ' ' + info.amountUnit + '/кг/час; '
        + f(result.hourlyActivity) + ' ' + info.amountUnit + '/час; ' + f(result.volumeRate) + ' мл/час.';
  }

  function setError(input, message = '') {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = errorNodes.get(input);
    error.textContent = message;
    error.hidden = !message;
  }

  function render() {
    concentrationInput.max = raw.concentrationUnit === 'percent' ? '100' : '';
    const info = calc.solutionUnitInfo(raw.concentrationUnit);
    const activity = info.family !== 'mass';
    const hourly = hourlyUnit(info.family);
    const weighted = weightUnit(info.family);
    const model = calc.infusionFormState(raw);
    if (!model.concentrationEnabled) {
      if (!pendingSolution) raw.concentration = '';
      raw.rate = '';
    } else {
      pendingSolution = false;
      if (!model.ratesEnabled) raw.rate = '';
    }
    ui.concentration.disabled = !model.concentrationEnabled;
    ui.rates.disabled = !model.ratesEnabled;
    ui.weightLabel.textContent = activity ? info.amountUnit + '/кг/час' : 'мкг/кг/мин';
    ui.weightHint.textContent = activity ? 'Активность на массу тела за час' : 'Доза на массу тела';
    ui.hourlyLabel.textContent = activity ? info.amountUnit + '/час' : 'мг/час';
    ui.hourlyHint.textContent = activity ? 'Активность препарата за час' : 'Количество вещества за час';
    setError(weightInput, model.errors.weight);
    concentrationInput.value = raw.concentration;
    concentrationUnit.value = raw.concentrationUnit;
    setError(concentrationInput, model.errors.concentration);
    const rateInputs = { [weighted]: weightRateInput, [hourly]: hourlyRateInput, 'ml-hour': volumeRateInput };
    const values = model.rates ? {
      [weighted]: activity ? model.rates.weightActivity : model.rates.weightDose,
      [hourly]: activity ? model.rates.hourlyActivity : model.rates.hourlyDose,
      'ml-hour': model.rates.volumeRate
    } : null;
    for (const [unit, input] of Object.entries(rateInputs)) {
      input.value = unit === raw.rateUnit && model.ratesEnabled ? raw.rate : values ? calc.formatInput(values[unit]) : '';
      setError(input, unit === raw.rateUnit ? model.errors.rate : '');
    }
    ui.rateStatus.textContent = model.ratesEnabled ? 'Все три поля доступны для ввода'
      : model.concentrationEnabled ? 'Сначала введите концентрацию' : 'Сначала введите вес и концентрацию';
    ui.rateNote.textContent = 'Введите значение в любом из трёх полей — остальные пересчитаются автоматически.';
    ui.reset.disabled = !raw.weight && !raw.concentration && !raw.rate;
    ui.status.textContent = model.rates ? rateSummary(model.rates) : Object.values(model.errors).join(' ')
      || (model.ratesEnabled ? 'Введите скорость в любом из трёх полей.' : model.concentrationEnabled ? 'Введите концентрацию раствора.' : 'Введите вес пациента.');
  }

  weightInput.addEventListener('input', () => { raw.weight = weightInput.value; render(); });
  concentrationInput.addEventListener('input', () => { raw.concentration = concentrationInput.value; render(); });
  concentrationUnit.addEventListener('change', () => {
    const previousFamily = calc.solutionUnitInfo(raw.concentrationUnit).family;
    raw.concentrationUnit = concentrationUnit.value;
    if (raw.concentrationUnit === 'percent' && !window.DecimalInputs.isAllowed(raw.concentration, 100)) raw.concentration = '';
    const family = calc.solutionUnitInfo(raw.concentrationUnit).family;
    if (previousFamily !== family) {
      raw.rate = '';
      raw.rateUnit = family === 'mass' ? 'mcg-kg-min' : hourlyUnit(family);
    }
    render();
  });
  weightRateInput.addEventListener('input', () => { raw.rate = weightRateInput.value; raw.rateUnit = weightUnit(); render(); });
  hourlyRateInput.addEventListener('input', () => { raw.rate = hourlyRateInput.value; raw.rateUnit = hourlyUnit(); render(); });
  volumeRateInput.addEventListener('input', () => { raw.rate = volumeRateInput.value; raw.rateUnit = 'ml-hour'; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    pendingSolution = false;
    Object.assign(raw, defaults);
    weightInput.value = '';
    if (window.SolutionTransfer.read(window.location.hash)) {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(null, '', url);
    }
    render();
    weightInput.focus();
  });
  render();
})();
