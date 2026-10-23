# Verification

Checked on 2026-10-22 for 0.2.0.

- `npm test`: seven tests pass. They cover URL support, unique ids per note, library filtering/search/sort, exact-URL page lists that include 0.1.0 records, badge text, ordered rapid saves with blank-text deletion, and storage-failure recovery.
- `node --check` passes for `popup.js` and `background.js`.
- `npm run package`: creates `dist/tabbynotey-0.2.0.zip` with the manifest, five runtime files, and four icons; development preview files are excluded.
- UI redesign: screenshots at 2× in headless Chrome, light and dark, for these states: page view, typing, inline edit, delete confirmation, and All notes. A scripted run against the demo passed add (⌘+Enter), discard, edit (Esc to close), delete, search with no match, search filtering, and editing from All notes, with no page errors.
- T3 browser preview using the development Chrome API adapter. Checked: creating a note gives it its own UUID key and lists it under the page; counts update; inline edit autosaves with a single editor; delete requires confirmation and removes only that note; All notes lists each note separately with its page; a 0.1.0 record edits in place under its original key.

- Real Chrome 156 (headless, unpacked from the packaged ZIP, installed through Puppeteer's extension API): the service worker starts; the badge shows 2 after two notes are added for a tab, keeps 2 after a reload, drops to 1 after a delete, and is blank on a page with no notes. The popup's All notes list renders with a 32px favicon from Chrome's cache, and there are no page errors.

Not verified: clicking the real toolbar popup (headless Chrome has no toolbar, so the popup was opened as a tab), switching to an existing tab from All notes, persistence across a real Chrome restart, export download completion, or installation under a managed (enterprise) browser policy, including whether the `tabs` permission is allowed. See README for the manual checklist.
