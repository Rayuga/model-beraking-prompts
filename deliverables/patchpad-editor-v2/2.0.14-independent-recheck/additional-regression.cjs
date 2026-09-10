// Real browser regression; source-specific selectors are local test aids, not grading requirements.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const ctx = await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
  const p = await ctx.newPage(), results=[], errors=[];
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog',d=>d.accept());
  const read = path => p.evaluate(async path=>(await fetch(path)).json(),path);
  const doc = async ()=>(await read('/api/documents/incident-alpha')).document;
  const history = ()=>read('/api/documents/incident-alpha/revisions');
  const lines = ()=>p.locator('.line .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
  const ready = ()=>p.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');
  const fresh = async ()=>{await p.goto('http://localhost:3000/'); await ready();};
  const find = async q=>{await p.locator('#find-box').fill(q); await p.locator('#find-next-btn').click();};
  const paste = async s=>{await p.evaluate(s=>navigator.clipboard.writeText(s),s); await p.keyboard.press('Control+v'); await p.waitForFunction(s=>[...document.querySelectorAll('.text')].map(e=>e.dataset.lineText).join('\n').includes(s),s);};
  const tail = async ()=>{await find('OMEGA-END-ANCHOR');await p.keyboard.press('End');};
  const save = async ()=>{const r=p.waitForResponse(r=>r.url().endsWith('/save')&&r.request().method()==='POST');await p.locator('#save-btn').click();assert.equal((await r).status(),200);await p.waitForFunction(()=>document.querySelector('#save-state').textContent.startsWith('Saved'));};
  const copy = async expected=>{await p.keyboard.press('Control+c');await p.waitForFunction(async s=>(await navigator.clipboard.readText())===s,expected);};
  const check=async(id,fn)=>{try{await fresh();await fn();results.push({id,passed:true});console.log('PASS '+id);}catch(e){results.push({id,passed:false,error:e.message});console.log('FAIL '+id+': '+e.message.slice(0,250));}};
  const click=async(index,col,options={})=>{
    const row=p.locator(`.line[data-line="${index}"] .text`);await row.scrollIntoViewIfNeeded();
    const pos=await row.evaluate((el,col)=>{const c=document.createElement('canvas').getContext('2d');c.font=getComputedStyle(document.querySelector('#editor')).font;const r=el.getBoundingClientRect();return{x:r.left+10+c.measureText('m').width*col+.2,y:r.top+11};},col);
    await p.mouse.click(pos.x,pos.y,options);return pos;
  };
  await check('exact_seed_custom_surface_unsaved_discard_and_noop',async()=>{
    const seed=JSON.parse(fs.readFileSync('/assets/incident_seed.json','utf8')).document;
    const expected=[...seed.sections,...Array.from({length:seed.generatedLineCount},(_,i)=>seed.generatedLineTemplate.replaceAll('{n}',String(i+1).padStart(seed.generatedLineNumberWidth,'0'))),...seed.tailSections];
    const before=await doc(), hs=await history();assert.deepEqual(await lines(),expected);assert.equal(before.content,expected.join('\n'));assert.equal(before.current_revision,1);assert.equal((await read('/api/documents')).documents.length,1);
    assert.equal(await p.locator('#editor input,#editor textarea,#editor [contenteditable=true]').count(),0);
    await click(0,0);await p.keyboard.type('CUSTOM-SURFACE-PROOF');assert.equal((await lines()).join('\n').split('CUSTOM-SURFACE-PROOF').length-1,1);await fresh();assert.deepEqual(await doc(),before);
    await click(0,0);await p.keyboard.press('End');await p.keyboard.type(' UNSAVED-SHOULD-DISAPPEAR');assert.match(await p.locator('#save-state').textContent(),/^Dirty/);await fresh();assert.deepEqual(await lines(),expected);assert.deepEqual(await doc(),before);assert.deepEqual(await history(),hs);
    await click(0,0);for(let i=0;i<3;i++)await p.keyboard.press('Control+s');assert.deepEqual(await doc(),before);assert.deepEqual(await history(),hs);assert.match(await p.locator('#save-state').textContent(),/^Saved/);assert.ok(await p.locator('#save-btn').isDisabled());
  });
  await check('exact_keyboard_coordinates',async()=>{
    await click(0,0);for(let i=0;i<4;i++)await p.keyboard.press('ArrowDown');
    const steps=[['', 'Ln 5, Col 1'],['End','Ln 5, Col 9'],['ArrowDown','Ln 6, Col 9'],['Home','Ln 6, Col 1'],['ArrowLeft','Ln 5, Col 9'],['ArrowRight','Ln 6, Col 1'],['End','Ln 6, Col 59'],['ArrowUp','Ln 5, Col 9'],['ArrowDown','Ln 6, Col 59']];
    for(const[key,value]of steps){if(key)await p.keyboard.press(key);assert.equal(await p.locator('#cursor-label').textContent(),value);}
    await click(1225,5);await p.keyboard.press('End');assert.equal(await p.locator('#cursor-label').textContent(),'Ln 1226, Col 63');
  });
  await check('mouse_word_line_range_and_typed_replacement',async()=>{
    const before=await lines();await click(4,3,{clickCount:2});await p.keyboard.press('Backspace');assert.equal((await lines())[4],'');await p.keyboard.press('Control+z');assert.deepEqual(await lines(),before);
    await click(11,4,{clickCount:3});await p.keyboard.press('Backspace');assert.deepEqual(await lines(),before.filter((_,i)=>i!==11));await p.keyboard.press('Control+z');assert.deepEqual(await lines(),before);
    const a=await click(12,0);const b=await click(12,17);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:12});await p.mouse.up();await p.keyboard.press('Backspace');assert.equal((await lines())[12],' were delayed but not lost.');await p.keyboard.press('Control+z');assert.deepEqual(await lines(),before);
    await click(17,0);await p.keyboard.press('Home');for(let i=0;i<4;i++)await p.keyboard.press('Shift+ArrowRight');await p.keyboard.type('DONE');assert.equal((await lines())[17],'DONE: Replace temporary dashboard link before publishing.');
    await find('Timeline');await p.keyboard.press('Home');await p.keyboard.press('Shift+End');await p.keyboard.type('REPLACE-ATOMIC');assert.equal((await lines())[4],'REPLACE-ATOMIC');await p.keyboard.press('Control+z');assert.equal((await lines())[4],'Timeline');await p.keyboard.press('Control+y');assert.equal((await lines())[4],'REPLACE-ATOMIC');
  });
  await check('newline_join_and_external_clipboard',async()=>{
    await tail();await p.keyboard.press('Enter');await paste('JOIN-LEFT\nJOIN-RIGHT\nJOIN-TAIL');const before=await lines();
    await find('JOIN-RIGHT');await p.keyboard.press('Home');await p.keyboard.press('Backspace');assert.deepEqual((await lines()).slice(-2),['JOIN-LEFTJOIN-RIGHT','JOIN-TAIL']);assert.equal((await lines()).length,before.length-1);await p.keyboard.press('Control+z');assert.deepEqual(await lines(),before);
    await find('JOIN-LEFT');await p.keyboard.press('End');await p.keyboard.press('Delete');assert.deepEqual((await lines()).slice(-2),['JOIN-LEFTJOIN-RIGHT','JOIN-TAIL']);
    await fresh();await tail();await p.keyboard.press('Enter');await paste('EXTERNAL-A\nEXTERNAL-B\tCELL\nEXTERNAL-C');const pasted=await lines();assert.deepEqual(pasted.slice(-3),['EXTERNAL-A','EXTERNAL-B\tCELL','EXTERNAL-C']);
    await p.keyboard.press('ArrowUp');await p.keyboard.press('Home');await p.keyboard.press('Shift+End');await copy('EXTERNAL-B\tCELL');await p.keyboard.press('Control+x');await p.waitForFunction(()=>[...document.querySelectorAll('.text')].at(-2).dataset.lineText==='');await p.keyboard.press('Control+z');assert.deepEqual(await lines(),pasted);await p.keyboard.press('Control+a');await copy(pasted.join('\n'));
  });
  await check('typing_groups_and_redo_invalidation',async()=>{
    const before=await lines();for(const[q,marker]of [['Incident:',' LOCATION-ONE'],['ALPHA-0600',' LOCATION-TWO'],['OMEGA-END-ANCHOR',' LOCATION-THREE']]){await find(q);await p.keyboard.press('End');await p.keyboard.type(marker);}
    for(const marker of ['LOCATION-THREE','LOCATION-TWO']){await p.keyboard.press('Control+z');assert.ok(!(await lines()).join('\n').includes(marker));assert.ok((await lines())[0].endsWith(' LOCATION-ONE'));}
    await p.keyboard.press('Control+y');assert.ok((await lines()).join('\n').includes('LOCATION-TWO'));await p.keyboard.press('Control+y');assert.ok((await lines()).at(-1).endsWith(' LOCATION-THREE'));
    await p.keyboard.type(' REDO-CLEAR-ORIGINAL');await p.keyboard.press('Control+z');assert.ok(!(await lines()).join('\n').includes('REDO-CLEAR-ORIGINAL'));await p.keyboard.type(' REDO-CLEAR-NEW');assert(await p.locator('#redo-btn').isDisabled());await p.keyboard.press('Control+y');assert.ok(!(await lines()).join('\n').includes('REDO-CLEAR-ORIGINAL'));assert.equal((await lines()).length,before.length);
  });
  await check('offscreen_mouse_and_keyboard_selection',async()=>{
    await find('ALPHA-0010');await p.keyboard.press('Home');const a=await click(32,0);const rect=await p.locator('#editor').boundingBox();const initial=await p.locator('#editor').evaluate(e=>e.scrollTop);
    await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(rect.x+rect.width-15,rect.y+rect.height+30,{steps:12});
    // Keep the real mouse held beyond the edge until autoscroll selects ALPHA-0060.
    await p.waitForFunction(()=>[...document.querySelectorAll('.line[data-line="82"] .selection')].length>0,null,{timeout:15000});await p.mouse.up();await p.keyboard.press('Control+c');await p.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('ALPHA-0060'));
    const selected=await p.evaluate(()=>navigator.clipboard.readText());assert.ok(selected.startsWith('Log line 0010:'));assert.ok(selected.indexOf('ALPHA-0010')<selected.indexOf('ALPHA-0060'));assert.ok(await p.locator('#editor').evaluate(e=>e.scrollTop)>initial);
    await find('ALPHA-0010');await p.keyboard.press('Home');for(let i=0;i<50;i++)await p.keyboard.press('Shift+ArrowDown');await p.keyboard.press('Shift+End');await p.keyboard.press('Control+c');await p.waitForFunction(async()=> (await navigator.clipboard.readText()).includes('ALPHA-0060'));
    const caret=await p.locator('.caret').boundingBox(), ed=await p.locator('#editor').boundingBox();assert.ok(caret.y>=ed.y&&caret.y+caret.height<=ed.y+ed.height+2);
  });
  await check('long_document_three_region_round_trip',async()=>{
    const baseline=await doc(), before=baseline.content.split('\n'), middle=Math.floor(before.length/2), expected=[...before];
    for(const[i,marker]of [[0,' TOP-ROUNDTRIP'],[middle,' MID-ROUNDTRIP'],[before.length-1,' TAIL-ROUNDTRIP']]){await find(before[i]);await p.keyboard.press('End');await p.keyboard.type(marker);expected[i]+=marker;}
    await save();await fresh();assert.deepEqual((await doc()).content.split('\n'),expected);assert.deepEqual(await lines(),expected);assert.equal((await doc()).current_revision,baseline.current_revision+1);
  });
  await check('save_once_fresh_context_and_ui_manifest_routes',async()=>{
    const requests=new Set(), observe=r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.add(r.method()+' '+new URL(r.url()).pathname);};
    const before=await doc();p.on('request',observe);await fresh();
    const rev=p.locator('.revision').filter({has:p.locator('strong',{hasText:/^Revision 1$/})});await rev.getByRole('button',{name:'Preview',exact:true}).click();await p.locator('#revision-preview-1').waitFor({state:'visible'});
    await click(0,0);await p.keyboard.press('End');await p.keyboard.type(' BASIC-SAVE-CHECK');await save();p.off('request',observe);
    const saved=await doc();assert.equal(saved.current_revision,before.current_revision+1);assert.equal(saved.content,before.content.replace('\n',' BASIC-SAVE-CHECK\n'));
    const freshContext=await browser.newContext(), view=await freshContext.newPage();await view.goto('http://localhost:3000');await view.waitForSelector('.line');assert.equal(await view.locator('.line .text').evaluateAll(es=>es.map(e=>e.dataset.lineText).join('\n')),saved.content);await freshContext.close();
    const manifest=fs.readFileSync('/app/APP_MANIFEST.md','utf8');for(const[method,template,actual]of [['GET','/api/documents','/api/documents'],['GET','/api/documents/:id','/api/documents/incident-alpha'],['POST','/api/documents/:id/save','/api/documents/incident-alpha/save'],['GET','/api/documents/:id/revisions','/api/documents/incident-alpha/revisions'],['GET','/api/documents/:id/revisions/:revision','/api/documents/incident-alpha/revisions/1']]){assert.ok(manifest.includes('| '+method+' | `'+template+'`'));assert.ok(requests.has(method+' '+actual));}
  });
  await check('full_revision_preview_and_restore_history',async()=>{
    await tail();await p.keyboard.type(' PRE-RESTORE-EDIT');const before=await lines();
    const rev=p.locator('.revision').filter({has:p.locator('strong',{hasText:/^Revision 1$/})});
    await rev.getByRole('button',{name:'Preview',exact:true}).click();await p.locator('#revision-preview-1').waitFor({state:'visible'});const old=(await read('/api/documents/incident-alpha/revisions/1')).revision.content;
    assert.equal(await p.locator('#revision-preview-1').textContent(),old);
    const saved=await doc(), hs=await history();await rev.getByRole('button',{name:'Restore Draft'}).click();await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('restored as unsaved'));assert.equal((await lines()).join('\n'),old);
    await p.keyboard.press('Control+z');assert.deepEqual(await lines(),before);await p.keyboard.press('Control+z');assert.equal((await lines()).join('\n'),saved.content);assert.deepEqual(await doc(),saved);assert.deepEqual(await history(),hs);
  });
  await check('undo_to_saved_content_reports_saved',async()=>{await find('Timeline');await p.keyboard.press('End');await p.keyboard.type(' UNSAVED-LOCAL');await p.keyboard.press('Control+z');assert.equal((await lines()).join('\n'),(await doc()).content);assert.match(await p.locator('#save-state').textContent(),/^Saved/);});
  await check('open_document_discards_local_undo_history',async()=>{
    const saved=await doc();await find('Timeline');await p.keyboard.type('TEMP-OPEN-DRAFT');await p.locator('#document-list button').click();await p.waitForFunction(()=>document.querySelector('.line[data-line="4"] .text').dataset.lineText==='Timeline');assert(await p.locator('#undo-btn').isDisabled());assert(await p.locator('#redo-btn').isDisabled());await p.locator('#editor').focus();await p.keyboard.press('Control+z');assert.equal((await lines()).join('\n'),saved.content);await p.keyboard.press('Control+y');assert.equal((await lines()).join('\n'),saved.content);
  });
  await check('typing_during_save_stays_dirty_and_saves_next',async()=>{
    await tail();await p.keyboard.type(' SAVED-FIRST');let release;const gate=new Promise(r=>release=r);let intercepted;const arrived=new Promise(r=>intercepted=r);
    await p.route('**/api/documents/*/save',async route=>{const response=await route.fetch();intercepted();await gate;await route.fulfill({response});});
    await p.keyboard.press('Control+s');await arrived;await p.keyboard.type(' UNSAVED-LATER');release();await p.unrouteAll({behavior:'wait'});
    await p.waitForFunction(()=>document.querySelector('#revision-label').textContent.includes('Revision'));
    assert.ok(!(await doc()).content.includes('UNSAVED-LATER'));assert.ok((await lines()).at(-1).endsWith(' UNSAVED-LATER'));assert.match(await p.locator('#save-state').textContent(),/^Dirty/);await save();assert.ok((await doc()).content.endsWith(' UNSAVED-LATER'));
  });
  await check('direct_server_rejection_matrix',async()=>{
    const baseline=await doc(), post=(url,body)=>p.evaluate(async({url,body})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,body:await r.text()};},{url,body});
    const url='/api/documents/incident-alpha/save';const valid={documentId:'incident-alpha',baseRevision:baseline.current_revision,content:baseline.content+' API-CURRENT-WINS'};
    assert.equal((await post(url,valid)).status,200);const protectedDoc=await doc(), hs=await history();const current={...valid,baseRevision:protectedDoc.current_revision};
    const probes=[['stale',url,{...valid,content:'FORGED-STALE-OVERWRITE'},409],['unknown','/api/documents/unknown/save',{...current,documentId:'unknown'}],['mismatch',url,{...current,documentId:'other'}],['missing revision',url,{content:current.content}],['string revision',url,{...current,baseRevision:String(current.baseRevision)}],['fractional revision',url,{...current,baseRevision:1.5}],['missing content',url,{baseRevision:current.baseRevision}],['null content',url,{...current,content:null}]];
    for(const[name,path,body,status]of probes){const r=await post(path,body);assert.ok(status?r.status===status:r.status>=400,name+': '+r.status);assert.deepEqual(await doc(),protectedDoc);assert.deepEqual(await history(),hs);}
    await post(url,{...current,currentRevision:999});assert.deepEqual(await doc(),protectedDoc);assert.deepEqual(await history(),hs);
  });
  await check('present_falsy_document_ids_rejected',async()=>{
    const before=await doc(), hs=await history();for(const value of ['',null,false,0]){const r=await p.evaluate(async({value,before})=>{const r=await fetch('/api/documents/incident-alpha/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:value,baseRevision:before.current_revision,content:before.content+' SHOULD-NOT-SAVE'})});return r.status;},{value,before});assert.ok(r>=400,'documentId '+JSON.stringify(value)+' returned '+r);assert.deepEqual(await doc(),before);assert.deepEqual(await history(),hs);}
  });
  await browser.close();
  fs.writeFileSync('/results/additional-regression.json',JSON.stringify({scope:'Unpaid current-source browser checks; not an Oracle grade',results,errors},null,2));
  if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
