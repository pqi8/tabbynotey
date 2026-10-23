// Local-only asset generator. Requires puppeteer-core 25 and installed Chrome.
// Run: node store/capture.mjs (uses /tmp/tabby-shot/node_modules by default).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || '/tmp/tabby-shot/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(out);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, pipe: true, enableExtensions: true,
});
try {
  const id = await browser.installExtension(path.join(root, 'extension'));
  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const sw = await swTarget.worker();
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', r => r.respond({status: 200, contentType: 'text/html', body: '<!doctype html><title>Weekend walking routes</title><h1>Weekend walking routes</h1>'}));
  const url = 'https://example.org/walking-routes';
  await page.goto(url);
  await page.bringToFront();
  await sw.evaluate(async ({url}) => {
    const now = Date.now(), hour = 3600000;
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      'note:walk-1': { id: 'walk-1', url, title: 'Weekend walking routes', text: 'Try the riverside loop on Saturday. Check the weather before leaving.', createdAt: now - 3 * hour, updatedAt: now - 3 * hour },
      'note:walk-2': { id: 'walk-2', url, title: 'Weekend walking routes', text: 'The shorter route has a picnic spot near the footbridge.', createdAt: now - hour, updatedAt: now - hour },
      'note:recipe-1': { id: 'recipe-1', url: 'https://example.org/lentil-soup', title: 'Lentil soup recipe', text: 'Make a double batch and freeze half for next week.', createdAt: now - 24 * hour, updatedAt: now - 24 * hour },
    });
  }, {url});
  const pageErrors = [];
  const targetPromise = browser.waitForTarget(t => t.url().endsWith('/popup.html'));
  await sw.evaluate(() => chrome.action.openPopup());
  const popup = await (await targetPromise).asPage();
  popup.on('pageerror', e => pageErrors.push(e.message));
  await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await popup.waitForSelector('#page-notes .note');
  await popup.evaluate(() => document.activeElement?.blur());
  async function capture(name) {
    await popup.mouse.move(0, 0);
    await popup.evaluate(() => document.fonts.ready);
    const rect = await popup.evaluate(() => ({x: 0, y: 0, width: 380, height: document.body.getBoundingClientRect().height}));
    await popup.screenshot({path: path.join(out, name + '-popup.png'), clip: rect});
    return rect;
  }
  const pageRect = await capture('this-page');
  await popup.click('#all-tab');
  await popup.evaluate(() => document.activeElement?.blur());
  const allRect = await capture('all-notes');
  const badge = await sw.evaluate(async url => { const [t] = await chrome.tabs.query({url}); return chrome.action.getBadgeText({tabId: t.id}); }, url);
  const info = await popup.evaluate(() => ({count: document.querySelector('#count').textContent, groups: [...document.querySelectorAll('.group-title')].map(x => x.textContent), favicons: [...document.images].map(x => ({loaded: x.complete && x.naturalWidth > 0, src: x.src}))}));
  const compose = await browser.newPage();
  await compose.setViewport({width: 1280, height: 800, deviceScaleFactor: 1});
  for (const [name, heading, subheading, rect] of [
    ['this-page', 'Remember why<br>you kept it open.', 'Leave notes on the page you’re viewing.<br>They save as you type.', pageRect],
    ['all-notes', 'Find your notes.<br>Return to the page.', 'Search saved notes by text, title, or URL.<br>Keep a local backup with Export.', allRect],
  ]) {
    const png = (await readFile(path.join(out, name + '-popup.png'))).toString('base64');
    await compose.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;background:#f0f3ef;color:#193c30;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;gap:100px;padding:80px 110px}.copy{width:470px}.brand{font-size:22px;font-weight:650;margin:0 0 40px}h1{font-size:40px;line-height:1.2;letter-spacing:-1.2px;margin:0 0 24px;font-weight:650}p{font-size:18px;line-height:1.6;color:#466052;margin:0}.popup{width:380px;flex:none;box-shadow:0 16px 52px #193c3024;border-radius:8px;overflow:hidden;background:#fafaf9}img{display:block;width:380px;height:${rect.height}px}</style></head><body><div class="copy"><div class="brand">TabbyNotey</div><h1>${heading}</h1><p>${subheading}</p></div><div class="popup"><img src="data:image/png;base64,${png}" alt="TabbyNotey popup"></div></body></html>`);
    await compose.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await compose.screenshot({path: path.join(out, `screenshot-${name}.png`)});
  }
  await compose.setViewport({width:440,height:280,deviceScaleFactor:1});
  const icon = (await readFile(path.join(root,'extension/icons/128.png'))).toString('base64');
  await compose.setContent(`<!doctype html><style>body{margin:0;width:440px;height:280px;background:#2f6b57;color:white;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}img{width:104px;height:104px}strong{font-size:30px;font-weight:600;letter-spacing:-.6px}</style><img src="data:image/png;base64,${icon}" alt=""><strong>TabbyNotey</strong>`);
  await compose.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await compose.screenshot({path:path.join(out,'promo-small.png')});
  await writeFile(path.join(out,'capture-results.json'), JSON.stringify({chrome:await browser.version(), extensionId:id, pageRect, allRect, badge, ...info, pageErrors, source:'Installed extension; chrome.action.openPopup(); neutral synthetic notes; isolated temporary Chrome profile; no demo adapter. Popup pixels composed at original 380px width.'},null,2)+'\n');
  console.log(JSON.stringify({pageRect,allRect,badge,...info,pageErrors}));
} finally { await browser.close(); }
