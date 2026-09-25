const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const playwright = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright/package.json');
const mcp = require('/usr/local/lib/node_modules/@playwright/mcp/package.json');

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>Browser runtime check</title></head><body><button id="run" onclick="document.getElementById(\'result\').textContent=\'ready\'">Run check</button><p id="result">waiting</p></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), 'Browser runtime check');
    await page.getByRole('button', { name: 'Run check' }).click();
    assert.equal(await page.locator('#result').textContent(), 'ready');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, node: process.version, mcp: mcp.version, playwright: playwright.version, chromium: browser.version(), executable: fs.realpathSync('/usr/local/bin/chromium'), browser_path: process.env.PLAYWRIGHT_BROWSERS_PATH, page_title: await page.title(), click_result: await page.locator('#result').textContent(), page_errors: errors, network: 'Docker network disabled; loopback-only page' }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
