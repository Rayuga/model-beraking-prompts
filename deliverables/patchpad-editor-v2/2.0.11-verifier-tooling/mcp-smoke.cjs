// Real stdio MCP + browser round-trip, no model or external network.
const {spawn}=require('node:child_process');
const http=require('node:http');
const readline=require('node:readline');
const fs=require('node:fs');
const pending=new Map();let id=0;
const child=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
let stderr='';child.stderr.on('data',x=>{stderr+=x.toString()});
readline.createInterface({input:child.stdout}).on('line',line=>{
  let v;try{v=JSON.parse(line)}catch{return}
  if(pending.has(v.id)){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(new Error(JSON.stringify(v.error))):p.resolve(v.result)}
});
function call(method,params){return new Promise((resolve,reject)=>{
  const key=++id;pending.set(key,{resolve,reject});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');
})}
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>PatchPad MCP smoke</title><h1>PATCHPAD-MCP-READY</h1>')});
const timer=setTimeout(()=>{console.error('MCP smoke timed out');child.kill('SIGKILL');server.close();process.exit(1)},45000);
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const init=await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'patchpad-unpaid-smoke',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const list=await call('tools/list',{});
  if(!list.tools.some(x=>x.name==='browser_navigate'))throw new Error('browser_navigate not advertised');
  const result=await call('tools/call',{name:'browser_navigate',arguments:{url:`http://127.0.0.1:${server.address().port}`}});
  if(result.isError || !JSON.stringify(result).includes('PatchPad MCP smoke'))throw new Error('MCP navigation failed: '+JSON.stringify(result));
  // This MCP version returns a snapshot-file link, not inline DOM text.
  // Request a read-only observation through MCP to verify the actual page.
  const observed=await call('tools/call',{name:'browser_evaluate',arguments:{function:'() => document.body.textContent'}});
  if(observed.isError || !JSON.stringify(observed).includes('PATCHPAD-MCP-READY'))throw new Error('MCP page readback failed: '+JSON.stringify(observed));
  await call('tools/call',{name:'browser_close',arguments:{}});
  fs.writeFileSync('/results/mcp-smoke.json',JSON.stringify({passed:true,server:init.serverInfo,protocol:init.protocolVersion,tool:'browser_navigate',browserPath:'/usr/local/bin/chromium',pageMarker:'PATCHPAD-MCP-READY',network:'none; loopback only',image:'patchpad-preflight-tests:2.0.9',exactNewImage:false,paidRun:false},null,2)+'\n');
  console.log('PASS real Playwright MCP initialization, tool discovery, Chromium navigation/readback and close');
})().catch(e=>{console.error(e,stderr);process.exitCode=1}).finally(()=>{clearTimeout(timer);child.kill();server.close()});
