(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FormDrafts = api.create(() => root.localStorage, () => root.sessionStorage);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const prefix = 'med-calc:draft:v1:';

  function parse(value, defaults, choices) {
    const saved = JSON.parse(value);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
    const state = {};
    for (const [name, fallback] of Object.entries(defaults)) {
      const value = Object.hasOwn(saved, name) ? saved[name] : fallback;
      if (typeof value !== typeof fallback || (choices[name] && !choices[name].includes(value))) return null;
      state[name] = value;
    }
    return state;
  }

  function create(...stores) {
    function load(page, defaults, choices = {}) {
      for (let index = 0; index < stores.length; index++) {
        try {
          const state = parse(stores[index]().getItem(prefix + page), defaults, choices);
          if (!state) continue;
          if (index > 0) save(page, state);
          return state;
        } catch {
          // A blocked or damaged store must not prevent trying the next one.
        }
      }
      return null;
    }

    function save(page, state) {
      let saved = false;
      for (const storage of stores) {
        try { storage().setItem(prefix + page, JSON.stringify(state)); saved = true; }
        catch { /* Keep calculations available when browser storage is blocked. */ }
      }
      return saved;
    }

    return Object.freeze({ load, save });
  }

  return Object.freeze({ create });
});
