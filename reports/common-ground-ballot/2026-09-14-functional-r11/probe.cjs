const fs = require('node:fs');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const kind = process.argv[2];
const golden = kind !== 'gpt';
const out = {kind, scope:'Focused local diagnostics, not an LLM score. Disposable database; source-specific transport adapters.', groups:[]};
const source = '/runtime/app';
fs.cpSync('/submission', source, {recursive:true, filter:p => !/commonground\.db(?:-wal|-shm)?$/.test(p)});
if(golden)fs.copyFileSync('/seed.json',source+'/common_ground_seed.json');
if (kind.startsWith('mutant-')) {
  const file = source + '/server.js';
  let text = fs.readFileSync(file,'utf8');
  const variants = {
    'mutant-member-leak': ['view.eligible = Boolean(db.prepare(', 'view.participation_leak = {user_id: "user-owen", participated: true};\n    view.eligible = Boolean(db.prepare('],
    'mutant-roster-coercion': ['if (typeof request.body.active !== "boolean") throw new ApiError(400, "Active must be true or false.");', 'request.body.active = Boolean(request.body.active);'],
    'mutant-ordered-receipt': ['choiceIds: [...choiceIds].sort()', 'choiceIds'],
  };
  const [before,after] = variants[kind];
  if (!text.includes(before)) throw new Error('Mutation anchor not found: '+kind);
  fs.writeFileSync(file,text.replace(before,after));
}
let server, browser;
const serverLog = fs.openSync('/results/server.log','w');
async function start() {
  server = spawn('node',[source+'/server.js'], {cwd:source,env:{...process.env,DB_PATH:'/runtime/review.db',SEED_PATH:source+'/common_ground_seed.json'},stdio:['ignore',serverLog,serverLog]});
  for(let n=0;n<100;n++) {
    try {if((await fetch('http://localhost:3000/api/health')).ok)return;} catch {}
    if(server.exitCode !== null)throw new Error('App exited during startup');
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Startup timeout');
}
async function stop() {const ended=once(server,'exit');server.kill('SIGTERM');await ended;}
const uid = name => 'user-'+name;
const op = () => crypto.randomUUID();
const readPath = golden ? '/api/ballots' : '/api/bootstrap';
const memberPath = (golden ? '/api/members/' : '/api/memberships/') + uid('owen');
async function api(page,path,method='GET',body) {
  return page.evaluate(async ({path,method,body})=>{
    const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
    return {status:r.status,body:data};
  },{path,method,body});
}
async function user(name) {
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto('http://localhost:3000');
  await page.getByLabel('Email',{exact:true}).fill(name+'.'+({ruth:'adebayo',leila:'ward',owen:'park'}[name])+'@commonground.example');
  await page.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator(golden?'#app-view':'#app-shell').waitFor({state:'visible'});return page;
}
const bodyOp = value => golden ? {operation_id:value} : {operationId:value};
const bodyRev = value => golden ? {expected_revision:value} : {baseRevision:value};
const choicesBody = values => golden ? {choice_ids:values} : {selections:values};
const ballots = async p => (await api(p,readPath)).body.ballots;
async function staffState(p) {
  if(!golden)return (await api(p,readPath)).body;
  return {ballots:await ballots(p),members:(await api(p,'/api/members')).body,audit:(await api(p,'/api/audit')).body};
}
async function member(p) {
  const data=golden?(await api(p,'/api/members')).body:(await api(p,readPath)).body;
  const row=(golden?data.members:data.roster).find(x=>x.id===uid('owen'));
  return {active:row.active,revision:golden?row.revision:data.rosterRevision};
}
async function setActive(p,active) {
  const m=await member(p),r=await api(p,memberPath,'PATCH',{active,...bodyOp(op()),...bodyRev(m.revision)}),after=await member(p);
  if(r.status!==200||after.active!==active||after.revision!==m.revision+1)throw new Error('Membership positive control failed');
  return r;
}
async function create(p,title) {
  const params={title,description:'Focused privacy and retry review',method:'approval',choices:['Morning','Afternoon','Evening'],...bodyOp(op()),...(golden?{max_selections:2}:{maxSelections:2})};
  const r=await api(p,'/api/ballots','POST',params);
  if(r.status!==201)throw new Error('Create failed: '+JSON.stringify(r));
  return r.body.ballot.id;
}
const find = async(p,id)=>(await ballots(p)).find(b=>b.id===id);
async function transition(p,id,action) {const b=await find(p,id);const r=await api(p,'/api/ballots/'+id+'/'+action,'POST',{...bodyOp(op()),...bodyRev(b.revision)});if(r.status!==200)throw new Error('Lifecycle failed: '+JSON.stringify(r));return find(p,id);}
function leakPaths(value,other,path='') {
  if(value===other && /particip|submitted/i.test(path))return [path];
  if(value && typeof value==='object')return Object.entries(value).flatMap(([key,v])=>leakPaths(v,other,path?path+'.'+key:key));
  return [];
}
async function main() {
  await start();browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ruth=await user('ruth'),leila=await user('leila'),owen=await user('owen');
  await setActive(ruth,true);await setActive(ruth,false);
  const malformed=[];
  for(const type of ['omitted','object','array']) {
    if((await member(ruth)).active)await setActive(ruth,false);
    const m=await member(ruth),before=await staffState(ruth);
    const input={...bodyOp(op()),...bodyRev(m.revision)};
    if(type!=='omitted')input.active=type==='object'?{}:[];
    const r=await api(ruth,memberPath,'PATCH',input);
    const unchanged=JSON.stringify(before)===JSON.stringify(await staffState(ruth));
    malformed.push({type,status:r.status,unchanged,passed:r.status>=400&&unchanged});
    if((await member(ruth)).active)await setActive(ruth,false);
  }
  const snapshotId=await create(ruth,'Membership validation snapshot');
  await transition(ruth,snapshotId,'open');
  const snapshotBefore=await find(ruth,snapshotId);
  await setActive(ruth,true);await setActive(ruth,false);
  const snapshotStable=JSON.stringify(snapshotBefore)===JSON.stringify(await find(ruth,snapshotId));
  const absentForOwen=!(await find(owen,snapshotId));
  out.groups.push({name:'malformed_membership_snapshot',passed:malformed.every(x=>x.passed)&&snapshotStable&&absentForOwen,cases:malformed,snapshot_stable:snapshotStable,absent_for_owen:absentForOwen});
  const courtyard=(await ballots(owen)).find(b=>b.title==='Courtyard closing time');
  const voteOwen={...bodyOp(op()),...bodyRev(courtyard.revision),...choicesBody([courtyard.choices[0].id])};
  const owenVote=await api(owen,'/api/ballots/'+courtyard.id+'/vote','POST',voteOwen);
  if(owenVote.status>=300)throw new Error('Owen vote failed');
  const privacy=[];
  async function privacyCheck(stage) {
    const reads={leila:await api(leila,readPath),owen:await api(owen,readPath)};
    const paths={leila:leakPaths(reads.leila.body,uid('owen')),owen:leakPaths(reads.owen.body,uid('leila'))};
    privacy.push({stage,protected_statuses:[reads.leila.status,reads.owen.status],leak_paths:paths,passed:reads.leila.status===200&&reads.owen.status===200&&!paths.leila.length&&!paths.owen.length});
  }
  await privacyCheck('one participant');
  const voteLeila={...bodyOp(op()),...bodyRev((await find(leila,courtyard.id)).revision),...choicesBody([courtyard.choices[1].id])};
  const leilaVote=await api(leila,'/api/ballots/'+courtyard.id+'/vote','POST',voteLeila);
  if(leilaVote.status>=300)throw new Error('Leila vote failed');
  await privacyCheck('two participants');
  const approvalId=await create(ruth,'Approval order review');await transition(ruth,approvalId,'open');
  const approval=await find(leila,approvalId), choiceIds=[approval.choices[0].id,approval.choices[2].id];
  const original={...bodyOp(op()),...bodyRev(approval.revision),...choicesBody(choiceIds)};
  const route='/api/ballots/'+approvalId+'/vote';
  const accepted=await api(leila,route,'POST',original);
  if(accepted.status>=300)throw new Error('Approval vote failed');
  const reordered={...original,...choicesBody([...choiceIds].reverse())};
  const replayChecks=[];
  async function replayCheck(stage) {
    const before=await staffState(ruth),r=await api(leila,route,'POST',reordered),exact=await api(leila,route,'POST',original);
    const identical=JSON.stringify(r)===JSON.stringify(accepted),exactOk=JSON.stringify(exact)===JSON.stringify(accepted);
    const unchanged=JSON.stringify(before)===JSON.stringify(await staffState(ruth));
    replayChecks.push({stage,reordered_status:r.status,original_status:accepted.status,reordered_matches:identical,exact_matches:exactOk,state_unchanged:unchanged,passed:identical&&exactOk&&unchanged});
  }
  await replayCheck('open');
  const beforeMismatch=await staffState(ruth),mismatch=await api(leila,route,'POST',{...original,...choicesBody([approval.choices[1].id])});
  const mismatchOk=mismatch.status>=400&&JSON.stringify(beforeMismatch)===JSON.stringify(await staffState(ruth));
  await replayCheck('after mismatch');
  for(const id of [approvalId,courtyard.id]) {await transition(ruth,id,'close');await transition(ruth,id,'publish');}
  await replayCheck('published');await privacyCheck('published');
  for(let n=1;n<=2;n++) {await stop();await start();await replayCheck('restart '+n);await privacyCheck('restart '+n);}
  out.groups.push({name:'member_participation_privacy',passed:privacy.every(x=>x.passed),checks:privacy});
  const final=await find(ruth,approvalId);
  out.groups.push({name:'approval_order_retry',passed:replayChecks.every(x=>x.passed)&&mismatchOk,mismatch_status:mismatch.status,mismatch_unchanged:mismatchOk,checks:replayChecks,published_results:golden?final.results:final.publishedResults});
  out.completed=true;
}
main().catch(e=>{out.completed=false;out.error=e.stack;process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server&&server.exitCode===null)await stop();fs.closeSync(serverLog);
  fs.writeFileSync('/results/probe-results.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
});
