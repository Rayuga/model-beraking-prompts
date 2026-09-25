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
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  if(results.subject==='gpt'){
    const ruth=await signin('ruth.adebayo'),errors=[];
    ruth.on('pageerror',error=>errors.push(error.message));
    await ruth.locator('[data-view="results"]').click();
    await ruth.locator('[data-view="turnout"]').click();
    await ruth.waitForTimeout(100);
    observe('Turnout UI throws on missing workspace fields',{errors,headings:await ruth.locator('#content h2').allTextContents()});
    assert(errors.some(e=>e.includes('map')));
    const leila=await signin('leila.ward');
    await leila.locator('[data-view="vote"]').click();
    const workspace=(await request(leila,'/api/workspace')).body;
    const ballot=workspace.vote[0];
    assert(ballot);
    const detail=(await request(leila,'/api/ballots/'+ballot.id)).body;
    const choiceInputs=await leila.locator('[name="choiceIds"]').count();
    observe('Vote list omits choices although detail has them',{ballot:ballot.title,choiceInputs,workspaceChoiceField:Object.hasOwn(ballot,'choices'),detailChoiceCount:detail.choices.length});
    assert.equal(choiceInputs,0);assert(detail.choices.length>=2);
    const drafts=[];
    for(let i=0;i<2;i++){
      const result=await request(ruth,'/api/ballots',{operation_id:'diagnostic-create-'+i,title:'Receipt diagnostic '+i,context:'Independent local analysis',method:i?'approval':'single',maxSelections:i?2:1,choices:['One','Two']});
      assert.equal(result.status,201);drafts.push(result.body.ballot);
    }
    const roster=(await request(ruth,'/api/workspace')).body.members;
    const original={operation_id:'diagnostic-round',ballotIds:drafts.map(b=>b.id),ballots:drafts.map(b=>({id:b.id,revision:b.revision})),roster:roster.map(m=>({userId:m.userId,revision:m.revision,active:m.active}))};
    const accepted=await request(ruth,'/api/ballots/open-round',original);assert.equal(accepted.status,200);
    const id=drafts[0].id;
    const opened=(await request(ruth,'/api/ballots/'+id)).body;
    const closed=await request(ruth,'/api/ballots/'+id+'/close',{operation_id:'diagnostic-close',revision:opened.revision});assert.equal(closed.status,200);
    const before=(await request(ruth,'/api/ballots/'+id)).body;
    const reversed={...original,ballotIds:[...original.ballotIds].reverse(),ballots:[...original.ballots].reverse(),roster:[...original.roster].reverse()};
    const replay=await request(ruth,'/api/ballots/open-round',reversed);
    const after=(await request(ruth,'/api/ballots/'+id)).body;
    observe('Old round receipt does not reopen a Closed record',{replayStatus:replay.status,receiptExactlyMatches:JSON.stringify(replay)===JSON.stringify(accepted),receiptState:replay.body.openedBallots.find(b=>b.id===id).status,beforeState:before.status,afterState:after.status,beforeRevision:before.revision,afterRevision:after.revision});
    assert.deepEqual(replay,accepted);assert.equal(before.status,'closed');assert.deepEqual(after,before);
  }else{
    const leila=await signin('leila.ward');
    const collection=(await request(leila,'/api/ballots')).body.ballots;
    const courtyard=collection.find(b=>b.title==='Courtyard closing time');assert(courtyard);
    const detail=(await request(leila,'/api/ballots/'+courtyard.id)).body.ballot;
    const vote=await request(leila,'/api/ballots/'+courtyard.id+'/vote',{operationId:'diagnostic-vote',choiceIds:[detail.choices[0].id]});
    observe('Valid seeded Member vote returns server error',{ballot:courtyard.title,status:vote.status,body:vote.body});
    assert.equal(vote.status,500);
  }
}
main().catch(error=>{results.error=String(error);console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  fs.writeFileSync('/results/diagnostics.json',JSON.stringify(results,null,2)+'\n');
});
