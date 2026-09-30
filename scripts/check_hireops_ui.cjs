'use strict';
// Local browser product evidence, not a configured verifier or hosted QC run.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, '.tools/hireops/node_modules/playwright'));
const app = path.join(root, 'projects/hireops-recruiting-operations/hireops-recruiting-operations/solution/app');
function sourceHashes(dir = app, found = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceHashes(file, found);
    else found[path.relative(app, file).replaceAll('\\', '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return found;
}
const sourceBefore = sourceHashes();
const output = path.resolve(process.argv[2] || path.join(root, 'qc/runs/hireops-2026-09-30-development/ui', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(output, { recursive: true });
const results = [];
const errors = [];
const port = Number(process.env.HIREOPS_UI_PORT || 3023);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(app, 'server.js')], {
  cwd: output, windowsHide: true,
  env: { ...process.env, NODE_PATH: path.join(root, '.tools/hireops/node_modules'), PORT: String(port), DB_PATH: path.join(output, 'ui.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const log = fs.createWriteStream(path.join(output, 'server.log'));
server.stdout.pipe(log); server.stderr.pipe(log);
let browser;
const record = (name, details = {}) => results.push({ name, passed: true, ...details });
async function main() {
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    if (server.exitCode !== null) throw new Error('Server exited before becoming ready');
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.HIREOPS_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const roleEmail = { recruiter: 'rafael.costa', approver: 'yuki.tanaka', finance: 'farah.nasser', auditor: 'aud.halvorsen' };
  async function login(role) {
    if (await page.locator('#logout').isVisible()) await page.locator('#logout').click();
    await page.locator('#email').fill(roleEmail[role] + '@hireops.example');
    await page.locator('#password').fill('Hireops!2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  }
  async function nav(name) { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); }
  const card = id => page.locator('article.entity').filter({ has: page.locator('h4 span').filter({ hasText: id }) }).first();
  const entity = id => page.locator('article.entity').filter({ has: page.locator('h4') }).filter({ hasText: id }).first();
  async function saved(id) {
    await page.waitForFunction(id => [...document.querySelectorAll('article.entity')].some(n => n.dataset.entity === id), id);
  }
  async function bootData() { return page.evaluate(async () => (await fetch('/api/bootstrap')).json()); }
  await page.goto(base);
  await login('recruiter');
  await page.locator('#theme-toggle').click();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  record('theme persists after reload');
  await nav('Requisitions');
  const reqId = '  req / ? # café  ';
  await page.locator('#req-id').fill(reqId);
  await page.locator('#req-title').fill('UI boundary requisition');
  await page.locator('#req-budget').fill('100000.01');
  await page.getByRole('button', { name: 'Create requisition', exact: true }).click();
  await saved(reqId);
  const req = (await bootData()).requisitions.find(r => r.id === reqId);
  assert.equal(req.budget_cents, 10000001);
  record('padded reserved-character requisition ID and exact cents saved', { id: req.id, budget_cents: req.budget_cents });
  await page.locator('#req-id').fill(reqId);
  await page.locator('#req-title').fill('Do not clear this rejected title');
  await page.getByRole('button', { name: 'Create requisition', exact: true }).click();
  await page.locator('#flash .error').waitFor();
  assert.equal(await page.locator('#req-title').inputValue(), 'Do not clear this rejected title');
  assert.equal(await page.locator('#req-id').inputValue(), reqId);
  await page.locator('#req-id').fill('recovered requisition');
  await page.getByRole('button', { name: 'Create requisition', exact: true }).click();
  await saved('recovered requisition');
  assert.equal((await bootData()).requisitions.find(r => r.id === 'recovered requisition').title, 'Do not clear this rejected title');
  record('requisition refusal retains entered fields and correction saves');
  await nav('Offers');
  const offerId = '  offer / ? # café  ';
  await page.locator('#off-id').fill(offerId);
  await page.locator('#off-req').selectOption(reqId);
  await page.locator('#off-cand').fill('UI precision candidate');
  await page.locator('#off-base').fill('50000.01');
  await page.locator('#off-sign').fill('101.01');
  await page.locator('#off-rel').fill('2.99');
  await page.locator('#off-units').fill('7');
  await page.locator('#off-fair').fill('1.50');
  await page.locator('#off-strike').fill('1.00');
  await page.locator('#off-start').fill('2026-02-30');
  await page.getByRole('button', { name: 'Create offer', exact: true }).click();
  await page.locator('#flash .error').waitFor();
  assert.equal(await page.locator('#off-base').inputValue(), '50000.01');
  assert.equal((await bootData()).offers.some(o => o.id === offerId), false);
  await page.locator('#off-start').fill('2026-01-31T12:30:00.125Z');
  await page.getByRole('button', { name: 'Create offer', exact: true }).click();
  await saved(offerId);
  const offer = (await bootData()).offers.find(o => o.id === offerId);
  assert.equal(offer.start_date, '2026-01-31T12:30:00.125Z');
  assert.equal(offer.composition.base_salary_cents, 5000001);
  record('invalid date rejected, draft retained, UTC millisecond instant saved');
  const breakdown = await page.locator('article.entity').evaluateAll((nodes, id) => nodes.find(n => n.dataset.entity === id).innerText, offerId);
  for (const label of ['base salary','signing bonus','relocation','equity units','fair value per unit','strike price per unit','equity intrinsic','equity annualized','committed run-rate','approval band basis','required tier']) assert.ok(breakdown.includes(label), 'Missing visible compensation field: '+label);
  for (const value of ['$50,000.01','$101.01','$2.99','7 units','$1.50','$1.00','$3.50','$0.88','$50,000.89','$50,051.40']) assert.ok(breakdown.includes(value), 'Missing together-view value: '+value);
  record('complete populated compensation breakdown in one readable view');
  assert.equal(await page.getByRole('button', { name: 'Approve ' + offerId, exact: true }).count(), 0);
  await login('approver');
  await nav('Offers');
  await page.getByRole('button', { name: 'Approve ' + offerId, exact: true }).click();
  await page.locator('#flash .ok').waitFor();
  assert.equal((await bootData()).offers.find(o => o.id === offerId).status, 'COMMITTED');
  record('approval round-trips arbitrary ID through encoded route');
  await login('recruiter');
  await nav('Offers');
  await page.getByRole('button', { name: 'Revise ' + offerId, exact: true }).click();
  assert.equal(await page.locator('input[name="base"]').evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Revise ' + offerId, exact: true }).evaluate(n => n === document.activeElement), true);
  await page.getByRole('button', { name: 'Revise ' + offerId, exact: true }).click();
  await page.locator('#detail-close').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button', { name: 'Apply revision', exact: true }).evaluate(n => n === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#detail-close').evaluate(n => n === document.activeElement), true);
  record('dialog initially focuses form, traps tab and returns focus on Escape');
  await page.locator('input[name="base"]').fill('200000.01');
  await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
  await page.locator('.drawer-form .error').filter({ hasText: /.+/ }).waitFor();
  const budgetError=await page.locator('.drawer-form .error').innerText();
  assert.ok(budgetError.includes('available headroom $100,000.01'), budgetError);
  assert.ok(budgetError.includes('shortfall $100,000.88'), budgetError);
  record('revision refusal shows available replacement budget and exact shortfall', {message:budgetError});
  assert.equal(await page.locator('input[name="base"]').inputValue(), '200000.01');
  assert.equal(await page.locator('#detail-backdrop').isVisible(), true);
  for (const [field, value] of Object.entries({signing:'101.01',relocation:'2.99',units:'7',fair:'1.50',strike:'1.00'}))
    assert.equal(await page.locator(`input[name="${field}"]`).inputValue(), value);
  record('over-budget revision remains open with error and entered amount');
  await page.locator('input[name="base"]').fill('51000.02');
  await page.locator('input[name="signing"]').fill('99.99');
  await page.locator('input[name="relocation"]').fill('3.14');
  await page.locator('input[name="units"]').fill('9');
  await page.locator('input[name="fair"]').fill('2.25');
  await page.locator('input[name="strike"]').fill('1.25');
  await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
  await page.locator('#detail-backdrop').waitFor({ state: 'hidden' });
  let revision = (await bootData()).offers.find(o => o.supersedes_id === offerId);
  assert.equal(revision.composition.signing_bonus_cents, 9999);
  assert.equal(revision.composition.equity_fair_cents, 225);
  assert.equal(revision.net_signing_outflow_cents, 9999);
  await saved(revision.id);
  record('all six economic revision fields and lineage signing adjustment', { revision_id: revision.id });
  await login('finance');
  await nav('Offers');
  await page.getByRole('button', { name: 'Rescind ' + revision.id, exact: true }).click();
  await page.locator('input[name="effective_at"]').fill('2027-04-30T12:30:00.125Z');
  const rescissionRequest = page.waitForRequest(r => r.method() === 'POST' && r.postData()?.includes('2027-04-30T12:30:00.125Z'));
  await page.getByRole('button', { name: 'Post rescission (Finance controller only)', exact: true }).click();
  const observedRescission = await rescissionRequest;
  await page.locator('#detail-backdrop').waitFor({ state: 'hidden' });
  revision = (await bootData()).offers.find(o => o.id === revision.id);
  assert.equal(revision.status, 'RESCINDED');
  assert.equal(revision.equity_grant.cancelled.cancelled_units, 6);
  assert.equal(revision.equity_grant.cancelled.vested_units, 3);
  record('rescission of revised leaf displays retained and cancelled units');
  await login('auditor');
  await nav('Offers');
  assert.equal(await page.getByRole('button', { name: 'Create offer', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Revise / }).count(), 0);
  await nav('Audit Trail');
  assert.equal((await page.locator('#workspace .active').innerText()).includes('[object Object]'), false);
  record('auditor read-only controls and readable nested immutable receipts');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Dashboard', 'Requisitions', 'Offers', 'Equity Table', 'Referrals', 'Audit Trail']) {
    await nav(name);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, name + ' page overflows');
  }
  await page.screenshot({ path: path.join(output, 'mobile-audit-dark.png'), fullPage: true });
  record('all six workspaces fit 390px viewport');
  await page.setViewportSize({ width: 1280, height: 900 });
  await login('recruiter');
  await nav('Offers');
  const precisionId = 'Exact cents revision';
  await page.locator('#off-id').fill(precisionId);
  await page.locator('#off-req').selectOption(reqId);
  await page.locator('#off-base').fill('1.00');
  await page.locator('#off-rel').fill('90071992547409.91');
  await page.locator('#off-fair').fill('70368744177664.01');
  await page.locator('#off-strike').fill('70368744177664.01');
  await page.getByRole('button', { name: 'Create offer', exact: true }).click();
  await saved(precisionId);
  let precise = (await bootData()).offers.find(o => o.id === precisionId);
  assert.equal(precise.composition.relocation_cents, Number.MAX_SAFE_INTEGER);
  assert.equal(precise.composition.equity_fair_cents, 7036874417766401);
  await login('approver');
  await nav('Offers');
  await page.getByRole('button', { name: 'Approve ' + precisionId, exact: true }).click();
  await page.getByRole('button', { name: 'Revise ' + precisionId, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Revise ' + precisionId, exact: true }).click();
  assert.equal(await page.locator('input[name="relocation"]').inputValue(), '90071992547409.91');
  assert.equal(await page.locator('input[name="fair"]').inputValue(), '70368744177664.01');
  await page.locator('input[name="base"]').fill('1.01');
  await page.getByRole('button', { name: 'Apply revision', exact: true }).click();
  await page.locator('#detail-backdrop').waitFor({ state: 'hidden' });
  precise = (await bootData()).offers.find(o => o.supersedes_id === precisionId);
  assert.equal(precise.composition.relocation_cents, Number.MAX_SAFE_INTEGER);
  assert.equal(precise.composition.equity_fair_cents, 7036874417766401);
  assert.equal(precise.composition.equity_strike_cents, 7036874417766401);
  record('large valid cents survive UI create, revision prefill and unchanged-field save exactly');
  await login('finance');
  await nav('Offers');
  await page.getByRole('button', { name: 'Rescind ' + precise.id, exact: true }).click();
  const effective = '2027-04-30T12:30:00.125Z';
  await page.locator('input[name="effective_at"]').fill(effective);
  const observedFamily = new URL(observedRescission.url()).pathname.split('/').at(-1);
  let aborted = 0;
  const abortOneRescission = async route => {
    const request = route.request();
    if (!aborted && request.method() === observedRescission.method() && new URL(request.url()).pathname.split('/').at(-1) === observedFamily) {
      aborted++;
      await route.abort('failed');
    } else await route.continue();
  };
  await page.route('**/*', abortOneRescission);
  await page.getByRole('button', { name: 'Post rescission (Finance controller only)', exact: true }).click();
  await page.locator('.drawer-form .error').filter({ hasText: /.+/ }).waitFor();
  await page.unroute('**/*', abortOneRescission);
  assert.equal(aborted, 1);
  assert.equal(await page.locator('input[name="effective_at"]').inputValue(), effective);
  assert.equal((await bootData()).offers.find(o => o.id === precise.id).status, 'COMMITTED');
  await page.getByRole('button', { name: 'Post rescission (Finance controller only)', exact: true }).click();
  await page.locator('#detail-backdrop').waitFor({state:'hidden'});
  assert.equal((await bootData()).offers.find(o => o.id === precise.id).status, 'RESCINDED');
  record('rescission transport failure retains entered date and retry succeeds', {aborted_requests:aborted});
  assert.deepEqual(errors, []);
  record('no browser JavaScript errors');
}
main().catch(e => { results.push({ passed: false, error: e.stack }); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.kill();
  const unchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceHashes());
  if (!unchanged) { results.push({ passed: false, error: 'Application source changed during run' }); process.exitCode = 1; }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ kind: 'local scripted browser product evidence', source: sourceBefore, source_unchanged: unchanged, results, browser_errors: errors }, null, 2));
  console.log(JSON.stringify({ output, results }, null, 2));
});
