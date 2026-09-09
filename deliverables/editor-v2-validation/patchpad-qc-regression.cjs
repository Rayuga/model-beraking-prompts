// Local browser regression evidence; not a full Oracle score.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const options = {viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']};
  let context = await browser.newContext(options), page = await context.newPage();
  const results = [], errors = [];
  const attach = () => { page.on('pageerror', e=>errors.push(e.message)); page.on('dialog',d=>d.accept()); };
  attach();
  const load = async () => {
    await page.goto('http://localhost:3000/');
    await page.waitForFunction(()=>document.querySelector('.line[data-line="0"] .text')?.dataset.lineText.startsWith('Incident:'));
  };
  const get = route=>page.evaluate(async route=>(await fetch(route)).json(),route);
  const current = async ()=>(await get('/api/documents/incident-alpha')).document;
  const check = async (name, fn) => {
    try { await fn(); results.push({name,passed:true}); }
    catch (e) { results.push({name,passed:false,error:e.message}); }
    console.log(JSON.stringify(results.at(-1)));
  };
  const find = async text => {
    await page.locator('#find-box').fill(text);
    await page.locator('#find-box').press('Enter');
    await page.locator('#find-box').press('Escape');
  };
  const line = row=>page.locator(`.line[data-line="${row}"] .text`).getAttribute('data-line-text');
  await load();
  await check('seed revision and visible Find counts', async () => {
    const doc = await current();
    assert.equal(doc.current_revision,1);
    assert.equal(doc.content.split('\n').length,1226);
    assert.deepEqual((await get('/api/documents/incident-alpha/revisions')).revisions.map(r=>r.revision),[1]);
    for (const [query,count] of [['NEXT',3],['ALPHA-00',99]]) {
      await page.locator('#find-box').fill(query);
      assert.ok((await page.locator('#save-state').textContent()).includes(`${count} matches`));
    }
  });
  await load();
  await check('word-start navigation and whitespace selection', async () => {
    await page.locator('.line[data-line="0"] .text').click({position:{x:15,y:10}});
    await page.keyboard.press('Home');
    for(const [key,coord] of [['Control+ArrowRight','Ln 1, Col 11'],['Control+Shift+ArrowRight','Ln 1, Col 21']]) {
      await page.keyboard.press(key);
      assert.equal(await page.locator('#cursor-label').textContent(),coord);
    }
    await page.keyboard.press('Control+C');
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Northwind ');
    await page.keyboard.press('Control+Shift+ArrowLeft');
    assert.equal(await page.locator('#cursor-label').textContent(),'Ln 1, Col 11');
    await page.keyboard.press('Control+ArrowLeft');
    assert.equal(await page.locator('#cursor-label').textContent(),'Ln 1, Col 1');
  });
  await load();
  await check('keyboard traverses editor and history without trapping focus', async () => {
    const expected=['undo-btn','redo-btn','find-box','replace-box','find-next-btn','replace-current-btn','replace-all-btn','editor'];
    for(const id of expected){
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),id);
      assert.notEqual(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    }
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replace-all-btn');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('#document-list')!==null),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('#revision-list')!==null),true);
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'editor');
  });
  await load();
  await check('Tab indentation and undo remain correct; Escape releases focus', async () => {
    await find('Timeline'); await page.keyboard.press('Home');
    await page.keyboard.press('Tab'); assert.equal(await line(4),'  Timeline');
    await page.keyboard.press('Shift+Tab'); assert.equal(await line(4),'Timeline');
    await page.keyboard.press('Control+Z'); assert.equal(await line(4),'  Timeline');
    await page.keyboard.press('Control+Y'); assert.equal(await line(4),'Timeline');
    await page.keyboard.press('Escape'); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replace-all-btn');
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await page.keyboard.press('Tab'); assert.equal(await line(4),'  Timeline');
    await page.keyboard.press('Escape'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('#document-list')!==null),true);
  });
  await load();
  await check('full saved document and history survive two server restarts', async () => {
    await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End');
    await page.keyboard.type(' RESTART-PATCHPAD-CHECK');
    await page.locator('#save-btn').click();
    await page.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Saved'));
    const document = await current();
    const revisions = await get('/api/documents/incident-alpha/revisions');
    const list = await get('/api/documents');
    const historical = await get('/api/documents/incident-alpha/revisions/1');
    for(let i=0;i<2;i++) {
      await context.close();
      execFileSync('bash',['/tests/restart-app.sh'],{timeout:180000,stdio:'pipe'});
      context=await browser.newContext(options); page=await context.newPage(); attach();
      await load();
      assert.deepEqual(await current(),document);
      assert.deepEqual(await get('/api/documents/incident-alpha/revisions'),revisions);
      assert.deepEqual(await get('/api/documents'),list);
      assert.deepEqual(await get('/api/documents/incident-alpha/revisions/1'),historical);
      await find('RESTART-PATCHPAD-CHECK');
      assert.ok((await line(1225)).endsWith(' RESTART-PATCHPAD-CHECK'));
    }
  });
  await browser.close();
  fs.writeFileSync(process.env.REGRESSION_OUTPUT||'/results/patchpad-qc-regression.json',JSON.stringify({results,errors},null,2));
  if(errors.length||results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
