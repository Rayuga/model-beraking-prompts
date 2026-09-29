const http = require('node:http');
const path = require('node:path');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core'));
async function main() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/runner') res.end('<!doctype html><script>new Function("while(true){}")();</script>');
    else res.end('<!doctype html><button id="alive">Alive</button><p id="status">starting</p><script>window.ticks=0;setInterval(()=>ticks++,50);setTimeout(()=>{const f=document.createElement("iframe");f.sandbox="allow-scripts";f.src="http://localhost:3399/runner";document.body.append(f);setTimeout(()=>{f.remove();document.querySelector("#status").textContent="Stopped at "+ticks;window.done=true;},800);},100);</script>');
  });
  await new Promise(resolve => server.listen(3399, '0.0.0.0', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1208/chrome-win64/chrome.exe') });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3399', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.done, { timeout: 5000 });
    console.log(JSON.stringify({ status: await page.locator('#status').innerText(), ticks: await page.evaluate(() => ticks), chromium: browser.version(), defaultLaunchFlags: true }));
  } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
