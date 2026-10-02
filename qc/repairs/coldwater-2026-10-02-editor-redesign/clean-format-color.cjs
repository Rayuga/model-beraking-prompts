const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://172.17.0.10:3000'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://172.17.0.10:3000/', { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const source = async () => (await editor.locator('.line .text').allTextContents()).join('\n');
  const replace = async value => {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(value);
  };
  const original = 'function paint(x){const color="blue";return x+1;}paint(2);';
  await replace(original);
  const functionNames = await editor.locator('.tok-function').allTextContents();
  await page.getByRole('button', { name: 'Format document' }).click();
  const first = await source();
  await page.getByRole('button', { name: 'Format document' }).click();
  const second = await source();
  await page.getByRole('button', { name: 'Undo' }).click();
  const undone = await source();
  await page.getByRole('button', { name: 'Redo' }).click();
  const redone = await source();
  console.log(JSON.stringify({ functionNames, idempotent: first === second, oneUndo: undone === original, oneRedo: redone === first, errors }));
  if (functionNames.filter(value => value === 'paint').length !== 2 || first === original || first !== second || undone !== original || redone !== first || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
