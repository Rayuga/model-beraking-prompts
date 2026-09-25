const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

// This driver changes business state only through the rendered application.
// The network harness saves genuine exchanges before dropping/replacing delivery.
// It never writes browser storage, injects application state, or logs credentials.
const out = '/results';
fs.mkdirSync(out, {recursive: true});
const results = [], evidence = [], pageErrors = [], businessWrites = [];
const accounts = {ruth: 'ruth.adebayo', arun: 'arun.das', leila: 'leila.ward', owen: 'owen.park'};
let browser;
function retain(name, value) {
  const file = name.replace(/[^a-z0-9-]/gi, '-') + '.json';
  fs.writeFileSync(`${out}/${file}`, JSON.stringify(value, null, 2), {mode: 0o600});
  evidence.push(file);
  return JSON.parse(fs.readFileSync(`${out}/${file}`, 'utf8'));
}
const isWrite = request => ['POST', 'PATCH'].includes(request.method()) &&
  /^\/api\/(?:ballots(?:\/[^/]+(?:\/(?:open|close|publish))?)?|members\/[^/]+)$/.test(new URL(request.url()).pathname);
const shape = request => ({method: request.method(), path: new URL(request.url()).pathname, body: request.postData()});
const idOf = exchange => JSON.parse(exchange.request.body).operation_id;
const entry = (page, id) => page.locator(`[data-pending-id="${id}"]`);
const retryButton = (page, id) => page.locator(`[data-pending-retry="${id}"]`);
const dismissButton = (page, id) => page.locator(`[data-pending-dismiss="${id}"]`);
async function group(name, work) {
  try { await work(); results.push({name, passed: true}); console.log('PASS', name); }
  catch (error) { results.push({name, passed: false, error: error.stack || String(error)}); throw error; }
}
function monitor(page) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.on('request', request => { if (isWrite(request)) businessWrites.push(shape(request)); });
  return page;
}
async function signIn(page, who) {
  await page.goto('http://localhost:3000');
  if (await page.locator('#login-view').isVisible()) {
    await page.getByLabel('Email', {exact: true}).fill(accounts[who] + '@commonground.example');
    await page.getByLabel('Password', {exact: true}).fill('CommonGround!2026');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  }
  await page.locator('#app-view').waitFor({state: 'visible'});
  assert.match(await page.locator('#user-name').innerText(), new RegExp(who, 'i'));
  await page.waitForLoadState('networkidle');
}
async function person(who) {
  const context = await browser.newContext({viewport: {width: 1280, height: 850}});
  const page = monitor(await context.newPage());
  await signIn(page, who);
  return page;
}
async function ready(page) {
  await page.reload();
  await page.locator('#app-view').waitFor({state: 'visible'});
  await page.waitForLoadState('networkidle');
}
async function view(page, name) {
  await page.locator(`.nav-item[data-view="${name}"]`).click();
  await page.locator(`#view-${name}`).waitFor({state: 'visible'});
  await page.waitForLoadState('networkidle');
}
async function get(page, path) {
  return page.evaluate(async path => { const response = await fetch(path); return {status: response.status, body: await response.json()}; }, path);
}
const ballots = async page => (await get(page, '/api/ballots')).body.ballots;
const ballot = async (page, id) => (await ballots(page)).find(item => item.id === id);
const member = async (page, id = 'user-owen') => (await get(page, '/api/members')).body.members.find(item => item.id === id);
async function snapshot(page) {
  return {ballots: await ballots(page), members: (await get(page, '/api/members')).body,
    audit: (await get(page, '/api/audit')).body};
}
async function pending(page, ids) {
  await page.waitForFunction(expected => {
    const actual = [...document.querySelectorAll('[data-pending-id]')].map(item => item.dataset.pendingId).sort();
    return JSON.stringify(actual) === JSON.stringify([...expected].sort());
  }, ids);
  assert.deepEqual((await page.locator('[data-pending-id]').evaluateAll(items => items.map(item => item.dataset.pendingId))).sort(), [...ids].sort());
}
async function reloadWithoutReplay(page, ids) {
  const before = businessWrites.length;
  await ready(page);
  await pending(page, ids);
  assert.equal(businessWrites.length, before, 'Reload automatically resent staff work');
}
async function prepareCreate(page, title) {
  await view(page, 'ballots');
  await page.getByRole('button', {name: 'New ballot', exact: true}).click();
  await page.getByLabel('Ballot title', {exact: true}).fill(title);
  await page.locator('#ballot-description').fill('Recovery rehearsal for room bookings');
  await page.getByLabel('Voting method').selectOption('single');
  await page.locator('input[name=choice]').nth(0).fill('Morning');
  await page.locator('input[name=choice]').nth(1).fill('Evening');
  return () => page.getByRole('button', {name: 'Save draft', exact: true}).click();
}
async function prepareEdit(page, id, title) {
  await ready(page);
  await page.locator(`[data-ballot-edit="${id}"]`).click();
  await page.getByLabel('Ballot title', {exact: true}).fill(title);
  return () => page.getByRole('button', {name: 'Save draft', exact: true}).click();
}
async function prepareTransition(page, id, action) {
  await ready(page);
  return () => page.locator(`[data-ballot-card="${id}"] [data-ballot-action="${action}"]`).click();
}
async function prepareMember(page, id = 'user-owen') {
  await ready(page);
  await view(page, 'members');
  return () => page.locator(`[data-member-id="${id}"]`).click();
}
// Only the next genuine staff write from this page is intercepted. Every route
// is removed in finally; controls and retries are not rewritten by the harness.
async function exchange(page, label, act, mode = 'deliver', afterUpstream, beforeUpstream) {
  let used = false, resolve, reject;
  const observed = new Promise((yes, no) => { resolve = yes; reject = no; });
  const timer = setTimeout(() => reject(new Error(`No completed staff exchange: ${label}`)), 25000);
  const handler = async route => {
    if (used || !isWrite(route.request())) return route.fallback();
    used = true;
    const request = retain(label + '-request', shape(route.request()));
    try {
      const transportOptions = beforeUpstream ? await beforeUpstream(request) : undefined;
      const upstream = await route.fetch({maxRetries: 0, ...transportOptions});
      const responseText = await upstream.text();
      let responseBody;
      try { responseBody = JSON.parse(responseText); } catch { responseBody = responseText; }
      const saved = retain(label + '-exchange', {request, status: upstream.status(), response: responseBody,
        replay: upstream.headers()['x-idempotent-replay'] || null, delivery: mode});
      if (afterUpstream) await afterUpstream(saved);
      if (mode === 'drop' || mode === 'reload-held') {
        try { await route.abort('failed'); }
        catch (error) {
          if (mode !== 'reload-held') throw error;
          retain(label + '-navigation-cleanup', {originalDocumentReplacedWhileResponseHeld: true,
            cleanupResult: String(error)});
        }
      }
      else if (mode === 'unreadable') await route.fulfill({status: upstream.status(), contentType: 'application/json', body: '{unreadable'});
      else if (mode === 'server-error') await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'Temporary response gateway failure'})});
      else await route.fulfill({response: upstream});
      resolve(saved);
    } catch (error) { await route.abort('failed').catch(() => {}); reject(error); }
  };
  await page.route('**/api/**', handler);
  try {
    await act();
    const saved = await observed;
    if (mode !== 'deliver') {
      await retryButton(page, idOf(saved)).waitFor({state: 'visible'});
      await page.waitForFunction(id => !document.querySelector(`[data-pending-retry="${id}"]`)?.disabled, idOf(saved));
    } else await entry(page, idOf(saved)).waitFor({state: 'detached'});
    await page.waitForLoadState('networkidle');
    return saved;
  } finally { clearTimeout(timer); await page.unroute('**/api/**', handler); }
}
async function normal(page, label, act) {
  const got = await exchange(page, label, act);
  assert(got.status >= 200 && got.status < 300, `${label}: ${got.status} ${JSON.stringify(got.response)}`);
  return got;
}
async function retryExact(page, saved, label, expectedRemaining = []) {
  const before = retain(label + '-before', await snapshot(page));
  const count = businessWrites.length;
  const replay = await exchange(page, label, () => retryButton(page, idOf(saved)).click());
  assert.deepEqual(replay.request, saved.request, 'Retry changed method, target, or serialized inputs');
  assert.equal(replay.status, saved.status);
  assert.deepEqual(replay.response, saved.response, 'Retry did not recover the saved outcome');
  assert.equal(replay.replay, 'true', 'Server did not identify a saved receipt');
  assert.equal(businessWrites.length, count + 1, 'Retry sent more than the selected attempt');
  await pending(page, expectedRemaining);
  assert.deepEqual(await snapshot(page), before, 'Recovering a receipt changed current business state');
  return replay;
}
async function main() {
  browser = await chromium.launch({executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  const ruth = await person('ruth'), second = await person('ruth');
  let created, id, changed;
  await group('create uncertainty survives reload and process restart without automatic replay', async () => {
    created = await exchange(ruth, 'create-lost', await prepareCreate(ruth, 'Recovery one'), 'drop');
    assert.equal(created.status, 201);
    id = created.response.ballot.id;
    await pending(ruth, [idOf(created)]);
    assert.match(await entry(ruth, idOf(created)).innerText(), /create|draft/i);
    assert.match(await entry(ruth, idOf(created)).innerText(), /Recovery one/);
    await reloadWithoutReplay(ruth, [idOf(created)]);
    const before = retain('restart-business-before', await snapshot(second));
    const output = execFileSync('python3', ['/opt/common-ground-verifier/app-lifecycle.py', 'restart'], {encoding: 'utf8'});
    retain('trusted-restart', {output});
    await reloadWithoutReplay(ruth, [idOf(created)]);
    assert.deepEqual(await snapshot(second), before);
  });
  await group('create Retry recovers its original success without overwriting a newer edit', async () => {
    changed = await normal(second, 'create-newer-edit', await prepareEdit(second, id, 'Recovery one newer'));
    await retryExact(ruth, created, 'create-retry');
    const card = ruth.locator(`[data-ballot-card="${id}"]`);
    assert.match(await card.innerText(), /Recovery one newer/);
    assert.equal((await ballot(ruth, id)).revision, changed.response.ballot.revision);
  });
  await group('edit uncertainty preserves original payload and revision after a later edit', async () => {
    const lost = await exchange(ruth, 'edit-lost', await prepareEdit(ruth, id, 'Recovery edit accepted'), 'drop');
    assert.equal(lost.status, 200);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'edit-newer', await prepareEdit(second, id, 'Recovery edit newest'));
    await retryExact(ruth, lost, 'edit-retry');
    assert.match(await ruth.locator(`[data-ballot-card="${id}"]`).innerText(), /Recovery edit newest/);
  });
  await group('open uncertainty recovers a saved success after another session closes voting', async () => {
    const lost = await exchange(ruth, 'open-lost', await prepareTransition(ruth, id, 'open'), 'drop');
    assert.equal(lost.status, 200);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'open-newer-close', await prepareTransition(second, id, 'close'));
    await retryExact(ruth, lost, 'open-retry');
    assert.equal((await ballot(ruth, id)).status, 'closed');
    assert.match(await ruth.locator(`[data-ballot-card="${id}"] .status`).innerText(), /closed/i);
  });
  await group('close uncertainty recovers a saved success after another session publishes', async () => {
    const c = await normal(ruth, 'close-fixture-create', await prepareCreate(ruth, 'Recovery close'));
    const closeId = c.response.ballot.id;
    await normal(ruth, 'close-fixture-open', await prepareTransition(ruth, closeId, 'open'));
    const lost = await exchange(ruth, 'close-lost', await prepareTransition(ruth, closeId, 'close'), 'drop');
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'close-newer-publish', await prepareTransition(second, closeId, 'publish'));
    await retryExact(ruth, lost, 'close-retry');
    assert.equal((await ballot(ruth, closeId)).status, 'published');
    assert.match(await ruth.locator(`[data-ballot-card="${closeId}"] .status`).innerText(), /published/i);
  });
  await group('publish uncertainty is durable and Retry adds no publication or audit duplicate', async () => {
    const lost = await exchange(ruth, 'publish-lost', await prepareTransition(ruth, id, 'publish'), 'drop');
    assert.equal(lost.status, 200);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await retryExact(ruth, lost, 'publish-retry');
    assert.equal((await ballot(ruth, id)).status, 'published');
  });
  await group('membership uncertainty replays the original success after a newer membership change', async () => {
    const lost = await exchange(ruth, 'membership-lost', await prepareMember(ruth), 'drop');
    assert.equal(lost.status, 200);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'membership-newer-change', await prepareMember(second));
    await view(ruth, 'members');
    const newest = await member(second);
    await retryExact(ruth, lost, 'membership-retry');
    assert.deepEqual(await member(ruth), newest);
    assert.match(await ruth.locator('[data-member-id="user-owen"]').locator('..').innerText(), new RegExp(`Revision ${newest.revision}`));
  });
  await group('saved stale-revision refusal survives newer state and resolves only its original attempt', async () => {
    const c = await normal(ruth, 'stale-create', await prepareCreate(ruth, 'Recovery stale base'));
    const target = c.response.ballot.id;
    const submit = await prepareEdit(ruth, target, 'Recovery stale rejected');
    await normal(second, 'stale-newer-one', await prepareEdit(second, target, 'Recovery stale changed once'));
    const lost = await exchange(ruth, 'stale-refusal-lost', submit, 'drop');
    assert.equal(lost.status, 409);
    assert.match(lost.response.error, /changed|revision|refresh/i);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'stale-newer-two', await prepareEdit(second, target, 'Recovery stale final current'));
    await retryExact(ruth, lost, 'stale-refusal-retry');
    assert.match(await ruth.locator('#feedback-text').innerText(), /refus|changed|revision/i);
    assert.match(await ruth.locator(`[data-ballot-card="${target}"]`).innerText(), /Recovery stale final current/);
    const newAttempt = await normal(ruth, 'stale-new-user-decision', await prepareEdit(ruth, target, 'Recovery fresh decision'));
    assert.notEqual(idOf(newAttempt), idOf(lost));
    assert(JSON.parse(newAttempt.request.body).expected_revision > JSON.parse(lost.request.body).expected_revision);
  });
  await group('saved business refusal stays refused after opening becomes valid', async () => {
    assert.equal((await member(second)).active, false);
    if ((await member(second, 'user-leila')).active) await normal(second, 'domain-pause-leila', await prepareMember(second, 'user-leila'));
    const c = await normal(ruth, 'domain-create', await prepareCreate(ruth, 'Recovery eligibility refusal'));
    const target = c.response.ballot.id;
    const lost = await exchange(ruth, 'domain-refusal-lost', await prepareTransition(ruth, target, 'open'), 'drop');
    assert.equal(lost.status, 409);
    assert.match(lost.response.error, /active|eligible|member/i);
    await reloadWithoutReplay(ruth, [idOf(lost)]);
    await normal(second, 'domain-restore-leila', await prepareMember(second, 'user-leila'));
    await retryExact(ruth, lost, 'domain-refusal-retry');
    assert.equal((await ballot(ruth, target)).status, 'draft');
    const newAttempt = await normal(ruth, 'domain-new-user-decision', await prepareTransition(ruth, target, 'open'));
    assert.notEqual(idOf(newAttempt), idOf(lost));
  });
  let first, other;
  await group('unreadable and server-error delivery retain separate committed attempts', async () => {
    first = await exchange(ruth, 'unreadable-create', await prepareCreate(ruth, 'Recovery unreadable'), 'unreadable');
    other = await exchange(ruth, 'server-error-create', await prepareCreate(ruth, 'Recovery gateway'), 'server-error');
    assert.equal(first.status, 201); assert.equal(other.status, 201);
    await reloadWithoutReplay(ruth, [idOf(first), idOf(other)]);
    assert.match(await entry(ruth, idOf(first)).innerText(), /Recovery unreadable/);
    assert.match(await entry(ruth, idOf(other)).innerText(), /Recovery gateway/);
  });
  await group('retrying one pending action leaves the other recognizable and unsent', async () => {
    await retryExact(ruth, first, 'queue-one-retry', [idOf(other)]);
    assert.match(await entry(ruth, idOf(other)).innerText(), /Recovery gateway/);
  });
  await group('Dismiss sends no mutation, does not undo accepted work, and stays dismissed after reload', async () => {
    const before = retain('dismiss-before', await snapshot(ruth)), count = businessWrites.length;
    assert.match(await ruth.locator('#pending-actions').innerText(), /does not cancel|does not.*undo|reminder/i);
    await dismissButton(ruth, idOf(other)).click();
    await pending(ruth, []);
    await reloadWithoutReplay(ruth, []);
    assert.equal(businessWrites.length, count);
    assert.deepEqual(await snapshot(ruth), before);
    assert.equal((await ballot(ruth, other.response.ballot.id)).title, 'Recovery gateway');
  });
  await group('confirmed write followed by failed refresh is not left pending', async () => {
    const submit = await prepareCreate(ruth, 'Recovery confirmed refresh failure');
    let blockRefresh = false, blocked = 0;
    const route = async intercepted => {
      if (blockRefresh && intercepted.request().method() === 'GET' && new URL(intercepted.request().url()).pathname === '/api/ballots') {
        blocked++; return intercepted.abort('failed');
      }
      return intercepted.fallback();
    };
    await ruth.route('**/api/ballots', route);
    let accepted;
    try { accepted = await exchange(ruth, 'confirmed-refresh-failure', submit, 'deliver', async () => { blockRefresh = true; }); }
    finally { await ruth.unroute('**/api/ballots', route); }
    assert.equal(accepted.status, 201);
    assert(blocked > 0, 'Fixture did not interrupt the post-success refresh');
    await pending(ruth, []);
    assert.match(await ruth.locator('#feedback-text').innerText(), /saved|accepted|confirmed/i);
    assert.match(await ruth.locator('#feedback-text').innerText(), /refresh/i);
    await reloadWithoutReplay(ruth, []);
    assert(await ballot(ruth, accepted.response.ballot.id));
  });
  let owned;
  await group('pending details and requests stay private across Arun and both Member sign-ins', async () => {
    owned = await exchange(ruth, 'owner-lost', await prepareCreate(ruth, 'Recovery private coordinator record'), 'drop');
    await ruth.getByRole('button', {name: 'Sign out', exact: true}).click();
    await ruth.locator('#login-view').waitFor({state: 'visible'});
    assert.equal(await ruth.locator('[data-pending-id]').count(), 0);
    for (const who of ['arun', 'leila', 'owen']) {
      const count = businessWrites.length;
      await signIn(ruth, who);
      assert.equal(await ruth.locator('#pending-actions').isVisible(), false, `${who} sees staff recovery`);
      assert.equal(await ruth.locator('[data-pending-id]').count(), 0, `${who} can recover another account's attempt`);
      assert.equal(await ruth.locator('[data-pending-retry]').count(), 0);
      assert.equal(businessWrites.length, count, `${who} sign-in replayed coordinator work`);
      await ruth.getByRole('button', {name: 'Sign out', exact: true}).click();
      await ruth.locator('#login-view').waitFor({state: 'visible'});
    }
    const count = businessWrites.length;
    await signIn(ruth, 'ruth');
    await pending(ruth, [idOf(owned)]);
    assert.equal(businessWrites.length, count, 'Owner sign-in automatically resent saved work');
  });
  await group('revoked session preserves pending work for original-account reauthentication', async () => {
    await second.getByRole('button', {name: 'End all sessions', exact: true}).click();
    await second.locator('#login-view').waitFor({state: 'visible'});
    const count = businessWrites.length;
    await retryButton(ruth, idOf(owned)).click();
    await ruth.locator('#login-view').waitFor({state: 'visible'});
    assert.equal(businessWrites.length, count, 'Identity check sent a write after known revocation');
    assert.equal(await ruth.locator('[data-pending-id]').count(), 0);
    await signIn(ruth, 'ruth');
    await pending(ruth, [idOf(owned)]);
    assert.equal(businessWrites.length, count, 'Reauthentication replayed pending work automatically');
    await retryExact(ruth, owned, 'owner-after-revocation-retry');
    await signIn(second, 'ruth');
  });
  const twin = monitor(await ruth.context().newPage());
  await signIn(twin, 'ruth');
  let tabOne, tabTwo;
  await group('two same-profile tabs share distinct pending entries without overwriting either', async () => {
    tabOne = await exchange(ruth, 'tab-one-create', await prepareCreate(ruth, 'Recovery tab one'), 'drop');
    await pending(twin, [idOf(tabOne)]);
    tabTwo = await exchange(twin, 'tab-two-create', await prepareCreate(twin, 'Recovery tab two'), 'drop');
    await pending(ruth, [idOf(tabOne), idOf(tabTwo)]);
    await pending(twin, [idOf(tabOne), idOf(tabTwo)]);
    await reloadWithoutReplay(ruth, [idOf(tabOne), idOf(tabTwo)]);
  });
  await group('two pending entries fit a 390px viewport and expose keyboard-accessible Retry and Dismiss', async () => {
    const originalViewport = ruth.viewportSize();
    try {
      await ruth.setViewportSize({width: 390, height: 844});
      await ruth.locator('#pending-actions').scrollIntoViewIfNeeded();
      await ruth.locator('#pending-actions').screenshot({path: `${out}/recovery-pending-mobile.png`});
      const geometry = retain('pending-mobile-geometry', await ruth.evaluate(() => {
        const bounds = element => {
          const rect = element.getBoundingClientRect();
          return {left: rect.left, right: rect.right, width: rect.width, height: rect.height};
        };
        return {viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth,
          tray: bounds(document.querySelector('#pending-actions')),
          controls: [...document.querySelectorAll('[data-pending-retry], [data-pending-dismiss]')].map(button => ({
            ...bounds(button), name: (button.getAttribute('aria-label') || button.textContent).trim(),
            id: button.dataset.pendingRetry || button.dataset.pendingDismiss,
            kind: button.dataset.pendingRetry ? 'retry' : 'dismiss', disabled: button.disabled,
          }))};
      }));
      assert(geometry.documentWidth <= geometry.viewport + 1, 'Pending work causes horizontal document overflow');
      assert(geometry.tray.left >= -1 && geometry.tray.right <= geometry.viewport + 1);
      assert.equal(geometry.controls.length, 4);
      for (const control of geometry.controls) {
        assert(control.left >= -1 && control.right <= geometry.viewport + 1, 'Pending control is horizontally clipped');
        assert(control.width > 0 && control.height > 0 && !control.disabled);
        assert.match(control.name, /retry|dismiss/i);
      }
      await ruth.locator('#pending-actions-title').focus();
      const focused = [];
      for (let index = 0; index < 4; index++) {
        await ruth.keyboard.press('Tab');
        focused.push(await ruth.evaluate(() => ({id: document.activeElement.dataset.pendingRetry || document.activeElement.dataset.pendingDismiss,
          kind: document.activeElement.dataset.pendingRetry ? 'retry' : document.activeElement.dataset.pendingDismiss ? 'dismiss' : 'other'})));
      }
      retain('pending-mobile-keyboard', focused);
      assert.deepEqual(focused.map(item => item.kind + ':' + item.id).sort(),
        [idOf(tabOne), idOf(tabTwo)].flatMap(id => ['retry:' + id, 'dismiss:' + id]).sort());
    } finally { await ruth.setViewportSize(originalViewport); }
  });
  await group('cross-tab dismissal removes only its reminder and stale reload cannot resurrect it', async () => {
    const before = retain('cross-tab-dismiss-before', await snapshot(ruth)), count = businessWrites.length;
    await dismissButton(ruth, idOf(tabOne)).click();
    await pending(twin, [idOf(tabTwo)]);
    await reloadWithoutReplay(twin, [idOf(tabTwo)]);
    await pending(ruth, [idOf(tabTwo)]);
    assert.equal(businessWrites.length, count);
    assert.deepEqual(await snapshot(ruth), before);
  });
  await group('concurrent Retry and Dismiss cannot send twice or restore a resolved entry', async () => {
    const before = retain('cross-tab-retry-before', await snapshot(ruth)), count = businessWrites.length;
    let held, release;
    const reached = new Promise(resolve => { held = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const running = exchange(twin, 'cross-tab-held-retry', () => retryButton(twin, idOf(tabTwo)).click(), 'deliver', async saved => {
      held(saved); await gate;
    });
    let saved;
    try {
      saved = await Promise.race([reached, running.then(() => { throw new Error('Retry completed before the hold checkpoint'); })]);
      assert.equal(await retryButton(twin, idOf(tabTwo)).isDisabled(), true);
      await retryButton(ruth, idOf(tabTwo)).click();
      await ruth.waitForLoadState('networkidle');
      assert.equal(businessWrites.length, count + 1, 'Second tab sent an overlapping Retry');
      await dismissButton(ruth, idOf(tabTwo)).click();
      await pending(ruth, [idOf(tabTwo)]);
      assert.equal(businessWrites.length, count + 1, 'Dismiss sent a write');
    } finally { release(); }
    await running;
    assert.deepEqual(saved.request, tabTwo.request);
    assert.deepEqual(saved.response, tabTwo.response);
    await pending(twin, []); await pending(ruth, []);
    await reloadWithoutReplay(ruth, []); await reloadWithoutReplay(twin, []);
    assert.deepEqual(await snapshot(ruth), before);
  });
  await group('a delayed 403 preserves Ruth pending work and cannot replace a newer Arun session', async () => {
    const submit = await prepareCreate(ruth, 'Recovery access changed while sending');
    let held, release;
    const reached = new Promise(resolve => { held = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const before = retain('access-race-business-before', await snapshot(second));
    const running = exchange(ruth, 'access-race-original', submit, 'deliver', undefined, async request => {
      held(request);
      await gate;
      // Playwright may retain the original request's already-captured Cookie.
      // Adopt only the actual, UI-issued current cookie from this same profile
      // to isolate the 403 race at the request transport boundary. Product
      // method, path and serialized payload remain untouched. Never log cookies.
      const cookies = await ruth.context().cookies('http://localhost:3000');
      retain('access-race-transport-diagnostic', {deliberateTransportAdaptation: true,
        reason: 'Use the actual current same-profile UI-issued Arun session at forwarding time to exercise late 403 handling',
        changedField: 'Cookie transport header only', manufacturedSession: false,
        productRequestUnchanged: true, currentActor: (await get(twin, '/api/me')).body.user.id});
      return {headers: {'content-type': 'application/json', cookie: cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ')}};
    });
    let request;
    try {
      request = await Promise.race([reached, running.then(() => { throw new Error('Access-race request completed before the hold checkpoint'); })]);
      await twin.getByRole('button', {name: 'Sign out', exact: true}).click();
      await twin.locator('#login-view').waitFor({state: 'visible'});
      await ruth.locator('#login-view').waitFor({state: 'visible'});
      await signIn(twin, 'arun');
      // Authenticate this original page without navigating away or cancelling
      // its held request. The late response must preserve this newer app view.
      await ruth.getByLabel('Email', {exact: true}).fill(accounts.arun + '@commonground.example');
      await ruth.getByLabel('Password', {exact: true}).fill('CommonGround!2026');
      await ruth.getByRole('button', {name: 'Sign in', exact: true}).click();
      await ruth.locator('#app-view').waitFor({state: 'visible'});
      assert.match(await ruth.locator('#user-name').innerText(), /arun/i);
      assert.equal((await get(ruth, '/api/me')).body.user.id, 'user-arun');
      assert.equal(await ruth.locator('[data-pending-id]').count(), 0);
    } finally { release(); }
    const denied = await running;
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.request, request);
    assert.equal(await ruth.locator('#app-view').isVisible(), true, 'Late permission response hid the newer account workspace');
    assert.match(await ruth.locator('#user-name').innerText(), /arun/i);
    assert.equal((await get(ruth, '/api/me')).body.user.id, 'user-arun');
    assert.equal(await ruth.locator('#pending-actions').isVisible(), false);
    assert.deepEqual(await snapshot(second), before, 'Denied actor-switch attempt changed business data');
    await ruth.getByRole('button', {name: 'Sign out', exact: true}).click();
    await ruth.locator('#login-view').waitFor({state: 'visible'});
    const count = businessWrites.length;
    await signIn(ruth, 'ruth');
    await pending(ruth, [idOf(denied)]);
    assert.equal(businessWrites.length, count, 'Returning owner automatically resent the 403 attempt');
    await ready(twin);
    await pending(twin, [idOf(denied)]);
    const accepted = await normal(ruth, 'access-race-owner-retry', () => retryButton(ruth, idOf(denied)).click());
    assert.equal(accepted.status, 201);
    assert.deepEqual(accepted.request, denied.request, 'Owner Retry changed the original product request');
    await pending(ruth, []); await pending(twin, []);
    const after = await snapshot(second);
    assert.equal(after.ballots.length, before.ballots.length + 1);
    assert.equal(after.ballots.filter(item => item.title === 'Recovery access changed while sending').length, 1);
    assert.deepEqual(after.members, before.members);
    assert.equal(after.audit.events.length, before.audit.events.length + 1);
  });
  await group('in-flight form submit is disabled and repeated pointer clicks create one attempt', async () => {
    const submit = await prepareCreate(ruth, 'Recovery double click');
    let held, release;
    const reached = new Promise(resolve => { held = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const count = businessWrites.length;
    const running = exchange(ruth, 'double-click-held', submit, 'drop', async saved => { held(saved); await gate; });
    let saved;
    try {
      saved = await Promise.race([reached, running.then(() => { throw new Error('Submit completed before the hold checkpoint'); })]);
      const button = ruth.getByRole('button', {name: 'Save draft', exact: true});
      assert.equal(await button.isDisabled(), true);
      const box = await button.boundingBox();
      assert(box);
      await ruth.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {clickCount: 2});
      assert.equal(businessWrites.length, count + 1);
    } finally { release(); }
    await running;
    await pending(ruth, [idOf(saved)]);
    await reloadWithoutReplay(ruth, [idOf(saved)]);
    await retryExact(ruth, saved, 'double-click-retry');
    assert.equal((await ballots(ruth)).filter(item => item.title === 'Recovery double click').length, 1);
  });
  await group('pending work is durable before failure handling and survives reload while the response is still held', async () => {
    const submit = await prepareCreate(ruth, 'Recovery reload before response');
    let held, release;
    const reached = new Promise(resolve => { held = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const running = exchange(ruth, 'reload-before-response-held', submit, 'reload-held', async saved => {
      held(saved);
      await gate;
    });
    let saved, checkpointError;
    try {
      saved = await Promise.race([reached, running.then(() => { throw new Error('Held response was released before the durability checkpoint'); })]);
      assert.equal(saved.status, 201);
      assert.equal(await ruth.getByRole('button', {name: 'Save draft', exact: true}).isDisabled(), true);
      const count = businessWrites.length;
      // A new document in the other tab must restore the journal while the
      // initiating document is still awaiting its original response. Saving
      // only inside a catch handler cannot satisfy this checkpoint.
      await ready(twin);
      await pending(twin, [idOf(saved)]);
      const beforeReload = retain('reload-before-response-checkpoint', {upstreamCommitted: true,
        responseStillHeld: true, failureNotDelivered: true, otherTabRestored: await twin.locator('[data-pending-id]').evaluateAll(items => items.map(item => item.dataset.pendingId)),
        originalSubmitStillDisabled: await ruth.getByRole('button', {name: 'Save draft', exact: true}).isDisabled()});
      assert.equal(beforeReload.originalSubmitStillDisabled, true);
      // Replace the initiating document before releasing/aborting its response.
      await ready(ruth);
      await pending(ruth, [idOf(saved)]);
      assert.equal(businessWrites.length, count, 'Reload resent the unresolved operation');
      retain('reload-before-response-restored', {responseStillHeld: true, restoredOperationId: idOf(saved), automaticWrites: businessWrites.length - count});
    } catch (error) { checkpointError = error; }
    finally { release(); }
    // Always finish the held route, including when a checkpoint failed.
    await running.catch(error => { checkpointError ||= error; });
    if (checkpointError) throw checkpointError;
    await retryExact(ruth, saved, 'reload-before-response-retry');
    await pending(twin, []);
    assert.equal((await ballots(ruth)).filter(item => item.title === 'Recovery reload before response').length, 1);
  });
  await group('no uncaught browser errors and retained exchanges contain no authentication secrets', async () => {
    assert.deepEqual(pageErrors, []);
    for (const file of evidence) {
      const text = fs.readFileSync(`${out}/${file}`, 'utf8');
      assert(!text.includes('CommonGround!2026'), file + ' contains a password');
      assert(!text.includes('cg_session='), file + ' contains a session credential');
    }
  });
}
main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(async () => {
  retain('recovery-results', {passed: results.filter(item => item.passed).length,
    failed: results.filter(item => !item.passed).length, results, pageErrors,
    businessWriteCount: businessWrites.length, evidence: [...evidence]});
  if (browser) await browser.close();
});
