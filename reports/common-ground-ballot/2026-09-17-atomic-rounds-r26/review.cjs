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

const reviewSupport = String.raw`
async function draft(p,id){return (await read(p,'/api/ballots')).body.ballots.find(b=>b.id===id);}
async function edit(p,id,fields){
  await reload(p); await p.locator('[data-ballot-edit="'+id+'"]').click();
  if(fields.title!==undefined)await p.getByLabel('Ballot title',{exact:true}).fill(fields.title);
  if(fields.description!==undefined)await p.locator('#ballot-description').fill(fields.description);
  if(fields.choices){
    await p.getByLabel('Voting method').selectOption(fields.method);
    while(await p.locator('input[name=choice]').count()<fields.choices.length)await p.getByRole('button',{name:'Add another choice'}).click();
    while(await p.locator('input[name=choice]').count()>fields.choices.length)await p.locator('.remove-choice').last().click();
    for(let i=0;i<fields.choices.length;i++)await p.locator('input[name=choice]').nth(i).fill(fields.choices[i]);
    if(fields.method==='approval')await p.getByLabel('Maximum approvals').fill(String(fields.max_selections));
  }
}
async function save(p,label,review=false){
  const row=await e.capture(p,label,()=>p.getByRole('button',{name:review?'Save reviewed draft':'Save draft',exact:true}).click(),{match:isStaff});
  await p.waitForLoadState('networkidle'); return row;
}
async function preview(p){await p.getByRole('button',{name:'Review latest changes',exact:true}).click();await p.locator('#draft-review-form').waitFor({state:'visible'});return p.locator('#draft-review-form').innerText();}
`;
async function step(name,body){return run(name,reviewSupport+'\n'+body);}

