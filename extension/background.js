import { PREFIX, badgeText, notesForUrl } from './notes.js';

const storage = chrome.storage.local;

function setBadge(tab, items) {
  // The tab may close between query and update; a stale badge is harmless.
  return chrome.action.setBadgeText({ tabId: tab.id, text: badgeText(notesForUrl(items, tab.url).length) }).catch(() => {});
}

async function updateAll() {
  const [items, tabs] = await Promise.all([storage.get(null), chrome.tabs.query({})]);
  await Promise.all(tabs.map(tab => setBadge(tab, items)));
}

async function init() {
  await chrome.action.setBadgeBackgroundColor({ color: '#2f6b57' });
  await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await updateAll();
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// Chrome clears per-tab badges on navigation, so recount once the page settles.
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.url || change.status === 'complete') setBadge(tab, await storage.get(null));
});

// Counts only change when a note is created or deleted, not on every keystroke.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && Object.entries(changes).some(([key, { oldValue, newValue }]) =>
    key.startsWith(PREFIX) && (!oldValue || !newValue || oldValue.url !== newValue.url))) updateAll();
});
