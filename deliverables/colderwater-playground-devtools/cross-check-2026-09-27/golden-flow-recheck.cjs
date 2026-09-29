const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const output = '/work';
const report = { scope: 'Independent final-archive browser flow; no LLM judge', started_at: new Date().toISOString(), checks: [], pageErrors: [] };
let browser, page;
const fields = (p = page) => ({ title: p.getByRole('textbox', { name: 'Snippet title', exact: true }), filename: p.getByRole('textbox', { name: 'Filename', exact: true }), editor: p.getByRole('textbox', { name: 'Code editor', exact: true }) });
const frame = () => page.frameLocator('iframe[title="Live preview"]');
const logs = () => page.getByRole('log').innerText();
const complete = () => page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'), null, { timeout: 8000 });
async function source(code, p = page) { await fields(p).editor.click(); await p.keyboard.press('Control+A'); await p.keyboard.insertText(code); }
async function run(code, filename = 'crosscheck.js') { await fields().filename.fill(filename); await source(code); await page.getByRole('button', { name: /^Run/ }).click(); }
async function good(marker) { await run(`document.body.textContent=${JSON.stringify(marker)};console.log(${JSON.stringify(marker)});`); await complete(); await frame().getByText(marker, { exact: true }).waitFor(); }
async function state(p = page) { return { title: await fields(p).title.inputValue(), filename: await fields(p).filename.inputValue(), code: await fields(p).editor.innerText() }; }
function attach(p) { p.on('dialog', d => d.accept()); p.on('pageerror', e => report.pageErrors.push(e.message)); }
async function check(id, fn) { const details = await fn(); report.checks.push({ id, passed: true, ...details }); console.log('PASS ' + id); }
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' });
  report.chromium = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); attach(page);
  await page.goto('http://localhost:3000'); await fields().editor.waitFor(); await complete();
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await check('final_archive_served_assets', async () => {
    const urls = await page.evaluate(() => [...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e => e.src || e.href));
    const files = {};
    for (const url of urls) { const response = await context.request.get(url); assert(response.ok()); files[new URL(url).pathname] = crypto.createHash('sha256').update(await response.body()).digest('hex'); }
    assert.equal(files['/assets/index-BEJFu1NO.js'], '8fcc61a9a431ad6ed70a08be24829bbbf0b3aa4966edc64d31608f56e8e13172');
    assert.equal(files['/assets/index-C_1hOHr1.css'], 'cbfa10c893727b30ffa575ebe5befb26043074162af99b24384c2864fe58b05d');
    return { files };
  });
  let saved;
  await check('gates_clean_context_then_original_page', async () => {
    assert((await context.request.get('http://localhost:3000/api/health')).ok());
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await fields().title.fill('CW gate Crosscheck ' + Date.now());
    await good('crosscheck-shared-source');
    const before = await state();
    const responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/snippets'));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const response = await responsePromise; assert.equal(response.status(), 201); saved = await response.json();
    assert.deepEqual({ title: saved.title, filename: saved.filename, code: saved.code }, before);
    const fresh = await browser.newContext(); assert.deepEqual(await fresh.storageState(), { cookies: [], origins: [] });
    const second = await fresh.newPage(); attach(second);
    let readCount = 0;
    second.on('response', r => { if (r.url().includes('/api/snippets') && r.request().method() === 'GET') readCount++; });
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) await second.goto('http://localhost:3000'); else await second.reload();
      await fields(second).editor.waitFor();
      await second.locator('.snippetlist button').filter({ hasText: saved.title }).click();
      assert.deepEqual(await state(second), before);
      const fetched = await second.evaluate(async id => (await fetch('/api/snippets/' + id)).json(), saved.id);
      assert.deepEqual(fetched, saved);
    }
    assert(readCount >= 2); await fresh.close(); await page.bringToFront();
    await good('after-independent-context');
    return { savedIdentity: saved.id, readCount, cleanContextReloadExact: true, originalPageStillUsable: true };
  });
  await check('cancellation_and_stop_after_library_work', async () => {
    await good('crosscheck-stable-before-A'); await page.getByRole('button', { name: 'Clear console', exact: true }).click();
    const aStart = Date.now();
    await run("window.__cancelLeak='A';document.body.textContent='crosscheck-candidate-A';console.log('crosscheck-A-start');setTimeout(()=>console.log('crosscheck-A-delayed'),4000);");
    await page.getByRole('log').getByText('crosscheck-A-start', { exact: true }).waitFor();
    assert.match(await page.getByRole('status').innerText(), /Running|Waiting for asynchronous/i);
    await run("document.body.textContent='crosscheck-B-'+typeof window.__cancelLeak;console.log('crosscheck-B-start');");
    const supersededAt = Date.now() - aStart; assert(supersededAt < 4000); await complete();
    await page.waitForTimeout(Math.max(0, 6100 - (Date.now() - aStart)));
    await frame().getByText('crosscheck-B-undefined', { exact: true }).waitFor();
    assert(!(await logs()).includes('crosscheck-A-delayed')); assert.match(await page.getByRole('status').innerText(), /^Complete/);
    const stopStart = Date.now();
    await run("document.body.textContent='crosscheck-stop-candidate';console.log('crosscheck-stop-start');setTimeout(()=>console.log('crosscheck-stop-late'),4000);");
    await page.getByRole('log').getByText('crosscheck-stop-start', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const stopFeedback = await page.getByRole('status').innerText(); assert.match(stopFeedback, /cancel|stop/i);
    await page.waitForTimeout(Math.max(0, 4300 - (Date.now() - stopStart)));
    await frame().getByText('crosscheck-B-undefined', { exact: true }).waitFor();
    assert(!(await logs()).includes('crosscheck-stop-late')); assert.match(await page.getByRole('status').innerText(), /cancel|stop/i);
    await good('crosscheck-post-stop-recovery');
    return { supersededAt, checkedOldDomAndStatusAfterTimer: true, stopFeedback, stopRetainedRollbackAfterTimer: true, recovered: true };
  });
  await check('four_independent_error_paths_after_cancel', async () => {
    const results = [];
    const cases = [
      { name: 'js', file: 'bad.js', code: "document.body.textContent='failed-partial-dom';\nconst marker=1;\nconst items=[1,2,3];\nitems.forEeach(n=>n);", marker: 'forEeach', line: 4 },
      { name: 'html', file: 'bad.html', code: '<!doctype html>\n<html>\n<body>\n<h1>Failed HTML candidate</h1>\n<script>\nundefinedFunctionCall();\n</script>\n</body>\n</html>', marker: 'undefinedFunctionCall', line: 6 },
      { name: 'timer', file: 'delayed-error.js', code: "document.body.textContent='async-failed-candidate';\nsetTimeout(()=>{throw new Error('async-error-marker');},50);", marker: 'async-error-marker', line: 2 },
      { name: 'promise', file: 'rejected-promise.js', code: "document.body.textContent='promise-failed-candidate';\nPromise.reject(new Error('promise-error-marker'));", marker: 'promise-error-marker', line: 2 }
    ];
    for (const c of cases) {
      await good('crosscheck-' + c.name + '-good'); await page.getByRole('button', { name: 'Clear console', exact: true }).click();
      await run(c.code, c.file);
      await page.locator('.entry.error').filter({ hasText: c.marker }).waitFor({ timeout: 8000 });
      const error = await page.locator('.entry.error').filter({ hasText: c.marker }).innerText();
      assert.match(error, new RegExp('line ' + c.line + '\\b', 'i'));
      await frame().getByText('crosscheck-' + c.name + '-good', { exact: true }).waitFor();
      await good('crosscheck-' + c.name + '-recovered');
      results.push({ name: c.name, userLine: c.line, error, rollback: true, recovery: true });
    }
    return { results };
  });
  await check('private_paths_keep_public_workspace_usable', async () => {
    const probes = [];
    for (const path of ['/app.db', '/server.js', '/package.json']) {
      const result = await page.evaluate(async path => { const r = await fetch(path); const bytes = new Uint8Array(await r.arrayBuffer()); return { path, status: r.status, length: bytes.length, text: new TextDecoder().decode(bytes) }; }, path);
      assert.equal(result.status, 404); assert.equal(result.text, '{"error":"Not found."}'); delete result.text; probes.push(result);
    }
    await good('crosscheck-after-private-requests');
    return { probes, recovered: true };
  });
  await check('final_theme_and_mobile_after_prior_failures', async () => {
    const snapshot = { ...await state(), preview: await frame().locator('body').innerText(), console: await logs() };
    const observations = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (let theme = 0; theme < 2; theme++) {
        await page.getByRole('button', { name: /^Run/ }).hover();
        const colors = await page.getByRole('button', { name: /^Run/ }).evaluate(e => {
          const s = getComputedStyle(e), luminance = v => { const values = v.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722; };
          const a = luminance(s.color), b = luminance(s.backgroundColor); return { theme: document.documentElement.dataset.theme, fg: s.color, bg: s.backgroundColor, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), documentWidth: document.documentElement.scrollWidth };
        });
        assert(colors.contrast >= 4.5); assert(colors.documentWidth <= width);
        assert.deepEqual({ ...await state(), preview: await frame().locator('body').innerText(), console: await logs() }, snapshot);
        await page.screenshot({ path: `${output}/crosscheck-${width}-${colors.theme}.png`, fullPage: true });
        observations.push({ width, ...colors });
        await page.getByRole('button', { name: /^(Light|Dark) theme$/ }).click();
      }
    }
    await good('crosscheck-mobile-run'); await page.locator('.preview').scrollIntoViewIfNeeded();
    await page.screenshot({ path: output + '/crosscheck-mobile-live-preview.png' });
    await page.getByRole('button', { name: 'Clear console', exact: true }).click();
    assert.equal(await page.locator('.entry').count(), 0); assert.match(await logs(), /Console is clear/);
    const record = await page.evaluate(async id => (await fetch('/api/snippets/' + id)).json(), saved.id); assert.deepEqual(record, saved);
    return { observations, mobileRunAndClear: true, originalSavedRecordUnaffectedByAllExperiments: true };
  });
  assert.deepEqual(report.pageErrors, []); report.passed = true;
}
main().catch(async error => { report.passed = false; report.error = error.stack; console.error(error); if (page) await page.screenshot({ path: output + '/crosscheck-failure.png', fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => { report.finished_at = new Date().toISOString(); fs.writeFileSync(output + '/golden-flow-results.json', JSON.stringify(report, null, 2)); if (browser) await browser.close(); });
