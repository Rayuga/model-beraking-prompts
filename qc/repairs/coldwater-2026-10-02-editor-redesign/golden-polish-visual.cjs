const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const origin = process.env.CW_URL || 'http://172.17.0.10:3002/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${origin.replace(/\/$/, '')}`] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(origin, { waitUntil: 'networkidle' });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  const savedSnippet = page.locator('.snippetlist button').first();
  if (await savedSnippet.count()) {
    await savedSnippet.click();
    await page.locator('.history-list button').first().waitFor();
  }
  const labels = [];
  await page.locator('body').click({ position: { x: 1430, y: 890 } });
  for (let i = 0; i < 55; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { name: el?.getAttribute('aria-label') || el?.innerText?.trim().replace(/\s+/g, ' ').slice(0,80) || el?.getAttribute('type') || el?.tagName, visible: !!el?.matches?.(':focus-visible') };
    });
    labels.push(focused);
    if (/Code editor/i.test(focused.name)) await page.keyboard.press('Escape');
  }
  console.log('FOCUS', JSON.stringify(labels));
  for (const expected of ['Run', 'Snippet title', 'Filename', 'Save', 'Format document', 'Find in code', 'Code editor', 'New', 'Revision 1']) {
    assert.ok(labels.some(item => item.name.includes(expected) && item.visible), `missing focus-visible traversal for ${expected}`);
  }

  const source = async () => (await editor.locator('.line .text').allTextContents()).join('\n');
  const replace = async value => { await editor.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type(value); };
  await replace('const n=1;');
  assert.match(await page.locator('.paneheading').first().innerText(), /Unsaved changes/i);
  await page.getByRole('button', { name: 'Format document' }).click();
  assert.match(await page.locator('#editor-message').innerText(), /formatted/i);
  await replace('const = 1;');
  await page.getByRole('button', { name: 'Format document' }).click();
  assert.match(await page.locator('#editor-message').innerText(), /Format failed/i);
  assert.equal(await source(), 'const = 1;');
  const title = 'Polish Matrix ' + Date.now();
  await page.getByRole('textbox', { name: 'Snippet title' }).fill(title);
  await page.getByRole('textbox', { name: 'Filename' }).fill('polish.js');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(250);
  assert.match(await page.locator('.runstatus').innerText(), /Saved/);

  await replace('function paint(x){\n  return "blue" + x;\n}\npaint(2);');
  const lineBoxes = await editor.locator('.line').evaluateAll(lines => lines.map(line => { const a=line.querySelector('.gutter').getBoundingClientRect(), b=line.querySelector('.text').getBoundingClientRect(); return {gy:a.y,ty:b.y}; }));
  assert.ok(lineBoxes.every(box => Math.abs(box.gy - box.ty) < 2));
  const boxes = await page.locator('section.pane').evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }));
  assert.equal(boxes.length >= 3, true);
  const overlap = (a,b) => Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) * Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  assert.equal(overlap(boxes[0], boxes[1]), 0);
  await page.screenshot({ path: '/tmp/cw-golden-current.png', fullPage: true });
  console.log(JSON.stringify({ cw_controls_keyboard_and_focus:true, cw_controls_feedback_and_labels:true, visualLayoutNoOverlap:true, lineNumberAlignment:true, focusedLabels:labels.map(x=>x.name) }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
