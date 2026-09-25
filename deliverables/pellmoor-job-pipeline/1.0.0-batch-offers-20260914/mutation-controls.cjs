const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {randomUUID}=require('node:crypto');
const source=fs.readFileSync('/source/solution/backend/server.js','utf8');
const frontend=fs.readFileSync('/source/solution/src/app.ts','utf8');
const results=[];let child,tokens={};
const base='http://localhost:3000',path='/api/roles/ROLE-014/batch-offers';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(method,path,body,who='r'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function role(){return (await req('GET','/api/roles/ROLE-014')).data;}
async function cand(id){return (await req('GET','/api/candidates/'+id)).data;}
async function state(){const r=await role();return {role:r,details:await Promise.all(r.candidates.map(c=>cand(c.id)))};}
async function mutate(route,body,who='r'){
 const request={...body,expected_revision:(await role()).revision,operation_id:randomUUID()};
 return {...await req('POST',route,request,who),body:request};
}
async function ready(name){
 const created=await mutate('/api/candidates',{role:'ROLE-014',name},'c');assert.equal(created.status,201);
 const id=created.data.candidate.id,route='/api/candidates/'+id;
 for(const stage of ['screening','interview'])assert.equal((await mutate(route+'/stage',{stage})).status,200);
 for(const [who,member] of [['o','panel1'],['w','panel2']])assert.equal((await mutate(route+'/panel',{member:member+'@pellmoor.test'},'c')).status,201);
 for(const who of ['o','w'])assert.equal((await mutate(route+'/score',{score:4},who)).status,201);
 return id;
}
async function start(name,code){
 fs.writeFileSync('/app/backend/server.js',code);tokens={};
 const log=fs.openSync('/evidence/mutant-'+name+'.log','w');
 child=spawn('node',['/app/backend/server.js'],{cwd:'/app',uid:65534,gid:65534,env:{PATH:'/usr/local/bin:/usr/bin:/bin',NODE_PATH:'/usr/local/lib/node_modules',DB_PATH:'/tmp/pellmoor-'+name+'.db'},stdio:['ignore',log,log]});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(50);}
 for(const [who,email] of Object.entries({r:'hiring',c:'coord',o:'panel1',w:'panel2'})){
  const r=await req('POST','/api/login',{email:email+'@pellmoor.test',password:'password123'},'none');assert.equal(r.status,200);tokens[who]=r.data.token;
 }
 return [await ready('Mutation A'),await ready('Mutation B'),await ready('Mutation C')];
}
async function stop(){if(child){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;child=null;}}
function replaceOnce(text,old,value){assert.equal(text.split(old).length,2,old);return text.replace(old,value);}
const partial=replaceOnce(source,"  const code = request.params.code;\n  const outcome = performMutation(request, code, () => {",`  const code = request.params.code;
  const first = request.body.candidate_ids?.[0];
  if (first && candidateRow(first)) db.prepare("UPDATE candidates SET stage='offer' WHERE id=?").run(first);
  const outcome = performMutation(request, code, () => {`);
