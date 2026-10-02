'use strict';
// Reviewer-owned bounded gate fixtures. Not task code or configured judge results.
const http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const report={scope:'Row 29 scripted adversarial browser observations, not judge grades',started:new Date().toISOString(),cases:[]};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const records=new Map();let nextId=0;
function page(mode,selected){
 const rows=records.get(mode)||[],r=rows.find(x=>String(x.id)===selected)||{title:'',filename:'draft.js',source:''};
 return `<!doctype html><title>Gate fixture</title><script src="http://localhost:3101/asset.js"></script><h1>Playground</h1><form action="/${mode}/write" method="POST"><label>Title <input name="title" value="${esc(r.title)}"></label><label>Filename <input name="filename" value="${esc(r.filename)}"></label><label>Source <textarea name="source" aria-label="Source">${esc(r.source)}</textarea></label><button type="button" id="run">Run</button><button type="submit">Save</button></form><h2>Preview</h2><iframe title="Preview" sandbox="allow-scripts"></iframe><h2>Console</h2><pre id="console"></pre><h2>Library</h2><nav>${rows.map(x=>`<a data-id="${x.id}" href="/${mode}/?id=${x.id}">${esc(x.title)}</a>`).join('')}</nav><script>
 const mode=${JSON.stringify(mode)},form=document.querySelector('form'),editor=form.elements.source,frame=document.querySelector('iframe'),output=document.querySelector('pre');
 window.addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data.kind==='log')output.textContent+=e.data.value+'\\n';});
 document.querySelector('#run').onclick=()=>{if(mode==='dead')return;output.textContent='';frame.srcdoc='<body><script>console.log=(...a)=>parent.postMessage({kind:"log",value:a.join(" ")},"*");'+editor.value+'<'+ '/script>';};
 if(mode==='client'){
  const paint=()=>{document.querySelector('nav').innerHTML='';for(const record of JSON.parse(localStorage.getItem('records')||'[]')){const a=document.createElement('a');a.href='#';a.textContent=record.title;a.onclick=()=>{for(const key of ['title','filename','source'])form.elements[key].value=record[key];};document.querySelector('nav').appendChild(a);}};
  form.onsubmit=async e=>{e.preventDefault();const r=Object.fromEntries(new FormData(form));await fetch('/client/write',{method:'POST',body:JSON.stringify(r)});const list=JSON.parse(localStorage.getItem('records')||'[]');list.push(r);localStorage.setItem('records',JSON.stringify(list));paint();};paint();
 }
 </script>`;
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost:3100');
 if(u.pathname==='/api/health'){res.writeHead(200,{'content-type':'text/plain'});res.end('ready');return;}
 const mode=u.pathname.split('/')[1];
 if(req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;
  if(mode==='client'){res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return;}
  const record={id:++nextId,...Object.fromEntries(new URLSearchParams(body))};
  const rows=records.get(mode)||[];rows.push(record);records.set(mode,rows);
  res.writeHead(303,{location:`/${mode}/?id=${record.id}`});res.end();return;
 }
 res.writeHead(200,{'content-type':'text/html'});res.end(page(mode,u.searchParams.get('id')));
});
const asset=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/javascript'});res.end('window.externalAssetLoaded=true;');});
async function listen(s,p){await new Promise(resolve=>s.listen(p,'0.0.0.0',resolve));}
async function main(){
 await listen(server,3100);await listen(asset,3101);
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  for(const mode of ['dead','client','ssr']){
   const context=await browser.newContext(),p=await context.newPage(),network=[];
   p.on('response',r=>network.push({url:r.url(),status:r.status()}));
   await p.goto(`http://localhost:3100/${mode}/`);
   const marker=mode+'-'+Date.now(),source=`document.body.textContent=${JSON.stringify(marker)};console.log(${JSON.stringify(marker)});`;
   await p.getByLabel('Title',{exact:true}).fill('CW gate '+marker);await p.getByLabel('Filename',{exact:true}).fill('gate.js');await p.getByLabel('Source',{exact:true}).fill(source);await p.getByRole('button',{name:'Run',exact:true}).click();
   if(mode!=='dead')await p.frameLocator('iframe').locator('body').filter({hasText:marker}).waitFor();
   const preview=await p.frameLocator('iframe').locator('body').innerText(),logs=await p.locator('pre').innerText();
   const render=preview===marker&&logs.includes(marker);
   await p.getByRole('button',{name:'Save',exact:true}).click();
   await p.getByRole('link',{name:'CW gate '+marker,exact:true}).waitFor();
   const freshContext=await browser.newContext(),fresh=await freshContext.newPage();
   const response=await fresh.goto(`http://localhost:3100/${mode}/`),html=await response.text();
   const link=fresh.getByRole('link',{name:'CW gate '+marker,exact:true});
   const found=await link.count();let identity=null,readback=null,reloadMatch=false;
   if(found){
    identity=await link.getAttribute('data-id');await link.click();
    readback={title:await fresh.getByLabel('Title',{exact:true}).inputValue(),filename:await fresh.getByLabel('Filename',{exact:true}).inputValue(),source:await fresh.getByLabel('Source',{exact:true}).inputValue()};
    await fresh.reload();reloadMatch=await fresh.getByLabel('Source',{exact:true}).inputValue()===source;
   }
   const health=await fresh.request.get('http://localhost:3100/api/health');
   const constraints=Boolean(identity&&readback?.title==='CW gate '+marker&&readback?.filename==='gate.js'&&readback?.source===source&&reloadMatch);
   const observation={mode,render,constraints,health:health.status(),externalAssetLoaded:await p.evaluate(()=>window.externalAssetLoaded),autoRunControlCount:await p.getByRole('checkbox',{name:'Auto-run'}).count(),preview,logs,independentContextLibraryFound:found,serverRenderedRecord:html.includes('CW gate '+marker),identity,readback,reloadMatch,writeResponseObserved:network.some(x=>x.url.endsWith('/write')&&x.status>=200&&x.status<400)};
   report.cases.push(observation);
   assert.equal(render,mode!=='dead');assert.equal(constraints,mode!=='client');
   await freshContext.close();await context.close();
  }
  report.passed=true;
 }finally{await browser.close();}
}
main().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(()=>{report.finished=new Date().toISOString();fs.writeFileSync('/evidence/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));server.close();asset.close();});
