const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out='/work';fs.mkdirSync(out,{recursive:true});
const report={started_at:new Date().toISOString(),criteria:[],exchanges:[],dialogs:[],errors:[]};
let browser,context,page,accept=true,answer='';const prefix='FullQC '+Date.now();
const ed=p=>p.getByRole('textbox',{name:'Code editor',exact:true});
const field=(name,p=page)=>p.getByRole('textbox',{name,exact:true});
const frame=()=>page.frameLocator('iframe[title="Live preview"]');
const log=()=>page.getByRole('log').innerText();
async function source(code,p=page){await ed(p).click();await p.keyboard.press('Control+A');await p.keyboard.insertText(code);}
async function complete(){await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'),null,{timeout:8000});}
async function run(code,name='fullqc.js'){await field('Filename').fill(name);await source(code);await page.getByRole('button',{name:/^Run/}).click();}
async function good(marker){await run("document.body.textContent="+JSON.stringify(marker)+";console.log("+JSON.stringify(marker)+");");await complete();await frame().getByText(marker,{exact:true}).waitFor();}
function attach(p){p.on('dialog',async d=>{report.dialogs.push({type:d.type(),message:d.message(),accept});accept?await d.accept(d.type()==='prompt'?answer:undefined):await d.dismiss();});p.on('pageerror',e=>report.errors.push(e.message));}
async function write(button='Save',p=page){const wait=p.waitForResponse(r=>['POST','PUT','DELETE'].includes(r.request().method())&&r.url().includes('/api/snippets'));await p.getByRole('button',{name:button,exact:true}).click();const r=await wait,b=await r.json();const x={url:r.url(),method:r.request().method(),request:r.request().postDataJSON(),status:r.status(),body:b};report.exchanges.push(x);return x;}
async function direct(url,method='GET',body){const x=await page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()}},{url,method,body});report.exchanges.push({url,method,request:body,...x});return x;}
async function create(label,code="console.log('control');",name='control.js'){await page.getByRole('button',{name:'New',exact:true}).click();await field('Snippet title').fill(prefix+' '+label);await field('Filename').fill(name);await source(code);const r=await write();assert.equal(r.status,201);return r.body;}
async function load(record,p=page){await p.locator('.snippetlist button').filter({hasText:record.title}).first().click();assert.equal(await field('Snippet title',p).inputValue(),record.title);}
async function read(record){return(await direct('/api/snippets/'+record.id)).body;}
async function exact(record,p=page){assert.equal(await field('Snippet title',p).inputValue(),record.title);assert.equal(await field('Filename',p).inputValue(),record.filename);assert.equal(await ed(p).innerText(),record.code);}
async function check(id,fn){const details=await fn();report.criteria.push({id,passed:true,...details});console.log('PASS '+id);}
async function main(){
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});report.browser=browser.version();
 context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();attach(page);
 await page.goto('http://localhost:3000');await ed(page).waitFor();await complete();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
 await check('initial_examples',async()=>{await page.getByRole('combobox',{name:'Starter example',exact:true}).selectOption('counter.html');await field('Filename').filter({has:page.locator('never')}).count();await page.waitForFunction(()=>document.querySelector('[aria-label="Filename"]').value==='counter.html');await page.getByRole('button',{name:/^Run/}).click();await complete();assert((await frame().locator('body').innerText()).length>0);assert((await log()).length>0);await good('fresh-authored-fullqc');return{example:'counter.html',authored:true};});
 await check('language_dispatch_handler_cleanup',async()=>{
  const html="<!doctype html><html><body><h1 id='css-marker'>retained-document</h1><button id='old-handler'>Old handler</button><script>document.querySelector('#old-handler').addEventListener('click',()=>{console.log('old-click-marker')});console.log('html-handler-once');</script></body></html>";
  await run(html,'handlers.html');await complete();await frame().getByRole('button',{name:'Old handler'}).click();await frame().getByText('retained-document',{exact:true}).waitFor();
  const logsBefore=await log();await run('#css-marker { color: rgb(255, 0, 0); }','handlers.CSS');await complete();await frame().getByText('retained-document',{exact:true}).waitFor();assert.equal(await frame().locator('#css-marker').evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
  await frame().getByRole('button',{name:'Old handler'}).click();await page.waitForTimeout(300);assert.equal(await log(),logsBefore);return{positiveClickBeforeCss:true,noRepeatedScript:true,noOldHandlerAfterCss:true};
 });
 await check('fresh_cancel',async()=>{
  await good('cancellation-last-good');await page.getByRole('button',{name:'Clear console',exact:true}).click();
  const started=Date.now();await run("window.__cancelLeak='A';document.body.innerHTML='<p>candidate-A</p>';console.log('cancel-A-started');setTimeout(()=>console.log('cancel-A-delayed'),4000);");
  await page.getByRole('log').getByText('cancel-A-started',{exact:true}).waitFor();assert.match(await page.getByRole('status').innerText(),/Running|Waiting for asynchronous/i);
  await run("document.body.textContent='run-B-'+typeof window.__cancelLeak;console.log('cancel-B-started');");assert(Date.now()-started<4000);await complete();await frame().getByText('run-B-undefined',{exact:true}).waitFor();
  await page.waitForTimeout(Math.max(0,6100-(Date.now()-started)));assert(!(await log()).includes('cancel-A-delayed'));
  await run("document.body.textContent='stop-candidate';console.log('stop-started');setTimeout(()=>console.log('stop-delayed'),4000);");await page.getByRole('log').getByText('stop-started',{exact:true}).waitFor();await page.getByRole('button',{name:'Stop',exact:true}).click();
  assert.match(await page.getByRole('status').innerText(),/cancel|stop/i);await frame().getByText('run-B-undefined',{exact:true}).waitFor();await page.waitForTimeout(4200);assert(!(await log()).includes('stop-delayed'));await good('after-manual-stop-recovered');return{newRunBeforeOldTimer:true,waitedPastBothTimers:true,stopFeedback:true,recovery:true};
 });
 await check('auto_run_subsequent_edit_resets_debounce',async()=>{
  await good('debounce-old-preview');await page.getByRole('button',{name:'Clear console',exact:true}).click();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).check();
  const probeStart=Date.now();await source("document.body.textContent='debounce-measure';console.log('debounce-measure');");await frame().getByText('debounce-measure',{exact:true}).waitFor();const delay=Date.now()-probeStart;assert(delay<2200);
  const gap=Math.max(70,Math.floor(delay/4)),events=[],start=Date.now();let index=0;
  while(Date.now()-start<delay*2){
   const marker='debounce-edit-'+index++;await source("document.body.textContent='"+marker+"';console.log('"+marker+"');");events.push({marker,time:Date.now()-start});
   await page.waitForTimeout(gap);assert(!(await log()).includes('debounce-edit-'));await frame().getByText('debounce-measure',{exact:true}).waitFor();
  }
  const last=events.at(-1).marker;await frame().getByText(last,{exact:true}).waitFor({timeout:2200});const text=await log();for(const item of events.slice(0,-1))assert(!text.includes(item.marker+'\n')&&!text.endsWith(item.marker));assert(text.includes(last));
  await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();return{measuredPauseMs:delay,typingDurationMs:events.at(-1).time,editIntervalMs:gap,events,finalOnly:true};
 });
 await check('console_levels_objects_controls',async()=>{
  await page.getByRole('button',{name:'Clear console',exact:true}).click();
  await run("console.log('level-log');console.warn('level-warn');console.error('level-error');console.info('level-info');console.log({tag:'object-check',nested:{deep:'nested-value'}});console.log([11,22,33]);");await complete();
  const entries=page.locator('.entry');assert.deepEqual(await entries.locator('.level').allTextContents(),['log','warn','error','info','log','log']);
  await entries.nth(4).locator('summary').first().click();await entries.nth(4).locator('summary').nth(1).click();assert.match(await entries.nth(4).innerText(),/tag[\s\S]*object-check[\s\S]*nested[\s\S]*deep[\s\S]*nested-value/);
  await entries.nth(5).locator('summary').click();for(const n of ['11','22','33'])assert((await entries.nth(5).innerText()).includes(n));
  await page.getByRole('button',{name:'Clear console',exact:true}).click();await run("for(let i=0;i<40;i++)console.log('row-'+i);");await complete();assert.equal(await page.locator('.entry').count(),40);for(let i=0;i<40;i++)assert((await page.locator('.entry').nth(i).innerText()).endsWith('row-'+i));assert.match(await page.getByRole('status').innerText(),/\d+(?:\.\d+)? ms/);
  const pane=page.getByRole('log');await pane.evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});await run("console.log('after-scroll-up');");await complete();assert.equal(await pane.evaluate(e=>e.scrollTop),0);assert.equal(await page.locator('.entry').count(),41);
  await pane.evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await run("console.log('after-scroll-down');");await complete();assert(await pane.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight<30));
  await page.getByRole('button',{name:'Clear console',exact:true}).click();assert.equal(await page.locator('.entry').count(),0);return{levelsInOrder:true,nestedExpanded:true,allArrayValues:true,fortyRows:true,duration:true,scrollUpPreserved:true,bottomFollow:true,clear:true};
 });
 await check('save_load',async()=>{
  const a=await create('Save Alpha',"console.log('alpha-body');",'qc-alpha.js'),b=await create('Save Beta','<!doctype html><html><body><p>beta-body</p></body></html>','qc-beta.html');
  for(const r of[a,b]){await load(r);await exact(r);}await page.reload();await ed(page).waitFor();for(const r of[a,b]){await load(r);await exact(r);assert.deepEqual(await read(r),r);}return{ids:[a.id,b.id],bothExactAfterReload:true};
 });
 await check('persistent_snippets',async()=>{
  const original=await create('Concurrent Base',"console.log('base-version');",'qc-concurrent.js'),other=await context.newPage();attach(other);await other.goto('http://localhost:3000');await ed(other).waitFor();await load(original,other);
  await field('Snippet title').fill(prefix+' Concurrent Updated');await field('Filename').fill('qc-concurrent.html');await source('<!doctype html><html><body>first-editor-won</body></html>');const won=(await write()).body;
  const staleSource="console.log('stale-overwrite');";await source(staleSource,other);const stale=await write('Save',other);assert.equal(stale.status,409);assert.equal(stale.body.code,'REVISION_CONFLICT');assert.equal(await ed(other).innerText(),staleSource);assert.deepEqual(await read(won),won);
  await other.getByRole('button',{name:'Reload latest',exact:true}).click();await source('<!doctype html><html><body>reapplied-after-reload</body></html>',other);const applied=(await write('Save',other)).body;assert.equal(applied.revision,won.revision+1);await other.reload();await ed(other).waitFor();await load(applied,other);await exact(applied,other);await other.close();return{originalRevision:original.revision,winningRevision:won.revision,reappliedRevision:applied.revision,allThreeFieldsPreserved:true,staleDraftKept:true};
 });
 await check('cw_title_change_uniqueness',async()=>{
  let a=await create('Rename Source',"console.log('rename-source');",'rename-a.js');const b=await create('Rename Sibling',"console.log('rename-sibling');",'rename-b.js');await load(a);answer=prefix+' Rename Source Renamed';a=(await write('Rename')).body;const originalA={...a},originalB={...b};
  answer=b.title;const uiCollision=await write('Rename');assert.equal(uiCollision.status,409);
  for(const title of[b.title,'  '+b.title+'  ','','   ']){const bad=await direct('/api/snippets/'+a.id,'PUT',{...a,title});assert([400,409].includes(bad.status));assert.notEqual(bad.body.code,'REVISION_CONFLICT');assert.deepEqual(await read(a),originalA);assert.deepEqual(await read(b),originalB);}
  const lower=await create('rename sibling',"console.log('case-sensitive-body');",'case.js');assert.equal(lower.title,b.title.toLowerCase().replace('fullqc','FullQC')); // Prefix remains intentionally identical; only suffix case differs.
  assert.notEqual(lower.id,b.id);for(const r of[b,lower]){await load(r);await exact(r);}
  await load(a);answer=prefix+' Rename Recovered';a=(await write('Rename')).body;assert.equal(a.filename,originalA.filename);assert.equal(a.code,originalA.code);assert.deepEqual(await read(b),originalB);assert.deepEqual(await read(lower),lower);return{collisionTrimBlankRefused:true,caseSensitiveDistinct:true,recovery:true};
 });
 await check('cw_independent_snippet_copy',async()=>{
  const original=await create('Duplicate Original',"console.log('original-copy-source');",'dup.js');answer=prefix+' Duplicate Copy';let copy=(await write('Duplicate')).body;assert.notEqual(copy.id,original.id);assert.equal(copy.code,original.code);assert.equal(copy.filename,original.filename);
  await source("console.log('copy-edited-source');");copy=(await write()).body;await page.reload();await ed(page).waitFor();assert.deepEqual(await read(original),original);assert.deepEqual(await read(copy),copy);
  const collision=await direct('/api/snippets','POST',{title:copy.title,filename:copy.filename,code:copy.code});assert.equal(collision.status,409);assert.equal(collision.body.code,'TITLE_CONFLICT');assert.deepEqual(await read(original),original);assert.deepEqual(await read(copy),copy);
  await load(original);answer=prefix+' Duplicate Extra';const extra=await write('Duplicate');assert.equal(extra.status,201);assert.notEqual(extra.body.id,copy.id);return{ids:[original.id,copy.id,extra.body.id],collisionAtomic:true,recovery:true};
 });
 await check('delete_confirm',async()=>{
  const target=await create('Delete Target',"console.log('delete-original');"),sibling=await create('Delete Sibling',"console.log('keep-sibling');"),control=await create('Delete Control',"console.log('valid-delete-control');");
  await load(target);accept=false;await page.getByRole('button',{name:'Delete',exact:true}).click();accept=true;await page.reload();await ed(page).waitFor();for(const r of[target,sibling,control])assert.deepEqual(await read(r),r);
  await load(control);const removed=await write('Delete');assert.equal(removed.status,200);assert.equal((await direct('/api/snippets/'+control.id)).status,404);
  await load(target);await source("console.log('newer-work-to-keep');");const updated=(await write()).body;
  const stale=await direct('/api/snippets/'+target.id,removed.method,{...removed.request,revision:target.revision});assert.equal(stale.status,409);assert.equal(stale.body.code,'REVISION_CONFLICT');assert.deepEqual(await read(updated),updated);assert.deepEqual(await read(sibling),sibling);
  await load(updated);assert.equal((await write('Delete')).status,200);await page.reload();await ed(page).waitFor();assert.equal((await direct('/api/snippets/'+target.id)).status,404);assert.deepEqual(await read(sibling),sibling);
  const resurrect=await direct('/api/snippets/'+target.id,'PUT',updated);assert.equal(resurrect.status,404);assert.equal((await direct('/api/snippets/'+target.id)).status,404);return{cancel:true,positiveDelete:true,staleDeleteRefused:true,freshDelete:true,noResurrection:true};
 });
 await check('editor_basics_indent',async()=>{
  const colors={};for(const[name,code]of[['tokens.js','const data = { value: 1 };'],['tokens.html','<!doctype html><html><body><h1>Title</h1></body></html>'],['tokens.css','h1 { color: red; font-size: 20px; }']]){await field('Filename').fill(name);await source(code);colors[name]=await page.locator('.cm-line').evaluateAll(lines=>[...new Set(lines.flatMap(e=>[e,...e.querySelectorAll('span')].map(x=>getComputedStyle(x).color)))]);assert(colors[name].length>1);}
  const font=await ed(page).evaluate(e=>getComputedStyle(e).fontFamily);assert.match(font,/mono/i);assert((await page.locator('.cm-lineNumbers').innerText()).includes('1'));
  await field('Filename').fill('bracket.js');await source('const data = { value: 1 };');await page.keyboard.press('Home');for(let i=0;i<13;i++)await page.keyboard.press('ArrowRight');assert(await page.locator('.cm-matchingBracket').count()>=2);
  const original='const alpha = 1;\nconst beta = 2;\nconst gamma = 3;';await source(original);await page.keyboard.press('Control+A');await page.keyboard.press('Tab');const indented=await ed(page).innerText(),lines=indented.split('\n'),prefixes=lines.map(s=>s.match(/^\s+/)?.[0]);assert(prefixes[0]&&prefixes.every(s=>s===prefixes[0]));assert.equal(lines.map(s=>s.slice(prefixes[0].length)).join('\n'),original);const selected=await page.evaluate(()=>getSelection().toString());for(const s of['alpha','beta','gamma'])assert(selected.includes(s));await page.keyboard.press('Shift+Tab');assert.equal(await ed(page).innerText(),original);return{colors,font,brackets:true,allSelectedLinesIndent:true,selectionPreserved:true,exactOutdent:true};
 });
 await check('cw_keyboard_shortcut_actions',async()=>{
  const documentation=await page.locator('footer').innerText();assert.match(documentation,/Ctrl\/Cmd\+Enter Run/);assert.match(documentation,/Ctrl\/Cmd\+S Save/);assert.match(documentation,/Ctrl\/Cmd\+Shift\+K Clear console/);
  await page.getByRole('button',{name:'New',exact:true}).click();await field('Snippet title').fill(prefix+' Keyboard Save');await field('Filename').fill('qc-keyboard.js');const code="document.body.textContent='keyboard-marker';console.log('keyboard-log');";await source(code);await page.keyboard.press('Control+Enter');await complete();await frame().getByText('keyboard-marker',{exact:true}).waitFor();assert((await log()).includes('keyboard-log'));
  const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/snippets'));await page.keyboard.press('Control+s');const response=await pending,record=await response.json();assert.equal(response.status(),201);assert.equal(record.code,code);assert.equal(record.filename,'qc-keyboard.js');await page.keyboard.press('Control+Shift+k');assert.equal(await page.locator('.entry').count(),0);return{documentation,run:true,saveId:record.id,clear:true};
 });
 await check('cw_theme_switch_legibility',async()=>{
  await good('theme-control-preview');await run("document.body.textContent='theme-control-preview';console.log('theme-control-log');",'theme-proof.js');await complete();
  const state=async()=>({title:await field('Snippet title').inputValue(),filename:await field('Filename').inputValue(),code:await ed(page).innerText(),preview:await frame().locator('body').innerText(),console:await log()});
  const palette=async()=>page.evaluate(()=>Object.fromEntries(['body','.cm-editor','.entries'].map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return[selector,{background:s.backgroundColor,color:s.color}]})));
  const before=await state(),first=await palette();await page.screenshot({path:out+'/desktop-theme-a.png',fullPage:true});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();assert.deepEqual(await state(),before);const other=await palette();for(const key of Object.keys(first))assert.notDeepEqual(other[key],first[key]);await page.screenshot({path:out+'/desktop-theme-b.png',fullPage:true});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();assert.deepEqual(await state(),before);assert.deepEqual(await palette(),first);return{before,firstPalette:first,otherPalette:other,restored:true};
 });
 await check('polish_all_and_rendered_visual_surfaces',async()=>{
  const labels=['Filename','Snippet title'];for(const name of labels)assert.equal(await field(name).count(),1);assert.equal(await page.getByRole('checkbox',{name:'Auto-run',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:/^Run/}).count(),1);
  const focused=[];await page.locator('body').click({position:{x:4,y:4}});for(let i=0;i<7;i++){await page.keyboard.press('Tab');const f=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return{tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').slice(0,70),outline:s.outline,boxShadow:s.boxShadow,focusVisible:e.matches(':focus-visible')}});if(f.focusVisible)focused.push(f);}assert(focused.length>=3);await page.screenshot({path:out+'/keyboard-focus.png',fullPage:true});
  const mobile=[];await page.setViewportSize({width:390,height:844});
  for(let t=0;t<2;t++){await page.screenshot({path:out+'/mobile-theme-'+t+'.png',fullPage:true});for(const[name,selector]of[['editor','.editor'],['library','.library'],['preview','.preview'],['console','.console']]){await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-'+name+'-'+t+'.png'});assert(await page.locator(selector).isVisible());}await frame().getByText('theme-control-preview',{exact:true}).waitFor();mobile.push({theme:await page.locator('html').getAttribute('data-theme'),previewVisible:true,rootWidth:await page.evaluate(()=>document.documentElement.scrollWidth),viewport:390});await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();}
  await page.getByRole('button',{name:'Clear console',exact:true}).click();assert.equal(await page.locator('.entry').count(),0);assert.match(await log(),/Console is clear/);await field('Filename').fill('mobile.js');await source("document.body.textContent='mobile-reachable';console.log('mobile-reachable');");await page.getByRole('button',{name:/^Run/}).click();await complete();await frame().getByText('mobile-reachable',{exact:true}).waitFor();assert((await log()).includes('mobile-reachable'));await page.locator('.preview').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-live-preview.png'});return{focused,mobile,runMobile:true,clearFeedback:true,labels:true,recognizableSurfaces:true};
 });
 assert.deepEqual(report.errors,[]);report.passed=true;
}
main().catch(async e=>{report.passed=false;report.error=e.stack;console.error(e);if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});process.exitCode=1}).finally(async()=>{report.finished_at=new Date().toISOString();fs.writeFileSync(out+'/supplement-results.json',JSON.stringify(report,null,2));if(browser)await browser.close()});