async function main(){
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'draft-review-oracle-check',version:'r25'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const loaded=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});
  assert(!loaded.result?.isError);
  await step('setup',`
    browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};
    return {identity:await signin(page,'ruth')};`);
  await step('fixture',`
    watch(page);
    h.b=await (await browser.newContext()).newPage();await signin(h.b,'ruth');watch(h.b);
    await createForm(page,'Review original');
    const created=await save(page,'review-create');h.id=created.response.body.ballot.id;
    return created;`);

  const disjoint=await step('disjoint',`
    await edit(h.ruth,h.id,{title:'Review local title',method:'approval',max_selections:2,choices:['Morning','Evening']});
    await edit(h.b,h.id,{description:'Remote context one',method:'approval',max_selections:2,choices:['Morning','Evening']});await save(h.b,'remote-context');
    const refused=await save(h.ruth,'local-stale');
    const before=await snapshot(h.b), writes=h.writes.length;
    const previewText=await preview(h.ruth),previewWrites=h.writes.length-writes;
    const accepted=await save(h.ruth,'disjoint-save',true);
    await reload(h.ruth);
    return {refused,accepted,before,previewText,previewWrites,current:await draft(h.ruth,h.id)};`);
  assert.equal(disjoint.refused.response.status,409);assert.equal(disjoint.accepted.response.status,200);
  assert.equal(disjoint.previewWrites,0);assert.match(disjoint.previewText,/Remote context one/);
  assert.equal(disjoint.current.title,'Review local title');assert.equal(disjoint.current.description,'Remote context one');assert.equal(disjoint.current.method,'approval');assert.equal(disjoint.current.max_selections,2);
  assert.notEqual(disjoint.refused.request.body.operation_id,disjoint.accepted.request.body.operation_id);
  pass('disjoint review combines independent fields using a fresh explicit operation');

  const conflicts=await step('conflicting-fields',`
    await edit(h.ruth,h.id,{title:'Local agenda',description:'Local note',method:'approval',max_selections:2,choices:['Red','Blue','Green']});
    await edit(h.b,h.id,{title:'Board agenda',description:'Board note',method:'single',choices:['East','West']});await save(h.b,'board-fields');
    await save(h.ruth,'three-stale');const writes=h.writes.length;
    const previewText=await preview(h.ruth);
    const beforeChoices=await h.ruth.locator('#draft-review-fields input:checked').count();
    const initiallyDisabled=await h.ruth.locator('#save-draft-review').isDisabled();
    await h.ruth.getByLabel('Keep yours for Title',{exact:true}).check();
    const partiallyDisabled=await h.ruth.locator('#save-draft-review').isDisabled();
    await h.ruth.getByLabel('Keep latest for Context',{exact:true}).check();
    await h.ruth.getByLabel('Keep yours for Voting definition',{exact:true}).check();
    const previewWrites=h.writes.length-writes;
    const saved=await save(h.ruth,'chosen-fields',true);await reload(h.ruth);
    return {previewText,beforeChoices,initiallyDisabled,partiallyDisabled,previewWrites,saved,current:await draft(h.ruth,h.id)};`);
  assert.equal(conflicts.beforeChoices,0);assert(conflicts.initiallyDisabled&&conflicts.partiallyDisabled);
  assert.equal(conflicts.previewWrites,0);assert.equal(conflicts.saved.response.status,200);
  assert.equal(conflicts.current.title,'Local agenda');assert.equal(conflicts.current.description,'Board note');
  assert.equal(conflicts.current.method,'approval');assert.equal(conflicts.current.max_selections,2);
  assert.deepEqual(conflicts.current.choices.map(c=>c.label),['Red','Blue','Green']);
  for(const value of ['Review local title','Local agenda','Board agenda','Remote context one','Local note','Board note','Red','East'])assert(conflicts.previewText.includes(value));
  pass('all three overlapping fields need explicit choices; voting definition stays atomic');

  const race=await step('preview-race',`
    await edit(h.ruth,h.id,{title:'Reviewed final title'});
    await edit(h.b,h.id,{description:'Context before preview'});await save(h.b,'preview-base-change');
    await save(h.ruth,'preview-base-stale');await preview(h.ruth);
    const reviewed=await draft(h.b,h.id);
    await edit(h.b,h.id,{description:'Context after preview'});await save(h.b,'preview-later-change');
    const latest=await draft(h.b,h.id),refused=await save(h.ruth,'preview-raced-save',true);
    if(refused.response.status!==409)return {reviewed,latest,refused,unexpectedAcceptance:true};
    h.reviewRefusal=refused;
    const afterRefusal=await draft(h.b,h.id), retained=await h.ruth.getByLabel('Ballot title',{exact:true}).inputValue();
    await preview(h.ruth);const accepted=await save(h.ruth,'preview-fresh-save',true);await reload(h.ruth);
    const current=await draft(h.ruth,h.id);
    const replay=await h.ruth.evaluate(async packet=>{const r=await fetch(packet.url,{method:packet.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(packet.body)});return {status:r.status,body:await r.json()};},refused.request);
    return {reviewed,latest,refused,afterRefusal,retained,accepted,current,replay,afterReplay:await draft(h.ruth,h.id)};`);
  assert.equal(race.refused.response.status,409);assert.deepEqual(race.latest,race.afterRefusal);
  assert.equal(race.refused.request.body.expected_revision,race.reviewed.revision);
  assert.equal(race.retained,'Reviewed final title');assert.equal(race.accepted.response.status,200);
  assert.notEqual(race.refused.request.body.operation_id,race.accepted.request.body.operation_id);
  assert.equal(race.current.title,'Reviewed final title');assert.equal(race.current.description,'Context after preview');
  assert.equal(race.replay.status,409);assert.deepEqual(race.replay.body,race.refused.response.body);assert.deepEqual(race.current,race.afterReplay);
  pass('another edit during preview is refused and re-review keeps the working copy');

  const cancelled=await step('discard-review',`
    await edit(h.ruth,h.id,{title:'Do not save this'});
    await edit(h.b,h.id,{description:'Keep this context'});await save(h.b,'discard-remote');
    await save(h.ruth,'discard-stale');await preview(h.ruth);
    const before=await snapshot(h.b),writes=h.writes.length;
    await h.ruth.getByRole('button',{name:'Discard my changes',exact:true}).click();
    await h.ruth.waitForLoadState('networkidle');
    return {before,after:await snapshot(h.b),writes:h.writes.length-writes,dialogOpen:await h.ruth.locator('#ballot-dialog').isVisible()};`);
  assert.equal(cancelled.writes,0);assert.deepEqual(cancelled.before,cancelled.after);assert(!cancelled.dialogOpen);
  pass('discard sends no mutation and preserves the current record and audit');

  const lifecycle=await step('lifecycle-review',`
    await edit(h.ruth,h.id,{title:'Locked change'});await reload(h.b);
    await e.capture(h.b,'review-open',()=>h.b.locator('[data-ballot-action="open"][data-id="'+h.id+'"]').click(),{match:isStaff});
    await h.b.waitForLoadState('networkidle');await save(h.ruth,'locked-review-edit');
    const before=await snapshot(h.b),writes=h.writes.length,previewText=await preview(h.ruth);
    const saveHidden=await h.ruth.locator('#save-draft-review').isHidden();
    await h.ruth.getByRole('button',{name:'Discard my changes',exact:true}).click();await h.ruth.waitForLoadState('networkidle');
    return {before,after:await snapshot(h.b),writes:h.writes.length-writes,previewText,saveHidden};`);
  assert.equal(lifecycle.writes,0);assert.deepEqual(lifecycle.before,lifecycle.after);assert(lifecycle.saveHidden);
  assert.match(lifecycle.previewText,/now open/);assert.match(lifecycle.previewText,/locked/);
  pass('a newly opened ballot stops reviewed saving with useful lifecycle guidance');

  const mobile=await step('mobile-review',`
    await h.ruth.setViewportSize({width:390,height:844});
    await createForm(h.ruth,'Narrow review');const created=await save(h.ruth,'mobile-create');const id=created.response.body.ballot.id;
    await edit(h.ruth,id,{title:'Narrow local'});await edit(h.b,id,{title:'Narrow remote'});await save(h.b,'mobile-remote');
    await save(h.ruth,'mobile-stale');await preview(h.ruth);
    return {dimensions:await h.ruth.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,dialog:document.querySelector('#ballot-dialog').scrollWidth,client:document.querySelector('#ballot-dialog').clientWidth})),pageErrors:h.pageErrors};`);
  assert(mobile.dimensions.document<=mobile.dimensions.width);assert(mobile.dimensions.dialog<=mobile.dimensions.client+1);
  assert.deepEqual(mobile.pageErrors,[]);
  pass('review stays usable at 390px with no browser errors');
  const beforeRestart=await step('before-restart',`return await snapshot(h.ruth);`);
  require('node:child_process').execFileSync('/opt/common-ground-verifier/app-lifecycle',['restart'],{stdio:'inherit',timeout:75000});
  const persistence=await step('review-after-restart',`
    await reload(h.ruth);const before=await snapshot(h.ruth);
    const replay=await h.ruth.evaluate(async packet=>{const r=await fetch(packet.url,{method:packet.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(packet.body)});return {status:r.status,body:await r.json()};},h.reviewRefusal.request);
    return {before,after:await snapshot(h.ruth),replay,original:h.reviewRefusal.response};`);
  assert.deepEqual(persistence.before,beforeRestart);assert.deepEqual(persistence.after,beforeRestart);
  assert.equal(persistence.replay.status,409);assert.deepEqual(persistence.replay.body,persistence.original.body);
  pass('reviewed records and original reviewed-save refusal survive a real process restart');
}

main().catch(async error=>{
  results.push({name:'review failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;
  try{await run('failure-retained-evidence','return {evidence:e.dump(),errors:h.pageErrors,html:await page.locator("body").innerText()};');}catch{}
}).finally(()=>{
  fs.writeFileSync('/results/review-results.json',redact({mcpVersion:version,scoredOracle:false,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));
  child.kill();
});
