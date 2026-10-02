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
 await new Promise(r=>server.listen(3102,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}}),p=await context.newPage();await p.goto('http://localhost:3102');
  const input=async(source,filename='sample.js')=>{await p.getByLabel('Filename',{exact:true}).fill(filename);await p.getByLabel('Source',{exact:true}).fill(source);};
  const run=async(source)=>{await input(source);await p.getByRole('button',{name:'Run',exact:true}).click();};
  const save=async(title,filename,source,isNew=true)=>{if(isNew)await p.getByRole('button',{name:'New',exact:true}).click();await p.getByLabel('Title',{exact:true}).fill(title);await input(source,filename);const response=p.waitForResponse(r=>r.url().endsWith('/records')&&r.request().method()==='POST');await p.getByRole('button',{name:'Save',exact:true}).click();const r=await response;await p.getByRole('button',{name:title,exact:true}).waitFor();return r.json();};
  const marker='unique-'+Date.now(),gateSource=`document.body.textContent='${marker}';console.log('${marker}');`;
  await run(gateSource);assert.equal(await p.locator('#preview').innerText(),marker);assert.match(await p.locator('#console').innerText(),new RegExp(marker));
  report.observations.render={preview:await p.locator('#preview').innerText(),console:await p.locator('#console').innerText(),source:gateSource};
  const gate=await save('CW gate '+marker,'gate.js',gateSource);
  const clean=await browser.newContext(),fresh=await clean.newPage();await fresh.goto('http://localhost:3102');const getFresh=async()=>{await fresh.getByRole('button',{name:gate.title,exact:true}).click();return{title:await fresh.getByLabel('Title',{exact:true}).inputValue(),filename:await fresh.getByLabel('Filename',{exact:true}).inputValue(),source:await fresh.getByLabel('Source',{exact:true}).inputValue(),id:await fresh.getByRole('button',{name:gate.title,exact:true}).getAttribute('data-id')};};
  const first=await getFresh();await fresh.reload();const second=await getFresh();assert.deepEqual(first,second);assert.equal(first.source,gateSource);assert.equal(first.id,gate.id);report.observations.constraints={write:gate,cleanRead:first,reloadRead:second,health:(await fresh.request.get('http://localhost:3102/api/health')).status()};await clean.close();
  await p.getByRole('button',{name:'Clear console',exact:true}).click();
  await run("console.log('level-log');\nconsole.warn('level-warn');\nconsole.error('level-error');\nconsole.info('level-info');");
  const levels=await p.locator('#console div').allTextContents();assert.deepEqual(levels,['log: level-log','warn: level-warn','error: level-error','info: level-info']);report.observations.console_level_stream=levels;
  await run("console.log('history-first');");await run("document.body.innerHTML='<p>console-history-preview</p>'; console.log('history-second');");
  const logs=await p.locator('#console div').allTextContents();assert.deepEqual(logs.slice(-2),['log: history-first','log: history-second']);report.observations.console_history=logs;
  await p.getByRole('button',{name:'Clear console',exact:true}).click();assert.equal(await p.locator('#console div').count(),0);report.observations.console_clear_control={before:logs.length,after:0};
  await input("const a=1;\nconsole.log(a);\ndocument.body.textContent='x';");const numbers=await p.locator('#lines').innerText(),font=await p.locator('#source').evaluate(e=>getComputedStyle(e).fontFamily);assert.equal(numbers,'1\n2\n3');assert.match(font,/monospace/);report.observations.editor={lineNumbers:numbers,font};
  const alpha=await save('QC Save Alpha','qc-alpha.js',"console.log('alpha-body');"),beta=await save('QC Save Beta','qc-beta.html','<!doctype html><html><body><p>beta-body</p></body></html>');
  async function read(r){await p.getByRole('button',{name:r.title,exact:true}).click();const got={title:await p.getByLabel('Title',{exact:true}).inputValue(),filename:await p.getByLabel('Filename',{exact:true}).inputValue(),source:await p.getByLabel('Source',{exact:true}).inputValue(),id:await p.getByRole('button',{name:r.title,exact:true}).getAttribute('data-id')};assert.deepEqual(got,{title:r.title,filename:r.filename,source:r.source,id:r.id});return got;}
  const before=[await read(alpha),await read(beta)];await p.reload();const after=[await read(alpha),await read(beta)];assert.notEqual(alpha.id,beta.id);report.observations.saved_records_browser_reload={before,after};
  await read(alpha);const updated=await save('QC Save Alpha current','alpha-current.js',"console.log('alpha-current');",false);assert.equal(updated.id,alpha.id);assert.equal(updated.revision,alpha.revision+1);report.observations.saved_record_fidelity={newRecords:[alpha,beta],currentUpdate:updated,readback:await read(updated)};
  const own="document.body.textContent='own-document-ok';console.log('own-document-log');";await run(own);
  await run("let docRead='not-blocked', docWrite='not-blocked', storageRead='not-blocked', storageWrite='not-blocked';\ntry { const value=parent.document.title; } catch (error) { docRead='blocked'; }\ntry { parent.document.title='cw-forbidden-title'; } catch (error) { docWrite='blocked'; }\ntry { const value=parent.localStorage.getItem('cw-isolation-probe'); } catch (error) { storageRead='blocked'; }\ntry { parent.localStorage.setItem('cw-isolation-probe','changed'); } catch (error) { storageWrite='blocked'; }\ndocument.body.innerHTML='<p>isolation-'+docRead+'-'+docWrite+'-'+storageRead+'-'+storageWrite+'</p>';\nconsole.log('isolation-results',docRead,docWrite,storageRead,storageWrite);");
  await run("document.body.textContent='origin-recovered';console.log('origin-recovered-log');");assert.equal(await p.locator('#preview').innerText(),'origin-recovered');assert.match(await p.locator('#console').innerText(),/origin-recovered-log/);report.observations.origin_boundary_recovery={preview:await p.locator('#preview').innerText(),console:await p.locator('#console').innerText(),boundaryScoreClaim:false};
  await run("let n=0; while(n<3) { n++; } console.log('finite-braced',n);");const finite=await p.locator('#console').innerText();assert(!finite.includes('finite-braced'));await run("setTimeout(()=>{document.body.textContent='delayed-should-not-be-immediate';console.log('delayed-log');},1000);");const immediate=await p.locator('#preview').innerText();assert.equal(immediate,'delayed-should-not-be-immediate');report.observations.mock_failures={finiteComputedLogMissing:true,timerBodyRenderedImmediately:immediate,execution:'No JavaScript is executed, all non-literal expressions and control flow are ignored',history:'No history or restore implementation',persistence:'Only in-process Map; restart loses records',concurrency:'Saves overwrite without checking revisions'};
  await p.screenshot({path:'/evidence/desktop.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/evidence/mobile.png',fullPage:true});
  report.passed=true;
 }finally{await browser.close();}
}
main().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(()=>{report.finished=new Date().toISOString();fs.writeFileSync('/evidence/mock-observations.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));server.close();});
