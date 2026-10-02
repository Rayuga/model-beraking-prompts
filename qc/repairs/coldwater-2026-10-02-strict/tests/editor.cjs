// Scripted golden checks for the editor criteria. Graded actions use real keys
// and mouse input; fixtures are entered with a paste event.
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
  const find = page.getByRole('textbox', { name: 'Find in code' });
  const replaceBox = page.getByRole('textbox', { name: 'Replacement text' });
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const previous = page.getByRole('button', { name: 'Previous', exact: true });

  await check('cw_custom_typing_and_line_join', async () => {
    await t.setSource(page, '');
    await page.keyboard.type('alpha'); await key('Enter'); await page.keyboard.type('beta');
    assert.equal(await t.source(page), 'alpha\nbeta');
    await key('Home'); await key('Backspace');
    assert.equal(await t.source(page), 'alphabeta');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), 'alpha\nbeta');
    await key('ArrowUp'); await key('End'); await key('Delete');
    assert.equal(await t.source(page), 'alphabeta');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), 'alpha\nbeta');
  });

  await check('cw_caret_navigation_and_line_numbers', async () => {
    const text = '123456789\n12\nabcdefghi';
    await t.setSource(page, text);
    await key('ControlOrMeta+Home'); await key('End');
    assert.match(await t.cursor(page), /Ln 1, Col 10/);
    await key('ArrowDown'); assert.match(await t.cursor(page), /Ln 2, Col 3/);
    await key('ArrowDown'); assert.match(await t.cursor(page), /Ln 3, Col 10/);
    await key('Home'); await key('ArrowLeft'); assert.match(await t.cursor(page), /Ln 2, Col 3/);
    await key('ArrowRight'); assert.match(await t.cursor(page), /Ln 3, Col 1/);
    assert.deepEqual(await editor.locator('.gutter').allTextContents(), ['1', '2', '3']);
    assert.equal(await t.source(page), text);
  });

  await check('cw_grapheme_navigation_and_deletion', async () => {
    const text = 'a\u{1F600}béc';
    await t.setSource(page, text);
    await key('Home'); await key('ArrowRight'); await key('Shift+ArrowRight');
    assert.equal(await t.copied(page), '\u{1F600}');
    await key('ArrowRight'); await key('Backspace');
    assert.equal(await t.source(page), 'abéc');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
    await key('Home'); await key('ArrowRight'); await key('ArrowRight'); await key('ArrowRight');
    await key('Shift+ArrowRight'); assert.equal(await t.copied(page), 'é');
    await key('ArrowLeft'); await key('Delete');
    assert.equal(await t.source(page), 'a\u{1F600}bc');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
  });

  await check('cw_mouse_selection', async () => {
    await t.setSource(page, 'first line here\nsecond row there\nthird final text');
    let p = await t.pointAt(page, 1, 9); await page.mouse.dblclick(p.x + 2, p.y);
    assert.equal(await t.copied(page), 'row');
    await t.setSource(page, 'alpha line-one end');
    p = await t.pointAt(page, 0, 12); await page.mouse.dblclick(p.x + 2, p.y);
    assert.equal(await t.copied(page), 'one');
    await t.setSource(page, 'first line here\nsecond row there\nthird final text');
    p = await t.pointAt(page, 2, 3); await page.mouse.click(p.x + 2, p.y, { clickCount: 3 });
    assert.equal((await t.copied(page)).trim(), 'third final text');
    const from = await t.pointAt(page, 0, 6), to = await t.pointAt(page, 1, 6);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
    assert.equal(await t.copied(page), 'line here second'.replace(' second', ' second'));
  });

  await check('cw_selection_replace_and_paste_undo', async () => {
    const text = 'one two three\nfour five six\nseven eight nine';
    await t.setSource(page, text);
    let p = await t.pointAt(page, 1, 6); await page.mouse.dblclick(p.x + 2, p.y);
    await page.keyboard.type('X');
    assert.equal(await t.source(page), 'one two three\nfour X six\nseven eight nine');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
    const from = await t.pointAt(page, 0, 4), to = await t.pointAt(page, 1, 4);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
    await key('ControlOrMeta+C');
    p = await t.pointAt(page, 2, 7); await page.mouse.dblclick(p.x + 2, p.y);
    await key('ControlOrMeta+V');
    assert.equal(await t.source(page), 'one two three\nfour five six\nseven two three\nfour nine');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
  });

  await check('cw_block_indent_undo', async () => {
    const text = 'aa\nbb\ncc';
    await t.setSource(page, text);
    await key('ControlOrMeta+Home'); await key('Shift+ArrowDown'); await key('Shift+ArrowDown');
    await key('Tab'); assert.equal(await t.source(page), '  aa\n  bb\ncc');
    await key('Shift+Tab'); assert.equal(await t.source(page), text);
    await key('Tab'); await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
    await key('ControlOrMeta+Shift+Z'); assert.equal(await t.source(page), '  aa\n  bb\ncc');
    await t.setSource(page, 'alpha beta\ngamma');
    await key('ControlOrMeta+Home'); await key('ArrowRight'); await key('Shift+ArrowRight'); await key('Shift+ArrowRight');
    await key('Tab'); assert.equal(await t.source(page), '  alpha beta\ngamma');
  });

  await check('cw_caret_kept_in_view', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join('\n');
    await t.setSource(page, lines);
    const visible = selector => editor.evaluate((root, sel) => {
      const el = root.querySelector(sel); if (!el) return false;
      const a = root.getBoundingClientRect(), b = el.getBoundingClientRect();
      return b.top >= a.top - 1 && b.bottom <= a.top + root.clientHeight + 1 && b.left >= a.left - 1 && b.right <= a.left + root.clientWidth + 1;
    }, selector);
    await key('ControlOrMeta+Home'); assert.ok(await visible('.primary-caret'), 'caret visible at start');
    await key('ControlOrMeta+End'); assert.match(await t.cursor(page), /Ln 60\b/); await page.keyboard.type('Z');
    assert.ok((await t.source(page)).endsWith('line 60Z'));
    assert.ok(await visible('.primary-caret'), 'caret visible at end');
    assert.ok(await visible('.line[data-line="59"] .gutter'), 'last line number visible');
    await key('ControlOrMeta+Home'); assert.ok(await visible('.line[data-line="0"] .gutter'), 'first line visible again');
    await t.setSource(page, 'x');
    await key('End'); await page.keyboard.type('0123456789'.repeat(30));
    assert.ok(await visible('.primary-caret'), 'caret visible at end of long line');
    assert.equal((await t.source(page)).length, 301);
  });

  await check('cw_long_line_editing', async () => {
    const vars = (from, count) => Array.from({ length: count }, (_, i) => `var v${from + i}=${from + i};`).join('');
    const text = 'var START=1;' + vars(0, 30) + 'var MID=2;' + vars(30, 30) + 'document.body.textContent="TAIL";';
    assert.ok(text.length >= 500);
    await t.setFile(page, 'long.js');
    await t.setSource(page, text);
    const current = await t.source(page);
    assert.equal(await editor.locator('.line').count(), 1);
    await editor.evaluate(root => { root.scrollLeft = 0; });
    const tail = current.indexOf('TAIL');
    await editor.evaluate((root, col) => {
      const textEl = root.querySelector('.line .text'); const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      let node, seen = 0; while ((node = walker.nextNode())) { if (col <= seen + node.length) { const r = document.createRange(); r.setStart(node, col - seen); r.collapse(true); root.scrollLeft += r.getBoundingClientRect().left - root.getBoundingClientRect().left - 200; return; } seen += node.length; }
    }, tail);
    const p = await t.pointAt(page, 0, tail + 1); await page.mouse.dblclick(p.x + 1, p.y);
    assert.equal(await t.copied(page), 'TAIL');
    await page.keyboard.type('DONE');
    assert.equal(await t.source(page), current.replace('TAIL', 'DONE'));
    await t.run(page);
    assert.equal(await t.preview(page).locator('body').innerText(), 'DONE');
  });

  await check('cw_multi_caret_typing_atomic', async () => {
    const text = 'red one\ngreen two\nblue three';
    await t.setSource(page, text);
    await t.clickAt(page, 0, 3); await t.clickAt(page, 1, 5, { modifiers: ['Alt'] }); await t.clickAt(page, 2, 4, { modifiers: ['Control'] });
    assert.equal(await editor.locator('.caret').count(), 3);
    await page.keyboard.type('MUL'); await t.sleep(3000); await page.keyboard.type('TI');
    assert.equal(await t.source(page), 'redMULTI one\ngreenMULTI two\nblueMULTI three');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
    await key('ControlOrMeta+Shift+Z'); assert.equal(await t.source(page), 'redMULTI one\ngreenMULTI two\nblueMULTI three');
  });

  await check('cw_multi_caret_delete', async () => {
    const text = 'abc\ndef\nghi';
    await t.setSource(page, text);
    await t.clickAt(page, 0, 3); await t.clickAt(page, 2, 3, { modifiers: ['Alt'] });
    await key('Backspace'); assert.equal(await t.source(page), 'ab\ndef\ngh');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
    await t.clickAt(page, 0, 0); await t.clickAt(page, 1, 0, { modifiers: ['Alt'] });
    await key('Delete'); assert.equal(await t.source(page), 'bc\nef\nghi');
    await key('ControlOrMeta+Z'); assert.equal(await t.source(page), text);
  });

  await check('cw_same_line_carets', async () => {
    const text = 'top\nred green blue\nend';
    await t.setSource(page, text);
    await t.clickAt(page, 1, 3); await t.clickAt(page, 1, 9, { modifiers: ['Alt'] }); await t.clickAt(page, 1, 14, { modifiers: ['Control'] });
    assert.equal(await editor.locator('.caret').count(), 3);
    await page.keyboard.type('XY');
    assert.equal(await t.source(page), 'top\nredXY greenXY blueXY\nend');
    await key('Backspace'); assert.equal(await t.source(page), 'top\nredX greenX blueX\nend');
    assert.equal(text.length, 22);
  });

  await check('cw_undo_restores_caret', async () => {
    const text = 'line one\nline two\nline three\nline four';
    await t.setSource(page, text);
    await t.clickAt(page, 1, 4); await page.keyboard.type('AA');
    await key('ControlOrMeta+End'); await page.keyboard.type('BB');
    assert.equal(await t.source(page), 'line one\nlineAA two\nline three\nline fourBB');
    await key('ControlOrMeta+Z'); await key('ControlOrMeta+Z');
    assert.equal(await t.source(page), text);
    await page.keyboard.type('Q');
    assert.equal(await t.source(page), 'line one\nlineQ two\nline three\nline four');
    assert.match(await t.cursor(page), /Ln 2, Col 6/);
  });

  await check('cw_find_forward_backward_wrap', async () => {
    await t.setSource(page, 'app.run( a\nb app.run(\napp.run( c\nApp.run( d\nappXrun( e');
    await key('ControlOrMeta+Home');
    await find.fill('app.run(');
    const seen = [];
    for (let i = 0; i < 4; i++) { await next.click(); seen.push([await t.cursor(page), await t.copied(page)]); }
    assert.deepEqual(seen.map(s => s[1]), ['app.run(', 'app.run(', 'app.run(', 'app.run(']);
    assert.deepEqual(seen.map(s => s[0].match(/Ln (\d+)/)[1]), ['1', '2', '3', '1']);
    await previous.click(); assert.match(await t.cursor(page), /Ln 3/); assert.equal(await t.copied(page), 'app.run(');
  });

  await check('cw_replace_current', async () => {
    const text = 'cat one\ncat two\ncat three';
    await t.setSource(page, text);
    await key('ControlOrMeta+Home');
    await find.fill('cat'); await replaceBox.fill('dog');
    await next.click(); await next.click();
    await page.getByRole('button', { name: 'Replace', exact: true }).click();
    assert.equal(await t.source(page), 'cat one\ndog two\ncat three');
    assert.match(await t.cursor(page), /Ln 3/); assert.equal(await t.copied(page), 'cat');
    await undoBtn.click(); assert.equal(await t.source(page), text);
    await redoBtn.click(); assert.equal(await t.source(page), 'cat one\ndog two\ncat three');
  });

  await check('cw_replace_all_atomic', async () => {
    const text = 'key=1\nkey=2 key=3\nx key\nKey';
    await t.setSource(page, text);
    await find.fill('key'); await replaceBox.fill('id');
    await page.getByRole('button', { name: 'Replace all' }).click();
    assert.equal(await t.source(page), 'id=1\nid=2 id=3\nx id\nKey');
    await undoBtn.click(); assert.equal(await t.source(page), text);
    await redoBtn.click(); assert.equal(await t.source(page), 'id=1\nid=2 id=3\nx id\nKey');
    await undoBtn.click(); await editor.focus(); await page.keyboard.type('!');
    const edited = await t.source(page);
    assert.equal(edited.replace('!', ''), text);
    assert.ok(await redoBtn.isDisabled());
    await key('ControlOrMeta+Shift+Z'); assert.equal(await t.source(page), edited);
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    assert.equal(await t.source(page), edited, 'an unhandled Ctrl chord inserts nothing');
  });

  await check('cw_replace_self_containing_text', async () => {
    const text = 'ab x\nab y\nab z';
    await t.setSource(page, text);
    await find.fill('ab'); await replaceBox.fill('ab-ab');
    await page.getByRole('button', { name: 'Replace all' }).click();
    assert.equal(await t.source(page), 'ab-ab x\nab-ab y\nab-ab z');
    await undoBtn.click(); assert.equal(await t.source(page), text);
    await editor.focus(); await key('ControlOrMeta+Home');
    await next.click();
    const one = page.getByRole('button', { name: 'Replace', exact: true });
    await one.click(); assert.equal(await t.source(page), 'ab-ab x\nab y\nab z');
    await one.click(); assert.equal(await t.source(page), 'ab-ab x\nab-ab y\nab z');
  });

  const styleOf = text => editor.evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root.querySelector('.line .text').closest('#editor'), NodeFilter.SHOW_TEXT);
    const found = []; let node;
    while ((node = walker.nextNode())) {
      if (node.textContent === wanted && !node.parentElement.closest('.gutter')) { const s = getComputedStyle(node.parentElement); found.push(`${s.color}|${s.fontWeight}|${s.fontStyle}`); }
    }
    return found;
  }, text);

  await check('cw_js_semantic_coloring', async () => {
    const text = 'function total(n) {\n  // note\n  let plain = n;\n  return plain + 42 + "text".length;\n}\nconsole.log(total(1));';
    await t.setFile(page, 'colour.js'); await t.setSource(page, text);
    assert.deepEqual(await styleOf('let'), await styleOf('return'));
    assert.deepEqual(await styleOf('log'), [(await styleOf('total'))[0]]);
    const fn = await styleOf('total'), kw = await styleOf('function'), str = await styleOf('"text"'), num = await styleOf('42'), com = await styleOf('// note');
    assert.equal(fn.length, 2); assert.equal(fn[0], fn[1]);
    const plain = (await styleOf('n'))[0] || (await editor.evaluate(root => { const s = getComputedStyle(root); return `${s.color}|${s.fontWeight}|${s.fontStyle}`; }));
    const all = [fn[0], kw[0], str[0], num[0], com[0]];
    assert.ok(all.every(Boolean), 'each category found: ' + JSON.stringify(all));
    assert.equal(new Set(all).size, 5, JSON.stringify(all));
    assert.ok(!all.includes(await editor.evaluate(root => { const s = getComputedStyle(root); return `${s.color}|${s.fontWeight}|${s.fontStyle}`; })));
    assert.equal(await t.source(page), text);
    void plain;
  });

  await check('cw_html_semantic_coloring', async () => {
    const text = '<!doctype html>\n<html>\n<body>\n<!-- note -->\n<p class="lead">Hi</p>\n</body>\n</html>';
    await t.setFile(page, 'colour.html'); await t.setSource(page, text);
    const tag = await styleOf('p'), attr = await styleOf('class'), val = await styleOf('"lead"'), com = await styleOf('<!-- note -->');
    const all = [tag[0], attr[0], val[0], com[0]];
    assert.ok(all.every(Boolean), JSON.stringify(all));
    assert.equal(new Set(all).size, 4, JSON.stringify(all));
    assert.equal(await t.source(page), text);
  });

  const formatBtn = page.getByRole('button', { name: 'Format document' });
  await check('cw_js_format_semantics_and_undo', async () => {
    const compact = 'function total(n){let s="{;keep}";for(let i=0;i<n;i++){if(i%2===0){s+=i;}}return s;}document.body.textContent=total(5);// keep me';
    await t.setFile(page, 'format.js'); await t.setSource(page, compact);
    await t.run(page); const before = await t.preview(page).locator('body').innerText();
    assert.equal(before, '{;keep}024');
    await formatBtn.click(); await t.sleep(300);
    const formatted = await t.source(page);
    assert.ok(formatted.split('\n').length > 6); assert.ok(formatted.includes('"{;keep}"')); assert.ok(formatted.includes('// keep me'));
    for (const line of formatted.split('\n')) assert.equal(line.match(/^ */)[0].length % 2, 0);
    assert.ok(formatted.split('\n').some(line => /^ {6}\S/.test(line)), 'three levels of two-space nesting');
    await t.run(page); assert.equal(await t.preview(page).locator('body').innerText(), before);
    await formatBtn.click(); await t.sleep(300); assert.equal(await t.source(page), formatted);
    await undoBtn.click(); assert.equal(await t.source(page), compact);
    await redoBtn.click(); assert.equal(await t.source(page), formatted);
  });

  await check('cw_html_format_semantics_and_undo', async () => {
    const compact = '<!doctype html><html><body><!--keep--><main data-note="a > b"><section><p id="out">before</p></section></main><script>document.getElementById("out").textContent="after";</script></body></html>';
    await t.setFile(page, 'format.html'); await t.setSource(page, compact);
    await t.run(page); assert.equal(await t.preview(page).locator('#out').innerText(), 'after');
    await formatBtn.click(); await t.sleep(300);
    const formatted = await t.source(page);
    assert.ok(formatted.split('\n').length > 6); assert.ok(formatted.includes('a > b')); assert.ok(formatted.includes('<!--keep-->'));
    for (const line of formatted.split('\n')) assert.equal(line.match(/^ */)[0].length % 2, 0);
    await t.run(page); assert.equal(await t.preview(page).locator('#out').innerText(), 'after');
    await formatBtn.click(); await t.sleep(300); assert.equal(await t.source(page), formatted);
    await undoBtn.click(); assert.equal(await t.source(page), compact);
    await redoBtn.click(); assert.equal(await t.source(page), formatted);
  });

  await check('cw_format_error_keeps_draft', async () => {
    await t.setFile(page, 'bad.js'); await t.setSource(page, 'const a=1;const b=2;');
    await formatBtn.click(); await t.sleep(300);
    assert.equal(await t.source(page), 'const a = 1;\nconst b = 2;');
    const bad = 'function broken() {\n  return (1 + ;';
    await t.setSource(page, bad);
    await formatBtn.click(); await t.sleep(300);
    assert.equal(await t.source(page), bad);
    assert.match(await page.locator('#editor-message').innerText(), /format failed/i);
  });

  t.report('editor', results, page);
  const failed = Object.entries(results).filter(([, value]) => value !== true);
  await browser.close();
  if (failed.length || page.errors.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
