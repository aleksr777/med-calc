const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../assets/form-drafts.js');
const calc = require('../assets/calculations.js');

const solutionDefaults = { stockConcentration: '', stockUnit: 'mg', stockVolume: '', targetConcentration: '', targetUnit: 'mg', finalVolume: '', source: 'concentration' };
const infusionDefaults = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min', pendingSolution: false };
const solutionChoices = { stockUnit: ['mg', 'mcg', 'percent', 'unit', 'iu'], targetUnit: ['mg', 'mcg', 'percent', 'unit', 'iu'], source: ['concentration', 'volume'] };

function session() {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)) };
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

test('persistent drafts are available when a page opens with a new tab session', () => {
  const local = session(), firstTab = session(), nextTab = session();
  const initial = create(() => local.storage, () => firstTab.storage);
  const saved = { ...infusionDefaults, weight: '70', concentration: '0,4', rate: '5', rateUnit: 'ml-hour' };
  initial.save('infusion', saved);
  assert.deepEqual(create(() => local.storage, () => nextTab.storage).load('infusion', infusionDefaults), saved);
});

test('drafts from the previous session-only version migrate without losing text or units', () => {
  const local = session(), legacy = session();
  const saved = { ...infusionDefaults, weight: '70,00', concentration: '100', concentrationUnit: 'unit', rate: '2,00', rateUnit: 'unit-kg-hour' };
  legacy.drafts.save('infusion', saved);
  const current = create(() => local.storage, () => legacy.storage);
  assert.deepEqual(current.load('infusion', infusionDefaults), saved);
  assert.deepEqual(local.drafts.load('infusion', infusionDefaults), saved);
});

test('a blocked persistent store falls back to session storage for reading and writing', () => {
  const fallback = session();
  const drafts = create(() => { throw new Error('Persistent storage denied'); }, () => fallback.storage);
  const saved = { ...infusionDefaults, weight: '80', concentration: '200', concentrationUnit: 'iu' };
  assert.equal(drafts.save('infusion', saved), true);
  assert.deepEqual(drafts.load('infusion', infusionDefaults), saved);
});

test('an invalid primary draft does not hide a valid fallback', () => {
  const local = session(), fallback = session();
  const saved = { ...infusionDefaults, weight: '80', concentration: '200' };
  fallback.drafts.save('infusion', saved);
  for (const key of fallback.entries.keys()) local.entries.set(key, 'broken JSON');
  assert.deepEqual(create(() => local.storage, () => fallback.storage).load('infusion', infusionDefaults), saved);
  assert.deepEqual(local.drafts.load('infusion', infusionDefaults), saved);
});
