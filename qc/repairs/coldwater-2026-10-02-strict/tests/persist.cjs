// Scripted golden checks for saving, history and the live shared library.
// Phase "before" runs everything up to the restart; phase "after" re-reads the
// record once the app process has really been replaced by the caller.
const fs = require('node:fs');
const t = require('./lib.cjs');
const { assert } = t;
const phase = process.argv[2] || 'before';
const stateFile = '/state/restart.json';

(async () => {
  const browser = await t.launch();
  const results = {};
  const check = async (name, body) => {
    try { await body(); results[name] = true; }
    catch (error) { results[name] = String(error.message || error).split('\n').slice(0, 6).join(' | '); }
  };
  const save = page => page.getByRole('button', { name: 'Save', exact: true });
  const titleOf = page => page.getByRole('textbox', { name: 'Snippet title' });
  const fileOf = page => page.getByRole('textbox', { name: 'Filename' });
  const lib = (page, title) => page.getByRole('button', { name: new RegExp(title) });
  const heading = page => page.locator('.editor .paneheading span').first().innerText();
  const api = (page, path) => page.evaluate(p => fetch(p).then(r => r.json()), path);
  const create = async (page, title, filename, text) => {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await t.setFile(page, filename, title); await t.setSource(page, text);
    await save(page).click(); await t.sleep(700);
    const record = (await api(page, '/api/snippets')).find(item => item.title === title);
    assert.ok(record, 'saved ' + title); return record;
  };
  const stamp = Date.now().toString(36);

  if (phase === 'after') {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const page = await t.openPage(browser);
    await check('cw_save_reload_restart', async () => {
      await lib(page, saved.title).click(); await t.sleep(500);
      assert.equal(await titleOf(page).inputValue(), saved.title); assert.equal(await fileOf(page).inputValue(), saved.filename);
      assert.equal(await t.source(page), saved.code);
      const record = await api(page, '/api/snippets/' + saved.id);
      assert.equal(record.revision, saved.revision);
      const history = await api(page, '/api/snippets/' + saved.id + '/history');
      assert.deepEqual(history.map(item => item.revision), saved.history);
      assert.deepEqual(history.map(item => item.code), saved.codes, 'every revision keeps its own source after the restart');
      assert.equal((await api(page, '/api/snippets')).filter(item => item.title === saved.title).length, 1);
      const replay = await page.evaluate(async ([id, body]) => (await fetch('/api/snippets/' + id + '/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), [saved.id, saved.restoreBody]);
      assert.equal(replay.revision, saved.revision, 'replayed restore after restart returns the same revision');
      const after = await api(page, '/api/snippets/' + saved.id + '/history');
      assert.deepEqual(after.map(item => item.revision), saved.history, 'replay after restart adds no revision');
    });
    t.report('persist-after', results, page);
    await browser.close();
    process.exit(Object.values(results).every(value => value === true) ? 0 : 1);
  }

  const a = await t.openPage(browser);
  const b = await t.openPage(browser);

  await check('cw_shared_saved_record', async () => {
    const record = await create(a, 'gate-' + stamp, 'gate.js', 'console.log("gate ' + stamp + '");');
    await b.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const db of await indexedDB.databases()) indexedDB.deleteDatabase(db.name); document.cookie.split(';').forEach(c => { document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'; }); });
    await t.fresh(b); await lib(b, record.title).click(); await t.sleep(400);
    assert.equal(await titleOf(b).inputValue(), record.title); assert.equal(await fileOf(b).inputValue(), 'gate.js');
    assert.equal(await t.source(b), 'console.log("gate ' + stamp + '");');
    await t.fresh(b); assert.equal(await lib(b, record.title).count(), 1);
  });

  await check('cw_save_reload_restart(before)', async () => {
    const record = await create(a, 'restart-' + stamp, 'restart.js', 'const kept = "' + stamp + '";\nconsole.log(kept);');
    await t.setSource(a, 'const kept = "' + stamp + '-v2";\nconsole.log(kept);'); await save(a).click(); await t.sleep(700);
    const restoreBody = { sourceRevision: 1, operationId: 'restart-op-' + stamp, revision: 2 };
    const restored = await a.evaluate(async ([id, body]) => (await fetch('/api/snippets/' + id + '/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), [record.id, restoreBody]);
    assert.equal(restored.revision, 3, 'restore makes a third revision');
    const head = await api(a, '/api/snippets/' + record.id);
    const history = await api(a, '/api/snippets/' + record.id + '/history');
    assert.equal(head.revision, 3);
    await b.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const db of await indexedDB.databases()) indexedDB.deleteDatabase(db.name); document.cookie.split(';').forEach(c => { document.cookie = c.split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'; }); });
    await t.fresh(b); await lib(b, record.title).click(); await t.sleep(400);
    assert.equal(await t.source(b), head.code);
    fs.writeFileSync(stateFile, JSON.stringify({ id: head.id, title: head.title, filename: head.filename, code: head.code, revision: head.revision, history: history.map(item => item.revision), codes: history.map(item => item.code), restoreBody }));
    assert.equal(history.length, 3); assert.equal(history[0].code, history[2].code); assert.notEqual(history[1].code, history[2].code);
  });

  await check('cw_stale_save_refused+cw_stale_save_keeps_draft', async () => {
    const record = await create(a, 'stale-' + stamp, 'stale.js', 'let v = 1;');
    await t.fresh(a); await lib(a, record.title).click(); await t.fresh(b); await lib(b, record.title).click(); await t.sleep(400);
    await t.setSource(a, 'let v = "from A";'); await save(a).click(); await t.sleep(700);
    assert.equal((await api(a, '/api/snippets/' + record.id)).revision, 2);
    await t.setFile(b, 'stale-b.js', 'stale-b-title-' + stamp); await t.setSource(b, 'let v = "from B";');
    await save(b).click(); await t.sleep(700);
    assert.match(await b.locator('.conflict-notice').first().innerText(), /changed in another editor/i);
    const head = await api(a, '/api/snippets/' + record.id);
    assert.equal(head.revision, 2); assert.equal(head.code, 'let v = "from A";'); assert.equal(head.title, record.title); assert.equal(head.filename, 'stale.js');
    const history = await api(a, '/api/snippets/' + record.id + '/history');
    assert.ok(!JSON.stringify(history).includes('from B'));
    assert.equal(await titleOf(b).inputValue(), 'stale-b-title-' + stamp); assert.equal(await fileOf(b).inputValue(), 'stale-b.js');
    assert.equal(await t.source(b), 'let v = "from B";');
    await t.editorOf(b).click(); await b.keyboard.press('ControlOrMeta+End'); await b.keyboard.type('//');
    assert.equal(await t.source(b), 'let v = "from B";//');
  });

  await check('cw_history_restore_adds_revision', async () => {
    const record = await create(a, 'hist-' + stamp, 'hist.js', 'let rev = 1;');
    await t.setSource(a, 'let rev = 2;'); await save(a).click(); await t.sleep(600);
    await t.setSource(a, 'let rev = 3;'); await save(a).click(); await t.sleep(600);
    await a.getByRole('button', { name: /^Revision 1/ }).click();
    assert.equal(await a.getByLabel('Historical source').innerText(), 'let rev = 1;');
    assert.equal((await api(a, '/api/snippets/' + record.id)).revision, 3);
    await a.getByRole('button', { name: 'Restore selected revision' }).click(); await t.sleep(800);
    let head = await api(a, '/api/snippets/' + record.id);
    assert.equal(head.revision, 4); assert.equal(head.code, 'let rev = 1;');
    assert.deepEqual((await api(a, '/api/snippets/' + record.id + '/history')).map(item => item.revision), [4, 3, 2, 1]);
    await t.fresh(b); await lib(b, record.title).click(); await t.sleep(400);
    await t.setSource(a, 'let rev = 5;'); await save(a).click(); await t.sleep(600);
    await b.getByRole('button', { name: /^Revision 2/ }).click();
    await b.getByRole('button', { name: 'Restore selected revision' }).click(); await t.sleep(800);
    head = await api(a, '/api/snippets/' + record.id);
    assert.equal(head.revision, 5); assert.equal(head.code, 'let rev = 5;');
    assert.ok((await api(a, '/api/snippets/' + record.id + '/history')).some(item => item.code === 'let rev = 5;'));
  });

  await check('cw_restore_request_repeat_safe', async () => {
    const record = await create(a, 'rep-' + stamp, 'rep.js', 'let rep = 1;');
    await t.setSource(a, 'let rep = 2;'); await save(a).click(); await t.sleep(600);
    let seen = null;
    const grab = req => { if (req.method() === 'POST' && /restore/.test(req.url())) seen = { url: req.url(), body: req.postData(), type: req.headers()['content-type'] }; };
    a.on('request', grab);
    await a.getByRole('button', { name: /^Revision 1/ }).click();
    await a.getByRole('button', { name: 'Restore selected revision' }).click(); await t.sleep(800);
    a.off('request', grab);
    assert.ok(seen, 'restore request recorded');
    assert.equal((await api(a, '/api/snippets/' + record.id)).revision, 3);
    const status = await a.evaluate(async r => (await fetch(r.url, { method: 'POST', headers: { 'content-type': r.type }, body: r.body })).status, seen);
    assert.ok(status < 500, 'replay status ' + status);
    assert.equal((await api(a, '/api/snippets/' + record.id)).revision, 3);
    assert.equal((await api(a, '/api/snippets/' + record.id + '/history')).length, 3);
  });

  await check('cw_live_library_update', async () => {
    await t.fresh(a);
    const record = await create(b, 'live-' + stamp, 'live.js', '// live');
    await t.sleep(5000);
    assert.equal(await lib(a, 'live-' + stamp).count(), 1, 'new title within five seconds');
    await titleOf(b).fill('live-renamed-' + stamp); await save(b).click();
    await t.sleep(5000);
    assert.equal(await lib(a, 'live-renamed-' + stamp).count(), 1, 'renamed title within five seconds');
    void record;
  });

  await check('cw_live_update_keeps_editing_state', async () => {
    await t.fresh(a);
    const lines = Array.from({ length: 45 }, (_, i) => `const row${i + 1} = ${i + 1};`);
    await t.setFile(a, 'draft-keep.js', 'draft title ' + stamp); await t.setSource(a, lines.join('\n'));
    await t.clickAt(a, 41, 5); await a.keyboard.type('MARK');
    const before = { source: await t.source(a), cursor: await t.cursor(a), scroll: await t.editorOf(a).evaluate(node => node.scrollTop) };
    assert.ok(before.scroll > 0);
    await create(b, 'other-' + stamp, 'other.js', '// other');
    await t.sleep(5000);
    assert.equal(await lib(a, 'other-' + stamp).count(), 1);
    assert.equal(await t.source(a), before.source); assert.equal(await t.cursor(a), before.cursor);
    assert.equal(await t.editorOf(a).evaluate(node => node.scrollTop), before.scroll);
    assert.equal(await titleOf(a).inputValue(), 'draft title ' + stamp); assert.equal(await fileOf(a).inputValue(), 'draft-keep.js');
    await a.keyboard.type('Z');
    assert.equal((await t.source(a)).split('\n')[41], 'constMARKZ row42 = 42;');
    await a.keyboard.press('ControlOrMeta+Z');
    if (await t.source(a) !== lines.join('\n')) await a.keyboard.press('ControlOrMeta+Z');
    assert.equal(await t.source(a), lines.join('\n'));
  });

  await check('cw_newer_revision_notice_keeps_draft', async () => {
    const record = await create(a, 'notice-' + stamp, 'notice.js', 'let n = 1;');
    await t.fresh(a); await lib(a, record.title).click(); await t.fresh(b); await lib(b, record.title).click(); await t.sleep(400);
    await t.setSource(a, 'let n = "draft in A";');
    await t.setSource(b, 'let n = "saved in B";'); await save(b).click();
    await t.sleep(5000);
    assert.match(await a.locator('.conflict-notice').first().innerText(), /Revision 2 .*saved in another tab/i);
    assert.equal(await t.source(a), 'let n = "draft in A";');
  });

  t.report('persist-before', results, a);
  const failed = Object.entries(results).filter(([, value]) => value !== true);
  const errors = [...a.errors, ...b.errors];
  if (errors.length) console.log(JSON.stringify({ errors }));
  await browser.close();
  if (failed.length || errors.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
