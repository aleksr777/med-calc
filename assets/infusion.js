(function () {
  'use strict';
  const calc = window.MedCalc;
  const form = document.querySelector('#infusion-form');
  const weightInput = document.querySelector('#weight');
  const concentrationBlock = document.querySelector('#concentration-block');
  const rateBlock = document.querySelector('#rate-block');
  const concentrationInput = document.querySelector('#concentration');
  const concentrationUnit = document.querySelector('#concentration-unit');
  const weightRateInput = document.querySelector('#rate-weight');
  const hourlyRateInput = document.querySelector('#rate-hourly');
  const volumeRateInput = document.querySelector('#rate-ml');
  const rateFields = document.querySelector('#rate-fields');
  const copyButton = document.querySelector('#copy-result');
  const resetButton = document.querySelector('#reset-form');
  const feedback = document.querySelector('#copy-feedback');
  const status = document.querySelector('#result-status');
  const raw = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min' };
  let model;

  function hourlyUnit() {
    const family = calc.solutionUnitInfo(raw.concentrationUnit).family;
    return family === 'mass' ? 'mg-hour' : family === 'unit' ? 'unit-hour' : 'iu-hour';
  }

  function rateSummary(result) {
    const f = calc.formatInput;
    const info = calc.solutionUnitInfo(result.baseUnit);
    return info.family === 'mass'
      ? 'Скорость введения: ' + f(result.weightDose) + ' мкг/кг/мин; ' + f(result.hourlyDose) + ' мг/час; ' + f(result.volumeRate) + ' мл/час.'
      : 'Скорость введения: ' + f(result.hourlyActivity) + ' ' + info.amountUnit + '/час; ' + f(result.volumeRate) + ' мл/час.';
  }

  function setError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.querySelector('#' + input.id + '-error');
    error.textContent = message || '';
    error.hidden = !message;
  }

  function render() {
    const info = calc.solutionUnitInfo(raw.concentrationUnit);
    const activity = info.family !== 'mass';
    model = calc.infusionFormState(raw);
    if (!model.concentrationEnabled) {
      raw.concentration = '';
      raw.rate = '';
    } else if (!model.ratesEnabled) raw.rate = '';
    concentrationBlock.disabled = !model.concentrationEnabled;
    rateBlock.disabled = !model.ratesEnabled;
    concentrationBlock.classList.toggle('is-locked', concentrationBlock.disabled);
    rateBlock.classList.toggle('is-locked', rateBlock.disabled);
    document.querySelector('#rate-weight-field').hidden = activity;
    document.querySelector('#rate-weight-equals').hidden = activity;
    weightRateInput.disabled = activity;
    rateFields.classList.toggle('rate-fields-activity', activity);
    document.querySelector('#rate-hourly-label').textContent = activity ? info.amountUnit + '/час' : 'мг/час';
    document.querySelector('#rate-hourly-hint').textContent = activity ? 'Активность препарата за час' : 'Количество вещества за час';
    setError(weightInput, model.errors.weight);
    concentrationInput.value = model.concentrationEnabled ? raw.concentration : '';
    concentrationUnit.value = raw.concentrationUnit;
    setError(concentrationInput, model.errors.concentration);
    const rateInputs = { [hourlyUnit()]: hourlyRateInput, 'ml-hour': volumeRateInput };
    if (!activity) rateInputs['mcg-kg-min'] = weightRateInput;
    else { weightRateInput.value = ''; setError(weightRateInput, ''); }
    const values = model.rates ? {
      'mcg-kg-min': model.rates.weightDose,
      [hourlyUnit()]: activity ? model.rates.hourlyActivity : model.rates.hourlyDose,
      'ml-hour': model.rates.volumeRate
    } : null;
    for (const [unit, input] of Object.entries(rateInputs)) {
      input.value = unit === raw.rateUnit && model.ratesEnabled ? raw.rate : values ? calc.formatInput(values[unit]) : '';
      setError(input, unit === raw.rateUnit ? model.errors.rate : '');
    }
    document.querySelector('#concentration-status').textContent = model.concentrationEnabled ? 'Введите концентрацию и выберите единицы' : 'Сначала введите вес';
    document.querySelector('#concentration-note').textContent = raw.concentrationUnit === 'percent'
      ? 'Концентрация готового раствора. 1% = 10 мг/мл (г/100 мл).'
      : 'Концентрация готового раствора в ' + info.label + '.';
    document.querySelector('#rate-status').textContent = model.ratesEnabled ? (activity ? 'Оба поля доступны для ввода' : 'Все три поля доступны для ввода') : 'Сначала введите вес и концентрацию';
    document.querySelector('#rate-note').textContent = activity
      ? 'Введите значение в любом из двух полей — второе пересчитается автоматически.'
      : 'Введите значение в любом из трёх полей — остальные пересчитаются автоматически.';
    document.querySelector('#infusion-basis-note').textContent = activity
      ? 'Концентрация и скорость должны относиться к одному препарату и одним единицам активности. Пересчёта в мг или проценты нет.'
      : 'Концентрация и доза должны относиться к одному веществу: основанию или соли.';
    copyButton.disabled = !model.rates;
    resetButton.disabled = !raw.weight && !raw.concentration && !raw.rate;
    feedback.textContent = '';
    status.textContent = model.rates
      ? rateSummary(model.rates)
      : Object.values(model.errors).join(' ') || (model.ratesEnabled ? 'Введите скорость в любом из ' + (activity ? 'двух' : 'трёх') + ' полей.' : model.concentrationEnabled ? 'Блок концентрации доступен.' : 'Введите вес пациента.');
  }

  weightInput.addEventListener('input', () => { raw.weight = weightInput.value; render(); });
  concentrationInput.addEventListener('input', () => { raw.concentration = concentrationInput.value; render(); });
  concentrationUnit.addEventListener('change', () => {
    const previousFamily = calc.solutionUnitInfo(raw.concentrationUnit).family;
    raw.concentrationUnit = concentrationUnit.value;
    const family = calc.solutionUnitInfo(raw.concentrationUnit).family;
    if (previousFamily !== family) {
      raw.rate = '';
      raw.rateUnit = family === 'mass' ? 'mcg-kg-min' : hourlyUnit();
    }
    render();
  });
  weightRateInput.addEventListener('input', () => { raw.rate = weightRateInput.value; raw.rateUnit = 'mcg-kg-min'; render(); });
  hourlyRateInput.addEventListener('input', () => { raw.rate = hourlyRateInput.value; raw.rateUnit = hourlyUnit(); render(); });
  volumeRateInput.addEventListener('input', () => { raw.rate = volumeRateInput.value; raw.rateUnit = 'ml-hour'; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.assign(raw, { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min' });
    weightInput.value = '';
    render();
    weightInput.focus();
  });
  copyButton.addEventListener('click', async () => {
    if (!model.rates) return;
    const result = model.rates;
    const f = calc.formatInput;
    const info = calc.solutionUnitInfo(raw.concentrationUnit);
    const concentrationText = f(calc.number(raw.concentration)) + ' ' + info.label + (info.family === 'mass' && raw.concentrationUnit !== 'mg' ? ' (' + f(result.concentration) + ' мг/мл)' : '');
    const text = 'Вес пациента: ' + f(result.weight) + ' кг.\nКонцентрация раствора: ' + concentrationText + '.\n' + rateSummary(result);
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea');
        textarea.className = 'sr-only';
        textarea.value = text;
        textarea.readOnly = true;
        document.body.append(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        let copied;
        try { copied = document.execCommand('copy'); }
        finally { textarea.remove(); copyButton.focus(); }
        if (!copied) throw new Error('Copy unavailable');
      }
      feedback.textContent = 'Результат скопирован';
    } catch { feedback.textContent = 'Не удалось скопировать. Выделите значения и скопируйте вручную.'; }
  });
  render();
})();
