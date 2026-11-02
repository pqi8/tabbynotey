import { noteKey, newNote, notesForUrl, savedNotes, supportedUrl, createWriter } from './notes.js';
import { initAppearance } from './appearance.js';
import { ALERTS, DEFAULT_ALERTS, activeAlerts, dismissed, dueText, fromLocalInput, isDue, newReminder, relativeTime, reminderProblem, toLocalInput, validReminder, withoutAlert } from './reminders.js';
import { focusOrOpen } from './pages.js';

const $ = id => document.getElementById(id);
const storage = chrome.storage.local;
const { save: write, setReminder } = createWriter(storage);
let items = {};
let page;          // active tab, when it is a web page
let draft;         // note being composed; saved as you type, listed once added
let draftWrite = Promise.resolve(true);
let editing;       // { id, text } of the saved note open for inline editing
let confirming;    // id of the note awaiting delete confirmation
let revision = 0;

// Lucide icons (ISC licence), inlined so the popup makes no network requests.
const ICONS = {
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  open: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
};

function fail(message) { $('error').textContent = message; $('error').hidden = false; }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

const svg = icon => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;

function iconButton(icon, label, className, onClick) {
  const node = button(undefined, 'icon ' + className, onClick);
  node.setAttribute('aria-label', label);
  node.title = label;
  node.innerHTML = svg(icon);
  return node;
}

function bar(...children) {
  const node = el('div', 'bar');
  node.append(...children);
  return node;
}

// Chrome serves cached favicons to extensions with the `favicon` permission, without fetching the site.
function favicon(url) {
  const img = el('img', 'favicon');
  img.alt = '';
  img.src = chrome.runtime.getURL('/_favicon/?' + new URLSearchParams({ pageUrl: url, size: '32' }));
  return img;
}

const hostname = url => new URL(url).hostname.replace(/^www\./, '');
function ago(time) {
  const text = relativeTime(time);
  return text === 'now' ? 'just now' : text;
}

function timestamp(note) {
  const node = el('time', '', (note.updatedAt - note.createdAt > 60000 ? 'Edited ' : '') + ago(note.updatedAt));
  node.dateTime = new Date(note.updatedAt).toISOString();
  node.title = new Date(note.updatedAt).toLocaleString();
  return node;
}

async function persist(note, status, { saved: savedMessage = 'Saved', empty: emptyMessage = '' } = {}) {
  const version = ++revision;
  if (status) status.textContent = 'Saving…';
  $('error').hidden = true;
  try {
    const saved = await write(note);
    if (saved) items[noteKey(note.id)] = saved;
    else delete items[noteKey(note.id)];
    if (status && version === revision) status.textContent = saved ? savedMessage : emptyMessage;
    renderCounts();
    return true;
  } catch {
    if (version === revision) {
      if (status) status.textContent = 'Not saved';
      fail("Couldn't save. Copy your note before closing this popup. Storage may be full.");
    }
    return false;
  }
}

async function openPage(url) {
  try {
    await focusOrOpen(url);
    window.close();
  } catch { fail("Couldn't open that page."); }
}

// Reminders

