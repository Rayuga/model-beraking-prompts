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
  await replace('needle\nX needle\nneedle');
  const find = page.getByRole('textbox', { name: 'Find in code' });
  await find.fill('needle');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const afterFind = await page.locator('#cursor-label').innerText();
  await page.getByRole('textbox', { name: 'Replacement text' }).fill('found');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  const replacedOne = await source();
  await page.getByRole('button', { name: 'Replace all' }).click();
  const replacedAll = await source();
  await page.getByRole('button', { name: 'Undo' }).click();
  const undoAll = await source();
  await page.getByRole('button', { name: 'Redo' }).click();
  const redoAll = await source();
  await replace('const item="ok";\nfunction double(x){return x*2;}\n// note\ndocument.body.textContent=double(6);');
  const kinds = {};
  for (const kind of ['keyword', 'function', 'string', 'number', 'comment']) {
    const token = editor.locator('.tok-' + kind).first();
    kinds[kind] = await token.count() ? {text: await token.innerText(), color: await token.evaluate(el => getComputedStyle(el).color)} : null;
  }
  const title = 'CW editor smoke ' + Date.now();
  await page.getByRole('textbox', { name: 'Snippet title' }).fill(title);
  await page.getByRole('textbox', { name: 'Filename' }).fill('smoke.js');
  const savedSource = await source();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: new RegExp(title) }).click();
  const readback = (await page.getByRole('textbox', { name: 'Code editor' }).locator('.line .text').allTextContents()).join('\n');
  const result = {afterFind, replacedOne, replacedAll, undoAll, redoAll, kinds, saveReadback: readback === savedSource, errors};
  console.log(JSON.stringify(result, null, 2));
  if (replacedOne !== 'found\nX needle\nneedle' || replacedAll !== 'found\nX found\nfound' || undoAll !== replacedOne || redoAll !== replacedAll || Object.values(kinds).some(value => !value) || !result.saveReadback || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
