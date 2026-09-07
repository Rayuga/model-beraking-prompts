// Real-input regressions for all eight failures in run-74864554.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    const errors = [], results = [];
    page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
    const reload = async () => { await page.reload(); await ready(); };
    const lines = () => page.locator('.line .text').evaluateAll(es => es.map(e => e.dataset.lineText));
    const focused = () => page.waitForFunction(() => document.activeElement === document.querySelector('#editor'), null, { timeout: 5000 });
    const find = async q => {
      await page.locator('#find-box').fill(q);
      await page.locator('#find-next-btn').click();
      await focused();
    };
    const clip = text => page.evaluate(text => navigator.clipboard.writeText(text), text);
    const copy = async text => {
      await page.keyboard.press('Control+c');
      await page.waitForFunction(async text => (await navigator.clipboard.readText()) === text, text, { timeout: 5000 });
    };
    const append = async text => {
      await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
      await clip(text); await page.keyboard.press('Control+v');
      await page.waitForFunction(text => [...document.querySelectorAll('.line .text')].map(e => e.dataset.lineText).join('\n').endsWith(text), text);
    };
    const check = async (id, fn) => { await reload(); await fn(); results.push({ id, passed: true }); console.log('PASS ' + id); };
    const targets = [4, 11, 16];
    const originals = ['Timeline', 'Customer impact', 'Action items'];
    const affected = async () => (await lines()).filter((_, i) => targets.includes(i));
    const clickAt = async (index, modifier, start = false) => {
      const row = page.locator(`.line[data-line="${index}"] .text`);
      await row.scrollIntoViewIfNeeded();
      const pos = await row.evaluate((el, start) => {
        const c = document.createElement('canvas').getContext('2d');
        c.font = getComputedStyle(document.querySelector('#editor')).font;
        const width = c.measureText('mmmmmmmmmm').width / 10;
        const rect = el.getBoundingClientRect();
        return { x: rect.left + 10 + (start ? 0 : el.dataset.lineText.length) * width + .5, y: rect.top + 11 };
      }, start);
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.click(pos.x, pos.y);
      if (modifier) await page.keyboard.up(modifier);
    };
    const addCarets = async (modifier, start = false) => {
      await clickAt(4, null, start); await clickAt(11, modifier, start); await clickAt(16, modifier, start);
      assert.equal(await page.locator('#editor .caret').count(), 3);
    };
    await page.goto('http://localhost:3000/'); await ready();
    await check('unicode_grapheme_backspace_delete', async () => {
      const a = 'UNICODE-BACKSPACE:A\u{1f642}B', b = 'UNICODE-DELETE:Ae\u0301B';
      await append(a + '\n' + b);
      await find('\u{1f642}'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Backspace');
      assert.equal((await lines()).at(-2), 'UNICODE-BACKSPACE:AB');
      await page.keyboard.press('Control+z'); assert.equal((await lines()).at(-2), a);
      await find('e\u0301'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Delete');
      assert.equal((await lines()).at(-1), 'UNICODE-DELETE:AB');
      await page.keyboard.press('Control+z'); assert.equal((await lines()).at(-1), b);
    });
    await check('unicode_grapheme_navigation_selection', async () => {
      const sample = 'A\u{1f642}e\u0301B';
      await append('UNICODE-NAV:' + sample); await find(sample); await page.keyboard.press('ArrowLeft');
      for (const glyph of ['A', '\u{1f642}', 'e\u0301']) {
        await page.keyboard.press('Shift+ArrowRight'); await copy(glyph); await page.keyboard.press('ArrowRight');
      }
      assert.equal((await lines()).at(-1), 'UNICODE-NAV:' + sample);
    });
    await check('undo_paste_cut_atomic', async () => {
      await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
      const before = await lines();
      await clip('PASTE-A\nPASTE-B\nPASTE-C'); await page.keyboard.press('Control+v');
      await page.waitForFunction(() => [...document.querySelectorAll('.line .text')].at(-1).dataset.lineText === 'PASTE-C');
      const expected = [...before.slice(0, -1), 'PASTE-A', 'PASTE-B', 'PASTE-C'];
      assert.deepEqual(await lines(), expected);
      await page.locator('#undo-btn').click(); await focused(); assert.deepEqual(await lines(), before);
      await page.keyboard.press('Control+y'); assert.deepEqual(await lines(), expected);
      await page.keyboard.press('ArrowUp'); await page.keyboard.press('Home');
      for (let i = 0; i < 7; i++) await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Control+x');
      await page.waitForFunction(() => [...document.querySelectorAll('.line .text')].at(-2).dataset.lineText === '');
      const cut = [...expected]; cut[cut.length - 2] = '';
      assert.deepEqual(await lines(), cut);
      await page.keyboard.press('Control+z'); assert.deepEqual(await lines(), expected);
      await page.keyboard.press('Control+y'); assert.deepEqual(await lines(), cut);
    });
    await check('find_replace_exact_counts_and_offsets', async () => {
      const before = await lines();
      await page.locator('#find-box').fill('NEXT');
      assert.match(await page.locator('#save-state').textContent(), /3 matches/);
      await clip('PASTE-B');
      for (const row of [18, 19, 20, 18]) {
        await page.locator('#find-next-btn').click(); await focused();
        assert.equal(await page.locator('#cursor-label').textContent(), `Ln ${row}, Col 5`); await copy('NEXT');
      }
      await page.locator('#replace-box').fill('FOLLOWUP'); await page.locator('#replace-current-btn').click();
      const current = await lines();
      assert.equal(current[17], 'FOLLOWUP: Replace temporary dashboard link before publishing.');
      assert.equal(current[18], before[18]); assert.equal(current[19], before[19]);
      await page.locator('#find-box').fill('ALPHA-00'); assert.match(await page.locator('#save-state').textContent(), /99 matches/);
      await page.locator('#replace-box').fill('INCIDENT-MARKER-00'); await page.locator('#replace-all-btn').click();
      await focused();
      const after = await lines();
      assert.deepEqual(after, current.map(s => s.replaceAll('ALPHA-00', 'INCIDENT-MARKER-00')));
      assert.equal(after.join('\n').split('INCIDENT-MARKER-00').length - 1, 99);
      assert.ok(after[23].includes('INCIDENT-MARKER-0001'));
      assert.ok(after[121].includes('INCIDENT-MARKER-0099'));
      assert.ok(after[122].includes('ALPHA-0100')); assert.ok(after[1222].includes('ALPHA-1200'));
      assert.equal(after.join('\n').split('OMEGA-END-ANCHOR').length - 1, 1);
    });
    await check('keyboard_find_focus_and_cycle', async () => {
      await page.locator('#editor').click(); await page.keyboard.press('Control+f');
      assert.ok(await page.locator('#find-box').evaluate(e => e === document.activeElement));
      await page.keyboard.type('NEXT'); await clip('PASTE-B');
      for (const [key, row] of [['Enter', 18], ['Enter', 19], ['Shift+Enter', 18]]) {
        await page.keyboard.press(key);
        assert.ok(await page.locator('#find-box').evaluate(e => e === document.activeElement));
        assert.equal(await page.locator('#cursor-label').textContent(), `Ln ${row}, Col 5`);
      }
      await page.keyboard.press('Escape'); await focused(); await copy('NEXT');
    });
    await check('multi_caret_full_typing_single_undo', async () => {
      for (const modifier of ['Alt', 'Control']) {
        await reload(); await addCarets(modifier);
        await page.keyboard.type('MULTI'); assert.deepEqual(await affected(), originals.map(s => s + 'MULTI'));
        await page.keyboard.press('Control+z'); assert.deepEqual(await affected(), originals);
        await page.keyboard.press('Control+y'); assert.deepEqual(await affected(), originals.map(s => s + 'MULTI'));
      }
    });
    await check('multi_caret_backspace_delete_sibling', async () => {
      for (const modifier of ['Alt', 'Control']) {
        await reload(); await addCarets(modifier); const before = await lines();
        await page.keyboard.press('Backspace');
        assert.deepEqual(await lines(), before.map((s, i) => targets.includes(i) ? s.slice(0, -1) : s));
        await page.keyboard.press('Control+z'); assert.deepEqual(await lines(), before);
        await addCarets(modifier, true); await page.keyboard.press('Delete');
        assert.deepEqual(await lines(), before.map((s, i) => targets.includes(i) ? s.slice(1) : s));
        await page.keyboard.press('Control+z'); assert.deepEqual(await lines(), before);
      }
    });
    await check('revision_history_preview_restore_undo_exact', async () => {
      const api = () => page.evaluate(async () => (await (await fetch('/api/documents/incident-alpha')).json()).document);
      for (const marker of ['REVISION-HISTORY-A', 'REVISION-HISTORY-B']) {
        await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End'); await page.keyboard.type(' ' + marker);
        const before = await api();
        const response = page.waitForResponse(r => r.url().endsWith('/save') && r.request().method() === 'POST');
        await page.locator('#save-btn').click(); assert.equal((await response).status(), 200);
        assert.equal((await api()).current_revision, before.current_revision + 1);
      }
      const saved = await api(); const before = await lines();
      const rev = page.locator('#revision-list .revision').filter({ has: page.locator('strong', { hasText: /^Revision 1$/ }) });
      assert.ok(await page.locator('#revision-list .revision').count() >= 3);
      await rev.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.locator('#revision-preview-1').waitFor({ state: 'visible' });
      const preview = await page.locator('#revision-preview-1').textContent();
      assert.ok(preview.startsWith('Incident: Northwind API latency event')); assert.ok(!preview.includes('REVISION-HISTORY-'));
      assert.deepEqual(await api(), saved);
      for (const mode of ['keyboard', 'button']) {
        await rev.getByRole('button', { name: 'Restore Draft' }).click();
        await page.waitForFunction(() => document.querySelector('#message').textContent.includes('restored as unsaved'));
        await focused(); assert.ok(!(await lines()).join('\n').includes('REVISION-HISTORY-'));
        assert.deepEqual(await api(), saved);
        if (mode === 'keyboard') await page.keyboard.press('Control+z'); else await page.locator('#undo-btn').click();
        assert.deepEqual(await lines(), before); assert.deepEqual(await api(), saved);
      }
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync('/results/oracle-failures-regression.json', JSON.stringify({ scope: 'Eight exact local failure-path regressions; not an Oracle score', results, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
