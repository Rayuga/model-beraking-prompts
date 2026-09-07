// Local regression evidence, not an LLM Oracle grade.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const passed = [], errors = [];
    context.on('page', p => p.on('dialog', d => d.accept()));
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => errors.push(e.message));
    const check = async (name, fn) => { await fn(); passed.push(name); console.log('PASS ' + name); };
    const ready = async p => p.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
    const reload = async p => { await p.reload(); await ready(p); };
    const get = (p, url) => p.evaluate(async url => (await fetch(url)).json(), url);
    const current = async () => (await get(page, '/api/documents/incident-alpha')).document;
    const history = () => get(page, '/api/documents/incident-alpha/revisions');
    const line = (p, index) => p.locator(`.line[data-line="${index}"] .text`);
    const find = async (p, value) => {
      await p.locator('#find-box').fill(value);
      await p.locator('#find-box').press('Enter');
      await p.locator('#find-box').press('Escape');
    };
    const append = async (p, value) => {
      await find(p, 'OMEGA-END-ANCHOR');
      await p.keyboard.press('End');
      await p.keyboard.type(value);
    };
    const save = async p => {
      const response = p.waitForResponse(r => r.url().endsWith('/save') && r.request().method() === 'POST');
      await p.locator('#save-btn').click();
      return (await response).status();
    };
    const coordinate = () => page.locator('#cursor-label').textContent();
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await page.goto('http://localhost:3000/');
    await ready(page);
    await check('Seed starts at revision 1 with 1226 lines', async () => {
      const doc = await current();
      assert.equal(doc.current_revision, 1);
      assert.equal(doc.content.split('\n').length, 1226);
    });
    await check('Tab traversal, editor Escape exit, and unchanged document', async () => {
      const before = await current();
      const seen = new Set();
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({ id: document.activeElement.id, history: !!document.activeElement.closest('#revision-list') }));
        seen.add(focus.id);
        if (focus.history) seen.add('history');
        if (focus.id === 'editor') {
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#find-box').evaluate(e => e === document.activeElement), true);
          // Traverse backwards to the history controls without using Tab inside the editor.
          for (let j = 0; j < 15; j++) {
            await page.keyboard.press('Shift+Tab');
            if (await page.evaluate(() => !!document.activeElement.closest('#revision-list'))) seen.add('history');
            if (await page.locator('#editor').evaluate(e => e === document.activeElement)) await page.keyboard.press('Escape');
          }
        }
      }
      for (const id of ['find-box', 'replace-box', 'editor', 'history']) assert.ok(seen.has(id), 'unreached ' + id);
      assert.equal(await line(page, 4).getAttribute('data-line-text'), 'Timeline');
      assert.deepEqual(await current(), before);
    });
    await check('Tab indentation, Shift+Tab, Undo and Redo remain intact', async () => {
      await find(page, 'Timeline');
      await page.keyboard.press('Home');
      await page.keyboard.press('Tab');
      assert.equal(await line(page, 4).getAttribute('data-line-text'), '  Timeline');
      assert.ok(await page.locator('#editor').evaluate(e => e === document.activeElement));
      await page.keyboard.press('Shift+Tab');
      assert.equal(await line(page, 4).getAttribute('data-line-text'), 'Timeline');
      await page.keyboard.press('Control+z');
      assert.equal(await line(page, 4).getAttribute('data-line-text'), '  Timeline');
      await page.keyboard.press('Control+y');
      assert.equal(await line(page, 4).getAttribute('data-line-text'), 'Timeline');
      await reload(page);
    });
    await check('Exact word navigation and clipboard selections with accepted boundary variants', async () => {
      await append(page, '');
      await page.keyboard.press('Enter');
      await page.keyboard.type('NORTH WIND');
      await page.keyboard.press('Home');
      await page.keyboard.press('Control+ArrowRight');
      const forward = await coordinate();
      assert.ok(['Ln 1227, Col 6', 'Ln 1227, Col 7'].includes(forward));
      await page.keyboard.press('Home');
      await page.keyboard.press('Control+Shift+ArrowRight');
      await page.keyboard.press('Control+c');
      assert.equal(await coordinate(), forward);
      assert.equal(await clipboard(), forward.endsWith('6') ? 'NORTH' : 'NORTH ');
      await page.keyboard.press('End');
      await page.keyboard.press('Control+ArrowLeft');
      assert.equal(await coordinate(), 'Ln 1227, Col 7');
      await page.keyboard.press('End');
      await page.keyboard.press('Control+Shift+ArrowLeft');
      await page.keyboard.press('Control+c');
      assert.equal(await coordinate(), 'Ln 1227, Col 7');
      assert.equal(await clipboard(), 'WIND');
      assert.equal(await line(page, 1226).getAttribute('data-line-text'), 'NORTH WIND');
      await reload(page);
      assert.equal(await page.locator('.line').count(), 1226);
    });
    await check('Visible exact match counts: NEXT=3 and ALPHA-00=99', async () => {
      for (const [query, count] of [['NEXT', 3], ['ALPHA-00', 99]]) {
        await page.locator('#find-box').fill(query);
        await page.waitForFunction(count => document.querySelector('#save-state').textContent.includes(`${count} matches`), count);
      }
      await reload(page);
      await page.screenshot({ path: '/results/patchpad-golden.png' });
    });
    await check('Two chained UI stale saves retain local drafts and preserve server history', async () => {
      const tabB = await context.newPage();
      await tabB.goto('http://localhost:3000/');
      await ready(tabB);
      const base = await current();
      await append(page, ' TAB-A-WINS');
      assert.equal(await save(page), 200);
      const savedA = await current();
      const historyA = await history();
      assert.equal(savedA.current_revision, base.current_revision + 1);
      await append(tabB, ' TAB-B-STALE');
      assert.equal(await save(tabB), 409);
      await tabB.waitForFunction(() => document.querySelector('#message').textContent.includes('conflict'));
      assert.ok((await line(tabB, 1225).getAttribute('data-line-text')).endsWith(' TAB-B-STALE'));
      assert.deepEqual(await current(), savedA);
      assert.deepEqual(await history(), historyA);
      await reload(tabB);
      await append(tabB, ' TAB-B-REBASED');
      assert.equal(await save(tabB), 200);
      const savedB = await current();
      const historyB = await history();
      assert.equal(savedB.current_revision, base.current_revision + 2);
      await append(page, ' TAB-A-STALE-SECOND');
      assert.equal(await save(page), 409);
      await page.waitForFunction(() => document.querySelector('#message').textContent.includes('conflict'));
      assert.ok((await line(page, 1225).getAttribute('data-line-text')).endsWith(' TAB-A-STALE-SECOND'));
      assert.deepEqual(await current(), savedB);
      assert.deepEqual(await history(), historyB);
      assert.ok(savedB.content.endsWith(' TAB-A-WINS TAB-B-REBASED'));
      await tabB.close();
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync('/results/qc-regression.json', JSON.stringify({ scope: 'Unpaid targeted golden regression, not a full Oracle score', passed, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
