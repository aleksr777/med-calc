(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FormDrafts = api.create(() => root.sessionStorage);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const prefix = 'med-calc:draft:v1:';

  function create(storage) {
    function load(page, defaults, choices = {}) {
      try {
        const saved = JSON.parse(storage().getItem(prefix + page));
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
        const state = {};
        for (const [name, fallback] of Object.entries(defaults)) {
          const value = Object.hasOwn(saved, name) ? saved[name] : fallback;
          if (typeof value !== typeof fallback || (choices[name] && !choices[name].includes(value))) return null;
          state[name] = value;
        }
        return state;
      } catch { return null; }
    }

    function save(page, state) {
      try { storage().setItem(prefix + page, JSON.stringify(state)); return true; }
      catch { return false; }
    }

    return Object.freeze({ load, save });
  }

  return Object.freeze({ create });
});
