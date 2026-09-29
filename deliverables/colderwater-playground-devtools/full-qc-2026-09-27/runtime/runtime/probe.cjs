const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core'));
const base=process.env.COLDERWATER_URL||'http://localhost:3312';
const evidence=process.env.COLDERWATER_EVIDENCE||path.join(__dirname,'ui-evidence');fs.mkdirSync(evidence,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1208/chrome-win64/chrome.exe')});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 const editor=page.getByRole('textbox',{name:'Code editor',exact:true});
 async function source(code,name='probe.js'){await page.getByRole('textbox',{name:'Filename',exact:true}).fill(name);await editor.click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);}
 async function run(code,name='probe.js'){await source(code,name);await page.getByRole('button',{name:/^Run/}).click();}
 const log=()=>page.getByRole('log').innerText();
 const frame=()=>page.frameLocator('iframe[title="Live preview"]');
 async function complete(){await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'),{timeout:8000});}
 async function marker(text){await frame().getByText(text,{exact:true}).waitFor({timeout:8000});}
 async function check(name,fn){await fn();results.push({name,result:'pass'});console.log('PASS',name);}
 try{
  await page.goto(base);await editor.waitFor();await complete();
  await check('working example and realCodeMirror',async()=>{assert((await log()).length>0);assert((await frame().locator('body').innerText()).length>0);assert(await page.locator('.cm-lineNumbers').count());});
  await page.screenshot({path:path.join(evidence,'desktop-dark.png'),fullPage:true});
  await check('language dispatch preservesCSSDOMwithoutglobals',async()=>{
   await run("document.body.innerHTML='<p>js-dispatch-ok</p>';console.log('js-dispatch-log');",'dispatch.JS');await complete();await marker('js-dispatch-ok');
   await run('<!doctype html><html><body><h1 id="dispatch-mark">html-dispatch-ok</h1><script>window.oldGlobal="do-not-carry";console.log("html-once-marker");</script></body></html>','dispatch.html');await complete();await marker('html-dispatch-ok');
   const before=(await log()).split('html-once-marker').length;
   await run('#dispatch-mark { color: rgb(255, 0, 0); }','dispatch.CSS');await complete();assert.equal(await frame().locator('#dispatch-mark').evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');assert.equal((await log()).split('html-once-marker').length,before);
   await run("document.body.innerHTML='<p>fresh-'+typeof window.oldGlobal+'</p>';",'dispatch.js');await complete();await marker('fresh-undefined');
  });
  await run("document.body.innerHTML='<p>good-preview-marker</p>';console.log('good-preview-log');",'good.js');await complete();
  for(const [name,code,match,line] of [
   ['bad.js',"document.body.innerHTML='<p>failed-partial-dom</p>';\nconst marker = 1;\nconst items = [1, 2, 3];\nitems.forEeach((n) => n);",'forEeach',4],
   ['bad.html','<!doctype html>\n<html>\n<body>\n<h1>Failed HTML candidate</h1>\n<script>\nundefinedFunctionCall();\n</script>\n</body>\n</html>','undefinedFunctionCall',6],
   ['delayed-error.js',"document.body.innerHTML='<p>async-failed-candidate</p>';\nsetTimeout(() => { throw new Error('async-error-marker'); }, 50);",'async-error-marker',2],
   ['rejected-promise.js',"document.body.innerHTML='<p>promise-failed-candidate</p>';\nPromise.reject(new Error('promise-error-marker'));",'promise-error-marker',2]]){
   await check(`${name} reportsuserline${line} androllsback`,async()=>{await run(code,name);await page.getByRole('log').getByText(new RegExp(`${match}.*line ${line}`)).waitFor({timeout:8000});await marker('good-preview-marker');});
  }
  await check('opaque sandbox and unsupportedcode refusal',async()=>{
   const title=await page.title();await run("let a='no',b='no';try{parent.document.title='bad'}catch(e){a='blocked'}try{parent.localStorage.setItem('cw-isolation-probe','bad')}catch(e){b='blocked'}document.body.innerHTML='<p>isolation-'+a+'-'+b+'</p>';console.log('eval Function WebAssembly Worker import are words');");await complete();await marker('isolation-blocked-blocked');assert.equal(await page.title(),title);assert.equal(await page.evaluate(()=>localStorage.getItem('cw-isolation-probe')),null);
   await run("eval('1+1')");await page.getByRole('log').getByText(/outside this playground/).waitFor();await marker('isolation-blocked-blocked');
  });
  await check('loop timeout responsivehost andlastgood',async()=>{
   await run("document.body.innerHTML='<p>timeout-control</p>';console.log('timeout-control');");await complete();
   for(const loop of ['while(true){}','while(true);']){await run(`console.log('before-hang');${loop}`);const start=Date.now();const theme=page.getByRole('button',{name:/^(Light|Dark) theme$/});await theme.click({timeout:1500});assert(Date.now()-start<1500);await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.includes('time limit')||[...document.querySelectorAll('.entry.error')].some(e=>e.textContent.includes('time limit')),{timeout:8000});await marker('timeout-control');}
   assert.match(await log(),/before-hang/);
  });
  await check('newrun andStop suppresslatecallbacks',async()=>{
   await run("window.__leak='A';document.body.innerHTML='<p>candidate-A</p>';console.log('cancel-A-start');setTimeout(()=>console.log('cancel-A-delayed'),4000);");await page.getByRole('log').getByText('cancel-A-start',{exact:true}).waitFor();
   await run("document.body.innerHTML='<p>run-B-'+typeof window.__leak+'</p>';console.log('cancel-B');");await complete();await marker('run-B-undefined');
   await run("document.body.innerHTML='<p>stop-candidate</p>';console.log('stop-started');setTimeout(()=>console.log('stop-delayed'),4000);");await page.getByRole('log').getByText('stop-started',{exact:true}).waitFor();await page.getByRole('button',{name:'Stop',exact:true}).click();await marker('run-B-undefined');await page.waitForTimeout(4500);assert(!/cancel-A-delayed|stop-delayed/.test(await log()));
  });
  await check('timer runaway rollback andrecovery',async()=>{
   await run("document.body.innerHTML='<p>failed-loop-candidate</p>';setTimeout(()=>{while(true){}},50);");await page.waitForFunction(()=>[...document.querySelectorAll('.entry.error')].some(e=>e.textContent.includes('time limit')),{timeout:8000});await page.waitForTimeout(5500);await marker('run-B-undefined');
   await run("document.body.innerHTML='<p>recovered</p>';console.log('recovered');");await complete();await marker('recovered');
  });
  await check('ordered expandableconsole andclear',async()=>{
   await page.getByRole('button',{name:'Clear console',exact:true}).click();await run("console.log('level-log');console.warn('level-warn');console.error('level-error');console.info('level-info');console.log({tag:'object-check',nested:{deep:'nested-value'}});console.log([11,22,33]);");await complete();const text=await log();assert(text.indexOf('level-log')<text.indexOf('level-warn'));assert(text.indexOf('level-warn')<text.indexOf('level-error'));assert(text.indexOf('level-error')<text.indexOf('level-info'));
   await page.getByRole('log').locator('summary').first().click();await page.getByRole('log').locator('summary').nth(1).click();assert.match(await log(),/nested-value/);await page.getByRole('log').getByText('Array(3)',{exact:true}).click();assert.match(await log(),/33/);
  });
  await check('autorun debounceoffcancels queuedrun',async()=>{
   await page.getByRole('checkbox',{name:'Auto-run',exact:true}).check();await source("document.body.innerHTML='<p>auto-fired</p>';console.log('auto-fired');");await marker('auto-fired');await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();await source("document.body.innerHTML='<p>auto-off</p>';console.log('auto-off');");await page.waitForTimeout(2100);await marker('auto-fired');await page.getByRole('button',{name:/^Run/}).click();await complete();await marker('auto-off');
   await page.getByRole('checkbox',{name:'Auto-run',exact:true}).check();await source("document.body.innerHTML='<p>auto-queued</p>';console.log('auto-queued');");await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();await page.waitForTimeout(2100);await marker('auto-off');await page.getByRole('button',{name:/^Run/}).click();await complete();await marker('auto-queued');
  });
  await check('editor indentation andmobilethemereachability',async()=>{
   const code='const alpha = 1;\nconst beta = 2;\nconst gamma = 3;';await source(code);await editor.click();await page.keyboard.press('Control+A');await page.keyboard.press('Tab');assert((await editor.innerText()).includes('  const alpha'));await page.keyboard.press('Shift+Tab');assert.equal(await editor.innerText(),code);
   await page.getByRole('button',{name:/^(Light|Dark) theme$/}).click();await page.screenshot({path:path.join(evidence,'desktop-light.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});
  });
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'runtime-results.json'),JSON.stringify({base,results,errors},null,2));console.log(JSON.stringify({result:'pass',checks:results.length}));
 }catch(error){await page.screenshot({path:path.join(evidence,'runtime-failure.png'),fullPage:true});fs.writeFileSync(path.join(evidence,'runtime-results.json'),JSON.stringify({base,results,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
