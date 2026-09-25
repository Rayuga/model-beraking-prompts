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

const observations=[];
const gptSupport=String.raw`
const isWrite=r=>['POST','PATCH'].includes(r.method())&&/^\/api\/(ballots|memberships)/.test(pathOf(r));
async function enter(p,who){
  await p.locator('#email').fill(accounts[who]+'@commonground.example');await p.locator('#password').fill('CommonGround!2026');
  await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('#workspace').waitFor({state:'visible'});
  await p.waitForFunction(name=>document.querySelector('#identity').textContent.startsWith(name),{ruth:'Ruth',leila:'Leila',arun:'Arun'}[who]);
  await p.locator('#view-panel h2').waitFor({state:'visible'});
}
async function login(p,who){await p.goto('http://localhost:3000');await enter(p,who);}
async function logout(p){await p.locator('#logout').click();await p.locator('#sign-in').waitFor({state:'visible'});}
async function ready(p){await p.waitForLoadState('networkidle');}
async function create(p,title,label,mode='observe'){
  const f=p.locator('form[data-mutation="ballot-create"]');await f.locator('[name=title]').fill(title);
  await f.locator('[name=description]').fill('Original context');await f.locator('[name=choices]').fill('Yes\nNo');
  const row=await e.capture(p,label,()=>f.getByRole('button',{name:'Create draft',exact:true}).click(),{match:isWrite,mode});
  await ready(p);return row;
}
async function submitEdit(p,label,id,fields){
  const f=p.locator('form[data-mutation="ballot-edit"][data-ballot-id="'+id+'"]');
  for(const [name,value] of Object.entries(fields))await f.locator('[name="'+name+'"]').fill(value);
  const row=await e.capture(p,label,()=>f.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isWrite});await ready(p);return row;
}
async function observeRead(p){return read(p,'/api/views/ballots');}
`;
async function step(name,body){return run(name,gptSupport+'\n'+body);}
async function main(){
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'preserved-gpt-submission-replay',version:'r25'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});
  await step('setup',`browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};await enter(page,'ruth');return await observeRead(page);`);
  const review=await step('missing-review',`
    h.ruth.on('request',r=>{if(isWrite(r))h.writes.push({url:r.url(),body:r.postData()});});
    const created=await create(h.ruth,'Replay review draft','gpt-review-create');
    h.record=(await observeRead(h.ruth)).body.items.find(b=>b.title==='Replay review draft');
    h.b=await (await browser.newContext()).newPage();await login(h.b,'ruth');
    const f=h.ruth.locator('form[data-mutation="ballot-edit"][data-ballot-id="'+h.record.id+'"]');await f.locator('[name=title]').fill('Unsaved local review title');
    await submitEdit(h.b,'gpt-other-edit',h.record.id,{description:'Remote context to retain'});
    const refused=await e.capture(h.ruth,'gpt-stale-edit',()=>f.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isWrite});await ready(h.ruth);
    return {created,refused,formTitle:await h.ruth.locator('form[data-mutation="ballot-edit"][data-ballot-id="'+h.record.id+'"] [name=title]').inputValue(),visibleText:await h.ruth.locator('#workspace').innerText(),buttons:await h.ruth.getByRole('button').allTextContents(),current:await observeRead(h.ruth)};`);
  assert.equal(review.created.response.status,201);assert.equal(review.refused.response.status,409);
  assert.equal(review.formTitle,'Replay review draft');
  assert(!review.buttons.some(x=>/review|merge|keep yours|keep latest|discard.*changes/i.test(x)));
  observations.push({criterion:'five draft-review outcomes',outcome:'missing',evidence:'A real stale UI edit returned 409, then the working title was overwritten by the saved title. There is no review/merge/resolution/discard path in the visible controls.'});
  pass('previous GPT has a real accepted-edit control but loses the stale working copy and lacks review');

  const sharing=await step('same-profile-pending',`
    h.pending=await create(h.ruth,'Replay pending original','gpt-pending-original','drop');
    h.pendingId=h.pending.request.body.operationId;
    await h.ruth.locator('[data-pending-retry="'+h.pendingId+'"]').waitFor({state:'visible'});
    h.twin=await h.ruth.context().newPage();await h.twin.goto('http://localhost:3000');await h.twin.locator('#workspace').waitFor({state:'visible'});await ready(h.twin);
    return {original:await h.ruth.locator('[data-pending-retry]').count(),otherTab:await h.twin.locator('[data-pending-retry]').count(),pendingId:h.pendingId};`);
  observations.push({criterion:'cross_tab_pending_resolution',outcome:'initial sharing works',evidence:sharing,limit:'Only initial pending visibility was replayed, not the complete existing cross-tab criterion.'});
  pass('recorded actual same-profile pending visibility without assuming the old judge verdict');

  const held=await step('late-success-arm',`
    await e.arm(h.ruth,'gpt-late-success',{match:isWrite,mode:'hold'});
    await h.ruth.locator('[data-pending-retry="'+h.pendingId+'"]').click();
    for(let i=0;i<100&&e.peek('gpt-late-success').state!=='response-held';i++)await h.ruth.waitForTimeout(25);
    return e.peek('gpt-late-success');`);
  assert.equal(held.state,'response-held');assert.equal(held.response.status,201);
  const late=await step('late-success-release',`
    await logout(h.ruth);await enter(h.ruth,'leila');const before=await h.ruth.locator('#banner-text').innerText();
    const writes=h.writes.length;e.release('gpt-late-success','deliver');await e.collect('gpt-late-success');await h.ruth.waitForTimeout(300);
    return {before,after:await h.ruth.locator('#banner-text').innerText(),identity:await h.ruth.locator('#identity').innerText(),writes:h.writes.length-writes,protectedRead:await observeRead(h.ruth)};`);
  assert.match(late.identity,/Leila/);assert.equal(late.protectedRead.status,200);
  observations.push({criterion:'late_recovery_reply_isolation',outcome:late.before!==late.after?'old-action feedback replaced the new account feedback':'no replacement observed',evidence:late});
  pass('captured delayed Retry outcome after a genuine account switch');
  const owner=await step('abandoned-tab-arm',`
    await logout(h.ruth);await enter(h.ruth,'ruth');
    h.abandoned=await create(h.ruth,'GPT abandoned Retry','gpt-abandoned-original','drop');h.abandonedId=h.abandoned.request.body.operationId;
    await h.twin.reload();await h.twin.locator('#workspace').waitFor({state:'visible'});await ready(h.twin);
    await e.arm(h.twin,'gpt-abandoned-owner',{match:isWrite,mode:'hold'});
    await h.twin.locator('[data-pending-retry="'+h.abandonedId+'"]').click();
    for(let i=0;i<100&&e.peek('gpt-abandoned-owner').state!=='response-held';i++)await h.ruth.waitForTimeout(25);
    return e.peek('gpt-abandoned-owner');`);
  assert.equal(owner.state,'response-held');assert.equal(owner.response.status,201);
  const stranded=await step('abandoned-tab-recovery',`
    const writes=h.writes.length;await h.twin.close();e.release('gpt-abandoned-owner','drop');await e.collect('gpt-abandoned-owner');
    await h.ruth.reload();await h.ruth.locator('#workspace').waitFor({state:'visible'});await ready(h.ruth);
    const button=h.ruth.locator('[data-pending-retry="'+h.abandonedId+'"]');
    return {pendingPresent:await button.count(),disabled:await button.isDisabled(),text:await h.ruth.locator('#pending-panel').innerText(),automaticWrites:h.writes.length-writes};`);
  assert.equal(stranded.pendingPresent,1);assert(stranded.disabled);assert.equal(stranded.automaticWrites,0);
  observations.push({criterion:'cross_tab_pending_resolution',outcome:'abandoned Retry remains permanently in flight after survivor reload',evidence:stranded});
  pass('reproduced abandoned-tab recovery failure with a real held accepted reply');
  const rounds=await step('round-controls-absent',`await h.ruth.locator('[data-view=ballots]').first().click();await ready(h.ruth);return {text:await h.ruth.locator('#view-panel').innerText(),buttons:await h.ruth.locator('#view-panel button').allTextContents(),checkboxes:await h.ruth.locator('#view-panel input[type=checkbox]').count()};`);
  assert.equal(rounds.checkboxes,0);assert(!rounds.buttons.some(x=>/round|batch|selected|together/i.test(x)));
  observations.push({criterion:'round workflow',outcome:'No multi-draft selection or reviewed round action is available',evidence:rounds});
  pass('confirmed unchanged prior GPT app lacks the reviewed round workflow');
  const unreadable=await step('unreadable-acknowledgment',`
    const original=await create(h.ruth,'GPT unreadable acknowledgment','gpt-unreadable','unreadable');
    const id=original.request.body.operationId;
    return {original,pendingCount:await h.ruth.locator('[data-pending-retry="'+id+'"]').count(),saved:(await observeRead(h.ruth)).body.items.some(b=>b.title==='GPT unreadable acknowledgment')};`);
  assert.equal(unreadable.original.response.status,201);assert(unreadable.saved);assert.equal(unreadable.pendingCount,0);
  observations.push({criterion:'immutable_pending_retry',outcome:'unreadable accepted response incorrectly clears recovery',evidence:{upstreamStatus:201,saved:true,pendingCount:0}});
  pass('reproduced missing recovery after unreadable successful delivery');
  const expired=await step('expired-retry-reminder',`
    const original=await create(h.ruth,'GPT expired attempt','gpt-expired-pending','drop');const id=original.request.body.operationId;
    await h.b.locator('#logout-all').click();await h.b.locator('#sign-in').waitFor({state:'visible'});
    const refused=await e.capture(h.ruth,'gpt-expired-retry',()=>h.ruth.locator('[data-pending-retry="'+id+'"]').click(),{match:isWrite});
    await h.ruth.locator('#sign-in').waitFor({state:'visible'});await enter(h.ruth,'ruth');await ready(h.ruth);
    return {refused,pendingCount:await h.ruth.locator('[data-pending-retry="'+id+'"]').count(),identity:await h.ruth.locator('#identity').innerText()};`);
  assert.equal(expired.refused.response.status,401);assert.equal(expired.pendingCount,0);assert.match(expired.identity,/Ruth/);
  observations.push({criterion:'pending_actor_isolation',outcome:'authentication refusal deletes the original reminder',evidence:{refusalStatus:401,restoredActor:expired.identity,pendingCount:0}});
  pass('reproduced lost reminder after expired-session Retry and real reauthentication');
}
main().catch(async error=>{
  results.push({name:'gpt replay failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return {evidence:e.dump(),html:await page.locator("body").innerText()};');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/gpt-replay-results.json',redact({subject:'unchanged gpt-5.4-mini r24 submission, fresh SQLite state',scoredModelRun:false,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,observations,results,stderr}));
  child.kill();
});
