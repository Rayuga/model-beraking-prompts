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
  await replace('document.body.textContent = "SAFE";');
  await page.getByRole('button', { name: 'Run' }).first().click();
  await page.waitForTimeout(500);
  const cases = [
    ['eval', 'eval("document.body.textContent=1")'],
    ['Function', 'Function("return 2")()'],
    ['WebAssembly', 'WebAssembly.compile(new Uint8Array())'],
    ['Worker', 'new Worker("x.js")'],
    ['import', 'import("x.js")']
  ];
  const results = [];
  for (const [name, code] of cases) {
    await replace(code);
    await page.getByRole('button', { name: 'Run' }).first().click();
    await page.waitForTimeout(550);
    const preview = await page.frameLocator('iframe').locator('body').innerText();
    const status = await page.locator('.status').allInnerTexts().catch(() => []);
    const consoleText = await page.locator('[class*=console]').allInnerTexts().catch(() => []);
    results.push({ name, preview, status, consoleText: consoleText.join(' ').slice(-300) });
  }
  await page.getByRole('textbox', { name: 'Filename' }).fill('broken.js');
  await replace('const = 42;');
  const before = await source();
  await page.getByRole('button', { name: 'Format document' }).click();
  const after = await source();
  const formatMessage = await page.locator('#editor-message').innerText();
  console.log(JSON.stringify({ results, invalidHtmlPreserved: before === after, formatMessage, errors }));
  if (results.some(row => !row.preview.includes('SAFE')) || before !== after || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
