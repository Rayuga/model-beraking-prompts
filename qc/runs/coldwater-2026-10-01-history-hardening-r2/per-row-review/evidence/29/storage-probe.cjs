'use strict';
// Row 29 reviewer-owned fixtures; never mounted into the frozen task or golden.
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
// Use the public newline-delimited MCP transport; no dependency installation.
class McpClient {
  constructor(){
    this.pending=new Map();this.nextId=0;this.buffer='';this.stderr='';
    this.process=spawn('playwright-mcp',['--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox'],{stdio:['pipe','pipe','pipe']});
    this.process.stderr.on('data',data=>{this.stderr+=String(data);});
    this.process.stdout.on('data',data=>{
      this.buffer+=String(data);let offset;
      while((offset=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,offset);this.buffer=this.buffer.slice(offset+1);if(!line.trim())continue;
        const msg=JSON.parse(line),pending=this.pending.get(msg.id);if(pending){this.pending.delete(msg.id);clearTimeout(pending.timer);msg.error?pending.reject(new Error(JSON.stringify(msg.error))):pending.resolve(msg.result);}
      }
    });
  }
  request(method,params={}){const id=++this.nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('MCP call timeout: '+method));},60000);this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
  async connect(){await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'row29-reviewer',version:'1.0'}});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');}
  listTools(){return this.request('tools/list');}
  callTool(args){return this.request('tools/call',args);}
  async close(){this.process.stdin.end();this.process.kill();}
}
const Database = require('/usr/local/lib/node_modules/better-sqlite3');
const db = new Database('/tmp/row29-storage-probe.db');
db.exec('CREATE TABLE snippets(id INTEGER PRIMARY KEY, title TEXT, filename TEXT, source TEXT)');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function browserControls(localOnly) {
  const form = document.querySelector('form');
  const source = document.querySelector('#source');
  const preview = document.querySelector('iframe');
  const consoleEl = document.querySelector('[role=log]');
  window.addEventListener('message', e => { if (e.source === preview.contentWindow) consoleEl.textContent += String(e.data) + '\n'; });
  document.querySelector('#run').onclick = () => {
    const shim = 'console.log=(...args)=>parent.postMessage(args.join(" "),"*");';
    preview.srcdoc = '<!doctype html><body><script>' + shim + source.value + '</' + 'script>';
  };
  if (localOnly) {
    function display() {
      const records = JSON.parse(localStorage.getItem('row29-records') || '[]');
      document.querySelector('#library').replaceChildren();
      for (const r of records) {
        const button = document.createElement('button'); button.textContent = r.title;
        button.onclick = () => { for(const k of ['title','filename','source']) form.elements[k].value=r[k]; form.elements.id.value=r.id; };
        document.querySelector('#library').append(button);
      }
    }
    form.onsubmit = async e => {
      e.preventDefault();
      const r = Object.fromEntries(new FormData(form)); r.id = r.id || 'client-1';
      // A convincing but insufficient network write acknowledgment.
      await fetch('/echo', {method:'POST',body:new URLSearchParams(r)});
      localStorage.setItem('row29-records',JSON.stringify([r]));
      form.elements.id.value=r.id; document.querySelector('[role=status]').textContent='Saved'; display();
    };
    display();
  }
}
function html(localOnly, record) {
  const rows = localOnly ? [] : db.prepare('SELECT * FROM snippets ORDER BY id').all();
  return `<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:3210/style.css"></head><body>
  <h1>Working playground</h1><form method="post" action="/store"><input type="hidden" name="id" value="${esc(record?.id)}">
  <label>Title<input name="title" value="${esc(record?.title)}"></label>
  <label>Filename<input name="filename" value="${esc(record?.filename || 'draft.js')}"></label>
  <label for="source">Source</label><textarea id="source" name="source" aria-label="Source">${esc(record?.source)}</textarea>
  <button id="run" type="button">Run</button><button>Save</button></form><p role="status">Ready</p>
  <h2>Library</h2><section id="library">${rows.map(r=>`<a href="/?id=${r.id}">${esc(r.title)}</a>`).join('')}</section>
  <h2>Preview</h2><iframe title="Preview" sandbox="allow-scripts"></iframe><h2>Console</h2><pre role="log"></pre>
  <script>(${browserControls.toString()})(${localOnly});</script></body></html>`;
}
const received = [];
const app = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost:3209');
  if(url.pathname === '/api/health'){res.end('ready');return;}
  if(url.pathname === '/echo'){received.push({route:'/echo',method:req.method});res.end('saved');return;}
  if(url.pathname === '/store' && req.method === 'POST'){
    let body='';for await(const p of req)body+=p;
    const value = Object.fromEntries(new URLSearchParams(body));
    const id=Number(db.prepare('INSERT INTO snippets(title,filename,source) VALUES(?,?,?)').run(value.title,value.filename,value.source).lastInsertRowid);
    received.push({route:'/store',method:req.method,body:value,id});res.writeHead(303,{location:'/?id='+id});res.end();return;
  }
  const record=url.searchParams.has('id')?db.prepare('SELECT * FROM snippets WHERE id=?').get(url.searchParams.get('id')):null;
  res.setHeader('content-type','text/html');res.end(html(url.pathname==='/local',record));
});
let offOriginLoads=0;
const asset=http.createServer((req,res)=>{offOriginLoads++;res.setHeader('content-type','text/css');res.end('body{font:16px system-ui}label{display:block}textarea{width:500px;height:160px}a{display:block}');});
const report={scope:'Row 29 scripted prerequisite probes via actual installed Playwright MCP; no provider, configured judge, or full app-grade claim',input_sha256:'b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863',started:new Date().toISOString()};
let client;
async function main(){
  await new Promise(r=>app.listen(3209,'0.0.0.0',r));await new Promise(r=>asset.listen(3210,'0.0.0.0',r));
  client=new McpClient();await client.connect();
  const list=await client.listTools();
  const tool=list.tools.find(t=>t.name==='browser_run_code_unsafe');assert(tool,'Required browser_run_code_unsafe is actually available');
  report.browser_tool={name:tool.name,inputSchema:tool.inputSchema};
  async function call(code){
    const result=await client.callTool({name:tool.name,arguments:{code}});
    assert(!result.isError,JSON.stringify(result));
    return result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
  }
  report.server_rendered=await call(`async (page) => {
    const url='http://localhost:3209';
    const health=await page.goto(url+'/api/health');const healthStatus=health.status();
    await page.goto(url);const initialLibrary=await page.locator('#library').innerText();
    const marker='row29-server-'+Date.now(),title='CW gate '+marker,filename='alternative.js';
    const source='const marker='+JSON.stringify(marker)+',a=13,b=24;const output=marker+":"+(a+b);document.body.textContent=output;console.log(output);';
    const expected=marker+':37';
    await page.getByLabel('Title',{exact:true}).fill(title);await page.getByLabel('Filename',{exact:true}).fill(filename);await page.getByLabel('Source',{exact:true}).fill(source);
    await page.getByRole('button',{name:'Run',exact:true}).click();await page.frameLocator('iframe').getByText(expected,{exact:true}).waitFor();
    const render={preview:await page.frameLocator('iframe').locator('body').innerText(),console:await page.getByRole('log').innerText()};
    const write=page.waitForResponse(r=>r.request().method()==='POST');
    await page.getByRole('button',{name:'Save',exact:true}).click();const written=await write;
    await page.waitForURL('**/?id=*');const identity=await page.locator('input[name=id]').inputValue();
    const clean=await page.context().browser().newContext();let cleanBefore,reloaded,read;
    try{const fresh=await clean.newPage();const response=await fresh.goto(url);const serverHtml=await response.text();cleanBefore=await fresh.evaluate(()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length}));
      await fresh.getByRole('link',{name:title,exact:true}).click();
      const fields=async()=>({identity:await fresh.locator('input[name=id]').inputValue(),title:await fresh.getByLabel('Title',{exact:true}).inputValue(),filename:await fresh.getByLabel('Filename',{exact:true}).inputValue(),source:await fresh.getByLabel('Source',{exact:true}).inputValue()});
      read=await fields();await fresh.reload();await fresh.getByRole('link',{name:title,exact:true}).click();reloaded=await fields();
      if(!serverHtml.includes(title)||read.identity!==identity||read.source!==source||JSON.stringify(read)!==JSON.stringify(reloaded))throw Error('Server readback mismatch');
    }finally{await clean.close();await page.bringToFront();}
    if(initialLibrary!==''||render.preview!==expected||!render.console.includes(expected)||healthStatus!==200)throw Error('Prerequisite mismatch');
    return {initialLibrary,healthStatus,render,expected,write:{method:written.request().method(),status:written.status(),contentType:written.headers()['content-type']||null},cleanBefore,read,reloaded,passed:true};
  }`);
  report.local_storage_only=await call(`async (page) => {
    const url='http://localhost:3209/local';await page.goto(url);
    const title='CW gate local-'+Date.now(),source='document.body.textContent="local-marker";console.log("local-marker");';
    await page.getByLabel('Title',{exact:true}).fill(title);await page.getByLabel('Filename',{exact:true}).fill('local.js');await page.getByLabel('Source',{exact:true}).fill(source);
    const write=page.waitForResponse(r=>r.request().method()==='POST');await page.getByRole('button',{name:'Save',exact:true}).click();const ack=await write;await page.getByRole('status').getByText('Saved',{exact:true}).waitFor();
    await page.reload();await page.getByRole('button',{name:title,exact:true}).click();const sameContextSource=await page.getByLabel('Source',{exact:true}).inputValue();
    const clean=await page.context().browser().newContext();let independentMatches;
    try{const fresh=await clean.newPage();await fresh.goto(url);independentMatches=await fresh.getByRole('button',{name:title,exact:true}).count();await fresh.reload();if(await fresh.getByRole('button',{name:title,exact:true}).count()!==0)throw Error('Unexpected shared browser storage');}finally{await clean.close();await page.bringToFront();}
    if(sameContextSource!==source||independentMatches!==0)throw Error('Fixture did not prove boundary');
    return {writeAcknowledgment:ack.status(),sameContextReloadRetainedSource:sameContextSource===source,independentMatches,passesConstraints:false,observedRejection:true};
  }`);
  report.off_origin_asset_requests=offOriginLoads;assert(offOriginLoads>0);report.received=received;report.passed=true;report.stderr=client.stderr;
}
main().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{if(client)await client.close();db.close();app.close();asset.close();report.finished=new Date().toISOString();fs.writeFileSync('/evidence/storage-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
