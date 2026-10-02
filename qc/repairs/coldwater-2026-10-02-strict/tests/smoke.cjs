const t = require('./lib.cjs');
const { assert } = t;

(async () => {
  const browser = await t.launch();
  const page = await t.openPage(browser);
  const editor = t.editorOf(page);
  const out = {};

  // Real typing.
  await editor.click();
  await page.keyboard.type('let a = 1;');
  await page.keyboard.press('Enter');
  await page.keyboard.type('console.log(a);');
  out.typed = await t.source(page);

  // Real clipboard round trip without granted permissions.
  await page.keyboard.press('ControlOrMeta+A');
  out.copiedAll = await t.copied(page);
  const find = page.getByRole('textbox', { name: 'Find in code' });
  await find.fill('PASTED');
  await find.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+C');
  await find.fill('');
  await editor.click(); await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.press('ControlOrMeta+V');
  out.afterNativePaste = await t.source(page);
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+X');
  out.afterCut = await t.source(page);
  await page.keyboard.press('ControlOrMeta+V');
  out.afterCutPaste = await t.source(page);

  out.pageErrors = page.errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
