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

  function isAllowed(value) {
    return /^[0-9]*(?:[.,][0-9]*)?$/.test(value);
  }

  function canInsert(value, text, start = value.length, end = start, maxLength = Infinity) {
    const next = value.slice(0, start) + text + value.slice(end);
    return isAllowed(next) && next.length <= maxLength;
  }

  function attach(document) {
    const snapshots = new WeakMap();
    const getInput = event => event.target instanceof HTMLInputElement && event.target.inputMode === 'decimal' ? event.target : null;
    const remember = input => snapshots.set(input, {
      value: isAllowed(input.value) ? input.value : '',
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    });
    const accepts = (input, text) => canInsert(input.value, text,
      input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length,
      input.maxLength < 0 ? Infinity : input.maxLength);

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
    document.addEventListener('drop', event => {
      const input = getInput(event);
      if (!input || !event.dataTransfer) return;
      remember(input);
      if (!accepts(input, event.dataTransfer.getData('text'))) event.preventDefault();
    }, true);
    document.addEventListener('input', event => {
      const input = getInput(event);
      if (!input) return;
      if (isAllowed(input.value)) {
        remember(input);
        return;
      }
      const previous = snapshots.get(input) || { value: '', start: 0, end: 0 };
      input.value = previous.value;
      input.setSelectionRange(previous.start, previous.end);
      event.stopImmediatePropagation();
    }, true);
  }

  return Object.freeze({ isAllowed, canInsert, attach });
});
