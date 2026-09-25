const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const child=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{cwd:'/app',stdio:['pipe','pipe','pipe']});
let buffer='',seq=0,stderr='',exited=null;const waiting=new Map();
child.stderr.on('data',data=>stderr+=data);
child.on('exit',(code,signal)=>{exited={code,signal};for(const row of waiting.values())row.reject(new Error('MCP exited '+JSON.stringify(exited)));waiting.clear();});
child.stdout.on('data',data=>{buffer+=data;while(buffer.includes('\n')){const at=buffer.indexOf('\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+1);let value;try{value=JSON.parse(line);}catch{continue;}if(waiting.has(value.id)){waiting.get(value.id).resolve(value);waiting.delete(value.id);}}});
async function call(method,params){const id=++seq;let timer;try{return await Promise.race([new Promise((resolve,reject)=>{if(exited)return reject(new Error('MCP exited'));waiting.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('tool timeout')),25000);})]);}finally{clearTimeout(timer);waiting.delete(id);}}
const tool=(name,args)=>call('tools/call',{name,arguments:args});
const output={};
async function main(){
 await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'exact-oracle-repro',version:'1'}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 await tool('browser_navigate',{url:'http://localhost:3000'});
 output.capabilities=await tool('browser_run_code_unsafe',{code:"async(page)=>({URL:typeof URL,AbortController:typeof AbortController,setTimeout:typeof setTimeout})"});
 output.originalPath=await tool('browser_run_code_unsafe',{filename:'/opt/common-ground-verifier/browser-evidence.js'});
 assert(output.originalPath.result.isError,'Expected the exact exported allowed-roots failure');
 fs.mkdirSync('/app/.playwright-mcp',{recursive:true});
 fs.copyFileSync('/opt/common-ground-verifier/browser-evidence.js','/app/.playwright-mcp/browser-evidence.js');
 output.copiedPath=await tool('browser_run_code_unsafe',{filename:'/app/.playwright-mcp/browser-evidence.js'});
 assert(!output.copiedPath.result.isError);
 const original=JSON.parse(fs.readFileSync('/validation/oracle-functional-tools.json','utf8')).find(row=>row.arguments?.code?.includes('gate-wrong-password'));
 try{output.exactGate=await tool('browser_run_code_unsafe',original.arguments);}catch(error){output.exactGateError=String(error);}
 await new Promise(resolve=>setTimeout(resolve,100));
 output.process=exited;output.stderr=stderr;
 assert(exited,'Expected to reproduce the MCP process crash');
 assert.match(stderr,/URL is not defined/);
 output.reproduced=true;
 console.log(JSON.stringify({reproduced:true,process:exited,stderr:stderr.slice(-1500)},null,2));
}
main().catch(error=>{output.failure=String(error);console.error(error);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/results/reproduction.json',JSON.stringify(output,null,2)+'\n');child.kill();});
