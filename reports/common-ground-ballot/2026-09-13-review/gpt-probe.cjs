const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const dir=fs.mkdtempSync('/tmp/ballot-gpt-review-');
fs.cpSync('/model',dir,{recursive:true,filter:p=>!p.includes('node_modules')&&!/\.(db|sqlite)(-wal|-shm)?$/.test(p)});
const evidence={scope:'Unmodified captured GPT source copied to a disposable container; UI setup, diagnostic assertions, no score changes.',model:'gpt-5.4-mini'};
const base='http://localhost:3000';
let child,browser;
async function start(){
  child=spawn('node',['server.js'],{cwd:dir,env:{...process.env,DB_PATH:path.join(dir,'review.db')},stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',b=>process.stderr.write(b));
  for(let i=0;i<100;i++){
    try{if((await fetch(base+'/api/health')).ok)return;}catch{}
    if(child.exitCode!==null)throw new Error('App exited');
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('App not ready');
}
async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}}
async function login(who){
  const p=await(await browser.newContext({viewport:{width:1280,height:800}})).newPage();
  p.on('dialog',d=>d.accept());
  await p.goto(base);await p.locator('#email').fill(who+'@commonground.example');
  await p.locator('#password').fill('CommonGround!2026');
  await p.getByRole('button',{name:'Sign in',exact:true}).click();
  await p.locator('#workspace').waitFor({state:'visible'});return p;
}
async function state(p){return(await p.request.get(base+'/api/state')).json();}
async function action(p,selector,route){
  const pending=p.waitForResponse(r=>r.url().endsWith(route)&&r.request().method()==='POST');
  await p.locator(selector).click();const r=await pending;
  assert(r.ok(),await r.text());return r;
}
async function main(){
  await start();browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ruth=await login('ruth.adebayo'),leila=await login('leila.ward');
  await ruth.locator('nav [data-view=members]').click();
  await action(ruth,'[data-action=toggle-membership][data-user-id=user-owen]','/api/members/user-owen/active');
  await ruth.locator('nav [data-view=ballots]').click();
  const form=ruth.locator('[data-form=draft-create]');
  await form.locator('[name=title]').fill('Partial turnout approval');
  await form.locator('[name=method]').selectOption('approval');
  await form.locator('[data-action=add-choice]').click();
  await form.locator('[name=maxSelections]').fill('2');
  for(const [i,name] of ['Morning','Afternoon','Evening'].entries())await form.locator('[data-choice-label]').nth(i).fill(name);
  const created=ruth.waitForResponse(r=>r.url().endsWith('/api/ballots')&&r.request().method()==='POST');
  await form.getByRole('button',{name:'Create draft',exact:true}).click();assert.equal((await created).status(),201);
  let b=(await state(ruth)).ballots.find(b=>b.title==='Partial turnout approval');
  await action(ruth,`[data-action=open-ballot][data-ballot-id="${b.id}"]`,`/api/ballots/${b.id}/open`);
  b=(await state(ruth)).ballots.find(x=>x.id===b.id);assert.equal(b.eligibleCount,2);
  await leila.reload();await leila.locator('nav [data-view=vote]').click();
  const vote=leila.locator(`[data-form=vote][data-ballot-id="${b.id}"]`);
  await vote.getByLabel('Morning',{exact:true}).check();await vote.getByLabel('Evening',{exact:true}).check();
  const pending=leila.waitForResponse(r=>r.url().endsWith(`/${b.id}/vote`)&&r.request().method()==='POST');
  await vote.getByRole('button',{name:'Submit final ballot'}).click();
  const response=await pending;assert(response.ok());
  const original={url:response.url(),body:response.request().postDataJSON(),status:response.status(),response:await response.json()};
  const replay=async()=>{const r=await leila.request.post(original.url,{data:original.body});return{status:r.status(),body:await r.json()};};
  assert.deepEqual(await replay(),{status:original.status,body:original.response});
  evidence.open_replay={passed:true};
  for(const act of ['close','publish']){
    await ruth.reload();await ruth.locator('nav [data-view=ballots]').click();
    await action(ruth,`[data-action=${act}-ballot][data-ballot-id="${b.id}"]`,`/api/ballots/${b.id}/${act}`);
  }
  b=(await state(ruth)).ballots.find(x=>x.id===b.id);
  assert.equal(b.participantCount,1);assert.equal(b.eligibleCount,2);
  assert.equal(b.turnout.absentMembers[0].name,'Owen Park');
  await ruth.reload();await ruth.locator('nav [data-view=results]').click();
  const panel=ruth.locator('#view-results article').filter({has:ruth.getByRole('heading',{name:'Partial turnout approval',exact:true})});
  evidence.partial_turnout={eligible:b.eligibleCount,participants:b.participantCount,
    expected:[100,0,100],actual:b.results.choiceResults.map(x=>x.percentage),
    results:b.results.choiceResults,visible_text:await panel.innerText()};
  assert.deepEqual(evidence.partial_turnout.actual,[50,0,50]);
  await ruth.screenshot({path:'/results/gpt-partial-turnout.png',fullPage:true});
  evidence.published_replay=await replay();assert.equal(evidence.published_replay.status,400);
  await stop();await start();
  evidence.after_restart_replay=await replay();assert.equal(evidence.after_restart_replay.status,400);
  const persisted=(await state(ruth)).ballots.find(x=>x.id===b.id);
  evidence.persisted_percentages=persisted.results.choiceResults.map(x=>x.percentage);
  assert.deepEqual(evidence.persisted_percentages,[50,0,50]);
  evidence.confirmed_defects=['Approval percentages use eligible count, not participant count.','Accepted vote cannot replay after publication, before or after restart.'];
}
main().catch(e=>{evidence.error=e.stack;process.exitCode=1;console.error(e);}).finally(async()=>{
  await browser?.close();await stop();fs.writeFileSync('/results/gpt-probe-results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
});
