const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {chromium, request} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out = '/review';
const base = 'http://127.0.0.1:3000';
const records = [];
let child, browser;
const actors = {ruth:'ruth.adebayo', leila:'leila.ward', owen:'owen.park'};
function record(name, data) { records.push({name,...data}); console.log(name, JSON.stringify(data)); }
async function stop() {
  if (child && child.exitCode === null) { const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
  child = null;
}
async function start(dir) {
  child = spawn('node', ['server.js'], {cwd:dir,env:{...process.env,PORT:'3000',DB_PATH:path.join(dir,'probe.db'),SEED_PATH:path.join(dir,'common_ground_seed.json')},stdio:['ignore','ignore','pipe']});
  child.stderr.on('data', b => process.stderr.write(b));
  for (let i=0;i<100;i++) {
    try { if ((await fetch(base+'/api/health')).ok) return; } catch {}
    if(child.exitCode!==null) throw new Error('App exited '+child.exitCode);
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('App did not become ready');
}
function copy(model) {
  const dirs=fs.readdirSync('/runs').filter(n=>n.startsWith('run-'));
  for(const d of dirs) for(const t of fs.readdirSync('/runs/'+d).filter(n=>n.startsWith('common-ground-ballot__'))) {
    const trial=path.join('/runs',d,t), result=JSON.parse(fs.readFileSync(trial+'/result.json'));
    const name=result.agent_info.model_info?.name || result.agent_info.name;
    if(name!==model) continue;
    const dir=fs.mkdtempSync('/tmp/ballot-audit-');
    fs.cpSync(trial+'/artifacts/app', dir, {recursive:true,filter:p=>!p.includes('node_modules') && !/\.(db|sqlite)(-wal|-shm)?$/.test(p)});
    return dir;
  }
  throw new Error('Missing model '+model);
}
async function api(ctx,route,body,method) {
  const r=await ctx.fetch(base+route,{method:method||(body===undefined?'GET':'POST'),...(body===undefined?{}:{data:body})});
  return {status:r.status(),body:await r.json()};
}
async function login(who,route='/api/login') {
  const ctx=await request.newContext();
  const r=await api(ctx,route,{email:actors[who]+'@commonground.example',password:'CommonGround!2026'});
  assert.equal(r.status,200);
  return ctx;
}
async function golden() {
  await start(copy('oracle'));
  const page=await browser.newPage();
  await page.goto(base);
  await page.getByLabel('Email',{exact:true}).fill(actors.ruth+'@commonground.example');
  await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#app-view').waitFor({state:'visible'});
  const snapshot=async()=>({ballots:(await api(page.request,'/api/ballots')).body,audit:(await api(page.request,'/api/audit')).body});
  const cases=[
    ['blank title','', ['Morning','Afternoon','Evening'],'2'],
    ['blank choice','Temp invalid',['Morning','','Evening'],'2'],
    ['whitespace choice','Temp invalid',['Morning','  ','Evening'],'2'],
    ['repeated choice','Temp invalid',['Morning','Morning','Evening'],'2'],
    ['limit below one','Temp invalid',['Morning','Afternoon','Evening'],'0'],
    ['limit above choices','Temp invalid',['Morning','Afternoon','Evening'],'4'],
  ];
  for(const [name,title,choices,limit] of cases) {
    const before=await snapshot();
    await page.getByRole('button',{name:'New ballot',exact:true}).click();
    await page.getByLabel('Ballot title',{exact:true}).fill(title);
    await page.getByLabel('Voting method').selectOption('approval');
    await page.getByLabel('Maximum approvals').fill(limit);
    await page.getByRole('button',{name:'Add another choice'}).click();
    for(let i=0;i<choices.length;i++) await page.locator('input[name=choice]').nth(i).fill(choices[i]);
    const valid=await page.locator('#ballot-form').evaluate(e=>e.checkValidity());
    const response=valid?page.waitForResponse(r=>r.url().endsWith('/api/ballots')&&r.request().method()==='POST'):null;
    await page.getByRole('button',{name:'Save draft',exact:true}).click();
    const r=response?await response:null;
    const status=r?.status() ?? null;
    if(r) assert(status>=400, name);
    const unchanged=JSON.stringify(before)===JSON.stringify(await snapshot());
    assert(unchanged,name);
    record('oracle invalid draft: '+name,{status,native_validation:!valid,unchanged});
    await page.getByRole('button',{name:'Close ballot form'}).click();
  }
  await page.getByRole('button',{name:'New ballot',exact:true}).click();
  await page.getByRole('button',{name:'Remove choice',exact:true}).first().click();
  const minimum=await page.locator('input[name=choice]').count();
  assert.equal(minimum,2); record('oracle minimum choices control',{count:minimum});
  await page.getByRole('button',{name:'Close ballot form'}).click();
  const before=await snapshot();
  await page.getByRole('button',{name:'New ballot',exact:true}).click();
  await page.getByLabel('Ballot title',{exact:true}).fill('Verifier room use');
  await page.locator('#ballot-description').fill('Reserve the shared room');
  await page.getByLabel('Voting method').selectOption('approval');
  await page.getByLabel('Maximum approvals').fill('2');
  await page.getByRole('button',{name:'Add another choice'}).click();
  for(const [i,label] of ['Morning','Afternoon','Evening'].entries()) await page.locator('input[name=choice]').nth(i).fill(label);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/ballots')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  const accepted=await response; assert.equal(accepted.status(),201);
  const after=await snapshot();
  record('oracle valid draft positive control',{status:accepted.status(),ballots_added:after.ballots.ballots.length-before.ballots.ballots.length,audit_added:after.audit.events.length-before.audit.events.length});
  await page.close(); await stop();
}
async function gpt() {
  const dir=copy('gpt-5.4-mini'); await start(dir);
  const ruth=await login('ruth'), leila=await login('leila'), owen=await login('owen');
  const state=async()=> (await api(ruth,'/api/bootstrap')).body.state;
  const create=async(title,choices)=>api(ruth,'/api/ballots',{title,description:'Probe',method:'approval',maxSelections:2,choices});
  for(const [name,choices] of [['blank',['Morning','','Evening']],['duplicate',['Morning','Morning','Evening']]]) {
    const r=await create('Probe '+name,choices);
    record('gpt invalid draft '+name,{status:r.status,choices:r.body.state?.ballots.find(b=>b.title==='Probe '+name)?.choices.map(c=>c.label)});
    assert.equal(r.status,200);
  }
  const initial=await state();
  const picnic=initial.ballots.find(b=>b.title==='Annual picnic date');
  record('gpt fractional revision',{status:(await api(ruth,`/api/ballots/${picnic.id}/open`,{revision:1.5})).status});
  await create('Isolated approval probe',['Morning','Afternoon','Evening']);
  let ballot=(await state()).ballots.find(b=>b.title==='Isolated approval probe');
  await api(ruth,`/api/ballots/${ballot.id}/open`,{revision:ballot.revision});
  ballot=(await state()).ballots.find(b=>b.id===ballot.id);
  const vote=(ctx,ids,extra={})=>api(ctx,'/api/votes',{ballotId:ballot.id,operationId:crypto.randomUUID(),revision:ballot.revision,selections:ids,...extra});
  record('gpt isolated ineligible Owen',{status:(await vote(owen,[ballot.choices[0].id])).status});
  const courtyard=initial.ballots.find(b=>b.title==='Courtyard closing time');
  record('gpt isolated cross-ballot Leila',{status:(await vote(leila,[courtyard.choices[0].id])).status});
  record('gpt repeated approval input',{status:(await vote(leila,[ballot.choices[0].id,ballot.choices[0].id])).status});
  const stale=await api(owen,'/api/votes',{ballotId:courtyard.id,operationId:crypto.randomUUID(),revision:courtyard.revision-1,selections:[courtyard.choices[0].id]});
  record('gpt extra revision field ignored',{status:stale.status,graded:false,limitation:'Actual UI vote has no revision field. This invented-field probe is not a fair graded failure and was excluded from the revised rubric.'});
  const results=[];
  for(let i=0;i<3;i++) {
    if(i) {await stop();await start(dir);}
    const r=await api(ruth,'/api/bootstrap');
    results.push({restart:i,auth_status:r.status,garden:r.body.state?.ballots.find(b=>b.title==='Garden location')?.result});
  }
  record('gpt seeded totals across restarts',{results});
  await stop();
}
async function gemini() {
  await start(copy('gemini-3.7-flash'));
  const ruth=await login('ruth','/api/auth/login'), leila=await login('leila','/api/auth/login');
  const r=await api(ruth,'/api/ballots',{title:'Isolated approval probe',description:'Probe',method:'approval',max_selections:2,choices:['Morning','Afternoon','Evening']});
  let b=r.body.ballot||r.body;
  const transition=async(status)=>{
    const r=await api(ruth,`/api/ballots/${b.id}/transition`,{target_status:status,expected_revision:b.revision});
    assert.equal(r.status,200); b=r.body.ballot||r.body;
  };
  await transition('open');
  const payload={choice_ids:[b.choices[0].id,b.choices[0].id],operation_id:crypto.randomUUID()};
  const first=await api(leila,`/api/ballots/${b.id}/vote`,payload);
  record('gemini repeated approval input',{status:first.status});
  record('gemini exact replay while open',{status:(await api(leila,`/api/ballots/${b.id}/vote`,payload)).status});
  const latest=await api(ruth,`/api/ballots/${b.id}`); b=latest.body.ballot||latest.body;
  await transition('closed'); await transition('published');
  record('gemini exact replay after publication',{status:(await api(leila,`/api/ballots/${b.id}/vote`,payload)).status});
  await stop();
}
async function haiku() {
  await start(copy('claude-haiku-4-5'));
  const page=await browser.newPage(); await page.goto(base);
  await page.locator('#email').fill(actors.ruth+'@commonground.example');
  await page.locator('#password').fill('CommonGround!2026');
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  await page.reload();
  record('haiku authenticated refresh',{login_visible:await page.locator('#sign-in').isVisible(),workspace_visible:await page.locator('#workspace').isVisible()});
  await page.close();await stop();
}
(async()=>{
  browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  for(const [name,fn] of [['oracle',golden],['gpt',gpt],['gemini',gemini],['haiku',haiku]]) {
    try {await fn();} catch(e) {record(name+' probe error',{error:e.stack}); await stop();}
  }
})().finally(async()=>{
  await stop();await browser?.close();
  fs.writeFileSync(out+'/probe-results.json',JSON.stringify({scope:'Offline diagnostic, disposable captured app copies; not a judge or Oracle score',records},null,2)+'\n');
});
