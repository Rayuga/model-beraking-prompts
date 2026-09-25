const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report = {scope: 'Local unchanged golden solution in cached pellmoor-tests:2.0.3; not a platform score', assets: [], passed: false};
let browser;
async function main() {
  browser = await chromium.launch({executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3000');
  const assets = await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => ({url: node.src || node.href, kind: node.tagName === 'SCRIPT' ? 'script' : 'style'})));
  for (const asset of assets) {
    const response = await page.request.get(asset.url);
    const type = response.headers()['content-type'] || '';
    assert(response.ok());
    assert(asset.kind === 'script' ? /javascript/.test(type) : /text\/css/.test(type));
    assert(!/^\s*(?:<!doctype html|<html)/i.test(await response.text()));
    report.assets.push({...asset, status: response.status(), content_type: type});
  }
  await page.locator('#email').fill('hiring@pellmoor.test');
  await page.locator('#password').fill('password123');
  await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  await page.locator('#board .cand').first().waitFor();
  await page.locator('#board .cand').first().click();
  await page.locator('#panel').waitFor({state: 'visible'});
  assert((await page.locator('#panel').innerText()).trim().length > 30);
  await page.reload();
  await page.locator('#board .cand').first().waitFor();
  await page.locator('#board .cand').first().click();
  await page.locator('#panel').waitFor({state: 'visible'});
  assert.equal(errors.length, 0, errors.join('\n'));
  Object.assign(report, {login: true, populated_vacancy: true, candidate_opened: true, reload_and_reopen: true, fatal_browser_errors: errors, passed: true});
}
main().catch(error => { report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  fs.writeFileSync('/evidence/browser-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
});
