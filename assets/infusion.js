(function () {
  'use strict';
  const calc = window.MedCalc;
  const form = document.querySelector('#infusion-form');
  const weightInput = document.querySelector('#weight');
  const concentrationBlock = document.querySelector('#concentration-block');
  const rateBlock = document.querySelector('#rate-block');
  const concentrationInputs = { percent: document.querySelector('#concentration-percent'), mg: document.querySelector('#concentration-mg') };
  const rateInputs = { 'mcg-kg-min': document.querySelector('#rate-weight'), 'mg-hour': document.querySelector('#rate-mg'), 'ml-hour': document.querySelector('#rate-ml') };
  const copyButton = document.querySelector('#copy-result');
  const resetButton = document.querySelector('#reset-form');
  const feedback = document.querySelector('#copy-feedback');
  const status = document.querySelector('#result-status');
  const raw = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min' };
  let model;

  function setError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.querySelector('#' + input.id + '-error');
    error.textContent = message || '';
    error.hidden = !message;
  }

  function render() {
    model = calc.infusionFormState(raw);
    if (!model.concentrationEnabled) {
      raw.concentration = '';
      raw.rate = '';
    } else if (!model.ratesEnabled) raw.rate = '';
    concentrationBlock.disabled = !model.concentrationEnabled;
    rateBlock.disabled = !model.ratesEnabled;
    concentrationBlock.classList.toggle('is-locked', concentrationBlock.disabled);
    rateBlock.classList.toggle('is-locked', rateBlock.disabled);
    setError(weightInput, model.errors.weight);
    for (const [unit, input] of Object.entries(concentrationInputs)) {
      input.value = unit === raw.concentrationUnit && model.concentrationEnabled ? raw.concentration
        : model.ratesEnabled ? calc.formatInput(unit === 'mg' ? model.concentrationMg : model.concentrationPercent) : '';
      setError(input, unit === raw.concentrationUnit ? model.errors.concentration : '');
    }
    const values = model.rates ? { 'mcg-kg-min': model.rates.weightDose, 'mg-hour': model.rates.hourlyDose, 'ml-hour': model.rates.volumeRate } : null;
    for (const [unit, input] of Object.entries(rateInputs)) {
      input.value = unit === raw.rateUnit && model.ratesEnabled ? raw.rate : values ? calc.formatInput(values[unit]) : '';
      setError(input, unit === raw.rateUnit ? model.errors.rate : '');
    }
    document.querySelector('#concentration-status').textContent = model.concentrationEnabled ? 'Укажите любую концентрацию' : 'Сначала введите вес';
    document.querySelector('#rate-status').textContent = model.ratesEnabled ? 'Все три поля доступны для ввода' : 'Сначала введите вес и концентрацию';
    copyButton.disabled = !model.rates;
    resetButton.disabled = !raw.weight && !raw.concentration && !raw.rate;
    feedback.textContent = '';
    status.textContent = model.rates
      ? 'Скорость введения: ' + calc.formatInput(model.rates.weightDose) + ' мкг/кг/мин; ' + calc.formatInput(model.rates.hourlyDose) + ' мг/час; ' + calc.formatInput(model.rates.volumeRate) + ' мл/час.'
      : Object.values(model.errors).join(' ') || (model.ratesEnabled ? 'Введите скорость в любом из трёх полей.' : model.concentrationEnabled ? 'Блок концентрации доступен.' : 'Введите вес пациента.');
  }

  weightInput.addEventListener('input', () => { raw.weight = weightInput.value; render(); });
  for (const [unit, input] of Object.entries(concentrationInputs)) {
    input.addEventListener('input', () => { raw.concentration = input.value; raw.concentrationUnit = unit; render(); });
  }
  for (const [unit, input] of Object.entries(rateInputs)) {
    input.addEventListener('input', () => { raw.rate = input.value; raw.rateUnit = unit; render(); });
  }
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
    const text = 'Вес пациента: ' + f(result.weight) + ' кг.\nКонцентрация раствора: ' + f(model.concentrationPercent) + '% (' + f(result.concentration) + ' мг/мл).\n' +
      'Скорость введения: ' + f(result.weightDose) + ' мкг/кг/мин; ' + f(result.hourlyDose) + ' мг/час; ' + f(result.volumeRate) + ' мл/час.';
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
