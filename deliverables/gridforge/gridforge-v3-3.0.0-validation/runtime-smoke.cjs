const assert=require('node:assert/strict'), fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const c=await b.newContext(),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://localhost:3000');await p.locator('[data-addr="D2"]').waitFor();
  assert.equal(await p.locator('[data-addr="D2"]').textContent(),'360');
  await p.locator('#name-box').fill('F3');await p.locator('#name-box').press('Enter');
  await p.keyboard.type('V3-PERSISTENCE');await p.keyboard.press('Enter');
  assert.equal(await p.locator('.cell.selected').getAttribute('data-addr'),'F4');
  await p.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved',null,{timeout:5000});
  const before=await p.evaluate(async()=>(await fetch('/api/workbooks/ops-plan')).json());
  await c.close();execFileSync('bash',['/tests/restart-app.sh'],{stdio:'inherit',timeout:45000});
  const fresh=await b.newPage();await fresh.goto('http://localhost:3000');
  await fresh.waitForFunction(()=>document.querySelector('[data-addr="F3"]')?.textContent==='V3-PERSISTENCE');
  assert.deepEqual(await fresh.evaluate(async()=>(await fetch('/api/workbooks/ops-plan')).json()),before);
  assert.deepEqual(errors,[]);
  const result={scope:'Current v3 source; cached tool image, not new Docker build or Oracle',passed:['shell and JS syntax (runner)','startup under renamed lifecycle home','seed formula','grid commit navigation','autosave','real process restart and fresh-context persisted snapshot'],page_errors:errors};
  fs.writeFileSync('/results/runtime-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
