import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedUrl, noteKey, newNote, savedNotes, notesForUrl, badgeText, createWriter } from '../extension/notes.js';

test('only web pages are supported', () => {
  for (const value of ['chrome://settings', 'javascript:alert(1)', 'file:///tmp/a', 'bad']) assert.equal(supportedUrl(value), false);
  assert.equal(supportedUrl('https://example.com'), true);
});

test('each note is its own object with a unique key, even on the same page', () => {
  const a = newNote('https://a.test', 'A');
  const b = newNote('https://a.test', 'A');
  assert.notEqual(a.id, b.id);
  assert.notEqual(noteKey(a.id), noteKey(b.id));
  assert.equal(a.createdAt, a.updatedAt);
});

test('library filters unsafe or empty records and searches and sorts notes', () => {
  const items = {
    'note:a': { id: 'a', url: 'https://a.test', title: 'Pricing', text: 'Ask finance', updatedAt: 1 },
    'note:b': { id: 'b', url: 'https://b.test', title: 'Roadmap', text: 'Read release plan', updatedAt: 2 },
    'note:empty': { url: 'https://c.test', text: '   ' },
    'note:unsafe': { url: 'javascript:alert(1)', text: 'hi' },
    other: { url: 'https://d.test', text: 'no' },
    'note:null': null,
  };
  assert.deepEqual(savedNotes(items).map(n => n.title), ['Roadmap', 'Pricing']);
  assert.equal(savedNotes(items, ' FINANCE ')[0].title, 'Pricing');
  assert.equal(savedNotes(items, 'b.test')[0].title, 'Roadmap');
});

test('records missing a timestamp fall back to the other one', () => {
  const items = {
    'note:legacy': { url: 'https://a.test', text: 'Old', createdAt: 5 },
    'note:imported': { url: 'https://a.test', text: 'Imported', updatedAt: 9 },
    'note:bare': { url: 'https://a.test', text: 'Bare' },
  };
  const [imported, legacy, bare] = savedNotes(items);
  assert.deepEqual([legacy.createdAt, legacy.updatedAt], [5, 5]);
  assert.deepEqual([imported.createdAt, imported.updatedAt], [9, 9]);
  assert.deepEqual([bare.createdAt, bare.updatedAt], [0, 0]);
});

test('page notes match the exact URL, newest first, and include 0.1.0 records', () => {
  const items = {
    'note:1': { id: '1', url: 'https://a.test/?id=1', text: 'old', createdAt: 1, updatedAt: 9 },
    'note:2': { id: '2', url: 'https://a.test/?id=1', text: 'new', createdAt: 5, updatedAt: 5 },
    'note:https://a.test/?id=1': { url: 'https://a.test/?id=1', text: 'legacy', updatedAt: 3 },
    'note:3': { id: '3', url: 'https://a.test/?id=2', text: 'other query', createdAt: 7 },
    'note:4': { id: '4', url: 'https://a.test/?id=1#part', text: 'other fragment', createdAt: 8 },
  };
  const notes = notesForUrl(items, 'https://a.test/?id=1');
  assert.deepEqual(notes.map(n => n.text), ['new', 'legacy', 'old']);
  assert.equal(notes[1].id, 'https://a.test/?id=1');
  assert.equal(noteKey(notes[1].id), 'note:https://a.test/?id=1');
});

test('badge shows the note count, blank when there are none', () => {
  assert.equal(badgeText(0), '');
  assert.equal(badgeText(3), '3');
  assert.equal(badgeText(120), '99+');
});

// An in-memory chrome.storage.local, with a delay on writes to expose ordering bugs.
function memoryStorage(items = {}) {
  return {
    items,
    async get(key) { return key in items ? { [key]: structuredClone(items[key]) } : {}; },
    async set(value) { await new Promise(resolve => setTimeout(resolve, 5)); Object.assign(items, structuredClone(value)); },
    async remove(key) { delete items[key]; },
  };
}

test('rapid edits persist in order, preserve other notes, and clearing removes only that note', async () => {
  const storage = memoryStorage();
  const { save } = createWriter(storage);
  const keep = { ...newNote('https://a.test', 'A'), text: 'Keep me' };
  const note = newNote('https://a.test', 'A');
  await save(keep);
  const results = await Promise.all(['a', 'ab', 'abc'].map(text => save({ ...note, text })));
  assert.equal(storage.items[noteKey(note.id)].text, 'abc');
  assert.equal(results[2].text, 'abc');
  assert.equal(await save({ ...note, text: ' ' }), null);
  assert.equal(storage.items[noteKey(note.id)], undefined);
  assert.equal(storage.items[noteKey(keep.id)].text, 'Keep me');
});

test('the reminder is part of the note, and text and reminder writes never undo each other', async () => {
  const storage = memoryStorage();
  const { save, setReminder } = createWriter(storage);
  const note = { ...newNote('https://a.test', 'A'), text: 'Flip the flag' };
  await save(note);
  const reminder = { at: 10, alerts: [0], handledUntil: 1 };
  const withReminder = await setReminder(note.id, reminder);
  assert.deepEqual(withReminder.reminder, reminder);
  assert.equal(withReminder.updatedAt, storage.items[noteKey(note.id)].updatedAt);

  // The background records an alert while the popup still holds the old note.
  storage.items[noteKey(note.id)].reminder.alertedAt = 5;
  await save({ ...note, reminder: undefined, text: 'Flip the flag today' });
  assert.equal(storage.items[noteKey(note.id)].text, 'Flip the flag today');
  assert.equal(storage.items[noteKey(note.id)].reminder.alertedAt, 5);

  // Turning the reminder off removes it, and keeps the text.
  await setReminder(note.id);
  assert.equal('reminder' in storage.items[noteKey(note.id)], false);
  assert.equal(storage.items[noteKey(note.id)].text, 'Flip the flag today');

  // A deleted note takes its reminder with it, and can't be given a new one.
  await setReminder(note.id, reminder);
  await save({ ...note, text: '' });
  assert.equal(await setReminder(note.id, reminder), null);
  assert.equal(storage.items[noteKey(note.id)], undefined);
});

test('storage failures are surfaced and a later edit can retry', async () => {
  let fail = true;
  const storage = memoryStorage();
  const set = storage.set;
  storage.set = async value => { if (fail) throw Error('quota'); return set(value); };
  const { save } = createWriter(storage);
  const note = newNote('https://a.test', 'A');
  await assert.rejects(save({ ...note, text: 'First' }), /quota/);
  fail = false;
  await save({ ...note, text: 'Retry' });
  assert.equal(storage.items[noteKey(note.id)].text, 'Retry');
});