const reminderFor = id => {
  const reminder = items[noteKey(id)]?.reminder;
  return validReminder(reminder) ? reminder : undefined;
};
const formatWhen = time => new Date(time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function reminderPill(reminder) {
  const due = isDue(reminder, Date.now());
  const pill = el('span', due ? 'pill due' : 'pill');
  pill.innerHTML = svg('bell');
  pill.append(due ? 'Due' : formatWhen(reminder.at));
  pill.title = (due ? formatWhen(reminder.at) + ' · ' : '') + dueText(reminder.at);
  return pill;
}

// Pass no reminder to clear it.
async function saveReminder(noteId, reminder) {
  const saved = await setReminder(noteId, reminder ?? undefined);
  if (saved) items[noteKey(noteId)] = saved;
}

// Short chip labels; the full wording stays in each chip's tooltip and accessible name.
const CHIP = { 1440: '1 day', 60: '1 hour', 30: '30 min', 15: '15 min', 5: '5 min', 0: 'At time' };
const dayKey = time => toLocalInput(time).slice(0, 10);

// A month calendar sized for the popup. Chrome's own date-time picker spills past the popup's edge.
function calendar(state, onPick) {
  const root = el('div', 'calendar');
  const today = dayKey(Date.now());
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);

  function draw() {
    const month = state.month;
    const title = el('span', 'cal-title', month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
    const shift = by => () => { state.month = new Date(month.getFullYear(), month.getMonth() + by, 1); draw(); root.querySelector('.cal-nav:not(:disabled)')?.focus(); };
    const prev = iconButton('left', 'Previous month', 'cal-nav', shift(-1));
    prev.disabled = month <= thisMonth;
    const next = iconButton('right', 'Next month', 'cal-nav', shift(1));

    const grid = el('div', 'cal-grid');
    grid.setAttribute('role', 'grid');
    const names = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
    for (let d = 0; d < 7; d++) grid.append(el('span', 'cal-weekday', names.format(new Date(2026, 1, d + 1))));
    for (let i = 0; i < month.getDay(); i++) grid.append(el('span'));
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const key = dayKey(date.getTime());
      const day = button(String(d), 'day', () => { state.day = key; draw(); root.querySelector('.day[aria-pressed="true"]')?.focus(); onPick(); });
      day.setAttribute('aria-label', date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
      day.setAttribute('aria-pressed', key === state.day);
      if (key === today) day.classList.add('today');
      day.disabled = key < today;
      grid.append(day);
    }
    root.replaceChildren(bar(title, prev, next), grid);
  }
  draw();
  return root;
}

// The reminder part of a note: a "Remind me" switch, and when it's on, a day, a time,
// and which alerts to send. Saves on every valid change, like note text does.
function reminderPanel(noteId, { onEscape } = {}) {
  const existing = reminderFor(noteId);
  const panel = el('div', 'remind');

  const toggle = button(undefined, 'remind-toggle', () => setOn(!on));
  toggle.setAttribute('role', 'switch');
  toggle.innerHTML = '<span class="remind-label">Remind me</span><span class="switch" aria-hidden="true"></span>';
  const body = el('div', 'remind-body');

  const start = new Date(existing?.at ?? Date.now());
  const state = { day: existing ? dayKey(existing.at) : '', month: new Date(start.getFullYear(), start.getMonth(), 1) };

  // A new reminder starts at the next whole hour, so picking a day is usually enough.
  const time = el('input');
  time.type = 'time';
  time.step = 60;
  time.value = toLocalInput(existing?.at ?? Math.ceil((Date.now() + 1) / 3600000) * 3600000).slice(11);
  time.setAttribute('aria-label', 'Time');

  const selected = new Set(existing?.alerts ?? DEFAULT_ALERTS);
  const chips = el('div', 'chips');
  for (const [minutes, text] of ALERTS) {
    const chip = button(CHIP[minutes], 'chip', () => {
      selected.has(minutes) ? selected.delete(minutes) : selected.add(minutes);
      chip.setAttribute('aria-pressed', selected.has(minutes));
      save();
    });
    chip.title = text;
    chip.setAttribute('aria-label', text);
    chip.setAttribute('aria-pressed', selected.has(minutes));
    chips.append(chip);
  }

  const status = el('span', 'status');
  status.setAttribute('role', 'status');
  let cal = calendar(state, save);

  let on = Boolean(existing);
  async function setOn(value) {
    on = value;
    toggle.setAttribute('aria-checked', on);
    body.hidden = !on;
    status.className = 'status';
    if (on) { status.textContent = 'Pick a day'; focusReminder(body); return; }
    // Off means the note has no reminder.
    state.day = '';
    cal.replaceWith(cal = calendar(state, save));
    status.textContent = '';
    if (!reminderFor(noteId)) return;
    try { await saveReminder(noteId, undefined); renderCounts(); renderAlerts(); } catch { fail("Couldn't remove that reminder."); }
  }

  async function save() {
    const at = state.day ? fromLocalInput(`${state.day}T${time.value}`) : NaN;
    const problem = reminderProblem(at, [...selected]);
    // Choosing a time or alerts before a day isn't an error worth flagging yet.
    status.className = problem && state.day ? 'status warn' : 'status';
    if (problem) { status.textContent = state.day ? problem : 'Pick a day'; return; }
    try {
      await saveReminder(noteId, newReminder(at, [...selected]));
      status.textContent = dueText(at);
      renderCounts();
    } catch {
      status.className = 'status warn';
      status.textContent = 'Not saved';
    }
  }
  time.addEventListener('change', save);
  if (onEscape) panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); onEscape(); } });

  const timeRow = el('label', 'remind-row');
  timeRow.append(el('span', 'remind-label', 'Time'), time);
  const alertRow = el('div', 'remind-row alerts-row');
  alertRow.append(el('span', 'remind-label', 'Alert'), chips);
  body.append(cal, timeRow, alertRow, bar(status));
  toggle.setAttribute('aria-checked', on);
  body.hidden = !on;
  if (existing) status.textContent = dueText(existing.at);
  panel.append(toggle, body);
  return panel;
}

