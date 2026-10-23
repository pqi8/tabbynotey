# TabbyNotey — Chrome Web Store fields

Prepared for version 0.2.0 on 2026-10-23. Copy the text under each field, not this file's headings or preparation notes.

## Name

TabbyNotey

## Short description

Leave notes on a page so you remember why you kept it open.

## Detailed description

TabbyNotey attaches notes to a page's URL so you can remember why you kept the tab open.

Open the extension on a web page and type a note. Your text saves as you type. Use Add note to file it and start another. The toolbar badge shows how many notes are saved for each open tab's URL.

This page shows notes for the current URL. All notes groups your saved notes by page. Search by note text, page title, or URL, and click a page heading to return to it. You can edit or delete notes and export them as a JSON backup.

Notes stay in chrome.storage.local in this Chrome profile on this device. There is no account, sync, analytics, or transmission to the developer or another service. The extension reads open tabs' URLs to update badges and find already-open pages; it stores the full URL and page title only when you write a note. It displays page icons through Chrome's favicon service. It never reads or changes page content.

Notes match the complete URL, including query parameters and fragments. Browser-internal pages and local files are unsupported. Uninstalling removes the extension's stored notes, so export first if you want a backup. Exported files include note text, full URLs, titles, and timestamps. Import is not available.

Free personal project by Patrick Qi. Contact: patrick.qi@gmail.com.

## Category suggestion

Productivity → Tools (use Tools if the dashboard offers that subcategory; otherwise Productivity).

## Language

English (United States) / en-US

## Single purpose

Let users save, find, and manage local notes attached to web page URLs so they can remember why they kept a tab open.

## Permission justification: tabs

The background service worker reads open tabs' URLs to match locally saved notes and set each tab's toolbar badge to its note count, including after navigation or browser startup. The popup reads the active tab's URL and title to attach a note to that page and display its title. All notes queries open tabs to focus a saved page if it is already open instead of opening a duplicate. activeTab alone cannot provide URLs for every tab needed for the per-tab badges. URLs and titles are saved only with user-written notes; no browsing history log is kept or transmitted. The extension does not read page content.

## Permission justification: storage

Save note text, full page URLs, page titles, note IDs, and creation/edit timestamps in chrome.storage.local so notes persist across popup closes and browser restarts in this profile. No chrome.storage.sync or external storage is used.

## Permission justification: favicon

Display page icons beside the current page and saved page groups using Chrome's extension /_favicon/ endpoint. This identifies the pages in the notes interface without fetching icons from websites or a third-party favicon service. No content script or web-accessible resource is needed.

## Remote code

No, I am not using remote code. All JavaScript, CSS, and icons are bundled in the extension. No remotely hosted executable code, content scripts, or host permissions.

## Data usage disclosures

Select:

- **Web history:** full URLs and page titles associated with notes. Open tabs' URLs are also processed locally for badges and returning to pages. The extension does not query Chrome's history API or keep a general history of visited pages.
- **Website content:** user-entered note text, stored locally. This is a conservative mapping to the dashboard's text/content category; it does not mean the extension reads the contents of visited pages.

Do not select User activity merely because note edits save as you type; there is no click, mouse, scroll, or general keystroke tracking. No other category is intentionally gathered as a feature. Notes are free-form and URLs can contain sensitive parameters; all such text remains local and is included in user-requested exports.

The official documentation's category image lists text under Website content but does not explicitly classify locally authored notes. The mapping above is an implementation judgment. If the live dashboard provides a more specific user-generated-content category, use it for notes and keep Web history for URLs/titles. Do not declare “no data handled” just because storage is local.

## Three certifications

Check all three (the extension's behavior supports each):

- I do not sell user data to third parties.
- I do not use or transfer user data for purposes unrelated to the extension's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

Paste the final public HTTPS URL for privacy.html after hosting it. No policy has been hosted yet. Do not paste a local file path or a placeholder.

## Publisher and distribution

- Publisher display name: Patrick Qi
- Developer account and public contact email: patrick.qi@gmail.com
- Trader status: Non-trader (free personal hobby project, outside trade/business/profession)
- Price: Free; no in-app purchases
- Visibility: Unlisted (anyone with the store URL can install; it is not an access restriction)
- Regions: Patrick to choose; All regions is a reasonable default for this English-language hobby extension.

## Assets

- Store icon: ../extension/icons/128.png (also copied as icon-128.png here)
- Screenshot 1: screenshot-this-page.png, 1280 × 800
- Screenshot 2: screenshot-all-notes.png, 1280 × 800
- Small promo tile: promo-small.png, 440 × 280
- No video or marquee tile supplied; these are optional under the dedicated image guidance.

## Test instructions for reviewer

No login or credentials needed. Open any HTTP(S) page, pin TabbyNotey, and click its toolbar icon. Type a note, then click Add note. Add a second note and check that the badge displays 2. Open All notes, search, edit a note, and click a page heading to return to it. Export downloads JSON. Delete asks for confirmation. Browser-internal pages do not accept notes, but All notes remains available. Notes persist locally across browser restarts.

## Official references

Verified 2026-10-23. See PUBLISHING.md for requirement details and verification limits.

- [Privacy fields and certifications](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Local processing still needs disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Minimum permissions and user data policy](https://developer.chrome.com/docs/webstore/program-policies/user-data)
- [Favicon API](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)
