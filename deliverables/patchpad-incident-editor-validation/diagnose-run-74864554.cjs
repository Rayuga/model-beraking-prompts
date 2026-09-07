// Diagnostic probes only. Does not modify the task or the archived run.
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    const out = {};
    const ready = () => page.waitForFunction(() => document.querySelector('#doc-title')?.textContent === 'Northwind API Incident Report');
    const reload = async () => { await page.reload(); await ready(); };
    const focus = () => page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, documentFocused: document.hasFocus() }));
    const lines = () => page.locator('.line .text').evaluateAll(es => es.map(e => e.dataset.lineText));
    const find = async q => { await page.locator('#find-box').fill(q); await page.locator('#find-box').press('Enter'); await page.locator('#find-box').press('Escape'); };
    const copy = async () => { await page.keyboard.press('Control+c'); return page.evaluate(() => navigator.clipboard.readText()); };
    await page.goto('http://localhost:3000'); await ready();
    await page.locator('#find-box').fill('NEXT');
    await page.locator('#find-next-btn').click();
    out.click_find_next_focus = await focus();
    await page.evaluate(() => navigator.clipboard.writeText('STALE-CLIPBOARD-PROBE'));
    out.copy_after_button_click = await copy();
    await page.locator('#find-box').click();
    await page.keyboard.press('Escape');
    out.copy_after_documented_escape = await copy();
    await reload();
    await page.locator('#editor').click();
    await page.keyboard.press('Control+f');
    await page.keyboard.type('NEXT');
    for (const key of ['Enter', 'Enter', 'Shift+Enter', 'Escape']) await page.keyboard.press(key);
    out.keyboard_find = { focus: await focus(), clipboard: await copy() };
    await reload();
    const clickEnd = async (index, modifier) => {
      const loc = page.locator(`.line[data-line="${index}"] .text`);
      await loc.scrollIntoViewIfNeeded();
      const pos = await loc.evaluate(el => {
        const canvas = document.createElement('canvas');
        const c = canvas.getContext('2d');
        c.font = getComputedStyle(document.querySelector('#editor')).font;
        const width = c.measureText('mmmmmmmmmm').width / 10;
        const r = el.getBoundingClientRect();
        return { x: r.left + 10 + el.dataset.lineText.length * width + .5, y: r.top + 11 };
      });
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.click(pos.x, pos.y);
      if (modifier) await page.keyboard.up(modifier);
    };
    for (const modifier of ['Alt', 'Control']) {
      await reload();
      await clickEnd(4); await clickEnd(11, modifier); await clickEnd(16, modifier);
      const count = await page.locator('#editor .caret').count();
      await page.keyboard.type('MULTI');
      const after = (await lines()).filter((_, i) => [4,11,16].includes(i));
      await page.keyboard.press('Control+z');
      out['multicaret_' + modifier] = { count, after, undo: (await lines()).filter((_, i) => [4,11,16].includes(i)) };
    }
    await reload();
    await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.evaluate(() => navigator.clipboard.writeText('PASTE-A\nPASTE-B\nPASTE-C'));
    await page.keyboard.press('Control+v');
    await page.waitForFunction(() => [...document.querySelectorAll('.line .text')].some(e => e.dataset.lineText === 'PASTE-C'));
    out.paste = { after: (await lines()).slice(-3) };
    await page.keyboard.press('Control+z'); out.paste.undo = (await lines()).slice(-3);
    await page.keyboard.press('Control+y'); out.paste.redo = (await lines()).slice(-3);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Home');
    for (let i = 0; i < 7; i++) await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Control+x');
    await page.waitForFunction(() => [...document.querySelectorAll('.line .text')].at(-2).dataset.lineText === '');
    out.paste.cut = (await lines()).slice(-3);
    await page.keyboard.press('Control+z'); out.paste.cutUndo = (await lines()).slice(-3);
    await page.keyboard.press('Control+y'); out.paste.cutRedo = (await lines()).slice(-3);
    await reload();
    for (const marker of ['REVISION-HISTORY-A', 'REVISION-HISTORY-B']) {
      await find('OMEGA-END-ANCHOR'); await page.keyboard.press('End'); await page.keyboard.type(' ' + marker);
      const response = page.waitForResponse(r => r.url().endsWith('/save') && r.request().method() === 'POST');
      await page.locator('#save-btn').click(); await response;
    }
    const before = await lines();
    const revisionOne = page.locator('#revision-list .revision').filter({ has: page.locator('strong', { hasText: /^Revision 1$/ }) });
    await revisionOne.getByRole('button', { name: 'Restore Draft' }).click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('restored as unsaved'));
    out.restore = { focus: await focus(), restored: (await lines()).at(-1) };
    await page.keyboard.press('Control+z');
    out.restore.keyboardUndoRestoredDraft = JSON.stringify(await lines()) === JSON.stringify(before);
    await page.locator('#undo-btn').click();
    out.restore.buttonUndoRestoredDraft = JSON.stringify(await lines()) === JSON.stringify(before);
    fs.writeFileSync('/results/run-74864554-diagnostics.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
