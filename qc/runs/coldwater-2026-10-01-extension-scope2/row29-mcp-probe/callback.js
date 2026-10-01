async (page) => {
  page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('textbox', {name:'Code editor', exact:true}).waitFor();
  const auto = page.getByRole('checkbox', {name:'Auto-run', exact:true});
  if (await auto.count()) await auto.uncheck();
  await page.getByRole('button', {name:'New', exact:true}).click();
  const marker = 'row29-mcp-' + Date.now();
  const title = 'CW gate ' + marker;
  const source = 'document.body.textContent=' + JSON.stringify(marker) + ';console.log(' + JSON.stringify(marker) + ');';
  await page.getByRole('textbox', {name:'Filename', exact:true}).fill('gate.js');
  const editor = page.getByRole('textbox', {name:'Code editor', exact:true});
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(source);
  const entered = (await editor.locator('.cm-line').allTextContents()).join('\n');
  if (entered !== source) throw Error('Editor source mismatch');
  await page.getByRole('button', {name:/^Run(?:\s|$)/}).click();
  await page.getByRole('status').filter({hasText:/Complete/}).waitFor();
  const preview = await page.frameLocator('iframe[title="Live preview"]').locator('body').innerText();
  const consoleText = await page.getByRole('log').innerText();
  if (preview !== marker || !consoleText.includes(marker)) throw Error('Authored execution missing');
  await page.getByRole('textbox', {name:'Snippet title', exact:true}).fill(title);
  const pending = page.waitForResponse(r => ['POST','PUT'].includes(r.request().method()));
  await page.getByRole('button', {name:'Save', exact:true}).click();
  const write = await pending;
  const saved = await write.json();
  if (!write.ok()) throw Error('Save failed');
  await page.evaluate(() => localStorage.setItem('row29-isolation-control', 'original-only'));
  const clean = await page.context().browser().newContext();
  const fresh = await clean.newPage();
  const exchanges = [];
  fresh.on('response', async r => {
    if (r.headers()['content-type']?.includes('application/json')) {
      try { exchanges.push({url:r.url(), status:r.status(), data:await r.json()}); } catch {}
    }
  });
  try {
    await fresh.goto('http://localhost:3000');
    const isolatedStorage = await fresh.evaluate(() => localStorage.getItem('row29-isolation-control'));
    if (isolatedStorage !== null) throw Error('Client storage was copied');
    const read = async () => {
      await fresh.getByRole('button').filter({hasText:title}).click();
      return {title:await fresh.getByRole('textbox', {name:'Snippet title', exact:true}).inputValue(),
        filename:await fresh.getByRole('textbox', {name:'Filename', exact:true}).inputValue(),
        source:(await fresh.getByRole('textbox', {name:'Code editor', exact:true}).locator('.cm-line').allTextContents()).join('\n')};
    };
    const first = await read();
    await fresh.reload();
    const reloaded = await read();
    if (first.title !== title || first.source !== source || first.filename !== 'gate.js' || JSON.stringify(first) !== JSON.stringify(reloaded)) throw Error('Clean-context record mismatch');
    return {marker, entered, preview, consoleText, write:{url:write.url(), status:write.status(), saved},
      isolatedStorage, first, reloaded, exchanges};
  } finally {
    await clean.close();
    await page.bringToFront();
  }
}
