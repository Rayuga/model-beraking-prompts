const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const result = { started_at: new Date().toISOString(), checks: [], exchanges: [], dialogs: [] };
let browser, page;
let accept = true, answer = '';
const prefix = 'Boundary ' + Date.now().toString(36);
function pass(name) { result.checks.push({ name, passed: true }); console.log('PASS ' + name); }
async function fetchInPage(url, method = 'GET', body) {
  const response = await page.evaluate(async ({ url, method, body }) => { const response = await fetch(url, { method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; }, { url, method, body });
  result.exchanges.push({ url, method, request: body, ...response }); return response;
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' }); result.chromium_version = browser.version(); assert.match(result.chromium_version, /^152\./);
  page = await browser.newPage();
  page.on('dialog', async dialog => { result.dialogs.push({ type: dialog.type(), message: dialog.message(), accepted: accept }); if (accept) await dialog.accept(dialog.type() === 'prompt' ? answer : undefined); else await dialog.dismiss(); });
  await page.goto('http://localhost:3000'); const editor = page.getByRole('textbox', { name: 'Code editor', exact: true }); await editor.waitFor();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Snippet title', exact: true }).fill(prefix);
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('boundary.JS');
  await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText("console.log('untouched validation source');");
  const createPromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/api/snippets'));
  await page.getByRole('button', { name: 'Save', exact: true }).click(); const create = await createPromise; assert.equal(create.status(), 201);
  answer = prefix + ' Renamed';
  const renamePromise = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/api/snippets/'));
  await page.getByRole('button', { name: 'Rename', exact: true }).click(); const renamed = await renamePromise; assert.equal(renamed.status(), 200);
  const current = await renamed.json(), operation = { url: renamed.url(), method: renamed.request().method(), body: renamed.request().postDataJSON() };
  result.exchanges.push({ purpose: 'observed positive UI create and rename', ...operation, status: renamed.status(), response: current });
  for (const [name, change] of [['empty title', { title: '' }], ['whitespace title', { title: '   ' }], ['nested filename', { filename: 'nested/demo.js' }], ['unsupported filename extension', { filename: 'unsupported.txt' }]]) {
    const body = { ...operation.body, title: current.title, filename: current.filename, code: current.code, revision: current.revision, ...change };
    const refused = await fetchInPage(operation.url, operation.method, body); assert.equal(refused.status, 400); assert.equal(refused.body.code, 'INVALID_SNIPPET');
    const unchanged = await fetchInPage(operation.url); assert.equal(unchanged.status, 200); assert.deepEqual(unchanged.body, current);
    pass(name + ': current-revision request refuses without changing source, title, filename or revision');
  }
  const filename = page.getByRole('textbox', { name: 'Filename', exact: true }); await filename.fill('unsaved-filename.js');
  assert.match(await page.locator('.editor .paneheading').first().innerText(), /Unsaved changes/);
  accept = false; const before = result.dialogs.length; await page.getByRole('button', { name: 'New', exact: true }).click();
  assert.equal(result.dialogs.length, before + 1); assert.equal(result.dialogs.at(-1).type, 'confirm'); assert.match(result.dialogs.at(-1).message, /Discard unsaved/);
  assert.equal(await filename.inputValue(), 'unsaved-filename.js'); assert.equal(await editor.innerText(), current.code);
  assert.deepEqual((await fetchInPage(operation.url)).body, current);
  pass('filename-only dirty edit warns before navigation and cancel preserves the draft without saving it');
  accept = true; await page.getByRole('button', { name: 'New', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Snippet title', exact: true }).inputValue(), 'Untitled');
  assert.deepEqual((await fetchInPage(operation.url)).body, current);
  pass('explicit discard of filename-only edit opens New while saved record remains unchanged');
  result.passed = true;
}
main().catch(error => { result.passed = false; result.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => { result.finished_at = new Date().toISOString(); fs.writeFileSync('/work/validation-boundaries-results.json', JSON.stringify(result, null, 2)); if (browser) await browser.close(); });
