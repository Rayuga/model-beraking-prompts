const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const origin = process.env.CW_URL || 'http://172.17.0.10:3002/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${origin.replace(/\/$/, '')}`] });
  const aContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const bContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await aContext.newPage(), b = await bContext.newPage();
  await Promise.all([a.goto(origin, { waitUntil: 'networkidle' }), b.goto(origin, { waitUntil: 'networkidle' })]);
  const editor = page => page.getByRole('textbox', { name: 'Code editor' });
  const read = async page => (await editor(page).locator('.line .text').allTextContents()).join('\n');
  const write = async (page, text) => {
    await editor(page).click(); await page.keyboard.press('ControlOrMeta+A');
    await page.evaluate(value => navigator.clipboard.writeText(value), text); await page.keyboard.press('ControlOrMeta+V');
    await page.waitForFunction(value => [...document.querySelectorAll('#editor .line .text')].map(el => el.textContent).join('\n') === value, text);
  };
  const save = async page => { await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(220); };
  const title = 'Restart Matrix 20261002';
  await a.getByRole('button', { name: 'New', exact: true }).click();
  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title);
  await a.getByRole('textbox', { name: 'Filename' }).fill('restart-matrix.js');
  await write(a, 'document.body.textContent="restart-survives";'); await save(a);
  await b.reload({ waitUntil: 'networkidle' }); await b.getByRole('button', { name: new RegExp(title) }).click();
  assert.equal(await b.getByRole('textbox', { name: 'Filename' }).inputValue(), 'restart-matrix.js');
  assert.equal(await read(b), 'document.body.textContent="restart-survives";');

  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' A2');
  await a.getByRole('textbox', { name: 'Filename' }).fill('accepted-a.js'); await write(a, 'document.body.textContent="accepted-a";'); await save(a);
  await b.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' stale-b');
  await b.getByRole('textbox', { name: 'Filename' }).fill('stale-b.js'); await write(b, 'document.body.textContent="stale-b";'); await save(b);
  assert.match(await b.locator('.conflict-notice').innerText(), /changed in another editor/i);
  assert.equal(await read(b), 'document.body.textContent="stale-b";');
  await b.getByRole('button', { name: 'Reload latest' }).click();
  await b.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' B3');
  await b.getByRole('textbox', { name: 'Filename' }).fill('accepted-b.js'); await write(b, 'document.body.textContent="accepted-b";'); await save(b);
  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' stale-a');
  await a.getByRole('textbox', { name: 'Filename' }).fill('stale-a.js'); await write(a, 'document.body.textContent="stale-a";'); await save(a);
  assert.match(await a.locator('.conflict-notice').innerText(), /changed in another editor/i);
  assert.equal(await read(a), 'document.body.textContent="stale-a";');

  await a.getByRole('button', { name: 'Reload latest' }).click();
  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title);
  await a.getByRole('textbox', { name: 'Filename' }).fill('restart-matrix.js'); await write(a, 'document.body.textContent="restart-survives";'); await save(a);
  await a.getByRole('button', { name: 'Revision 1' }).click();
  assert.match(await a.getByLabel('Historical source').innerText(), /restart-survives/);
  a.once('dialog', dialog => dialog.accept()); await a.getByRole('button', { name: 'Restore selected revision' }).click(); await a.waitForTimeout(250);
  const revisionAfterRestore = await a.locator('.paneheading').first().innerText();
  assert.match(revisionAfterRestore, /revision 5/i);
  await a.getByRole('button', { name: 'Retry same restore' }).click(); await a.waitForTimeout(200);
  assert.equal(await a.getByRole('button', { name: 'Revision 6' }).count(), 0);

  await b.reload({ waitUntil: 'networkidle' }); await b.getByRole('button', { name: new RegExp(title) }).click();
  await b.getByRole('button', { name: 'Revision 2' }).click();
  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' final');
  await a.getByRole('textbox', { name: 'Filename' }).fill('restart-final.js'); await write(a, 'document.body.textContent="restart-final";'); await save(a);
  b.once('dialog', dialog => dialog.accept()); await b.getByRole('button', { name: 'Restore selected revision' }).click(); await b.waitForTimeout(250);
  assert.match(await b.locator('.conflict-notice').innerText(), /changed in another editor/i);
  await a.reload({ waitUntil: 'networkidle' }); await a.getByRole('button', { name: new RegExp(title + ' final') }).click();
  assert.equal(await read(a), 'document.body.textContent="restart-final";');
  console.log(JSON.stringify({ gateReadback: true, staleSaveBothRoles: true, historyRestoreRetry: true, staleRestoreRefused: true, restartTitle: title + ' final' }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
