import { noteKey, newNote, notesForUrl, savedNotes, supportedUrl, createWriter } from './notes.js';

const $ = id => document.getElementById(id);
const storage = chrome.storage.local;
const write = createWriter(storage);
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

function iconButton(icon, label, className, onClick) {
  const node = button(undefined, 'icon ' + className, onClick);
  node.setAttribute('aria-label', label);
  node.title = label;
  node.innerHTML = svg(icon);
  return node;
}

const svg = icon => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;

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
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const UNITS = [['year', 31536e3], ['month', 2592e3], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
function ago(time) {
  const seconds = (time - Date.now()) / 1000;
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) || [];
  return unit ? relative.format(Math.round(seconds / size), unit) : 'just now';
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
    const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
    window.close();
  } catch { fail("Couldn't open that page."); }
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
  } else {
    const actions = el('div', 'actions');
    actions.append(
      iconButton('edit', 'Edit note', 'edit', () => { editing = { id: note.id, text: note.text }; confirming = undefined; render(); }),
      iconButton('trash', 'Delete note', 'delete', () => { confirming = note.id; render(); }),
    );
    card.append(el('p', 'note-text', note.text), bar(timestamp(note), actions));
  }
  return card;
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
  document.querySelector('.note.editing textarea')?.focus();
}

// The action bar only appears once there's something to act on.
function setDraftControls() {
  $('composer-bar').hidden = !$('note').value;
  $('save').disabled = !$('note').value.trim();
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !supportedUrl(tab.url)) {
    $('page-title').textContent = 'Notes only work on web pages';
    $('page-url').textContent = 'Your saved notes are under All notes.';
  } else {
    page = tab;
    $('page-title').textContent = page.title || hostname(page.url);
    $('page-url').textContent = page.url.replace(/^https?:\/\/(www\.)?/, '');
    $('page-url').title = page.url;
    $('page-icon').replaceWith(Object.assign(favicon(page.url), { id: 'page-icon' }));
    $('composer').hidden = false;
    $('note').focus();
  }
  render();
} catch {
  $('page-title').textContent = "Couldn't load notes";
  fail('Close and reopen the extension to try again.');
}
