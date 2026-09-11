const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
 const p=await ctx.newPage(),results=[];
 const ready=async p=>p.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
 const lines=async p=>p.locator('#editor .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
 const reset=async()=>{await p.reload();await ready(p);};
 const find=async(p,q)=>{await p.locator('#find-box').fill(q);await p.locator('#find-next-btn').click();};
 const append=async(p,q,t)=>{await find(p,q);await p.keyboard.press('End');await p.keyboard.type(t);};
 const copy=async(p,expected)=>{await p.evaluate(()=>navigator.clipboard.writeText('DIAGNOSTIC-SENTINEL'));await p.keyboard.press('Control+c');for(let i=0;i<40;i++){if(await p.evaluate(()=>navigator.clipboard.readText())===expected)return;await new Promise(r=>setTimeout(r,50));}assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),expected);};
 const test=async(name,fn)=>{try{const details=await fn();results.push({name,passed:true,details});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name,e.message);}};
 try{
 await p.goto('http://localhost:3000');await ready(p);
 await test('Real mouse Checkout requests drag preserves following space',async()=>{
   await find(p,'Checkout requests');await p.keyboard.press('Home');
   const target=p.locator('#editor .text').filter({hasText:'Checkout requests were delayed but not lost.'});
   const r=await target.evaluate(e=>{const b=e.getBoundingClientRect(),c=document.createElement('canvas').getContext('2d'),s=getComputedStyle(e);c.font=s.font;return {x:b.x+parseFloat(s.paddingLeft),y:b.y+b.height/2,w:c.measureText('Checkout requests').width};});
   await p.mouse.move(r.x+0.1,r.y);await p.mouse.down({clickCount:1});await p.mouse.move(r.x+r.w,r.y,{steps:16});await p.mouse.up();
   const selection=()=>p.locator('#editor .selection').allTextContents();
   console.log('MOUSE before copy',JSON.stringify({r,selection:await selection(),cursor:await p.locator('#cursor-label').innerText()}));
   await copy(p,'Checkout requests');console.log('MOUSE after copy',JSON.stringify({selection:await selection(),cursor:await p.locator('#cursor-label').innerText()}));
   await p.keyboard.press('Backspace');console.log('MOUSE deleted',JSON.stringify((await lines(p))[12]));assert.equal((await lines(p))[12],' were delayed but not lost.');
   await p.keyboard.press('Control+z');assert.equal((await lines(p))[12],'Checkout requests were delayed but not lost.');await reset();return r;
 });
 await test('Three complete typing groups, exact Undo/Redo and redo invalidation',async()=>{
   await reset();const base=await lines(p);
   await append(p,'Incident:',' LOCATION-ONE');await append(p,'ALPHA-0600',' LOCATION-TWO');await append(p,'OMEGA-END-ANCHOR',' LOCATION-THREE');
   const counts=async()=>{const s=(await lines(p)).join('\n');return ['LOCATION-ONE','LOCATION-TWO','LOCATION-THREE'].map(x=>s.split(x).length-1);};
   assert.deepEqual(await counts(),[1,1,1]);await p.keyboard.press('Control+z');assert.deepEqual(await counts(),[1,1,0]);await p.keyboard.press('Control+z');assert.deepEqual(await counts(),[1,0,0]);
   await p.keyboard.press('Control+y');assert.deepEqual(await counts(),[1,1,0]);await p.keyboard.press('Control+y');assert.deepEqual(await counts(),[1,1,1]);
   await p.keyboard.type(' REDO-CLEAR-ORIGINAL');await p.keyboard.press('Control+z');assert(!(await lines(p)).join('\n').includes('REDO-CLEAR-ORIGINAL'));
   await p.keyboard.type(' REDO-CLEAR-NEW');const edited=await lines(p);assert(await p.locator('#redo-btn').isDisabled());await p.keyboard.press('Control+y');assert.deepEqual(await lines(p),edited);await reset();assert.deepEqual(await lines(p),base);
 });
 await test('Paste and cut exact whole-document transient checkpoints',async()=>{
   await reset();await find(p,'OMEGA-END-ANCHOR');await p.keyboard.press('End');await p.keyboard.press('Enter');const before=(await lines(p)).join('\n');
   await p.evaluate(()=>navigator.clipboard.writeText('PASTE-A\nPASTE-B\nPASTE-C'));await p.keyboard.press('Control+v');
   await p.waitForFunction(()=>[...document.querySelectorAll('#editor .text')].at(-1).dataset.lineText==='PASTE-C');
   const pasted=before+'PASTE-A\nPASTE-B\nPASTE-C';assert.equal((await lines(p)).join('\n'),pasted);
   await p.keyboard.press('Control+z');assert.equal((await lines(p)).join('\n'),before);await p.keyboard.press('Control+y');assert.equal((await lines(p)).join('\n'),pasted);
   await p.keyboard.press('ArrowUp');await p.keyboard.press('Home');for(let i=0;i<7;i++)await p.keyboard.press('Shift+ArrowRight');await copy(p,'PASTE-B');await p.keyboard.press('Control+x');
   const cut=before+'PASTE-A\n\nPASTE-C';assert.equal((await lines(p)).join('\n'),cut);await p.keyboard.press('Control+z');assert.equal((await lines(p)).join('\n'),pasted);await p.keyboard.press('Control+y');assert.equal((await lines(p)).join('\n'),cut);await reset();
 });
 await test('Two chained 409s show visible alerts and preserve drafts/server content',async()=>{
   await reset();const b=await ctx.newPage();await b.goto('http://localhost:3000');await ready(b);
   const docs=await(await ctx.request.get('http://localhost:3000/api/documents')).json();const id=docs.documents[0].id;
   const get=async()=> (await ctx.request.get('http://localhost:3000/api/documents/'+id)).json();
   const first=await get();const R=first.document.current_revision;
   const save=async(p,status)=>{const response=p.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');await p.locator('#save-btn').click();assert.equal((await response).status(),status);await p.waitForFunction(()=>!document.querySelector('#save-btn').disabled);};
   // Successful save disables Save because the document is clean; await response and clean status instead.
   const ok=async p=>{const response=p.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');await p.locator('#save-btn').click();assert.equal((await response).status(),200);await p.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Saved'));};
   await append(p,'OMEGA-END-ANCHOR',' TAB-A-WINS');await ok(p);
   await append(b,'OMEGA-END-ANCHOR',' TAB-B-STALE');await save(b,409);await b.waitForFunction(()=>document.querySelector('#message').textContent.includes('Save conflict'));assert(await b.locator('#message').isVisible());
   const alert1=await b.locator('#message').innerText();assert((await lines(b)).join('\n').includes('TAB-B-STALE'));let server=(await get()).document;assert.equal(server.current_revision,R+1);assert(server.content.includes('TAB-A-WINS')&&!server.content.includes('TAB-B-STALE'));
   await b.reload();await ready(b);await append(b,'OMEGA-END-ANCHOR',' TAB-B-REBASED');await ok(b);
   await append(p,'OMEGA-END-ANCHOR',' TAB-A-STALE-SECOND');await save(p,409);await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Save conflict'));assert(await p.locator('#message').isVisible());
   server=(await get()).document;assert.equal(server.current_revision,R+2);assert(server.content.includes('TAB-A-WINS')&&server.content.includes('TAB-B-REBASED')&&!server.content.includes('TAB-A-STALE-SECOND'));assert((await lines(p)).join('\n').includes('TAB-A-STALE-SECOND'));
   await p.screenshot({path:'/results/conflict-visible.png',fullPage:true});return {alert1,alert2:await p.locator('#message').innerText(),status:await p.locator('#save-state').innerText(),revision:server.current_revision};
 });
 }finally{fs.writeFileSync('/results/reproduction.json',JSON.stringify({version:'2.0.16',results},null,2));await browser.close();}
 if(results.some(x=>!x.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
