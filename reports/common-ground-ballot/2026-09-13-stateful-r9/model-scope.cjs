const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const model=process.argv[2],base='http://localhost:3000';
const dir=fs.mkdtempSync('/tmp/ballot-captured-');
fs.cpSync('/model',dir,{recursive:true,filter:p=>!p.includes('node_modules')&&!/\.(db|sqlite)(-wal|-shm)?$/.test(p)});
const evidence={model,scope:'New-scope diagnostic on preserved r7 model source, not a historical failure or official r9 score.',checks:[]};
const selector={gpt:'[data-action=toggle-membership][data-user-id=user-owen]',gemini:'.btn-toggle-member[data-id=user-owen]',haiku:'.toggle-member[data-id=user-owen]'}[model];
let app,browser;
async function start(){
  app=spawn('node',['server.js'],{cwd:dir,env:{...process.env,DB_PATH:path.join(dir,'diagnostic.db')},stdio:['ignore','ignore','pipe']});
  app.stderr.on('data',b=>process.stderr.write(b));
  for(let i=0;i<100;i++){
    try {if((await fetch(base+'/api/health')).ok)return;}catch{}
    if(app.exitCode!==null)throw Error('Captured app exited');
    await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Captured app did not become ready');
}
async function stop(){
  if(app && app.exitCode===null){const end=once(app,'exit');app.kill('SIGTERM');await end;}
}
async function login(context){
  const p=await context.newPage();p.on('dialog',d=>d.accept());
  await p.goto(base);
  if(!await p.locator('#workspace').isVisible()){
    await p.locator('#email').fill('ruth.adebayo@commonground.example');
    await p.locator('#password').fill('CommonGround!2026');
    await p.locator('#login-form, [data-form=sign-in]').count().then(async n=>{
      if(n)await p.locator('#login-form, [data-form=sign-in]').locator('button[type=submit]').click();
      else await p.getByRole('button',{name:'Sign in',exact:true}).click();
    });
  }
  await p.locator('#workspace').waitFor({state:'visible'});
  return p;
}
async function members(p){await p.locator('[data-view=members]').first().click();await p.locator(selector).waitFor();}
async function capture(p,action,filter){
  const pending=p.waitForResponse(r=>['POST','PATCH'].includes(r.request().method()) && filter(r.url()));
  await action();const r=await pending;
  const headers=await r.request().allHeaders();
  const auth=Object.fromEntries(Object.entries(headers).filter(([k])=>['authorization','x-session-token','cookie'].includes(k)));
  return {url:r.url(),method:r.request().method(),body:r.request().postData(),status:r.status(),response:await r.json(),auth};
}
async function replay(p,e,body=e.body){
  return p.evaluate(async ({url,method,body,auth})=>{
    const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...auth},...(body===null?{}:{body})});
    return {status:r.status,body:await r.json()};
  },{url:e.url,method:e.method,body,auth:e.auth});
}
const clean=e=>({url:new URL(e.url).pathname,method:e.method,body:e.body,status:e.status,response:e.response});
async function clickMember(p){
  const e=await capture(p,()=>p.locator(selector).click(),u=>u.includes('/api/members/'));
  assert(e.status>=200&&e.status<300,JSON.stringify(clean(e)));
  return e;
}
async function main(){
  await start();browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext(),a=await login(context);
  await members(a);
  const activated=await clickMember(a);
  await a.reload();await members(a);
  const b=await login(context);await members(b);
  const staleLabel=await b.locator(selector).innerText();
  await clickMember(a);
  await a.reload();await members(a);await clickMember(a);
  const stale=await clickMember(b);
  evidence.checks.push({name:'ABA roster update from stale ordinary tab',initial_control:staleLabel,
    accepted_stale_request:clean(stale),activation_request:clean(activated),
    observation:'No revision or operation identifier in the actual membership mutation; stale action was accepted after pause/reactivate.'});
  if(model==='gpt'){
    await a.reload();await a.locator('[data-view=ballots]').first().click();
    const form=a.locator('[data-form=draft-create]');
    await form.locator('[name=title]').fill('Staff receipt diagnostic');
    await form.locator('[name=method]').selectOption('single');
    await form.locator('[name=maxSelections]').fill('1');
    for(const [i,label] of ['Yes','No'].entries())await form.locator('[data-choice-label]').nth(i).fill(label);
    const created=await capture(a,()=>form.getByRole('button',{name:'Create draft',exact:true}).click(),u=>u.endsWith('/api/ballots'));
    evidence.create_setup=clean(created);
    assert.equal(created.status,201,JSON.stringify(clean(created)));
    const duplicated=await replay(a,created);
    assert.equal(created.status,201);assert.equal(duplicated.status,201);
    assert.notEqual(created.response.ballotId,duplicated.body.ballotId);
    evidence.checks.push({name:'Exact create replay',original:clean(created),replay:duplicated,
      observation:'Actual staff create has no operation identifier; replay creates another identity.'});
    const id=created.response.ballotId;
    const act=async (record,action)=>{
      await a.reload();await a.locator('[data-view=ballots]').first().click();
      return capture(a,()=>a.locator('[data-action='+action+'-ballot][data-ballot-id="'+record+'"]').click(),u=>u.endsWith('/'+record+'/'+action));
    };
    const opened=await act(id,'open');
    const publishShape=await act('ballot-closed-improvements','publish');
    const s=await (await a.request.get(base+'/api/state')).json();
    const open=s.ballots.find(x=>x.id===id);
    const premature={...publishShape,url:base+'/api/ballots/'+id+'/publish',body:JSON.stringify({...JSON.parse(publishShape.body),revision:open.revision})};
    const originalRefusal=await replay(a,premature);
    assert(originalRefusal.status>=400);
    await act(id,'close');
    const laterRefusal=await replay(a,premature);
    assert.notDeepEqual(originalRefusal,laterRefusal);
    evidence.checks.push({name:'Premature publish after legitimate close',request:clean(premature),
      original:originalRefusal,replayed:laterRefusal,
      observation:'No staff operation mechanism. Wrong-state refusal changes into a revision refusal after Close.'});
    await act(id,'publish');
    const lateOpen=await replay(a,opened);
    evidence.checks.push({name:'Earlier Open after Published',original:clean(opened),replay:lateOpen});
    await stop();await start();
    evidence.after_restart={open_replay:await replay(a,opened),refusal_replay:await replay(a,premature)};
  }
  await a.reload();await members(a);
  evidence.final_member_control=await a.locator(selector).innerText();
  await a.screenshot({path:'/results/'+model+'-roster-diagnostic.png',fullPage:true});
}
main().catch(e=>{evidence.error=e.stack;process.exitCode=1;console.error(e);}).finally(async()=>{
  await browser?.close();await stop();
  fs.writeFileSync('/results/'+model+'-scope-diagnostics.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
});
