(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calculations.js'), require('./numeric-input.js'));
  else root.SolutionTransfer = factory(root.MedCalc, root.DecimalInputs);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calc, inputs) {
  'use strict';

  function validate(concentration, concentrationUnit) {
    if (typeof concentration !== 'string' || typeof concentrationUnit !== 'string'
      || !inputs.isAllowed(concentration, concentrationUnit === 'percent' ? 100 : Infinity)) return null;
    const data = { concentration, concentrationUnit };
    return calc.infusionFormState({ weight: 1, ...data }).ratesEnabled ? data : null;
  }

  function link(concentration, unit) {
    const data = validate(concentration, unit);
    if (!data) return null;
    return 'infusion-rate.html#' + new URLSearchParams({ concentration: data.concentration, unit: data.concentrationUnit });
  }

  function read(hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (params.getAll('concentration').length !== 1 || params.getAll('unit').length !== 1) return null;
    return validate(params.get('concentration'), params.get('unit'));
  }

  return Object.freeze({ link, read });
});