// Puts the keyboard on the chosen day, or today, when a reminder panel opens.
function focusReminder(container) {
  container?.querySelector('.day[aria-pressed="true"], .day.today, .day:not(:disabled)')?.focus({ preventScroll: true });
}

// Alerts that fired and haven't been handled, from any page. The background opens
// the popup when one fires; handling them here turns the toolbar bell back off.
function alertCard(note) {
  const { id, reminder } = note;
  const due = isDue(reminder, Date.now());
  const card = el('article', due ? 'note alert due' : 'note alert');
  const page = button(undefined, 'alert-page', () => act(withoutAlert(reminder), true));
  page.title = note.url;
  page.append(favicon(note.url), el('span', '', note.title || hostname(note.url)));
  const pill = el('span', due ? 'pill due' : 'pill');
  pill.innerHTML = svg('bell');
  pill.append(dueText(reminder.at));
  pill.title = formatWhen(reminder.at);

  // Opening the page counts as seeing the alert; a due note stays amber until dismissed.
  async function act(next, open) {
    try { await saveReminder(id, next); } catch { fail("Couldn't update that reminder."); return; }
    if (open) await openPage(note.url);
    else render();
  }
  const head = el('div', 'alert-head');
  head.append(page, pill);
  card.append(head, el('p', 'note-text', note.text), bar(
    button('Open page', 'ghost', () => act(withoutAlert(reminder), true)),
    button('Dismiss', 'primary', () => act(dismissed(reminder, Date.now()), false)),
  ));
  return card;
}

function renderAlerts() {
  const alerts = activeAlerts(items);
  $('alerts').hidden = !alerts.length;
  if (!alerts.length) { $('alerts').replaceChildren(); return; }
  const heading = el('h2', 'alerts-heading');
  heading.innerHTML = svg('bell');
  heading.append(alerts.length > 1 ? `${alerts.length} reminders` : 'Reminder');
  $('alerts').replaceChildren(heading, ...alerts.map(alertCard));
}

// The composer's "Remind me" appears once the draft has text, since a reminder belongs to a saved note.
function syncComposerReminder() {
  const box = $('composer-reminder');
  const show = Boolean(draft && $('note').value.trim());
  box.hidden = !show;
  if (!show) { box.replaceChildren(); delete box.dataset.note; return; }
  if (box.dataset.note !== draft.id) { box.replaceChildren(reminderPanel(draft.id)); box.dataset.note = draft.id; }
}

function noteCard(note, view) {
  const card = el('article', 'note');
  // Only the visible list gets the inline editor, so one note never has two live textareas.
  if (editing?.id === note.id && view === currentView()) {
    card.classList.add('editing');
    const area = el('textarea');
    area.value = editing.text;
    area.maxLength = 20000;
    area.setAttribute('aria-label', 'Edit note');
    const status = el('span', 'status');
    status.setAttribute('role', 'status');
    area.addEventListener('input', () => { editing.text = area.value; persist({ ...note, text: area.value }, status, { empty: 'Empty notes are deleted' }); });
    area.addEventListener('keydown', event => {
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) { event.preventDefault(); stopEditing(); }
    });
    card.append(area, reminderPanel(note.id, { onEscape: stopEditing }), bar(status, button('Done', 'primary', stopEditing)));
  } else if (confirming === note.id) {
    card.classList.add('confirming');
    card.append(el('p', 'note-text', note.text), bar(
      el('span', 'status warn', 'Delete this note?'),
      button('Cancel', 'ghost', () => { confirming = undefined; render(); }),
      button('Delete', 'danger', async () => { confirming = undefined; await persist({ ...note, text: '' }); render(); }),
    ));
  } else {
    const reminder = reminderFor(note.id);
    const due = reminder && isDue(reminder, Date.now());
    if (due) card.classList.add('due');
    const actions = el('div', 'actions');
    actions.append(
      iconButton('edit', 'Edit note', 'edit', () => openEditor(note)),
      iconButton('trash', 'Delete note', 'delete', () => { confirming = note.id; render(); }),
    );
    const meta = el('span', 'meta');
    if (reminder) meta.append(reminderPill(reminder));
    meta.append(timestamp(note));
    const tail = due ? [actions, button('Dismiss', 'ghost', async () => {
      try { await saveReminder(note.id, undefined); } catch { fail("Couldn't dismiss that reminder."); }
      render();
    })] : [actions];
    card.append(el('p', 'note-text', note.text), bar(meta, ...tail));
  }
  return card;
}

