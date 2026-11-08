const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { create } = require('../assets/form-drafts.js');
const calc = require('../assets/calculations.js');

const solutionDefaults = { stockConcentration: '', stockUnit: 'mg', stockVolume: '', targetConcentration: '', targetUnit: 'mg', finalVolume: '', source: 'concentration' };
const infusionDefaults = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min', pendingSolution: false };
const solutionChoices = { stockUnit: ['mg', 'mcg', 'percent', 'unit', 'iu'], targetUnit: ['mg', 'mcg', 'percent', 'unit', 'iu'], source: ['concentration', 'volume'] };

function session() {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) };
  return { entries, storage, drafts: create(() => storage) };
}

test('separate page drafts preserve decimal text, units and the last edited field', () => {
  const { drafts } = session();
  const solution = { ...solutionDefaults, stockConcentration: '2,00', stockVolume: '4.0', finalVolume: '50,00', source: 'volume', targetUnit: 'mcg' };
  const infusion = { ...infusionDefaults, weight: '70,00', concentration: '100.00', concentrationUnit: 'unit', rate: '0,50', rateUnit: 'unit-kg-hour' };
  assert.equal(drafts.save('solution', solution), true);
  assert.equal(drafts.save('infusion', infusion), true);
  assert.deepEqual(drafts.load('solution', solutionDefaults, solutionChoices), solution);
  assert.deepEqual(drafts.load('infusion', infusionDefaults), infusion);
  const result = calc.solutionFormState(drafts.load('solution', solutionDefaults, solutionChoices));
  assert.equal(result.result.finalVolume, 50);
  assert.equal(result.targetInUnit, 160);
  const rates = calc.infusionFormState(drafts.load('infusion', infusionDefaults)).rates;
  assert.equal(rates.hourlyActivity, 35);
  assert.equal(rates.volumeRate, 0.35);
});

test('a new page controller restores the existing tab session', () => {
  const { storage, drafts } = session();
  const saved = { ...infusionDefaults, weight: '80', concentration: '200', concentrationUnit: 'iu', rate: '2,5', rateUnit: 'iu-kg-hour' };
  drafts.save('infusion', saved);
  const restored = create(() => storage).load('infusion', infusionDefaults);
  assert.deepEqual(restored, saved);
  const result = calc.infusionFormState(restored).rates;
  assert.equal(result.hourlyActivity, 200);
  assert.equal(result.volumeRate, 1);
});

test('reset leaves an empty snapshot so older history entries cannot revive cleared values', () => {
  const { drafts, entries } = session();
  const saved = { ...infusionDefaults, weight: '70', concentration: '0,4', rate: '1', rateUnit: 'mg-hour' };
  const solution = { ...solutionDefaults, stockConcentration: '4', stockVolume: '4', targetConcentration: '1' };
  entries.set('another-app', 'untouched');
  drafts.save('infusion', saved);
  drafts.save('solution', solution);
  drafts.save('infusion', infusionDefaults);
  Object.assign(saved, drafts.load('infusion', infusionDefaults));
  assert.deepEqual(saved, infusionDefaults);
  assert.deepEqual(drafts.load('solution', solutionDefaults), solution);
  assert.equal(entries.get('another-app'), 'untouched');
});

test('an imported solution awaiting patient weight survives navigation', () => {
  const { drafts } = session();
  const saved = { ...infusionDefaults, concentration: '100,000', concentrationUnit: 'unit', rateUnit: 'unit-hour', pendingSolution: true };
  drafts.save('infusion', saved);
  const restored = drafts.load('infusion', infusionDefaults);
  assert.deepEqual(restored, saved);
  assert.equal(calc.infusionFormState(restored).ratesEnabled, false);
  assert.equal(calc.infusionFormState({ ...restored, weight: 70 }).ratesEnabled, true);
});

test('partial input and invalid calculations keep their editable text', () => {
  const { drafts } = session();
  for (const value of ['', '.', ',', '0001,00', '1,']) {
    drafts.save('solution', { ...solutionDefaults, stockConcentration: value });
    assert.equal(drafts.load('solution', solutionDefaults).stockConcentration, value);
  }
});

