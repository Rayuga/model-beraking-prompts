const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

const kind = process.argv[2];
const origin = 'http://localhost:3000';
const oracle = kind === 'oracle';
const loginPath = oracle ? '/api/auth/login' : '/api/login';
const collectionPath = oracle ? '/api/ballots' : '/api/bootstrap';
const appSelector = oracle ? '#app-view' : '#app-shell';
const errorSelector = oracle ? '#login-error' : '#banner';
const result = { kind, scope: 'Local diagnostic using unmodified exported source and a fresh disposable database; no provider regrade.' };
const log = fs.openSync(`/results/${kind}-server.log`, 'w');
const server = spawn('node', ['/submission/server.js'], {
  cwd: '/submission',
  env: { ...process.env, DB_PATH: '/tmp/review.db', SEED_PATH: '/submission/common_ground_seed.json' },
  stdio: ['ignore', log, log],
});

async function request(page, route, body) {
  return page.evaluate(async ({ route, body }) => {
    const r = await fetch(route, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, body: data };
  }, { route, body });
}

async function signIn(page, password, email = 'ruth.adebayo@commonground.example') {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === loginPath);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const r = await response;
  await page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled();
  return r.status();
}

async function wrongPassword(page) {
  const status = await signIn(page, 'CommonGround!wrong');
  await page.waitForFunction(selector => document.querySelector(selector)?.textContent.trim(), errorSelector);
  return {
    login_status: status,
    error_text_in_dom: (await page.locator(errorSelector).textContent()).trim(),
    error_visible: await page.locator(errorSelector).isVisible(),
    workspace_visible: await page.locator(appSelector).isVisible(),
    protected_read: await request(page, collectionPath),
    authentication_cookie_count: (await page.context().cookies()).length,
    hidden_ancestors: await page.locator(errorSelector).evaluate(el => {
      const hidden = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).display === 'none') hidden.push({ id: p.id, display: 'none' });
      }
      return hidden;
    }),
  };
}

async function functionalDiagnostics(page, browser) {
  const snapshot = async () => (await request(page, collectionPath)).body;
  const create = body => request(page, '/api/ballots', body);
  const base = { title: 'Local review approval', description: 'Disposable diagnostic', method: 'approval', maxSelections: 2, choices: ['Morning', 'Afternoon', 'Evening'] };
  const observations = {};
  for (const [name, choices] of [['blank_choice', ['Morning', '', 'Evening']], ['repeated_choice', ['Morning', 'Morning', 'Evening']]]) {
    const before = await snapshot();
    const response = await create({ ...base, title: name, choices, operationId: name });
    const after = await snapshot();
    observations[name] = { status: response.status, ballots_added: after.ballots.length - before.ballots.length, created_choices: after.ballots.find(b => b.id === response.body.ballot?.id)?.choices };
  }
  const payload = { ...base, operationId: 'exact-create-replay' };
  const first = await create(payload);
  const beforeReplay = await snapshot();
  const replay = await create(payload);
  const afterReplay = await snapshot();
  observations.exact_create_replay = {
    first_status: first.status, replay_status: replay.status,
    identical_body: JSON.stringify(first.body) === JSON.stringify(replay.body),
    first_id: first.body.ballot?.id, replay_id: replay.body.ballot?.id,
    extra_ballots: afterReplay.ballots.length - beforeReplay.ballots.length,
  };
  const created = afterReplay.ballots.find(b => b.id === first.body.ballot.id);
  await request(page, `/api/ballots/${created.id}/open`, { operationId: 'open-local-approval', baseRevision: created.revision });
  const opened = (await snapshot()).ballots.find(b => b.id === created.id);
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await member.goto(origin);
  await signIn(member, 'CommonGround!2026', 'leila.ward@commonground.example');
  await member.locator(appSelector).waitFor({ state: 'visible' });
  const courtyard = (await snapshot()).ballots.find(b => b.title === 'Courtyard closing time');
  const captured = async (name, ballot, selections) => {
    const before = await snapshot();
    const response = await request(member, `/api/ballots/${ballot.id}/vote`, { operationId: name, baseRevision: ballot.revision, selections });
    const after = await snapshot();
    observations[name] = {
      status: response.status,
      response: typeof response.body === 'string' ? response.body.slice(0, 350) : response.body,
      ballot_unchanged: JSON.stringify(before.ballots.find(b => b.id === ballot.id)) === JSON.stringify(after.ballots.find(b => b.id === ballot.id)),
      audit_unchanged: JSON.stringify(before.audit) === JSON.stringify(after.audit),
    };
  };
  await captured('single_empty', courtyard, []);
  await captured('single_multiple', courtyard, courtyard.choices.map(c => c.id));
  await captured('cross_ballot', opened, [courtyard.choices[0].id]);
  await captured('approval_repeated_id', opened, [opened.choices[0].id, opened.choices[0].id]);
  await captured('single_valid_after_refusals', courtyard, [courtyard.choices[0].id]);
  await memberContext.close();
  return observations;
}

let browser;
(async () => {
  for (let tries = 0; tries < 100; tries++) {
    try { if ((await fetch(`${origin}/api/health`)).ok) break; } catch {}
    if (tries === 99) throw new Error('App failed to become ready');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(origin);
  result.first_wrong_password = await wrongPassword(page);
  await page.screenshot({ path: `/results/${kind}-wrong-password.png` });
  assert.equal(result.first_wrong_password.login_status, 401);
  assert.equal(result.first_wrong_password.protected_read.status, 401);
  assert.equal(result.first_wrong_password.error_visible, oracle);
  assert.equal(result.first_wrong_password.workspace_visible, false);
  assert.equal(await signIn(page, 'CommonGround!2026'), 200);
  await page.locator(appSelector).waitFor({ state: 'visible' });
  const collection = await request(page, collectionPath);
  result.valid_login = { status: collection.status, ballot_count: collection.body.ballots.length, workspace_visible: await page.locator(appSelector).isVisible() };
  await page.reload();
  await page.locator(appSelector).waitFor({ state: 'visible' });
  result.refresh_protected_status = (await request(page, collectionPath)).status;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(origin);
  result.anonymous_before_wrong_password = await request(anonymousPage, collectionPath);
  result.second_wrong_password = await wrongPassword(anonymousPage);
  if (!oracle) {
    result.functional_diagnostics = await functionalDiagnostics(page, browser);
  }
  result.completed = true;
})().catch(error => {
  result.completed = false;
  result.error = error.stack;
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  fs.closeSync(log);
  fs.writeFileSync(`/results/${kind}-reproduction.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
