'use strict';
// Tool-capability fixture only. No candidate app or provider is called.
const fs = require('node:fs');
const http = require('node:http');
const {spawn} = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const out = '/evidence';
const pending = new Map(), results = [];
let serial=0, mcp, revision=0, raced=0;
const commits = new Map();
const html = `<!doctype html><button id="restore">Restore</button><output id="result"></output><script>document.querySelector('button').onclick=async()=>{try{const r=await fetch('/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({attempt:'probe-restore'})});document.querySelector('output').textContent=await r.text()}catch(e){document.querySelector('output').textContent='retry available'}}</script>`;
const server=http.createServer(async(req,res)=>{
  let body=''; for await (const part of req) body+=part;
  res.setHeader('content-type','application/json');
  if(req.url==='/restore'){
    const {attempt}=JSON.parse(body);
    if(!commits.has(attempt)) commits.set(attempt,++revision);
    return res.end(JSON.stringify({revision:commits.get(attempt)}));
  }
  if(req.url==='/state') return res.end(JSON.stringify({revision,raced}));
  if(req.url==='/race'){raced++; return res.end(JSON.stringify({raced}));}
  res.setHeader('content-type','text/html');res.end(html);
});
function log(file,obj){fs.appendFileSync(`${out}/${file}`,JSON.stringify(obj)+'\n');}
function rpc(method,params){
  const id=++serial,msg={jsonrpc:'2.0',id,method,params};log('requests.jsonl',msg);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('RPC timeout '+method));},55000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});
    mcp.stdin.write(JSON.stringify(msg)+'\n');
  });
}
async function tool(name,args){const x=await rpc('tools/call',{name,arguments:args});if(x.error||x.result?.isError)throw Error(JSON.stringify(x));return x.result;}
async function probe(name,code){const result=await tool('browser_run_code_unsafe',{code});results.push({name,result});console.log('PASS '+name);}
async function main(){
  await new Promise(resolve=>server.listen(3038,'127.0.0.1',resolve));
  mcp=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
  mcp.stderr.pipe(fs.createWriteStream(`${out}/mcp-stderr.log`));
  readline.createInterface({input:mcp.stdout}).on('line',line=>{try{const x=JSON.parse(line);log('responses.jsonl',x);if(pending.has(x.id)){const p=pending.get(x.id);pending.delete(x.id);p.resolve(x);}}catch{log('nonjson.jsonl',line);}});
  await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'row32-isolated-feasibility',version:'1.0'}});
  mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const list=await rpc('tools/list',{});fs.writeFileSync(`${out}/tools.json`,JSON.stringify(list,null,2));
  assert(list.result.tools.some(x=>x.name==='browser_run_code_unsafe'));
  await tool('browser_navigate',{url:'http://127.0.0.1:3038'});
  await probe('independent clean context and readback',`async(page)=>{
    await page.evaluate(()=>localStorage.setItem('fixture-origin-marker','original'));
    const clean=await page.context().browser().newContext();
    try{const fresh=await clean.newPage();await fresh.goto('http://127.0.0.1:3038');
      const isolated=await fresh.evaluate(()=>localStorage.getItem('fixture-origin-marker')===null);
      if(!isolated)throw Error('storage copied');await fresh.reload();return {isolated,control:await fresh.locator('#restore').innerText()};
    }finally{await clean.close();}
  }`);
  const prompt=fs.readFileSync('/frozen/prompt.md','utf8');
  const network=prompt.slice(prompt.indexOf('## Supplied network-control recipe')).match(/```javascript\r?\n([\s\S]*?)\r?\n```/)[1];
  await probe('exact frozen S07 network-control recipe',network);
  await probe('route cleanup',`async(page)=>{const c=page.context(),s=c.__cwNetworkProbe;if(s)for(const url of s.urls)await c.unroute(url,s.handler);delete c.__cwNetworkProbe;return {cleaned:true};}`);
  await probe('route.fetch response abortion, captured UI request and retry',`async(page)=>{
    let committed,captured;const handler=async route=>{captured={url:route.request().url(),method:route.request().method(),body:route.request().postData()};const response=await route.fetch();committed=await response.json();await route.abort();};
    await page.route('http://127.0.0.1:3038/restore',handler,{times:1});
    try{await page.locator('#restore').click();await page.locator('#result').filter({hasText:'retry available'}).waitFor();}finally{await page.unroute('http://127.0.0.1:3038/restore',handler);}
    await page.locator('#restore').click();await page.locator('#result').filter({hasText:'revision'}).waitFor();
    const retry=JSON.parse(await page.locator('#result').innerText());const state=await page.evaluate(async()=>await(await fetch('/state')).json());
    if(committed.revision!==1||retry.revision!==1||state.revision!==1)throw Error('lost reply test did not match');
    return {captured,committed,retry,state};
  }`);
  await probe('paired in-page dispatch and fresh readback',`async(page)=>{return await page.evaluate(async()=>{const replies=await Promise.all(['a','b'].map(value=>fetch('/race',{method:'POST',body:value}).then(r=>r.json())));const state=await(await fetch('/state')).json();if(state.raced!==2)throw Error('missing paired request');return {replies,state};});}`);
  const metadata={node:process.version,mcp:require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version,scope:'Tool capability fixture only; not candidate execution, restart, judge or provider measurement',results};
  fs.writeFileSync(`${out}/results.json`,JSON.stringify(metadata,null,2));
}
main().catch(error=>{fs.writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(error),stack:error.stack,results},null,2));console.error(error);process.exitCode=1;}).finally(async()=>{if(mcp)mcp.kill();await new Promise(resolve=>server.close(resolve));});
