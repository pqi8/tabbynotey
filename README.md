# TabbyNotey

A Chrome extension for leaving notes on a page, so you remember why you kept it open.

## Install

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Click **Load unpacked** and select this repo's `extension` folder. Alternatively unzip `dist/tabbynotey-0.3.0.zip` and select its extracted folder.
3. Pin **TabbyNotey** from Chrome's Extensions menu.
4. Open a webpage, click the extension, and type a note. It saves as you type. **Add note** (⌘/Ctrl+Enter) files it and clears the box for the next one.

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/tabbynotey/bdenoogchniaigmpigpkhhmfmkffaimg). Managed Chrome may block developer mode or extension installation. IT must approve distribution in that case; this extension does not bypass enterprise policy.

## Use

- **Badge:** the toolbar icon shows how many notes the current tab's URL has. It updates as you switch tabs, navigate, or add and delete notes.
- **This page:** opening the extension lists every note saved for the current URL, newest first. Add as many notes as you like; each is its own record with an id, the page URL and title, and created/edited times.
- **All notes:** notes grouped by page, most recently edited page first, searchable by title, URL, or note text. Click a page heading to go back to it: an already-open tab is focused, otherwise a new tab opens.
- **Edit / Delete:** hover a note for the pencil and bin icons, in either view. Edits save as you type; **Done**, Esc, or ⌘/Ctrl+Enter closes the editor. Delete asks for confirmation. Clearing all of a note's text also deletes it.
- **Reminders:** click the bell on the composer or a saved note, pick a date and time, and choose any of 24 hours, 1 hour, 30, 15 or 5 minutes before, or at the time. When an alert fires, the toolbar icon becomes an amber bell that swings and flashes, and the TabbyNotey popup opens by itself with the reminder at the top, with **Open page** and **Dismiss**. Chrome only opens the popup while one of its windows is in front, so if you're in another app it opens as soon as you switch back to Chrome. The bell keeps ringing until you open the page or dismiss the alert. Once a reminder's time passes the note turns amber and the badge shows **!** until you dismiss it. Alerts missed while Chrome was closed show on the next launch. Deleting a note deletes its reminder.
- **Export JSON** downloads a backup of all notes. Import is not currently implemented.
- **Appearance:** choose an accent with the color swatch or **Pick from screen** to sample anywhere on screen, including Chrome's toolbar. The palette adapts to light/dark mode and saves locally. **Reset** restores the original palette. Press Esc to cancel screen sampling.

Notes belong to the complete URL, including query parameters and fragments, so changing tracking parameters means a different page. Browser-internal pages and local files are unsupported.

Notes saved by 0.1.0 (one per URL) appear and can be edited or deleted alongside new ones. No migration step is needed.

## Privacy and permissions

- `tabs`: reads open tabs' URLs and titles so the icon badge can count notes for each tab and **All notes** can switch to an already-open page. Chrome shows this permission as "Read your browsing history". The extension never stores or sends URLs except the ones you attach notes to.
- `storage`: stores notes in `chrome.storage.local` in your Chrome profile.
- `alarms`: wakes the background worker when a reminder alert is due.
- `favicon`: shows page icons from Chrome's local favicon cache. No requests go to the sites.
- A background service worker updates the badge. There are no host permissions, content scripts, network requests, analytics, accounts, or cloud sync. Page contents are never read or modified, so site-access policies that block extensions from running on pages don't apply.

Each saved note contains an id, the full URL, page title, note text, and created and last-edited timestamps. A reminder, if set, is stored alongside it with its time and chosen alerts; export does not include reminders. URLs may contain private query parameters; exported backups contain those too. Uninstalling the extension removes its stored notes. Export before uninstalling. This is local browser storage, not encrypted secret storage.

## Development

No build step or third-party runtime dependencies. Node.js 22+ and Python 3 are used for checks and packaging; `scripts/icons.py` (needs Pillow) regenerates the toolbar icons.

```sh
npm test
npm run package
npm run dev
```

Open `http://127.0.0.1:8765/demo.html` for an interactive UI preview with a development-only Chrome API adapter. The demo uses localStorage and fetches favicons from Google (the extension itself never does). It is excluded from the ZIP and does not verify real Chrome permissions. The popup follows the system light/dark setting. Load the unpacked extension in Chrome for the final installation check.

Manual Chrome checks: add two notes to one page and confirm the badge shows 2; switch tabs and navigate and confirm the badge follows; edit and delete from both views; open a note's page from All notes with the tab already open and closed; restart Chrome and confirm notes and badges return; export; confirm internal pages leave the library available.

## License

[MIT](LICENSE) © 2026 Patrick Qi
