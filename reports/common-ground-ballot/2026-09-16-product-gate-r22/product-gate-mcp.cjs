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
const variant = process.env.PRODUCT_GATE_MUTANT || 'golden';
const gateSteps = [];
let blocked = null;
async function step(name, code, assess) {
  let value;
  try {
    value = await run('gate-' + name, code);
    assess(value);
    gateSteps.push({name, passed: true});
    return value;
  } catch (error) {
    blocked = {name, error: String(error), failureType: value === undefined ? 'tool-or-ui-execution' : 'observed-outcome',
      observedStatus: value?.status ?? value?.readStatus ?? null};
    gateSteps.push({name, passed: false, ...blocked});
    throw error;
  }
}
const gateSupport = `
const g = browser.__productGate;
const card = p => p.getByRole('article').filter({has:p.getByRole('heading',{name:g.title,exact:true})});
async function write(p, action) {
  const pending = p.waitForResponse(response => !['GET','HEAD','OPTIONS'].includes(response.request().method()), {timeout:15000});
  // A403 can hide/detach the originating controls while Playwright is still
  // settling the click. Capture its response independently of that click's
  // completion, and do not wait for a success UI after a rejected mutation.
  const actionResult=Promise.resolve().then(action).then(()=>({completed:true}),error=>({completed:false,error:String(error)}));
  const response=await pending;
  const saved={method:response.request().method(),url:response.url(),body:response.request().postData(),status:response.status(),response:await response.json()};
  g.exchanges.push(saved);
  if(response.status()<200||response.status()>=300)return saved;
  saved.action=await actionResult;
  try{await p.waitForLoadState('networkidle',{timeout:5000});}catch(error){saved.settlingNote=String(error);}
  return saved;
}
async function refreshed(p) {
  const pending=p.waitForResponse(response=>response.request().method()==='GET'&&response.url()===g.collectionUrl,{timeout:15000});
  await p.reload(); const response=await pending;
  const body=await response.json(); await p.waitForLoadState('networkidle',{timeout:5000});
  return {status:response.status(),body};
}
`;
async function gateRun(name, body, assess) { return step(name, gateSupport + body, assess); }
async function main() {
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'product-workflow-gate',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const baseline=await run('gate-authenticated-read-positive', `
    browser.__productGate={ruth:page,title:'Product gate '+Date.now(),exchanges:[]};
    const state=browser.__productGate, observations=[], jobs=[];
    const listener=response=>{
      if(response.request().method()!=='GET')return;
      jobs.push(response.json().then(body=>{if(body&&Array.isArray(body.ballots)&&body.ballots.length)observations.push({url:response.url(),status:response.status(),body});}).catch(()=>{}));
    };
    page.on('response',listener); const identity=await signin(page,'ruth');
    await Promise.all(jobs); page.removeListener('response',listener);
    if(!observations.length)throw new Error('No populated protected read observed after real sign-in');
    const observed=observations[observations.length-1]; state.collectionUrl=observed.url;
    return {identity,collectionStatus:observed.status,initialRecords:observed.body.ballots.length,title:state.title};`);
  assert.match(baseline.identity,/ruth/i); assert.equal(baseline.collectionStatus,200); assert(baseline.initialRecords>0);
  pass('legitimate sign-in and real populated protected read work before the mandatory workflow');
  let gateError;
  try {
    const created=await gateRun('create', `
      await createForm(g.ruth,g.title);
      const saved=await write(g.ruth,()=>g.ruth.getByRole('button',{name:'Save draft',exact:true}).click({timeout:5000,noWaitAfter:true}));
      if(saved.response.ballot)g.ballotId=saved.response.ballot.id;
      return saved;`, value=>{
      assert(value.status>=200&&value.status<300);assert.equal(value.response.ballot.title,baseline.title);
      assert.equal(value.response.ballot.status,'draft');assert.equal(value.response.ballot.method,'single');
      assert.deepEqual(value.response.ballot.choices.map(choice=>choice.label),['Morning','Evening']);
    });
    await gateRun('open', `const saved=await write(g.ruth,()=>card(g.ruth).getByRole('button',{name:'Open ballot',exact:true}).click({timeout:5000,noWaitAfter:true}));return saved;`, value=>{
      assert(value.status>=200&&value.status<300);assert.equal(value.response.ballot.status,'open');assert.equal(value.response.ballot.id,created.response.ballot.id);
    });
    await gateRun('member-vote', `
      g.leila=await (await browser.newContext()).newPage(); const identity=await signin(g.leila,'leila');
      await g.leila.getByRole('button',{name:'Vote',exact:true}).click();
      await card(g.leila).getByRole('button',{name:'Cast your ballot',exact:true}).click();
      await g.leila.getByLabel('Morning',{exact:true}).check();
      await g.leila.getByLabel('I understand this is my one final submission.',{exact:true}).check();
      const saved=await write(g.leila,()=>g.leila.getByRole('button',{name:'Submit final ballot',exact:true}).click({timeout:5000,noWaitAfter:true}));
      return {identity,independent:g.leila.context()!==g.ruth.context(),saved};`, value=>{
      assert.match(value.identity,/leila/i);assert(value.independent);assert(value.saved.status>=200&&value.saved.status<300);assert.equal(value.saved.response.participated,true);
    });
    await gateRun('close', `await refreshed(g.ruth);return await write(g.ruth,()=>card(g.ruth).getByRole('button',{name:'Close voting',exact:true}).click({timeout:5000,noWaitAfter:true}));`, value=>{
      assert(value.status>=200&&value.status<300);assert.equal(value.response.ballot.status,'closed');
    });
    await gateRun('publish', `return await write(g.ruth,()=>card(g.ruth).getByRole('button',{name:'Publish results',exact:true}).click({timeout:5000,noWaitAfter:true}));`, value=>{
      assert(value.status>=200&&value.status<300);assert.equal(value.response.ballot.status,'published');
    });
    await gateRun('fresh-published-record', `
      const fresh=await refreshed(g.ruth);
      const memberFresh=await refreshed(g.leila);
      await g.ruth.getByRole('button',{name:'Results',exact:true}).click();
      await g.ruth.waitForLoadState('networkidle');
      const record=fresh.body.ballots.find(ballot=>ballot.id===g.ballotId);
      const resultPanel=g.ruth.getByRole('article').filter({has:g.ruth.getByRole('heading',{name:g.title,exact:true})});
      const count=await resultPanel.count(), visible=count>0&&await resultPanel.first().isVisible();
      return {readStatus:fresh.status,record,memberReadStatus:memberFresh.status,memberRecord:memberFresh.body.ballots.find(ballot=>ballot.id===g.ballotId),resultVisible:visible,resultText:visible?await resultPanel.first().innerText():null};`, value=>{
      assert.equal(value.readStatus,200);assert(value.record);assert.equal(value.record.id,created.response.ballot.id);
      assert.equal(value.record.title,baseline.title);assert.equal(value.record.status,'published');
      assert.deepEqual(value.record.choices.map(choice=>choice.label),['Morning','Evening']);
      assert.equal(value.record.total_ballots,1);assert.equal(value.record.results.find(row=>row.label==='Morning').votes,1);
      assert(value.resultVisible);assert.match(value.resultText,/Morning/);assert.match(value.resultText,/1 vote/);
      assert.equal(value.memberReadStatus,200);assert.equal(value.memberRecord.id,created.response.ballot.id);
      assert.equal(value.memberRecord.status,'published');assert.equal(value.memberRecord.participated,true);
    });
  } catch(error) { gateError=String(error);if(!blocked)blocked={name:'tool-or-ui-execution',error:gateError}; }
  const gatePassed=!gateError;
  retain('product-gate-verdict',{variant,gatePassed,baseline,steps:gateSteps,blocked,scoredOracle:false,
    explanation:'One mandatory UI workflow; no detailed Functional score is inferred.'});
  if(variant==='golden')assert(gatePassed,gateError);
  else{
    assert.equal(gatePassed,false,'Incomplete product escaped the mandatory workflow gate');
    assert.equal(blocked.name,({readonly:'create',create_only:'open',publish_stub:'fresh-published-record'})[variant],JSON.stringify(blocked));
    assert.equal(blocked.failureType,'observed-outcome','A tool timeout is not evidence that the incomplete app was rejected');
    if(variant!=='publish_stub')assert.equal(blocked.observedStatus,405,'The mutation refusal must be captured before the expected-failure assertion');
  }
  pass(variant==='golden'?'golden completes the new custom ballot workflow and fresh published read':variant+' is rejected despite working authentication and populated backend reads');
}
main().catch(error=>{results.push({name:'Product gate regression failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;}).finally(()=>{
  retain('product-gate-results',{mcpVersion:version,variant,scoredOracle:false,passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length,results,stderr});
  child.kill();
});
