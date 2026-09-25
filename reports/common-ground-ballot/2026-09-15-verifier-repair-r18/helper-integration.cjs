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
const e = browser.__ballotEvidence;
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
  const row=await e.capture(p,label,act,{match:isStaff,mode:lose?'drop':'observe'});
  if(row.state!=='captured')throw new Error(JSON.stringify(row));
  const saved={request:{path:row.request.url.replace(/^https?:\/\/[^/]+/,''),method:row.request.method,body:JSON.stringify(row.request.body)},
    status:row.response.status,response:row.response.body,replay:row.response.replay||null,lost:lose};
  h.exchanges[label]=saved;
  if(lose){await p.locator('[data-pending-retry="'+op(saved)+'"]').waitFor({state:'visible'});
    await p.waitForFunction(id=>!document.querySelector('[data-pending-retry="'+id+'"]')?.disabled,op(saved));}
  else await p.locator('[data-pending-id="'+op(saved)+'"]').waitFor({state:'detached'});
  await p.waitForLoadState('networkidle');return saved;
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
async function legacyMain() {
  await call('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'ballot-recovery-smoke', version: '1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  const inventory = await call('tools/list', {});
  retain('inventory', {mcpVersion: version, tools: inventory.result.tools.map(tool => tool.name)});
  assert(inventory.result.tools.some(tool => tool.name === 'browser_run_code_unsafe'));
  await call('tools/call', {name: 'browser_navigate', arguments: {url: 'http://localhost:3000'}});
  const installed=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/tests/browser-evidence.js'}});
  retain('helper-installed',installed);assert(!installed.result?.isError);
  const setup = await run('setup', `
    browser.__recoverySmoke = {ruth: page, exchanges: {}, writes: [], pageErrors: []};
    return {identity: await signin(page, 'ruth')};`);
  assert.match(setup.identity, /ruth/i);
  const lost = await run('lost-create', `
    watch(h.ruth);
    await createForm(h.ruth, 'MCP recovery original');
    const saved = await exchange(h.ruth, 'original', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click(), true);
    h.original = saved;
    return {saved, pending: await ids(h.ruth), actual: (await snapshot(h.ruth)).ballots.find(ballot => ballot.id === saved.response.ballot.id)};`);
  assert.equal(lost.saved.status, 201);
  const originalId = JSON.parse(lost.saved.request.body).operation_id;
  assert.deepEqual(lost.pending, [originalId]);
  assert.equal(lost.actual.title, 'MCP recovery original');
  pass('pinned MCP captures a committed write before aborting its delivery');

  const restored = await run('reload-and-independent-edit', `
    const count = h.writes.length;
    await reload(h.ruth);
    const restored = await expectIds(h.ruth, [op(h.original)]), noReplayCount = h.writes.length - count;
    h.second = await (await browser.newContext()).newPage();
    await signin(h.second, 'ruth'); watch(h.second);
    await h.second.locator('[data-ballot-edit="' + h.original.response.ballot.id + '"]').click();
    await h.second.getByLabel('Ballot title', {exact: true}).fill('MCP recovery newest');
    const newer = await exchange(h.second, 'newer-edit', () => h.second.getByRole('button', {name: 'Save draft', exact: true}).click());
    return {restored, noReplayCount, newer};`);
  assert.deepEqual(restored.restored, [originalId]);
  assert.equal(restored.noReplayCount, 0);
  assert.equal(restored.newer.status, 200);
  pass('pending references survive separate MCP calls and reload without automatic retry');

  const retried = await run('exact-retry-newer-state', `
    const before = await snapshot(h.ruth), count = h.writes.length;
    const retried = await exchange(h.ruth, 'original-retry', () => h.ruth.locator('[data-pending-retry="' + op(h.original) + '"]').click());
    return {retried, before, after: await snapshot(h.ruth), writes: h.writes.length - count,
      pending: await ids(h.ruth), card: await h.ruth.locator('[data-ballot-card="' + h.original.response.ballot.id + '"]').innerText()};`);
  assert.deepEqual(retried.retried.request, lost.saved.request);
  assert.equal(retried.retried.status, lost.saved.status);
  assert.deepEqual(retried.retried.response, lost.saved.response);
  assert.equal(retried.retried.replay, 'true');
  assert.deepEqual(retried.before, retried.after);
  assert.equal(retried.writes, 1);
  assert.deepEqual(retried.pending, []);
  assert.match(retried.card, /MCP recovery newest/);
  pass('explicit MCP Retry preserves the exact request and refreshes newer state');

  const shared = await run('shared-tab-entries', `
    h.twin = await h.ruth.context().newPage(); await signin(h.twin, 'ruth'); watch(h.twin);
    await createForm(h.ruth, 'MCP pending tab one');
    h.one = await exchange(h.ruth, 'tab-one', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click(), true);
    await expectIds(h.twin, [op(h.one)]);
    await createForm(h.twin, 'MCP pending tab two');
    h.two = await exchange(h.twin, 'tab-two', () => h.twin.getByRole('button', {name: 'Save draft', exact: true}).click(), true);
    return {one: h.one, two: h.two, first: await expectIds(h.ruth, [op(h.one), op(h.two)]), twin: await ids(h.twin), sameContext: h.ruth.context() === h.twin.context()};`);
  const oneId = JSON.parse(shared.one.request.body).operation_id, twoId = JSON.parse(shared.two.request.body).operation_id;
  assert(shared.sameContext);
  assert.equal(shared.one.status, 201); assert.equal(shared.two.status, 201);
  assert.deepEqual(shared.first, [oneId, twoId].sort());
  assert.deepEqual(shared.twin, [oneId, twoId].sort());
  pass('same-context pages share two independent pending entries through MCP');

  const dismissed = await run('cross-tab-dismiss', `
    const before = await snapshot(h.ruth), count = h.writes.length;
    await h.ruth.locator('[data-pending-dismiss="' + op(h.one) + '"]').click();
    await expectIds(h.twin, [op(h.two)]);
    await reload(h.twin);
    return {before, after: await snapshot(h.ruth), writes: h.writes.length - count,
      first: await ids(h.ruth), twin: await ids(h.twin), feedback: await h.ruth.locator('#feedback-text').innerText()};`);
  assert.deepEqual(dismissed.before, dismissed.after);
  assert.equal(dismissed.writes, 0);
  assert.deepEqual(dismissed.first, [twoId]); assert.deepEqual(dismissed.twin, [twoId]);
  assert.match(dismissed.feedback, /reminder|dismiss/i);
  pass('cross-tab dismissal sends no write and cannot return after reload');

  for (const who of ['arun', 'leila', 'owen']) {
    const isolated = await run('account-isolation-' + who, `
      const count = h.writes.length;
      await signout(h.twin);
      await h.ruth.locator('#login-view').waitFor({state: 'visible'});
      const identity = await signin(h.twin, ${JSON.stringify(who)});
      return {identity, firstPending: await ids(h.ruth), twinPending: await ids(h.twin),
        firstLogin: await h.ruth.locator('#login-view').isVisible(), trayVisible: await h.twin.locator('#pending-actions').isVisible(),
        controls: await h.twin.locator('[data-pending-retry]').count(), writes: h.writes.length - count};`);
    assert.match(isolated.identity, new RegExp(who, 'i'));
    assert(isolated.firstLogin);
    assert.deepEqual(isolated.firstPending, []); assert.deepEqual(isolated.twinPending, []);
    assert.equal(isolated.trayVisible, false); assert.equal(isolated.controls, 0); assert.equal(isolated.writes, 0);
  }
  pass('sign-out and all three other accounts hide pending work in both same-profile tabs');

  const returned = await run('owner-restoration-and-resolve', `
    const count = h.writes.length;
    await signout(h.twin);
    await signin(h.ruth, 'ruth'); await reload(h.twin);
    const first = await expectIds(h.ruth, [op(h.two)]), twin = await expectIds(h.twin, [op(h.two)]);
    const automaticWrites = h.writes.length - count, before = await snapshot(h.ruth);
    const retried = await exchange(h.ruth, 'owner-return-retry', () => h.ruth.locator('[data-pending-retry="' + op(h.two) + '"]').click());
    await expectIds(h.twin, []); await reload(h.twin);
    return {first, twin, automaticWrites, retried, before, after: await snapshot(h.ruth), final: await ids(h.ruth), twinFinal: await ids(h.twin), pageErrors: h.pageErrors};`);
  assert.deepEqual(returned.first, [twoId]); assert.deepEqual(returned.twin, [twoId]);
  assert.equal(returned.automaticWrites, 0);
  assert.deepEqual(returned.retried.request, shared.two.request);
  assert.deepEqual(returned.retried.response, shared.two.response);
  assert.equal(returned.retried.replay, 'true');
  assert.deepEqual(returned.before, returned.after);
  assert.deepEqual(returned.final, []); assert.deepEqual(returned.twinFinal, []);
  assert.deepEqual(returned.pageErrors, []);
  pass('original-account return restores its saved entry and resolution reaches both tabs');
}
async function additional() {
  for (const family of (process.argv.includes('--boundary-only') ? [] : ['create', 'edit', 'open', 'close', 'publish', 'membership'])) {
    const saved = await run('family-' + family, `
      await reload(h.ruth);
      const family = ${JSON.stringify(family)};
      let act;
      if (family === 'create') {
        await createForm(h.ruth, 'Six family helper');
        act = () => h.ruth.getByRole('button', {name:'Save draft',exact:true}).click();
      } else if (family === 'edit') {
        await h.ruth.locator('[data-ballot-edit="'+h.familyId+'"]').click();
        await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Six family edited');
        act = () => h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
      } else if (family === 'membership') {
        await h.ruth.locator('.nav-item[data-view="members"]').click();
        act = () => h.ruth.locator('[data-member-id="user-owen"]').click();
      } else act = () => h.ruth.locator('[data-ballot-action="'+family+'"][data-id="'+h.familyId+'"]').click();
      h.familyLost = await exchange(h.ruth,'family-lost-'+family,act,true);
      if (family === 'create') h.familyId = h.familyLost.response.ballot.id;
      const writes = h.writes.length;
      await reload(h.ruth);
      return {saved:h.familyLost,pending:await ids(h.ruth),automaticWrites:h.writes.length-writes};`);
    assert(saved.saved.status >= 200 && saved.saved.status < 300);
    assert.deepEqual(saved.pending, [JSON.parse(saved.saved.request.body).operation_id]);
    assert.equal(saved.automaticWrites, 0);
    const replay = await run('family-retry-' + family, `
      const before=await snapshot(h.ruth);
      const saved=await exchange(h.ruth,'family-retry-'+${JSON.stringify(family)},()=>h.ruth.locator('[data-pending-retry="'+op(h.familyLost)+'"]').click());
      return {saved,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
    assert.deepEqual(replay.saved.request,saved.saved.request);
    assert.deepEqual(replay.saved.response,saved.saved.response);
    assert.equal(replay.saved.replay,'true');
    assert.deepEqual(replay.before,replay.after); assert.deepEqual(replay.pending,[]);
    pass('new helper captures lost '+family+' and exact visible retry after reload');
  }
  await run('omission-fixture', `
    await createForm(h.ruth,'Helper boundary');
    h.boundary=await exchange(h.ruth,'boundary-create',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    await h.ruth.locator('[data-ballot-edit="'+h.boundary.response.ballot.id+'"]').click();
    await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Helper valid edit');
    await exchange(h.ruth,'boundary-edit',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    return e.peek('boundary-edit');`);
  await run('omission-auth-read', `
    return await e.capture(h.ruth,'own-protected-read',()=>reload(h.ruth),{match:r=>r.method()==='GET'&&pathOf(r)==='/api/ballots'});`);
  await run('omission-prepare', `
    const malformed=e.adaptJson('boundary-edit',{set:{operation_id:'r18-omitted-'+Date.now()},omit:['expected_revision']});
    h.omissionBefore=await snapshot(h.ruth);h.malformed=malformed;
    await e.arm(h.ruth,'omitted-revision',{match:r=>r.method()===malformed.method&&r.url()===malformed.url});
    return {malformed,before:h.omissionBefore};`);
  await run('omission-send', `return await h.ruth.evaluate(async request=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const response=await fetch(request.url,{method:request.method,headers:{'content-type':'application/json'},body:request.body,signal:controller.signal});
      return {status:response.status,body:await response.json()};}finally{clearTimeout(timer);}
  },h.malformed);`);
  await run('omission-collect', `return await e.collect('omitted-revision');`);
  const boundary = await run('actual-omission', `
    const saved=e.peek('omitted-revision');
    let caught=false;try{e.adaptJson('boundary-edit',{omit:['invented_revision']});}catch(error){caught=true;}
    return {saved,before:h.omissionBefore,after:await snapshot(h.ruth),guardRefusesInventedField:caught};`);
  assert.equal(boundary.saved.state,'captured'); assert.equal(boundary.saved.response.status,400);
  assert(!Object.hasOwn(boundary.saved.request.body,'expected_revision'));
  assert.deepEqual(boundary.before,boundary.after); assert(boundary.guardRefusesInventedField);
  pass('actual omitted field refused 400; helper rejects an invented-field negative probe');

  for (const mode of ['unreadable','server-error']) {
    const value=await run('delivery-'+mode,`
      await createForm(h.ruth,'Helper '+${JSON.stringify(mode)});
      const saved=await e.capture(h.ruth,'delivery-'+${JSON.stringify(mode)},()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff,mode:${JSON.stringify(mode)}});
      await h.ruth.waitForLoadState('networkidle');
      h.deliveryOp=saved.request.body.operation_id;
      await h.ruth.locator('[data-pending-retry="'+h.deliveryOp+'"]').waitFor({state:'visible'});
      await reload(h.ruth);
      const before=await snapshot(h.ruth);
      const retry=await e.capture(h.ruth,'delivery-retry-'+${JSON.stringify(mode)},()=>h.ruth.locator('[data-pending-retry="'+h.deliveryOp+'"]').click(),{match:isStaff});
      await h.ruth.waitForLoadState('networkidle');
      return {saved,retry,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
    assert.equal(value.saved.response.status,201); assert.equal(value.retry.response.status,201);
    assert.deepEqual(value.saved.request,value.retry.request); assert.deepEqual(value.before,value.after);
    assert.deepEqual(value.pending,[]); pass('new helper '+mode+' delivery retains uncertainty and retries exactly');
  }
  await run('held-request-fixture',`
    await createForm(h.ruth,'Helper stale scheduling');
    const created=await exchange(h.ruth,'scheduled-create',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    h.scheduledId=created.response.ballot.id;
    h.scheduledOther=await (await browser.newContext()).newPage();await signin(h.scheduledOther,'ruth');
    await h.ruth.locator('[data-ballot-edit="'+h.scheduledId+'"]').click();
    await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Helper older attempted edit');
    await e.arm(h.ruth,'scheduled-stale',{match:isStaff,mode:'hold-request'});
    await h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('scheduled-stale').state!=='request-held';i++)await h.ruth.waitForTimeout(30);
    return e.peek('scheduled-stale');`);
  await run('held-request-intervening',`
    await h.scheduledOther.locator('[data-ballot-edit="'+h.scheduledId+'"]').click();
    await h.scheduledOther.getByLabel('Ballot title',{exact:true}).fill('Helper newest accepted edit');
    return await exchange(h.scheduledOther,'scheduled-newer',()=>h.scheduledOther.getByRole('button',{name:'Save draft',exact:true}).click());`);
  const stale=await run('held-request-refusal',`
    e.release('scheduled-stale','drop');
    const saved=await e.collect('scheduled-stale');
    await h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').waitFor({state:'visible'});
    await reload(h.ruth);const before=await snapshot(h.ruth);
    const retry=await e.capture(h.ruth,'scheduled-retry',()=>h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').click(),{match:isStaff});
    await h.ruth.waitForLoadState('networkidle');await reload(h.ruth);
    return {saved,retry,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
  assert.equal(stale.saved.response.status,409);assert.equal(stale.retry.response.status,409);
  assert.deepEqual(stale.saved.request,stale.retry.request);assert.deepEqual(stale.saved.response.body,stale.retry.response.body);
  assert.deepEqual(stale.before,stale.after);assert.deepEqual(stale.pending,[]);
  pass('held genuine current request becomes a valid stale refusal and exact UI retry preserves it');

  await run('held-arm',`
    await createForm(h.ruth,'Helper held-before-reload');
    await e.arm(h.ruth,'held-original',{match:isStaff,mode:'hold'});
    await h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('held-original').state!=='response-held';i++)await h.ruth.waitForTimeout(30);
    return e.peek('held-original');`);
  const held=await run('held-reload',`
    const saved=e.peek('held-original');
    const disabled=await h.ruth.getByRole('button',{name:'Save draft',exact:true}).isDisabled();
    const count=h.writes.length; await reload(h.ruth);
    const pending=await ids(h.ruth),automaticWrites=h.writes.length-count;
    e.release('held-original','drop');await e.collect('held-original');
    const retry=await e.capture(h.ruth,'held-retry',()=>h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').click(),{match:isStaff});
    await h.ruth.waitForLoadState('networkidle');
    return {saved,disabled,pending,automaticWrites,retry,final:await ids(h.ruth)};`);
  assert.equal(held.saved.state,'response-held'); assert(held.disabled);
  assert.equal(held.automaticWrites,0); assert.deepEqual(held.pending,[held.saved.request.body.operation_id]);
  assert.deepEqual(held.saved.request,held.retry.request); assert.deepEqual(held.final,[]);
  pass('held upstream reply survives separate calls and reload before delivery');

  const timed=await run('bounded-missing',`
    await e.arm(h.ruth,'no-action',{match:()=>false});
    return await e.collect('no-action',100);`);
  assert.equal(timed.state,'evidence-missing'); assert.match(timed.error,/exceeded/);
  let assertionSeen=false;
  try { await run('later-assertion',`
    await createForm(h.ruth,'Helper evidence survives');
    await e.capture(h.ruth,'before-assertion',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff});
    throw new Error('Intentional later assertion failure');`);
  } catch { assertionSeen=true; }
  assert(assertionSeen);
  const retained=await run('evidence-survived',`return {saved:e.peek('before-assertion'),all:e.dump()};`);
  assert.equal(retained.saved.state,'captured');assert.equal(retained.saved.response.status,201);
  assert(!JSON.stringify(retained).includes('CommonGround!2026'));
  pass('bounded missing capture does not block later fixture and later assertion cannot erase saved exchange');
}

async function main(){
  if(process.argv.includes('--boundary-only')){
    await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'boundary-isolation',version:'1'}});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
    await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/tests/browser-evidence.js'}});
    await run('setup',"browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};return {identity:await signin(page,'ruth')};");
  }else await legacyMain();
  await additional();
}
main().catch(async error=>{
  results.push({name:'helper integration failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return e.dump();');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/helper-results.json',redact({mcpVersion:version,scoredOracle:false,helperLoadedByFilename:true,
    passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));
  child.kill();
});
