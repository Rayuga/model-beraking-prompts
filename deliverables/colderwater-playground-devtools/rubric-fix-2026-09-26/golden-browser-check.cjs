const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const base = 'http://localhost:3000';
const evidence = path.join(__dirname, 'browser-evidence');
fs.mkdirSync(evidence, { recursive: true });
const results = { started_at: new Date().toISOString(), checks: [], exchanges: [], dialogs: [], browser_errors: [], app_image: 'colderwater-agent:20260926-hardening', browser_image: 'ridgeline-verifier:20260926-hardening' };
let browser, page, context;
let dialogAccept = true, dialogText = '';
const prefix = 'CW Proof ' + Date.now().toString(36);
function pass(name, details = {}) { results.checks.push({ name, passed: true, ...details }); console.log('PASS ' + name); }
const editor = target => target.getByRole('textbox', { name: 'Code editor', exact: true });
const frame = target => target.frameLocator('iframe[title="Live preview"]');
async function source(code, target = page) { await editor(target).click(); await target.keyboard.press('Control+A'); await target.keyboard.insertText(code); }
async function complete(target = page) { await target.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'), null, { timeout: 10000 }); }
async function run(code, filename = 'probe.js', target = page) { await target.getByRole('textbox', { name: 'Filename', exact: true }).fill(filename); await source(code, target); await target.getByRole('button', { name: /^Run/ }).click(); }
async function marker(value, target = page) { await frame(target).getByText(value, { exact: true }).waitFor({ timeout: 10000 }); }
async function screenshot(name, target = page) { await target.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true }); }
function dialogs(target) {
  target.on('pageerror', error => results.browser_errors.push(error.message));
  target.on('dialog', async dialog => { results.dialogs.push({ type: dialog.type(), message: dialog.message(), accepted: dialogAccept }); if (dialogAccept) await dialog.accept(dialog.type() === 'prompt' ? dialogText : undefined); else await dialog.dismiss(); });
}
async function save(target = page) {
  const promise = target.waitForResponse(response => ['POST', 'PUT'].includes(response.request().method()) && response.url().includes('/api/snippets'));
  await target.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await promise;
  const body = await response.json();
  results.exchanges.push({ purpose: 'UI save', url: response.url(), method: response.request().method(), request: response.request().postDataJSON(), status: response.status(), body });
  return { status: response.status(), body, url: response.url() };
}
async function newDraft(title, code, filename = 'probe.js') {
  dialogAccept = true;
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill(filename);
  await source(code);
}
async function load(title, target = page) { await target.locator('.snippetlist button').filter({ hasText: title }).first().click(); }
async function read(url, target = page) {
  const result = await target.evaluate(async url => { const response = await fetch(url); return { status: response.status, body: await response.json() }; }, url);
  results.exchanges.push({ purpose: 'fresh server reread', url, method: 'GET', ...result });
  return result;
}
async function rename(title, target = page) {
  dialogText = title;
  const promise = target.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/api/snippets/'));
  await target.getByRole('button', { name: 'Rename', exact: true }).click();
  const response = await promise, body = await response.json();
  results.exchanges.push({ purpose: 'UI rename', url: response.url(), method: 'PUT', request: response.request().postDataJSON(), status: response.status(), body });
  return { status: response.status(), body, url: response.url() };
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' });
  results.chromium_version = browser.version(); assert.match(results.chromium_version, /^152\./);
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); dialogs(page);
  const health = await page.goto(base + '/api/health'); assert.equal(health.ok(), true); results.health_status = health.status();
  await page.goto(base); await editor(page).waitFor(); await complete();
  assert.match(await page.getByRole('log').innerText(), /printed/);
  assert.ok((await editor(page).innerText()).length > 10);
  pass('render: initial working example executes automatically in the live workspace');
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const renderMarker = 'Manual run ' + prefix;
  const renderCode = `document.body.textContent = ${JSON.stringify(renderMarker)}; console.log(${JSON.stringify(renderMarker)});`;
  await run(renderCode); await complete(); await marker(renderMarker);
  assert.match(await page.getByRole('log').innerText(), new RegExp(renderMarker));
  pass('render: newly authored JavaScript Run produces the exact new preview marker and console output');
  await screenshot('render-authored-marker');

  const gateTitle = 'CW gate ' + Date.now().toString(36);
  const gateCode = `document.body.innerHTML = '<p>shared-server-${gateTitle}</p>'; console.log('${gateTitle}');`;
  await newDraft(gateTitle, gateCode, 'gate-proof.js');
  const gate = await save(); assert.equal(gate.status, 201);
  assert.equal(gate.body.title, gateTitle); assert.equal(gate.body.code, gateCode); assert.ok(gate.body.id);
  const clean = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  results.gate_clean_context_initial_state = await clean.storageState();
  assert.deepEqual(results.gate_clean_context_initial_state, { cookies: [], origins: [] });
  const fresh = await clean.newPage(); dialogs(fresh);
  const listPromise = fresh.waitForResponse(response => response.request().method() === 'GET' && response.url() === gate.url);
  await fresh.goto(base); await editor(fresh).waitFor();
  const listResponse = await listPromise, listBody = await listResponse.json();
  assert.equal(listResponse.status(), 200); assert.deepEqual(listBody.find(item => item.id === gate.body.id), gate.body);
  await load(gateTitle, fresh); assert.equal(await editor(fresh).innerText(), gateCode);
  assert.equal(await fresh.getByRole('textbox', { name: 'Filename', exact: true }).inputValue(), 'gate-proof.js');
  results.exchanges.push({ purpose: 'constraints: clean-context server list and load', url: listResponse.url(), method: 'GET', status: listResponse.status(), body: listBody });
  const reloadedListPromise = fresh.waitForResponse(response => response.request().method() === 'GET' && response.url() === gate.url);
  await fresh.reload(); await editor(fresh).waitFor();
  const reloadedResponse = await reloadedListPromise, reloadedBody = await reloadedResponse.json();
  assert.equal(reloadedResponse.status(), 200); assert.deepEqual(reloadedBody.find(item => item.id === gate.body.id), gate.body);
  await load(gateTitle, fresh); assert.equal(await editor(fresh).innerText(), gateCode);
  results.exchanges.push({ purpose: 'constraints: clean-context reload', url: reloadedResponse.url(), method: 'GET', status: reloadedResponse.status(), body: reloadedBody });
  await screenshot('constraints-clean-context-server-snippet', fresh); await clean.close();
  pass('constraints: unique UI-saved snippet is read from server by a separate empty context and survives its reload', { title: gateTitle, id: gate.body.id, code: gateCode });

  const good = 'scope-control: eval Function WebAssembly Worker import';
  await run("<!doctype html><html><body><p>scope-control: eval Function WebAssembly Worker import</p><script>\n// eval Function WebAssembly Worker import are ordinary comment words\nconsole.log('scope-control-log', 'eval Function WebAssembly Worker import');\n</script></body></html>", 'scope-control.html'); await complete(); await marker(good);
  assert.match(await page.getByRole('log').innerText(), /scope-control-log/);
  for (const [name, attempt] of [
    ['eval', "eval('1 + 1');"],
    ['Function', "new Function('return 2')();"],
    ['WebAssembly', 'new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));'],
    ['Worker', "new Worker('data:text/javascript,postMessage(1)');"],
    ['dynamic import', "import('data:text/javascript,export const answer = 1');"]
  ]) {
    await page.getByRole('button', { name: 'Clear console', exact: true }).click();
    await run(attempt);
    await page.locator('.entry.error').filter({ hasText: 'outside this playground' }).waitFor();
    await marker(good);
    assert.doesNotMatch(await page.getByRole('status').innerText(), /^Complete/);
    pass(`unsupported ${name}: clear refusal and prior successful preview retained`, { input: attempt, feedback: await page.getByRole('log').innerText() });
  }
  await screenshot('unsupported-refusal-keeps-preview');
  await run("document.body.innerHTML='<p>ordinary recovery works</p>';console.log('ordinary recovery works');"); await complete(); await marker('ordinary recovery works');
  pass('ordinary JavaScript still works after all five unsupported-mode refusals');

  const caseTitle = prefix + ' Case';
  await newDraft(caseTitle, "console.log('Upper-case title body');"); const upper = await save(); assert.equal(upper.status, 201);
  await newDraft(caseTitle.toLowerCase(), "console.log('Lower-case title body');"); const lower = await save(); assert.equal(lower.status, 201);
  assert.notEqual(upper.body.id, lower.body.id);
  const cases = await read(gate.url);
  assert.deepEqual(cases.body.find(item => item.id === upper.body.id), upper.body);
  assert.deepEqual(cases.body.find(item => item.id === lower.body.id), lower.body);
  pass('case-sensitive distinct titles are both accepted and keep independent source records');

  await newDraft(prefix + ' Rename', "console.log('stored-rename-source');", 'rename.js'); const original = await save(); assert.equal(original.status, 201);
  const second = await context.newPage(); dialogs(second); await second.goto(base); await editor(second).waitFor(); await load(original.body.title, second);
  await source("console.log('dirty-stale-rename-buffer');", second);
  const firstRename = await rename(prefix + ' Renamed Current'); assert.equal(firstRename.status, 200);
  const stale = await rename(prefix + ' Stale Rename Refused', second); assert.equal(stale.status, 409); assert.equal(stale.body.code, 'REVISION_CONFLICT');
  await second.getByRole('alert').waitFor(); assert.equal(await editor(second).innerText(), "console.log('dirty-stale-rename-buffer');");
  assert.equal(await second.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), original.body.title);
  assert.deepEqual((await read(firstRename.url)).body, firstRename.body);
  await screenshot('stale-rename-preserves-draft', second);
  await second.getByRole('button', { name: 'Reload latest', exact: true }).click(); await second.getByRole('button', { name: 'Restore previous draft', exact: true }).waitFor();
  const recovery = await rename(prefix + ' Rename Recovered', second); assert.equal(recovery.status, 200); assert.equal(recovery.body.code, original.body.code); assert.equal(recovery.body.filename, original.body.filename); assert.equal(recovery.body.revision, firstRename.body.revision + 1);
  assert.deepEqual((await read(recovery.url)).body, recovery.body); await second.close();
  pass('stale UI rename refuses without mutation or draft loss; latest-revision rename then succeeds');

  for (const kind of ['saved load', 'example', 'new', 'import']) {
    const title = prefix + ' Dirty ' + kind;
    const storedCode = `console.log('stored ${kind}');`;
    await newDraft(title, storedCode, 'dirty-control.js'); const saved = await save(); assert.equal(saved.status, 201);
    const dirtyCode = `console.log('unsaved ${kind} must survive cancellation');`;
    await source(dirtyCode);
    const dirtyTitle = title + ' Edited', dirtyFilename = 'dirty-' + kind.replaceAll(' ', '-') + '-changed.js';
    await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(dirtyTitle);
    await page.getByRole('textbox', { name: 'Filename', exact: true }).fill(dirtyFilename);
    const trigger = async () => {
      if (kind === 'saved load') await load(gateTitle);
      if (kind === 'example') await page.getByRole('combobox', { name: 'Starter example', exact: true }).selectOption('counter.html');
      if (kind === 'new') await page.getByRole('button', { name: 'New', exact: true }).click();
      if (kind === 'import') await page.getByLabel('Import file', { exact: true }).setInputFiles({ name: 'dirty-import.JS', mimeType: 'text/javascript', buffer: Buffer.from("console.log('accepted-import-source');") });
    };
    const beforeCancel = results.dialogs.length; dialogAccept = false; await trigger();
    assert.equal(results.dialogs.length, beforeCancel + 1); assert.equal(results.dialogs.at(-1).type, 'confirm'); assert.match(results.dialogs.at(-1).message, /Discard unsaved changes/);
    assert.equal(await editor(page).innerText(), dirtyCode); assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), dirtyTitle);
    assert.equal(await page.getByRole('textbox', { name: 'Filename', exact: true }).inputValue(), dirtyFilename);
    assert.deepEqual((await read(saved.url + '/' + saved.body.id)).body, saved.body);
    dialogAccept = true; const beforeAccept = results.dialogs.length; await trigger(); assert.equal(results.dialogs.length, beforeAccept + 1);
    if (kind === 'saved load') assert.equal(await editor(page).innerText(), gateCode);
    if (kind === 'example') { await page.waitForFunction(() => document.querySelector('[aria-label="Filename"]')?.value === 'counter.html'); assert.match(await editor(page).innerText(), /button|counter/i); }
    if (kind === 'new') assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), 'Untitled');
    if (kind === 'import') { await page.waitForFunction(() => document.querySelector('[aria-label="Filename"]')?.value === 'dirty-import.JS'); assert.equal(await editor(page).innerText(), "console.log('accepted-import-source');"); }
    assert.deepEqual((await read(saved.url + '/' + saved.body.id)).body, saved.body);
    pass(`dirty ${kind}: cancel preserves draft; explicit discard proceeds; saved record unchanged`);
  }

  dialogAccept = true;
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await run("document.body.innerHTML='<p>import-good-preview</p>';console.log('import-good-log');"); await complete(); await marker('import-good-preview');
  await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(prefix + ' Import Preview Control');
  assert.equal((await save()).status, 201);
  const importedCode = "document.body.innerHTML='<p>import-executed-marker</p>';\nconsole.log('import-executed-log');";
  await page.getByLabel('Import file', { exact: true }).setInputFiles({ name: 'import-me.JS', mimeType: 'text/javascript', buffer: Buffer.from(importedCode) });
  await page.waitForFunction(() => document.querySelector('[aria-label="Filename"]')?.value === 'import-me.JS');
  assert.equal(await editor(page).innerText(), importedCode);
  await page.waitForTimeout(2100); await marker('import-good-preview'); assert.equal((await page.getByRole('log').innerText()).includes('import-executed-log'), false);
  await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('import-executed-marker'); assert.match(await page.getByRole('log').innerText(), /import-executed-log/);
  await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(prefix + ' Imported File');
  const imported = await save(); assert.equal(imported.status, 201);
  await page.reload(); await editor(page).waitFor(); await load(imported.body.title);
  assert.equal(await editor(page).innerText(), importedCode);
  await page.getByLabel('Import file', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('unrelated text') });
  await page.locator('.entry.error').filter({ hasText: 'Import a .js' }).waitFor();
  assert.equal(await editor(page).innerText(), importedCode);
  assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), imported.body.title);
  assert.equal(await page.getByRole('textbox', { name: 'Filename', exact: true }).inputValue(), 'import-me.JS');
  const updatedImport = await save(); assert.equal(updatedImport.status, 200);
  const observedUpdate = results.exchanges.at(-1);
  for (const invalidFilename of ['unsupported.txt', 'nested/demo.js']) {
    const body = { ...observedUpdate.request, filename: invalidFilename, revision: updatedImport.body.revision };
    const refused = await page.evaluate(async ({ url, body }) => { const response = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }, { url: observedUpdate.url, body });
    results.exchanges.push({ purpose: 'import filename server rejection', url: observedUpdate.url, method: 'PUT', request: body, ...refused });
    assert.equal(refused.status, 400); assert.equal(refused.body.code, 'INVALID_SNIPPET');
    assert.deepEqual((await read(observedUpdate.url)).body, updatedImport.body);
  }
  await source("console.log('import-edited-body');"); const editedImport = await save(); assert.equal(editedImport.status, 200);
  await page.reload(); await editor(page).waitFor(); await load(imported.body.title); assert.equal(await editor(page).innerText(), "console.log('import-edited-body');");
  pass('uppercase .JS import: auto-off waits, manual Run executes, save/reload succeeds, invalid import/server filenames refuse, valid edit saves afterward');
  await screenshot('import-manual-run');

  await newDraft(prefix + ' Native Leave', "console.log('stored-native-leave');"); const nativeControl = await save(); assert.equal(nativeControl.status, 201);
  const beforeCleanReload = results.dialogs.length;
  await page.reload(); await editor(page).waitFor(); await load(nativeControl.body.title);
  assert.equal(results.dialogs.length, beforeCleanReload);
  await source("console.log('native-unsaved-draft');"); dialogAccept = false;
  const beforeReload = results.dialogs.length;
  await page.reload({ timeout: 5000 }).catch(error => { assert.match(error.message, /ERR_ABORTED|Timeout 5000ms exceeded/); });
  assert.equal(results.dialogs.length, beforeReload + 1); assert.equal(results.dialogs.at(-1).type, 'beforeunload'); assert.equal(await editor(page).innerText(), "console.log('native-unsaved-draft');");
  dialogAccept = true; await page.reload(); await editor(page).waitFor(); await load(nativeControl.body.title); assert.equal(await editor(page).innerText(), nativeControl.body.code);
  pass('native reload warning: clean reload has no warning; dirty cancellation preserves source and accepted reload restores saved source');
  assert.deepEqual(results.browser_errors, []);
  results.passed = true;
}
main().catch(async error => { results.passed = false; results.error = error.stack; console.error(error); if (page) { results.failure_body = await page.locator('body').innerText().catch(() => 'unavailable'); await screenshot('failure').catch(() => {}); } process.exitCode = 1; }).finally(async () => { results.finished_at = new Date().toISOString(); fs.writeFileSync(path.join(__dirname, 'golden-browser-results.json'), JSON.stringify(results, null, 2)); if (browser) await browser.close(); });
