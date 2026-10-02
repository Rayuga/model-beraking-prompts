const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://172.17.0.8:3000'] });
  const origin = 'http://172.17.0.8:3000/';
  const contextA = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const contextB = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const a = await contextA.newPage(), b = await contextB.newPage();
  const errors = [];
  for (const page of [a,b]) page.on('pageerror', error => errors.push(error.message));
  await Promise.all([a.goto(origin, { waitUntil: 'networkidle' }), b.goto(origin, { waitUntil: 'networkidle' })]);
  const title = 'CW two-context ' + Date.now();
  const read = async page => (await page.getByRole('textbox', { name: 'Code editor' }).locator('.line .text').allTextContents()).join('\n');
  const write = async (page, text) => {
    await page.getByRole('textbox', { name: 'Code editor' }).click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.evaluate(value => navigator.clipboard.writeText(value), text);
    await page.keyboard.press('ControlOrMeta+V');
    await page.waitForFunction(value => [...document.querySelectorAll('#editor .line .text')].map(el => el.textContent).join('\n') === value, text);
  };
  const save = async page => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(180);
  };
  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title);
  await a.getByRole('textbox', { name: 'Filename' }).fill('first.js');
  await write(a, 'document.body.textContent="one";');
  await save(a);
  await b.reload({ waitUntil: 'networkidle' });
  await b.getByRole('button', { name: new RegExp(title) }).click();
  assert.equal(await read(b), 'document.body.textContent="one";');

  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' A');
  await a.getByRole('textbox', { name: 'Filename' }).fill('second.js');
  await write(a, 'document.body.textContent="two";');
  await save(a);
  await b.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' B');
  await b.getByRole('textbox', { name: 'Filename' }).fill('stale.js');
  await write(b, 'document.body.textContent="stale";');
  await save(b);
  assert.equal(await read(b), 'document.body.textContent="stale";');
  assert.match(await b.locator('.conflict-notice').innerText(), /changed in another editor/i);
  assert.equal(await b.getByRole('textbox', { name: 'Snippet title' }).inputValue(), title + ' B');
  assert.equal(await b.getByRole('textbox', { name: 'Filename' }).inputValue(), 'stale.js');

  await a.getByRole('textbox', { name: 'Snippet title' }).fill(title + ' A3');
  await write(a, 'document.body.textContent="three";');
  await save(a);
  await a.getByRole('button', { name: 'Revision 1' }).click();
  assert.equal(await a.getByLabel('Historical source').innerText(), 'document.body.textContent="one";');
  a.once('dialog', dialog => dialog.accept());
  await a.getByRole('button', { name: 'Restore selected revision' }).click();
  await a.waitForTimeout(250);
  assert.equal(await read(a), 'document.body.textContent="one";');
  assert.match(await a.locator('.paneheading').first().innerText(), /revision 4/i);
  assert.equal(await a.getByRole('button', { name: 'Revision 4' }).count(), 1);
  await a.getByRole('button', { name: 'Retry same restore' }).click();
  await a.waitForTimeout(250);
  assert.equal(await a.getByRole('button', { name: 'Revision 5' }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ separateContextRead: true, staleSavePreservesDraft: true, historyRestore: true, repeatedRestoreIdempotent: true, pageErrors: errors.length }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
