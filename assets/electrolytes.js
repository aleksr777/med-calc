(function () {
  'use strict';
  const calc = window.MedCalc;
  const formulas = window.Electrolytes;

  function setup(id, defaults, calculate, linkedNames, describe) {
    const form = document.getElementById(id);
    const raw = { ...defaults };
    const controls = Array.from(form.querySelectorAll('input, select'));
    const errorNodes = new Map(controls.map(input => [input.name, document.getElementById(input.id + '-error')]));
    const linked = form.querySelector('[data-linked]');
    const value = form.querySelector('[data-result-value]');
    const unit = form.querySelector('[data-result-unit]');
    const summary = form.querySelector('[data-result-summary]');
    const error = form.querySelector('[data-result-error]');
    const status = form.querySelector('[role="status"]');
    const reset = form.querySelector('[type="reset"]');

    function render() {
      const model = calculate(raw);
      linked.disabled = !model.linkedEnabled;
      if (!model.linkedEnabled) for (const name of linkedNames) raw[name] = '';
      const custom = form.querySelector('[data-custom-content]');
      if (custom) {
        custom.hidden = raw.content !== 'custom';
        form.elements.customContent.disabled = raw.content !== 'custom';
      }
      for (const control of controls) {
        if (linkedNames.includes(control.name)) {
          control.value = !model.linkedEnabled ? '' : control.name === raw.source ? raw[control.name]
            : model.result ? calc.formatInput(model.result[control.name]) : '';
        }
        const message = model.errors[control.name] || '';
        control.setAttribute('aria-invalid', String(Boolean(message)));
        const node = errorNodes.get(control.name);
        if (node) { node.textContent = message; node.hidden = !message; }
      }
      const messages = Object.values(model.errors).join(' ');
      const result = model.result;
      const formatted = result ? calc.format(result.volume) : '—';
      value.textContent = formatted;
      value.classList.toggle('is-long', formatted.length > 11);
      unit.hidden = !result;
      summary.textContent = result ? describe(result) : 'Заполните поля калькулятора.';
      error.textContent = messages;
      error.hidden = !messages;
      status.textContent = result ? unit.textContent + ': ' + formatted + '. ' + summary.textContent : messages;
      reset.disabled = controls.every(control => raw[control.name] === defaults[control.name]);
    }

    for (const control of controls) {
      control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
        raw[control.name] = control.value;
        if (linkedNames.includes(control.name)) raw.source = control.name;
        render();
      });
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('reset', event => {
      event.preventDefault();
      Object.assign(raw, defaults);
      for (const control of controls) control.value = defaults[control.name];
      render();
      controls[0].focus();
    });
    render();
  }

  const f = calc.format;
  setup('sodium-form', { weight: '', waterGroup: '', current: '', target: '', volume: '', source: 'target' }, formulas.sodiumState, ['target', 'volume'],
    result => 'Оценка общей воды: ' + f(result.water) + ' л. Изменение Na⁺: +' + f(result.change) + ' ммоль/л; цель: ' + f(result.target) + ' ммоль/л. В растворе: ' + f(result.sodiumAmount) + ' ммоль Na⁺.');
  setup('potassium-form', { dose: '', doseUnit: 'mmol', volume: '', source: 'dose' }, formulas.potassiumState, ['dose', 'volume'],
    result => 'K⁺: ' + f(result.mmol) + ' ммоль = ' + f(result.meq) + ' мЭкв. Калия хлорид: ' + f(result.saltGrams) + ' г.');
  setup('calcium-form', { content: '', customContent: '', dose: '', doseUnit: 'mmol', volume: '', source: 'dose' }, formulas.calciumState, ['dose', 'volume'],
    result => 'Элементарный Ca²⁺: ' + f(result.mmol) + ' ммоль = ' + f(result.meq) + ' мЭкв. Содержание в выбранном препарате: ' + f(result.concentration) + ' ммоль/мл.');
})();
