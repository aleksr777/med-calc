(function () {
  'use strict';
  const calc = window.MedCalc;
  const page = document.body.dataset.page;
  const form = document.querySelector('#calculator');
  const valueNode = document.querySelector('#result-value');
  const unitNode = document.querySelector('#result-unit');
  const labelNode = document.querySelector('#result-label');
  const emptyNode = document.querySelector('#result-empty');
  const errorNode = document.querySelector('#result-error');
  const breakdown = document.querySelector('#result-breakdown');
  const instruction = document.querySelector('#result-instruction');
  const copyButton = document.querySelector('#copy-result');
  const copyFeedback = document.querySelector('#copy-feedback');
  let mode = page === 'infusion' ? 'ml-hour' : 'diluent';
  let rateValues = {};
  let copyText = '';

  function fieldError(input, message) {
    const error = document.querySelector('#' + input.id + '-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.textContent = message;
    error.hidden = !message;
  }

  function clearResult(message) {
    valueNode.textContent = '—';
    valueNode.classList.remove('is-long');
    unitNode.textContent = '';
    labelNode.hidden = true;
    emptyNode.hidden = Boolean(message);
    errorNode.hidden = !message;
    errorNode.textContent = message || '';
    breakdown.hidden = true;
    instruction.hidden = true;
    copyButton.hidden = true;
    copyFeedback.textContent = '';
    copyText = '';
    document.querySelector('#result-status').textContent = message || 'Ожидание исходных данных';
  }

  function row(label, value) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    breakdown.append(wrapper);
  }

  function showResult(value, unit, label) {
    const formatted = calc.format(value);
    valueNode.textContent = formatted;
    valueNode.classList.toggle('is-long', formatted.length > 11);
    unitNode.textContent = unit;
    labelNode.textContent = label;
    labelNode.hidden = false;
    emptyNode.hidden = true;
    errorNode.hidden = true;
    breakdown.replaceChildren();
    breakdown.hidden = false;
    copyButton.hidden = false;
    copyFeedback.textContent = '';
  }

  function renderSolution(result) {
    const f = calc.format;
    const label = mode === 'diluent' ? 'Объём растворителя' : 'Концентрация готового раствора';
    showResult(mode === 'diluent' ? result.diluent : result.target, mode === 'diluent' ? 'мл растворителя' : 'мг/мл', label);
    row('Конечный объём', f(result.finalVolume) + ' мл');
    row('Исходный раствор', f(result.stockVolume) + ' мл');
    row('Количество вещества', f(result.amount) + ' мг');
    row(mode === 'diluent' ? 'Итоговая концентрация' : 'Объём растворителя', mode === 'diluent' ? f(result.target) + ' мг/мл' : f(result.diluent) + ' мл');
    row('Концентрация в мкг/мл', f(result.target * 1000) + ' мкг/мл');
    instruction.hidden = false;
    instruction.textContent = result.diluent === 0
      ? 'Конечный объём равен исходному. Добавлять растворитель не требуется.'
      : 'К ' + f(result.stockVolume) + ' мл исходного раствора добавить ' + f(result.diluent) + ' мл растворителя. Конечный объём — ' + f(result.finalVolume) + ' мл.';
    copyText = 'Исходный раствор: ' + f(result.stock) + ' мг/мл, ' + f(result.stockVolume) + ' мл.\n' +
      'Количество вещества: ' + f(result.amount) + ' мг.\nРастворитель: ' + f(result.diluent) + ' мл.\n' +
      'Конечный объём: ' + f(result.finalVolume) + ' мл.\nКонцентрация: ' + f(result.target) + ' мг/мл (' + f(result.target * 1000) + ' мкг/мл).';
    document.querySelector('#result-status').textContent = label + ': ' + f(mode === 'diluent' ? result.diluent : result.target) + (mode === 'diluent' ? ' мл' : ' мг/мл');
  }

  function renderConversion(dose, weight) {
    const f = calc.format;
    const forward = page === 'to-weight';
    const result = forward ? calc.toWeightDose(dose, weight) : calc.toHourlyDose(dose, weight);
    const unit = forward ? 'мкг/кг/мин' : 'мг/час';
    showResult(result, unit, forward ? 'Доза с учётом массы тела' : 'Скорость введения вещества');
    row('Исходная доза', f(dose) + (forward ? ' мг/час' : ' мкг/кг/мин'));
    row('Масса тела', f(weight) + ' кг');
    instruction.hidden = false;
    instruction.textContent = forward
      ? f(dose) + ' × 1000 ÷ (60 × ' + f(weight) + ') = ' + f(result) + ' ' + unit
      : f(dose) + ' × ' + f(weight) + ' × 60 ÷ 1000 = ' + f(result) + ' ' + unit;
    copyText = 'Исходная доза: ' + f(dose) + (forward ? ' мг/час' : ' мкг/кг/мин') + '.\nМасса тела: ' + f(weight) + ' кг.\nРезультат: ' + f(result) + ' ' + unit + '.';
    document.querySelector('#result-status').textContent = 'Результат: ' + f(result) + ' ' + unit;
  }

  function renderInfusion(result) {
    const f = calc.format;
    const fromVolume = mode === 'ml-hour';
    const resultValue = fromVolume ? result.hourlyDose : result.volumeRate;
    const resultUnit = fromVolume ? 'мг/час' : 'мл/час';
    const label = fromVolume ? 'Скорость введения вещества' : 'Скорость инфузии';
    showResult(resultValue, resultUnit, label);
    row('Скорость инфузии', f(result.volumeRate) + ' мл/час');
    row('Введение вещества', f(result.hourlyDose) + ' мг/час');
    row('Концентрация раствора', f(result.concentration) + ' мг/мл');
    if (result.weight !== null) {
      row('Масса тела', f(result.weight) + ' кг');
      row('Доза на массу тела', f(result.weightDose) + ' мкг/кг/мин');
    }
    instruction.hidden = false;
    instruction.textContent = fromVolume
      ? f(result.volumeRate) + ' мл/час × ' + f(result.concentration) + ' мг/мл = ' + f(result.hourlyDose) + ' мг/час.'
      : (mode === 'mcg-kg-min' ? f(result.sourceRate) + ' × ' + f(result.weight) + ' × 60 ÷ 1000 = ' + f(result.hourlyDose) + ' мг/час. ' : '') +
        f(result.hourlyDose) + ' мг/час ÷ ' + f(result.concentration) + ' мг/мл = ' + f(result.volumeRate) + ' мл/час.';
    copyText = 'Концентрация готового раствора: ' + f(result.concentration) + ' мг/мл.\n' +
      'Скорость инфузии: ' + f(result.volumeRate) + ' мл/час.\nВведение вещества: ' + f(result.hourlyDose) + ' мг/час.' +
      (result.weight === null ? '' : '\nМасса тела: ' + f(result.weight) + ' кг.\nДоза: ' + f(result.weightDose) + ' мкг/кг/мин.');
    document.querySelector('#result-status').textContent = 'Результат: ' + f(resultValue) + ' ' + resultUnit +
      (result.weightDose === null ? '' : '. Доза: ' + f(result.weightDose) + ' мкг/кг/мин');
  }

  function calculate(showErrors = false) {
    const inputs = [...form.querySelectorAll('input:not(:disabled)')];
    let missing = false;
    let invalid = false;
    const values = {};
    for (const input of inputs) {
      let message = '';
      if (!input.value.trim()) {
        if (input.required) {
          missing = true;
          if (showErrors) message = 'Заполните это поле.';
        }
      } else {
        try { values[input.name] = calc.number(input.value, input.dataset.allowZero === 'true'); }
        catch (error) { invalid = true; message = error.message; }
      }
      fieldError(input, message);
    }
    if (missing || invalid) {
      clearResult(showErrors || invalid ? 'Проверьте отмеченные поля.' : '');
      return false;
    }
    try {
      if (page === 'solutions') {
        const data = {
          ...values,
          stockUnit: form.elements.stockUnit.value,
          targetUnit: form.elements.targetUnit.value
        };
        renderSolution(mode === 'diluent' ? calc.prepareSolution(data) : calc.concentrationByVolume(data));
      } else if (page === 'infusion') {
        renderInfusion(calc.convertInfusion({ ...values, rateUnit: mode, concentrationUnit: form.elements.concentrationUnit.value }));
      } else {
        renderConversion(values.dose, values.weight);
      }
      return true;
    } catch (error) {
      if (page === 'solutions') fieldError(form.elements[mode === 'diluent' ? 'targetConcentration' : 'finalVolume'], error.message);
      clearResult(error.message);
      return false;
    }
  }

  function setSolutionMode(nextMode) {
    mode = nextMode;
    const byDiluent = mode === 'diluent';
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    document.querySelector('#target-field').hidden = !byDiluent;
    document.querySelector('#volume-field').hidden = byDiluent;
    form.elements.targetConcentration.disabled = !byDiluent;
    form.elements.targetUnit.disabled = !byDiluent;
    form.elements.finalVolume.disabled = byDiluent;
    document.querySelector('#solution-formula').textContent = byDiluent ? 'Vкон. = Cисх. × Vисх. ÷ Cнужн.' : 'Cкон. = Cисх. × Vисх. ÷ Vкон.';
    document.querySelector('#solution-formula-secondary').textContent = 'Vрастворителя = Vкон. − Vисх.';
    document.querySelector('.formula-explain').textContent = byDiluent
      ? 'C — концентрация в мг/мл, V — объём в мл. Сначала определяется конечный объём, затем вычитается объём исходного раствора.'
      : 'C — концентрация в мг/мл, V — объём в мл. Количество вещества в исходном растворе делится на конечный объём.';
    document.querySelector('#mode-description').textContent = byDiluent ? 'Рассчитайте, сколько растворителя добавить.' : 'Узнайте концентрацию при заданном конечном объёме.';
    form.querySelectorAll('input').forEach(input => fieldError(input, ''));
    calculate();
  }

  function setInfusionMode(nextMode) {
    rateValues[mode] = form.elements.rate.value;
    mode = nextMode;
    form.elements.rate.value = rateValues[mode] || '';
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    const units = { 'ml-hour': 'мл/час', 'mg-hour': 'мг/час', 'mcg-kg-min': 'мкг/кг/мин' };
    const labels = { 'ml-hour': 'Скорость инфузии', 'mg-hour': 'Скорость введения вещества', 'mcg-kg-min': 'Доза на килограмм массы тела' };
    document.querySelector('label[for="rate"]').textContent = labels[mode];
    document.querySelector('#rate-unit').textContent = units[mode];
    form.elements.rate.placeholder = mode === 'mcg-kg-min' ? 'Например, 0,1' : mode === 'ml-hour' ? 'Например, 5' : 'Например, 2';
    const weightRequired = mode === 'mcg-kg-min';
    form.elements.weight.required = weightRequired;
    document.querySelector('label[for="weight"]').textContent = weightRequired ? 'Масса тела пациента' : 'Масса тела пациента (необязательно)';
    document.querySelector('#weight-hint').textContent = weightRequired
      ? 'Необходима для пересчёта дозы в мг/час и мл/час.'
      : 'Добавьте массу, чтобы также получить дозу в мкг/кг/мин.';
    document.querySelector('#infusion-formula-primary').textContent = mode === 'ml-hour'
      ? 'мг/час = мл/час × C'
      : mode === 'mg-hour' ? 'мл/час = мг/час ÷ C' : 'мл/час = мкг/кг/мин × масса × 60 ÷ (1000 × C)';
    document.querySelector('#mode-description').textContent = 'Известная величина: ' + units[mode] + '. Укажите концентрацию готового раствора.';
    form.querySelectorAll('input').forEach(input => fieldError(input, ''));
    calculate();
  }

  function updateUnitHint() {
    if (page === 'solutions' || page === 'infusion') {
      const percent = page === 'infusion' ? form.elements.concentrationUnit.value === 'percent'
        : form.elements.stockUnit.value === 'percent' || (mode === 'diluent' && form.elements.targetUnit.value === 'percent');
      document.querySelector('#percent-note').hidden = !percent;
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!calculate(true)) form.querySelector('[aria-invalid="true"]')?.focus();
  });
  form.addEventListener('input', () => calculate());
  form.addEventListener('change', () => { updateUnitHint(); calculate(); });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      rateValues = {};
      form.querySelectorAll('input').forEach(input => fieldError(input, ''));
      clearResult();
      updateUnitHint();
    }, 0);
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    if (page === 'infusion') setInfusionMode(button.dataset.mode);
    else setSolutionMode(button.dataset.mode);
    updateUnitHint();
  }));
  document.querySelector('#fill-example').addEventListener('click', () => {
    if (page === 'solutions') {
      form.elements.stockConcentration.value = '2';
      form.elements.stockUnit.value = 'mg';
      form.elements.stockVolume.value = '4';
      form.elements.targetConcentration.value = '0,08';
      form.elements.targetUnit.value = 'mg';
      form.elements.finalVolume.value = '50';
    } else if (page === 'infusion') {
      form.elements.rate.value = mode === 'ml-hour' ? '5' : mode === 'mg-hour' ? '2' : '0,1';
      form.elements.concentration.value = '0,4';
      form.elements.concentrationUnit.value = 'mg';
      form.elements.weight.value = '70';
    } else {
      form.elements.dose.value = page === 'to-weight' ? '3' : '0,1';
      form.elements.weight.value = '70';
    }
    updateUnitHint();
    calculate(true);
  });
  copyButton.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        textarea.setAttribute('readonly', '');
        textarea.className = 'sr-only';
        document.body.append(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        let copied = false;
        try { copied = document.execCommand('copy'); }
        finally { textarea.remove(); copyButton.focus(); }
        if (!copied) throw new Error('Copy unavailable');
      }
      copyFeedback.textContent = 'Результат скопирован';
    } catch {
      copyFeedback.textContent = 'Не удалось скопировать. Выделите результат и скопируйте вручную.';
    }
  });
  clearResult();
})();
