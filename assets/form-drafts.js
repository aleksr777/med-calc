(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FormDrafts = api.create(() => root.sessionStorage, () => root.localStorage);
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

  function create(storage, legacyStorage) {
    if (legacyStorage) {
      try {
        const legacy = legacyStorage();
        for (const page of ['solution', 'infusion']) legacy.removeItem(prefix + page);
      } catch { /* Legacy storage may be unavailable; it is never used for drafts. */ }
    }

    function load(page, defaults, choices = {}) {
      try { return parse(storage().getItem(prefix + page), defaults, choices); }
      catch { return null; }
    }

    function save(page, state) {
      try { storage().setItem(prefix + page, JSON.stringify(state)); return true; }
      catch { return false; }
    }

    return Object.freeze({ load, save });
  }

  return Object.freeze({ create });
});
