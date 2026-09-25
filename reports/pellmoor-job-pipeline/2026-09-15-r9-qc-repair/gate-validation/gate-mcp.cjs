const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const mcpVersion=require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(mcpVersion,'0.0.79');
const results=[];
const golden=spawn('node',['/app/backend/server.js'],{cwd:'/app/backend',stdio:['ignore','pipe','pipe']});
const log=fs.createWriteStream('/evidence/golden.log');golden.stdout.pipe(log);golden.stderr.pipe(log);
function fixture(fake){
 const sessions=new Set();
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pellmoor</title><style>body{font:16px system-ui;background:#f5f4ef;color:#263238;max-width:900px;margin:40px auto;padding:24px}section{background:white;border:1px solid #ccd5d0;border-radius:16px;padding:24px}button,input{font:inherit;padding:12px;border:1px solid #b9c7c0;border-radius:8px}button{background:#285e52;color:white}label{display:block;margin:16px 0}nav{margin:20px 0}#notes{line-height:1.8}[hidden]{display:none!important}</style></head><body><h1>Pellmoor hiring</h1><section id="signin"><h2>Sign in</h2><label>Email<input id="email" value="hiring@pellmoor.test"></label><label>Password<input id="password" type="password"></label><button id="login">Sign in</button><p id="error"></p></section><section id="app" hidden><h2>Workshop vacancy</h2><p>1 reserved · 2 available</p><nav><button id="open">Devi Ranjit</button></nav><section id="panel" hidden><h2>Devi Ranjit</h2><p>Offer · Otis and Wren completed the assessment</p><h3>Notes</h3><div id="notes"></div>${fake?'<label>New note<input id="note"></label><button id="save">Add note</button><p id="saved"></p>':'<p>Notes are unavailable in this preview.</p>'}</section></section><script>
let token=localStorage.getItem('session');
async function api(path,body){return fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined})}
async function boot(){if(token&&(await api('/api/candidate')).ok){document.querySelector('#signin').hidden=true;document.querySelector('#app').hidden=false}}
document.querySelector('#login').onclick=async()=>{const r=await api('/api/login',{email:document.querySelector('#email').value,password:document.querySelector('#password').value});const data=await r.json();if(!r.ok){document.querySelector('#error').textContent='Wrong password';return}token=data.token;localStorage.setItem('session',token);await boot()};
document.querySelector('#open').onclick=async()=>{const data=await(await api('/api/candidate')).json();document.querySelector('#panel').hidden=false;const notes=${fake?'JSON.parse(localStorage.getItem("notes")||"[]")':'data.notes'};document.querySelector('#notes').replaceChildren(...notes.map(note=>{const p=document.createElement('p');p.textContent=note.body;return p}))};
${fake?`document.querySelector('#save').onclick=async()=>{const body=document.querySelector('#note').value;const r=await api('/api/candidate/notes',{body});if(r.ok){const notes=JSON.parse(localStorage.getItem('notes')||'[]');notes.push({body});localStorage.setItem('notes',JSON.stringify(notes));document.querySelector('#saved').textContent='Note saved';await document.querySelector('#open').onclick()}};`:''}
boot();</script></body></html>`;
 return http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):null;
  res.setHeader('content-type','application/json');
  if(req.url==='/api/login'){
   if(body.email!=='hiring@pellmoor.test'||body.password!=='password123'){res.statusCode=401;return res.end(JSON.stringify({error:'Wrong password'}));}
   const token=randomUUID();sessions.add(token);return res.end(JSON.stringify({token}));
  }
  if(req.url.startsWith('/api/')){
   if(!sessions.has((req.headers.authorization||'').replace(/^Bearer /,''))){res.statusCode=401;return res.end(JSON.stringify({error:'Unauthenticated'}));}
   if(req.url==='/api/candidate')return res.end(JSON.stringify({id:'candidate-1',name:'Devi Ranjit',notes:[]}));
   if(fake&&req.url==='/api/candidate/notes')return res.end(JSON.stringify({accepted:true,note:body.body}));
   res.statusCode=405;return res.end(JSON.stringify({error:'Read only'}));
  }
  res.setHeader('content-type','text/html');res.end(html);
 });
}
const readOnly=fixture(false),fakeWrite=fixture(true);
const child=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
let index=0,output='',stderr='';const pending=new Map();
child.stderr.on('data',d=>stderr+=d);
child.stdout.on('data',d=>{output+=d;let n;while((n=output.indexOf('\n'))>=0){const line=output.slice(0,n);output=output.slice(n+1);let v;try{v=JSON.parse(line)}catch{continue}if(pending.has(v.id)){pending.get(v.id)(v);pending.delete(v.id)}}});
async function call(method,params){const id=++index;let timer;try{return await Promise.race([new Promise(resolve=>{pending.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('MCP request timed out')),60000)})])}finally{clearTimeout(timer)}}
async function run(name,code){
 const raw=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{code:'async(page)=>{'+code+'}'}});
 fs.writeFileSync('/evidence/'+name+'-raw.json',JSON.stringify(raw,null,2));
 assert(!raw.error&&!raw.result?.isError,JSON.stringify(raw));
 const text=raw.result.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
 const result=JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
 results.push({name,result});return result;
}
const probe=String.raw`
const timeout=10000;
const login=async(p)=>{
 await p.goto(base,{timeout});
 await p.waitForFunction(()=>!document.querySelector('#signin').hidden||!document.querySelector('#app').hidden,null,{timeout});
 if(await p.locator('#signin').isVisible()){
  await p.locator('#email').fill('hiring@pellmoor.test',{timeout});await p.locator('#password').fill('password123',{timeout});
  await p.getByRole('button',{name:'Sign in',exact:true}).click({timeout});await p.locator('#app').waitFor({state:'visible',timeout});
 }
};
const open=async(p)=>{
 if(isGolden){await p.waitForFunction(()=>document.body.dataset.busy==='false',null,{timeout});await p.locator('[data-code="ROLE-015"]').click({timeout});await p.waitForFunction(()=>document.body.dataset.busy==='false',null,{timeout});}
 const read=p.waitForResponse(r=>r.url()===base+(isGolden?'/api/candidates/CAND-106':'/api/candidate')&&r.request().method()==='GET',{timeout});
 await p.locator(isGolden?'.cand[data-id="CAND-106"]':'#open').click({timeout});const r=await read;await p.locator('#panel').waitFor({state:'visible',timeout});return {status:r.status(),body:await r.json(),url:r.url(),fromServiceWorker:r.fromServiceWorker()};
};
await login(page);const before=await open(page);
const hasControl=await page.locator('#note').count()>0;
if(!hasControl)return {gate_passed:false,reason:'No normal note write control',before};
await page.locator('#note').fill(marker,{timeout});
const writeWait=page.waitForResponse(r=>r.url().endsWith('/notes')&&r.request().method()==='POST',{timeout});
await page.locator(isGolden?'#notef button':'#save').click({timeout});
const writeResponse=await writeWait;
const write={status:writeResponse.status(),url:writeResponse.url(),request_body:writeResponse.request().postData(),response_body:await writeResponse.text(),fromServiceWorker:writeResponse.fromServiceWorker()};
if(isGolden)await page.waitForFunction(()=>document.body.dataset.busy==='false',null,{timeout});
await page.reload({timeout});await page.locator('#app').waitFor({state:'visible',timeout});const afterReload=await open(page);
const visibleAfterReload=(await page.locator(isGolden?'#panel ol.notes':'#notes').textContent({timeout})).includes(marker);
const secondary=await page.context().browser().newContext();let independent;
try{const other=await secondary.newPage();await login(other);const read=await open(other);independent={...read,visible:(await other.locator(isGolden?'#panel ol.notes':'#notes').textContent({timeout})).includes(marker)}}finally{await secondary.close()}
const count=read=>Array.isArray(read.body.notes)?read.body.notes.filter(n=>n.body===marker).length:0;
return {gate_passed:write.status>=200&&write.status<300&&!write.fromServiceWorker&&visibleAfterReload&&count(afterReload)===1&&independent.visible&&count(independent)===1,marker,before,write,afterReload,visibleAfterReload,independent,counts:{reloaded:count(afterReload),independent:count(independent)}};
`;
async function snapshot(){
 const auth=await(await fetch('http://127.0.0.1:3000/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'hiring@pellmoor.test',password:'password123'})})).json();
 const headers={authorization:'Bearer '+auth.token};
 const roles=[];for(const id of ['ROLE-014','ROLE-015','ROLE-016','ROLE-017'])roles.push(await(await fetch('http://127.0.0.1:3000/api/roles/'+id,{headers})).json());
 const candidates=[];for(const role of roles)for(const candidate of role.candidates)candidates.push(await(await fetch('http://127.0.0.1:3000/api/candidates/'+candidate.id,{headers})).json());
 return {roles,candidates};
}
function assertSeedShape(a,b){
 const shape=s=>s.roles.map(r=>({role:{code:r.role.code,title:r.role.title,team:r.role.team,openings:r.role.openings},funnel:r.funnel,capacity:r.capacity,candidates:r.candidates.map(c=>({id:c.id,stage:c.stage,panel:c.panel,scores:c.scores}))}));
 assert.deepEqual(shape(a),shape(b));
}
async function main(){
 await Promise.all([new Promise(r=>readOnly.listen(3001,'0.0.0.0',r)),new Promise(r=>fakeWrite.listen(3002,'0.0.0.0',r))]);
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3000')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pellmoor-write-gate',version:'1.0.0'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const inventory=await call('tools/list',{});assert(inventory.result.tools.some(x=>x.name==='browser_run_code_unsafe'));
 const before=await snapshot();
 for(const name of ['golden-polish-before','golden-visual-before']){const result=await run(name,`const base='http://127.0.0.1:3000',isGolden=true,marker=${JSON.stringify(name+' follow-up '+randomUUID())};`+probe);assert.equal(result.gate_passed,true);}
 const afterBeforeGates=await snapshot();assertSeedShape(before,afterBeforeGates);
 const pim=afterBeforeGates.candidates.find(c=>(c.candidate?.id||c.id)==='CAND-104');assert.equal(pim.notes.length,0);
 const transitions=await run('golden-later-terminal-state',String.raw`await page.goto('http://127.0.0.1:3000');await page.waitForFunction(()=>document.body.dataset.busy==='false');await page.locator('[data-code="ROLE-015"]').click();await page.waitForFunction(()=>document.body.dataset.busy==='false');await page.locator('.cand[data-id="CAND-106"]').click();const statuses=[];for(const stage of ['hired','withdrawn']){const response=page.waitForResponse(r=>r.url().endsWith('/stage')&&r.request().method()==='POST',{timeout:10000});await page.locator('[data-to="'+stage+'"]').click({timeout:10000});statuses.push((await response).status());await page.waitForFunction(()=>document.body.dataset.busy==='false')}return {statuses,visible:await page.locator('#panel').textContent()};`);
 assert.deepEqual(transitions.statuses,[200,200]);
 for(const name of ['golden-polish-after','golden-visual-after']){const result=await run(name,`const base='http://127.0.0.1:3000',isGolden=true,marker=${JSON.stringify(name+' follow-up '+randomUUID())};`+probe);assert.equal(result.gate_passed,true);}
 const readOnlyResult=await run('read-only-pretty',`const base='http://127.0.0.1:3001',isGolden=false,marker='Read-only follow-up';`+probe);assert.equal(readOnlyResult.gate_passed,false);
 const fakeResult=await run('optimistic-client-storage',`const base='http://127.0.0.1:3002',isGolden=false,marker='Client-only follow-up';`+probe);assert.equal(fakeResult.write.status,200);assert.equal(fakeResult.visibleAfterReload,true);assert.equal(fakeResult.counts.reloaded,0);assert.equal(fakeResult.independent.visible,false);assert.equal(fakeResult.gate_passed,false);
 fs.writeFileSync('/evidence/seed-preservation.json',JSON.stringify({before,after:afterBeforeGates,seedFieldsPreserved:true,pimNotesRemainEmpty:true},null,2));
 fs.writeFileSync('/evidence/results.json',JSON.stringify({scope:'actual MCP UI/server persistence prerequisite regression, not hosted judge scores',mcpVersion,passed:true,results,stderr},null,2));
 console.log('PASS 4 golden note gates before/after later terminal state; original seed shape and empty-note fixture preserved; read-only and fake client-storage fixtures correctly fail');
}
main().catch(e=>{console.error(e.stack);fs.writeFileSync('/evidence/partial-results.json',JSON.stringify({results,stderr,error:String(e.stack)},null,2));process.exitCode=1}).finally(()=>{child.kill();golden.kill('SIGTERM');log.end();readOnly.close();fakeWrite.close()});
