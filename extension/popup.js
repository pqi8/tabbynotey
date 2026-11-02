import { noteKey, newNote, notesForUrl, savedNotes, supportedUrl, createWriter } from './notes.js';
import { initAppearance } from './appearance.js';
import { ALERTS, DEFAULT_ALERTS, activeAlerts, dismissed, dueText, fromLocalInput, isDue, newReminder, relativeTime, reminderKey, reminderProblem, toLocalInput, validReminder, withoutAlert } from './reminders.js';
import { focusOrOpen } from './pages.js';

const $ = id => document.getElementById(id);
const storage = chrome.storage.local;
const write = createWriter(storage);
let items = {};
let page;          // active tab, when it is a web page
let draft;         // note being composed; saved as you type, listed once added
let draftWrite = Promise.resolve(true);
let editing;       // { id, text } of the saved note open for inline editing
let confirming;    // id of the note awaiting delete confirmation
let reminding;     // id of the saved note whose reminder editor is open
let revision = 0;

// Lucide icons (ISC licence), inlined so the popup makes no network requests.
const ICONS = {
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  open: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
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

const reminderFor = id => validReminder(items[reminderKey(id)]) ? items[reminderKey(id)] : undefined;
const formatWhen = time => new Date(time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function reminderPill(reminder) {
  const due = isDue(reminder, Date.now());
  const pill = el('span', due ? 'pill due' : 'pill');
  pill.innerHTML = svg('bell');
  pill.append(due ? 'Due' : formatWhen(reminder.at));
  pill.title = (due ? formatWhen(reminder.at) + ' · ' : '') + dueText(reminder.at);
  return pill;
}

async function saveReminder(noteId, reminder) {
  const key = reminderKey(noteId);
  if (reminder) { await storage.set({ [key]: reminder }); items[key] = reminder; }
  else { await storage.remove(key); delete items[key]; }
}

// Date and time, plus which alerts to send. Saves on every valid change, like notes do.
function reminderPanel(noteId, onDone) {
  const existing = reminderFor(noteId);
  const panel = el('div', 'remind');
  const when = el('input');
  when.type = 'datetime-local';
  when.min = toLocalInput(Date.now());
  when.value = existing ? toLocalInput(existing.at) : '';
  when.id = 'remind-at-' + crypto.randomUUID();
  const label = el('label', 'remind-label', 'Remind me');
  label.htmlFor = when.id;

  const alerts = el('fieldset', 'alert-options');
  alerts.append(el('legend', 'remind-label', 'Alert me'));
  const selected = existing?.alerts ?? DEFAULT_ALERTS;
  for (const [minutes, text] of ALERTS) {
    const option = el('label', 'alert-option');
    const box = el('input');
    box.type = 'checkbox';
    box.value = minutes;
    box.checked = selected.includes(minutes);
    option.append(box, text);
    alerts.append(option);
  }

  const status = el('span', 'status');
  status.setAttribute('role', 'status');
  const remove = button('Remove', 'ghost', async () => {
    try {
      await saveReminder(noteId, undefined);
      when.value = '';
      remove.hidden = true;
      status.className = 'status';
      status.textContent = 'Reminder removed';
      renderCounts();
    } catch { status.textContent = 'Not removed'; }
  });
  remove.hidden = !existing;
  if (existing) status.textContent = dueText(existing.at);

  async function save() {
    const at = fromLocalInput(when.value);
    const chosen = [...alerts.querySelectorAll('input:checked')].map(box => Number(box.value));
    const problem = reminderProblem(at, chosen);
    status.className = problem ? 'status warn' : 'status';
    // Ticking alerts before picking a time isn't an error worth flagging yet.
    if (problem) { status.textContent = when.value || existing ? problem : ''; return; }
    try {
      await saveReminder(noteId, newReminder(at, chosen));
      remove.hidden = false;
      status.textContent = dueText(at);
      renderCounts();
    } catch {
      status.className = 'status warn';
      status.textContent = 'Not saved';
    }
  }
  when.addEventListener('change', save);
  alerts.addEventListener('change', save);
  when.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); onDone(); } });

  panel.append(label, when, alerts, bar(status, remove, button('Done', 'primary', onDone)));
  return panel;
}

// Alerts that fired and haven't been handled, from any page. The background opens
// the popup when one fires; handling them here turns the toolbar bell back off.
function alertCard({ id, note, reminder }) {
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

function openComposerReminder() {
  const open = $('composer-reminder').hidden;
  $('remind').setAttribute('aria-expanded', open);
  $('composer-reminder').hidden = !open;
  if (!open) { $('composer-reminder').replaceChildren(); $('note').focus(); return; }
  $('composer-reminder').replaceChildren(reminderPanel(draft.id, closeComposerReminder));
  $('composer-reminder').querySelector('input').focus();
  $('composer-bar').scrollIntoView({ block: 'nearest' });
}

function closeComposerReminder() {
  $('composer-reminder').hidden = true;
  $('composer-reminder').replaceChildren();
  $('remind').setAttribute('aria-expanded', 'false');
  setDraftControls();
  $('note').focus();
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
    card.append(area, bar(status, button('Done', 'primary', stopEditing)));
  } else if (confirming === note.id) {
    card.classList.add('confirming');
    card.append(el('p', 'note-text', note.text), bar(
      el('span', 'status warn', 'Delete this note?'),
      button('Cancel', 'ghost', () => { confirming = undefined; render(); }),
      button('Delete', 'danger', async () => { confirming = undefined; await persist({ ...note, text: '' }); render(); }),
    ));
  } else if (reminding === note.id && view === currentView()) {
    card.classList.add('reminding');
    card.append(el('p', 'note-text', note.text), reminderPanel(note.id, () => { reminding = undefined; render(); }));
  } else {
    const reminder = reminderFor(note.id);
    const due = reminder && isDue(reminder, Date.now());
    if (due) card.classList.add('due');
    const actions = el('div', 'actions');
    actions.append(
      iconButton('bell', reminder ? 'Edit reminder' : 'Remind me', 'bell', () => {
        reminding = note.id;
        editing = confirming = undefined;
        render();
        const panel = document.querySelector('.note.reminding');
        panel?.scrollIntoView({ block: 'nearest' });
        panel?.querySelector('input')?.focus({ preventScroll: true });
      }),
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
  confirming = reminding = undefined;
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
  $('remind').disabled = !draft || !$('note').value.trim();
  $('remind').classList.toggle('on', Boolean(draft && reminderFor(draft.id)));
}

async function finishDraft() {
  if (!draft?.text.trim() || !await draftWrite) return;
  draft = undefined;
  $('note').value = '';
  $('status').textContent = '';
  closeComposerReminder();
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
$('remind').innerHTML = svg('bell');
$('remind').addEventListener('click', openComposerReminder);
$('discard').addEventListener('click', async () => {
  const note = draft;
  draft = undefined;
  $('note').value = '';
  closeComposerReminder();
  // The background removes a deleted note's reminder from storage.
  if (note) { delete items[reminderKey(note.id)]; await persist({ ...note, text: '' }, $('status')); }
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
