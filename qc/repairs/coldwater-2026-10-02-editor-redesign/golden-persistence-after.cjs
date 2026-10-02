const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const origin = process.env.CW_URL || 'http://172.17.0.10:3002/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${origin.replace(/\/$/, '')}`] });
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Restart Matrix 20261002 final/ }).click();
  const source = (await page.getByRole('textbox', { name: 'Code editor' }).locator('.line .text').allTextContents()).join('\n');
  assert.equal(await page.getByRole('textbox', { name: 'Filename' }).inputValue(), 'restart-final.js');
  assert.equal(source, 'document.body.textContent="restart-final";');
  assert.ok(await page.getByRole('button', { name: 'Revision 1' }).count());
  assert.ok(await page.getByRole('button', { name: 'Revision 6' }).count());
  console.log(JSON.stringify({ cw_save_reload_restart: true, historySurvived: true }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
