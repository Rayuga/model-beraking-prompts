const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core'));
const base=process.env.COLDERWATER_URL||'http://localhost:3312', evidence=process.env.COLDERWATER_EVIDENCE||path.join(__dirname,'ui-evidence-library');fs.mkdirSync(evidence,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1208/chrome-win64/chrome.exe')});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const results=[],errors=[];let dialogAnswer=true,dialogValue='';
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialogAnswer?dialog.accept(dialogValue):dialog.dismiss());
 const editor=page.getByRole('textbox',{name:'Code editor',exact:true});
 async function code(value,target=page){const field=target.getByRole('textbox',{name:'Code editor',exact:true});await field.click();await target.keyboard.press('Control+A');await target.keyboard.insertText(value);}
 async function draft(title,filename,source){await page.getByRole('button',{name:'New',exact:true}).click();await page.getByRole('textbox',{name:'Snippet title',exact:true}).fill(title);await page.getByRole('textbox',{name:'Filename',exact:true}).fill(filename);await code(source);}
 async function save(target=page){const pending=target.waitForResponse(r=>r.url().includes('/api/snippets')&&['POST','PUT'].includes(r.request().method()));await target.getByRole('button',{name:'Save',exact:true}).click();const response=await pending;const data=await response.json();return{status:response.status(),data};}
 async function load(title,target=page){await target.locator('.snippetlist button').filter({hasText:title}).first().click();}
 async function read(id){return(await context.request.get(`${base}/api/snippets/${id}`)).json();}
 async function check(name,fn){await fn();results.push({name,result:'pass'});console.log('PASS',name);}
 try{
  await page.goto(base);await editor.waitFor();
  const prefix=`UI${Date.now()}`;let alpha,beta,clone;
  await check('UI save/load exactfields andreload',async()=>{
   await draft(prefix+' Alpha','alpha.js',"console.log('alpha-body');");alpha=(await save()).data;
   await draft(prefix+' Beta','beta.html','<!doctype html><html><body><p>beta-body</p></body></html>');beta=(await save()).data;
   for(const item of[alpha,beta]){await load(item.title);assert.equal(await editor.innerText(),item.code);assert.equal(await page.getByRole('textbox',{name:'Filename',exact:true}).inputValue(),item.filename);}
   await page.reload();await editor.waitFor();await load(alpha.title);assert.equal(await editor.innerText(),alpha.code);
  });
  await check('UI rename collisionfeedback andvalidrecovery',async()=>{
   dialogValue=prefix+' Alpha Renamed';const pending=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/snippets/'));await page.getByRole('button',{name:'Rename',exact:true}).click();alpha=await(await pending).json();assert.equal((await read(alpha.id)).filename,'alpha.js');
   dialogValue=beta.title;const failed=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/snippets/'));await page.getByRole('button',{name:'Rename',exact:true}).click();assert.equal((await failed).status(),409);assert.equal((await read(alpha.id)).title,alpha.title);assert.match(await page.getByRole('log').innerText(),/already|title/i);
   dialogValue=prefix+' Alpha Recovered';const recovered=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/snippets/'));await page.getByRole('button',{name:'Rename',exact:true}).click();alpha=await(await recovered).json();
  });
  await check('UI duplicate independentcopy',async()=>{
   dialogValue=prefix+' Copy';const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/snippets'));await page.getByRole('button',{name:'Duplicate',exact:true}).click();clone=await(await pending).json();assert.notEqual(clone.id,alpha.id);assert.equal(clone.code,alpha.code);await code("console.log('copy-edited');");clone=(await save()).data;assert.equal((await read(alpha.id)).code,alpha.code);assert.equal((await read(clone.id)).code,"console.log('copy-edited');");
  });
  await check('UI concurrentconflict preservesdraft reloadreapply succeeds',async()=>{
   await load(alpha.title);const other=await context.newPage();other.on('dialog',d=>d.accept());await other.goto(base);await other.getByRole('textbox',{name:'Code editor',exact:true}).waitFor();await load(alpha.title,other);
   await code("console.log('first-editor-won');");alpha=(await save()).data;
   await code("console.log('stale-draft-kept');",other);const failed=await save(other);assert.equal(failed.status,409);await other.getByRole('alert').waitFor();assert.equal(await other.getByRole('textbox',{name:'Code editor',exact:true}).innerText(),"console.log('stale-draft-kept');");assert.equal((await read(alpha.id)).code,"console.log('first-editor-won');");
   await other.getByRole('button',{name:'Reload latest',exact:true}).click();await other.getByRole('button',{name:'Restore previous draft',exact:true}).waitFor();assert.equal(await other.getByRole('textbox',{name:'Code editor',exact:true}).innerText(),"console.log('first-editor-won');");await other.getByRole('button',{name:'Restore previous draft',exact:true}).click();const saved=await save(other);assert.equal(saved.status,200);alpha=saved.data;assert.equal((await read(alpha.id)).code,"console.log('stale-draft-kept');");await other.close();
  });
  await check('UI deletecancel protectsrecord confirmeddelete removesonlytarget',async()=>{
   await load(clone.title);dialogAnswer=false;await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal((await read(clone.id)).code,clone.code);dialogAnswer=true;const pending=page.waitForResponse(r=>r.request().method()==='DELETE');await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal((await pending).status(),200);assert.equal((await context.request.get(`${base}/api/snippets/${clone.id}`)).status(),404);assert.equal((await read(beta.id)).code,beta.code);
  });
  await check('UI importexport uppercaseextension rejectionpreservesdraft',async()=>{
   await draft(prefix+' Export','export-me.js',"console.log('export-me-body');");const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export file',exact:true}).click();const file=await downloaded;assert.equal(file.suggestedFilename(),'export-me.js');await file.saveAs(path.join(evidence,'export-me.js'));assert.equal(fs.readFileSync(path.join(evidence,'export-me.js'),'utf8'),"console.log('export-me-body');");
   await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'import-me.JS',mimeType:'text/javascript',buffer:Buffer.from("console.log('import-me-body');")});await page.getByRole('textbox',{name:'Snippet title',exact:true}).fill(prefix+' Imported');assert.equal(await editor.innerText(),"console.log('import-me-body');");const imported=await save();assert.equal(imported.status,201);assert.equal(imported.data.filename,'import-me.JS');await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('forbidden')});assert.equal(await editor.innerText(),"console.log('import-me-body');");assert.equal(await page.getByRole('textbox',{name:'Filename',exact:true}).inputValue(),'import-me.JS');
  });
  await check('dirtynavigationcancel andnativebeforeunload',async()=>{
   await page.getByRole('textbox',{name:'Snippet title',exact:true}).fill(prefix+' Unsaved');await code("console.log('unsaved-body');");dialogAnswer=false;await load(beta.title);assert.equal(await editor.innerText(),"console.log('unsaved-body');");assert.equal(await page.getByRole('textbox',{name:'Snippet title',exact:true}).inputValue(),prefix+' Unsaved');
   const prompted=page.waitForEvent('dialog');const reloading=page.reload({timeout:5000}).catch(()=>{});const dialog=await prompted;assert.equal(dialog.type(),'beforeunload');await reloading;assert.equal(await editor.innerText(),"console.log('unsaved-body');");dialogAnswer=true;
  });
  await check('paneresize survivesreload',async()=>{
   const vertical=page.getByRole('separator',{name:'Resize editor and preview',exact:true}),horizontal=page.getByRole('separator',{name:'Resize preview and console',exact:true});
   const before=await vertical.getAttribute('aria-valuenow');await vertical.click();await page.keyboard.press('ArrowRight');await horizontal.click();await page.keyboard.press('ArrowDown');const savedWidth=await vertical.getAttribute('aria-valuenow'),savedHeight=await horizontal.getAttribute('aria-valuenow');assert.notEqual(savedWidth,before);await page.reload();await editor.waitFor();assert.equal(await vertical.getAttribute('aria-valuenow'),savedWidth);assert.equal(await horizontal.getAttribute('aria-valuenow'),savedHeight);
  });
  await check('consolefollow preserves scrolledupposition',async()=>{
   await page.getByRole('button',{name:'Clear console',exact:true}).click();await code("for(let i=0;i<40;i++)console.log('row-'+i);");await page.getByRole('textbox',{name:'Filename',exact:true}).fill('rows.js');await page.getByRole('button',{name:/^Run/}).click();await page.getByRole('log').getByText('row-39',{exact:true}).waitFor();const consolePane=page.getByRole('log');await consolePane.evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});await code("console.log('after-scroll-up');");await page.getByRole('button',{name:/^Run/}).click();await consolePane.getByText('after-scroll-up',{exact:true}).waitFor();assert.equal(await consolePane.evaluate(e=>e.scrollTop),0);await consolePane.evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await code("console.log('after-scroll-down');");await page.getByRole('button',{name:/^Run/}).click();await consolePane.getByText('after-scroll-down',{exact:true}).waitFor();assert(await consolePane.evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight<30));
  });
  await check('documentedkeyboard RunSaveClear',async()=>{
   await draft(prefix+' Keyboard','keyboard.js',"document.body.innerHTML='<p>keyboard-marker</p>';console.log('keyboard-log');");await editor.click();await page.keyboard.press('Control+Enter');await page.frameLocator('iframe').getByText('keyboard-marker',{exact:true}).waitFor();const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/snippets'));await page.keyboard.press('Control+s');assert.equal((await pending).status(),201);await page.keyboard.press('Control+Shift+k');assert.equal(await page.locator('.entry').count(),0);
  });
  await check('syntaxcolours bracketmatch andthreepane labels',async()=>{
   for(const [name,value]of[['colour.js','const data = { value: 1 };'],['colour.html','<!doctype html><html><body><h1>Hello</h1></body></html>'],['colour.css','h1 { color: red; font-size: 20px; }']]){await page.getByRole('textbox',{name:'Filename',exact:true}).fill(name);await code(value);assert(await page.locator('.cm-line span[class]').count()>0);}
   await page.getByRole('textbox',{name:'Filename',exact:true}).fill('bracket.js');await code('const data = { value: 1 };');await page.keyboard.press('Home');for(let i=0;i<13;i++)await page.keyboard.press('ArrowRight');assert(await page.locator('.cm-matchingBracket').count()>=2);
  });
  await check('rename persists onlytitle andkeepsunsavedcodefilename',async()=>{
   await draft(prefix+' Rename Draft','rename-original.js',"console.log('stored-original');");const original=(await save()).data;await code("console.log('unsaved-code-kept');");await page.getByRole('textbox',{name:'Filename',exact:true}).fill('unsaved-name.js');dialogValue=prefix+' Renamed With Draft';const pending=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/api/snippets/'+original.id));await page.getByRole('button',{name:'Rename',exact:true}).click();assert.equal((await pending).status(),200);const persisted=await read(original.id);assert.equal(persisted.title,dialogValue);assert.equal(persisted.filename,'rename-original.js');assert.equal(persisted.code,"console.log('stored-original');");assert.equal(persisted.revision,original.revision+1);assert.equal(await editor.innerText(),"console.log('unsaved-code-kept');");assert.equal(await page.getByRole('textbox',{name:'Filename',exact:true}).inputValue(),'unsaved-name.js');assert.match(await page.locator('.editor .paneheading').first().innerText(),/Unsaved changes/);
  });
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(evidence,'library-desktop.png'),fullPage:true});fs.writeFileSync(path.join(evidence,'library-results.json'),JSON.stringify({base,results,errors,records:{alpha,beta}},null,2));console.log(JSON.stringify({result:'pass',checks:results.length}));
 }catch(error){await page.screenshot({path:path.join(evidence,'library-failure.png'),fullPage:true});fs.writeFileSync(path.join(evidence,'library-results.json'),JSON.stringify({base,results,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
