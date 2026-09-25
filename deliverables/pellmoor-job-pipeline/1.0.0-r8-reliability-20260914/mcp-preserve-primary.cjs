const {spawn} = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const packageInfo = require('/usr/local/lib/node_modules/@playwright/mcp/package.json');
assert.equal(packageInfo.version, '0.0.79');
const fixture = {revision: 0, commits: 0, receipts: new Map()};
const html = `<!doctype html><html><body><button id="review">Review</button><button id="confirm">Confirm</button><button id="retry" hidden>Retry</button><button id="advance">Advance</button><p id="status">Ready</p><script>
let reviewed, pending, original;
const status=document.querySelector('#status'), confirm=document.querySelector('#confirm'), retry=document.querySelector('#retry');
document.querySelector('#review').onclick=async()=>{reviewed=(await(await fetch('/state')).json()).revision;original=null;status.textContent='Reviewed '+reviewed};
async function commit(){if(pending)return;pending=true;confirm.disabled=true;retry.disabled=true;if(!original)original=JSON.stringify({expected_revision:reviewed,operation_id:crypto.randomUUID()});try{const r=await fetch('/commit',{method:'POST',headers:{'content-type':'application/json'},body:original});await r.json();const current=await(await fetch('/state')).json();status.textContent=(r.ok?'Acknowledged ':'Stale ')+current.revision;retry.hidden=true}catch{status.textContent='Uncertain';retry.hidden=false}finally{pending=false;confirm.disabled=false;retry.disabled=false}}
confirm.onclick=commit;retry.onclick=commit;
document.querySelector('#advance').onclick=async()=>{const r=await(await fetch('/advance',{method:'POST'})).json();status.textContent='Advanced '+r.revision};
</script></body></html>`;
const server = http.createServer(async(request,response)=>{
  const body=[];for await(const chunk of request)body.push(chunk);
  response.setHeader('Content-Type','application/json');
  if(request.url==='/state')return response.end(JSON.stringify({revision:fixture.revision}));
  if(request.url==='/advance'){fixture.revision++;return response.end(JSON.stringify({revision:fixture.revision}));}
  if(request.url==='/commit'){
    const text=Buffer.concat(body).toString(), data=JSON.parse(text);
    let saved=fixture.receipts.get(data.operation_id);
    if(!saved){
      saved=data.expected_revision===fixture.revision?{status:200,body:{committed:true,revision:++fixture.revision}}:{status:409,body:{error:'Stale',revision:fixture.revision}};
      fixture.receipts.set(data.operation_id,{...saved,request:text});
      if(saved.status===200)fixture.commits++;
    }else assert.equal(saved.request,text);
    response.statusCode=saved.status;return response.end(JSON.stringify(saved.body));
  }
  response.setHeader('Content-Type','text/html');response.end(html);
});
const child=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
const pending=new Map();let index=0,output='',stderr='';
child.stderr.on('data',data=>stderr+=data);
child.stdout.on('data',data=>{
  output+=data;let newline;
  while((newline=output.indexOf('\n'))>=0){
    const line=output.slice(0,newline);output=output.slice(newline+1);let value;
    try{value=JSON.parse(line);}catch{continue;}
    if(pending.has(value.id)){pending.get(value.id)(value);pending.delete(value.id);}
  }
});
async function call(method,params){
  const id=++index;let timer;
  try{return await Promise.race([new Promise(resolve=>{pending.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('MCP request timed out')),60000);})]);}
  finally{clearTimeout(timer);}
}
const helper=fs.readFileSync('/source/tests/functional/preserve-primary.js','utf8');
const capture=fs.readFileSync('/source/tests/functional/capture-loss.js','utf8');
const results=[];
async function run(name,body){
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const raw=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code:'async(page)=>{\n'+helper+'\n'+capture+'\n'+body+'\n}'}});
  fs.writeFileSync('/evidence/mcp-'+name+'-raw.json',JSON.stringify(raw,null,2));
  assert(!raw.error&&!raw.result?.isError,JSON.stringify(raw));
  const text=raw.result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
  const parsed=JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
  results.push({name,result:parsed});return parsed;
}
const shared=`
const observe=async(p,t)=>({status:await p.locator('#status').textContent({timeout:t})});
const review=async(p,t)=>{const response=p.waitForResponse(r=>r.url().endsWith('/state'),{timeout:t});await p.locator('#review').click({timeout:t});await response;await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Reviewed'),null,{timeout:t});return observe(p,t)};
const advance=async(p,t)=>{await p.goto('http://localhost:3000',{timeout:t});const response=p.waitForResponse(r=>r.url().endsWith('/advance'),{timeout:t});await p.locator('#advance').click({timeout:t});return {status:(await response).status()}};
const send=async(p,t,selector)=>{const response=p.waitForResponse(r=>r.url().endsWith('/commit'),{timeout:t});await p.locator(selector).click({timeout:t});const r=await response;await p.waitForFunction(()=>/^(Stale|Acknowledged)/.test(document.querySelector('#status').textContent),null,{timeout:t});return {status:r.status(),body:await r.json(),request:r.request().postData(),ui:await observe(p,t)}};
`;
async function main(){
  await new Promise(resolve=>server.listen(3000,'0.0.0.0',resolve));
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pellmoor-preserve-primary',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const inventory=await call('tools/list',{});
  assert(inventory.result.tools.some(tool=>tool.name==='browser_run_code_unsafe'));
  const stale=await run('primary-stale',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:review,actSecondary:advance,resumePrimary:(p,t)=>send(p,t,'#confirm')});`);
  assert.equal(stale.setup_error,null);assert.equal(stale.completed.status,409);assert.match(stale.completed.ui.status,/Stale/);assert.equal(fixture.commits,0);
  assert.deepEqual(stale.diagnostics.counts_before,stale.diagnostics.counts_after);assert.equal(stale.diagnostics.primary.closed,false);
  const lost=await run('primary-lost',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:async(p,t,savePrepared)=>{await review(p,t);const receipt=await captureCommittedLoss(p,{url:'http://localhost:3000/commit',method:'POST',timeoutMs:t,activate:()=>p.locator('#confirm').click({timeout:t}),observePending:async()=>({disabled:await p.locator('#confirm').isDisabled()}),activateAgain:()=>p.locator('#confirm').evaluate(button=>button.click())});savePrepared(receipt);await p.locator('#retry').waitFor({state:'visible',timeout:t});return receipt},actSecondary:advance,resumePrimary:(p,t)=>send(p,t,'#retry')});`);
  assert.equal(lost.setup_error,null);assert.equal(lost.prepared.setup_error,null);assert.equal(lost.prepared.requests_while_pending,1);assert.equal(lost.completed.status,200);
  assert.equal(lost.prepared.requests[0].request_body,lost.completed.request);assert.deepEqual(lost.prepared.requests[0].response_json,lost.completed.body);
  assert.equal(lost.completed.ui.status,'Acknowledged '+fixture.revision);assert.equal(fixture.commits,1);
  assert.deepEqual(lost.diagnostics.counts_before,lost.diagnostics.counts_after);assert(lost.diagnostics.events.some(event=>event.event==='primary-requestfailed'));
  const failed=await run('secondary-failed',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:review,actSecondary:async()=>{throw new Error('Deliberate synthetic secondary setup failure')},resumePrimary:()=>{throw new Error('Must not resume after failed secondary')}});`);
  assert.equal(failed.setup_error.phase,'secondary action');assert.match(failed.setup_error.message,/Deliberate synthetic/);assert.match(failed.prepared.status,/Reviewed/);assert.equal(failed.completed,null);assert.match(failed.after.status,/Reviewed/);
  assert.deepEqual(failed.diagnostics.counts_before,failed.diagnostics.counts_after);assert.equal(failed.diagnostics.primary.closed,false);
  const navigated=await run('primary-navigation-detected',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:review,actSecondary:async(p,t)=>{await page.goto('http://localhost:3000/changed',{timeout:t});return {deliberate_test_navigation:true}},resumePrimary:()=>{throw new Error('Must not resume a replaced primary')}});`);
  assert.equal(navigated.setup_error.phase,'return to primary');assert.equal(navigated.diagnostics.primary.same_url,false);assert.equal(navigated.completed,null);assert(navigated.prepared);
  assert.deepEqual(navigated.diagnostics.counts_before,navigated.diagnostics.counts_after);
  const preparedNavigation=await run('primary-prepare-navigation-allowed',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:async(p,t)=>{await p.goto('http://localhost:3000/reviewed',{timeout:t});return review(p,t)},actSecondary:advance,resumePrimary:(p,t)=>send(p,t,'#confirm')});`);
  assert.equal(preparedNavigation.setup_error,null);assert.equal(preparedNavigation.completed.status,409);assert.equal(preparedNavigation.diagnostics.primary.same_url,true);assert.match(preparedNavigation.diagnostics.prepared_location,/reviewed$/);
  assert.deepEqual(preparedNavigation.diagnostics.counts_before,preparedNavigation.diagnostics.counts_after);
  const capturedThenFailed=await run('primary-capture-before-prepare-error',shared+`return preservePrimarySession(page,{timeoutMs:5000,observePrimary:observe,preparePrimary:async(p,t,savePrepared)=>{await review(p,t);const receipt=await captureCommittedLoss(p,{url:'http://localhost:3000/commit',method:'POST',timeoutMs:t,activate:()=>p.locator('#confirm').click({timeout:t}),observePending:async()=>({disabled:await p.locator('#confirm').isDisabled()}),activateAgain:()=>p.locator('#confirm').evaluate(button=>button.click())});savePrepared(receipt);throw new Error('Deliberate synthetic read failure after captured response')},actSecondary:()=>{throw new Error('Must not create secondary after failed preparation')},resumePrimary:()=>{throw new Error('Must not resume after failed preparation')}});`);
  assert.equal(capturedThenFailed.setup_error.phase,'prepare primary');assert.match(capturedThenFailed.setup_error.message,/read failure after captured/);
  assert.equal(capturedThenFailed.prepared.setup_error,null);assert.equal(capturedThenFailed.prepared.requests[0].status,200);assert.equal(capturedThenFailed.prepared.requests_while_pending,1);
  assert.equal(capturedThenFailed.secondary,null);assert.equal(capturedThenFailed.completed,null);assert.equal(capturedThenFailed.diagnostics.primary.closed,false);
  assert.deepEqual(capturedThenFailed.diagnostics.counts_before,capturedThenFailed.diagnostics.counts_after);
  const report={scope:'Actual pinned MCP helper compatibility against synthetic transport/session fixtures; no product score',mcp_version:packageInfo.version,helper_sha256:crypto.createHash('sha256').update(helper).digest('hex'),passed:true,results,stderr};
  fs.writeFileSync('/evidence/mcp-preserve-primary-results.json',JSON.stringify(report,null,2));
  console.log('PASS actual MCP: stale confirmation, lost-response exact retry/live view, secondary-failure capture preservation, secondary navigation detection, legitimate preparation navigation, response checkpoint survives later preparation error; temporary contexts cleaned up');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{child.kill();server.close();});
