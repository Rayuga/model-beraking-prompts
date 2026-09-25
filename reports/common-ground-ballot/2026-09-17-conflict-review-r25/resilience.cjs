const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const config=JSON.parse(fs.readFileSync('/opt/common-ground-verifier/mcp-config.json','utf8'));
assert.equal(config.cwd,'/opt/common-ground-verifier');
assert(!config.args.includes('--allow-unrestricted-file-access'));
const child=spawn(config.command,config.args,{cwd:config.cwd,stdio:['pipe','pipe','pipe']});
let buffer='',seq=0,stderr='',exited=null;const waiting=new Map(),checks=[];
child.stderr.on('data',data=>stderr+=data);
child.on('exit',(code,signal)=>{exited={code,signal};for(const row of waiting.values())row.reject(new Error('MCP exited '+JSON.stringify(exited)));waiting.clear();});
child.stdout.on('data',data=>{buffer+=data;while(buffer.includes('\n')){const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);let value;try{value=JSON.parse(line);}catch{continue;}
 if(value.method==='roots/list'){child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:value.id,result:{roots:[{uri:'file://'+config.cwd,name:'verifier'}]}})+'\n');continue;}
 if(waiting.has(value.id)){waiting.get(value.id).resolve(value);waiting.delete(value.id);}}});
