// Scripted golden checks for the render gate and the run-lifecycle criteria.
const t = require('./lib.cjs');
const { assert } = t;

(async () => {
  const browser = await t.launch();
  const page = await t.openPage(browser);
  const editor = t.editorOf(page);
  const results = {};
  const check = async (name, body) => {
    try { await t.fresh(page); await body(); results[name] = true; }
    catch (error) { results[name] = String(error.message || error).split('\n').slice(0, 6).join(' | '); }
  };
  const body = () => t.preview(page).locator('body');
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  const runSource = async (filename, text, wait = 700) => { await t.setFile(page, filename); await t.setSource(page, text); await t.run(page, wait); };

  await check('cw_workspace_loads_and_takes_typing', async () => {
    assert.ok(await editor.isVisible()); assert.ok(await page.locator('iframe[title="Live preview"]').count());
    assert.ok(await page.getByRole('log', { name: 'Console output' }).isVisible());
    await t.setSource(page, ''); await page.keyboard.type('gateprobe');
    assert.equal(await t.source(page), 'gateprobe');
    // A reload with unsaved typed text must not be held up by a leave-page dialog.
    let dialogs = 0; const count = () => { dialogs += 1; }; page.on('dialog', count);
    await page.reload(); await t.sleep(500); page.off('dialog', count);
    assert.equal(dialogs, 0, 'reload with a dirty draft opened a dialog');
    await t.fresh(page); assert.ok(await editor.isVisible()); assert.deepEqual(page.errors, []);
  });

  await check('cw_basic_run_output', async () => {
    await t.setFile(page, 'dollar.js');
    await t.setSource(page, 'const price = 5;\ndocument.body.textContent = \'Cost: $\' + price + ` $${price} $&`;');
    await t.run(page);
    assert.equal(await body().innerText(), 'Cost: $5 $5 $&');
    await t.setFile(page, 'sum.js');
    await t.setSource(page, '');
    await page.keyboard.type('const s = 3 + 4; document.body.textContent = "sum " + s; console.log("sum " + s);');
    await t.run(page);
    assert.equal(await body().innerText(), 'sum 7'); assert.match(await t.consoleText(page), /sum 7/);
    await editor.focus(); await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete'); await page.keyboard.type('9');
    assert.match(await t.source(page), /^const s = 9 \+ 4;/);
    await t.run(page);
    assert.equal(await body().innerText(), 'sum 13'); assert.match(await t.consoleText(page), /sum 13/);
  });

  await check('cw_html_preview', async () => {
    await runSource('page.html', '<!doctype html>\n<html>\n<body>\n<h1>Report title</h1>\n<p id="out">idle</p>\n<button onclick="document.getElementById(\'out\').textContent=\'pressed\'">Press</button>\n<script>console.log("html-marker");</script>\n</body>\n</html>');
    assert.equal(await t.preview(page).locator('h1').innerText(), 'Report title');
    assert.match(await t.consoleText(page), /html-marker/);
    await t.preview(page).getByRole('button', { name: 'Press' }).click();
    assert.equal(await t.preview(page).locator('#out').innerText(), 'pressed');
  });

  await check('cw_error_message_and_line', async () => {
    await runSource('ok.js', 'document.body.textContent = "control ok";');
    assert.equal(await body().innerText(), 'control ok');
    await runSource('boom.js', 'const a = 1;\nconst b = 2;\n\nthrow new Error("js-boom-marker");');
    assert.match(await t.consoleText(page), /js-boom-marker.*line 4/);
    await runSource('boom.html', '<!doctype html>\n<html>\n<body>\n<h1>Title</h1>\n<p>text</p>\n<script>\nconst x = 1;\nthrow new Error("html-boom-marker");\n</script>\n</body>\n</html>');
    assert.match(await t.consoleText(page), /html-boom-marker.*line 8/);
    const broken = 'const list = [1, 2;\nconsole.log(list);';
    const before = (await t.consoleText(page)).length;
    await runSource('syntax.js', broken);
    assert.match((await t.consoleText(page)).slice(before), /error/i);
    assert.match(await t.status(page), /Error/);
    assert.equal(await t.source(page), broken);
  });

  await check('cw_promise_rejection_message_and_line', async () => {
    await runSource('handled.js', 'Promise.reject(new Error("quiet")).catch(e => { console.log("handled-" + e.message); document.body.textContent = "handled"; });');
    assert.match(await t.consoleText(page), /handled-quiet/); assert.match(await t.status(page), /Complete/);
    await runSource('reject.js', 'const a = 1;\nconst b = 2;\nPromise.reject(new Error("reject-marker"));\nconst c = 3;');
    let text = await t.consoleText(page);
    assert.match(text, /reject-marker.*line 3/); assert.ok(!/\{\}|\[object Object\]/.test(text.split('reject-marker')[0].split('\n').pop()));
    await runSource('async.js', 'work();\nasync function work() {\n  await null;\n  throw new Error("async-marker");\n}');
    text = await t.consoleText(page);
    assert.match(text, /async-marker.*line 4/);
  });

  await check('cw_output_before_failure_kept', async () => {
    await runSource('a.js', 'console.log("before-throw");\nconst a = 1;\nthrow new Error("after-throw");');
    let text = await t.consoleText(page);
    assert.ok(text.includes('before-throw'));
    await runSource('b.js', 'console.log("before-loop");\nwhile (true) {}', 7000);
    text = await t.consoleText(page);
    assert.ok(text.includes('before-loop') && /time limit/i.test(text), text);
    await t.setFile(page, 'c.js'); await t.setSource(page, 'console.log("before-stop");\nsetTimeout(() => console.log("late"), 4000);');
    await t.run(page, 700); await stop.click(); await t.sleep(500);
    text = await t.consoleText(page);
    await t.sleep(5000); text = await t.consoleText(page);
    assert.ok(text.includes('before-stop') && !text.includes('late'), text);
  });

  await check('cw_run_starts_fresh_document', async () => {
    await runSource('first.js', 'const p = document.createElement("p"); p.textContent = "first-marker"; document.body.append(p); window.leftover = "kept";');
    assert.match(await body().innerText(), /first-marker/);
    await runSource('second.js', 'const p = document.createElement("p"); p.textContent = "second-marker " + typeof window.leftover; document.body.append(p);');
    const text = await body().innerText();
    assert.match(text, /second-marker undefined/); assert.ok(!text.includes('first-marker'), text);
  });

  await check('cw_console_levels_in_order', async () => {
    await runSource('levels.js', 'console.log("m-one");\nconsole.warn("m-two");\nconsole.error("m-three");\nconsole.info("m-four");');
    const text = await t.consoleText(page);
    const at = ['m-one', 'm-two', 'm-three', 'm-four'].map(marker => text.indexOf(marker));
    assert.ok(at.every(index => index >= 0), text);
    assert.deepEqual([...at].sort((a, b) => a - b), at);
  });

  await check('cw_interaction_starts_fresh_budget', async () => {
    await runSource('budget.html', '<!doctype html>\n<html>\n<body>\n<p id="out">idle</p>\n<button onclick="setTimeout(() => { document.getElementById(\'out\').textContent = \'short-done\'; }, 1000)">Short</button>\n<button onclick="(function again() { setTimeout(again, 100); })()">Endless</button>\n</body>\n</html>');
    assert.match(await t.status(page), /Complete/);
    await t.sleep(8000);
    await t.preview(page).getByRole('button', { name: 'Short' }).click(); await t.sleep(2200);
    assert.equal(await t.preview(page).locator('#out').innerText(), 'short-done');
    assert.ok(!/time limit/i.test(await t.consoleText(page)));
    await t.preview(page).getByRole('button', { name: 'Endless' }).click(); await t.sleep(8000);
    assert.match(await t.consoleText(page), /time limit/i);
  });

  await check('cw_last_good_recovery', async () => {
    await runSource('good.html', '<!doctype html>\n<html>\n<body>\n<input id="name" value="start">\n<canvas id="c" width="60" height="40"></canvas>\n<button onclick="const g=document.getElementById(\'c\').getContext(\'2d\');g.fillStyle=\'rgb(200,0,0)\';g.fillRect(0,0,60,40)">Draw</button>\n</body>\n</html>');
    await t.preview(page).locator('#name').fill('typed-value');
    await t.preview(page).getByRole('button', { name: 'Draw' }).click();
    await t.sleep(600);
    await runSource('bad.js', 'document.body.textContent = "partial";\nthrow new Error("bad-run");');
    assert.match(await t.consoleText(page), /bad-run/);
    assert.equal(await t.preview(page).locator('#name').inputValue(), 'typed-value');
    const pixel = await t.preview(page).locator('#c').evaluate(c => Array.from(c.getContext('2d').getImageData(5, 5, 1, 1).data));
    assert.deepEqual(pixel, [200, 0, 0, 255]);
    assert.equal(await t.preview(page).getByText('partial').count(), 0);
    await runSource('later.js', 'document.body.textContent = "later ok";');
    assert.equal(await body().innerText(), 'later ok');
    await runSource('written.js', 'document.body.innerHTML = \'<p id="out">idle</p><button onclick="document.getElementById(&quot;out&quot;).textContent=&quot;handler-ran&quot;">Go</button>\';');
    await t.preview(page).getByRole('button', { name: 'Go' }).click();
    assert.equal(await t.preview(page).locator('#out').innerText(), 'handler-ran');
  });

  await check('cw_time_limit_recovery', async () => {
    await runSource('control.js', 'setTimeout(() => { document.body.textContent = "control-picture"; }, 200);', 1200);
    assert.equal(await body().innerText(), 'control-picture');
    await runSource('loop.js', 'document.body.textContent = "loop-started";\nwhile (true) {}', 8000);
    assert.match(await t.consoleText(page), /time limit/i); assert.match(await t.status(page), /time limit|Error/i);
    assert.equal(await body().innerText(), 'control-picture');
    await runSource('chain.js', 'function again() { setTimeout(again, 100); }\nagain();', 8000);
    assert.equal((await t.consoleText(page)).match(/time limit/gi).length >= 2, true);
    assert.equal(await body().innerText(), 'control-picture');
    await runSource('final.js', 'document.body.textContent = "final ok";');
    assert.equal(await body().innerText(), 'final ok');
  });

  await check('cw_stop_cancels_pending_work', async () => {
    await runSource('ctl.js', 'const mark = () => { document.body.textContent = "control-marker"; console.log("control-marker"); };\nsetTimeout(mark, 2000);\nconst tick = setInterval(() => { clearInterval(tick); mark(); }, 2000);\nnew Promise(done => setTimeout(done, 2000)).then(mark);', 3000);
    assert.equal(await body().innerText(), 'control-marker'); assert.match(await t.consoleText(page), /control-marker/);
    await t.setSource(page, 'const mark = () => { document.body.textContent = "stopped-marker"; console.log("stopped-marker"); };\nsetTimeout(mark, 4000);\nconst tick = setInterval(() => { clearInterval(tick); mark(); }, 4000);\nnew Promise(done => setTimeout(done, 4000)).then(mark);');
    await t.run(page, 600); await stop.click(); await t.sleep(300);
    assert.match(await t.status(page), /stopped/i);
    await t.sleep(8000);
    assert.ok(!(await t.consoleText(page)).includes('stopped-marker'));
    assert.equal(await body().innerText(), 'control-marker');
  });

  await check('cw_newer_run_supersedes', async () => {
    const oldDraft = 'setTimeout(() => { document.body.textContent = "old-marker"; console.log("old-marker"); }, 4000);';
    await runSource('old.js', oldDraft.replaceAll('old-marker', 'ctl-marker'), 4800);
    assert.equal(await body().innerText(), 'ctl-marker'); assert.match(await t.consoleText(page), /ctl-marker/);
    await runSource('old.js', oldDraft, 300);
    // Straight after Run the code area has focus, so select-all and typing replace the draft.
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('document.body.textContent = "new-marker"; console.log("new-marker");');
    assert.equal(await t.source(page), 'document.body.textContent = "new-marker"; console.log("new-marker");');
    await t.run(page);
    assert.equal(await body().innerText(), 'new-marker'); assert.match(await t.consoleText(page), /new-marker/);
    await t.sleep(8000);
    assert.ok(!(await t.consoleText(page)).includes('old-marker'));
    assert.equal(await body().innerText(), 'new-marker');
  });

  await check('cw_preview_isolation', async () => {
    await t.setFile(page, 'iso-seed.js', 'iso-library-entry'); await t.setSource(page, '// seed');
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await t.sleep(600);
    const title = await page.title();
    await page.evaluate(() => localStorage.setItem('cw-probe', 'secret-value'));
    assert.equal(await page.evaluate(() => fetch('/api/health').then(r => r.status)), 200);
    await runSource('own.js', 'document.body.textContent = "own-dom"; console.log("own-log");');
    assert.equal(await body().innerText(), 'own-dom'); assert.match(await t.consoleText(page), /own-log/);
    await runSource('parent.js', 'try { console.log("parent-title:" + parent.document.title); parent.document.title = "hostile-marker"; } catch (e) { console.log("parent-blocked"); }\ndocument.body.textContent = "done";');
    let text = await t.consoleText(page);
    assert.match(text, /parent-blocked/); assert.ok(!text.includes('parent-title:'));
    await runSource('storage.js', 'try { console.log("stored:" + localStorage.getItem("cw-probe")); localStorage.setItem("cw-probe", "hostile-marker"); } catch (e) { console.log("storage-blocked"); }\ndocument.body.textContent = "done";');
    text = await t.consoleText(page);
    assert.match(text, /storage-blocked/); assert.ok(!text.includes('stored:'));
    await runSource('net.js', 'fetch("http://localhost:3000/api/health", { mode: "no-cors" }).then(r => console.log("net-status:" + r.type)).catch(() => console.log("net-blocked"));', 1500);
    text = await t.consoleText(page);
    assert.match(text, /net-blocked/); assert.ok(!text.includes('net-status:'));
    await runSource('net2.js', 'fetch("https://example.com/", { mode: "no-cors" }).then(r => console.log("ext-status:" + r.type)).catch(() => console.log("ext-blocked"));', 2500);
    text = await t.consoleText(page);
    assert.match(text, /ext-blocked/); assert.ok(!text.includes('ext-status:'));
    assert.equal(await page.title(), title); assert.ok(!(await page.title()).includes('hostile-marker'));
    assert.ok(!(await t.consoleText(page)).includes('secret-value'));
    assert.equal(await page.evaluate(() => localStorage.getItem('cw-probe')), 'secret-value');
    assert.ok(await page.getByRole('button', { name: /iso-library-entry/ }).count() >= 1);
  });

  await check('cw_dynamic_code_refused', async () => {
    await runSource('words.js', '// eval Function WebAssembly Worker import\nconst words = "eval(1) new Function() WebAssembly new Worker() import(x)";\ndocument.body.textContent = "words-ok";\nconsole.log("words-marker");');
    assert.equal(await body().innerText(), 'words-ok'); assert.match(await t.consoleText(page), /words-marker/);
    const cases = {
      eval: 'eval("document.body.textContent = \\"payload-ran\\"; console.log(\\"payload-ran\\")");',
      fn: 'new Function("document.body.textContent = \\"payload-ran\\"; console.log(\\"payload-ran\\")")();',
      wasm: 'new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));\ndocument.body.textContent = "wasm-ran";',
      worker: 'const w = new Worker(URL.createObjectURL(new Blob(["postMessage(1)"])));\nw.onmessage = () => { document.body.textContent = "worker-ran"; };',
      imp: 'import("data:text/javascript,export default 1").then(() => { document.body.textContent = "import-ran"; });'
    };
    for (const [name, text] of Object.entries(cases)) {
      const before = (await t.consoleText(page)).length;
      await runSource(name + '.js', text, 1500);
      const added = (await t.consoleText(page)).slice(before);
      assert.match(added, /outside this playground|unsupported|refused|not allowed|blocked/i, name + ': ' + added);
      assert.equal(await body().innerText(), 'words-ok', name);
      assert.ok(!/payload-ran|wasm-ran|worker-ran|import-ran/.test(added), name + ' payload');
    }
  });

  t.report('runtime', results, page);
  const failed = Object.entries(results).filter(([, value]) => value !== true);
  await browser.close();
  if (failed.length || page.errors.length) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
