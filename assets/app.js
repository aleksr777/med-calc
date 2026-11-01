(function () {
  'use strict';
  const calc = window.MedCalc;
  const form = document.querySelector('#calculator');
  const fields = {
    stockConcentration: form.elements.stockConcentration,
    stockVolume: form.elements.stockVolume,
    targetConcentration: form.elements.targetConcentration,
    finalVolume: form.elements.finalVolume
  };
  const stockUnit = form.elements.stockUnit;
  const targetUnit = form.elements.targetUnit;
  const unitOptions = Array.from(stockUnit.options, option => ({ value: option.value, label: option.textContent }));
  const errors = Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, document.getElementById(input.id + '-error')]));
  const ui = {
    desired: document.querySelector('#desired-block'),
    desiredStatus: document.querySelector('#desired-status'),
    value: document.querySelector('#result-value'),
    unit: document.querySelector('#result-unit'),
    label: document.querySelector('#result-label'),
    empty: document.querySelector('#result-empty'),
    error: document.querySelector('#result-error'),
    status: document.querySelector('#result-status')
  };
  const defaults = { stockConcentration: '', stockUnit: 'mg', stockVolume: '', targetConcentration: '', targetUnit: 'mg', finalVolume: '', source: 'concentration' };
  const raw = { ...defaults };

  function syncTargetUnits() {
    const family = calc.solutionUnitInfo(raw.stockUnit).family;
    const allowed = unitOptions.filter(option => calc.solutionUnitInfo(option.value).family === family);
    targetUnit.replaceChildren(...allowed.map(option => {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      return node;
    }));
    targetUnit.value = raw.targetUnit;
  }

  function render() {
    const model = calc.solutionFormState(raw);
    ui.desired.disabled = !model.desiredEnabled;
    if (!model.desiredEnabled) {
      raw.targetConcentration = '';
      raw.finalVolume = '';
    }
    fields.targetConcentration.value = model.desiredEnabled && raw.source === 'concentration' ? raw.targetConcentration
      : model.result ? calc.formatInput(model.targetInUnit) : '';
    fields.finalVolume.value = model.desiredEnabled && raw.source === 'volume' ? raw.finalVolume
      : model.result ? calc.formatInput(model.result.finalVolume) : '';
    for (const [name, input] of Object.entries(fields)) {
      const message = model.errors[name] || '';
      input.setAttribute('aria-invalid', String(Boolean(message)));
      errors[name].textContent = message;
      errors[name].hidden = !message;
    }
    const prompt = model.desiredEnabled ? 'Введите нужную концентрацию или конечный объём.' : 'Сначала введите исходную концентрацию и объём.';
    ui.desiredStatus.textContent = prompt;
    const message = Object.values(model.errors).join(' ');
    const formatted = model.result ? calc.format(model.result.diluent) : '—';
    ui.value.textContent = formatted;
    ui.value.classList.toggle('is-long', Boolean(model.result) && formatted.length > 11);
    ui.unit.textContent = model.result ? 'мл растворителя' : '';
    ui.label.hidden = !model.result;
    ui.empty.hidden = Boolean(model.result || message);
    ui.error.hidden = !message;
    ui.error.textContent = message;
    ui.status.textContent = model.result ? 'Объём растворителя: ' + formatted + ' мл.' : message || prompt;
  }

  for (const [name, input] of Object.entries(fields)) {
    input.addEventListener('input', () => {
      raw[name] = input.value;
      if (name === 'targetConcentration') raw.source = 'concentration';
      if (name === 'finalVolume') raw.source = 'volume';
      render();
    });
  }
  stockUnit.addEventListener('change', () => {
    raw.stockUnit = stockUnit.value;
    const info = calc.solutionUnitInfo(raw.stockUnit);
    if (info.family !== calc.solutionUnitInfo(raw.targetUnit).family) {
      raw.targetUnit = info.baseUnit;
      raw.targetConcentration = '';
      raw.finalVolume = '';
      raw.source = 'concentration';
    }
    syncTargetUnits();
    render();
  });
  targetUnit.addEventListener('change', () => { raw.targetUnit = targetUnit.value; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    Object.assign(raw, defaults);
    fields.stockConcentration.value = '';
    fields.stockVolume.value = '';
    stockUnit.value = raw.stockUnit;
    syncTargetUnits();
    render();
    fields.stockConcentration.focus();
  });
  syncTargetUnits();
  render();
})();
