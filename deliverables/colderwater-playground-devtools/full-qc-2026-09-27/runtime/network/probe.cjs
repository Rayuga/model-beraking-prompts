const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const result = { started_at: new Date().toISOString(), checks: [], delivered_requests: [], browser_errors: [] };
let browser, page, control, context;
const nonce = Date.now().toString(36);
const textURL = `https://cw-qc-network.invalid/fetch.txt?nonce=${nonce}`;
const imageURL = `https://cw-qc-network.invalid/image.svg?nonce=${nonce}`;
const token = 'route-control-' + nonce;
async function source(code) { const editor = page.getByRole('textbox', { name: 'Code editor', exact: true }); await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(code); }
async function complete() { await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent.startsWith('Complete'), null, { timeout: 10000 }); }
const marker = value => page.frameLocator('iframe[title="Live preview"]').getByText(value, { exact: true }).waitFor({ timeout: 10000 });
function pass(name) { result.checks.push({ name, passed: true }); console.log('PASS ' + name); }
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium' }); result.chromium_version = browser.version(); assert.match(result.chromium_version, /^152\./);
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('https://cw-qc-network.invalid/**', async route => {
    const url = route.request().url(); result.delivered_requests.push({ url, method: route.request().method(), at: new Date().toISOString() });
    const isImage = new URL(url).pathname === '/image.svg';
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store', 'content-type': isImage ? 'image/svg+xml' : 'text/plain' }, body: isImage ? '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="green"/></svg>' : token });
  });
  control = await context.newPage(); assert.equal(control.url(), 'about:blank');
  result.unprotected_control = await control.evaluate(async ({ textURL, imageURL }) => {
    const text = await (await fetch(textURL)).text();
    const width = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = () => reject(new Error('Control image did not load')); image.src = imageURL; });
    return { text, width };
  }, { textURL, imageURL });
  assert.equal(result.unprotected_control.text, token); assert.ok(result.unprotected_control.width > 0); assert.equal(result.delivered_requests.length, 2);
  result.positive_control_count = result.delivered_requests.length;
  pass('unprotected about:blank control loads locally fulfilled fetch text and image, proving both resources and CORS work');
  page = await context.newPage(); page.on('dialog', dialog => dialog.accept()); page.on('pageerror', error => result.browser_errors.push(error.message));
  await page.goto('http://localhost:3000'); await page.getByRole('textbox', { name: 'Code editor', exact: true }).waitFor(); await complete();
  await page.getByRole('checkbox', { name: 'Auto-run', exact: true }).uncheck();
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('network.js');
  await source("document.body.innerHTML='<p>network-good-control</p>';console.log('network-good-control-log');"); await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('network-good-control');
  const probes = [
    { mode: 'fetch', blocked: 'network fetch refused', marker: 'network-guard-fetch', source: `document.body.textContent = 'network-guard-fetch';\nfetch(${JSON.stringify(textURL)}).then(response => response.text()).then(text => console.log('EXTERNAL_FETCH_LOADED', text)).catch(() => console.warn('network fetch refused'));` },
    { mode: 'image', blocked: 'network image refused', marker: 'network-guard-image', source: `document.body.textContent = 'network-guard-image';\nconst image = new Image();\nimage.onload = () => console.log('EXTERNAL_IMAGE_LOADED', image.naturalWidth);\nimage.onerror = () => console.warn('network image refused');\nimage.src = ${JSON.stringify(imageURL)};\ndocument.body.appendChild(image);` }
  ];
  result.preview_probes = probes;
  result.console_after_preview_attempts = {};
  for (const probe of probes) {
    await source(probe.source); await page.getByRole('button', { name: /^Run/ }).click();
    await page.getByRole('log').getByText(probe.blocked, { exact: true }).waitFor();
    await complete(); await page.waitForTimeout(1200);
    const feedback = await page.getByRole('log').innerText(); result.console_after_preview_attempts[probe.mode] = feedback;
    assert.doesNotMatch(feedback, /EXTERNAL_FETCH_LOADED|EXTERNAL_IMAGE_LOADED/);
    assert.equal(result.delivered_requests.length, result.positive_control_count, `${probe.mode} preview request must not reach the route handler`);
    await marker(probe.marker);
  }
  pass('separate preview fetch and image runs are both refused before delivery, with caught-error feedback and legitimate own DOM retained');
  await page.screenshot({ path: '/work/browser-evidence/network-refusal-with-working-control.png', fullPage: true });
  await source("document.body.textContent='network-recovery-works';console.log('network-recovery-log');"); await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('network-recovery-works');
  assert.match(await page.getByRole('log').innerText(), /network-recovery-log/);
  assert.equal(result.delivered_requests.length, 2);
  pass('ordinary DOM and console recovery works while external route counts remain unchanged');
  await source("document.body.innerHTML='<p>isolation-control</p>';console.log('isolation-control-log');"); await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('isolation-control');
  result.origin_before = await page.evaluate(() => ({ title: document.title, value: localStorage.getItem('cw-isolation-probe') }));
  const isolation = "let docRead='not-blocked', docWrite='not-blocked', storageRead='not-blocked', storageWrite='not-blocked';\ntry { const value=parent.document.title; } catch (error) { docRead='blocked'; }\ntry { parent.document.title='cw-forbidden-title'; } catch (error) { docWrite='blocked'; }\ntry { const value=parent.localStorage.getItem('cw-isolation-probe'); } catch (error) { storageRead='blocked'; }\ntry { parent.localStorage.setItem('cw-isolation-probe','changed'); } catch (error) { storageWrite='blocked'; }\ndocument.body.innerHTML='<p>isolation-'+docRead+'-'+docWrite+'-'+storageRead+'-'+storageWrite+'</p>';\nconsole.log('isolation-results',docRead,docWrite,storageRead,storageWrite);";
  await source(isolation); await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('isolation-blocked-blocked-blocked-blocked');
  result.origin_after = await page.evaluate(() => ({ title: document.title, value: localStorage.getItem('cw-isolation-probe') }));
  assert.deepEqual(result.origin_after, result.origin_before); result.origin_probe = isolation;
  await source("document.body.textContent='origin-recovery-works';console.log('origin-recovery-log');"); await page.getByRole('button', { name: /^Run/ }).click(); await complete(); await marker('origin-recovery-works');
  assert.match(await page.getByRole('log').innerText(), /origin-recovery-log/);
  pass('opaque origin blocks parent document read/write and storage read/write; host unchanged and ordinary recovery works');
  await context.unroute('https://cw-qc-network.invalid/**'); await control.close();
  assert.deepEqual(result.browser_errors, []); result.passed = true;
}
main().catch(async error => { result.passed = false; result.error = error.stack; console.error(error); if (page) await page.screenshot({ path: '/work/browser-evidence/network-failure.png', fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => { result.finished_at = new Date().toISOString(); fs.writeFileSync('/work/network-boundary-results.json', JSON.stringify(result, null, 2)); if (browser) await browser.close(); });
