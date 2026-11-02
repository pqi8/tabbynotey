// Focus the tab already showing `url`, or open a new one.
export async function focusOrOpen(url) {
  const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
