export const PREFIX = 'note:';

export function supportedUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

// Each note is its own record under `note:<id>`, so a page can hold many notes.
// 0.1.0 stored one note per page under `note:<url>`; deriving the id from the key
// keeps those records readable, editable, and deletable without a migration.
export function noteKey(id) { return PREFIX + id; }

export function newNote(url, title) {
  const now = Date.now();
  return { id: crypto.randomUUID(), url, title, text: '', createdAt: now, updatedAt: now };
}

export function savedNotes(items, query = '') {
  const needle = query.trim().toLocaleLowerCase();
  return Object.entries(items)
    .filter(([key, value]) => key.startsWith(PREFIX) && value &&
      supportedUrl(value.url) && typeof value.text === 'string' && value.text.trim())
    .map(([key, value]) => {
      // Records written by older versions may lack one of the timestamps.
      const updatedAt = value.updatedAt || value.createdAt || 0;
      return { ...value, id: key.slice(PREFIX.length), createdAt: value.createdAt || updatedAt, updatedAt };
    })
    .filter(note => [note.title, note.url, note.text].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Keep query strings and fragments: different documents can share a path.
export function notesForUrl(items, url) {
  return savedNotes(items).filter(note => note.url === url).sort((a, b) => b.createdAt - a.createdAt);
}

export function badgeText(count) { return count > 99 ? '99+' : count ? String(count) : ''; }

// A note's reminder lives on the note as `reminder: { at, alerts, handledUntil, alertedAt? }`.
// The background also writes to it as alerts fire, so every write re-reads the stored
// note and changes only its own part: saving text keeps the stored reminder, and
// setting a reminder keeps the stored text.
//
// Writes are serialized so an earlier keystroke cannot overwrite a later edit.
export function createWriter(storage) {
  let pending = Promise.resolve();
  const queue = task => (pending = pending.catch(() => {}).then(task));
  const stored = async key => (await storage.get(key))[key];

  // Blank text deletes the note, reminder and all. Resolves with the stored record.
  const save = note => queue(async () => {
    const key = noteKey(note.id);
    if (!note.text.trim()) { await storage.remove(key); return null; }
    const { reminder: _, ...fields } = note;
    const { reminder } = await stored(key) ?? {};
    const record = { ...fields, ...(reminder && { reminder }), updatedAt: Date.now() };
    await storage.set({ [key]: record });
    return record;
  });

  // Sets or (with no reminder) clears it. Resolves with the stored note, or null if it's gone.
  const setReminder = (id, reminder) => queue(async () => {
    const key = noteKey(id);
    const note = await stored(key);
    if (!note) return null;
    const { reminder: _, ...record } = note;
    if (reminder) record.reminder = reminder;
    await storage.set({ [key]: record });
    return record;
  });

  return { save, setReminder };
}
