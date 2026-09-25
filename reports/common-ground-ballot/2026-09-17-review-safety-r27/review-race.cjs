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
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'review-inflight-check',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const loaded=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});assert(!loaded.result?.isError);
  await step('setup',`browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};return await signin(page,'ruth');`);
  await step('prepare-conflicts',`
    watch(page);h.b=await (await browser.newContext()).newPage();await signin(h.b,'ruth');
    await createForm(page,'In-flight review');h.created=await save(page,'race-create');h.id=h.created.response.body.ballot.id;
    await edit(page,h.id,{title:'My reviewed title',description:'My context',method:'approval',max_selections:2,choices:['Morning','Evening']});
    await edit(h.b,h.id,{title:'Other title',description:'Other context',method:'single',max_selections:1,choices:['First','Second']});await save(h.b,'race-remote');
    await save(page,'race-refusal');await preview(page);
    for(const field of ['title','description','voting'])await page.locator('input[name="review-'+field+'"][value="yours"]').check();
    await e.arm(page,'race-held',{match:isStaff,mode:'hold'});await page.getByRole('button',{name:'Save reviewed draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('race-held').state!=='response-held';i++)await page.waitForTimeout(30);
    return e.peek('race-held');`);
  const controls=await step('controls-while-held',`
    const pick=page.locator('input[name="review-title"][value="latest"]');const choiceDisabled=await pick.isDisabled();
    if(!choiceDisabled)await pick.check();
    return {choiceDisabled,saveDisabled:await page.locator('#save-draft-review').isDisabled(),discardDisabled:await page.locator('#discard-draft-review').isDisabled(),writes:h.writes.length};`);
  retain('control-observation',controls);
  // Leaving via Escape is ordinary browser interaction, with no DOM/state edits.
  const staleReply=await step('old-reply-new-form',`
    await page.keyboard.press('Escape');await createForm(page,'New independent work');
    e.release('race-held','deliver');await e.collect('race-held');await page.waitForLoadState('networkidle');
    return {open:await page.locator('#ballot-dialog').isVisible(),title:await page.locator('#ballot-title').inputValue(),errors:h.pageErrors};`);
  retain('late-observation',staleReply);
  results.push({name:'changing conflict choices cannot enable a second in-flight save',passed:controls.saveDisabled,evidence:controls});
  results.push({name:'discard does not claim an in-flight submission was never sent',passed:controls.discardDisabled,evidence:controls});
  results.push({name:'late reviewed-save result leaves a newer form intact',passed:staleReply.open&&staleReply.title==='New independent work',evidence:staleReply});
  results.push({name:'in-flight review has no browser errors',passed:staleReply.errors.length===0});
  for(const row of results)console.log(row.passed?'PASS':'FAIL',row.name);
  assert(results.every(r=>r.passed));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync('/results/review-race-results.json',redact({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));child.kill();
});
