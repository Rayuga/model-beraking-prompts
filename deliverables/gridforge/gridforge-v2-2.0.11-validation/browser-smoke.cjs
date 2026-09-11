// Unpaid local regression evidence. This is not an Oracle or model score.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const kind = process.argv[2];
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [], requests = [], passed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('dialog', dialog => dialog.accept());
  const check = async (name, fn) => { await fn(); passed.push(name); console.log('PASS ' + name); };
  const get = path => page.evaluate(async path => (await fetch(path)).json(), path);
  const post = (path, body) => page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { path, body });
  await page.goto('http://localhost:3000/');
  if (kind === 'gridforge') {
    const cell = address => page.locator('[data-addr="' + address + '"]');
    const edit = async (address, value) => {
      await page.locator('#name-box').fill(address);
      await page.locator('#name-box').press('Enter');
      await page.locator('#formula-bar').fill(value);
      await page.locator('#apply-formula').click();
    };
    const current = () => get('/api/workbooks/ops-plan');
    await check('seed and custom surface', async () => {
      await page.waitForFunction(() => document.querySelector('#workbook-title').textContent === 'Northwind Operations Plan');
      assert.equal(await cell('B2').textContent(), '3');
      assert.equal(await cell('D2').textContent(), '360');
      assert.equal(await cell('D2').getAttribute('data-raw'), '=B2*C2');
      assert.equal(await page.locator('#grid input,#grid textarea,#grid [contenteditable=true]').count(), 0);
    });
    await check('precedence and dependent recalculation', async () => {
      await edit('G2', '=B2*(C2+10)');
      assert.equal(await cell('G2').textContent(), '390');
      await edit('F25', '3'); await edit('F26', '2'); await edit('F27', '5'); await edit('G25', '120');
      for (const [addr, formula, expected] of [['H25','=SUM(F25:F27,G25)','130'], ['H26','=AVG(F25:F27,G25)','32.5'], ['H29','=COUNT(F25:F27,G25)','4']]) {
        await edit(addr, formula); assert.equal(await cell(addr).textContent(), expected);
      }
      await edit('G25', '150');
      assert.equal(await cell('H25').textContent(), '160');
      assert.equal(await cell('H26').textContent(), '40');
    });
    await check('formula edit then range deletion restores current snapshot', async () => {
      const jump = async address => {
        await page.locator('#name-box').fill(address);
        await page.locator('#name-box').press('Enter');
      };
      await edit('D2', '=B2*(C2+10)');
      assert.equal(await cell('D2').textContent(), '390');
      await jump('T80');
      await page.keyboard.type('NAMEBOX-T80');
      await page.keyboard.press('Enter');
      const inside = ['B2','C2','D2','B3','C3','D3','B4','C4','D4'];
      const outside = ['A2','E4','T80'];
      const snapshot = async addresses => {
        const values = {};
        for (const address of addresses) {
          await jump(address);
          values[address] = {
            raw: await page.locator('#formula-bar').inputValue(),
            display: await cell(address).textContent()
          };
        }
        return values;
      };
      const before = await snapshot([...inside, ...outside]);
      assert.equal(before.T80.raw, 'NAMEBOX-T80');
      await jump('B2:D4');
      console.log('BEFORE DELETE',await page.evaluate(()=>({focus:document.activeElement.id,selection:document.querySelector('#selection-label').textContent,range:[...document.querySelectorAll('.in-range')].map(e=>e.dataset.addr)})));
      await page.keyboard.press('Delete');
      console.log('AFTER DELETE',await page.evaluate(()=>({focus:document.activeElement.id,selection:document.querySelector('#selection-label').textContent,range:[...document.querySelectorAll('.in-range')].map(e=>e.dataset.addr)})));
      for (const address of inside) assert.equal(await cell(address).textContent(), '');
      await page.locator('#undo-btn').click();
      assert.deepEqual(await snapshot([...inside, ...outside]), before);
      assert.equal(await cell('D2').textContent(), '390');
      assert.equal(await cell('D2').getAttribute('data-raw'), '=B2*(C2+10)');
    });
    await check('cycle isolation and single Undo recovery', async () => {
      await edit('K20', '9'); await edit('J20', '5'); await edit('J21', '=J20+1');
      await edit('J20', '=J21+1');
      assert.match(await cell('J20').textContent(), /CIRC|CYCLE|ERROR/i);
      await page.locator('#undo-btn').click();
      assert.equal(await cell('J20').textContent(), '5');
      assert.equal(await cell('J21').textContent(), '6');
      assert.equal(await cell('K20').textContent(), '9');
    });
    let captured;
    page.on('request', request => { if (request.url().endsWith('/save') && request.method() === 'POST') captured = request.postDataJSON(); });
    await check('UI save, reload, and forged-session rejection', async () => {
      await edit('T2', 'V2-SMOKE-SAVED');
      await page.locator('#save-btn').click();
      await page.waitForFunction(() => document.querySelector('#save-state').textContent === 'Saved');
      const before = await current();
      assert.ok(captured);
      const invalid = { ...captured, baseRevision: before.revision, workbook: before.workbook, userId: 'unknown-v2-user' };
      const result = await post('/api/workbooks/ops-plan/save', invalid);
      assert.ok(result.status >= 400 && result.status < 500);
      assert.deepEqual(await current(), before);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-addr="T2"]')?.textContent === 'V2-SMOKE-SAVED');
    });
    await check('saved workbook survives two server restarts without reseeding', async () => {
      await edit('Q70', 'RESTART-Q70');
      await edit('R70', '=7*8');
      await page.locator('#save-btn').click();
      await page.waitForFunction(() => document.querySelector('#save-state').textContent === 'Saved');
      const before = await current();
      const revisions = await get('/api/workbooks/ops-plan/revisions');
      const workbooks = await get('/api/workbooks');
      const {promisify} = require('node:util');
      const execute = promisify(require('node:child_process').execFile);
      for (let round = 0; round < 2; round++) {
        await execute('bash', ['/tests/restart-app.sh'], {timeout: 30000});
        const fresh = await browser.newContext();
        const view = await fresh.newPage();
        await view.goto('http://localhost:3000/');
        await view.waitForFunction(() => document.querySelector('#workbook-title')?.textContent === 'Northwind Operations Plan');
        const read = route => view.evaluate(async route => (await fetch(route)).json(), route);
        assert.deepEqual(await read('/api/workbooks/ops-plan'), before);
        assert.deepEqual(await read('/api/workbooks/ops-plan/revisions'), revisions);
        assert.deepEqual(await read('/api/workbooks'), workbooks);
        await view.locator('#name-box').fill('Q70'); await view.locator('#name-box').press('Enter');
        assert.equal(await view.locator('[data-addr="Q70"]').textContent(), 'RESTART-Q70');
        assert.equal(await view.locator('[data-addr="R70"]').textContent(), '56');
        await fresh.close();
      }
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#workbook-title')?.textContent === 'Northwind Operations Plan');
    });
  } else {
    const current = async () => (await get('/api/documents/incident-alpha')).document;
    const line = index => page.locator('.line[data-line="' + index + '"] .text');
    const find = async value => {
      await page.locator('#find-box').fill(value);
      await page.locator('#find-box').press('Enter');
      await page.locator('#find-box').press('Escape');
    };
    await check('seed and custom surface', async () => {
      await page.waitForFunction(() => document.querySelector('#doc-title').textContent === 'Northwind API Incident Report');
      const doc = await current();
      assert.equal(doc.content.split('\n').length, 1226);
      assert.equal(doc.current_revision, 1);
      assert.equal(await page.locator('#editor input,#editor textarea,#editor [contenteditable=true]').count(), 0);
    });
    await check('action labels, keyboard Find, wrap and replacement', async () => {
      const doc = await current();
      assert.equal(doc.content.split('NEXT').length - 1, 3);
      assert.equal(doc.content.split('\n')[17], 'NEXT: Replace temporary dashboard link before publishing.');
      await page.locator('#editor').click({position: {x: 100, y: 20}});
      await page.keyboard.press('Control+f');
      assert.equal(await page.locator('#find-box').evaluate(el => el === document.activeElement), true);
      await page.keyboard.type('NEXT');
      for (const [key, row] of [['Enter',18], ['Enter',19], ['Shift+Enter',18]]) {
        await page.keyboard.press(key);
        assert.equal(await page.locator('#cursor-label').textContent(), `Ln ${row}, Col 5`);
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#editor').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Control+c');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'NEXT');
      for (const row of [19,20,18]) {
        await page.locator('#find-next-btn').click();
        assert.equal(await page.locator('#cursor-label').textContent(), `Ln ${row}, Col 5`);
      }
      await page.locator('#replace-box').fill('FOLLOWUP');
      await page.locator('#replace-current-btn').click();
      assert.equal(await line(17).getAttribute('data-line-text'), 'FOLLOWUP: Replace temporary dashboard link before publishing.');
      assert.equal(await line(18).getAttribute('data-line-text'), 'NEXT: Confirm retry budget with the payments team.');
      assert.equal(await line(19).getAttribute('data-line-text'), 'NEXT: Add rollback checklist for connection pool changes.');
      assert.equal((await current()).content, doc.content);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.line[data-line="17"] .text')?.dataset.lineText.startsWith('NEXT:'));
    });
    await check('typed selection replacement and atomic Undo', async () => {
      await find('Timeline');
      await page.keyboard.type('REPLACEMENT');
      assert.equal(await line(4).getAttribute('data-line-text'), 'REPLACEMENT');
      await page.locator('#undo-btn').click();
      assert.equal(await line(4).getAttribute('data-line-text'), 'Timeline');
      await page.locator('#redo-btn').click();
      assert.equal(await line(4).getAttribute('data-line-text'), 'REPLACEMENT');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.line[data-line="4"] .text')?.dataset.lineText === 'Timeline');
    });
    await check('complete emoji deletion and Undo', async () => {
      await find('Timeline');
      await page.evaluate(() => navigator.clipboard.writeText('A🙂B'));
      await page.keyboard.press('Control+V');
      await find('🙂'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Backspace');
      assert.equal(await line(4).getAttribute('data-line-text'), 'AB');
      await page.locator('#undo-btn').click();
      assert.equal(await line(4).getAttribute('data-line-text'), 'A🙂B');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.line[data-line="4"] .text')?.dataset.lineText === 'Timeline');
    });
    await check('UI save, reload, and stale-write nonmutation', async () => {
      const before = await current();
      await find('Timeline'); await page.keyboard.type('Timeline updated');
      await page.locator('#save-btn').click();
      await page.waitForFunction(() => document.querySelector('#save-state').textContent.startsWith('Saved'));
      const saved = await current();
      assert.equal(saved.current_revision, before.current_revision + 1);
      assert.ok(saved.content.includes('Timeline updated'));
      const result = await post('/api/documents/incident-alpha/save', {documentId: before.id, baseRevision: before.current_revision, content: before.content});
      assert.equal(result.status, 409);
      assert.deepEqual(await current(), saved);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.line[data-line="4"] .text')?.dataset.lineText === 'Timeline updated');
    });
  }
  await check('same-origin resources and no fatal browser error', async () => {
    assert.deepEqual(errors, []);
    assert.ok(requests.every(url => new URL(url).origin === 'http://localhost:3000'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await page.screenshot({ path: '/results/' + kind + '-golden.png' });
  fs.writeFileSync('/results/' + kind + '-smoke.json', JSON.stringify({kind, scope:'unpaid representative regression; not a full Oracle grade', passed, errors}, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
