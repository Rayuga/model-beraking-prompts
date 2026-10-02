'use strict';
// Reviewer-owned adversarial fixture, never part of the task or golden.
// Deliberately does NOT execute JavaScript: Run harvests literal DOM/log strings.
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const records = new Map();
let nextId = 0;
const report = {scope:'Row 39 isolated mock browser observations; no configured judge', started:new Date().toISOString(), observations:{}};
function client() {
 const $ = id => document.getElementById(id), editor=$('source');
 let identity=null;
 const gutter=()=>{$('lines').textContent=editor.value.split('\n').map((_,i)=>i+1).join('\n');};
 editor.oninput=gutter;
 function load(r){identity=r.id;$('title').value=r.title;$('filename').value=r.filename;editor.value=r.source;gutter();}
 async function library(){const rows=await(await fetch('/records')).json();$('library').replaceChildren();for(const r of rows){const b=document.createElement('button');b.textContent=r.title;b.dataset.id=r.id;b.onclick=()=>load(r);$('library').append(b);}return rows;}
 $('new').onclick=()=>load({id:null,title:'',filename:'draft.js',source:''});
 $('save').onclick=async()=>{const r=await(await fetch('/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:identity,title:$('title').value,filename:$('filename').value,source:editor.value})})).json();load(r);await library();$('status').textContent='Saved revision '+r.revision;};
 $('clear').onclick=()=>$('console').replaceChildren();
 $('run').onclick=()=>{
  const source=editor.value;
  // A plausible demo renderer: no eval, Function, script node or JS interpreter.
  for(const m of source.matchAll(/document\.body\.(textContent|innerHTML)\s*=\s*(['"])(.*?)\2\s*;/g)){
   if(m[1]==='innerHTML')$('preview').innerHTML=m[3];else $('preview').textContent=m[3];
  }
  for(const m of source.matchAll(/console\.(log|warn|error|info)\(\s*(['"])(.*?)\2\s*\)/g)){
   const row=document.createElement('div');row.textContent=m[1]+': '+m[3];$('console').append(row);
  }
  $('status').textContent='Completed';
 };
 $('stop').onclick=()=>$('status').textContent='Stopped';
 gutter();library();
}
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Snippet studio</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#182b3a;font:16px system-ui}header{background:#17354b;color:white;padding:22px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0 0 14px}main{max-width:1200px;margin:auto;padding:22px;display:grid;grid-template-columns:2fr 1fr;gap:20px}section{background:white;border:1px solid #d6dee5;border-radius:9px;padding:18px}label{display:block;margin-bottom:12px}input{width:100%;padding:9px;border:1px solid #a7b5c0;border-radius:4px}button{padding:8px 14px;border:1px solid #a7b5c0;background:#f5f8fa;border-radius:4px;color:#17354b;font:inherit;margin:3px}button:focus,input:focus,textarea:focus{outline:3px solid #437bbd;outline-offset:2px}.edit{display:flex;background:#f7fafc;border:1px solid #b8c5cf;border-radius:5px}#lines{padding:12px 8px;margin:0;color:#607584;font:14px/1.5 monospace;text-align:right}textarea{padding:12px;border:0;flex:1;min-width:0;min-height:240px;resize:vertical;background:transparent;font:14px/1.5 monospace}#preview{min-height:120px}#console{min-height:130px;font:14px/1.5 monospace;overflow:auto}#library button{display:block;width:100%;text-align:left}#status{color:#526879}#auto{width:auto}.wide{grid-column:1/-1}@media(max-width:600px){main{grid-template-columns:1fr;padding:12px;gap:12px}.wide{grid-column:auto}section{padding:14px}}
</style></head><body><header><h1>Snippet studio</h1></header><main><section><h2>Editor</h2><label>Title<input id="title"></label><label>Filename<input id="filename" value="draft.js"></label><div class="edit"><pre id="lines"></pre><textarea id="source" aria-label="Source"></textarea></div><div><button id="run">Run</button><button id="stop">Stop</button><label><input type="checkbox" id="auto">Auto-run</label><button id="new">New</button><button id="save">Save</button></div><p id="status">Ready</p></section><section><h2>Saved library</h2><div id="library"></div><button disabled>History</button><button disabled>Restore</button><button disabled>Retry restore</button></section><section><h2>Preview</h2><div id="preview"></div></section><section><h2>Console</h2><button id="clear">Clear console</button><div id="console"></div></section></main><script>(${client.toString()})()</script></body></html>`;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/api/health'){res.end('ready');return;}
 if(req.url==='/records'){
  res.setHeader('content-type','application/json');
  if(req.method==='POST'){
   let body='';for await(const part of req)body+=part;
   const r=JSON.parse(body),id=r.id||String(++nextId),old=records.get(id);
   const saved={id,title:r.title,filename:r.filename,source:r.source,revision:(old?.revision||0)+1};records.set(id,saved);res.end(JSON.stringify(saved));return;
  }
  res.end(JSON.stringify([...records.values()]));return;
 }
 res.setHeader('content-type','text/html');res.end(html);
});

async function main(){
 await new Promise(resolve=>server.listen(3102,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.goto('http://localhost:3102');
  const run=async source=>{await page.getByLabel('Source',{exact:true}).fill(source);await page.getByRole('button',{name:'Run',exact:true}).click();return{preview:await page.locator('#preview').innerText(),console:await page.locator('#console').innerText()};};
  const literal='mock-control-'+Date.now();const control=await run(`document.body.textContent='${literal}';console.log('${literal}');`);
  assert.equal(control.preview,literal);assert(control.console.includes(literal));
  await page.getByRole('button',{name:'Clear console',exact:true}).click();
  const marker='calculation-'+Date.now(),a=23,b=41,expected=marker+':'+(a+b);
  const source=`const marker=${JSON.stringify(marker)},a=${a},b=${b};const output=marker+':'+(a+b);document.body.textContent=output;console.log(output);`;
  const actual=await run(source);const passesGate=actual.preview===expected&&actual.console.includes(expected);
  report.scope='Original literal-string mock, unchanged renderer, checked against corrected Render prerequisite; no configured judge';
  report.observations={control,source,expected,actual,passesGate};assert.equal(passesGate,false);report.passed=true;
 }finally{await browser.close();}
}
main().catch(error=>{report.error=String(error);process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/computed-mock-gate.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));server.close();});
