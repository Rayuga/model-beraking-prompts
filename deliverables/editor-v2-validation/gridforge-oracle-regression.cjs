// Golden regression for the two failures in run-44b1f2a8; not an Oracle score.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  const results = [];
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = async (name, fn) => {
    try { await fn(); results.push({name,passed:true}); }
    catch(e) { results.push({name,passed:false,error:e.message}); }
    console.log(JSON.stringify(results.at(-1)));
  };
  const load = async () => {
    await page.goto('http://localhost:3000/');
    await page.waitForFunction(() => document.querySelector('#workbook-title')?.textContent === 'Northwind Operations Plan');
  };
  const read = route => page.evaluate(async route => (await fetch(route)).json(),route);
  const edit = async (address,value) => {
    await page.locator('#name-box').fill(address); await page.locator('#name-box').press('Enter');
    await page.locator('#formula-bar').fill(value); await page.locator('#apply-formula').click();
  };
  const save = async () => {
    if (await page.locator('#save-btn').isEnabled()) await page.locator('#save-btn').click();
    await page.waitForFunction(() => document.querySelector('#save-state').textContent==='Saved');
  };
  await load();
  await check('complete older preview includes F32 and preserves live/server state', async () => {
    // Earlier functional edits grow real Oracle snapshots beyond the old cap.
    const rows = Array.from({length:26},(_,i)=>['PREVIEW-LONG-CELL-'+i+'-abcdefghijklmnopqrstuvwxyz','PREVIEW-OTHER-'+i].join('\t')).join('\n');
    await page.locator('#name-box').fill('C40'); await page.locator('#name-box').press('Enter');
    await page.evaluate(text=>navigator.clipboard.writeText(text),rows);
    await page.keyboard.press('Control+V'); await save();
    await edit('F32','PREVIEW-BASE'); await save();
    const base = await read('/api/workbooks/ops-plan');
    await edit('F32','PREVIEW-CURRENT'); await save();
    const current = await read('/api/workbooks/ops-plan');
    const history = await read('/api/workbooks/ops-plan/revisions');
    const card = page.locator('.rev').filter({has:page.locator('strong',{hasText:new RegExp('^Revision '+base.revision+'$')})});
    await card.getByRole('button',{name:'Preview',exact:true}).click();
    const preview = card.locator('pre');
    await preview.waitFor({state:'visible'});
    const contents = await preview.textContent();
    assert.ok(contents.includes('"F32": "PREVIEW-BASE"'),'F32 missing from visible preview');
    assert.deepEqual(JSON.parse(contents),base.workbook.sheets[0].cells);
    await preview.hover(); await page.mouse.wheel(0,9000);
    await page.waitForFunction(()=>document.querySelector('.preview:not([hidden])')?.scrollTop>0);
    assert.equal(await page.locator('[data-addr="F32"]').textContent(),'PREVIEW-CURRENT');
    assert.deepEqual(await read('/api/workbooks/ops-plan'),current);
    assert.deepEqual(await read('/api/workbooks/ops-plan/revisions'),history);
  });
  await load();
  await check('Redo releases Tab to toolbar controls in both directions', async () => {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'user-select');
    await edit('S75','KEYBOARD-CONTROL');
    await page.locator('#undo-btn').click();
    assert.equal(await page.locator('#redo-btn').isEnabled(),true);
    await page.locator('#redo-btn').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'name-box');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'redo-btn');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'formula-bar');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'apply-formula');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'formula-bar');
    assert.notEqual(await page.locator('#formula-bar').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  });
  await load();
  await check('Tab enters and leaves grid; cell navigation retains exact key behavior', async () => {
    await page.locator('#replace-all-btn').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'grid');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replace-all-btn');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(()=>document.activeElement.id),'grid');
    await page.locator('[data-addr="B10"]').click();
    const expected=[['ArrowRight','C10'],['ArrowDown','C11'],['ArrowLeft','B11'],['ArrowUp','B10'],
      ['Enter','B11'],['Shift+Enter','B10'],['Tab','C10'],['Shift+Tab','B10']];
    for(const [key,address] of expected) {
      await page.keyboard.press(key);
      assert.equal(await page.locator('#selection-label').textContent(),address,key);
    }
    await page.keyboard.press('Escape'); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'replace-all-btn');
  });
  await load();
  await check('edits made during an in-flight save survive its response', async () => {
    await save();
    let release, arrived;
    const held = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { arrived = resolve; });
    const routePattern = '**/api/workbooks/ops-plan/save';
    const handler = async route => {
      const response = await route.fetch();
      arrived();
      await held;
      await route.fulfill({response});
    };
    await page.route(routePattern, handler, {times:1});
    try {
      await edit('R74','SAVE-SENT');
      await page.locator('#save-btn').click();
      await requested;
      await edit('R74','NEWER-LOCAL');
      await edit('S74','NEWER-OTHER');
      const responseArrived = page.waitForResponse(r=>r.url().endsWith('/save'));
      release(); await responseArrived;
      await page.waitForFunction(()=>document.querySelector('#save-state').textContent!=='Saving');
      assert.equal(await page.locator('[data-addr="R74"]').textContent(),'NEWER-LOCAL');
      assert.equal(await page.locator('[data-addr="S74"]').textContent(),'NEWER-OTHER');
      await save();
      const stored = await read('/api/workbooks/ops-plan');
      assert.equal(stored.workbook.sheets[0].cells.R74,'NEWER-LOCAL');
      assert.equal(stored.workbook.sheets[0].cells.S74,'NEWER-OTHER');
    } finally { release(); await page.unroute(routePattern,handler); }
  });
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(results,null,2));
  if (process.env.REGRESSION_OUTPUT) fs.writeFileSync(process.env.REGRESSION_OUTPUT,JSON.stringify({results,errors},null,2));
  await browser.close();
  if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
