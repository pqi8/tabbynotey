# Publish TabbyNotey yourself

Prepared 2026-10-23 for 0.2.0. Everything in this folder is local. No account was accessed or registered, no payment made, and nothing was hosted, uploaded, submitted, or published.

## 1. Register Patrick's personal publisher

1. Open a Chrome window using your personal Google account. Visit [Google Account security](https://myaccount.google.com/security), verify that the account is **patrick.qi@gmail.com**, open **2-Step Verification**, and turn it on if needed. It is required for publishing and updates.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Sign in yourself as **patrick.qi@gmail.com**. Check the account avatar before proceeding.
3. If you have not registered before, read the developer agreement and policies, select the agreement checkbox, click **Pay registration fee**, and complete the one-time **US$5** payment yourself. Confirm the actual checkout total/currency. Skip payment if this account is already registered.
4. Open **Account** in the left menu. Set the publisher name to **Patrick Qi**. Under contact email, click **Add email**, enter **patrick.qi@gmail.com**, and request verification. Open Google's verification email and follow its link. Save the account details.
5. In the account's trader declaration, select **Non-trader** for this free personal hobby project. Complete any account verification requested by Google using your own accurate details. Non-trader does not exempt the extension from review.

[Registration](https://developer.chrome.com/docs/webstore/register), [account setup](https://developer.chrome.com/docs/webstore/set-up-account), [2-Step Verification requirement](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification), and [trader declaration](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure) are documented by Chrome. The registration page's official illustration shows $5; its prose confirms a fee without specifying a current amount. The live payment screen is authoritative.

## 2. Host the privacy page

Choose a permanent public HTTPS URL. Recommended: a personal GitHub Pages repository. This checkout is not a Git repository; these steps do not require converting or pushing it.

1. In your personal GitHub account, create or choose a public repository for the extension's policy, for example **tabbynotey-privacy**.
2. In that repository, click **Add file → Upload files**. Select this folder's **privacy.html**. Commit it to the default branch using GitHub's UI.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then your default branch and **/(root)**. Click **Save**.
4. Wait for GitHub to show the Pages deployment URL. Open that URL with **/privacy.html** appended. For example, a repository named tabbynotey-privacy normally produces `https://YOUR-USERNAME.github.io/tabbynotey-privacy/privacy.html`; use GitHub's actual URL, not this example.
5. Open the page in an incognito window without signing in. Confirm it renders as a readable policy, with effective date October 23, 2026 and contact patrick.qi@gmail.com. Keep that URL available for the dashboard.

The HTML is self-contained and can also be copied to a public gist; Pages is preferable for a rendered HTML page and a stable policy URL. Only upload the policy; do not upload notes or backups. GitHub UI labels are operational guidance, not independently verified in this task. No repository or gist has been created.

## 3. Check the local release

From the repository root run:

```sh
node --test
python3 scripts/package.py
unzip -l dist/tabbynotey-0.2.0.zip
```

The ZIP must have **manifest.json at its root** and contain only files from extension/. It must not contain store/, demo.js, demo.html, tests, or the packaging scripts. Do not ZIP the repository or store folder.

For a final personal smoke check, use a disposable Chrome profile, open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and select **extension/**. Open an HTTP(S) page; create two notes and check badge 2; edit/delete; switch pages; reopen a saved page from All notes; export; restart Chrome and confirm persistence. Browser-internal pages should still allow access to All notes. Do not use the development demo for this final check: it uses a separate adapter and third-party favicon requests absent from the extension.

## 4. Upload and fill the draft

1. Return to the Developer Dashboard under **patrick.qi@gmail.com**. Click **Add new item → Choose file**, select **dist/tabbynotey-0.2.0.zip**, then **Upload**.
2. In **Package**, confirm **TabbyNotey**, version **0.2.0**, Manifest V3, and only **tabs, storage, favicon** permissions. Resolve any validation errors before proceeding.
3. Open **Store listing**. The name and short description may be read from the manifest and be read-only. They already match listing.md. Paste the **Detailed description** from listing.md.
4. Choose **Productivity** (and **Tools** if available as a subcategory), and **English (United States)**. Use the closest available Productivity category if the dashboard's taxonomy differs.
5. Upload **store/icon-128.png** as the store icon, **store/screenshot-this-page.png** then **store/screenshot-all-notes.png** as screenshots, and **store/promo-small.png** as the small promo tile. Do not upload the *-popup.png source crops. Leave video and marquee blank unless you decide to add them.
6. Set the public contact email to **patrick.qi@gmail.com** wherever requested. Leave website/support-site fields blank unless you have actual URLs to supply. Do not invent URLs. Click **Save draft**.
7. Open **Privacy practices** (called Privacy in some documentation). Paste the single purpose and separate **tabs**, **storage**, and **favicon** justifications from listing.md. For remote code choose **No, I am not using remote code**.
8. In data usage, select **Web history** for URLs/titles and **Website content** for locally authored note text, following the mapping note in listing.md. Check all three certifications. Paste the publicly hosted **privacy.html** URL in the privacy policy field. Save.
9. Open **Distribution**. Set the item to **Free**, indicate no in-app purchases if asked, choose **Unlisted**, and choose your intended regions (All regions is a reasonable default). Save. Unlisted still permits anyone with its store URL to install and still requires review.
10. Open **Test instructions**. Paste the reviewer instructions from listing.md. No credentials are needed.
11. Review every tab, saved field, image, policy link, and any dashboard warnings. Confirm that the displayed publisher is Patrick Qi and the account/contact is patrick.qi@gmail.com.

[Upload/submission workflow](https://developer.chrome.com/docs/webstore/publish), [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [Unlisted visibility](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) are documented by Chrome. [Image specifications](https://developer.chrome.com/docs/webstore/images) confirm the required icon and screenshot, the permitted screenshot sizes, and optional promotional images. The general listing page's wording about video/promo requirements conflicts with the dedicated image page; follow the latter and any live form validation. Exact current authenticated dashboard labels and category options could not be checked without signing in.

## 5. Submit for review without automatically releasing

1. When you personally decide the draft is ready, click **Submit for Review**.
2. In the confirmation dialog, **uncheck Publish automatically** (the checkbox controlling immediate publication after review). Confirm that this is a deferred release before confirming submission.
3. Submit and wait for Google's review. Resolve any feedback in the dashboard. Do not click **Publish** while you intend to remain short of release.
4. After approval, a deferred submission is staged. Chrome documents a **30-day window** to publish before it reverts to draft and needs review again. When you later decide to release, verify Unlisted one more time and perform the final Publish action yourself.

Chrome documents [deferred publishing](https://developer.chrome.com/docs/webstore/publish#deferred_publishing_option). Nothing in this preparation task has been submitted; the steps above are for Patrick to perform later.

## 6. Ship an update

1. Edit **extension/manifest.json** and increase its version, for example from **0.2.0** to **0.2.1**. Keep package.json and README version references consistent for local maintenance.
2. Make the intended changes, run **node --test**, perform the relevant installed-extension smoke checks, then run **python3 scripts/package.py**. It writes a complete new archive, for example **dist/tabbynotey-0.2.1.zip**.
3. In the dashboard, open the **existing TabbyNotey item**; do not create another item. Open **Package → Upload new package**, choose the new ZIP, and wait for validation.
4. Update descriptions, screenshots, permission explanations, and the hosted privacy policy if behavior or data use changed. Keep **Unlisted** unless intentionally changing it.
5. Save, then **Submit for Review**. Uncheck automatic publishing again if you want to stage the update. After approval, publish yourself when ready. Keep the same item so installed copies receive the update.

See Chrome's [update instructions](https://developer.chrome.com/docs/webstore/update). The new manifest version must exceed the previously uploaded version.

## Remaining decisions and review considerations

- Choose the actual privacy hosting URL and distribution regions. The policy must be publicly accessible before submission.
- Account ownership, verification, payment, and the Non-trader declaration are yours to complete. Confirm that the declaration still fits your circumstances when submitting.
- Web history is clearly applicable. Website content is a conservative interpretation for note text; the official category illustration includes text but does not explicitly classify locally authored notes. Follow a more specific category if the live form supplies one.
- The tabs permission may receive scrutiny. Its justification explains why all-tab badge counts and finding an existing tab require tab URLs beyond the active tab. Removing it would change the requested behavior.
- The images show real installed popup pixels inside a full-bleed explanatory canvas at native width. Neutral example.org notes are synthetic. At the store's downscaled display, popup text is small; the image headings explain the views.
- No likely code/manifest review blocker was found. The only release asset fix was adding transparent padding to the 128px icon (and preserving it in scripts/icons.py); smaller toolbar icons and behavior are unchanged. Approval remains Google's decision.
- Local storage is not an encrypted vault. The policy explains this and the privacy implications of complete URLs and exports.
- Official documentation was checked on 2026-10-23. Some pages retain older update dates, and no authenticated dashboard was opened. Account-specific requirements, current category options, and live form labels remain unverified. No claim of review approval is made.
