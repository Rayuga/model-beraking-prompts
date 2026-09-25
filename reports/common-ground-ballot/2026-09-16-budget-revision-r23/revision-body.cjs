const variant = process.env.REVISION_MUTANT || 'golden';
const observations = [];
const revisionSupport = `
const g = browser.__revisionCheck;
const card = (p,title) => p.getByRole('article').filter({has:p.getByRole('heading',{name:title,exact:true})});
async function fresh(p) {
  // Match a request from the new document, never a trailing old-page refresh
  // whose response body disappears when the browser reloads.
  let navigated=false;const requests=new Set();
  const onNavigation=frame=>{if(frame===p.mainFrame())navigated=true;};
  const onRequest=request=>{if(navigated&&request.method()==='GET'&&request.url()===g.collectionUrl)requests.add(request);};
  p.on('framenavigated',onNavigation);p.on('request',onRequest);
  try{
    const pending=p.waitForResponse(r=>requests.has(r.request()),{timeout:15000}).then(async response=>({status:response.status(),body:await response.json()}));
    await p.reload();const saved=await pending;
    await p.waitForLoadState('networkidle',{timeout:5000});return saved;
  }finally{p.removeListener('framenavigated',onNavigation);p.removeListener('request',onRequest);}
}
async function write(p, action) {
  const pending=p.waitForResponse(r=>!['GET','HEAD','OPTIONS'].includes(r.request().method()),{timeout:15000});
  await action(); const response=await pending;
  const saved={method:response.request().method(),url:response.url(),request:response.request().postData(),status:response.status(),body:await response.json()};
  g.exchanges.push(saved); await p.waitForLoadState('networkidle',{timeout:5000}); return saved;
}
`;
const observe = (name, body) => run(name, revisionSupport + body);
async function vote(actor, title, labels) {
  const data = await observe('vote-' + actor + '-' + observations.length, `
    const actor=g[${JSON.stringify(actor)}],title=${JSON.stringify(title)};
    const beforeRead=await fresh(g.ruth),before=beforeRead.body.ballots.find(b=>b.title===title);
    const memberBefore=await fresh(actor);
    await actor.getByRole('button',{name:'Vote',exact:true}).click();
    await card(actor,title).getByRole('button',{name:'Cast your ballot',exact:true}).click();
    for(const label of ${JSON.stringify(labels)})await actor.getByLabel(label,{exact:true}).check();
    await actor.getByLabel('I understand this is my one final submission.',{exact:true}).check();
    const mutation=await write(actor,()=>actor.getByRole('button',{name:'Submit final ballot',exact:true}).click({timeout:5000}));
    const afterRead=await fresh(g.ruth),after=afterRead.body.ballots.find(b=>b.id===before.id);
    const memberAfter=await fresh(actor);
    return {actor:${JSON.stringify(actor)},beforeReadStatus:beforeRead.status,afterReadStatus:afterRead.status,
      before,after,exchange:mutation,memberBefore:memberBefore.body.ballots.find(b=>b.id===before.id),
      memberAfter:memberAfter.body.ballots.find(b=>b.id===before.id)};`);
  assert.equal(data.beforeReadStatus,200); assert.equal(data.afterReadStatus,200);
  assert.equal(data.exchange.status,201); assert.equal(data.exchange.body.participated,true);
  assert.equal(data.memberBefore.participated,false); assert.equal(data.memberAfter.participated,true);
  assert.equal(data.before.id,data.after.id); assert.equal(data.before.status,'open'); assert.equal(data.after.status,'open');
  assert.equal(data.after.turnout.participated,data.before.turnout.participated+1);
  assert(Number.isInteger(data.before.revision)&&Number.isInteger(data.after.revision));
  const observation={actor,method:data.before.method,title,id:data.before.id,before:data.before.revision,after:data.after.revision,
    accepted:true,participationRecorded:true,unchanged:data.before.revision===data.after.revision};
  observations.push(observation); retain('observations',observations);
  return observation;
}
async function main() {
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'vote-revision-check',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const baseline = await run('authenticated-baseline', `
    browser.__revisionCheck={ruth:page,exchanges:[]};const g=browser.__revisionCheck,reads=[],jobs=[];
    const listener=r=>{if(r.request().method()==='GET')jobs.push(r.json().then(body=>{if(Array.isArray(body.ballots)&&body.ballots.length)reads.push({url:r.url(),body});}).catch(()=>{}));};
    page.on('response',listener);const identity=await signin(page,'ruth');await Promise.all(jobs);page.removeListener('response',listener);
    if(!reads.length)throw new Error('Missing observed protected collection');g.collectionUrl=reads.at(-1).url;
    g.leila=await(await browser.newContext()).newPage();await signin(g.leila,'leila');
    g.owen=await(await browser.newContext()).newPage();await signin(g.owen,'owen');
    return {identity,records:reads.at(-1).body.ballots.length};`);
  assert.match(baseline.identity,/Ruth/);assert.equal(baseline.records,4);
  await vote('owen','Courtyard closing time',['Keep 8 pm']);
  await vote('leila','Courtyard closing time',['Extend to 9 pm']);
  const approvalTitle='Revision approval '+Date.now();
  const creation=await observe('create-approval', `
    await createForm(g.ruth,${JSON.stringify(approvalTitle)});
    await g.ruth.getByLabel('Voting method',{exact:true}).selectOption('approval');
    await g.ruth.getByLabel('Maximum approvals',{exact:true}).fill('2');
    await g.ruth.locator('input[name=choice]').nth(1).fill('Afternoon');
    await g.ruth.getByRole('button',{name:'Add another choice',exact:true}).click();
    await g.ruth.locator('input[name=choice]').nth(2).fill('Evening');
    const created=await write(g.ruth,()=>g.ruth.getByRole('button',{name:'Save draft',exact:true}).click({timeout:5000}));
    const opened=await write(g.ruth,()=>card(g.ruth,${JSON.stringify(approvalTitle)}).getByRole('button',{name:'Open ballot',exact:true}).click({timeout:5000}));
    return {created,opened};`);
  assert.equal(creation.created.status,201);assert.equal(creation.opened.body.ballot.status,'open');
  await vote('leila',approvalTitle,['Morning','Evening']);

  // Demonstrate the reported false-pass case: relative lifecycle increments can
  // still be correct after votes have already corrupted the revision.
  const lifecycle=await observe('relative-close-control', `
    const beforeRead=await fresh(g.ruth),before=beforeRead.body.ballots.find(b=>b.title==='Courtyard closing time');
    const mutation=await write(g.ruth,()=>card(g.ruth,'Courtyard closing time').getByRole('button',{name:'Close voting',exact:true}).click({timeout:5000}));
    const afterRead=await fresh(g.ruth),after=afterRead.body.ballots.find(b=>b.id===before.id);
    return {before,after,exchange:mutation};`);
  assert.equal(lifecycle.after.status,'closed');assert.equal(lifecycle.after.revision,lifecycle.before.revision+1);
  const expectedMethod=variant==='single_increment'?'single':variant==='approval_increment'?'approval':null;
  for(const row of observations){
    const bad=variant==='vote_increment'||row.method===expectedMethod;
    assert.equal(row.after-row.before,bad?1:0,JSON.stringify(row));
  }
  const criterionPassed=observations.every(row=>row.unchanged);
  assert.equal(criterionPassed,variant==='golden');
  retain('verdict',{variant,passed:true,criterionPassed,observations,lifecycleStillAdvancesExactlyOne:true,scoredOracle:false});
  console.log(JSON.stringify({variant,criterionPassed,revisions:observations.map(row=>[row.method,row.before,row.after]),lifecycleControl:true}));
}
main().catch(error=>{console.error(error);retain('failure',{error:String(error),stderr,observations});process.exitCode=1;}).finally(()=>child.kill());
