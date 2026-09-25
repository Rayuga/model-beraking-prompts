const {spawn} = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const version = require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(version, '0.0.79');
fs.mkdirSync('/results', {recursive: true});
const child = spawn('playwright-mcp', ['--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], {cwd: '/opt/common-ground-verifier', stdio: ['pipe', 'pipe', 'pipe']});
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

const extra = String.raw`
async function enter(p,who){
  await p.getByLabel('Email',{exact:true}).fill(accounts[who]+'@commonground.example');
  await p.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
  await p.getByRole('button',{name:'Sign in',exact:true}).click();
  await p.locator('#app-view').waitFor({state:'visible'});
  await p.waitForFunction(who=>document.querySelector('#user-name').textContent.startsWith(who),{ruth:'Ruth',arun:'Arun',leila:'Leila',owen:'Owen'}[who]);
}
async function revoke(){
  await signin(h.b,'ruth');
  h.b.once('dialog',dialog=>dialog.accept());
  await h.b.getByRole('button',{name:'End all sessions',exact:true}).click();
  await h.b.locator('#login-view').waitFor({state:'visible'});
}
async function lost(title,label){
  await createForm(h.ruth,title);
  return exchange(h.ruth,label,()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click(),true);
}
async function held(label){
  for(let i=0;i<150&&e.peek(label).state!=='response-held';i++)await page.waitForTimeout(20);
  return e.peek(label);
}
`;
async function step(name,body){return run(name,extra+'\n'+body);}
async function main(){
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'identity-and-revision-checkpoints',version:'r25'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});
  await step('setup',`browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};return {identity:await signin(page,'ruth')};`);
  await step('other-actors',`
    watch(h.ruth);h.b=await (await browser.newContext()).newPage();await signin(h.b,'ruth');
    h.owen=await (await browser.newContext()).newPage();await signin(h.owen,'owen');
    h.leila=await (await browser.newContext()).newPage();await signin(h.leila,'leila');
    await createForm(h.ruth,'Revision approval checkpoint');await h.ruth.getByLabel('Voting method').selectOption('approval');
    await h.ruth.getByLabel('Maximum approvals').fill('2');
    h.approval=await exchange(h.ruth,'revision-create',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    h.approvalId=h.approval.response.ballot.id;
    await exchange(h.ruth,'revision-open',()=>h.ruth.locator('[data-ballot-action="open"][data-id="'+h.approvalId+'"]').click());
    return {id:h.approvalId};`);
  for(const [who,which,choices] of [['owen','single',['Keep 8 pm']],['leila','single',['Extend to 9 pm']],['leila','approval',['Morning','Evening']]]){
    const row=await step(`vote-${who}-${which}`,`
      const p=h[${JSON.stringify(who)}],id=${JSON.stringify(which)}==='single'?'ballot-open-courtyard':h.approvalId;
      await reload(p);await p.locator('.nav-item[data-view="vote"]').click();
      await p.locator('[data-vote-id="'+id+'"]').click();
      for(const choice of ${JSON.stringify(choices)})await p.getByLabel(choice,{exact:true}).check();
      await p.locator('#vote-confirm').check();
      const before=await read(p,'/api/ballots');
      const accepted=await e.capture(p,'vote-'+${JSON.stringify(who+'-'+which)},()=>p.getByRole('button',{name:'Submit final ballot',exact:true}).click(),{match:r=>r.method()==='POST'&&r.url().endsWith('/vote')});
      await p.locator('#vote-dialog').waitFor({state:'hidden'});await reload(p);
      const after=await read(p,'/api/ballots');
      return {before:before.body.ballots.find(b=>b.id===id),accepted,after:after.body.ballots.find(b=>b.id===id)};`);
    assert.equal(row.accepted.response.status,201);assert.equal(row.before.revision,row.after.revision);
    pass(`retained before/vote/after checkpoint: ${who} ${which}`);
  }
  const preflight=await step('expired-preflight',`
    h.pending=await lost('Original actor checkpoint','identity-pending');await revoke();
    const writes=h.writes.length;
    const denial=await e.capture(h.ruth,'preflight-denial',()=>h.ruth.locator('[data-pending-retry="'+op(h.pending)+'"]').click(),{match:r=>r.method()==='GET'&&r.url().endsWith('/api/me')});
    await h.ruth.locator('#login-view').waitFor({state:'visible'});
    const protectedRead=await read(h.ruth,'/api/ballots');
    await enter(h.ruth,'ruth');const restored=await ids(h.ruth),automaticWrites=h.writes.length-writes;
    const retry=await exchange(h.ruth,'preflight-positive',()=>h.ruth.locator('[data-pending-retry="'+op(h.pending)+'"]').click());
    return {denial,protectedRead,restored,automaticWrites,retry,pending:await ids(h.ruth)};`);
  assert.equal(preflight.denial.response.status,200);assert.equal(preflight.denial.response.body.user,null);
  assert.equal(preflight.protectedRead.status,401);assert.equal(preflight.restored.length,1);
  assert.equal(preflight.automaticWrites,0);assert.equal(preflight.retry.status,201);assert.deepEqual(preflight.pending,[]);
  pass('expired-session preflight and denied protected read retain work for genuine sign-in');

  const heldSuccess=await step('late-success-arm',`
    h.late=await lost('Ruth private retry note','late-success-pending');
    await e.arm(h.ruth,'late-success',{match:isStaff,mode:'hold'});
    await h.ruth.locator('[data-pending-retry="'+op(h.late)+'"]').click();return held('late-success');`);
  assert.equal(heldSuccess.state,'response-held');assert.equal(heldSuccess.response.status,201);
  const success=await step('late-success-release',`
    await signout(h.ruth);await enter(h.ruth,'leila');const writes=h.writes.length;
    e.release('late-success','deliver');await e.collect('late-success');await h.ruth.waitForTimeout(200);
    return {identity:(await read(h.ruth,'/api/me')).body.user,feedback:await h.ruth.locator('#feedback-text').innerText(),pending:await ids(h.ruth),writes:h.writes.length-writes,read:await read(h.ruth,'/api/ballots')};`);
  assert.equal(success.identity.id,'user-leila');assert.equal(success.read.status,200);assert.equal(success.writes,0);
  assert.deepEqual(success.pending,[]);assert(!success.feedback.includes('Ruth private retry note'));assert(!success.feedback.includes('Original action'));
  pass('late successful Retry cannot contaminate the next Member session');

  const heldDenial=await step('late-denial-arm',`
    await signout(h.ruth);await enter(h.ruth,'ruth');
    h.denied=await lost('Ruth retained after delay','late-denial-pending');await revoke();
    await e.arm(h.ruth,'late-denial',{match:r=>r.method()==='GET'&&r.url().endsWith('/api/me'),mode:'hold'});
    await h.ruth.locator('[data-pending-retry="'+op(h.denied)+'"]').click();return held('late-denial');`);
  assert.equal(heldDenial.state,'response-held');assert.equal(heldDenial.response.body.user,null);
  const denial=await step('late-denial-release',`
    await signout(h.ruth);await enter(h.ruth,'arun');const writes=h.writes.length;
    e.release('late-denial','deliver');await e.collect('late-denial');await h.ruth.waitForTimeout(200);
    const identity=(await read(h.ruth,'/api/me')).body.user,feedback=await h.ruth.locator('#feedback-text').innerText(),pending=await ids(h.ruth),normalRead=await read(h.ruth,'/api/ballots');
    await signout(h.ruth);await enter(h.ruth,'ruth');const restored=await ids(h.ruth),automaticWrites=h.writes.length-writes;
    const retry=await exchange(h.ruth,'late-denial-positive',()=>h.ruth.locator('[data-pending-retry="'+op(h.denied)+'"]').click());
    return {identity,feedback,pending,normalRead,restored,automaticWrites,retry,errors:h.pageErrors};`);
  assert.equal(denial.identity.id,'user-arun');assert.equal(denial.normalRead.status,200);assert.deepEqual(denial.pending,[]);
  assert(!denial.feedback.includes('Ruth retained'));assert.equal(denial.restored.length,1);assert.equal(denial.automaticWrites,0);
  assert.equal(denial.retry.status,201);assert.deepEqual(denial.errors,[]);
  pass('late signed-out preflight cannot replace the Observer session or erase Ruth recovery');
  const abandoned=await step('abandoned-tab-arm',`
    h.abandoned=await lost('Recover after tab closure','abandoned-pending');
    h.owner=await h.ruth.context().newPage();await h.owner.goto('http://localhost:3000');await h.owner.locator('#app-view').waitFor({state:'visible'});
    await e.arm(h.owner,'abandoned-owner',{match:isStaff,mode:'hold'});
    await h.owner.locator('[data-pending-retry="'+op(h.abandoned)+'"]').click();return held('abandoned-owner');`);
  assert.equal(abandoned.state,'response-held');assert.equal(abandoned.response.status,201);
  const recovered=await step('abandoned-tab-recovery',`
    const writes=h.writes.length;await h.owner.close();e.release('abandoned-owner','drop');await e.collect('abandoned-owner');
    await reload(h.ruth);const pending=await ids(h.ruth),automaticWrites=h.writes.length-writes;
    const enabled=await h.ruth.locator('[data-pending-retry="'+op(h.abandoned)+'"]').isEnabled();
    const retry=await exchange(h.ruth,'abandoned-survivor-retry',()=>h.ruth.locator('[data-pending-retry="'+op(h.abandoned)+'"]').click());
    return {pending,automaticWrites,enabled,retry,original:h.abandoned,final:await ids(h.ruth)};`);
  assert.equal(recovered.pending.length,1);assert.equal(recovered.automaticWrites,0);assert(recovered.enabled);
  assert.deepEqual(recovered.original.request,recovered.retry.request);assert.equal(recovered.retry.status,201);assert.deepEqual(recovered.final,[]);
  pass('closing the Retry owner releases the lock and preserves explicit recovery in the surviving tab');
}
main().catch(async error=>{
  results.push({name:'identity failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return {evidence:e.dump(),errors:h.pageErrors,html:await page.locator("body").innerText()};');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/identity-results.json',redact({mcpVersion:version,scoredOracle:false,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));
  child.kill();
});
