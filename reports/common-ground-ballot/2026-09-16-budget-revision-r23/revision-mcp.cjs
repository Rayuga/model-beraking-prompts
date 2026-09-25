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
function retain(name, value) { fs.writeFileSync(`/results/revision-${name}.json`, redact(value), {mode: 0o600}); }
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
const variant = process.env.REVISION_MUTANT || 'golden';
const observations = [];
const revisionSupport = `
const g = browser.__revisionCheck;
const card = (p,title) => p.getByRole('article').filter({has:p.getByRole('heading',{name:title,exact:true})});
async function fresh(p) {
  // Match a request from the new document, never a trailing old-page refresh
  // whose response body disappears when the browser reloads.
  let navigated=false;const requests=new Set();
  const onNavigation=frame=>{if(frame===p.mainFrame())navigated=true;};
  const onRequest=request=>{if(navigated&&request.method()==='GET'&&request.url()===g.collectionUrl)requests.add(request);};
  p.on('framenavigated',onNavigation);p.on('request',onRequest);
  try{
    const pending=p.waitForResponse(r=>requests.has(r.request()),{timeout:15000}).then(async response=>({status:response.status(),body:await response.json()}));
    await p.reload();const saved=await pending;
    await p.waitForLoadState('networkidle',{timeout:5000});return saved;
  }finally{p.removeListener('framenavigated',onNavigation);p.removeListener('request',onRequest);}
}
async function write(p, action) {
  const pending=p.waitForResponse(r=>!['GET','HEAD','OPTIONS'].includes(r.request().method()),{timeout:15000});
  await action(); const response=await pending;
  const saved={method:response.request().method(),url:response.url(),request:response.request().postData(),status:response.status(),body:await response.json()};
  g.exchanges.push(saved); await p.waitForLoadState('networkidle',{timeout:5000}); return saved;
}
`;
const observe = (name, body) => run(name, revisionSupport + body);
async function vote(actor, title, labels) {
  const data = await observe('vote-' + actor + '-' + observations.length, `
    const actor=g[${JSON.stringify(actor)}],title=${JSON.stringify(title)};
    const beforeRead=await fresh(g.ruth),before=beforeRead.body.ballots.find(b=>b.title===title);
    const memberBefore=await fresh(actor);
    await actor.getByRole('button',{name:'Vote',exact:true}).click();
    await card(actor,title).getByRole('button',{name:'Cast your ballot',exact:true}).click();
    for(const label of ${JSON.stringify(labels)})await actor.getByLabel(label,{exact:true}).check();
    await actor.getByLabel('I understand this is my one final submission.',{exact:true}).check();
    const mutation=await write(actor,()=>actor.getByRole('button',{name:'Submit final ballot',exact:true}).click({timeout:5000}));
    const afterRead=await fresh(g.ruth),after=afterRead.body.ballots.find(b=>b.id===before.id);
    const memberAfter=await fresh(actor);
    return {actor:${JSON.stringify(actor)},beforeReadStatus:beforeRead.status,afterReadStatus:afterRead.status,
      before,after,exchange:mutation,memberBefore:memberBefore.body.ballots.find(b=>b.id===before.id),
      memberAfter:memberAfter.body.ballots.find(b=>b.id===before.id)};`);
  assert.equal(data.beforeReadStatus,200); assert.equal(data.afterReadStatus,200);
  assert.equal(data.exchange.status,201); assert.equal(data.exchange.body.participated,true);
  assert.equal(data.memberBefore.participated,false); assert.equal(data.memberAfter.participated,true);
  assert.equal(data.before.id,data.after.id); assert.equal(data.before.status,'open'); assert.equal(data.after.status,'open');
  assert.equal(data.after.turnout.participated,data.before.turnout.participated+1);
  assert(Number.isInteger(data.before.revision)&&Number.isInteger(data.after.revision));
  const observation={actor,method:data.before.method,title,id:data.before.id,before:data.before.revision,after:data.after.revision,
    accepted:true,participationRecorded:true,unchanged:data.before.revision===data.after.revision};
  observations.push(observation); retain('observations',observations);
  return observation;
}
async function main() {
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'vote-revision-check',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const baseline = await run('authenticated-baseline', `
    browser.__revisionCheck={ruth:page,exchanges:[]};const g=browser.__revisionCheck,reads=[],jobs=[];
    const listener=r=>{if(r.request().method()==='GET')jobs.push(r.json().then(body=>{if(Array.isArray(body.ballots)&&body.ballots.length)reads.push({url:r.url(),body});}).catch(()=>{}));};
    page.on('response',listener);const identity=await signin(page,'ruth');await Promise.all(jobs);page.removeListener('response',listener);
    if(!reads.length)throw new Error('Missing observed protected collection');g.collectionUrl=reads.at(-1).url;
    g.leila=await(await browser.newContext()).newPage();await signin(g.leila,'leila');
    g.owen=await(await browser.newContext()).newPage();await signin(g.owen,'owen');
    return {identity,records:reads.at(-1).body.ballots.length};`);
  assert.match(baseline.identity,/Ruth/);assert.equal(baseline.records,4);
  await vote('owen','Courtyard closing time',['Keep 8 pm']);
  await vote('leila','Courtyard closing time',['Extend to 9 pm']);
  const approvalTitle='Revision approval '+Date.now();
  const creation=await observe('create-approval', `
    await createForm(g.ruth,${JSON.stringify(approvalTitle)});
    await g.ruth.getByLabel('Voting method',{exact:true}).selectOption('approval');
    await g.ruth.getByLabel('Maximum approvals',{exact:true}).fill('2');
    await g.ruth.locator('input[name=choice]').nth(1).fill('Afternoon');
    await g.ruth.getByRole('button',{name:'Add another choice',exact:true}).click();
    await g.ruth.locator('input[name=choice]').nth(2).fill('Evening');
    const created=await write(g.ruth,()=>g.ruth.getByRole('button',{name:'Save draft',exact:true}).click({timeout:5000}));
    const opened=await write(g.ruth,()=>card(g.ruth,${JSON.stringify(approvalTitle)}).getByRole('button',{name:'Open ballot',exact:true}).click({timeout:5000}));
    return {created,opened};`);
  assert.equal(creation.created.status,201);assert.equal(creation.opened.body.ballot.status,'open');
  await vote('leila',approvalTitle,['Morning','Evening']);

  // Demonstrate the reported false-pass case: relative lifecycle increments can
  // still be correct after votes have already corrupted the revision.
  const lifecycle=await observe('relative-close-control', `
    const beforeRead=await fresh(g.ruth),before=beforeRead.body.ballots.find(b=>b.title==='Courtyard closing time');
    const mutation=await write(g.ruth,()=>card(g.ruth,'Courtyard closing time').getByRole('button',{name:'Close voting',exact:true}).click({timeout:5000}));
    const afterRead=await fresh(g.ruth),after=afterRead.body.ballots.find(b=>b.id===before.id);
    return {before,after,exchange:mutation};`);
  assert.equal(lifecycle.after.status,'closed');assert.equal(lifecycle.after.revision,lifecycle.before.revision+1);
  const expectedMethod=variant==='single_increment'?'single':variant==='approval_increment'?'approval':null;
  for(const row of observations){
    const bad=variant==='vote_increment'||row.method===expectedMethod;
    assert.equal(row.after-row.before,bad?1:0,JSON.stringify(row));
  }
  const criterionPassed=observations.every(row=>row.unchanged);
  assert.equal(criterionPassed,variant==='golden');
  retain('verdict',{variant,passed:true,criterionPassed,observations,lifecycleStillAdvancesExactlyOne:true,scoredOracle:false});
  console.log(JSON.stringify({variant,criterionPassed,revisions:observations.map(row=>[row.method,row.before,row.after]),lifecycleControl:true}));
}
main().catch(error=>{console.error(error);retain('failure',{error:String(error),stderr,observations});process.exitCode=1;}).finally(()=>child.kill());
