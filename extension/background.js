import { PREFIX, badgeText, noteKey, notesForUrl } from './notes.js';
import { ALARM_PREFIX, activeAlerts, alertPending, anyDue, nextWake, notesWithReminders, validReminder } from './reminders.js';

const storage = chrome.storage.local;
const NOTE_COLOR = '#2f6b57';
const DUE_COLOR = '#b45309';
const NOTE_ICON = { 16: 'icons/16.png', 32: 'icons/32.png' };
// One swing of the bell on its hinge, drawn by scripts/icons.py.
const BELL_FRAMES = Array.from({ length: 8 }, (_, frame) => ({ 16: `icons/bell-${frame}-16.png`, 32: `icons/bell-${frame}-32.png` }));
const FRAME_MS = 100;

// Badges are cosmetic, so a failed update is not worth surfacing as an error.
const quietly = promise => promise.catch(() => {});

// A due reminder shows "!" on every tab until it is dismissed, so it is noticed
// even when OS notifications are muted or the reminder's page isn't open.
// While the bell flashes it is the signal, so the badge steps aside rather than cover it.
function setBadge(tab, items, due, ringing) {
  const text = ringing ? '' : due ? '!' : badgeText(notesForUrl(items, tab.url).length);
  // The tab may close between query and update; a stale badge is harmless.
  return chrome.action.setBadgeText({ tabId: tab.id, text }).catch(() => {});
}

async function updateAll() {
  const [items, tabs] = await Promise.all([storage.get(null), chrome.tabs.query({})]);
  const due = anyDue(items, Date.now());
  const ringing = activeAlerts(items).length > 0;
  ring(ringing);
  await chrome.action.setBadgeBackgroundColor({ color: due ? DUE_COLOR : NOTE_COLOR });
  await Promise.all(tabs.map(tab => setBadge(tab, items, due, ringing)));
}

async function refresh(tab) {
  const items = await storage.get(null);
  await setBadge(tab, items, anyDue(items, Date.now()), activeAlerts(items).length > 0);
}

// While an alert waits, the toolbar bell swings and flashes. Each
// setIcon call counts as activity, so Chrome keeps the worker awake until it stops.
let flashing;
function ring(on) {
  if (on === Boolean(flashing)) return;
  if (on) {
    let frame = 0;
    quietly(chrome.action.setIcon({ path: BELL_FRAMES[frame] }));
    flashing = setInterval(() => {
      frame = (frame + 1) % BELL_FRAMES.length;
      quietly(chrome.action.setIcon({ path: BELL_FRAMES[frame] }));
    }, FRAME_MS);
  } else {
    clearInterval(flashing);
    flashing = undefined;
    quietly(chrome.action.setIcon({ path: NOTE_ICON }));
  }
}

// Reminders

async function schedule(noteId, reminder) {
  const wake = validReminder(reminder) && nextWake(reminder);
  // A wake time already past (missed while Chrome was closed) fires straight away.
  if (wake) await chrome.alarms.create(ALARM_PREFIX + noteId, { when: Math.max(wake, Date.now() + 1000) });
  else await chrome.alarms.clear(ALARM_PREFIX + noteId);
}

// While an alert waits, the toolbar icon becomes an amber bell and the popup opens
// by itself to show it. Chrome can only open the popup while one of its windows is
// in front, so an alert that fires while you're in another app opens the popup when
// you come back. Each alert opens the popup once; the bell stays until it's handled.
const POPPED = 'poppedAlerts';
const alertId = note => note.id + '@' + note.reminder.alertedAt;
let popping = Promise.resolve();

async function openPopupForAlerts() {
  const waiting = activeAlerts(await storage.get(null));
  const { [POPPED]: popped = [] } = await chrome.storage.session.get(POPPED);
  const fresh = waiting.filter(alert => !popped.includes(alertId(alert)));
  if (!fresh.length) return;
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined);
  if (!win?.focused) return;
  await chrome.action.openPopup({ windowId: win.id });
  // Remember only alerts still waiting, so the list can't grow forever.
  await chrome.storage.session.set({ [POPPED]: waiting.map(alertId) });
}

function popUp() {
  popping = popping.catch(() => {}).then(openPopupForAlerts);
  return popping;
}

async function check(noteId) {
  const key = noteKey(noteId);
  const note = (await storage.get(key))[key];
  const reminder = note?.reminder;
  if (!validReminder(reminder)) return chrome.alarms.clear(ALARM_PREFIX + noteId);
  const now = Date.now();
  const alert = alertPending(reminder, now);
  // Leave it alone if the popup changed the note since we read it.
  const latest = (await storage.get(key))[key];
  if (JSON.stringify(latest) !== JSON.stringify(note)) return;
  // Recording progress triggers storage.onChanged, which reschedules and repaints badges.
  // The note's updatedAt is left alone: bookkeeping isn't an edit.
  await storage.set({ [key]: { ...note, reminder: { ...reminder, handledUntil: now, ...(alert && { alertedAt: now }) } } });
  if (alert) await popUp();
}

// Chrome can drop alarms on restart or update, so rebuild them from storage.
async function rescheduleAll() {
  const notes = notesWithReminders(await storage.get(null));
  const live = new Set(notes.map(note => note.id));
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm => alarm.name.startsWith(ALARM_PREFIX) && !live.has(alarm.name.slice(ALARM_PREFIX.length)))
    .map(alarm => chrome.alarms.clear(alarm.name)));
  await Promise.all(notes.map(note => schedule(note.id, note.reminder)));
}

// Startup

async function init() {
  await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await rescheduleAll();
  await updateAll();
  // Alerts left unanswered when Chrome quit pop up again on the next launch.
  await popUp();
}

// The worker may have been stopped mid-alert; pick the flashing back up when it restarts.
quietly(storage.get(null).then(items => ring(activeAlerts(items).length > 0)));

chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) quietly(popUp());
});

chrome.runtime.onInstalled.addListener(() => quietly(init()));
chrome.runtime.onStartup.addListener(() => quietly(init()));

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name.startsWith(ALARM_PREFIX)) quietly(check(alarm.name.slice(ALARM_PREFIX.length)));
});

// Chrome clears per-tab badges on navigation, so recount once the page settles.
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'complete') quietly(refresh(tab));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let repaint = false;
  for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (!key.startsWith(PREFIX)) continue;
    // Deleting a note takes its reminder, and so its alarm, with it.
    if (JSON.stringify(oldValue?.reminder) !== JSON.stringify(newValue?.reminder)) {
      quietly(schedule(key.slice(PREFIX.length), newValue?.reminder));
      repaint = true;
    }
    // Counts only change when a note is created or deleted, not on every keystroke.
    if (!oldValue || !newValue || oldValue.url !== newValue.url) repaint = true;
  }
  if (repaint) quietly(updateAll());
});
