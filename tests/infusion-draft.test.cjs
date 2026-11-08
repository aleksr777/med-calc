const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calc = require('../assets/calculations.js');
const { create } = require('../assets/form-drafts.js');
const transfer = require('../assets/solution-transfer.js');
const decimal = require('../assets/numeric-input.js');
const source = fs.readFileSync(require.resolve('../assets/infusion.js'), 'utf8');
const defaults = { weight: '', concentration: '', concentrationUnit: 'mg', rate: '', rateUnit: 'mcg-kg-min', pendingSolution: false };

function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function openForm(drafts, hash = '') {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, value: '', max: '', hidden: false, disabled: false,
      textContent: '', options: [], listeners: new Map(), classList: { toggle() {} },
      addEventListener(name, fn) { this.listeners.set(name, fn); }, setAttribute() {}, focus() {} });
    return nodes.get(id);
  }
  node('concentration-unit').value = 'mg';
  node('concentration-unit').options = ['mg', 'mcg', 'percent', 'unit', 'iu'].map(value => ({ value }));
  const events = new Map();
  const url = new URL('https://example.invalid/med-calc/infusion-rate.html' + hash);
  const window = { MedCalc: calc, FormDrafts: drafts, SolutionTransfer: transfer, DecimalInputs: decimal,
    location: { href: url.href, hash: url.hash },
    history: { replaceState(_state, _title, next) { window.location.href = next.href; window.location.hash = next.hash; } },
    addEventListener(name, fn) { events.set(name, fn); } };
  const document = { querySelector: selector => node(selector.slice(1)), getElementById: node };
  vm.runInNewContext(source, { window, document, URL });
  events.get('pageshow')?.({ persisted: false });
  return { nodes, events, window, input(id, value, type = 'input') {
    const el = node(id); el.value = value; el.listeners.get(type)?.({ target: el });
  }, reset() { node('infusion-form').listeners.get('reset')({ preventDefault() {} }); } };
}

test('a failed draft read must not overwrite the existing infusion with an empty form', () => {
  const data = storage();
  const initial = create(() => data);
  initial.save('infusion', { ...defaults, weight: '70', concentration: '0,4', rate: '5', rateUnit: 'ml-hour' });
  const before = [...data.data.entries()];
  const drafts = create(() => ({ ...data, getItem() { throw new Error('Read unavailable'); } }));
  openForm(drafts);
  assert.deepEqual([...data.data.entries()], before);
});

test('change-only browser edits survive reopening the infusion page', () => {
  const data = storage(), drafts = create(() => data);
  const page = openForm(drafts);
  page.input('weight', '70,00', 'change');
  page.input('concentration', '0,4', 'change');
  page.input('rate-ml', '5,00', 'change');
  const restored = openForm(drafts);
  assert.equal(restored.nodes.get('weight').value, '70,00');
  assert.equal(restored.nodes.get('concentration').value, '0,4');
  assert.equal(restored.nodes.get('rate-ml').value, '5,00');
  assert.equal(restored.nodes.get('rate-hourly').value, '2');
});

test('input edits, recalculated fields and the chosen source survive reopening', () => {
  const storageForInput = storage(), drafts = create(() => storageForInput);
  const page = openForm(drafts);
  page.input('weight', '80');
  page.input('concentration-unit', 'iu', 'change');
  page.input('concentration', '200');
  page.input('rate-weight', '2,50');
  const restored = openForm(drafts);
  assert.equal(restored.nodes.get('rate-weight').value, '2,50');
  assert.equal(restored.nodes.get('rate-hourly').value, '200');
  assert.equal(restored.nodes.get('rate-ml').value, '1');
  restored.input('weight', '60');
  assert.equal(restored.nodes.get('rate-hourly').value, '150');
  assert.equal(restored.nodes.get('rate-ml').value, '0,75');
});

test('reset clears the infusion draft and preserves the preparation draft', () => {
  const data = storage(), drafts = create(() => data);
  drafts.save('solution', { stockConcentration: '4', stockVolume: '4' });
  const page = openForm(drafts);
  page.input('weight', '70'); page.input('concentration', '0,4'); page.input('rate-ml', '5');
  page.reset();
  const restored = openForm(drafts);
  assert.equal(restored.nodes.get('weight').value, '');
  assert.equal(restored.nodes.get('rate-ml').value, '');
  assert.deepEqual(drafts.load('solution', { stockConcentration: '', stockVolume: '' }), { stockConcentration: '4', stockVolume: '4' });
});

test('a new solution overrides concentration once while preserving the patient weight', () => {
  const data = storage(), drafts = create(() => data);
  drafts.save('infusion', { ...defaults, weight: '70', concentration: '0,4', rate: '5', rateUnit: 'ml-hour' });
  const page = openForm(drafts, '#concentration=0%2C8&unit=mg');
  assert.equal(page.nodes.get('weight').value, '70');
  assert.equal(page.nodes.get('concentration').value, '0,8');
  assert.equal(page.nodes.get('rate-ml').value, '5');
  assert.equal(page.window.location.hash, '');
  page.input('concentration', '1,00');
  assert.equal(openForm(drafts).nodes.get('concentration').value, '1,00');
});
