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
  let mode = 'diluent';
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

  function calculate(showErrors = false) {
    const inputs = [...form.querySelectorAll('input[required]:not(:disabled)')];
    let missing = false;
    let invalid = false;
    const values = {};
    for (const input of inputs) {
      let message = '';
      if (!input.value.trim()) {
        missing = true;
        if (showErrors) message = 'Заполните это поле.';
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

  function setMode(nextMode) {
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

  function updateUnitHint() {
    const percent = page === 'solutions' && (form.elements.stockUnit.value === 'percent' || (mode === 'diluent' && form.elements.targetUnit.value === 'percent'));
    if (page === 'solutions') document.querySelector('#percent-note').hidden = !percent;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!calculate(true)) form.querySelector('[aria-invalid="true"]')?.focus();
  });
  form.addEventListener('input', () => calculate());
  form.addEventListener('change', () => { updateUnitHint(); calculate(); });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      form.querySelectorAll('input').forEach(input => fieldError(input, ''));
      clearResult();
      updateUnitHint();
    }, 0);
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    setMode(button.dataset.mode);
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
