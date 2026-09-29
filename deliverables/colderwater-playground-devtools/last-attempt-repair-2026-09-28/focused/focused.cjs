const fs=require('fs'),assert=require('assert/strict');
const{chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const{GoldenBrowser,ObservationLedger}=require('./workflow_core.cjs');
const ledger=new ObservationLedger(),result={scope:'Focused current golden browser checks, not an Oracle score',checks:[]};
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),d=new GoldenBrowser(page,ledger,'http://localhost:3000');
  await d.open();await d.completed();await d.disableAutoIfAvailable();
  async function check(name,fn){await fn();result.checks.push({name,passed:true});console.log('PASS',name);}
  const good="document.body.innerHTML='<p>budget-good</p>';console.log('budget-good');";
  await check('looping_promise_callback_times_out_and_rolls_back',async()=>{
   await d.run(good,'budget.js');
   await d.run("console.log('before-promise-hang');\nPromise.resolve().then(() => { console.log('promise-loop-entered'); while (true) {} });",'budget.js',false);
   await page.waitForFunction(()=>/time.?limit|timed out/i.test(document.querySelector('[role=log]')?.textContent||''),null,{timeout:8500});
   assert.match(await d.logs(),/promise-loop-entered/);assert.equal(await d.body(),'budget-good');
   await d.run("document.body.innerHTML='<p>promise-recovered</p>';console.log('promise-recovered');",'budget.js');
   assert.equal(await d.body(),'promise-recovered');
  });
  await check('nested_callbacks_share_original_deadline',async()=>{
   await d.run("document.body.innerHTML='<p>nested-control-ready</p>';\nsetTimeout(() => { console.log('nested-control-entered'); setTimeout(() => { document.body.innerHTML='<p>nested-control-done</p>'; console.log('nested-control-done'); }, 200); }, 200);",'nested.js');
   assert.equal(await d.body(),'nested-control-done');assert.match(await d.logs(),/nested-control-done/);
   await d.run("document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); setTimeout(() => { document.body.innerHTML='<p>forbidden-nested-completion</p>'; console.log('forbidden-nested-completion'); }, 3000); }, 3000);",'nested.js',false);
   await page.waitForTimeout(10000);
   assert.match(await d.logs(),/time.?limit|timed out/i);assert.match(await d.logs(),/late-callback-entered/);
   assert.doesNotMatch(await d.logs(),/forbidden-nested-completion/);assert.equal(await d.body(),'nested-control-done');
   await d.run("document.body.innerHTML='<p>shared-deadline-recovered</p>';console.log('shared-deadline-recovered-log');",'nested.js');
   assert.equal(await d.body(),'shared-deadline-recovered');
  });
  await check('console_history_duration_clear',async()=>{
   await d.run("console.log('history-first');",'history.js');assert.match(await d.status(),/\d.*(?:ms|s)/);
   await d.run("document.body.innerHTML='<p>theme-shared-preview</p>';console.log('history-second');",'history.js');
   const text=await d.logs();assert(text.indexOf('history-first')<text.indexOf('history-second'));
   await page.getByRole('button',{name:/Clear console/}).click();assert.doesNotMatch(await d.logs(),/history-(first|second)/);
  });
  await page.screenshot({path:'/work/workspace.png',fullPage:true});
  result.passed=true;result.pageErrors=ledger.report.browser_errors;
 }finally{await browser.close();}
}
main().catch(e=>{result.passed=false;result.error=String(e);process.exitCode=1;console.error(e);}).finally(()=>fs.writeFileSync('/work/results.json',JSON.stringify(result,null,2)));
