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

test('rapid edits persist in order, preserve other notes, and clearing removes only that note', async () => {
  const items = {};
  const storage = {
    async set(value) { await new Promise(resolve => setTimeout(resolve, 5)); Object.assign(items, value); },
    async remove(key) { delete items[key]; },
  };
  const write = createWriter(storage);
  const keep = { ...newNote('https://a.test', 'A'), text: 'Keep me' };
  const note = newNote('https://a.test', 'A');
  await write(keep);
  const results = await Promise.all(['a', 'ab', 'abc'].map(text => write({ ...note, text })));
  assert.equal(items[noteKey(note.id)].text, 'abc');
  assert.equal(results[2].text, 'abc');
  assert.equal(await write({ ...note, text: ' ' }), null);
  assert.equal(items[noteKey(note.id)], undefined);
  assert.equal(items[noteKey(keep.id)].text, 'Keep me');
});

test('storage failures are surfaced and a later edit can retry', async () => {
  let fail = true;
  let result;
  const write = createWriter({ async set(value) { if (fail) throw Error('quota'); result = value; } });
  const note = newNote('https://a.test', 'A');
  await assert.rejects(write({ ...note, text: 'First' }), /quota/);
  fail = false;
  await write({ ...note, text: 'Retry' });
  assert.equal(result[noteKey(note.id)].text, 'Retry');
});
