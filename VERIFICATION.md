# Verification

## Color picker build 0.2.2 — 2026-10-24

- Eleven unit tests, extension module syntax, and whitespace checks pass. All eleven release ZIP entries match source byte for byte, including the extracted appearance module.
- Appearance handling is isolated in `appearance.js`. Regression tests cover queued saves followed by reset, storage failure/retry, and stale save completions during color preview or eyedropper cancellation. Repeated installed-ZIP smoke checks after extraction: no popup errors, note workflows and appearance persistence/reset pass.
- Installed the ZIP in isolated Chrome 156.0.8078.48 and repeated the 0.2.1 note/edit/search/delete/badge checks with no page errors.
- Verified custom color persistence after reload, light/dark palette changes, resetting and reopening, and the presence of Chrome's native EyeDropper API. Visually inspected both appearance layouts.
- Updated the custom palette to color the full panel, note cards, inputs, and borders. Checked 132 text/background combinations across eleven colors in light/dark mode; minimum contrast was 4.79:1. Regenerated Shevaun's teal preview from the installed extension's rendered DOM and checked all three preview views at 728px and 360px.
- Verified screen-pick success and Esc cancellation handling using controlled EyeDropper results. Actual native sampling from Chrome's toolbar requires a manual desktop check; headless checks do not verify that interaction.
- Submitted 0.2.2 to the existing unlisted Web Store item with automatic publishing enabled, replacing the canceled 0.2.1 review. Google confirmed submission. Published version remains 0.2.0 pending approval.

## Cleanup release 0.2.1 — 2026-10-24

- `npm test`: eight tests pass, including missing-timestamp fallback.
- Syntax checks pass for all three extension JavaScript modules; `git diff --check` passes.
- Packaged `dist/tabbynotey-0.2.1.zip`; verified all ten archive entries match the extension source byte for byte.
- Installed the extracted release ZIP in an isolated headless Chrome 156.0.8078.48 profile using the Puppeteer workflow documented in `store/capture.mjs`. Passed creating/autosaving a note, editing/autosaving, initial editor focus, retaining search focus while an editor is open, rendering records with one or both timestamps missing, confirmed deletion, and badge counts after reload. No popup page errors.
- Permissions remain `tabs`, `storage`, and `favicon`.

## Earlier verification

Checked on 2026-10-22 for 0.2.0.

- `npm test`: seven tests pass. They cover URL support, unique ids per note, library filtering/search/sort, exact-URL page lists that include 0.1.0 records, badge text, ordered rapid saves with blank-text deletion, and storage-failure recovery.
- `node --check` passes for `popup.js` and `background.js`.
- `npm run package`: creates `dist/tabbynotey-0.2.0.zip` with the manifest, five runtime files, and four icons; development preview files are excluded.
- UI redesign: screenshots at 2× in headless Chrome, light and dark, for these states: page view, typing, inline edit, delete confirmation, and All notes. A scripted run against the demo passed add (⌘+Enter), discard, edit (Esc to close), delete, search with no match, search filtering, and editing from All notes, with no page errors.
- T3 browser preview using the development Chrome API adapter. Checked: creating a note gives it its own UUID key and lists it under the page; counts update; inline edit autosaves with a single editor; delete requires confirmation and removes only that note; All notes lists each note separately with its page; a 0.1.0 record edits in place under its original key.

- Real Chrome 156 (headless, unpacked from the packaged ZIP, installed through Puppeteer's extension API): the service worker starts; the badge shows 2 after two notes are added for a tab, keeps 2 after a reload, drops to 1 after a delete, and is blank on a page with no notes. The popup's All notes list renders with a 32px favicon from Chrome's cache, and there are no page errors.

Not verified: clicking the real toolbar popup (headless Chrome has no toolbar, so the popup was opened as a tab), switching to an existing tab from All notes, persistence across a real Chrome restart, export download completion, or installation under a managed (enterprise) browser policy, including whether the `tabs` permission is allowed. See README for the manual checklist.
