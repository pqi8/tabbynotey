import { PREFIX } from './notes.js';

// A reminder lives under `reminder:<noteId>`, apart from the note, so the popup
// rewriting a note's text never clobbers the background's alert bookkeeping.
export const REMINDER_PREFIX = 'reminder:';
export const ALARM_PREFIX = 'remind:';

// Minutes before the reminder time.
export const ALERTS = [
  [1440, '24 hours before'],
  [60, '1 hour before'],
  [30, '30 minutes before'],
  [15, '15 minutes before'],
  [5, '5 minutes before'],
  [0, 'At the time'],
];
export const DEFAULT_ALERTS = [0];

const MINUTE = 60000;
const ALLOWED = new Set(ALERTS.map(([minutes]) => minutes));

export function reminderKey(noteId) { return REMINDER_PREFIX + noteId; }

export function validReminder(reminder) {
  return Boolean(reminder) && Number.isFinite(reminder.at) &&
    Array.isArray(reminder.alerts) && reminder.alerts.length > 0 && reminder.alerts.every(m => ALLOWED.has(m));
}

// Alerts that are already past when the reminder is set are skipped, not fired at once.
export function newReminder(at, alerts, now = Date.now()) {
  return { at, alerts: [...new Set(alerts)].sort((a, b) => b - a), handledUntil: now };
}

// Explains why a reminder can't be saved, or returns '' when it can.
export function reminderProblem(at, alerts, now = Date.now()) {
  if (!Number.isFinite(at)) return 'Pick a date and time';
  if (at <= now) return 'Pick a time in the future';
  if (!alerts.length) return 'Choose at least one alert';
  return '';
}

const alertTimes = reminder => reminder.alerts.map(minutes => reminder.at - minutes * MINUTE);

// When the background should next wake: each alert, plus the reminder time itself
// so the note turns due even when "At the time" isn't selected.
export function nextWake(reminder) {
  const after = reminder.handledUntil ?? 0;
  const times = [...alertTimes(reminder), reminder.at].filter(time => time > after);
  return times.length ? Math.min(...times) : undefined;
}

// Whether an alert passed since the last check. Several missed alerts (browser closed,
// laptop asleep) collapse into one notification rather than a burst.
export function alertPending(reminder, now) {
  const after = reminder.handledUntil ?? 0;
  return alertTimes(reminder).some(time => time > after && time <= now);
}

export const isDue = (reminder, now) => now >= reminder.at;

// Reminders keyed by note id, ignoring malformed records and reminders whose note is gone.
export function remindersByNote(items) {
  const result = new Map();
  for (const [key, value] of Object.entries(items)) {
    const id = key.slice(REMINDER_PREFIX.length);
    if (key.startsWith(REMINDER_PREFIX) && validReminder(value) && items[PREFIX + id]) result.set(id, value);
  }
  return result;
}

// Alerts that fired and are still showing in the alert window, soonest reminder first.
export function activeAlerts(items) {
  return [...remindersByNote(items)]
    .filter(([, reminder]) => reminder.alertedAt)
    .map(([id, reminder]) => ({ id, reminder, note: items[PREFIX + id] }))
    .sort((a, b) => a.reminder.at - b.reminder.at);
}

// Takes the reminder out of the alert window but keeps it, still due if it is.
export function withoutAlert(reminder) {
  const { alertedAt, ...rest } = reminder;
  return rest;
}

// Dismissing an early alert keeps the reminder; dismissing once due finishes it (null).
export function dismissed(reminder, now) {
  return isDue(reminder, now) ? null : withoutAlert(reminder);
}

export function anyDue(items, now) {
  return [...remindersByNote(items).values()].some(reminder => isDue(reminder, now));
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS = [['year', 31536e3], ['month', 2592e3], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
export function relativeTime(time, now = Date.now()) {
  const seconds = (time - now) / 1000;
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) || [];
  return unit ? relative.format(Math.round(seconds / size), unit) : 'now';
}

// "Due in 1 hour", "Due now", "Was due 2 hours ago".
export function dueText(at, now = Date.now()) {
  if (Math.abs(at - now) < MINUTE) return 'Due now';
  return (at > now ? 'Due ' : 'Was due ') + relativeTime(at, now);
}

// <input type="datetime-local"> works in local time without a zone suffix.
export function toLocalInput(time) {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * MINUTE).toISOString().slice(0, 16);
}
export function fromLocalInput(value) { return value ? new Date(value).getTime() : NaN; }
