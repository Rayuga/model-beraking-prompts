'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {runCurrent}=require('./current_flow.cjs');
const {runCompletedStop,runTitleRules}=require('./fairness_flow.cjs');
const {recordDuration,durationResults}=require('./repair_flow.cjs');
const file=process.env.CW_INPUTS,log=process.env.CW_LOG_DIR,mode=process.env.CW_CASE;assert(file&&log&&mode);
const manifest=JSON.parse(fs.readFileSync(file)),inputs={...manifest,scenarios:Object.fromEntries(Object.entries(manifest.scenarios).map(([id,row])=>[id,{...row,protocol:row.protocol.replace(/\r\n/g,'\n')}]))};
const ledger=new ObservationLedger({manifest_sha256:digest(fs.readFileSync(file)),round_input_sha256:manifest.round_input_sha256,mode,scope:'Focused scripted fairness witness; not full grading'}),facts={},state={};
const emit=(key,pass,evidence)=>facts[key]={product_pass:Boolean(pass),evidence};
const expected={};
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),d=new GoldenBrowser(page,ledger,'http://localhost:3000');
  await d.open();await d.completed();await d.disableAutoIfAvailable();
  if(['golden','run-duration-only','constant-zero-duration'].includes(mode)){
   if(mode==='run-duration-only')await ledger.observe({id:'former-S02-duration-witness'},async()=>{
    const code=inputs.scenarios.S02.protocol.split('\n').find(line=>line.startsWith('<!doctype html>')&&line.includes('css-timer-state'));assert(code);
    await d.run(code,'css-timer.html');const initial=await d.status(),started=ledger.relative();
    await d.preview().getByRole('button',{name:'Queue timer'}).click();
    await page.waitForFunction(()=>document.querySelector('[role="log"]')?.textContent.includes('css-timer-fired-1'),null,{timeout:8500});await d.completed();
    const witness={durations:[]};recordDuration(witness,'post-completion-click',await d.status(),ledger.relative()-started);
    ledger.report.former_duration_witness={initial,body:await d.body(),marker_observed:(await d.logs()).includes('css-timer-fired-1'),...witness.durations[0]};
    assert(ledger.report.former_duration_witness.marker_observed&&witness.durations[0].display_ms<3000&&!witness.durations[0].consistent,'Variant must visibly preserve the short original Run duration after its working later timer');
   });
   await ledger.observe({id:'S16'},async()=>{await runCurrent('S16',d,ledger,{...inputs,stage:'history'},emit,state);await runCurrent('S16',d,ledger,{...inputs,stage:'clear'},emit,state);durationResults(state,(key,...args)=>{if(key==='S16.console_duration')emit(key,...args);});});
   expected['S16.console_duration']=mode!=='constant-zero-duration';
  }
  if(mode==='golden'||mode.startsWith('padded-')||mode==='dead-writer'){
   await ledger.observe({id:'S24'},()=>runTitleRules(d,ledger,inputs,emit,state));
   Object.assign(expected,{'S24.title_trimming':mode==='golden','S24.title_collision_refusal':mode!=='dead-writer','S24.title_empty_rejected':mode!=='dead-writer','S24.title_case_sensitive':mode!=='dead-writer'});
  }
  if(['golden','long-idle-handlers','never-working-handlers','broken-html-dispatch'].includes(mode)){
   await ledger.observe({id:'S03'},()=>runCompletedStop(d,ledger,inputs,emit,state));
   Object.assign(expected,{'S03.later_interactions':['golden','broken-html-dispatch'].includes(mode),'S03.completed_stop':mode!=='never-working-handlers'});
   if(mode==='broken-html-dispatch'){
    const initial=facts['S03.later_interactions']?.evidence;
    ledger.report.html_dispatch_failure_retained=initial?.html_initial?.ok===false&&initial?.initial?.value?.filename==='interaction.js';
    assert(ledger.report.html_dispatch_failure_retained,'HTML defect and actual JS fallback must both be observed');
   }
  }
  assert(Object.keys(expected).length,'Unknown focused mode '+mode);
  ledger.report.expected=expected;ledger.report.facts=facts;
  ledger.report.expectations=Object.entries(expected).map(([key,value])=>({key,expected:value,actual:facts[key]?.product_pass??null,matched:facts[key]?.product_pass===value}));
  ledger.report.passed=ledger.report.expectations.every(row=>row.matched)&&ledger.report.observations.every(row=>row.status==='observed pass');
 }finally{await browser.close();}
}
main().catch(error=>{ledger.report.fatal_error=String(error);ledger.report.fatal_stack=error.stack;ledger.report.passed=false;}).finally(()=>{
 ledger.finish();ledger.write(path.join(log,'focused-results.json'));
 console.log(JSON.stringify({mode,passed:ledger.report.passed,wall_ms:ledger.report.wall_ms,expectations:ledger.report.expectations,fatal_error:ledger.report.fatal_error}));
 if(!ledger.report.passed)process.exitCode=1;
});