function openEditor(note) {
  editing = { id: note.id, text: note.text };
  confirming = undefined;
  render();
  document.querySelector('.note.editing textarea')?.focus();
}

function stopEditing() { editing = undefined; render(); }

function pageGroup(notes) {
  const [{ url, title }] = notes;
  const group = el('section', 'group');
  const head = button(undefined, 'group-head', () => openPage(url));
  head.title = url;
  head.append(favicon(url), el('span', 'group-title', title || hostname(url)), el('span', 'group-host', hostname(url)));
  head.insertAdjacentHTML('beforeend', svg('open'));
  group.append(head, ...notes.map(note => noteCard(note, 'library')));
  return group;
}

const currentView = () => $('library').hidden ? 'page' : 'library';

function setCount(node, count) { node.textContent = count; node.hidden = !count; }

function renderCounts() {
  const all = savedNotes(items).length;
  setCount($('count'), all);
  setCount($('page-count'), page ? notesForUrl(items, page.url).length : 0);
  $('export').disabled = !all;
}

function render() {
  renderCounts();
  renderAlerts();
  if (page) {
    const notes = notesForUrl(items, page.url).filter(note => note.id !== draft?.id);
    $('page-notes').replaceChildren(...notes.map(note => noteCard(note, 'page')));
  }
  // Group by page, ordered by each page's most recent edit.
  const query = $('search').value.trim();
  const groups = Map.groupBy(savedNotes(items, query), note => note.url);
  $('notes').replaceChildren(...[...groups.values()].map(pageGroup));
  if (!groups.size) {
    $('notes').append(el('p', 'empty', query ? `No notes match “${query}”.` : 'No notes yet.'));
  }
}

// The action bar only appears once there's something to act on.
function setDraftControls() {
  $('composer-bar').hidden = !$('note').value;
  $('save').disabled = !$('note').value.trim();
  syncComposerReminder();
}

async function finishDraft() {
  if (!draft?.text.trim() || !await draftWrite) return;
  draft = undefined;
  $('note').value = '';
  $('status').textContent = '';
  setDraftControls();
  render();
  $('note').focus();
}

for (const [tab, view] of [['current-tab', 'page'], ['all-tab', 'library']]) {
  $(tab).addEventListener('click', () => {
    $('editor').hidden = view !== 'page';
    $('library').hidden = view !== 'library';
    $('current-tab').removeAttribute('aria-current');
    $('all-tab').removeAttribute('aria-current');
    $(tab).setAttribute('aria-current', 'page');
    render();
    if (editing) return;
    if (view === 'library') $('search').focus();
    else if (page) $('note').focus();
  });
}
$('note').addEventListener('input', () => {
  draft ??= newNote(page.url, page.title);
  draft.text = $('note').value;
  setDraftControls();
  draftWrite = persist({ ...draft }, $('status'), { saved: 'Draft saved' });
});
$('note').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); finishDraft(); }
});
$('save').addEventListener('click', finishDraft);
$('discard').addEventListener('click', async () => {
  const note = draft;
  draft = undefined;
  $('note').value = '';
  setDraftControls();
  // Deleting the draft deletes its reminder too: it's part of the note.
  if (note) await persist({ ...note, text: '' }, $('status'));
  $('note').focus();
});
$('search').addEventListener('input', render);
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 2, notes: savedNotes(items) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tabbynotey-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('shortcut').textContent = 'Ctrl ↵';

try {
  items = await storage.get(null);
  initAppearance(storage, items);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !supportedUrl(tab.url)) {
    $('page-title').textContent = 'Notes only work on web pages';
    $('page-url').textContent = 'Your saved notes are under All notes.';
  } else {
    page = tab;
    $('page-title').textContent = page.title || hostname(page.url);
    $('page-url').textContent = page.url.replace(/^https?:\/\/(www\.)?/, '');
    $('page-url').title = page.url;
    const icon = favicon(page.url);
    icon.id = 'page-icon';
    $('page-icon').replaceWith(icon);
    $('composer').hidden = false;
    $('note').focus();
  }
  render();
} catch {
  $('page-title').textContent = "Couldn't load notes";
  fail('Close and reopen the extension to try again.');
}