const capacity=replaceOnce(source,'if (ids.length > capacity.available)','if (false)');
const stale=replaceOnce(source,'if (metadata.expectedRevision !== actual) {',"if (metadata.expectedRevision !== actual && !request.path.endsWith('/batch-offers')) {");
const audit=replaceOnce(source,'batch_position: index + 1, batch_size: plan.candidates.length,','batch_position: index + 2, batch_size: plan.candidates.length,');
const receipt=replaceOnce(source,'  if (existing) {',"  if (existing && !request.path.endsWith('/batch-offers')) {");
const probes={
 partial:async([A])=>{const before=await state();const r=await mutate(path,{candidate_ids:[A,'CAND-101']});assert(r.status>=400&&r.status<500);assert.deepEqual(await state(),before);},
 capacity:async(selection)=>{const before=await state();const r=await mutate(path,{candidate_ids:selection});assert.equal(r.status,409);assert.deepEqual(await state(),before);},
 stale:async([A,B])=>{const revision=(await role()).revision;await mutate('/api/candidates/'+A+'/notes',{body:'Concurrent note'},'w');const before=await state();const r=await req('POST',path,{candidate_ids:[A,B],expected_revision:revision,operation_id:randomUUID()});assert.equal(r.status,409);assert.deepEqual(await state(),before);},
 audit:async([A,B])=>{const before=await cand(A);const r=await mutate(path,{candidate_ids:[A,B]});assert.equal(r.status,200);const added=(await cand(A)).activity.filter(e=>!before.activity.some(x=>x.id===e.id));assert.equal(added.length,1);assert.equal(added[0].details.batch_position,1);assert.equal(added[0].details.batch_size,2);assert.equal(added[0].details.batch_id,r.data.batch_id);},
 receipt:async([A,B])=>{const r=await mutate(path,{candidate_ids:[A,B]});assert.equal(r.status,200);await mutate('/api/candidates/'+A+'/stage',{stage:'withdrawn'});const before=await state();const replay=await req('POST',path,r.body);assert.deepEqual(replay,{status:r.status,data:r.data});assert.deepEqual(await state(),before);}
};
async function uiProbe(name,selection){
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto(base);await page.locator('#email').fill('hiring@pellmoor.test');await page.locator('#password').fill('password123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#board .cand').first().waitFor();
  await page.locator('#batch-open').click();for(const id of selection.slice(0,2))await page.locator(`[data-batch-id="${id}"]`).check();
  await page.locator('#batch-review').click();await page.locator('#batch-confirm').waitFor();
  if(name==='silent-refresh'){
   await mutate('/api/candidates/'+selection[2]+'/notes',{body:'Other session changed this vacancy'},'w');const before=await state();
   const response=page.waitForResponse(r=>r.url().endsWith(path));await page.locator('#batch-confirm').click();const r=await response;
   assert.equal(r.status(),409);assert.deepEqual(await state(),before);
  }else{
   let original;
   await page.route('**'+path,async route=>{const response=await route.fetch();original={body:route.request().postDataJSON(),data:await response.json()};await route.abort('failed');});
   await page.locator('#batch-confirm').click();await page.waitForFunction(()=>document.querySelector('#batch-retry')&&!document.querySelector('#batch-retry').disabled);
   await page.unroute('**'+path);const before=await state();const response=page.waitForResponse(r=>r.url().endsWith(path));
   await page.locator('#batch-retry').click();const r=await response;
   assert.deepEqual(r.request().postDataJSON(),original.body);assert.equal(r.status(),200);assert.deepEqual(await r.json(),original.data);assert.deepEqual(await state(),before);
  }
 }finally{await browser.close();}
}
function buildUI(code){fs.writeFileSync('/app/src/app.ts',code);execFileSync('npm',['run','build'],{cwd:'/app',stdio:'pipe'});}
async function main(){
 for(const [name,mutant] of Object.entries({partial,capacity,stale,audit,receipt})){
  const baseline=await start(name+'-golden',source);await probes[name](baseline);await stop();
  let detected=false,reason='';const sample=await start(name+'-mutant',mutant);
  try{await probes[name](sample);}catch(e){detected=true;reason=e.message.slice(0,500);}finally{await stop();}
  assert(detected,'Mutant was not detected: '+name);results.push({name,golden_passed:true,mutant_detected:detected,reason});
  console.log('PASS golden and detected broken '+name);
 }
 const uiMutants={
  'silent-refresh':replaceOnce(frontend,'  if (!batchRequest) batchRequest = {',`  if (!batchRequest) { const newest = await api('GET', '/api/roles/' + view.role.code); batchReview.revision = newest.data.revision; }
  if (!batchRequest) batchRequest = {`),
  'new-retry-identity':replaceOnce(frontend,'  if (!batchRequest) batchRequest = {','  batchRequest = {')
 };
 for(const [name,mutant] of Object.entries(uiMutants)){
  buildUI(frontend);let selected=await start(name+'-golden',source);await uiProbe(name,selected);await stop();
  buildUI(mutant);selected=await start(name+'-mutant',source);let detected=false,reason='';
  try{await uiProbe(name,selected);}catch(e){detected=true;reason=e.message.slice(0,500);}finally{await stop();}
  assert(detected,'UI mutant not detected: '+name);results.push({name,golden_passed:true,mutant_detected:detected,reason});console.log('PASS golden and detected broken '+name);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await stop();fs.writeFileSync('/evidence/mutation-controls.json',JSON.stringify({scope:'Local behavioral negative controls on disposable copies, not judge scores',results},null,2));});
