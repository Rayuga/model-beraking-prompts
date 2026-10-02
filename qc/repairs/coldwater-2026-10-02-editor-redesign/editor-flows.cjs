const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=http://172.17.0.8:3000'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://172.17.0.8:3000/', { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const source = async () => (await editor.locator('.line .text').allTextContents()).join('\n');
  const replace = async value => {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(value);
  };
  await page.getByRole('textbox', { name: 'Filename' }).fill('sample.html');
  const compactHtml = '<!doctype html><html><body><h1 id="result">before</h1><script>document.getElementById("result").textContent="after";</script></body></html>';
  await replace(compactHtml);
  await page.getByRole('button', { name: 'Run' }).first().click();
  await page.waitForTimeout(800);
  const htmlPreview = await page.frameLocator('iframe').locator('body').innerText();
  const tagTokens = await editor.locator('.tok-tag').allTextContents();
  const attributeTokens = await editor.locator('.tok-attribute').allTextContents();
  await page.getByRole('button', { name: 'Format document' }).click();
  await page.waitForTimeout(500);
  const formattedHtml = await source();
  const formatMessage = await page.locator('#editor-message').innerText();
  await page.getByRole('button', { name: 'Undo' }).click();
  const htmlUndo = await source();
  await page.getByRole('textbox', { name: 'Filename' }).fill('multi.js');
  await replace('alpha\nbeta\ngamma');
  for (let index = 0; index < 3; index++) {
    const text = editor.locator('.line .text').nth(index);
    const box = await text.boundingBox();
    if (index) await page.keyboard.down('Alt');
    await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
    if (index) await page.keyboard.up('Alt');
  }
  const caretCount = await editor.locator('.caret').count();
  await page.keyboard.type('MULTI');
  const multiTyped = await source();
  await page.getByRole('button', { name: 'Undo' }).click();
  const multiUndo = await source();
  await page.getByRole('button', { name: 'Redo' }).click();
  const multiRedo = await source();
  const result = {htmlPreview, tagTokens, attributeTokens, formattedHtmlLines: formattedHtml.split('\n').length, formatMessage, htmlUndo: htmlUndo === compactHtml, caretCount, multiTyped, multiUndo, multiRedo, errors};
  console.log(JSON.stringify(result, null, 2));
  if (!htmlPreview.includes('after') || formattedHtml.split('\n').length < 3 || !result.htmlUndo || caretCount !== 3 || multiTyped !== 'alphaMULTI\nbetaMULTI\ngammaMULTI' || multiUndo !== 'alpha\nbeta\ngamma' || multiRedo !== multiTyped || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