async function call(method,params){const id=++seq;let timer;try{return await Promise.race([new Promise((resolve,reject)=>{if(exited)return reject(new Error('MCP exited'));waiting.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('tool timeout')),45000);})]);}finally{clearTimeout(timer);waiting.delete(id);}}
const tool=(name,args)=>call('tools/call',{name,arguments:args});
function save(name,value){fs.writeFileSync('/results/'+name+'.json',JSON.stringify(value,null,2).replaceAll('CommonGround!2026','[redacted fixture password]').replaceAll('CommonGround!wrong','[redacted wrong fixture password]')+'\n');}
function parsed(response){assert(!response.error&&!response.result?.isError,JSON.stringify(response));const value=response.result.content.filter(row=>row.type==='text').map(row=>row.text).join('\n');assert(value.includes('### Result\n'));return JSON.parse(value.split('### Result\n')[1].split('\n###')[0]);}
async function run(name,body){const raw=await tool('browser_run_code_unsafe',{code:'async(page)=>{const browser=page.context().browser();const e=browser.__ballotEvidence;'+body+'}'});save(name,raw);return parsed(raw);}
function pass(name){checks.push({name,passed:true});console.log('PASS '+name);}
async function main(){
 await call('initialize',{protocolVersion:'2024-11-05',capabilities:{roots:{listChanged:false}},clientInfo:{name:'actual-runtime-resilience',version:'1'}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 await tool('browser_navigate',{url:'http://localhost:3000'});
 const installed=await tool('browser_run_code_unsafe',{filename:'/opt/common-ground-verifier/browser-evidence.js'});save('private-helper-load',installed);
 assert.equal(parsed(installed).version,'r24');assert(!fs.existsSync('/app/.playwright-mcp/browser-evidence.js'));
 pass('configured private cwd loads original helper without copying it into the app or widening file access');
 const original=JSON.parse(fs.readFileSync('/validation/oracle-functional-tools.json','utf8')).find(row=>row.arguments?.code?.includes('gate-wrong-password'));
 const replay=await tool('browser_run_code_unsafe',original.arguments);save('exact-oracle-call',replay);
 const failed=parsed(replay);assert.equal(failed.state,'evidence-missing');assert.match(failed.error,/Capture matcher failed.*URL is not defined/);
 assert.equal(exited,null);assert(!(await tool('browser_tabs',{action:'list'})).error);
 pass('exact Oracle crashing call now records a recoverable matcher error and keeps MCP alive');
 for(const [name,mode,matcher] of [
   ['route-throw','drop',"request=>request.method()==='POST' && new URL(request.url()).origin==='http://localhost:3000'"],
   ['async-rejection','observe',"async request=>{throw new Error('Intentional async predicate failure');}"],
   ['nonboolean','observe',"request=>42"],
 ]){
  const result=await run(name,`return await e.capture(page,${JSON.stringify(name)},()=>page.getByRole('button',{name:'Sign in',exact:true}).click(),{mode:${JSON.stringify(mode)},match:${matcher}});`);
  assert.equal(result.state,'evidence-missing');assert.match(result.error,/Capture matcher failed/);assert.equal(exited,null);
  pass(name+' is contained without transport loss');
 }
 const correct=await run('corrected-wrong-password',`return await e.capture(page,'corrected-wrong',()=>page.getByRole('button',{name:'Sign in',exact:true}).click(),{match:r=>r.method()==='POST'&&r.url().startsWith('http://localhost:3000/')});`);
 assert.equal(correct.state,'captured');assert.equal(correct.response.status,401);
 const rejection=await run('visible-rejection',`return {visible:await page.getByRole('alert').isVisible(),text:await page.getByRole('alert').innerText(),signedOut:await page.locator('#login-view').isVisible()};`);
 assert(rejection.visible&&rejection.text&&rejection.signedOut);pass('corrected matcher captures real401 and visible wrong-password rejection');
 const signedIn=await run('legitimate-signin',`await page.getByRole('textbox',{name:'Password',exact:true}).fill('CommonGround!2026');return await e.capture(page,'correct-login',()=>page.getByRole('button',{name:'Sign in',exact:true}).click(),{match:r=>r.method()==='POST'&&r.url().startsWith('http://localhost:3000/')});`);
 assert.equal(signedIn.response.status,200);
 const populated=await run('protected-reload',`return await e.capture(page,'protected-reload',()=>page.reload(),{match:r=>r.method()==='GET'&&r.url().endsWith('/api/ballots')});`);
 assert.equal(populated.response.status,200);assert.equal(populated.response.body.ballots.length,4);
 pass('same MCP session completes real sign-in and populated protected reload after matcher repair');
 const negative=await run('fresh-negative-context',`browser.__anonymous=await(await browser.newContext()).newPage();const p=browser.__anonymous;await p.goto('http://localhost:3000');return await p.evaluate(async url=>{const r=await fetch(url);return {status:r.status,body:await r.json()};},${JSON.stringify(populated.request.url)});`);
 assert.equal(negative.status,401);assert(!negative.body.ballots);
 const guestWrong=await run('negative-wrong-password',`const p=browser.__anonymous;await p.getByRole('textbox',{name:'Email',exact:true}).fill('ruth.adebayo@commonground.example');await p.getByRole('textbox',{name:'Password',exact:true}).fill('CommonGround!wrong');return await e.capture(p,'guest-wrong',()=>p.getByRole('button',{name:'Sign in',exact:true}).click(),{match:r=>r.method()==='POST'&&r.url().startsWith('http://localhost:3000/')});`);
 assert.equal(guestWrong.response.status,401);
 const afterWrong=await run('post-rejection-read',`const p=browser.__anonymous;return {visible:await p.getByRole('alert').isVisible(),read:await p.evaluate(async url=>{const r=await fetch(url);return {status:r.status,body:await r.json()};},${JSON.stringify(populated.request.url)})};`);
 assert(afterWrong.visible);assert.equal(afterWrong.read.status,401);assert(!afterWrong.read.body.ballots);
 pass('fresh anonymous and wrong-password contexts retain denied protected access');
 const exportCheck=await run('retained-evidence',`return e.dump();`);
 assert(!JSON.stringify(exportCheck).includes('CommonGround!2026'));assert(!JSON.stringify(exportCheck).includes('CommonGround!wrong'));
 assert(exportCheck.some(row=>row.label==='gate-wrong-password'&&row.state==='evidence-missing'));
 assert(exportCheck.some(row=>row.label==='protected-reload'&&row.state==='captured'));
 assert.equal(exited,null);pass('earlier errors and later evidence survive together with redacted credentials');
}
main().catch(error=>{checks.push({name:'resilience execution',passed:false,error:String(error)});console.error(error);process.exitCode=1;}).finally(()=>{save('resilience-results',{passed:checks.filter(row=>row.passed).length,failed:checks.filter(row=>!row.passed).length,scoredOracle:false,checks,stderr,exited});child.kill();});