test('malformed drafts and unsupported units are ignored without throwing', () => {
  const { drafts, entries } = session();
  drafts.save('solution', solutionDefaults);
  const key = [...entries.keys()][0];
  for (const invalid of ['broken JSON', 'null', '[]', '123', '"text"', '{"stockVolume":10}', '{"stockUnit":"unknown"}', '{"source":"unknown"}']) {
    entries.set(key, invalid);
    assert.equal(drafts.load('solution', solutionDefaults, solutionChoices), null, invalid);
  }
  entries.set(key, '{"stockVolume":"1,00","extra":"ignored","__proto__":{"polluted":true}}');
  assert.deepEqual(drafts.load('solution', solutionDefaults, solutionChoices), { ...solutionDefaults, stockVolume: '1,00' });
  assert.equal({}.polluted, undefined);
});

test('storage failures do not interrupt either calculator', () => {
  const unavailable = create(() => { throw new Error('Storage blocked'); });
  assert.equal(unavailable.load('solution', solutionDefaults), null);
  assert.equal(unavailable.save('solution', solutionDefaults), false);
  const full = create(() => ({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }));
  assert.equal(full.load('infusion', infusionDefaults), null);
  assert.equal(full.save('infusion', infusionDefaults), false);
  assert.equal(calc.convertInfusion({ weight: 70, concentration: 100, concentrationUnit: 'unit', rate: 2, rateUnit: 'unit-kg-hour' }).hourlyActivity, 140);
});

test('a new tab session does not restore a closed tabs drafts', () => {
  const firstTab = session(), nextTab = session();
  const saved = { ...infusionDefaults, weight: '70', concentration: '0,4', rate: '5', rateUnit: 'ml-hour' };
  firstTab.drafts.save('infusion', saved);
  assert.deepEqual(create(() => firstTab.storage).load('infusion', infusionDefaults), saved);
  firstTab.entries.clear();
  assert.equal(nextTab.drafts.load('infusion', infusionDefaults), null);
});

test('legacy persistent drafts are deleted without importing them or removing unrelated settings', () => {
  const current = session(), legacy = session();
  const saved = { ...infusionDefaults, weight: '70,00', concentration: '100', concentrationUnit: 'unit', rate: '2,00', rateUnit: 'unit-kg-hour' };
  legacy.drafts.save('infusion', saved);
  legacy.drafts.save('solution', solutionDefaults);
  legacy.entries.set('another-app', 'untouched');
  legacy.entries.set('med-calc:setting', 'untouched');
  const drafts = create(() => current.storage, () => legacy.storage);
  assert.equal(drafts.load('infusion', infusionDefaults), null);
  assert.equal(drafts.load('solution', solutionDefaults), null);
  assert.deepEqual([...legacy.entries], [['another-app', 'untouched'], ['med-calc:setting', 'untouched']]);
  drafts.save('infusion', saved);
  assert.deepEqual(current.drafts.load('infusion', infusionDefaults), saved);
  assert.equal(legacy.entries.size, 2);
});

test('blocked legacy storage does not interrupt the current tab session', () => {
  const current = session();
  const drafts = create(() => current.storage, () => { throw new Error('Persistent storage denied'); });
  const saved = { ...infusionDefaults, weight: '80', concentration: '200', concentrationUnit: 'iu' };
  assert.equal(drafts.save('infusion', saved), true);
  assert.deepEqual(drafts.load('infusion', infusionDefaults), saved);
});

test('unavailable session storage never falls back to persistent storage', () => {
  const legacy = session();
  legacy.drafts.save('infusion', { ...infusionDefaults, weight: '80', concentration: '200' });
  const drafts = create(() => { throw new Error('Session storage denied'); }, () => legacy.storage);
  assert.equal(drafts.load('infusion', infusionDefaults), null);
  assert.equal(drafts.save('infusion', infusionDefaults), false);
  assert.equal(legacy.entries.size, 0);
});

test('browser initialization uses only the current session and retains existing in-tab inputs', () => {
  const source = fs.readFileSync(require.resolve('../assets/form-drafts.js'), 'utf8');
  const current = session(), next = session(), local = session();
  const saved = { ...infusionDefaults, weight: '70', concentration: '0,4', rate: '5', rateUnit: 'ml-hour' };
  current.drafts.save('infusion', saved);
  local.drafts.save('infusion', { ...saved, weight: '99' });
  const browser = { sessionStorage: current.storage, localStorage: local.storage };
  vm.runInNewContext(source, browser);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.FormDrafts.load('infusion', infusionDefaults))), saved);
  browser.FormDrafts.save('infusion', saved);
  assert.equal(local.entries.size, 0);
  const reopened = { sessionStorage: next.storage, localStorage: local.storage };
  vm.runInNewContext(source, reopened);
  assert.equal(reopened.FormDrafts.load('infusion', infusionDefaults), null);
});
