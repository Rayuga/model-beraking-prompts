const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://172.17.0.10:3000'] });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://172.17.0.10:3000/', { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const source = async () => (await editor.locator('.line .text').allTextContents()).join('\n');
  const replace = async value => {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.evaluate(text => navigator.clipboard.writeText(text), value);
    await page.keyboard.press('ControlOrMeta+V');
    await page.waitForFunction(expected => [...document.querySelectorAll('#editor .line .text')].map(el => el.textContent).join('\n') === expected, value);
    assert.equal(await source(), value);
  };

  await replace('A😀e\u0301Z');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  assert.equal(await source(), 'Ae\u0301Z');
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await source(), 'A😀e\u0301Z');
  await page.keyboard.press('Delete');
  assert.equal(await source(), 'A😀Z');
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await source(), 'A😀e\u0301Z');

  await replace('one\ntwo\nthree');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Tab');
  assert.equal(await source(), '  one\n  two\n  three');
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await source(), 'one\ntwo\nthree');
  await page.keyboard.press('ControlOrMeta+Y');
  assert.equal(await source(), '  one\n  two\n  three');

  await replace('const s="function phantom(){}"; function real() { return 2; }');
  assert.deepEqual(await editor.locator('.tok-function').allTextContents(), ['real']);

  const long = 'document.body.textContent="START-' + 'x'.repeat(510) + '-END";';
  await replace(long);
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('!');
  assert.equal(await source(), long.replace('-END";', '-END!";'));
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.waitForTimeout(350);
  const frame = page.frameLocator('.preview-host iframe');
  assert.equal(await frame.locator('body').innerText(), 'START-' + 'x'.repeat(510) + '-END!');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ grapheme: true, blockIndent: true, functionNameLexing: true, longLineAndPreview: true, pageErrors: errors.length }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
