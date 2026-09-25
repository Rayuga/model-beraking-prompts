const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const results={subject:process.argv[2],scoredRun:false,observations:[]};
const observe=(name,data)=>{results.observations.push({name,...data});console.log(name,JSON.stringify(data));};
let browser;
async function request(page,url,body,method){
  return page.evaluate(async ({url,body,method})=>{
    const res=await fetch(url,{method:method||(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    return {status:res.status,body:await res.json()};
  },{url,body,method});
}
async function signin(who){
  const page=await (await browser.newContext()).newPage();
  page.setDefaultTimeout(12000);
  await page.goto('http://localhost:3000');
  await page.getByLabel('Email',{exact:true}).fill(who+'@commonground.example');
  await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#workspace').waitFor({state:'visible'});
  await page.waitForLoadState('networkidle');
  return page;
}
async function main(){
  results.scope='Human-repaired disposable GPT submission; scripted diagnostic, not a scored model run';
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ruth=await signin('ruth.adebayo'),leila=await signin('leila.ward'),errors=[];
  ruth.on('pageerror',e=>errors.push(e.message));leila.on('pageerror',e=>errors.push(e.message));
  const surfaces=[];
  for(const view of ['ballots','turnout','results','members','audit']){
    await ruth.locator('[data-view="'+view+'"]').click();
    const content=await ruth.locator('#content').innerText();
    assert(content.length>30);surfaces.push({view,headings:await ruth.locator('#content h2').allTextContents()});
  }
  await leila.locator('[data-view="vote"]').click();
  assert.equal(await leila.locator('[name="choiceIds"]').count(),2);
  surfaces.push({view:'vote',headings:await leila.locator('#content h2').allTextContents()});
  assert.deepEqual(errors,[]);observe('All six workspace surfaces usable after two data repairs',{surfaces,errors});
  async function create(title,approval){
    await ruth.locator('[data-view="ballots"]').click();
    await ruth.locator('#create-title').fill(title);
    await ruth.locator('#create-context').fill('Diagnostic browser journey');
    await ruth.locator('#create-method').selectOption(approval?'approval':'single');
    await ruth.locator('#create-max').fill(approval?'2':'1');
    await ruth.locator('#create-choices').fill('Morning\nEvening');
    const reply=ruth.waitForResponse(r=>r.url().endsWith('/api/ballots')&&r.request().method()==='POST');
    await ruth.getByRole('button',{name:'Create draft',exact:true}).click();
    const response=await reply;assert.equal(response.status(),201);
    const data=await response.json();await ruth.waitForLoadState('networkidle');return data.ballot;
  }
  async function lifecycle(id,action){
    const reply=ruth.waitForResponse(r=>r.url().endsWith('/api/ballots/'+id+'/'+action)&&r.request().method()==='POST');
    await ruth.locator('button[data-action="'+action+'-ballot"][data-ballot-id="'+id+'"]').click();
    const response=await reply;assert.equal(response.status(),200);await ruth.waitForLoadState('networkidle');return response.json();
  }
  for(const approval of [false,true]){
    const ballot=await create('Render recovery '+(approval?'approval':'single'),approval);
    await lifecycle(ballot.id,'open');
    await leila.reload();await leila.waitForLoadState('networkidle');await leila.locator('[data-view="vote"]').click();
    const form=leila.locator('form[data-form="vote-ballot"][data-ballot-id="'+ballot.id+'"]');
    const input=form.locator('[name="choiceIds"]');assert.equal(await input.count(),2);await input.nth(0).check();if(approval)await input.nth(1).check();
    const before=(await request(ruth,'/api/ballots/'+ballot.id)).body;
    const reply=leila.waitForResponse(r=>r.url().endsWith('/api/ballots/'+ballot.id+'/vote')&&r.request().method()==='POST');
    await form.getByRole('button',{name:'Submit vote',exact:true}).click();
    const response=await reply,status=response.status(),body=await response.json(),packet=response.request().postDataJSON();
    assert.equal(status,200);await leila.waitForLoadState('networkidle');
    const afterVote=(await request(ruth,'/api/ballots/'+ballot.id)).body;
    assert.equal(before.revision,afterVote.revision);assert.equal(afterVote.participantCount,1);
    await ruth.reload();await ruth.waitForLoadState('networkidle');
    await ruth.locator('[data-view="ballots"]').click();
    await lifecycle(ballot.id,'close');await lifecycle(ballot.id,'publish');
    await Promise.all([ruth.reload(),leila.reload()]);await Promise.all([ruth.waitForLoadState('networkidle'),leila.waitForLoadState('networkidle')]);
    const after=(await request(ruth,'/api/ballots/'+ballot.id)).body,member=(await request(leila,'/api/ballots/'+ballot.id)).body;
    assert.equal(after.status,'published');assert.equal(after.participantCount,1);assert(member.youParticipated);
    assert.equal(after.results.participantCount,1);
    const reordered={...packet,choiceIds:[...packet.choiceIds].reverse()};
    const replay=await request(leila,'/api/ballots/'+ballot.id+'/vote',reordered);
    assert.deepEqual(replay,{status,body});
    const final=(await request(ruth,'/api/ballots/'+ballot.id)).body;assert.deepEqual(final,after);
    observe('Visible '+(approval?'approval':'single')+' journey retains accepted vote and publication',{createdRevision:ballot.revision,voteStatus:status,voteRevisionBefore:before.revision,voteRevisionAfter:afterVote.revision,finalState:after.status,participantCount:after.participantCount,memberOwnParticipation:member.youParticipated,results:after.results,exactReplayAfterPublication:true});
  }
  // The two repairs deliberately do not supply draft/round summary definitions.
  await ruth.locator('[data-view="ballots"]').click();
  await ruth.locator('button[data-action="edit-draft"]').first().click();
  const draftChoices=await ruth.locator('#draft-choices').inputValue();
  observe('Independent draft-edit defect remains',{renderedDraftChoices:draftChoices,empty:draftChoices===''});
  assert.equal(draftChoices,'');assert.deepEqual(errors,[]);
}
main().catch(error=>{results.error=String(error);console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  fs.writeFileSync('/results/diagnostics.json',JSON.stringify(results,null,2)+'\n');
});
