const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const c=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']}),p=await c.newPage(),passed=[],observedReads=new Set();
 const ready=async q=>{await q.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');await q.locator('#revision-list .revision').first().waitFor();};
 const content=async q=>(await q.locator('#editor .text').evaluateAll(es=>es.map(e=>e.dataset.lineText))).join('\n');
 const append=async(q,marker)=>{await q.bringToFront();await q.locator('#find-box').fill('OMEGA-END-ANCHOR');await q.locator('#find-next-btn').click();await q.keyboard.press('End');await q.keyboard.type(marker);};
 let saveRequest;
 const save=async(q,status=200)=>{const pending=q.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/save'));await q.locator('#save-btn').click();const r=await pending;assert.equal(r.status(),status);saveRequest=r.request();if(status===200)await q.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Saved'));else await q.waitForFunction(()=>document.querySelector('#message').textContent.includes('Save conflict'));return r;};
 const pass=n=>{passed.push(n);console.log('PASS '+n);};
 const readSaved=async()=>{
   const rc=await browser.newContext({viewport:{width:1280,height:800}}),q=await rc.newPage(),pending=[],payloads=[];
   q.on('response',r=>{if(r.request().method()!=='GET')return;const type=r.headers()['content-type']||'';if(!type.includes('json')&&!type.includes('text/html'))return;
     observedReads.add(new URL(r.url()).pathname);pending.push((async()=>{if(type.includes('json'))payloads.push(await r.json());else {const html=await r.text(),match=html.match(/<script id="server-state" type="application\/json">([\s\S]*?)<\/script>/);if(match)payloads.push(JSON.parse(match[1]));}})());
   });
   try{
     await q.goto('http://localhost:3000');await ready(q);const texts=[];
     const rows=q.locator('#revision-list .revision');for(let i=0;i<await rows.count();i++){const row=rows.nth(i),revision=Number((await row.locator('strong').innerText()).match(/\d+/)[0]);await row.getByRole('button',{name:'Preview',exact:true}).click();const pre=q.locator('#revision-preview-'+revision);await pre.waitFor({state:'visible'});texts.push({revision,content:await pre.innerText()});}
     await Promise.all(pending);const embedded=payloads.find(x=>x.history),doc=embedded?.documents[0]||payloads.find(x=>x.document)?.document;assert(doc,'Fresh server response must supply the actual document');
     const documents=embedded?.documents||payloads.find(x=>x.documents)?.documents;assert(documents&&documents.length===1);
     const history=embedded?.history||payloads.filter(x=>x.revision&&typeof x.revision==='object').map(x=>x.revision);
     assert.equal(history.length,texts.length);for(const row of history)assert.equal(texts.find(x=>x.revision===row.revision).content,row.content);
     assert.equal(await content(q),doc.content);return {id:doc.id,title:doc.title,author:doc.author,content:doc.content,revision:doc.current_revision,documents:documents.map(d=>({id:d.id,title:d.title,author:d.author})),history:history.map(r=>({revision:r.revision,saved_at:r.saved_at,content:r.content})).sort((a,b)=>b.revision-a.revision)};
   }finally{await rc.close();await p.bringToFront();}
 };
 try{
 await p.goto('http://localhost:3000');await ready(p);const seed=await readSaved();assert.equal(seed.revision,1);assert.equal(seed.content.split('\n').length,1226);assert.equal(seed.history.length,1);pass('Complete seed, metadata and history from actual server delivery; no direct read probes');

 const smoke=async q=>{
   await q.locator('#find-box').fill('OMEGA-END-ANCHOR');
   await q.locator('#find-next-btn').click();
   const before=await q.locator('#cursor-label').innerText();
   await q.keyboard.press('ArrowLeft');
   const changed=(await q.locator('#cursor-label').innerText())!==before;
   await q.locator('#find-box').fill('');
   return changed;
 };
 for(const dim of ['render','constraints','functional','polish','visual']){
   assert(await smoke(p),'Working-content smoke: '+dim);
   assert.deepEqual(await readSaved(),seed,'Gate must not alter stored document/history');
 }
 pass('Non-mutating working-content gate passes in all five dimensions without saved-state changes');
 const dead=await c.newPage();
 await dead.setContent((await p.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
 assert.equal(await smoke(dead),false,'Dead cloned report must not pass the interaction probe');
 await dead.close();await p.bringToFront();
 pass('Static cloned report negative control fails the same interaction probe');
 await append(p,' UNSAVED-SHOULD-DISAPPEAR');assert((await p.locator('#save-state').innerText()).startsWith('Dirty'));assert.deepEqual(await readSaved(),seed);await p.reload();await ready(p);assert.equal(await content(p),seed.content);pass('Unsaved discard and independent exact stored-state comparison');
 await p.locator('#find-box').fill('OMEGA-END-ANCHOR');await p.locator('#find-next-btn').click();for(let i=0;i<3;i++)await p.keyboard.press('Control+s');assert.deepEqual(await readSaved(),seed);pass('Unchanged Save does not create content/revision/history changes');
 await append(p,' HISTORY-A');await save(p);await append(p,' HISTORY-B');await save(p);const saved=await readSaved();assert.equal(saved.revision,3);assert.equal(saved.history.length,3);
 const first=p.locator('#revision-list .revision').filter({has:p.locator('strong').filter({hasText:/^Revision 1$/})});await first.getByRole('button',{name:'Preview',exact:true}).click();await p.locator('#revision-preview-1').waitFor({state:'visible'});assert.equal(await p.locator('#revision-preview-1').innerText(),seed.content);assert.deepEqual(await readSaved(),saved);
 await first.getByRole('button',{name:'Restore Draft',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Dirty'));assert.equal(await content(p),seed.content);assert.deepEqual(await readSaved(),saved);await p.keyboard.press('Control+z');assert.equal(await content(p),saved.content);pass('Changed saves, complete history, read-only preview, draft restore and one Undo');
 const b=await c.newPage();await b.goto('http://localhost:3000');await ready(b);await append(p,' TAB-A-WINS');await save(p);const winner=await readSaved();await append(b,' TAB-B-STALE');await save(b,409);assert(await b.locator('#message').isVisible());assert((await content(b)).includes('TAB-B-STALE'));assert.deepEqual(await readSaved(),winner);await b.close();pass('Rejected stale save retains draft and preserves independently loaded winning state');
 const valid={documentId:winner.id,baseRevision:winner.revision,content:winner.content};const route=saveRequest.url();const probes=[{...valid,baseRevision:1,content:'FORGED-STALE-OVERWRITE'},{...valid,documentId:'missing-report'},{...valid,baseRevision:'4'},{...valid,baseRevision:1.5},{...valid,baseRevision:undefined},{...valid,content:undefined},{...valid,content:null}];
 for(const body of probes){const result=await p.evaluate(async({url,body})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.status;},{url:route,body});assert(result>=400);assert.deepEqual(await readSaved(),winner);}pass('Seven invalid save probes preserve complete content, revision and history');
 await append(p,' PATCHPAD-RESTART-PROOF');await save(p);const before=await readSaved();for(let i=0;i<2;i++){execFileSync('bash',['/tests/app-lifecycle.sh','restart'],{timeout:60000});assert.deepEqual(await readSaved(),before);}pass('Two real process restarts preserve all document and history values');
 const broken=structuredClone(before);broken.content+=' CORRUPTION';assert.notDeepEqual(broken,before);const missing=structuredClone(before);missing.history.pop();assert.notDeepEqual(missing,before);pass('Comparison negative controls detect changed text and missing history');
 const kind=process.env.REVIEW_KIND||'unknown';if(kind==='html')assert.deepEqual([...observedReads],['/']);
 }finally{fs.writeFileSync('/results/server-reads.json',JSON.stringify({passed,observed_read_paths:[...observedReads],scope:'Golden-specific local evidence; not a paid judge result'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
