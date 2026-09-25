const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const version = require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(version,'0.0.79');
const child = spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
let buffer='', sequence=0, stderr='';
const pending=new Map(), results=[];
child.stderr.on('data',data=>stderr+=data);
child.stdout.on('data',data=>{
  buffer+=data;
  while(buffer.includes('\n')) {
    const index=buffer.indexOf('\n'),line=buffer.slice(0,index);buffer=buffer.slice(index+1);
    let value;try{value=JSON.parse(line);}catch{continue;}
    if(pending.has(value.id)){pending.get(value.id)(value);pending.delete(value.id);}
  }
});
async function call(method,params) {
  const id=++sequence;let timer;
  try {
    return await Promise.race([new Promise(resolve=>{pending.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('MCP timeout for '+method)),55000);})]);
  } finally {clearTimeout(timer);pending.delete(id);}
}
const source=fs.readFileSync('/validation/browser-regression.cjs','utf8');
const helpers=source.slice(source.indexOf('const accounts ='),source.indexOf('async function main()')).replaceAll('new URL(result.url()).pathname',"result.url().replace('http://localhost:3000','').split('?')[0]").replaceAll('new URL(r.url()).pathname',"r.url().replace('http://localhost:3000','').split('?')[0]");
const support=`const assert=(value,message)=>{if(!value)throw new Error(message||'Assertion failed');};assert.equal=(a,b)=>assert(a===b,JSON.stringify({a,b}));assert.deepEqual=(a,b)=>assert(JSON.stringify(a)===JSON.stringify(b),JSON.stringify({a,b}));assert.match=(value,pattern)=>assert(pattern.test(value),value);const errors=[];const browser=page.context().browser();${helpers}`;
async function run(name,body,allowDialog=false) {
  const response=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code:`async(page)=>{${support}\n${body}\n}`}});
  fs.writeFileSync('/results/mcp-'+name+'.json',JSON.stringify(response,null,2),{mode:0o600});
  assert(!response.error&&!response.result?.isError,JSON.stringify(response).slice(-1500));
  const text=response.result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
  if(allowDialog && !text.includes('### Result\n')) { assert(text.includes('browser_handle_dialog'),text.slice(-1000));return {dialog:true}; }
  const value=JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
  return value;
}
function passed(name) {results.push({name,passed:true});console.log('PASS MCP',name);}
let contexts;
const actors=()=>`const contexts=browser.contexts();const ruth=contexts[${contexts.ruth}].pages()[0],arun=contexts[${contexts.arun}].pages()[0],leila=contexts[${contexts.leila}].pages()[0],owen=contexts[${contexts.owen}].pages()[0];`;
async function privacy(name,expected) {
  const value=await run(name,actors()+`
    const output={};
    for(const [name,p] of [['leila',leila],['owen',owen],['ruth',ruth],['arun',arun]]) {
      const captured=[];const listener=async r=>{if(r.url().includes('/api/')&&r.request().method()==='GET'){try{captured.push({url:r.url(),status:r.status(),body:await r.json()});}catch{}}};
      p.on('response',listener);await p.reload();await p.locator('#app-view').waitFor({state:'visible'});
      await view(p,name==='ruth'||name==='arun'?'turnout':'vote');
      const identity=await api(p,'/api/me');const collection=await api(p,'/api/ballots');
      p.removeListener('response',listener);
      output[name]={identity,collection,captured,ui:await p.locator('#app-view').innerText()};
    }
    return output;`);
  for(const [who,other] of [['leila','owen'],['owen','leila']]) {
    assert.equal(value[who].identity.body.user.id,'user-'+who);
    assert.equal(value[who].collection.status,200);
    const rows=value[who].collection.body.ballots;
    const courtyard=rows.find(b=>b.title==='Courtyard closing time');
    assert.equal(courtyard.participated,expected[who]);
    for(const payload of [value[who].collection.body,...value[who].captured.filter(c=>c.url.endsWith('/api/ballots')).map(c=>c.body)]) {
      const encoded=JSON.stringify(payload);
      assert(!encoded.includes('user-'+other),name+' leaked identified turnout');
      for(const row of payload.ballots||[])assert(!('turnout' in row),name+' member received staff turnout');
    }
    assert(value[who].captured.some(c=>c.url.endsWith('/api/ballots')&&c.status===200));
  }
  for(const who of ['ruth','arun']) {
    const b=value[who].collection.body.ballots.find(b=>b.title==='Courtyard closing time');
    for(const member of ['leila','owen'])assert.equal(b.turnout.members.find(m=>m.id==='user-'+member).participated,expected[member]);
  }
  passed(name);
}
async function approval(name,saved) {
  const body=JSON.stringify(saved);
  const before=await run(name+'-before',actors()+`return await snapshot(ruth);`);
  const choices=saved.body.choice_ids;
  const different=before.ballots.find(b=>b.title==='Partial turnout approval').choices.find(c=>!choices.includes(c.id)).id;
  for(const [label,payload,status] of [
    ['original',saved.body,201],['reordered',{...saved.body,choice_ids:[...choices].reverse()},201],
    ['mismatch',{...saved.body,choice_ids:[different]},409],
    ['original-after-mismatch',saved.body,201],['reordered-after-mismatch',{...saved.body,choice_ids:[...choices].reverse()},201]
  ]) {
    const value=await run(name+'-'+label,actors()+`const saved=${body};const result=await api(leila,saved.route,'POST',${JSON.stringify(payload)});return {result,after:await snapshot(ruth)};`);
    assert.equal(value.result.status,status,name+' '+label);
    if(status===201)assert.deepEqual(value.result.body,saved.receipt);
    else assert.match(value.result.body.error,/operation.*different/i);
    assert.deepEqual(value.after,before);
  }
  passed(name);
}
async function main() {
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'ballot-crosscheck',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const inventory=await call('tools/list',{});
  assert(inventory.result.tools.some(t=>t.name==='browser_run_code_unsafe'));
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  for(let attempt=1;attempt<=2;attempt++) {
    const setup=await run('sessions-'+attempt+'-prepare',`
      await signIn(page,'ruth');const a=page,b=await person('ruth');
      const credential=async p=>(await p.context().cookies()).filter(c=>c.name==='cg_session').map(c=>c.name+'='+c.value).join('; ');
      const read=async(p,cookie)=>{const r=await p.context().request.get('http://localhost:3000/api/ballots',cookie?{headers:{Cookie:cookie}}:{});return {status:r.status(),body:await r.json()};};
      const old=await credential(a),normalResponse=a.waitForResponse(r=>r.url().endsWith('/api/auth/logout')&&r.request().method()==='POST');
      await a.getByRole('button',{name:'Sign out',exact:true}).click();const normal=await normalResponse;
      await b.reload();await b.locator('#app-view').waitFor({state:'visible'});
      const isolated={ended:await read(a,old),surviving:await read(b)};
      await signIn(a,'ruth');const ca=await credential(a),cb=await credential(b);
      page.__judgeSession={a,b,read,ca,cb,ended:a.waitForResponse(r=>r.url().endsWith('/api/auth/logout-all')&&r.request().method()==='POST').then(async r=>({status:r.status(),body:await r.json()}))};
      return {ordinaryStatus:normal.status(),isolated,distinct:ca!==cb};`);
    assert.equal(setup.ordinaryStatus,200);assert(setup.distinct);
    assert.equal(setup.isolated.ended.status,401);assert.equal(setup.isolated.surviving.status,200);
    const click=await run('sessions-'+attempt+'-click',`await page.getByRole('button',{name:'End all sessions',exact:true}).click();return {clicked:true};`,true);
    assert(click.dialog);
    const confirmation=await call('tools/call',{name:'browser_handle_dialog',arguments:{accept:true}});
    fs.writeFileSync('/results/mcp-sessions-'+attempt+'-confirm.json',JSON.stringify(confirmation,null,2));
    assert(!confirmation.error&&!confirmation.result?.isError);
    const value=await run('sessions-'+attempt+'-revocation',`
      const {a,b,read,ca,cb,ended}=page.__judgeSession;const completed=await ended;
      const immediate=[await read(a),await read(b)];if(immediate.some(r=>r.status!==401))return {allStatus:completed.status,immediate,refreshed:[],replayed:[],primaryClosed:a.isClosed()};await a.reload();await b.reload();
      await a.locator('#login-view').waitFor({state:'visible'});await b.locator('#login-view').waitFor({state:'visible'});
      const refreshed=[await read(a),await read(b)],replayed=[await read(a,ca),await read(b,cb)];
      return {allStatus:completed.status,immediate,refreshed,replayed,primaryClosed:a.isClosed()};`);
    assert.equal(value.allStatus,200);assert(!value.primaryClosed);
    for(const read of [...value.immediate,...value.refreshed,...value.replayed])assert.deepEqual(read,{status:401,body:{error:'Please sign in to continue.'}});
    const fresh=await run('sessions-'+attempt+'-fresh-signin',`const {a,b,read}=page.__judgeSession;await signIn(a,'ruth');const fresh=await read(a);await b.context().close();delete page.__judgeSession;await a.bringToFront();return {freshStatus:fresh.status};`);
    assert.equal(fresh.freshStatus,200);passed('sessions-'+attempt);
  }
  contexts=await run('actors',`await signIn(page,'ruth');const arun=await person('arun'),leila=await person('leila'),owen=await person('owen');return Object.fromEntries([['ruth',page],['arun',arun],['leila',leila],['owen',owen]].map(([name,p])=>[name,browser.contexts().indexOf(p.context())]));`);
  const toggle=async name=>run(name,actors()+`await view(ruth,'members');const pending=ruth.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/api/members/user-owen'));await ruth.locator('[data-member-id="user-owen"]').click();const response=await pending;return {status:response.status(),body:await response.json(),after:await snapshot(ruth)};`);
  assert.equal((await toggle('activate-owen')).status,200);
  assert.equal((await run('create-partial',actors()+`return await draft(ruth,'Partial turnout approval');`)).status,201);
  await run('open-partial',actors()+`return await lifecycle(ruth,'Partial turnout approval','open');`);
  assert.equal((await toggle('pause-owen')).status,200);
  const owenVote=await run('owen-vote',actors()+`return await vote(owen,'Courtyard closing time',['Keep 8 pm']);`);
  assert.equal(owenVote.receipt.participated,true);
  await privacy('one-participant',{leila:false,owen:true});
  await run('leila-courtyard-vote',actors()+`return await vote(leila,'Courtyard closing time',['Extend to 9 pm']);`);
  await privacy('two-participants',{leila:true,owen:true});
  const saved=await run('leila-approval-vote',actors()+`return await vote(leila,'Partial turnout approval',['Morning','Evening']);`);
  await approval('approval-open',saved);
  for(const title of ['Courtyard closing time','Partial turnout approval']) {
    for(const action of ['close','publish'])await run(action+'-'+title.split(' ')[0],actors()+`return await lifecycle(ruth,${JSON.stringify(title)},${JSON.stringify(action)});`);
  }
  await privacy('published',{leila:true,owen:true});
  await approval('approval-published',saved);
  for(let restart=1;restart<=2;restart++) {
    execFileSync('python3',['/tests/app-lifecycle.py','restart'],{stdio:'pipe'});
    await privacy('restart-'+restart,{leila:true,owen:true});
    await approval('approval-restart-'+restart,saved);
    const value=await run('totals-restart-'+restart,actors()+`const courtyard=await find(ruth,'Courtyard closing time'),partial=await find(ruth,'Partial turnout approval');return {courtyard,partial,owenReplay:await api(owen,${JSON.stringify(owenVote.route)},'POST',${JSON.stringify(owenVote.body)})};`);
    assert.deepEqual(value.courtyard.results.map(r=>[r.label,r.votes]),[['Keep 8 pm',1],['Extend to 9 pm',1]]);
    assert.deepEqual(value.partial.results.map(r=>[r.label,r.votes,r.percentage]),[['Morning',1,100],['Afternoon',0,0],['Evening',1,100]]);
    assert.equal(value.partial.total_ballots,1);assert.equal(value.partial.turnout.eligible,2);
    assert.deepEqual(value.owenReplay,{status:201,body:owenVote.receipt});passed('totals-restart-'+restart);
  }
}
main().catch(error=>{results.push({name:'MCP crosscheck failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync('/results/mcp-results.json',JSON.stringify({mcpVersion:version,scoredOracle:false,results,stderr},null,2)+'\n');child.kill();
});
