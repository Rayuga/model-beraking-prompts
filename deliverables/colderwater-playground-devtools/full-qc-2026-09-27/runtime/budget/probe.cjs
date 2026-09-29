const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const result = { started_at: new Date().toISOString(), checks: [], dialogs: [] };
let browser, page, accept = true;
const prefix = 'Shared budget ' + Date.now().toString(36);
async function source(code) { const editor = page.getByRole('textbox', { name: 'Code editor', exact: true }); await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(code); }
async function complete() { await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'), null, { timeout: 10000 }); }
const marker = value => page.frameLocator('iframe[title="Live preview"]').getByText(value, { exact: true }).waitFor({ timeout: 10000 });
function pass(name) { result.checks.push({ name, passed: true }); console.log('PASS ' + name); }
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' }); result.chromium_version = browser.version(); assert.match(result.chromium_version, /^152\./);
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('dialog', async dialog => { result.dialogs.push({ type: dialog.type(), message: dialog.message(), accepted: accept }); if (accept) await dialog.accept(); else await dialog.dismiss(); });
  await page.goto('http://localhost:3000'); await page.getByRole('textbox', { name: 'Code editor', exact: true }).waitFor(); await complete();
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(prefix);
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('shared-budget.js');
  const goodCode = "document.body.innerHTML='<p>shared-good-preview</p>';console.log('shared-good-log');";
  await source(goodCode);
  const savedPromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/snippets'));
  await page.getByRole('button', { name: 'Save', exact: true }).click(); const savedResponse = await savedPromise; assert.equal(savedResponse.status(), 201); const saved = await savedResponse.json();
  const changedTitle = prefix + ' only-title-changed'; await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(changedTitle);
  assert.match(await page.locator('.editor .paneheading').first().innerText(), /Unsaved changes/);
  accept = false; const before = result.dialogs.length; await page.getByRole('button', { name: 'New', exact: true }).click();
  assert.equal(result.dialogs.length, before + 1); assert.match(result.dialogs.at(-1).message, /Discard unsaved/);
  assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), changedTitle);
  assert.equal(await page.getByRole('textbox', { name: 'Filename', exact: true }).inputValue(), saved.filename);
  assert.equal(await page.getByRole('textbox', { name: 'Code editor', exact: true }).innerText(), saved.code);
  const reread = await page.evaluate(async url => (await fetch(url)).json(), savedResponse.url() + '/' + saved.id); assert.deepEqual(reread, saved);
  pass('title-only dirty edit triggers warning; cancel preserves exact edited title and unchanged filename/source');
  accept = true; await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(saved.title);
  await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('shared-good-preview');
  await page.getByRole('button', { name: 'Clear console', exact: true }).click();
  const runaway = "document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); while (true) {} }, 4000);";
  await source(runaway); const started = Date.now(); await page.getByRole('button', { name: /^Run/ }).click(); await marker('failed-loop-candidate');
  await page.getByRole('log').getByText('late-callback-entered', { exact: true }).waitFor({ timeout: 7000 });
  result.callback_entered_ms = Date.now() - started;
  await page.locator('.entry.error').filter({ hasText: 'time limit' }).waitFor({ timeout: 4500 });
  result.terminated_ms_from_original_run = Date.now() - started;
  assert.ok(result.callback_entered_ms >= 3900);
  assert.ok(result.terminated_ms_from_original_run < 8000, 'callback must not receive a fresh five-second budget');
  await marker('shared-good-preview');
  result.runaway_source = runaway; result.console_after_timeout = await page.getByRole('log').innerText();
  await page.screenshot({ path: '/work/browser-evidence/four-second-callback-shared-budget.png', fullPage: true });
  await page.locator('.snippetlist button').filter({ hasText: saved.title }).first().click();
  assert.equal(await page.getByRole('textbox', { name: 'Code editor', exact: true }).innerText(), saved.code);
  await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('shared-good-preview');
  const storedAgain = await page.evaluate(async url => (await fetch(url)).json(), savedResponse.url() + '/' + saved.id); assert.deepEqual(storedAgain, saved);
  pass('4-second delayed runaway uses original shared budget, rolls back, and saved snippet reload/run recovers unchanged');
  result.passed = true;
}
main().catch(error => { result.passed = false; result.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => { result.finished_at = new Date().toISOString(); fs.writeFileSync('/work/title-and-shared-budget-results.json', JSON.stringify(result, null, 2)); if (browser) await browser.close(); });
