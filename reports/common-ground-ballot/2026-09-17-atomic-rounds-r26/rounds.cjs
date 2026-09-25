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

const roundSupport = String.raw`
const isRound = r => r.method()==='POST' && pathOf(r)==='/api/rounds/open';
async function create(p,title,approval=false){
  await createForm(p,title);
  if(approval){await p.getByLabel('Voting method').selectOption('approval');await p.getByLabel('Maximum approvals').fill('2');}
  const row=await e.capture(p,'create-'+title,()=>p.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff});
  await p.waitForLoadState('networkidle');if(row.response?.status!==201)throw new Error(JSON.stringify(row));
  return row.response.body.ballot;
}
async function previewRound(p,targets){
  await reload(p);await p.getByRole('button',{name:'Open a round',exact:true}).click();
  for(const b of targets)await p.locator('input[name="round-ballot"][value="'+b.id+'"]').check();
  await p.getByRole('button',{name:'Review round',exact:true}).click();
  await p.locator('#round-preview').waitFor({state:'visible'});await p.waitForLoadState('networkidle');
  return p.locator('#round-summary').innerText();
}
async function confirmRound(p,label,lose=false){
  const row=await e.capture(p,label,()=>p.getByRole('button',{name:'Open reviewed round',exact:true}).click(),{match:isRound,mode:lose?'drop':'observe'});
  await p.waitForLoadState('networkidle');if(!row.response)throw new Error(JSON.stringify(row));return row;
}
async function reviewAgain(p){
  await p.getByRole('button',{name:'Refresh round review',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('#round-review').disabled);await p.waitForLoadState('networkidle');
  return p.locator('#round-summary').innerText();
}
async function lifecycle(p,b,action,label){
  await reload(p);const row=await e.capture(p,label,()=>p.locator('[data-ballot-action="'+action+'"][data-id="'+b.id+'"]').click(),{match:isStaff});
  await p.waitForLoadState('networkidle');return row;
}
async function member(p,id){
  await reload(p);await p.locator('.nav-item[data-view="members"]').click();
  const row=await e.capture(p,'member-'+id+'-'+h.counter++,()=>p.locator('[data-member-id="'+id+'"]').click(),{match:isStaff});
  await p.waitForLoadState('networkidle');if(row.response?.status!==200)throw new Error(JSON.stringify(row));return row;
}
async function probe(p,request,body){return p.evaluate(async x=>{const r=await fetch(x.url,{method:x.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(x.body)});return {status:r.status,body:await r.json()};},{url:request.url,method:request.method,body});}
async function freshBody(p,targets){const snap=await snapshot(p);return {ballots:targets.map(b=>({id:b.id,revision:snap.ballots.find(x=>x.id===b.id).revision})),roster:snap.members.members.map(m=>({id:m.id,revision:m.revision})),operation_id:'round-probe-'+h.counter++};}
async function editTitle(p,b,title){
  await reload(p);await p.locator('[data-ballot-edit="'+b.id+'"]').click();await p.getByLabel('Ballot title',{exact:true}).fill(title);
  const row=await e.capture(p,'edit-'+title,()=>p.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff});await p.waitForLoadState('networkidle');return row;
}
`;
const step=(name,body)=>run(name,roundSupport+'\n'+body);
const unchanged=row=>assert.deepEqual(row.after,row.before);

