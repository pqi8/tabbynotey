// Development preview only. Not included in the extension package.
const markup = await (await fetch('./extension/popup.html')).text();
const page = new DOMParser().parseFromString(markup, 'text/html');
document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: './extension/popup.css' }));
document.body.replaceChildren(...page.body.childNodes);
const docs = { url: 'https://example.org/walking-routes', title: 'Weekend walking routes' };
const day = 86400000;
const seed = {
  'note:demo-1': { id: 'demo-1', ...docs, text: 'Try the riverside loop on Saturday. Check the weather before leaving.', createdAt: Date.now() - 7 * day, updatedAt: Date.now() - 7 * day },
  'note:demo-2': { id: 'demo-2', ...docs, text: 'The shorter route has a picnic spot near the footbridge.', createdAt: Date.now() - 2 * day, updatedAt: Date.now() - 2 * day },
  'note:https://example.org/lentil-soup': { url: 'https://example.org/lentil-soup', title: 'Lentil soup recipe', text: 'Make a double batch and freeze half for next week.', updatedAt: Date.now() - 3 * day },
};
let items = JSON.parse(localStorage.getItem('tabbynotey-demo-v2') || 'null') || seed;
const persist = () => localStorage.setItem('tabbynotey-demo-v2', JSON.stringify(items));
window.chrome = {
  storage: { local: {
    async get() { return structuredClone(items); },
    async set(value) { Object.assign(items, value); persist(); },
    async remove(key) { delete items[key]; persist(); },
  } },
  tabs: {
    async query() { return [{ id: 1, windowId: 1, ...docs }]; },
    async update() {},
    async create({ url }) { window.open(url, '_blank', 'noopener'); },
  },
  windows: { async update() {} },
  // Dev only: the real extension uses Chrome's local favicon cache.
  runtime: { getURL: path => 'https://www.google.com/s2/favicons?sz=32&domain=' + new URL(new URLSearchParams(path.split('?')[1]).get('pageUrl')).hostname },
};
await import('./extension/popup.js');
