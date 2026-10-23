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
    .map(([key, value]) => ({ ...value, id: key.slice(PREFIX.length), createdAt: value.createdAt || value.updatedAt || 0 }))
    .filter(note => [note.title, note.url, note.text].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Keep query strings and fragments: different documents can share a path.
export function notesForUrl(items, url) {
  return savedNotes(items).filter(note => note.url === url).sort((a, b) => b.createdAt - a.createdAt);
}

export function badgeText(count) { return count > 99 ? '99+' : count ? String(count) : ''; }

// Serialize writes so an earlier keystroke cannot overwrite a later edit.
// Blank text deletes the note. Resolves with the stored record.
export function createWriter(storage) {
  let pending = Promise.resolve();
  return note => {
    const key = noteKey(note.id);
    pending = pending.catch(() => {}).then(async () => {
      if (!note.text.trim()) { await storage.remove(key); return null; }
      const record = { ...note, updatedAt: Date.now() };
      await storage.set({ [key]: record });
      return record;
    });
    return pending;
  };
}
