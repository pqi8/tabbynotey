import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newReminder, validReminder, reminderProblem, nextWake, alertPending, isDue,
  remindersByNote, anyDue, dueText, toLocalInput, fromLocalInput, reminderKey,
  activeAlerts, withoutAlert, dismissed,
} from '../extension/reminders.js';

const MIN = 60000;
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const at = NOW + 48 * 60 * MIN;

test('alerts are de-duplicated and ordered earliest first', () => {
  const reminder = newReminder(at, [0, 60, 1440, 0], NOW);
  assert.deepEqual(reminder.alerts, [1440, 60, 0]);
  assert.equal(reminder.handledUntil, NOW);
  assert.ok(validReminder(reminder));
});

test('malformed reminders are rejected', () => {
  for (const value of [null, {}, { at, alerts: [] }, { at: NaN, alerts: [0] }, { at, alerts: [7] }, { at, alerts: '0' }]) {
    assert.equal(validReminder(value), false);
  }
});

test('reminder problems explain what is missing', () => {
  assert.equal(reminderProblem(NaN, [0], NOW), 'Pick a date and time');
  assert.equal(reminderProblem(NOW - 1, [0], NOW), 'Pick a time in the future');
  assert.equal(reminderProblem(at, [], NOW), 'Choose at least one alert');
  assert.equal(reminderProblem(at, [0], NOW), '');
});

test('wakes for each alert in turn, then for the reminder time', () => {
  let reminder = newReminder(at, [1440, 15], NOW);
  assert.equal(nextWake(reminder), at - 1440 * MIN);
  reminder = { ...reminder, handledUntil: at - 1440 * MIN };
  assert.equal(nextWake(reminder), at - 15 * MIN);
  reminder = { ...reminder, handledUntil: at - 15 * MIN };
  // "At the time" wasn't chosen, but the note still turns due then.
  assert.equal(nextWake(reminder), at);
  assert.equal(nextWake({ ...reminder, handledUntil: at }), undefined);
});

test('alerts already past when the reminder is set never fire', () => {
  const setLate = newReminder(at, [1440, 60], at - 120 * MIN);
  assert.equal(nextWake(setLate), at - 60 * MIN);
  assert.equal(alertPending(setLate, at - 90 * MIN), false);
});

test('missed alerts collapse into one, and only once', () => {
  const reminder = newReminder(at, [1440, 60, 5, 0], NOW);
  assert.equal(alertPending(reminder, NOW + MIN), false);
  // Chrome was closed through every alert.
  assert.equal(alertPending(reminder, at + 10 * MIN), true);
  assert.equal(alertPending({ ...reminder, handledUntil: at + 10 * MIN }, at + 20 * MIN), false);
  // Waking only for the due time doesn't notify when "At the time" wasn't chosen.
  const early = { ...newReminder(at, [60], NOW), handledUntil: at - 60 * MIN };
  assert.equal(alertPending(early, at), false);
  assert.equal(isDue(early, at), true);
});

test('only reminders with a live note count, and any due one flags the badge', () => {
  const items = {
    'note:a': { url: 'https://a.test', text: 'A' },
    [reminderKey('a')]: newReminder(at, [0], NOW),
    [reminderKey('gone')]: newReminder(NOW + MIN, [0], NOW),
    [reminderKey('bad')]: { at: 'soon' },
  };
  items['note:bad'] = { url: 'https://b.test', text: 'B' };
  assert.deepEqual([...remindersByNote(items).keys()], ['a']);
  assert.equal(anyDue(items, at - 1), false);
  assert.equal(anyDue(items, at), true);
});

test('due text reads naturally either side of the time', () => {
  assert.equal(dueText(NOW + 30 * MIN, NOW), 'Due in 30 minutes');
  assert.equal(dueText(NOW + 20000, NOW), 'Due now');
  assert.equal(dueText(NOW - 2 * 60 * MIN, NOW), 'Was due 2 hours ago');
});

test('datetime-local values round-trip in local time', () => {
  const time = new Date(2026, 10, 3, 9, 30).getTime();
  assert.equal(toLocalInput(time), '2026-11-03T09:30');
  assert.equal(fromLocalInput('2026-11-03T09:30'), time);
  assert.ok(Number.isNaN(fromLocalInput('')));
});

test('the alert window lists fired alerts with live notes, soonest first', () => {
  const items = {
    'note:a': { url: 'https://a.test', text: 'A' },
    'note:b': { url: 'https://b.test', text: 'B' },
    'note:c': { url: 'https://c.test', text: 'C' },
    [reminderKey('a')]: { ...newReminder(at + MIN, [0], NOW), alertedAt: NOW },
    [reminderKey('b')]: { ...newReminder(at, [60], NOW), alertedAt: NOW },
    [reminderKey('c')]: newReminder(at, [0], NOW),
    [reminderKey('gone')]: { ...newReminder(at, [0], NOW), alertedAt: NOW },
  };
  assert.deepEqual(activeAlerts(items).map(alert => [alert.id, alert.note.text]), [['b', 'B'], ['a', 'A']]);
});

test('dismissing an early alert keeps the reminder; once due it is finished', () => {
  const shown = { ...newReminder(at, [60, 0], NOW), alertedAt: at - 60 * MIN };
  assert.equal('alertedAt' in withoutAlert(shown), false);
  assert.deepEqual(dismissed(shown, at - 59 * MIN), withoutAlert(shown));
  assert.equal(dismissed(shown, at), null);
});
