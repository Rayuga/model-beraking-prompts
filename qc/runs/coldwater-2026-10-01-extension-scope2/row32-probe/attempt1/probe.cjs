'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prompt = fs.readFileSync('/task/tests/scored/functional/prompt.md', 'utf8').replace(/\r\n/g, '\n');
const exact = prompt.split('2. As separate .js runs, try each of these five bounded sources:\n')[1].split('\n').slice(0, 5);
const supported = prompt.split('1. With auto-run off, run this valid complete HTML source as scope-control.html:\n')[1].split('\nThe paragraph and console message')[0];
const report = {scope:'Isolated browser protocol counterexample, no configured judge or full app score', input_sha256:'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8', binding:{prompt_sha256:sha('/task/tests/scored/functional/prompt.md'), criterion_sha256:sha('/task/tests/scored/functional/judge.toml'), fixture_sha256:sha('/evidence/fixture.html'), driver_sha256:sha(__filename)}, modes:{}};
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium', headless:true, args:['--no-sandbox']});
 try {
  for (const mode of ['early','late']) {
   const page = await browser.newPage();
   const browserErrors=[]; page.on('pageerror',error=>browserErrors.push(error.message));
   await page.setContent(fs.readFileSync('/evidence/fixture.html','utf8'));
   await page.evaluate(mode=>window.probeMode=mode,mode);
   async function run(code,name='probe.js') {
    const before=await page.locator('#console').innerText();
    await page.locator('#filename').fill(name); await page.locator('#source').fill(code);
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent!=='Running');
    const logs=await page.locator('#console').innerText();
    const previewText=await page.frameLocator('#preview iframe').locator('body').innerText();
    return {source:code, status:await page.locator('#status').innerText(), newLogs:logs.slice(before.length), previewText};
   }
   const control = await run(supported,'scope-control.html');
   assert.equal(control.status,'Complete'); assert.match(control.newLogs,/ordinary-binding ordinary-function/);
   const probes=[];
   for (const code of exact) probes.push(await run(code));
   for (const observation of probes) {assert.equal(observation.status,'Unsupported execution refused'); assert.equal(observation.previewText,control.previewText); assert.equal(observation.newLogs.trim(),'Unsupported execution refused');}
   const recovery = await run("document.body.innerHTML='<p>row32-recovered</p>';console.log('row32-recovered-log');");
   assert.equal(recovery.previewText,'row32-recovered');assert.match(recovery.newLogs,/row32-recovered-log/);
   // Diagnostic changes are evidence of the defective fixture's actual behavior,
   // not claimed to be prescribed steps in the frozen task.
   const diagnostics=[];
   for(const code of ["eval('console.log(\"ROW32_EVAL_EXECUTED\")');", "new Function('console.log(\"ROW32_FUNCTION_EXECUTED\")')();", "new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));console.log('ROW32_WASM_CONSTRUCTED');", "const worker=new Worker('data:text/javascript,postMessage(1)');worker.onmessage=e=>{console.log('ROW32_WORKER_EXECUTED',e.data);worker.terminate();};", "import('data:text/javascript,console.log(%22ROW32_IMPORT_EXECUTED%22);export const answer=1');"]) diagnostics.push(await run(code));
   report.modes[mode]={control,probes,recovery,diagnostics,browserErrors};
   await page.close();
  }
  for(let i=0;i<exact.length;i++) assert.deepEqual(report.modes.early.probes[i],report.modes.late.probes[i]);
  assert(report.modes.early.diagnostics.every(x=>!x.newLogs.includes('ROW32_')));
  assert(report.modes.late.diagnostics.every(x=>x.newLogs.includes('ROW32_')));
  report.original_observations_identical=true;
  report.diagnostic_forbidden_user_effects_only_in_late_mode=true;
  report.limits='Five bounded families only. The fixture is a protocol-level weak app; no gates, full configured judge, Oracle, model or reward score was run. Diagnostics use visible console effects; no hidden execution-state inference establishes a product verdict.';
 } finally {await browser.close();fs.writeFileSync('/evidence/observations.json',JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({original_observations_identical:report.original_observations_identical, diagnostic_forbidden_user_effects_only_in_late_mode:report.diagnostic_forbidden_user_effects_only_in_late_mode}));
})().catch(error=>{console.error(error);process.exitCode=1;});
