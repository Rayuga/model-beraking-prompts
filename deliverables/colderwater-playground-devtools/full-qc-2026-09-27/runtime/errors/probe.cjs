const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = { started_at: new Date().toISOString(), checks: [], browser_errors: [] };
let browser, page;
const out = path.join(__dirname, 'independent-runtime-evidence'); fs.mkdirSync(out, { recursive: true });
const editor = () => page.getByRole('textbox', { name: 'Code editor', exact: true });
async function run(code, filename) { await page.getByRole('textbox', { name: 'Filename', exact: true }).fill(filename); await editor().click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(code); await page.getByRole('button', { name: /^Run/ }).click(); }
async function complete() { await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'), null, { timeout: 10000 }); }
async function marker(value) { await page.frameLocator('iframe[title="Live preview"]').getByText(value, { exact: true }).waitFor({ timeout: 10000 }); }
function pass(name, detail = {}) { results.checks.push({ name, passed: true, ...detail }); console.log('PASS ' + name); }
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' });
  results.chromium_version = browser.version(); assert.match(results.chromium_version, /^152\./);
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => results.browser_errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto('http://localhost:3000'); await editor().waitFor(); await complete();
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await run("// eval Function WebAssembly Worker import are ordinary words\ndocument.body.innerHTML='<p>safe words in JavaScript</p>';console.log('eval Function WebAssembly Worker import are words');", 'safe-words.js');
  await complete(); await marker('safe words in JavaScript'); assert.match(await page.getByRole('log').innerText(), /eval Function WebAssembly Worker import are words/);
  await run('<!doctype html><html><body><p>eval Function WebAssembly Worker import are ordinary HTML text</p><script>console.log("safe HTML still executes");</script></body></html>', 'safe-words.html');
  await complete(); await marker('eval Function WebAssembly Worker import are ordinary HTML text'); assert.match(await page.getByRole('log').innerText(), /safe HTML still executes/);
  pass('unsupported feature names remain valid in ordinary comments, JavaScript strings and HTML text');
  for (const [name, code, error, line] of [
    ['bad.js', "document.body.innerHTML='<p>failed-partial-dom</p>';\nconst marker = 1;\nconst items = [1, 2, 3];\nitems.forEeach((n) => n);", 'forEeach', 4],
    ['bad.html', '<!doctype html>\n<html>\n<body>\n<h1>Failed HTML candidate</h1>\n<script>\nundefinedFunctionCall();\n</script>\n</body>\n</html>', 'undefinedFunctionCall', 6],
    ['delayed-error.js', "document.body.innerHTML='<p>async-failed-candidate</p>';\nsetTimeout(() => { throw new Error('async-error-marker'); }, 50);", 'async-error-marker', 2],
    ['rejected-promise.js', "document.body.innerHTML='<p>promise-failed-candidate</p>';\nPromise.reject(new Error('promise-error-marker'));", 'promise-error-marker', 2]
  ]) {
    const good = 'independent control ' + name, recovery = 'independent recovery ' + name;
    await run(`document.body.textContent=${JSON.stringify(good)};console.log(${JSON.stringify(good)});`, 'control.js'); await complete(); await marker(good);
    await page.getByRole('button', { name: 'Clear console', exact: true }).click();
    await run(code, name); await page.getByRole('log').getByText(new RegExp(`${error}.*line ${line}`)).waitFor(); await marker(good);
    const feedback = await page.getByRole('log').innerText();
    await page.screenshot({ path: path.join(out, name.replace('.', '-') + '-rollback.png'), fullPage: true });
    await run(`document.body.textContent=${JSON.stringify(recovery)};console.log(${JSON.stringify(recovery)});`, 'recovery.js'); await complete(); await marker(recovery);
    pass(`${name}: its own good preview, exact user line ${line}, rollback and independent recovery`, { filename: name, source: code, feedback });
  }
  assert.deepEqual(results.browser_errors, []); results.passed = true;
}
main().catch(async error => { results.passed = false; results.error = error.stack; console.error(error); if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); process.exitCode = 1; }).finally(async () => { results.finished_at = new Date().toISOString(); fs.writeFileSync(path.join(__dirname, 'independent-runtime-results.json'), JSON.stringify(results, null, 2)); if (browser) await browser.close(); });
