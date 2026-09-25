const {spawn} = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const version = require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(version, '0.0.79');
fs.mkdirSync('/results', {recursive: true});
const child = spawn('playwright-mcp', ['--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], {stdio: ['pipe', 'pipe', 'pipe']});
let buffer = '', sequence = 0, stderr = '';
const waiting = new Map(), results = [];
child.stderr.on('data', data => { stderr += data; });
child.stdout.on('data', data => {
  buffer += data;
  while (buffer.includes('\n')) {
    const index = buffer.indexOf('\n'), line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (waiting.has(value.id)) { waiting.get(value.id)(value); waiting.delete(value.id); }
  }
});
function redact(value) { return JSON.stringify(value, null, 2).replaceAll('CommonGround!2026', '[fixture password redacted]'); }
function retain(name, value) { fs.writeFileSync(`/results/mcp-recovery-${name}.json`, redact(value), {mode: 0o600}); }
async function call(method, params) {
  const id = ++sequence;
  let timer;
  try {
    return await Promise.race([
      new Promise(resolve => { waiting.set(id, resolve); child.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MCP timeout: ' + method)), 55000); }),
    ]);
  } finally { clearTimeout(timer); waiting.delete(id); }
}

// Persistent references live in the trusted MCP browser process, never in app
// storage or DOM. A later tool call uses the same Page/Context/request fixtures.
const support = String.raw`
const browser = page.context().browser();
const h = browser.__recoverySmoke;
const accounts = {ruth: 'ruth.adebayo', arun: 'arun.das', leila: 'leila.ward', owen: 'owen.park'};
const pathOf = request => request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
const isStaff = request => ['POST', 'PATCH'].includes(request.method()) && /^\/api\/(?:ballots(?:\/[^/]+(?:\/(?:open|close|publish))?)?|members\/[^/]+)$/.test(pathOf(request));
const shape = request => ({path: pathOf(request), method: request.method(), body: request.postData()});
const op = saved => JSON.parse(saved.request.body).operation_id;
const ids = async p => (await p.locator('[data-pending-id]').evaluateAll(items => items.map(item => item.dataset.pendingId))).sort();
async function expectIds(p, expected) {
  await p.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[data-pending-id]')].map(item => item.dataset.pendingId).sort()) === JSON.stringify([...expected].sort()), expected);
  return ids(p);
}
async function read(p, path) { return p.evaluate(async path => { const response = await fetch(path); return {status: response.status, body: await response.json()}; }, path); }
async function snapshot(p) { return {ballots: (await read(p, '/api/ballots')).body.ballots, members: (await read(p, '/api/members')).body, audit: (await read(p, '/api/audit')).body}; }
async function signin(p, who) {
  await p.goto('http://localhost:3000');
  if (await p.locator('#login-view').isVisible()) {
    await p.getByLabel('Email', {exact: true}).fill(accounts[who] + '@commonground.example');
    await p.getByLabel('Password', {exact: true}).fill('CommonGround!2026');
    await p.getByRole('button', {name: 'Sign in', exact: true}).click();
  }
  await p.locator('#app-view').waitFor({state: 'visible'});
  await p.waitForLoadState('networkidle');
  return p.locator('#user-name').innerText();
}
async function signout(p) {
  await p.getByRole('button', {name: 'Sign out', exact: true}).click();
  await p.locator('#login-view').waitFor({state: 'visible'});
}
async function reload(p) {
  await p.reload();
  await p.locator('#app-view').waitFor({state: 'visible'});
  await p.waitForLoadState('networkidle');
}
async function createForm(p, title) {
  await p.locator('.nav-item[data-view="ballots"]').click();
  await p.getByRole('button', {name: 'New ballot', exact: true}).click();
  await p.getByLabel('Ballot title', {exact: true}).fill(title);
  await p.locator('#ballot-description').fill('Pinned MCP recovery rehearsal');
  await p.getByLabel('Voting method').selectOption('single');
  await p.locator('input[name=choice]').nth(0).fill('Morning');
  await p.locator('input[name=choice]').nth(1).fill('Evening');
}
async function exchange(p, label, act, lose = false) {
  let used = false, yes, no;
  const completion = new Promise((resolve, reject) => { yes = resolve; no = reject; });
  const handler = async route => {
    if (used || !isStaff(route.request())) return route.fallback();
    used = true;
    const request = shape(route.request());
    h.exchanges[label] = {request};
    try {
      const upstream = await route.fetch({maxRetries: 0});
      const saved = {request, status: upstream.status(), response: await upstream.json(), replay: upstream.headers()['x-idempotent-replay'] || null, lost: lose};
      // Save the actual receipt before delivery or any assertions.
      h.exchanges[label] = saved;
      if (lose) await route.abort('failed'); else await route.fulfill({response: upstream});
      yes(saved);
    } catch (error) { await route.abort('failed').catch(() => {}); no(error); }
  };
  await p.route('**/api/**', handler);
  try {
    await act();
    const saved = await completion;
    if (lose) {
      await p.locator('[data-pending-retry="' + op(saved) + '"]').waitFor({state: 'visible'});
      await p.waitForFunction(id => !document.querySelector('[data-pending-retry="' + id + '"]')?.disabled, op(saved));
    } else await p.locator('[data-pending-id="' + op(saved) + '"]').waitFor({state: 'detached'});
    await p.waitForLoadState('networkidle');
    return saved;
  } finally { await p.unroute('**/api/**', handler); }
}
function watch(p) {
  p.setDefaultTimeout(15000);
  p.on('request', request => { if (isStaff(request)) h.writes.push(shape(request)); });
  p.on('pageerror', error => h.pageErrors.push(error.message));
}
`;
async function run(name, body) {
  const response = await call('tools/call', {name: 'browser_run_code_unsafe', arguments: {code: `async(page)=>{${support}\n${body}\n}`}});
  retain(name, response);
  assert(!response.error && !response.result?.isError, redact(response).slice(-1800));
  const text = response.result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  assert(text.includes('### Result\n'), text.slice(-1500));
  return JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
}
const pass = name => { results.push({name, passed: true}); console.log('PASS MCP RECOVERY', name); };
async function main() {
  await call('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'oracle-failure-reproduction', version: '1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  await call('tools/call', {name: 'browser_navigate', arguments: {url: 'http://localhost:3000'}});
  await run('repro-setup', `browser.__recoverySmoke = {ruth: page, exchanges: {}, writes: [], pageErrors: []}; return {identity: await signin(page, 'ruth')};`);
  const accepted = await run('repro-observed-edit', `
    watch(h.ruth);
    await createForm(h.ruth, 'Oracle omission control');
    h.created = await exchange(h.ruth, 'created', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    await h.ruth.getByRole('article').filter({has: h.ruth.getByRole('heading', {name: 'Oracle omission control', exact: true})}).getByRole('button', {name: 'Edit draft', exact: true}).click();
    await h.ruth.getByLabel('Ballot title', {exact: true}).fill('Oracle observed edit');
    h.edited = await exchange(h.ruth, 'observed-edit', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    return {created: h.created, edited: h.edited, after: await snapshot(h.ruth)};`);
  assert.equal(accepted.created.status, 201); assert.equal(accepted.edited.status, 200);
  const prepared = await run('repro-omitted-prepare', `
    const payload = JSON.parse(h.edited.request.body);
    const current = (await snapshot(h.ruth)).ballots.find(ballot => ballot.id === h.edited.response.ballot.id);
    h.omitted = {...payload, title: 'Oracle revision omitted', operation_id: 'omitted-revision-' + Date.now()};
    delete h.omitted.expected_revision;
    h.omissionRequest = {...h.edited.request, body: JSON.stringify(h.omitted)};
    return {observed: h.edited.request, adapted: h.omissionRequest, omittedKeyAbsent: !Object.prototype.hasOwnProperty.call(h.omitted, 'expected_revision'), current};`);
  assert.equal(prepared.omittedKeyAbsent, true);
  assert.equal(JSON.parse(prepared.observed.body).expected_revision, 1);
  assert.equal(prepared.current.status, 'draft'); assert.equal(prepared.current.revision, 2);
  const refused = await run('repro-omitted-send', `
    const before = await snapshot(h.ruth);
    const result = await h.ruth.evaluate(async request => {
      const response = await fetch(request.path, {method: request.method, headers: {'content-type': 'application/json'}, body: request.body});
      return {status: response.status, body: await response.json()};
    }, h.omissionRequest);
    h.omissionResult = {request: h.omissionRequest, result, before, after: await snapshot(h.ruth)};
    return h.omissionResult;`);
  assert.equal(refused.result.status, 400);
  assert.deepEqual(refused.before, refused.after);
  assert.match(refused.result.body.error, /Expected revision/i);
  pass('actual observed edit with genuinely omitted revision is refused 400 with unchanged state');
  const fresh = await run('repro-positive-ui-edit', `
    await reload(h.ruth);
    await h.ruth.getByRole('article').filter({has: h.ruth.getByRole('heading', {name: 'Oracle observed edit', exact: true})}).getByRole('button', {name: 'Edit draft', exact: true}).click();
    await h.ruth.getByLabel('Ballot title', {exact: true}).fill('Oracle fresh revision accepted');
    const saved = await exchange(h.ruth, 'fresh-ui-edit', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    return saved;`);
  assert.equal(fresh.status, 200);
  assert.equal(JSON.parse(fresh.request.body).expected_revision, 2);
  assert.equal(fresh.response.ballot.revision, 3);
  pass('normal current-revision UI edit still succeeds after the malformed probe');

  const lost = await run('repro-lost-create', `
    await createForm(h.ruth, 'Oracle recovery demonstration');
    h.lost = await exchange(h.ruth, 'lost-create', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click(), true);
    return {saved: h.lost, pending: await ids(h.ruth), actual: (await snapshot(h.ruth)).ballots.find(ballot => ballot.id === h.lost.response.ballot.id)};`);
  assert.equal(lost.saved.status, 201);
  const lostId = JSON.parse(lost.saved.request.body).operation_id;
  assert.deepEqual(lost.pending, [lostId]); assert.equal(lost.actual.title, 'Oracle recovery demonstration');
  const restored = await run('repro-lost-reload', `
    const count = h.writes.length; await reload(h.ruth);
    return {pending: await expectIds(h.ruth, [op(h.lost)]), automaticWrites: h.writes.length - count};`);
  assert.deepEqual(restored.pending, [lostId]); assert.equal(restored.automaticWrites, 0);
  const recovered = await run('repro-lost-retry', `
    const before = await snapshot(h.ruth), count = h.writes.length;
    const saved = await exchange(h.ruth, 'lost-retry', () => h.ruth.getByRole('button', {name: 'Retry', exact: true}).click());
    return {saved, pending: await ids(h.ruth), before, after: await snapshot(h.ruth), writes: h.writes.length - count, pageErrors: h.pageErrors};`);
  assert.deepEqual(recovered.saved.request, lost.saved.request);
  assert.deepEqual(recovered.saved.response, lost.saved.response);
  assert.equal(recovered.saved.replay, 'true'); assert.equal(recovered.saved.status, 201);
  assert.deepEqual(recovered.before, recovered.after); assert.deepEqual(recovered.pending, []);
  assert.equal(recovered.writes, 1); assert.deepEqual(recovered.pageErrors, []);
  pass('pinned MCP committed response loss survives reload and explicit exact UI Retry resolves once');
}
main().catch(error => { results.push({name: 'Oracle reproduction failure', passed: false, error: String(error)}); console.error(error); process.exitCode = 1; }).finally(() => {
  retain('reproduction-results', {mcpVersion: version, scoredOracle: false, actualExportedOracleApp: true,
    passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, results, stderr});
  child.kill();
});
