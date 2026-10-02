'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser,ObservationLedger,digest}=require('./workflow_core.cjs');
const {runLifecycle}=require('./lifecycle_flow.cjs'),{runCompletedStop,runTitleRules}=require('./fairness_flow.cjs'),{runStale}=require('./stale_flow.cjs');
const {definitions}=require('./prepare_lifecycle_variants.cjs');
const file=process.env.CW_INPUTS,log=process.env.CW_LOG_DIR,mode=process.env.CW_CASE;assert(file&&log&&mode);
const manifest=JSON.parse(fs.readFileSync(file)),inputs={...manifest,scenarios:Object.fromEntries(Object.entries(manifest.scenarios).map(([id,row])=>[id,{...row,protocol:row.protocol.replace(/\r\n/g,'\n')}]))};assert(manifest.freeze_confirmed&&manifest.criteria.length===75);
const ledger=new ObservationLedger({manifest_sha256:digest(fs.readFileSync(file)),round_input_sha256:manifest.round_input_sha256,mode,scope:'Independent scripted lifecycle facts; no full judge or Oracle result'}),facts={},state={},expected={};
const emit=(key,pass,evidence)=>{facts[key]={product_pass:Boolean(pass),evidence,criterion_ids:manifest.criteria.filter(c=>c.evidence_keys.includes(key)).map(c=>c.id)};fs.writeFileSync(path.join(log,'focused-progress.json'),JSON.stringify({facts},null,2)+'\n');};
const rows={S03:['later_interactions','completed_stop','completed_stop_preview','completed_stop_recovery'],S04:['supersede_pending','stop_pending_execution','stop_pending_rollback','pending_stop_recovery'],S05:['preview_origin_boundary','origin_boundary_recovery'],S09:['literal_loop_deadline','literal_loop_rollback','literal_loop_recovery'],S36:['callback_shared_run_deadline','callback_timeout_rollback','callback_deadline_recovery'],S23:['stale_save_server_refusal','stale_save_draft_preservation','stale_save_reapply'],S24:['title_trimming','title_collision_refusal','title_empty_rejected','title_case_sensitive','title_refusal_recovery']};
const broken={
 'completed-stop-drop-preview':['completed_stop_preview'],
 'completed-stop-no-recovery':['completed_stop_recovery'],'completed-stop-earlier-failure':['completed_stop'],
 'pending-stop-no-recovery':['pending_stop_recovery'],'pending-stop-drop-preview':['stop_pending_rollback'],'pending-stop-earlier-failure':['stop_pending_execution'],
 'supersession-b-fails':['supersede_pending'],
 'origin-no-recovery':['origin_boundary_recovery'],'origin-earlier-failure':['preview_origin_boundary'],
 'loop-no-recovery':['literal_loop_recovery'],'loop-drop-preview':['literal_loop_rollback'],'loop-earlier-failure':['literal_loop_deadline','literal_loop_rollback'],
 'callback-no-recovery':['callback_deadline_recovery'],'callback-drop-preview':['callback_timeout_rollback'],'callback-earlier-failure':['callback_shared_run_deadline','callback_timeout_rollback'],
 'stale-no-reapply':['stale_save_reapply'],'stale-drop-draft':['stale_save_draft_preservation'],'stale-accepted':['stale_save_server_refusal','stale_save_draft_preservation'],
 'title-no-recovery':['title_refusal_recovery'],'title-empty-accepted':['title_empty_rejected']
};
async function main(){
 const definition=definitions.find(x=>x.name===mode);assert(definition||mode==='golden');
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),d=new GoldenBrowser(await context.newPage(),ledger,'http://localhost:3000');await d.open();await d.completed();await d.disableAutoIfAvailable();
  const scenarios=definition?[definition.scenario]:process.env.CW_SCENARIOS?process.env.CW_SCENARIOS.split(','):Object.keys(rows);
  assert(scenarios.every(id=>rows[id]),'Unknown focused scenario');
  for(const id of scenarios){
   await ledger.observe({id},async()=>{
    if(id==='S03')return runCompletedStop(d,ledger,inputs,emit,state);
    if(id==='S23')return runStale(d,ledger,inputs,emit,state);
    if(id==='S24')return runTitleRules(d,ledger,inputs,emit,state);
    return runLifecycle(id,d,ledger,inputs,emit,state);
   });
   for(const key of rows[id])expected[id+'.'+key]=!(broken[mode]??[]).includes(key);
  }
  ledger.report.facts=facts;ledger.report.expected=expected;ledger.report.expectations=Object.entries(expected).map(([key,value])=>({key,expected:value,actual:facts[key]?.product_pass??null,matched:facts[key]?.product_pass===value}));
  ledger.report.passed=ledger.report.expectations.every(x=>x.matched)&&ledger.report.observations.every(x=>x.status==='observed pass');
 }finally{await browser.close();}
}
main().catch(error=>{ledger.report.fatal_error=String(error);ledger.report.fatal_stack=error.stack;ledger.report.passed=false;}).finally(()=>{ledger.finish();ledger.write(path.join(log,'focused-results.json'));console.log(JSON.stringify({mode,passed:ledger.report.passed,wall_ms:ledger.report.wall_ms,expectations:ledger.report.expectations,fatal_error:ledger.report.fatal_error}));if(!ledger.report.passed)process.exitCode=1;});
