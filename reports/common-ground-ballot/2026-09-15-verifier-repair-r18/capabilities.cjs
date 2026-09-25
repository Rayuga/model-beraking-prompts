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
  await call('initialize', {protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'helper-loading-test',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const listing=await call('tools/list',{});
  retain('helper-tool-schema',listing.result.tools.filter(tool=>tool.name==='browser_run_code_unsafe'));
  await call('tools/call',{name:'browser_navigate',arguments:{url:'about:blank'}});
  const result=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code:`async(page)=>{const result={requireType:typeof require,processType:typeof process,setTimeoutType:typeof setTimeout};try{const fs=await import('node:fs');result.dynamicImport=true;result.readFileType=typeof fs.readFileSync;}catch(error){result.dynamicImport=false;result.importError=String(error);}return result;}`}});
  retain('helper-capabilities',result);
  console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>child.kill());
