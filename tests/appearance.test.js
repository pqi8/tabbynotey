import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { initAppearance } from '../extension/appearance.js';

function setup(t, storage, EyeDropper) {
  const elements = Object.fromEntries(['accent-color', 'pick-color', 'reset-color', 'color-status']
    .map(id => [id, new EventTarget()]));
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = {
    documentElement: {
      toggleAttribute() {},
      style: { setProperty() {}, removeProperty() {} },
    },
    getElementById: id => elements[id],
  };
  globalThis.window = { EyeDropper };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  initAppearance(storage, {});
  return {
    elements,
    color(value, type = 'change') {
      elements['accent-color'].value = value;
      elements['accent-color'].dispatchEvent(new Event(type));
    },
    click(id) { elements[id].dispatchEvent(new Event('click')); },
    status: () => elements['color-status'].textContent,
  };
}

test('color writes stay ordered and reset wins over an earlier pending save', async t => {
  const writes = [];
  let finish;
  const ui = setup(t, {
    async set(value) {
      writes.push(value);
      await new Promise(resolve => { finish = resolve; });
    },
    async remove(key) { writes.push(key); },
  });
  ui.color('#265a61');
  await setImmediate();
  ui.click('reset-color');
  assert.equal(writes.length, 1);
  finish();
  await setImmediate();
  assert.deepEqual(writes, [{ 'preference:accent': '#265a61' }, 'preference:accent']);
  assert.equal(ui.elements['reset-color'].disabled, true);
  assert.match(ui.status(), /^Saved/);
});

test('failed color saves are reported and the next change can retry', async t => {
  let fail = true;
  let saved;
  const ui = setup(t, { async set(value) {
    if (fail) throw Error('quota');
    saved = value;
  } });
  ui.color('#265a61');
  await setImmediate();
  assert.match(ui.status(), /Couldn't save/);
  fail = false;
  ui.color('#7b38b5');
  await setImmediate();
  assert.deepEqual(saved, { 'preference:accent': '#7b38b5' });
  assert.match(ui.status(), /^Saved/);
});

test('earlier saves do not overwrite a new preview or canceled eyedropper status', async t => {
  const completions = [];
  const ui = setup(t, {
    set: () => new Promise(resolve => completions.push(resolve)),
  }, class { async open() { throw new DOMException('Canceled', 'AbortError'); } });
  ui.color('#265a61');
  await setImmediate();
  ui.color('#7b38b5', 'input');
  completions.shift()();
  await setImmediate();
  assert.equal(ui.status(), 'Previewing color.');
  ui.color('#7b38b5');
  await setImmediate();
  ui.click('pick-color');
  await setImmediate();
  completions.shift()();
  await setImmediate();
  assert.match(ui.status(), /^Canceled/);
  assert.equal(ui.elements['pick-color'].disabled, false);
  assert.equal(ui.elements['accent-color'].value, '#7b38b5');
});
