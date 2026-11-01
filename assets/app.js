(function () {
  'use strict';
  const calc = window.MedCalc;
  const form = document.querySelector('#calculator');
  const stockConcentration = form.elements.stockConcentration;
  const stockVolume = form.elements.stockVolume;
  const targetConcentration = form.elements.targetConcentration;
  const finalVolume = form.elements.finalVolume;
  const desiredBlock = document.querySelector('#desired-block');
  const valueNode = document.querySelector('#result-value');
  const unitNode = document.querySelector('#result-unit');
  const labelNode = document.querySelector('#result-label');
  const emptyNode = document.querySelector('#result-empty');
  const errorNode = document.querySelector('#result-error');
  const breakdown = document.querySelector('#result-breakdown');
  const instruction = document.querySelector('#result-instruction');
  const copyButton = document.querySelector('#copy-result');
  const copyFeedback = document.querySelector('#copy-feedback');
  const status = document.querySelector('#result-status');
  const raw = { stockConcentration: '', stockUnit: 'mg', stockVolume: '', targetConcentration: '', targetUnit: 'mg', finalVolume: '', source: 'concentration' };
  let copyText = '';

  function fieldError(input, message) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const error = document.querySelector('#' + input.id + '-error');
    error.textContent = message || '';
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
    copyText = '';
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

  function renderResult(result) {
    const f = calc.format;
    const formatted = f(result.diluent);
    valueNode.textContent = formatted;
    valueNode.classList.toggle('is-long', formatted.length > 11);
    unitNode.textContent = 'мл растворителя';
    labelNode.textContent = 'Объём растворителя';
    labelNode.hidden = false;
    emptyNode.hidden = true;
    errorNode.hidden = true;
    breakdown.replaceChildren();
    breakdown.hidden = false;
    row('Конечный объём', f(result.finalVolume) + ' мл');
    row('Исходный объём', f(result.stockVolume) + ' мл');
    row('Исходная концентрация', f(result.stock) + ' мг/мл');
    row('Количество вещества', f(result.amount) + ' мг');
    row('Итоговая концентрация', f(result.target) + ' мг/мл');
    row('Концентрация в мкг/мл', f(result.target * 1000) + ' мкг/мл');
    instruction.hidden = false;
    const summary = 'Исходный раствор: ' + f(result.stockVolume) + ' мл с концентрацией ' + f(result.stock) + ' мг/мл. ' +
      (result.diluent === 0 ? 'Растворитель: 0 мл — добавлять не требуется. ' : 'Добавить ' + f(result.diluent) + ' мл растворителя. ') +
      'Полученный раствор: ' + f(result.finalVolume) + ' мл с концентрацией ' + f(result.target) + ' мг/мл.';
    const summaryTitle = document.createElement('strong');
    summaryTitle.textContent = 'Общий вывод: ';
    instruction.replaceChildren(summaryTitle, summary);
    copyText = 'Общий вывод:\n' + summary + '\nКоличество вещества: ' + f(result.amount) + ' мг.\n' +
      'Полученная концентрация в мкг/мл: ' + f(result.target * 1000) + ' мкг/мл.';
    copyButton.hidden = false;
    status.textContent = summary;
  }

  function render() {
    const model = calc.solutionFormState(raw);
    desiredBlock.disabled = !model.desiredEnabled;
    if (!model.desiredEnabled) {
      raw.targetConcentration = '';
      raw.finalVolume = '';
    }
    targetConcentration.value = model.desiredEnabled && raw.source === 'concentration' ? raw.targetConcentration
      : model.result ? calc.formatInput(model.targetInUnit) : '';
    finalVolume.value = model.desiredEnabled && raw.source === 'volume' ? raw.finalVolume
      : model.result ? calc.formatInput(model.result.finalVolume) : '';
    for (const input of [stockConcentration, stockVolume, targetConcentration, finalVolume]) fieldError(input, model.errors[input.name]);
    document.querySelector('#desired-status').textContent = model.desiredEnabled
      ? 'Введите нужную концентрацию или конечный объём.'
      : 'Сначала введите исходную концентрацию и объём.';
    document.querySelector('#percent-note').hidden = raw.stockUnit !== 'percent' && raw.targetUnit !== 'percent';
    copyFeedback.textContent = '';
    if (model.result) renderResult(model.result);
    else {
      const message = Object.values(model.errors).join(' ');
      clearResult(message);
      status.textContent = message || (model.desiredEnabled ? 'Введите нужную концентрацию или конечный объём.' : 'Введите исходную концентрацию и объём.');
    }
  }

  stockConcentration.addEventListener('input', () => { raw.stockConcentration = stockConcentration.value; render(); });
  stockVolume.addEventListener('input', () => { raw.stockVolume = stockVolume.value; render(); });
  targetConcentration.addEventListener('input', () => { raw.targetConcentration = targetConcentration.value; raw.source = 'concentration'; render(); });
  finalVolume.addEventListener('input', () => { raw.finalVolume = finalVolume.value; raw.source = 'volume'; render(); });
  form.elements.stockUnit.addEventListener('change', () => { raw.stockUnit = form.elements.stockUnit.value; render(); });
  form.elements.targetUnit.addEventListener('change', () => { raw.targetUnit = form.elements.targetUnit.value; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.assign(raw, { stockConcentration: '', stockUnit: 'mg', stockVolume: '', targetConcentration: '', targetUnit: 'mg', finalVolume: '', source: 'concentration' });
    stockConcentration.value = '';
    stockVolume.value = '';
    form.elements.stockUnit.value = 'mg';
    form.elements.targetUnit.value = 'mg';
    render();
    stockConcentration.focus();
  });
  copyButton.addEventListener('click', async () => {
    if (!copyText) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(copyText);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        textarea.readOnly = true;
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
    } catch { copyFeedback.textContent = 'Не удалось скопировать. Выделите результат и скопируйте вручную.'; }
  });
  render();
})();
