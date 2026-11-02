import { savedNotes } from './notes.js';

// A reminder is part of its note (`note.reminder`); see createWriter in notes.js.
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

// Notes that have a well-formed reminder.
export const notesWithReminders = items => savedNotes(items).filter(note => validReminder(note.reminder));

// Alerts that fired and are still showing at the top of the popup, soonest reminder first.
export const activeAlerts = items => notesWithReminders(items)
  .filter(note => note.reminder.alertedAt)
  .sort((a, b) => a.reminder.at - b.reminder.at);

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
  return notesWithReminders(items).some(note => isDue(note.reminder, now));
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