async function main(){
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'atomic-round-check',version:'r26'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const loaded=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});assert(!loaded.result?.isError);
  await step('setup',`browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[],counter:1};return await signin(page,'ruth');`);
  await step('contexts',`h.b=await (await browser.newContext()).newPage();await signin(h.b,'ruth');watch(page);watch(h.b);page.on('request',r=>{if(isRound(r))h.writes.push(shape(r));});return true;`);
  for(const [name,approval] of [['First single',false],['First approval',true],['Untouched',false],['Conflict A',false],['Conflict B',true],['Lifecycle A',false],['Lifecycle B',false],['Roster A',false],['Roster B',true]]){
    await step('fixture-'+name,`h.fixtures=h.fixtures||{};h.fixtures[${JSON.stringify(name)}]=await create(page,${JSON.stringify(name)},${approval});return h.fixtures[${JSON.stringify(name)}];`);
  }
  const preview=await step('preview-cancel',`
    h.first=[h.fixtures['First single'],h.fixtures['First approval']];h.outside=h.fixtures.Untouched;
    const before=await snapshot(page),writes=h.writes.length;const text=await previewRound(page,h.first);
    await page.screenshot({path:'/results/round-preview-desktop.png'});
    await page.getByRole('button',{name:'Close round',exact:true}).click();return {before,after:await snapshot(page),text,writes:h.writes.length-writes};`);
  unchanged(preview);assert.equal(preview.writes,0);for(const s of ['First single','First approval','Single choice','Approval','Morning','Evening','Leila Ward'])assert(preview.text.includes(s));assert(!preview.text.includes('Owen Park'));pass('round preview and cancellation preserve all business records');
  const success=await step('atomic-success',`
    await previewRound(page,h.first);const before=await snapshot(page);h.success=await confirmRound(page,'first-round');return {before,after:await snapshot(page),row:h.success,targets:h.first,outside:h.outside};`);
  assert.equal(success.row.response.status,200);for(const b of success.targets){const saved=success.after.ballots.find(x=>x.id===b.id);assert.equal(saved.status,'open');assert.equal(saved.revision,2);assert.deepEqual(saved.turnout.members.map(m=>m.id),['user-leila']);assert.equal(success.after.audit.events.filter(e=>e.entity_id===b.id&&e.action==='opened').length,1);}
  assert.deepEqual(success.after.ballots.find(x=>x.id===success.outside.id),success.before.ballots.find(x=>x.id===success.outside.id));pass('one round commits both methods once and leaves the outsider untouched');
  const conflict=await step('draft-conflict',`
    h.editPair=[h.fixtures['Conflict A'],h.fixtures['Conflict B']].sort((a,b)=>a.id.localeCompare(b.id));
    await previewRound(page,h.editPair);await editTitle(h.b,h.editPair[1],'Changed before round');const before=await snapshot(h.b);
    h.draftRefusal=await confirmRound(page,'round-draft-refusal');return {before,after:await snapshot(h.b),row:h.draftRefusal,guidance:await page.locator('#round-error').innerText(),disabled:await page.locator('#round-confirm').isDisabled()};`);
  assert.equal(conflict.row.response.status,409);unchanged(conflict);assert.match(conflict.guidance,/review/i);assert(conflict.disabled);pass('later selected draft conflict refuses the entire round');
  const reviewed=await step('draft-rereview',`const text=await reviewAgain(page);h.editSuccess=await confirmRound(page,'edited-round-success');return {text,row:h.editSuccess,refused:h.draftRefusal.request};`);
  assert.match(reviewed.text,/Changed before round/);assert.equal(reviewed.row.response.status,200);assert.notEqual(reviewed.row.request.body.operation_id,reviewed.refused.body.operation_id);pass('explicit re-review uses current draft versions and a fresh operation');
  const lifecycleConflict=await step('lifecycle-conflict',`
    h.lifePair=[h.fixtures['Lifecycle A'],h.fixtures['Lifecycle B']].sort((a,b)=>a.id.localeCompare(b.id));
    await previewRound(page,h.lifePair);await lifecycle(h.b,h.lifePair[1],'open','one-opens-first');const before=await snapshot(h.b);
    const row=await confirmRound(page,'round-lifecycle-refusal');const after=await snapshot(h.b);await page.getByRole('button',{name:'Close round',exact:true}).click();return {before,after,row};`);
  assert.equal(lifecycleConflict.row.response.status,409);unchanged(lifecycleConflict);pass('independently opened later target cannot partially open its sibling');
  // Table inputs are adapted from the real successful confirmation. Set up remains visible UI.
  for(const kind of ['duplicate','one','unknown','incomplete-roster','array','object','boolean','fraction','null','omitted','member-array','member-object','member-boolean','member-fraction','member-null','member-omitted']){
    const row=await step('invalid-'+kind,`
      h.rosterPair=[h.fixtures['Roster A'],h.fixtures['Roster B']];const body=await freshBody(page,h.rosterPair),kind=${JSON.stringify(kind)};
      if(kind==='duplicate')body.ballots.push({...body.ballots[0]});if(kind==='one')body.ballots.pop();
      if(kind==='unknown')body.ballots[1].id='missing-round-ballot';if(kind==='incomplete-roster')body.roster.pop();
      if(kind==='array')body.ballots[1].revision=[1];if(kind==='boolean')body.ballots[1].revision=true;
      if(kind==='object')body.ballots[1].revision={value:1};if(kind==='fraction')body.ballots[1].revision=1.5;
      if(kind==='null')body.ballots[1].revision=null;if(kind==='omitted')delete body.ballots[1].revision;
      if(kind==='member-array')body.roster[0].revision=[1];if(kind==='member-boolean')body.roster[0].revision=true;
      if(kind==='member-object')body.roster[0].revision={value:1};if(kind==='member-fraction')body.roster[0].revision=1.5;
      if(kind==='member-null')body.roster[0].revision=null;if(kind==='member-omitted')delete body.roster[0].revision;
      const before=await snapshot(page),response=await probe(page,h.success.request,body);return {kind,body,response,before,after:await snapshot(page)};`);
    assert(row.response.status>=400&&row.response.status<500,JSON.stringify(row));unchanged(row);
  }pass('sixteen invalid round packets refuse every business side effect');
  for(const who of ['arun','leila','owen']){
    const row=await step('role-'+who,`
      const actor=await (await browser.newContext()).newPage();await signin(actor,${JSON.stringify(who)});h[${JSON.stringify(who)}]=actor;
      const body=await freshBody(page,h.rosterPair),before=await snapshot(page);const response=await probe(actor,h.success.request,body);return {response,before,after:await snapshot(page)};`);
    assert.equal(row.response.status,403);unchanged(row);
  }pass('all three non-Coordinator accounts are denied otherwise valid rounds');
  const noActive=await step('no-active-members',`await member(h.b,'user-leila');const body=await freshBody(page,h.rosterPair),before=await snapshot(page);const response=await probe(page,h.success.request,body);const after=await snapshot(page);await member(h.b,'user-leila');return {response,before,after};`);
  assert.equal(noActive.response.status,409);unchanged(noActive);pass('empty active roster refuses the entire round');
  const rosterOne=await step('roster-changed',`
    await previewRound(page,h.rosterPair);await member(h.b,'user-owen');const before=await snapshot(h.b);h.rosterRefusal1=await confirmRound(page,'roster-refusal-one');return {before,after:await snapshot(h.b),row:h.rosterRefusal1};`);
  assert.equal(rosterOne.row.response.status,409);unchanged(rosterOne);pass('changed active membership invalidates every selected opening');
  const rosterABA=await step('roster-change-return',`
    await reviewAgain(page);await member(h.b,'user-owen');await member(h.b,'user-owen');const before=await snapshot(h.b);
    h.rosterRefusal2=await confirmRound(page,'roster-refusal-two');return {before,after:await snapshot(h.b),row:h.rosterRefusal2};`);
  assert.equal(rosterABA.row.response.status,409);unchanged(rosterABA);pass('pause then activate still invalidates reviewed membership versions');
  const lost=await step('lost-round-success',`
    await reviewAgain(page);await e.arm(page,'lost-round',{match:isRound,mode:'hold'});await page.getByRole('button',{name:'Open reviewed round',exact:true}).click();
    for(let i=0;i<100&&e.peek('lost-round').state!=='response-held';i++)await page.waitForTimeout(30);
    h.lostRound=e.peek('lost-round');const disabled=await page.locator('#round-confirm').isDisabled(),count=h.writes.length;
    await reload(page);const automatic=h.writes.length-count;e.release('lost-round','drop');await e.collect('lost-round');
    return {row:h.lostRound,disabled,automatic,pending:await ids(page),text:await page.locator('#pending-actions').innerText(),records:await snapshot(page)};`);
  assert.equal(lost.row.state,'response-held');assert(lost.disabled);assert.equal(lost.automatic,0);assert.equal(lost.row.response.status,200);assert.deepEqual(lost.pending,[lost.row.request.body.operation_id]);assert.match(lost.text,/Roster A/);assert.match(lost.text,/Roster B/);for(const b of lost.row.response.body.ballots)assert.equal(b.turnout.eligible,2);pass('reload before initial acknowledgment retains one recognizable whole-round reminder');
  const heldInitial=await step('pending-after-later-changes',`
    await lifecycle(h.b,h.rosterPair[0],'close','close-round-target');await lifecycle(h.b,h.first[0],'close','close-first-target');await member(h.b,'user-owen');
    const count=h.writes.length;await signout(page);await signin(page,'ruth');const pending=await ids(page);return {pending,writes:h.writes.length-count,before:await snapshot(page)};`);
  assert.deepEqual(heldInitial.pending,lost.pending);assert.equal(heldInitial.writes,0);pass('round reminder survives sign-in without replay after later lifecycle and roster changes');
  const receipts=await step('round-receipts',`
    const before=await snapshot(page);const body=JSON.parse(JSON.stringify(h.success.request.body));body.ballots.reverse();body.roster.reverse();
    const reversed=await probe(page,h.success.request,body);const changedTarget=JSON.parse(JSON.stringify(body));changedTarget.ballots[0].id=h.outside.id;
    const target=await probe(page,h.success.request,changedTarget);const changedRevision=JSON.parse(JSON.stringify(body));changedRevision.ballots[0].revision++;
    const revision=await probe(page,h.success.request,changedRevision);const original=await probe(page,h.success.request,h.success.request.body);
    const createRecord=e.peek('create-Untouched');const namespaceBody=await freshBody(page,[h.outside,h.lifePair[0]]);namespaceBody.operation_id=createRecord.request.body.operation_id;
    const namespace=await probe(page,h.success.request,namespaceBody),createReplay=await probe(page,createRecord.request,createRecord.request.body);
    const refusals=[];for(const row of [h.draftRefusal,h.rosterRefusal1,h.rosterRefusal2])refusals.push({original:row.response,replay:await probe(page,row.request,row.request.body)});
    return {before,after:await snapshot(page),reversed,target,revision,original,success:h.success.response,refusals,namespace,createReplay,createOriginal:createRecord.response};`);
  unchanged(receipts);assert.deepEqual(receipts.reversed,{status:receipts.success.status,body:receipts.success.body});assert.deepEqual(receipts.original,receipts.reversed);for(const key of ['target','revision','namespace']){assert.equal(receipts[key].status,409);assert.match(receipts[key].body.error,/different input/);}assert.deepEqual(receipts.createReplay,{status:receipts.createOriginal.status,body:receipts.createOriginal.body});pass('canonical order and input/namespace collisions preserve original receipts');
  for(const row of receipts.refusals)assert.deepEqual(row.replay,{status:row.original.status,body:row.original.body});pass('all three original round refusals survive later accepted rounds');
  const visibility=await step('round-visibility',`
    await reload(h.leila);await reload(h.owen);const l=(await read(h.leila,'/api/ballots')).body.ballots,o=(await read(h.owen,'/api/ballots')).body.ballots;
    return {leila:l.map(b=>b.id),owen:o.map(b=>b.id),both:h.rosterPair.map(b=>b.id),leilaOnly:h.first.map(b=>b.id)};`);
  for(const id of visibility.both){assert(visibility.leila.includes(id));assert(visibility.owen.includes(id));}for(const id of visibility.leilaOnly){assert(visibility.leila.includes(id));assert(!visibility.owen.includes(id));}pass('round snapshots control both Members independently of the later pause');
  const beforeRestart=await step('before-restart',`return await snapshot(page);`);
  require('node:child_process').execFileSync('/opt/common-ground-verifier/app-lifecycle',['restart'],{stdio:'inherit',timeout:75000});
  const after=await step('restart-and-round-retry',`
    await reload(page);const before=await snapshot(page);const count=h.writes.length;await signout(page);await signin(page,'ruth');const pending=await ids(page),automatic=h.writes.length-count;
    const row=await e.capture(page,'round-visible-retry',()=>page.locator('[data-pending-retry="'+h.lostRound.request.body.operation_id+'"]').click(),{match:isRound});
    await page.waitForLoadState('networkidle');const remaining=await ids(page);const original=h.lostRound;
    const refusals=[];for(const old of [h.draftRefusal,h.rosterRefusal1,h.rosterRefusal2])refusals.push({original:old.response,replay:await probe(page,old.request,old.request.body)});
    const body=JSON.parse(JSON.stringify(h.success.request.body));body.ballots.reverse();body.roster.reverse();const success=await probe(page,h.success.request,body);
    return {before,after:await snapshot(page),pending,automatic,row,original,remaining,refusals,success,html:await page.locator('#ballots-list').innerText(),errors:h.pageErrors};`);
  assert.deepEqual(after.before,beforeRestart);assert.deepEqual(after.after,beforeRestart);assert.deepEqual(after.pending,lost.pending);assert.equal(after.automatic,0);assert.deepEqual(after.row.request.body,after.original.request.body);assert.deepEqual(after.remaining,[]);assert.match(after.html,/Closed/i);assert.deepEqual(after.errors,[]);pass('restart and explicit Retry retain the exact round and refresh current Closed states');
  assert.deepEqual(after.success,receipts.reversed);for(const row of after.refusals)assert.deepEqual(row.replay,{status:row.original.status,body:row.original.body});pass('success and three refusal receipts survive a real process restart');
  const mobile=await step('round-mobile',`await page.setViewportSize({width:390,height:844});const groupVisible=await page.locator('.brand small').isVisible();await page.getByRole('button',{name:'Open a round',exact:true}).click();await page.locator('#round-dialog').waitFor({state:'visible'});await page.screenshot({path:'/results/round-selection-mobile.png'});return {groupVisible,...await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,dialog:document.querySelector('#round-dialog').getBoundingClientRect().width,open:document.querySelector('#round-dialog').open}))};`);
  assert(mobile.groupVisible);assert(mobile.open);assert(mobile.width<=mobile.viewport);assert(mobile.dialog>0&&mobile.dialog<=mobile.viewport);pass('round selection and association identity remain usable at 390px');
}
main().catch(async error=>{
  results.push({name:'round failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return {evidence:e.dump(),errors:h.pageErrors,html:await page.locator("body").innerText()};');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/rounds-results.json',redact({mcpVersion:version,scoredOracle:false,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));child.kill();
});
