const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const origin = process.env.CW_URL || 'http://172.17.0.10:3000/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${origin.replace(/\/$/, '')}`] });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const source = async () => (await editor.locator('.line .text').allTextContents()).join('\n');
  const replace = async value => {
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.evaluate(text => navigator.clipboard.writeText(text), value);
    await page.keyboard.press('ControlOrMeta+V');
    await page.waitForFunction(expected => [...document.querySelectorAll('#editor .line .text')].map(el => el.textContent).join('\n') === expected, value);
  };
  const copy = async () => { await page.keyboard.press('ControlOrMeta+C'); return page.evaluate(() => navigator.clipboard.readText()); };
  const results = {};

  await replace('alpha\nbeta');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('End'); await page.keyboard.press('Delete');
  assert.equal(await source(), 'alphabeta');
  await page.keyboard.press('ControlOrMeta+Z');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  assert.equal(await source(), 'alphabeta');
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await source(), 'alpha\nbeta');
  results.cw_custom_typing_and_line_join = true;

  await replace('123456789\n12\nabcdefghi');
  await page.keyboard.press('ControlOrMeta+Home'); await page.keyboard.press('End');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 1, Col 10/);
  await page.keyboard.press('ArrowDown');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 2, Col 3/);
  await page.keyboard.press('ArrowDown');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 3, Col 10/);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 2, Col 3/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 3, Col 1/);
  assert.equal(await source(), '123456789\n12\nabcdefghi');
  results.cw_caret_navigation_and_line_numbers = true;

  await replace('needle\nX needle\nneedle\nNeedle');
  const find = page.getByRole('textbox', { name: 'Find in code' });
  await find.fill('needle');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const previous = page.getByRole('button', { name: 'Previous', exact: true });
  const seen = [];
  for (let i = 0; i < 4; i++) { await next.click(); seen.push(await copy()); }
  assert.deepEqual(seen, ['needle', 'needle', 'needle', 'needle']);
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 1/);
  await previous.click(); assert.equal(await copy(), 'needle');
  assert.match(await page.locator('#cursor-label').innerText(), /Ln 3/);
  results.cw_find_forward_backward_wrap = true;

  await page.getByRole('textbox', { name: 'Filename' }).fill('format.js');
  const compactJs = 'function total(n){let s="{;keep}";for(let i=0;i<n;i++){if(i%2===0){s+=i;}}return s;}document.body.textContent=total(5);// keep';
  await replace(compactJs);
  await page.getByRole('button', { name: /^Run/ }).click(); await page.waitForTimeout(500);
  const originalJsOutput = await page.frameLocator('iframe').locator('body').innerText();
  await page.getByRole('button', { name: 'Format document' }).click();
  const formattedJs = await source();
  assert.ok(formattedJs.split('\n').length > 5 && formattedJs.includes('"{;keep}"') && formattedJs.includes('// keep'));
  await page.getByRole('button', { name: /^Run/ }).click(); await page.waitForTimeout(500);
  assert.equal(await page.frameLocator('iframe').locator('body').innerText(), originalJsOutput);
  await page.getByRole('button', { name: 'Format document' }).click(); assert.equal(await source(), formattedJs);
  await page.getByRole('button', { name: 'Undo' }).click(); assert.equal(await source(), compactJs);
  await page.getByRole('button', { name: 'Redo' }).click(); assert.equal(await source(), formattedJs);
  await replace('const = 42;'); const invalidJs = await source();
  await page.getByRole('button', { name: 'Format document' }).click(); assert.equal(await source(), invalidJs);
  assert.match(await page.locator('#editor-message').innerText(), /Format failed/i);
  results.cw_js_format_semantics_and_undo = true;

  await page.getByRole('textbox', { name: 'Filename' }).fill('format.html');
  const compactHtml = '<!doctype html><html><body><!--keep--><main data-note="a > b"><section><p id="out">before</p></section></main><script>document.getElementById("out").textContent="after";</script></body></html>';
  await replace(compactHtml); await page.getByRole('button', { name: /^Run/ }).click(); await page.waitForTimeout(500);
  assert.equal(await page.frameLocator('iframe').locator('#out').innerText(), 'after');
  await page.getByRole('button', { name: 'Format document' }).click(); const formattedHtml = await source();
  assert.ok(formattedHtml.split('\n').length > 6 && formattedHtml.includes('a > b') && formattedHtml.includes('<!--keep-->'));
  await page.getByRole('button', { name: /^Run/ }).click(); await page.waitForTimeout(500);
  assert.equal(await page.frameLocator('iframe').locator('#out').innerText(), 'after');
  await page.getByRole('button', { name: 'Format document' }).click(); assert.equal(await source(), formattedHtml);
  await page.getByRole('button', { name: 'Undo' }).click(); assert.equal(await source(), compactHtml);
  await page.getByRole('button', { name: 'Redo' }).click(); assert.equal(await source(), formattedHtml);
  await replace('<div title="unterminated></div>'); const invalidHtml = await source();
  await page.getByRole('button', { name: 'Format document' }).click(); assert.equal(await source(), invalidHtml);
  assert.match(await page.locator('#editor-message').innerText(), /Format failed/i);
  results.cw_html_format_semantics_and_undo = true;

  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ results, pageErrors }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
