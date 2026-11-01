(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.DecimalInputs = api;
    api.attach(document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isAllowed(value, maximum = Infinity) {
    if (!/^[0-9]*(?:[.,][0-9]*)?$/.test(value)) return false;
    if (maximum === Infinity) return true;
    if (!Number.isSafeInteger(maximum) || maximum < 0) return false;
    const [whole, fraction = ''] = value.replace(',', '.').split('.');
    const integer = whole.replace(/^0+/, '') || '0';
    const limit = String(maximum);
    if (integer.length !== limit.length) return integer.length < limit.length;
    if (integer !== limit) return integer < limit;
    return !/[1-9]/.test(fraction);
  }

  function canInsert(value, text, start = value.length, end = start, maxLength = Infinity, maximum = Infinity) {
    const next = value.slice(0, start) + text + value.slice(end);
    return isAllowed(next, maximum) && next.length <= maxLength;
  }

  function attach(document) {
    const snapshots = new WeakMap();
    const getInput = event => event.target instanceof HTMLInputElement && event.target.inputMode === 'decimal' ? event.target : null;
    const maximumFor = input => input.max === '' ? Infinity : Number(input.max);
    const remember = input => snapshots.set(input, {
      value: isAllowed(input.value, maximumFor(input)) ? input.value : '',
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    });
    const accepts = (input, text) => canInsert(input.value, text,
      input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length,
      input.maxLength < 0 ? Infinity : input.maxLength, maximumFor(input));

    document.addEventListener('dragstart', event => event.preventDefault(), true);
    document.addEventListener('dragover', event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    }, true);
    document.addEventListener('drop', event => event.preventDefault(), true);

    document.addEventListener('focusin', event => {
      const input = getInput(event);
      if (input) remember(input);
    }, true);
    document.addEventListener('beforeinput', event => {
      const input = getInput(event);
      if (!input) return;
      remember(input);
      if (typeof event.data === 'string' && !accepts(input, event.data)) event.preventDefault();
    }, true);
    document.addEventListener('paste', event => {
      const input = getInput(event);
      if (!input || !event.clipboardData) return;
      remember(input);
      if (!accepts(input, event.clipboardData.getData('text'))) event.preventDefault();
    }, true);
    document.addEventListener('input', event => {
      const input = getInput(event);
      if (!input) return;
      if (isAllowed(input.value, maximumFor(input))) {
        remember(input);
        return;
      }
      const previous = snapshots.get(input) || { value: '', start: 0, end: 0 };
      input.value = isAllowed(previous.value, maximumFor(input)) ? previous.value : '';
      input.setSelectionRange(previous.start, previous.end);
      event.stopImmediatePropagation();
    }, true);
  }

  return Object.freeze({ isAllowed, canInsert, attach });
});
