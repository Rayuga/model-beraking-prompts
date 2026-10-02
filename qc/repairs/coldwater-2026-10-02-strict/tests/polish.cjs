// Scripted golden checks for the surface gate, Polish criteria and screenshots.
const t = require('./lib.cjs');
const { assert } = t;

(async () => {
  const browser = await t.launch();
  const page = await t.openPage(browser);
  const editor = t.editorOf(page);
  const key = k => page.keyboard.press(k);
  const results = {};
  const check = async (name, body) => {
    try { await t.fresh(page); await body(); results[name] = true; }
    catch (error) { results[name] = String(error.message || error).split('\n').slice(0, 6).join(' | '); }
  };
  const undoBtn = page.getByRole('button', { name: 'Undo', exact: true });
  const redoBtn = page.getByRole('button', { name: 'Redo', exact: true });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  const heading = () => page.locator('.editor .paneheading span').first().innerText();

  await check('cw_custom_document_surface', async () => {
    await t.setSource(page, ''); await page.keyboard.type('surfaceprobe');
    const facts = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node, host = null;
      while ((node = walker.nextNode())) if (node.textContent.includes('surfaceprobe')) host = node.parentElement;
      const chain = []; for (let el = host; el; el = el.parentElement) chain.push(el);
      const fields = [...document.querySelectorAll('textarea,input,[contenteditable]')].filter(el => (el.value || el.textContent || '').includes('surfaceprobe'));
      const active = document.activeElement;
      return {
        found: Boolean(host), editableAncestor: chain.some(el => el.isContentEditable || ['TEXTAREA', 'INPUT'].includes(el.tagName)),
        fieldsHoldingSource: fields.length, active: active.tagName + (active.isContentEditable ? ':editable' : ''),
        markers: document.querySelectorAll('.cm-editor,.CodeMirror,.monaco-editor,.ace_editor,.ProseMirror,.tiptap,.ql-editor,[data-slate-editor],[class*="DraftEditor"]').length
      };
    });
    assert.deepEqual(facts, { found: true, editableAncestor: false, fieldsHoldingSource: 0, active: 'DIV', markers: 0 });
  });

  await check('cw_controls_keyboard_and_focus', async () => {
    await page.getByRole('textbox', { name: 'Snippet title' }).focus();
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement; const s = getComputedStyle(el);
        return { name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, editor: el.id === 'editor' };
      });
      seen.push(info);
      if (info.editor) await key('Escape');
      await key('Tab');
    }
    const names = seen.map(item => item.name).join(' | ');
    for (const wanted of ['Snippet title', 'Filename', 'Save', 'Format document', 'Find in code', 'Replacement text', 'Replace all', 'Code editor', 'New', 'Run', 'Stop']) assert.ok(names.includes(wanted), wanted + ' reachable: ' + names);
    const dim = seen.filter(item => !item.outline && !item.name.startsWith('≈'));
    assert.deepEqual(dim, [], 'every focused control shows an outline');
    assert.ok(seen.findIndex(item => item.editor) < seen.length - 1 && !seen[seen.findIndex(item => item.editor) + 1].editor, 'left the editor');
  });

  await check('cw_controls_feedback_and_labels', async () => {
    await t.setFile(page, 'fb.js', 'feedback sample'); await t.setSource(page, 'document.body.textContent = "ok";');
    await t.run(page); assert.match(await t.status(page), /Complete/);
    await t.setSource(page, 'throw new Error("visible-problem");'); await t.run(page);
    assert.match(await t.status(page), /Error/); assert.match(await t.consoleText(page), /visible-problem/);
    await save.click(); await t.sleep(600); assert.match(await t.status(page), /Saved/);
    await t.setSource(page, 'const a=1;const b=2;');
    await page.getByRole('button', { name: 'Format document' }).click(); await t.sleep(300);
    assert.match(await page.locator('#editor-message').innerText(), /formatted/i);
  });

  await check('cw_focus_returns_to_code', async () => {
    await t.setFile(page, 'focus.js', 'focus sample'); await t.setSource(page, 'const a=1;const b=2;');
    const typed = async (label) => { const before = await t.source(page); await page.keyboard.type('Q'); const after = await t.source(page); assert.equal(after.length, before.length + 1, label); assert.ok(after.includes('Q'), label); await key('Backspace'); };
    await page.getByRole('button', { name: 'Format document' }).click(); await t.sleep(300); await typed('after Format');
    await undoBtn.click(); await typed('after Undo');
    await undoBtn.click(); await undoBtn.click(); await redoBtn.click(); await typed('after Redo');
    await page.getByRole('textbox', { name: 'Find in code' }).fill('const'); await page.getByRole('textbox', { name: 'Replacement text' }).fill('let');
    await page.getByRole('button', { name: 'Replace all' }).click(); await typed('after Replace all');
    await save.click(); await t.sleep(600); await typed('after Save');
  });

  await check('cw_undo_redo_availability', async () => {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    assert.ok(await undoBtn.isDisabled()); assert.ok(await redoBtn.isDisabled());
    await editor.click(); await page.keyboard.type('x');
    assert.ok(await undoBtn.isEnabled()); assert.ok(await redoBtn.isDisabled());
    await undoBtn.click();
    assert.ok(await undoBtn.isDisabled()); assert.ok(await redoBtn.isEnabled());
    const name = 'availability ' + Date.now();
    await t.setFile(page, 'avail.js', name); await editor.click(); await page.keyboard.type('q'); await save.click(); await t.sleep(700);
    assert.ok(await undoBtn.isEnabled());
    await page.getByRole('button', { name: new RegExp(name) }).click(); await t.sleep(400);
    assert.ok(await undoBtn.isDisabled(), 'reopened record has clean history'); assert.ok(await redoBtn.isDisabled());
  });

  await check('cw_unsaved_marker', async () => {
    await t.setFile(page, 'mark.js', 'marker sample ' + Date.now()); await t.setSource(page, 'let m = 1;');
    await save.click(); await t.sleep(700);
    assert.match(await heading(), /· Saved$/);
    await editor.click(); await page.keyboard.type('z');
    assert.match(await heading(), /Unsaved changes/);
    await key('ControlOrMeta+Z'); assert.match(await heading(), /· Saved$/);
    await page.keyboard.type('w'); assert.match(await heading(), /Unsaved changes/);
    await save.click(); await t.sleep(700); assert.match(await heading(), /· Saved$/);
  });

  await check('cw_narrow_width_usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await t.fresh(page);
    const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
    assert.ok(overflow.doc <= overflow.win, JSON.stringify(overflow));
    for (const locator of [editor, page.getByRole('button', { name: /^Run/ }), page.locator('iframe[title="Live preview"]'), page.getByRole('log', { name: 'Console output' }), page.getByLabel('Saved snippets', { exact: true })]) {
      await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
      assert.ok(box && box.x >= -1 && box.x + box.width <= 391, JSON.stringify(box));
    }
    const boxes = await page.locator('.custom-tools button, .custom-tools input').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    for (let i = 0; i < boxes.length; i++) {
      assert.ok(boxes[i][0] >= 0 && boxes[i][2] <= 390, 'tool inside viewport');
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        assert.ok(a[2] <= b[0] + 1 || b[2] <= a[0] + 1 || a[3] <= b[1] + 1 || b[3] <= a[1] + 1, 'tools do not overlap');
      }
    }
    await t.setSource(page, ''); await page.keyboard.type('document.body.textContent = "narrow ok"; console.log("narrow log");');
    await t.run(page);
    assert.equal(await t.preview(page).locator('body').innerText(), 'narrow ok'); assert.match(await t.consoleText(page), /narrow log/);
    await page.screenshot({ path: '/state/golden-390.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await t.fresh(page);
  await t.setFile(page, 'shot.js', 'Screenshot sample');
  await t.setSource(page, '// totals for the preview\nfunction total(values) {\n  let sum = 0;\n  for (const value of values) {\n    if (value > 0) sum += value;\n  }\n  return sum;\n}\nconst label = "Total: " + total([3, 4, 5]);\ndocument.body.innerHTML = "<h1>" + label + "</h1>"; console.log(label);');
  await t.run(page);
  await t.clickAt(page, 4, 8); await page.keyboard.down('Shift'); await key('End'); await page.keyboard.up('Shift');
  await page.screenshot({ path: '/state/golden-1440.png' });

  t.report('polish', results, page);
  const failed = Object.entries(results).filter(([, value]) => value !== true);
  await browser.close();
  if (failed.length || page.errors.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
